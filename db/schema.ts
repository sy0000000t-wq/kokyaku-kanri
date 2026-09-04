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

/**
 * 設備区分マスタ。換算値算出フロー図の分岐そのものを表す。
 * `table` は容量から係数表を引き、`fixed` は容量によらず固定点数を使う。
 */
export const equipmentCategories = sqliteTable("equipment_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  /** 需要設備 / 発電所等 / その他。画面のグループ見出しに使う */
  categoryGroup: text("category_group", {
    enum: ["demand", "generation", "other"],
  })
    .notNull()
    .default("demand"),
  /** none は容量入力が不要な区分（配電線路のみ など） */
  capacityUnit: text("capacity_unit", { enum: ["kVA", "kW", "none"] })
    .notNull()
    .default("kVA"),
  calculationMethod: text("calculation_method", { enum: ["table", "fixed", "excluded"] })
    .notNull()
    .default("table"),
  /** calculation_method = table のときに引く係数表 */
  coefficientTableId: integer("coefficient_table_id").references(
    () => coefficientTables.id,
  ),
  /** 適用できる容量の目安。入力時の警告にのみ使う */
  minCapacity: real("min_capacity"),
  maxCapacity: real("max_capacity"),
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
});

/**
 * 設備区分ごとに選べる点検周期と、その周期での補正。
 * table 方式は multiplier（係数に掛ける）、fixed 方式は fixedPoints（そのまま点数）。
 */
export const categoryCycles = sqliteTable("category_cycles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => equipmentCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  intervalMonths: integer("interval_months").notNull(),
  multiplier: real("multiplier"),
  fixedPoints: real("fixed_points"),
  /** フロー図の「条件適用」「※固定」などの注記 */
  conditionNote: text("condition_note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * 点検周期マスタ＝現場を訪問する周期。点検月の生成にだけ使う。
 * 換算係数の補正倍率はここではなく category_cycles が持つ
 * （倍率は「設備区分 × 周期」で決まるため。換算値算出フロー図による）。
 */
export const inspectionCycles = sqliteTable("inspection_cycles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  /** 0 は「実施なし」 */
  intervalMonths: integer("interval_months").notNull(),
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
  /** 現場を訪問する周期（点検月の生成に使う）。点数計算には使わない */
  inspectionCycleId: integer("inspection_cycle_id")
    .notNull()
    .references(() => inspectionCycles.id),
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

/**
 * 事業場に設置されている設備。1事業場に複数あり、それぞれ別の点検周期を持つ。
 * 保安管理点数はこの行ごとに算出して合算する（換算値算出フロー図 参考例1・2）。
 */
export const customerFacilities = sqliteTable("customer_facilities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => equipmentCategories.id),
  /** 区分に紐づく周期のどれを適用するか */
  categoryCycleId: integer("category_cycle_id")
    .notNull()
    .references(() => categoryCycles.id),
  /** 設備容量。capacity_unit = none の区分では NULL */
  capacity: real("capacity"),
  /** 換算係数（基準値）の手動指定。設定すると容量からの自動判定より優先する */
  coefficientOverride: real("coefficient_override"),
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
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
export type EquipmentCategory = typeof equipmentCategories.$inferSelect;
export type CategoryCycle = typeof categoryCycles.$inferSelect;
export type CustomerFacility = typeof customerFacilities.$inferSelect;
export type InspectionCycle = typeof inspectionCycles.$inferSelect;
export type BillingCycle = typeof billingCycles.$inferSelect;
export type CoefficientTable = typeof coefficientTables.$inferSelect;
export type CoefficientRow = typeof coefficientRows.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type InspectionRecord = typeof inspectionRecords.$inferSelect;
export type BillingRecord = typeof billingRecords.$inferSelect;
