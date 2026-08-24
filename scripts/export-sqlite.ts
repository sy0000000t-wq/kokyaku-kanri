/**
 * SQLite 版（v0.2）のデータを、ドライブ方式で読み込める JSON に書き出す。
 * 移行のときに一度だけ使う。
 *
 *   npm run export:sqlite
 *   → data/移行用データ.json
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = path.join(process.cwd(), "data", "app.db");
if (!fs.existsSync(dbPath)) {
  console.error(`データベースが見つかりません: ${dbPath}`);
  process.exit(1);
}

const sqlite = new Database(dbPath, { readonly: true });

const all = (table: string): Record<string, unknown>[] => {
  const exists = sqlite
    .prepare("select name from sqlite_master where type='table' and name=?")
    .get(table);
  return exists ? (sqlite.prepare(`select * from ${table}`).all() as never) : [];
};

/** snake_case の列名を、文書の camelCase に直す */
const camel = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ]),
  );

const list = (table: string) => all(table).map(camel);

const settings = list("settings")[0] ?? {};
delete (settings as Record<string, unknown>).id;

const doc = {
  version: 2,
  savedAt: new Date().toISOString(),
  settings,
  coefficientTables: list("coefficient_tables"),
  coefficientRows: list("coefficient_rows"),
  equipmentCategories: list("equipment_categories"),
  categoryCycles: list("category_cycles"),
  inspectionCycles: list("inspection_cycles"),
  billingCycles: list("billing_cycles"),
  customers: list("customers"),
  customerFacilities: list("customer_facilities"),
  customerInspectionMonths: list("customer_inspection_months"),
  inspectionRecords: list("inspection_records"),
  billingRecords: list("billing_records"),
};

sqlite.close();

const out = path.join(process.cwd(), "data", "移行用データ.json");
fs.writeFileSync(out, JSON.stringify(doc, null, 2), "utf8");

console.log(`書き出しました: ${out}`);
console.log(
  `  顧客 ${doc.customers.length} 件 / 設備 ${doc.customerFacilities.length} 件 / ` +
    `点検実績 ${doc.inspectionRecords.length} 件 / 請求実績 ${doc.billingRecords.length} 件`,
);
console.log("\n設定 → データ管理 → JSON インポート から取り込んでください。");
