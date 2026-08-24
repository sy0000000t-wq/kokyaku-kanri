import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

/**
 * 「換算値算出フロー図」を反映する前のスキーマ（v0.1）から移行する。
 *
 * v0.1 では 1顧客＝1施設種別＋1周期で、倍率は点検周期マスタが一律に持っていた。
 * 新スキーマでは設備を子テーブルに分け、倍率は「設備区分 × 周期」で決まる。
 * 旧テーブルは構造が違いすぎて ALTER では追随できないため、
 * 中身を JSON に退避してからスキーマを作り直し、顧客と実績だけを戻す。
 */

export type LegacySnapshot = {
  takenAt: string;
  settings: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  facilityTypes: Record<string, unknown>[];
  inspectionCycles: Record<string, unknown>[];
  customerInspectionMonths: Record<string, unknown>[];
  inspectionRecords: Record<string, unknown>[];
  billingRecords: Record<string, unknown>[];
  billingCycles: Record<string, unknown>[];
};

const LEGACY_TABLES = [
  "billing_records",
  "inspection_records",
  "customer_inspection_months",
  "customers",
  "facility_types",
  "inspection_cycles",
  "billing_cycles",
  "coefficient_rows",
  "coefficient_tables",
  "settings",
];

function tableExists(sqlite: Database.Database, name: string): boolean {
  return !!sqlite
    .prepare("select name from sqlite_master where type='table' and name=?")
    .get(name);
}

function columnExists(
  sqlite: Database.Database,
  table: string,
  column: string,
): boolean {
  if (!tableExists(sqlite, table)) return false;
  const cols = sqlite.prepare(`pragma table_info(${table})`).all() as {
    name: string;
  }[];
  return cols.some((c) => c.name === column);
}

/** 旧スキーマかどうか。facility_types があれば v0.1 */
export function isLegacySchema(sqlite: Database.Database): boolean {
  return tableExists(sqlite, "facility_types");
}

const all = (sqlite: Database.Database, table: string) =>
  tableExists(sqlite, table)
    ? (sqlite.prepare(`select * from ${table}`).all() as Record<string, unknown>[])
    : [];

/** 旧データを JSON に退避し、旧テーブルを落とす */
export function snapshotAndDropLegacy(
  sqlite: Database.Database,
  dataDir: string,
): { snapshot: LegacySnapshot; file: string } {
  const snapshot: LegacySnapshot = {
    takenAt: new Date().toISOString(),
    settings: all(sqlite, "settings"),
    customers: all(sqlite, "customers"),
    facilityTypes: all(sqlite, "facility_types"),
    inspectionCycles: all(sqlite, "inspection_cycles"),
    customerInspectionMonths: all(sqlite, "customer_inspection_months"),
    inspectionRecords: all(sqlite, "inspection_records"),
    billingRecords: all(sqlite, "billing_records"),
    billingCycles: all(sqlite, "billing_cycles"),
  };

  const dir = path.join(dataDir, "backup");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `pre-flowchart-${snapshot.takenAt.replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");

  sqlite.pragma("foreign_keys = OFF");
  const drop = sqlite.transaction(() => {
    for (const table of LEGACY_TABLES) {
      sqlite.prepare(`drop table if exists ${table}`).run();
    }
    sqlite.prepare("drop table if exists __drizzle_migrations").run();
  });
  drop();
  sqlite.pragma("foreign_keys = ON");

  return { snapshot, file };
}

export type CategoryRow = {
  id: number;
  name: string;
  calculation_method: string;
  capacity_unit: string;
};
export type CategoryCycleRow = {
  id: number;
  category_id: number;
  name: string;
  interval_months: number;
};

/**
 * 旧「施設種別＋容量」を新しい設備区分に振り分ける。
 * 判定できない組み合わせは呼び出し側に警告を返す。
 */
export function mapLegacyFacility(
  facilityTypeName: string,
  capacityKva: number | null,
  capacityKw: number | null,
): { category: string; capacity: number | null; warning?: string }[] {
  const demand = (kva: number | null) => {
    if (kva == null) {
      return {
        category: "需要設備（高圧・100kVA超過）",
        capacity: null,
        warning: "容量が未設定のため 100kVA超過 として移行しました",
      };
    }
    if (kva < 64) {
      return {
        category: "需要設備（高圧・64kVA未満・非常用予備発電設備あり）",
        capacity: kva,
        warning:
          "64kVA未満は「小規模高圧設備」と「非常用予備発電設備あり」で点数が違います。設備区分を確認してください",
      };
    }
    if (kva <= 100) {
      return { category: "需要設備（高圧・64kVA以上100kVA以下）", capacity: kva };
    }
    return { category: "需要設備（高圧・100kVA超過）", capacity: kva };
  };

  const solar = (kw: number | null) => ({
    category: "太陽電池発電所（全量売電）",
    capacity: kw,
    warning:
      "太陽光は全量売電として移行しました。自家消費の場合は設備区分を変更してください",
  });

  switch (facilityTypeName) {
    case "需要設備":
      return [demand(capacityKva)];
    case "需要設備＋太陽光":
      return [demand(capacityKva), solar(capacityKw)];
    case "太陽光":
      return [solar(capacityKw)];
    case "蓄電所":
      return [{ category: "蓄電所", capacity: capacityKw }];
    default:
      return [
        {
          ...demand(capacityKva),
          warning: `施設種別「${facilityTypeName}」に対応する設備区分がないため需要設備として移行しました`,
        },
      ];
  }
}

/** 旧周期（間隔月）に一番近い、その区分の周期を選ぶ */
export function pickCategoryCycle(
  cycles: CategoryCycleRow[],
  intervalMonths: number | null,
): CategoryCycleRow | null {
  if (cycles.length === 0) return null;
  if (intervalMonths == null) return cycles[0];
  const exact = cycles.find((c) => c.interval_months === intervalMonths);
  if (exact) return exact;
  return [...cycles].sort(
    (a, b) =>
      Math.abs(a.interval_months - intervalMonths) -
      Math.abs(b.interval_months - intervalMonths),
  )[0];
}

export { columnExists };
