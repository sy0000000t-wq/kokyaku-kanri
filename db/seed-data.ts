/**
 * §7 初期データ（シード）。
 * §10-2 のとおり、マスタの初期値を書いてよいのはこのファイルだけ。
 * アプリ本体は必ず DB から読み込むこと。
 */

export const COEFFICIENT_TABLE_DEMAND = "需要設備（kVA）";
export const COEFFICIENT_TABLE_SOLAR = "太陽光・蓄電所（kW）";

const SOURCE_NOTE =
  "電気事業法施行規則第52条の2に基づく経済産業省告示第249号";

export type SeedCoefficientRow = {
  minCapacity: number;
  maxCapacity: number | null;
  coefficient: number;
};

/** §3.5 初期データ ①：需要設備（kVA） */
export const demandCoefficientRows: SeedCoefficientRow[] = [
  { minCapacity: 0, maxCapacity: 14, coefficient: 0.3 },
  { minCapacity: 14, maxCapacity: 64, coefficient: 0.4 },
  { minCapacity: 64, maxCapacity: 150, coefficient: 0.6 },
  { minCapacity: 150, maxCapacity: 350, coefficient: 0.8 },
  { minCapacity: 350, maxCapacity: 550, coefficient: 1.0 },
  { minCapacity: 550, maxCapacity: 750, coefficient: 1.2 },
  { minCapacity: 750, maxCapacity: 1000, coefficient: 1.4 },
  { minCapacity: 1000, maxCapacity: 1300, coefficient: 1.6 },
  { minCapacity: 1300, maxCapacity: 1650, coefficient: 1.8 },
  { minCapacity: 1650, maxCapacity: 2000, coefficient: 2.0 },
  { minCapacity: 2000, maxCapacity: 2700, coefficient: 2.2 },
  { minCapacity: 2700, maxCapacity: 4000, coefficient: 2.4 },
  { minCapacity: 4000, maxCapacity: 6000, coefficient: 2.6 },
  { minCapacity: 6000, maxCapacity: 8830, coefficient: 2.8 },
  { minCapacity: 8830, maxCapacity: null, coefficient: 3.0 },
];

/**
 * §3.5 初期データ ②：太陽光発電所・蓄電所（出力 kW）
 * 5000kW 以上の行は告示に定めがないため未収録。必要になったら設定画面から追加する。
 */
export const solarCoefficientRows: SeedCoefficientRow[] = [
  { minCapacity: 0, maxCapacity: 100, coefficient: 0.3 },
  { minCapacity: 100, maxCapacity: 300, coefficient: 0.4 },
  { minCapacity: 300, maxCapacity: 600, coefficient: 0.6 },
  { minCapacity: 600, maxCapacity: 1000, coefficient: 0.8 },
  { minCapacity: 1000, maxCapacity: 1500, coefficient: 1.0 },
  { minCapacity: 1500, maxCapacity: 2000, coefficient: 1.2 },
  { minCapacity: 2000, maxCapacity: 2500, coefficient: 1.4 },
  { minCapacity: 2500, maxCapacity: 3500, coefficient: 1.6 },
  { minCapacity: 3500, maxCapacity: 5000, coefficient: 1.8 },
];

export const seedCoefficientTables = [
  {
    name: COEFFICIENT_TABLE_DEMAND,
    unit: "kVA" as const,
    note: SOURCE_NOTE,
    rows: demandCoefficientRows,
  },
  {
    name: COEFFICIENT_TABLE_SOLAR,
    unit: "kW" as const,
    note: SOURCE_NOTE,
    rows: solarCoefficientRows,
  },
];

/** §3.3 施設種別マスタ */
export const seedFacilityTypes = [
  {
    name: "需要設備",
    capacityUnit: "kVA" as const,
    table: COEFFICIENT_TABLE_DEMAND,
    secondaryTable: null,
  },
  {
    name: "需要設備＋太陽光",
    capacityUnit: "kVA" as const,
    table: COEFFICIENT_TABLE_DEMAND,
    // kVA 側と kW 側でそれぞれ係数を求めて合算する（§3.3 注記）
    secondaryTable: COEFFICIENT_TABLE_SOLAR,
  },
  {
    name: "太陽光",
    capacityUnit: "kW" as const,
    table: COEFFICIENT_TABLE_SOLAR,
    secondaryTable: null,
  },
  {
    name: "蓄電所",
    capacityUnit: "kW" as const,
    table: COEFFICIENT_TABLE_SOLAR,
    secondaryTable: null,
  },
];

/** §3.4 点検周期マスタ */
export const seedInspectionCycles = [
  { name: "毎月点検", intervalMonths: 1, coefficientMultiplier: 1.0 },
  { name: "隔月点検", intervalMonths: 2, coefficientMultiplier: 0.6 },
  { name: "3ヶ月点検", intervalMonths: 3, coefficientMultiplier: 0.4 },
  { name: "6ヶ月点検", intervalMonths: 6, coefficientMultiplier: 0.25 },
  { name: "年1回点検", intervalMonths: 12, coefficientMultiplier: 0.125 },
];

/** §3.9 / §7 請求サイクルマスタ */
export const seedBillingCycles = [
  { name: "毎月", intervalMonths: 1 },
  { name: "隔月", intervalMonths: 2 },
  { name: "3ヶ月", intervalMonths: 3 },
  { name: "6ヶ月", intervalMonths: 6 },
  { name: "年1回", intervalMonths: 12 },
];
