import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import type { BillingRecord, InspectionRecord } from "@/db/schema";

export type InspectionType = "regular" | "annual";

export const inspectionKey = (
  customerId: number,
  month: number,
  type: InspectionType,
) => `${customerId}:${month}:${type}`;

export const billingKey = (customerId: number, month: number) =>
  `${customerId}:${month}`;

/** 指定年の点検実績を月×種別で引けるようにして返す */
export function getInspectionRecords(year: number): Map<string, InspectionRecord> {
  const rows = db
    .select()
    .from(schema.inspectionRecords)
    .where(eq(schema.inspectionRecords.year, year))
    .all();
  return new Map(
    rows.map((r) => [inspectionKey(r.customerId, r.month, r.type), r]),
  );
}

/** 指定年の請求・入金実績 */
export function getBillingRecords(year: number): Map<string, BillingRecord> {
  const rows = db
    .select()
    .from(schema.billingRecords)
    .where(eq(schema.billingRecords.year, year))
    .all();
  return new Map(rows.map((r) => [billingKey(r.customerId, r.month), r]));
}

/** 未入金の抽出対象として、年をまたいだ全期間の請求実績を返す */
export function getUnpaidBillingRecords(): BillingRecord[] {
  return db
    .select()
    .from(schema.billingRecords)
    .where(
      and(
        eq(schema.billingRecords.isPaid, 0),
        eq(schema.billingRecords.isBilled, 1),
      ),
    )
    .all();
}
