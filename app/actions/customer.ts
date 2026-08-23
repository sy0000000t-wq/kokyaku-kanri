"use server";

import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, DATA_DIR } from "@/db";
import * as schema from "@/db/schema";
import { resolveProvider } from "@/lib/geo";
import { getSettings } from "@/lib/queries";
import { todayIso } from "@/lib/utils";

export type ActionState =
  | { status: "idle" }
  | { status: "ok"; id: number; message?: string }
  | { status: "error"; errors: Record<string, string>; message?: string };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string): number | null => {
  const raw = str(fd, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** 顧客ID の自動採番（T01 形式） */
export async function nextCustomerCode(): Promise<string> {
  const codes = db
    .select({ code: schema.customers.code })
    .from(schema.customers)
    .all()
    .map((r) => r.code);

  let max = 0;
  for (const code of codes) {
    const m = /^T(\d+)$/.exec(code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `T${String(max + 1).padStart(2, "0")}`;
}

function validate(fd: FormData, id: number | null) {
  const errors: Record<string, string> = {};

  const code = str(fd, "code");
  const name = str(fd, "name");
  const facilityTypeId = num(fd, "facilityTypeId");
  const inspectionCycleId = num(fd, "inspectionCycleId");
  const monthlyFee = num(fd, "monthlyFee");
  const address = str(fd, "address");
  const contractStartDate = str(fd, "contractStartDate");
  const contractEndDate = str(fd, "contractEndDate");
  const capacityKva = num(fd, "capacityKva");
  const capacityKw = num(fd, "capacityKw");
  const annualFeeHandling = str(fd, "annualFeeHandling") === "separate" ? "separate" : "included";
  const annualInspectionFee = num(fd, "annualInspectionFee");

  if (!code) errors.code = "顧客IDは必須です";
  else {
    const dup = db.select().from(schema.customers).all().find((c) => c.code === code);
    if (dup && dup.id !== id) errors.code = "同じ顧客IDが既に登録されています";
  }
  if (!name) errors.name = "物件名称は必須です";
  if (!facilityTypeId) errors.facilityTypeId = "施設種別は必須です";
  if (!inspectionCycleId) errors.inspectionCycleId = "点検周期は必須です";
  if (monthlyFee == null) errors.monthlyFee = "月額（税抜）は必須です";
  else if (monthlyFee < 0) errors.monthlyFee = "月額は 0 以上で入力してください";
  if (!address) errors.address = "住所は必須です";
  if (!contractStartDate) errors.contractStartDate = "契約開始日は必須です";

  const facilityType = facilityTypeId
    ? db.select().from(schema.facilityTypes).all().find((f) => f.id === facilityTypeId)
    : undefined;

  if (facilityType) {
    const needsKva = facilityType.capacityUnit === "kVA";
    const needsKw =
      facilityType.capacityUnit === "kW" || facilityType.secondaryCoefficientTableId != null;

    if (needsKva && capacityKva == null) errors.capacityKva = "設備容量（kVA）は必須です";
    if (needsKw && capacityKw == null) errors.capacityKw = "設備容量（kW）は必須です";
    if (capacityKva != null && capacityKva < 0) errors.capacityKva = "0 以上で入力してください";
    if (capacityKw != null && capacityKw < 0) errors.capacityKw = "0 以上で入力してください";
  }

  if (annualFeeHandling === "separate" && annualInspectionFee == null) {
    errors.annualInspectionFee = "「別途請求」のときは年次点検費が必須です";
  }

  if (contractEndDate && contractStartDate && contractEndDate < contractStartDate) {
    errors.contractEndDate = "解除日は契約開始日以降にしてください";
  }

  return {
    errors,
    values: {
      code,
      name,
      facilityTypeId: facilityTypeId!,
      capacityKva,
      capacityKw,
      inspectionCycleId: inspectionCycleId!,
      coefficientOverride:
        str(fd, "useCoefficientOverride") === "on" ? num(fd, "coefficientOverride") : null,
      monthlyFee: monthlyFee ?? 0,
      annualFeeHandling: annualFeeHandling as "included" | "separate",
      annualInspectionFee: annualFeeHandling === "separate" ? annualInspectionFee : null,
      unitPriceOverride:
        str(fd, "useUnitPriceOverride") === "on" ? num(fd, "unitPriceOverride") : null,
      address,
      lat: num(fd, "lat"),
      lng: num(fd, "lng"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      contactPerson: str(fd, "contactPerson"),
      contractStartDate,
      contractEndDate: contractEndDate || null,
      annualInspectionMonth: num(fd, "annualInspectionMonth"),
      annualInspectionDay: num(fd, "annualInspectionDay"),
      billingCycleId: num(fd, "billingCycleId"),
      paymentLagMonths: num(fd, "paymentLagMonths") ?? 1,
      isActive: str(fd, "isActive") === "0" ? 0 : 1,
      note: str(fd, "note"),
    },
  };
}

function saveInspectionMonths(customerId: number, fd: FormData) {
  const months = fd
    .getAll("inspectionMonths")
    .map((m) => Number(m))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);

  db.delete(schema.customerInspectionMonths)
    .where(eq(schema.customerInspectionMonths.customerId, customerId))
    .run();

  if (months.length > 0) {
    db.insert(schema.customerInspectionMonths)
      .values([...new Set(months)].map((month) => ({ customerId, month })))
      .run();
  }
}

export async function saveCustomer(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const rawId = Number(fd.get("id"));
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : null;

  const { errors, values } = validate(fd, id);
  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, message: "入力内容を確認してください" };
  }

  let customerId: number;
  if (id) {
    const before = db.select().from(schema.customers).all().find((c) => c.id === id);
    // 住所を変えたのに古い座標が残っていると、まったく別の場所の距離が出てしまう。
    // 座標を手入力し直していない限り、住所変更時はキャッシュを捨てて取り直す。
    const addressChanged = before != null && before.address !== values.address;
    const coordsUntouched =
      values.lat === before?.lat && values.lng === before?.lng;
    if (addressChanged && coordsUntouched) {
      values.lat = null;
      values.lng = null;
    }

    db.update(schema.customers)
      .set({ ...values, updatedAt: new Date().toISOString() })
      .where(eq(schema.customers.id, id))
      .run();
    customerId = id;
  } else {
    const inserted = db.insert(schema.customers).values(values).returning().get();
    customerId = inserted.id;
  }

  saveInspectionMonths(customerId, fd);

  // §4.3 距離は保存時に算出する。失敗しても保存自体は成功させる
  let message = id ? "保存しました" : "登録しました";
  try {
    const result = await recalcDistanceFor(customerId);
    if (!result.ok) message += "（距離は取得できませんでした）";
  } catch {
    message += "（距離は取得できませんでした）";
  }

  revalidatePath("/customers");
  revalidatePath("/schedule");
  revalidatePath("/billing");
  revalidatePath("/");
  return { status: "ok", id: customerId, message };
}

/** §5.3 稼働トグル。解除日を入れて is_active=0 にする（データは削除しない） */
export async function setCustomerActive(input: {
  id: number;
  isActive: boolean;
  contractEndDate?: string | null;
}) {
  db.update(schema.customers)
    .set({
      isActive: input.isActive ? 1 : 0,
      contractEndDate: input.isActive ? null : (input.contractEndDate ?? todayIso()),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.customers.id, input.id))
    .run();

  revalidatePath("/customers");
  revalidatePath("/schedule");
  revalidatePath("/billing");
  revalidatePath("/");
  return { ok: true as const };
}

/** §6 完全削除。削除前に JSON を data/deleted/ へ退避する */
export async function deleteCustomer(id: number) {
  const customer = db.select().from(schema.customers).all().find((c) => c.id === id);
  if (!customer) return { ok: false as const, message: "顧客が見つかりません" };

  const payload = {
    exportedAt: new Date().toISOString(),
    customer,
    inspectionMonths: db
      .select()
      .from(schema.customerInspectionMonths)
      .all()
      .filter((m) => m.customerId === id),
    inspectionRecords: db
      .select()
      .from(schema.inspectionRecords)
      .all()
      .filter((r) => r.customerId === id),
    billingRecords: db
      .select()
      .from(schema.billingRecords)
      .all()
      .filter((r) => r.customerId === id),
  };

  const dir = path.join(DATA_DIR, "deleted");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(
    path.join(dir, `${customer.code}-${stamp}.json`),
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  db.delete(schema.customers).where(eq(schema.customers.id, id)).run();

  revalidatePath("/customers");
  revalidatePath("/schedule");
  revalidatePath("/billing");
  revalidatePath("/");
  return { ok: true as const, message: `${customer.name} を削除しました` };
}

/** §4.3 距離の再計算（1件） */
export async function recalcDistanceFor(customerId: number) {
  const settings = getSettings();
  const customer = db.select().from(schema.customers).all().find((c) => c.id === customerId);
  if (!customer) return { ok: false as const, message: "顧客が見つかりません" };
  if (!settings.baseAddress || settings.baseLat == null || settings.baseLng == null) {
    return { ok: false as const, message: "設定画面で基準住所の座標を取得してください" };
  }

  const provider = resolveProvider(settings);

  let lat = customer.lat;
  let lng = customer.lng;
  if (lat == null || lng == null) {
    const geo = await provider.geocode(customer.address);
    if (!geo) {
      return {
        ok: false as const,
        message: "住所から座標を取得できませんでした。緯度経度を手入力してください",
      };
    }
    lat = geo.lat;
    lng = geo.lng;
  }

  const result = await provider.distance(
    { lat: settings.baseLat, lng: settings.baseLng },
    { lat, lng },
  );
  if (!result) return { ok: false as const, message: "距離を取得できませんでした" };

  db.update(schema.customers)
    .set({
      lat,
      lng,
      distanceKm: result.distanceKm,
      durationMin: result.durationMin,
      distanceMethod: result.method,
      distanceUpdatedAt: new Date().toISOString(),
    })
    .where(eq(schema.customers.id, customerId))
    .run();

  revalidatePath("/customers");
  revalidatePath("/");
  return { ok: true as const, distanceKm: result.distanceKm, method: result.method };
}

/** §4.3 一括再計算。レート制限は各プロバイダ側で守る */
export async function recalcAllDistances() {
  const customers = db.select().from(schema.customers).all().filter((c) => c.isActive);
  let success = 0;
  const failures: string[] = [];

  for (const c of customers) {
    try {
      const r = await recalcDistanceFor(c.id);
      if (r.ok) success++;
      else failures.push(`${c.code} ${c.name}: ${r.message}`);
    } catch (e) {
      failures.push(`${c.code} ${c.name}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/customers");
  return { ok: true as const, total: customers.length, success, failures };
}
