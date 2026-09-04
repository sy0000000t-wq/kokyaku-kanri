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

/**
 * 設備区分マスタ。出典は「換算値算出フロー図（2025-01-09）」。
 * multiplier は table 方式（係数表 × 倍率）、fixedPoints は fixed 方式（容量によらず固定）。
 */
export type SeedCategoryCycle = {
  name: string;
  intervalMonths: number;
  multiplier?: number;
  fixedPoints?: number;
  conditionNote?: string;
};

export type SeedEquipmentCategory = {
  name: string;
  categoryGroup: "demand" | "generation" | "other";
  capacityUnit: "kVA" | "kW" | "none";
  calculationMethod: "table" | "fixed" | "excluded";
  table?: string | null;
  minCapacity?: number | null;
  maxCapacity?: number | null;
  note?: string;
  cycles: SeedCategoryCycle[];
};

export const seedEquipmentCategories: SeedEquipmentCategory[] = [
  {
    name: "需要設備（低圧）",
    categoryGroup: "demand",
    capacityUnit: "none",
    calculationMethod: "fixed",
    cycles: [
      { name: "月1回", intervalMonths: 1, fixedPoints: 0.3 },
      { name: "2ヶ月に1回", intervalMonths: 2, fixedPoints: 0.18 },
    ],
  },
  {
    name: "需要設備（高圧・64kVA未満・小規模高圧設備）",
    categoryGroup: "demand",
    capacityUnit: "kVA",
    calculationMethod: "fixed",
    maxCapacity: 64,
    note: "フロー図では ※固定。絶縁監視装置の設置が必須",
    cycles: [
      {
        name: "3ヶ月に1回",
        intervalMonths: 3,
        fixedPoints: 0.2,
        conditionNote: "※固定",
      },
    ],
  },
  {
    name: "需要設備（高圧・64kVA未満・非常用予備発電設備あり）",
    categoryGroup: "demand",
    capacityUnit: "kVA",
    calculationMethod: "fixed",
    maxCapacity: 64,
    cycles: [
      { name: "月1回", intervalMonths: 1, fixedPoints: 0.4 },
      { name: "2ヶ月に1回", intervalMonths: 2, fixedPoints: 0.24 },
    ],
  },
  {
    name: "需要設備（高圧・64kVA以上100kVA以下）",
    categoryGroup: "demand",
    capacityUnit: "kVA",
    calculationMethod: "fixed",
    minCapacity: 64,
    maxCapacity: 100,
    cycles: [
      { name: "月1回", intervalMonths: 1, fixedPoints: 0.6 },
      {
        name: "2ヶ月に1回",
        intervalMonths: 2,
        fixedPoints: 0.36,
        conditionNote: "条件適用",
      },
      {
        name: "3ヶ月に1回",
        intervalMonths: 3,
        fixedPoints: 0.27,
        conditionNote: "条件適用",
      },
    ],
  },
  {
    name: "需要設備（高圧・100kVA超過）",
    categoryGroup: "demand",
    capacityUnit: "kVA",
    calculationMethod: "table",
    table: COEFFICIENT_TABLE_DEMAND,
    minCapacity: 100,
    cycles: [
      { name: "月1回", intervalMonths: 1, multiplier: 1.0 },
      {
        name: "2ヶ月に1回",
        intervalMonths: 2,
        multiplier: 0.6,
        conditionNote: "条件適用",
      },
    ],
  },
  {
    name: "EV専用充電設備（1000kVA未満）",
    categoryGroup: "demand",
    capacityUnit: "kVA",
    calculationMethod: "fixed",
    maxCapacity: 1000,
    cycles: [
      { name: "月1回", intervalMonths: 1, fixedPoints: 0.4 },
      {
        name: "2ヶ月に1回",
        intervalMonths: 2,
        fixedPoints: 0.24,
        conditionNote: "条件適用",
      },
    ],
  },
  {
    name: "火力発電所（ディーゼル・ガスタービン等）",
    categoryGroup: "generation",
    capacityUnit: "kW",
    calculationMethod: "table",
    table: COEFFICIENT_TABLE_SOLAR,
    cycles: [
      { name: "月1回", intervalMonths: 1, multiplier: 1.0 },
      {
        name: "3ヶ月に1回",
        intervalMonths: 3,
        multiplier: 0.45,
        conditionNote: "条件適用",
      },
    ],
  },
  {
    name: "太陽電池発電所（自家消費）",
    categoryGroup: "generation",
    capacityUnit: "kW",
    calculationMethod: "table",
    table: COEFFICIENT_TABLE_SOLAR,
    cycles: [{ name: "6ヶ月に1回", intervalMonths: 6, multiplier: 0.25 }],
  },
  {
    name: "太陽電池発電所（全量売電）",
    categoryGroup: "generation",
    capacityUnit: "kW",
    calculationMethod: "table",
    table: COEFFICIENT_TABLE_SOLAR,
    cycles: [
      { name: "2ヶ月に1回", intervalMonths: 2, multiplier: 0.36 },
      { name: "3ヶ月に1回", intervalMonths: 3, multiplier: 0.33 },
      { name: "4ヶ月に1回", intervalMonths: 4, multiplier: 0.32 },
      { name: "6ヶ月に1回", intervalMonths: 6, multiplier: 0.31 },
    ],
  },
  {
    name: "蓄電所",
    categoryGroup: "generation",
    capacityUnit: "kW",
    calculationMethod: "table",
    table: COEFFICIENT_TABLE_SOLAR,
    note: "換算値算出フロー図に分岐の記載がないため、月1回のみを用意している",
    cycles: [{ name: "月1回", intervalMonths: 1, multiplier: 1.0 }],
  },
  {
    name: "配電線路のみ",
    categoryGroup: "other",
    capacityUnit: "none",
    calculationMethod: "fixed",
    cycles: [
      { name: "（周期によらず固定）", intervalMonths: 1, fixedPoints: 0.1 },
    ],
  },
  {
    // 年次点検だけを請ける仕事。保安管理業務ではないので換算係数を当てない
    name: "年次請け",
    categoryGroup: "other",
    capacityUnit: "none",
    calculationMethod: "excluded",
    note: "年次点検だけを請ける契約。換算係数を適用せず、保安管理点数にも算入しません",
    cycles: [{ name: "年1回", intervalMonths: 12 }],
  },
];

/**
 * 点検周期マスタ＝現場を訪問する周期。点検月の生成にだけ使う。
 * 換算係数の補正は設備区分ごとに持つ（seedEquipmentCategories を参照）。
 */
export const seedInspectionCycles = [
  { name: "毎月点検", intervalMonths: 1 },
  { name: "隔月点検", intervalMonths: 2 },
  { name: "3ヶ月点検", intervalMonths: 3 },
  { name: "4ヶ月点検", intervalMonths: 4 },
  { name: "6ヶ月点検", intervalMonths: 6 },
  { name: "年1回点検", intervalMonths: 12 },
  // 通常点検がなく、年次点検だけを行う契約
  { name: "年次点検のみ", intervalMonths: 0 },
];

/** §3.9 / §7 請求サイクルマスタ */
export const seedBillingCycles = [
  { name: "毎月", intervalMonths: 1 },
  { name: "隔月", intervalMonths: 2 },
  { name: "3ヶ月", intervalMonths: 3 },
  { name: "6ヶ月", intervalMonths: 6 },
  { name: "年1回", intervalMonths: 12 },
];
