import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { seedMasters } from "../db/seed";
import { openDb } from "./db-connect";
import {
  isLegacySchema,
  mapLegacyFacility,
  pickCategoryCycle,
  snapshotAndDropLegacy,
  type CategoryCycleRow,
  type LegacySnapshot,
} from "./legacy-migration";

const { sqlite, db, dbPath } = openDb();
const dataDir = path.dirname(dbPath);

console.log(`DB: ${dbPath}`);

// 「換算値算出フロー図」反映前のスキーマなら、中身を退避してから作り直す
let legacy: LegacySnapshot | null = null;
if (isLegacySchema(sqlite)) {
  const { snapshot, file } = snapshotAndDropLegacy(sqlite, dataDir);
  legacy = snapshot;
  console.log("旧スキーマを検出しました。中身を退避します");
  console.log(`  退避先: ${file}`);
}

migrate(db, { migrationsFolder: path.join(process.cwd(), "db/migrations") });
console.log("スキーマを最新化しました");

const log = seedMasters(db);
if (log.length === 0) {
  console.log("マスタは投入済みです（変更なし）");
} else {
  for (const line of log) console.log(`  - ${line}`);
}

if (legacy) restoreLegacy(legacy);

sqlite.close();
console.log("完了");

/** 退避した旧データを新スキーマへ戻す */
function restoreLegacy(snapshot: LegacySnapshot) {
  if (snapshot.customers.length === 0) {
    console.log("移行対象の顧客はありませんでした");
    return;
  }

  console.log(`旧データを移行します（顧客 ${snapshot.customers.length} 件）`);
  const warnings: string[] = [];

  // 基準住所・税率などの設定は引き継ぐ
  const oldSettings = snapshot.settings[0];
  if (oldSettings) {
    db.update(schema.settings)
      .set({
        baseAddress: String(oldSettings.base_address ?? ""),
        baseLat: (oldSettings.base_lat as number) ?? null,
        baseLng: (oldSettings.base_lng as number) ?? null,
        googleMapsApiKey: (oldSettings.google_maps_api_key as string) ?? null,
        taxRate: (oldSettings.tax_rate as number) ?? 0.1,
        distanceMode: (oldSettings.distance_mode as "auto") ?? "auto",
      })
      .run();
  }

  const categories = sqlite
    .prepare("select id, name, calculation_method, capacity_unit from equipment_categories")
    .all() as { id: number; name: string }[];
  const categoryCycles = sqlite
    .prepare("select id, category_id, name, interval_months from category_cycles")
    .all() as CategoryCycleRow[];
  const inspectionCycles = db.select().from(schema.inspectionCycles).all();
  const billingCycles = db.select().from(schema.billingCycles).all();

  const oldFacilityTypeById = new Map(
    snapshot.facilityTypes.map((f) => [Number(f.id), String(f.name)]),
  );
  const oldCycleById = new Map(
    snapshot.inspectionCycles.map((c) => [
      Number(c.id),
      { name: String(c.name), interval: Number(c.interval_months) },
    ]),
  );
  const oldBillingCycleById = new Map(
    snapshot.billingCycles.map((c) => [Number(c.id), String(c.name)]),
  );

  // 旧 ID → 新 ID の対応。実績を戻すときに使う
  const customerIdMap = new Map<number, number>();

  for (const old of snapshot.customers) {
    const oldId = Number(old.id);
    const oldCycle = oldCycleById.get(Number(old.inspection_cycle_id));

    const visitCycle =
      inspectionCycles.find((c) => c.name === oldCycle?.name) ??
      inspectionCycles.find((c) => c.intervalMonths === (oldCycle?.interval ?? 1)) ??
      inspectionCycles[0];

    const billingCycleName = oldBillingCycleById.get(Number(old.billing_cycle_id));
    const billingCycle =
      billingCycles.find((b) => b.name === billingCycleName) ?? billingCycles[0];

    const inserted = db
      .insert(schema.customers)
      .values({
        code: String(old.code),
        name: String(old.name),
        inspectionCycleId: visitCycle.id,
        monthlyFee: Number(old.monthly_fee ?? 0),
        annualFeeHandling:
          old.annual_fee_handling === "separate" ? "separate" : "included",
        annualInspectionFee: (old.annual_inspection_fee as number) ?? null,
        unitPriceOverride: (old.unit_price_override as number) ?? null,
        address: String(old.address ?? ""),
        lat: (old.lat as number) ?? null,
        lng: (old.lng as number) ?? null,
        distanceKm: (old.distance_km as number) ?? null,
        durationMin: (old.duration_min as number) ?? null,
        distanceMethod: (old.distance_method as "road" | "straight") ?? null,
        distanceUpdatedAt: (old.distance_updated_at as string) ?? null,
        phone: String(old.phone ?? ""),
        email: String(old.email ?? ""),
        contactPerson: String(old.contact_person ?? ""),
        contractStartDate: String(old.contract_start_date),
        contractEndDate: (old.contract_end_date as string) ?? null,
        annualInspectionMonth: (old.annual_inspection_month as number) ?? null,
        annualInspectionDay: (old.annual_inspection_day as number) ?? null,
        billingCycleId: billingCycle?.id ?? null,
        paymentLagMonths: Number(old.payment_lag_months ?? 1),
        isActive: Number(old.is_active ?? 1),
        note: String(old.note ?? ""),
      })
      .returning()
      .get();

    customerIdMap.set(oldId, inserted.id);

    // 旧「施設種別＋容量」を新しい設備区分に振り分ける
    const facilityTypeName =
      oldFacilityTypeById.get(Number(old.facility_type_id)) ?? "需要設備";
    const mapped = mapLegacyFacility(
      facilityTypeName,
      (old.capacity_kva as number) ?? null,
      (old.capacity_kw as number) ?? null,
    );

    mapped.forEach((m, index) => {
      const category = categories.find((c) => c.name === m.category);
      if (!category) {
        warnings.push(`${old.code}: 設備区分「${m.category}」が見つかりませんでした`);
        return;
      }
      const cycles = categoryCycles.filter((c) => c.category_id === category.id);
      const cycle = pickCategoryCycle(cycles, oldCycle?.interval ?? null);
      if (!cycle) {
        warnings.push(`${old.code}: 「${m.category}」に周期が登録されていません`);
        return;
      }

      if (cycle.interval_months !== (oldCycle?.interval ?? cycle.interval_months)) {
        warnings.push(
          `${old.code}: 旧周期「${oldCycle?.name}」に一致する周期がないため「${cycle.name}」を割り当てました`,
        );
      }
      if (m.warning) warnings.push(`${old.code}: ${m.warning}`);

      db.insert(schema.customerFacilities)
        .values({
          customerId: inserted.id,
          categoryId: category.id,
          categoryCycleId: cycle.id,
          capacity: m.capacity,
          coefficientOverride: (old.coefficient_override as number) ?? null,
          note: "",
          sortOrder: index,
        })
        .run();
    });
  }

  // 点検月・実績・請求実績を戻す
  const remap = (row: Record<string, unknown>) =>
    customerIdMap.get(Number(row.customer_id));

  for (const m of snapshot.customerInspectionMonths) {
    const customerId = remap(m);
    if (!customerId) continue;
    db.insert(schema.customerInspectionMonths)
      .values({ customerId, month: Number(m.month) })
      .run();
  }

  for (const r of snapshot.inspectionRecords) {
    const customerId = remap(r);
    if (!customerId) continue;
    db.insert(schema.inspectionRecords)
      .values({
        customerId,
        year: Number(r.year),
        month: Number(r.month),
        type: r.type === "annual" ? "annual" : "regular",
        isDone: Number(r.is_done ?? 0),
        doneDate: (r.done_date as string) ?? null,
        note: (r.note as string) ?? null,
      })
      .run();
  }

  for (const r of snapshot.billingRecords) {
    const customerId = remap(r);
    if (!customerId) continue;
    db.insert(schema.billingRecords)
      .values({
        customerId,
        year: Number(r.year),
        month: Number(r.month),
        billingAmount: Number(r.billing_amount ?? 0),
        isBilled: Number(r.is_billed ?? 0),
        billedDate: (r.billed_date as string) ?? null,
        isPaid: Number(r.is_paid ?? 0),
        paidDate: (r.paid_date as string) ?? null,
        expectedPaymentYear: Number(r.expected_payment_year),
        expectedPaymentMonth: Number(r.expected_payment_month),
        note: (r.note as string) ?? null,
      })
      .run();
  }

  console.log(
    `  顧客 ${customerIdMap.size} 件、点検実績 ${snapshot.inspectionRecords.length} 件、請求実績 ${snapshot.billingRecords.length} 件を移行しました`,
  );

  if (warnings.length > 0) {
    console.log("\n  要確認（設備区分の割り当てを見直してください）:");
    for (const w of [...new Set(warnings)]) console.log(`    - ${w}`);
  }
}
