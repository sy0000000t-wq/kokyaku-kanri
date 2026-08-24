"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { validateCoefficientRanges } from "@/lib/calc/coefficient-range";
import { resolveProvider } from "@/lib/geo";
import { getSettings } from "@/lib/queries";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string): number | null => {
  const raw = str(fd, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export type SettingsState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

function done(message: string): SettingsState {
  revalidatePath("/settings");
  revalidatePath("/customers");
  revalidatePath("/billing");
  revalidatePath("/");
  return { status: "ok", message };
}

/** 1. 基本設定 */
export async function saveBasicSettings(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const taxRate = num(fd, "taxRate");
  if (taxRate == null || taxRate < 0 || taxRate > 1) {
    return { status: "error", message: "消費税率は 0〜1 の小数で入力してください（例：0.10）" };
  }

  const mode = str(fd, "distanceMode");
  db.update(schema.settings)
    .set({
      baseAddress: str(fd, "baseAddress"),
      baseLat: num(fd, "baseLat"),
      baseLng: num(fd, "baseLng"),
      googleMapsApiKey: str(fd, "googleMapsApiKey") || null,
      taxRate,
      distanceMode:
        mode === "road" || mode === "straight" ? mode : "auto",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.settings.id, 1))
    .run();

  return done("設定を保存しました");
}

/** 基準住所 →「座標を取得」 */
export async function geocodeBaseAddress(address: string) {
  const settings = getSettings();
  if (!address.trim()) return { ok: false as const, message: "住所を入力してください" };

  try {
    const provider = resolveProvider(settings);
    const geo = await provider.geocode(address);
    if (!geo) return { ok: false as const, message: "座標を取得できませんでした" };

    db.update(schema.settings)
      .set({
        baseAddress: address,
        baseLat: geo.lat,
        baseLng: geo.lng,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.settings.id, 1))
      .run();

    revalidatePath("/settings");
    return { ok: true as const, lat: geo.lat, lng: geo.lng, formatted: geo.formattedAddress };
  } catch (e) {
    return { ok: false as const, message: (e as Error).message };
  }
}

/** 2. 設備区分マスタ */
export async function saveEquipmentCategory(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const id = num(fd, "id");
  const name = str(fd, "name");
  if (!name) return { status: "error", message: "表示名は必須です" };

  const group = str(fd, "categoryGroup");
  const unit = str(fd, "capacityUnit");
  const method = str(fd, "calculationMethod");

  const values = {
    name,
    categoryGroup: (group === "generation" || group === "other"
      ? group
      : "demand") as "demand" | "generation" | "other",
    capacityUnit: (unit === "kW" || unit === "none" ? unit : "kVA") as
      | "kVA"
      | "kW"
      | "none",
    calculationMethod: (method === "fixed" ? "fixed" : "table") as "table" | "fixed",
    coefficientTableId: num(fd, "coefficientTableId"),
    minCapacity: num(fd, "minCapacity"),
    maxCapacity: num(fd, "maxCapacity"),
    note: str(fd, "note"),
    sortOrder: num(fd, "sortOrder") ?? 0,
    isActive: str(fd, "isActive") === "0" ? 0 : 1,
  };

  if (values.calculationMethod === "table" && values.coefficientTableId == null) {
    return {
      status: "error",
      message: "係数表方式では換算係数テーブルの指定が必要です",
    };
  }

  if (id) {
    db.update(schema.equipmentCategories)
      .set(values)
      .where(eq(schema.equipmentCategories.id, id))
      .run();
    return done("設備区分を更新しました");
  }
  db.insert(schema.equipmentCategories).values(values).run();
  return done("設備区分を追加しました");
}

/** 2-2. 設備区分ごとの点検周期と補正 */
export async function saveCategoryCycle(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const id = num(fd, "id");
  const categoryId = num(fd, "categoryId");
  const name = str(fd, "name");
  const intervalMonths = num(fd, "intervalMonths");
  const multiplier = num(fd, "multiplier");
  const fixedPoints = num(fd, "fixedPoints");

  if (!categoryId) return { status: "error", message: "設備区分が不明です" };
  if (!name) return { status: "error", message: "周期名は必須です" };
  if (intervalMonths == null || intervalMonths < 0) {
    return { status: "error", message: "実施間隔は 0 以上の整数で入力してください" };
  }

  const category = db
    .select()
    .from(schema.equipmentCategories)
    .where(eq(schema.equipmentCategories.id, categoryId))
    .get();
  if (!category) return { status: "error", message: "設備区分が見つかりません" };

  if (category.calculationMethod === "table" && multiplier == null) {
    return { status: "error", message: "係数表方式では倍率が必要です" };
  }
  if (category.calculationMethod === "fixed" && fixedPoints == null) {
    return { status: "error", message: "固定方式では固定点数が必要です" };
  }

  const values = {
    categoryId,
    name,
    intervalMonths,
    multiplier: category.calculationMethod === "table" ? multiplier : null,
    fixedPoints: category.calculationMethod === "fixed" ? fixedPoints : null,
    requiresInsulationMonitor: str(fd, "requiresInsulationMonitor") === "on" ? 1 : 0,
    conditionNote: str(fd, "conditionNote"),
    sortOrder: num(fd, "sortOrder") ?? 0,
  };

  if (id) {
    db.update(schema.categoryCycles)
      .set(values)
      .where(eq(schema.categoryCycles.id, id))
      .run();
    return done("周期を更新しました");
  }
  db.insert(schema.categoryCycles).values(values).run();
  return done("周期を追加しました");
}

/** 使われていない周期だけ削除できる */
export async function deleteCategoryCycle(id: number) {
  const used = db
    .select()
    .from(schema.customerFacilities)
    .where(eq(schema.customerFacilities.categoryCycleId, id))
    .get();
  if (used) {
    return {
      ok: false as const,
      message: "この周期を使っている設備があるため削除できません",
    };
  }
  db.delete(schema.categoryCycles).where(eq(schema.categoryCycles.id, id)).run();
  revalidatePath("/settings");
  return { ok: true as const };
}

/** 3. 点検周期マスタ */
export async function saveInspectionCycle(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const id = num(fd, "id");
  const name = str(fd, "name");
  const intervalMonths = num(fd, "intervalMonths");
  const multiplier = num(fd, "coefficientMultiplier");

  if (!name) return { status: "error", message: "表示名は必須です" };
  if (intervalMonths == null || intervalMonths < 0)
    return { status: "error", message: "実施間隔は 0 以上の整数で入力してください" };
  if (multiplier == null || multiplier < 0)
    return { status: "error", message: "倍率は 0 以上で入力してください" };

  const values = {
    name,
    intervalMonths,
    coefficientMultiplier: multiplier,
    sortOrder: num(fd, "sortOrder") ?? 0,
    isActive: str(fd, "isActive") === "0" ? 0 : 1,
  };

  if (id) {
    db.update(schema.inspectionCycles).set(values).where(eq(schema.inspectionCycles.id, id)).run();
    return done("点検周期を更新しました");
  }
  db.insert(schema.inspectionCycles).values(values).run();
  return done("点検周期を追加しました");
}

/** 4. 請求サイクルマスタ */
export async function saveBillingCycle(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const id = num(fd, "id");
  const name = str(fd, "name");
  const intervalMonths = num(fd, "intervalMonths");

  if (!name) return { status: "error", message: "表示名は必須です" };
  if (intervalMonths == null || intervalMonths < 0)
    return { status: "error", message: "実施間隔は 0 以上の整数で入力してください" };

  const values = {
    name,
    intervalMonths,
    sortOrder: num(fd, "sortOrder") ?? 0,
    isActive: str(fd, "isActive") === "0" ? 0 : 1,
  };

  if (id) {
    db.update(schema.billingCycles).set(values).where(eq(schema.billingCycles.id, id)).run();
    return done("請求サイクルを更新しました");
  }
  db.insert(schema.billingCycles).values(values).run();
  return done("請求サイクルを追加しました");
}

/** 5. 換算係数テーブルの行を一括保存（保存前にレンジを検証） */
export async function saveCoefficientRows(input: {
  tableId: number;
  rows: { minCapacity: number; maxCapacity: number | null; coefficient: number }[];
}) {
  const issues = validateCoefficientRanges(input.rows);
  if (issues.some((i) => i.level === "error")) {
    return { ok: false as const, issues };
  }

  const sorted = [...input.rows].sort((a, b) => a.minCapacity - b.minCapacity);

  db.delete(schema.coefficientRows)
    .where(eq(schema.coefficientRows.tableId, input.tableId))
    .run();

  if (sorted.length > 0) {
    db.insert(schema.coefficientRows)
      .values(
        sorted.map((r, idx) => ({
          tableId: input.tableId,
          minCapacity: r.minCapacity,
          maxCapacity: r.maxCapacity,
          coefficient: r.coefficient,
          sortOrder: idx,
        })),
      )
      .run();
  }

  revalidatePath("/settings");
  revalidatePath("/customers");
  revalidatePath("/");
  return { ok: true as const, issues };
}

export async function checkCoefficientRows(
  rows: { minCapacity: number; maxCapacity: number | null; coefficient: number }[],
) {
  return validateCoefficientRanges(rows);
}
