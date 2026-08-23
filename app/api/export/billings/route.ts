import { db } from "@/db";
import * as schema from "@/db/schema";
import { csvResponse, toCsv } from "@/lib/csv";
import { getCustomerViews } from "@/lib/queries";
import { todayIso } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** §2.3 請求実績の CSV エクスポート */
export async function GET() {
  const byId = new Map(getCustomerViews().map((c) => [c.id, c]));
  const records = db
    .select()
    .from(schema.billingRecords)
    .all()
    .sort((a, b) => a.year - b.year || a.month - b.month || a.customerId - b.customerId);

  const csv = toCsv(
    [
      "顧客ID",
      "物件名称",
      "請求年",
      "請求月",
      "請求額(税込)",
      "請求済み",
      "請求日",
      "入金予定年",
      "入金予定月",
      "入金済み",
      "入金日",
      "備考",
    ],
    records.map((r) => {
      const c = byId.get(r.customerId);
      return [
        c?.code ?? r.customerId,
        c?.name ?? "",
        r.year,
        r.month,
        r.billingAmount,
        r.isBilled ? "済" : "",
        r.billedDate ?? "",
        r.expectedPaymentYear,
        r.expectedPaymentMonth,
        r.isPaid ? "済" : "",
        r.paidDate ?? "",
        r.note ?? "",
      ];
    }),
  );

  return csvResponse(`請求実績_${todayIso()}.csv`, csv);
}
