import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/** §3.2 基準住所・税率・API キーなどのシングルトン設定（id は常に 1） */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  baseAddress: text("base_address").notNull().default(""),
  baseLat: real("base_lat"),
  baseLng: real("base_lng"),
  googleMapsApiKey: text("google_maps_api_key"),
  taxRate: real("tax_rate").notNull().default(0.1),
  distanceMode: text("distance_mode", { enum: ["auto", "road", "straight"] })
    .notNull()
    .default("auto"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** §3.5 換算係数テーブル */
export const coefficientTables = sqliteTable("coefficient_tables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  unit: text("unit", { enum: ["kVA", "kW"] }).notNull(),
  note: text("note").notNull().default(""),
});

/** §3.5 換算係数テーブルの行（min 以上 max 未満） */
export const coefficientRows = sqliteTable("coefficient_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableId: integer("table_id")
    .notNull()
    .references(() => coefficientTables.id, { onDelete: "cascade" }),
  minCapacity: real("min_capacity").notNull(),
  /** NULL は上限なし */
  maxCapacity: real("max_capacity"),
  coefficient: real("coefficient").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** §3.3 施設種別マスタ */
export const facilityTypes = sqliteTable("facility_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  capacityUnit: text("capacity_unit", { enum: ["kVA", "kW"] }).notNull(),
  coefficientTableId: integer("coefficient_table_id").references(
    () => coefficientTables.id,
  ),
  /** 「需要設備＋太陽光」のように kW 側の係数も合算する種別で使う */
  secondaryCoefficientTableId: integer("secondary_coefficient_table_id").references(
    () => coefficientTables.id,
  ),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
});

/** §3.4 点検周期マスタ */
export const inspectionCycles = sqliteTable("inspection_cycles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  /** 0 は「実施なし」 */
  intervalMonths: integer("interval_months").notNull(),
  coefficientMultiplier: real("coefficient_multiplier").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
});

/** §3.9 請求サイクルマスタ（点検周期とは別に持つ） */
export const billingCycles = sqliteTable("billing_cycles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  intervalMonths: integer("interval_months").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
});

/** §3.6 顧客（物件）マスタ */
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  facilityTypeId: integer("facility_type_id")
    .notNull()
    .references(() => facilityTypes.id),
  capacityKva: real("capacity_kva"),
  capacityKw: real("capacity_kw"),
  inspectionCycleId: integer("inspection_cycle_id")
    .notNull()
    .references(() => inspectionCycles.id),
  coefficientOverride: real("coefficient_override"),
  monthlyFee: integer("monthly_fee").notNull().default(0),
  annualFeeHandling: text("annual_fee_handling", {
    enum: ["included", "separate"],
  })
    .notNull()
    .default("included"),
  annualInspectionFee: integer("annual_inspection_fee"),
  unitPriceOverride: integer("unit_price_override"),
  address: text("address").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
  distanceKm: real("distance_km"),
  durationMin: integer("duration_min"),
  distanceMethod: text("distance_method", { enum: ["road", "straight"] }),
  distanceUpdatedAt: text("distance_updated_at"),
  /** 複数の電話番号はカンマ区切りで保持する */
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  contactPerson: text("contact_person").notNull().default(""),
  contractStartDate: text("contract_start_date").notNull(),
  contractEndDate: text("contract_end_date"),
  annualInspectionMonth: integer("annual_inspection_month"),
  annualInspectionDay: integer("annual_inspection_day"),
  billingCycleId: integer("billing_cycle_id").references(() => billingCycles.id),
  paymentLagMonths: integer("payment_lag_months").notNull().default(1),
  isActive: integer("is_active").notNull().default(1),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** §3.7 通常点検の実施月（最終的な正はこのテーブル） */
export const customerInspectionMonths = sqliteTable(
  "customer_inspection_months",
  {
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.month] })],
);

/** §3.8 点検実績 */
export const inspectionRecords = sqliteTable(
  "inspection_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    type: text("type", { enum: ["regular", "annual"] }).notNull(),
    isDone: integer("is_done").notNull().default(0),
    doneDate: text("done_date"),
    note: text("note"),
  },
  (t) => [unique().on(t.customerId, t.year, t.month, t.type)],
);

/** §3.9 請求・入金実績 */
export const billingRecords = sqliteTable(
  "billing_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    /** 税込 */
    billingAmount: integer("billing_amount").notNull().default(0),
    isBilled: integer("is_billed").notNull().default(0),
    billedDate: text("billed_date"),
    isPaid: integer("is_paid").notNull().default(0),
    paidDate: text("paid_date"),
    expectedPaymentYear: integer("expected_payment_year").notNull(),
    expectedPaymentMonth: integer("expected_payment_month").notNull(),
    note: text("note"),
  },
  (t) => [unique().on(t.customerId, t.year, t.month)],
);

export type Settings = typeof settings.$inferSelect;
export type FacilityType = typeof facilityTypes.$inferSelect;
export type InspectionCycle = typeof inspectionCycles.$inferSelect;
export type BillingCycle = typeof billingCycles.$inferSelect;
export type CoefficientTable = typeof coefficientTables.$inferSelect;
export type CoefficientRow = typeof coefficientRows.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type InspectionRecord = typeof inspectionRecords.$inferSelect;
export type BillingRecord = typeof billingRecords.$inferSelect;
