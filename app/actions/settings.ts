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

/** 2. 施設種別マスタ */
export async function saveFacilityType(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const id = num(fd, "id");
  const name = str(fd, "name");
  if (!name) return { status: "error", message: "表示名は必須です" };

  const values = {
    name,
    capacityUnit: (str(fd, "capacityUnit") === "kW" ? "kW" : "kVA") as "kVA" | "kW",
    coefficientTableId: num(fd, "coefficientTableId"),
    secondaryCoefficientTableId: num(fd, "secondaryCoefficientTableId"),
    sortOrder: num(fd, "sortOrder") ?? 0,
    isActive: str(fd, "isActive") === "0" ? 0 : 1,
  };

  if (id) {
    db.update(schema.facilityTypes).set(values).where(eq(schema.facilityTypes.id, id)).run();
    return done("施設種別を更新しました");
  }
  db.insert(schema.facilityTypes).values(values).run();
  return done("施設種別を追加しました");
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
