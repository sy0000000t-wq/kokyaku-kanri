import "server-only";
import { db, sqlite } from "@/db";
import * as schema from "@/db/schema";

export const EXPORT_VERSION = 1;

export type ExportPayload = {
  version: number;
  exportedAt: string;
  settings: (typeof schema.settings.$inferSelect)[];
  coefficientTables: (typeof schema.coefficientTables.$inferSelect)[];
  coefficientRows: (typeof schema.coefficientRows.$inferSelect)[];
  facilityTypes: (typeof schema.facilityTypes.$inferSelect)[];
  inspectionCycles: (typeof schema.inspectionCycles.$inferSelect)[];
  billingCycles: (typeof schema.billingCycles.$inferSelect)[];
  customers: (typeof schema.customers.$inferSelect)[];
  customerInspectionMonths: (typeof schema.customerInspectionMonths.$inferSelect)[];
  inspectionRecords: (typeof schema.inspectionRecords.$inferSelect)[];
  billingRecords: (typeof schema.billingRecords.$inferSelect)[];
};

/** §2.3 JSON 一括エクスポート */
export function exportAll(): ExportPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: db.select().from(schema.settings).all(),
    coefficientTables: db.select().from(schema.coefficientTables).all(),
    coefficientRows: db.select().from(schema.coefficientRows).all(),
    facilityTypes: db.select().from(schema.facilityTypes).all(),
    inspectionCycles: db.select().from(schema.inspectionCycles).all(),
    billingCycles: db.select().from(schema.billingCycles).all(),
    customers: db.select().from(schema.customers).all(),
    customerInspectionMonths: db.select().from(schema.customerInspectionMonths).all(),
    inspectionRecords: db.select().from(schema.inspectionRecords).all(),
    billingRecords: db.select().from(schema.billingRecords).all(),
  };
}

function isPayload(value: unknown): value is ExportPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.customers) && Array.isArray(v.settings);
}

/**
 * §2.3 JSON 一括インポート。
 * 既存データを全置換するため、必ずトランザクションで実行する。
 */
export function importAll(raw: unknown) {
  if (!isPayload(raw)) {
    return { ok: false as const, message: "エクスポートされた JSON の形式ではありません" };
  }
  const payload = raw;

  const run = sqlite.transaction(() => {
    // 参照の逆順に削除する
    db.delete(schema.billingRecords).run();
    db.delete(schema.inspectionRecords).run();
    db.delete(schema.customerInspectionMonths).run();
    db.delete(schema.customers).run();
    db.delete(schema.facilityTypes).run();
    db.delete(schema.inspectionCycles).run();
    db.delete(schema.billingCycles).run();
    db.delete(schema.coefficientRows).run();
    db.delete(schema.coefficientTables).run();
    db.delete(schema.settings).run();

    const insert = <T>(table: never, rows: T[]) => {
      if (rows.length > 0) db.insert(table).values(rows as never).run();
    };

    insert(schema.settings as never, payload.settings);
    insert(schema.coefficientTables as never, payload.coefficientTables);
    insert(schema.coefficientRows as never, payload.coefficientRows);
    insert(schema.facilityTypes as never, payload.facilityTypes);
    insert(schema.inspectionCycles as never, payload.inspectionCycles);
    insert(schema.billingCycles as never, payload.billingCycles);
    insert(schema.customers as never, payload.customers);
    insert(schema.customerInspectionMonths as never, payload.customerInspectionMonths);
    insert(schema.inspectionRecords as never, payload.inspectionRecords);
    insert(schema.billingRecords as never, payload.billingRecords);
  });

  try {
    run();
  } catch (e) {
    return { ok: false as const, message: `インポートに失敗しました: ${(e as Error).message}` };
  }

  return {
    ok: true as const,
    message: `顧客 ${payload.customers.length} 件、点検実績 ${payload.inspectionRecords.length} 件、請求実績 ${payload.billingRecords.length} 件を取り込みました`,
  };
}
