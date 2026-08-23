import "server-only";
import type { YearMonth } from "@/lib/calc/schedule";
import { isPaymentOverdue } from "@/lib/calc/billing";
import { getUnpaidBillingRecords } from "@/lib/records";
import type { CustomerView } from "@/lib/queries";

export type UnpaidItem = {
  customer: CustomerView;
  year: number;
  month: number;
  amount: number;
  expected: YearMonth;
  billedDate: string | null;
  /** 入金予定日（予定月の末日）からの経過日数 */
  overdueDays: number;
};

/** 予定月の末日を過ぎた日数 */
function daysSince(expected: YearMonth, now: Date): number {
  const dueEnd = new Date(expected.year, expected.month, 0, 23, 59, 59);
  return Math.max(0, Math.floor((now.getTime() - dueEnd.getTime()) / 86_400_000));
}

/** §4.5 未入金アラート。請求済みで入金予定を過ぎたもの */
export function getUnpaidItems(
  customers: CustomerView[],
  now = new Date(),
): UnpaidItem[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 };

  return getUnpaidBillingRecords()
    .flatMap((r) => {
      const customer = byId.get(r.customerId);
      if (!customer) return [];
      const expected = {
        year: r.expectedPaymentYear,
        month: r.expectedPaymentMonth,
      };
      if (!isPaymentOverdue(expected, false, today)) return [];

      return [
        {
          customer,
          year: r.year,
          month: r.month,
          amount: r.billingAmount,
          expected,
          billedDate: r.billedDate,
          overdueDays: daysSince(expected, now),
        },
      ];
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);
}
