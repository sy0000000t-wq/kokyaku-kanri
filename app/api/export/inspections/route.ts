import { db } from "@/db";
import * as schema from "@/db/schema";
import { csvResponse, toCsv } from "@/lib/csv";
import { getCustomerViews } from "@/lib/queries";
import { todayIso } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** §2.3 点検実績の CSV エクスポート */
export async function GET() {
  const byId = new Map(getCustomerViews().map((c) => [c.id, c]));
  const records = db
    .select()
    .from(schema.inspectionRecords)
    .all()
    .sort((a, b) => a.year - b.year || a.month - b.month || a.customerId - b.customerId);

  const csv = toCsv(
    ["顧客ID", "物件名称", "年", "月", "点検種別", "実施済み", "実施日", "備考"],
    records.map((r) => {
      const c = byId.get(r.customerId);
      return [
        c?.code ?? r.customerId,
        c?.name ?? "",
        r.year,
        r.month,
        r.type === "annual" ? "年次点検" : "通常点検",
        r.isDone ? "済" : "",
        r.doneDate ?? "",
        r.note ?? "",
      ];
    }),
  );

  return csvResponse(`点検実績_${todayIso()}.csv`, csv);
}
