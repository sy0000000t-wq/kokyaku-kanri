import {
  calcDefaultBillingAmount,
  calcExpectedPayment,
  isBillingTarget,
  isPaymentOverdue,
  monthsOverdue,
} from "@/lib/calc/billing";
import { getInspectionTarget, type YearMonth } from "@/lib/calc/schedule";
import type {
  AppDocument,
  BillingRecord,
  InspectionRecord,
  InspectionType,
} from "./document";
import type { CustomerView } from "./selectors";

/** 月ごとの導出。ダッシュボード・スケジュール・請求で共用する */

export type InspectionCell = {
  customer: CustomerView;
  type: InspectionType;
  isTarget: boolean;
  isDone: boolean;
  doneDate: string | null;
  record: InspectionRecord | null;
  /**
   * この訪問で点検する設備。
   * 訪問周期より長い周期の設備は、該当する月の訪問だけに現れる。
   */
  dueFacilities: CustomerView["facilities"];
};

export type BillingCell = {
  customer: CustomerView;
  isTarget: boolean;
  amount: number;
  defaultAmount: number;
  isBilled: boolean;
  billedDate: string | null;
  isPaid: boolean;
  paidDate: string | null;
  expected: YearMonth;
  isOverdue: boolean;
  monthsOverdue: number;
  record: BillingRecord | null;
};

const inspectionKey = (customerId: number, month: number, type: InspectionType) =>
  `${customerId}:${month}:${type}`;
const billingKey = (customerId: number, month: number) => `${customerId}:${month}`;

/** 指定年の点検実績を、顧客×月×種別で引けるようにまとめる */
export function buildInspectionGrid(doc: AppDocument, year: number) {
  const records = new Map<string, InspectionRecord>();
  for (const r of doc.inspectionRecords) {
    if (r.year === year) records.set(inspectionKey(r.customerId, r.month, r.type), r);
  }

  const cellFor = (
    customer: CustomerView,
    month: number,
    type: InspectionType,
  ): InspectionCell => {
    const target = getInspectionTarget(
      {
        isActive: customer.isActive,
        contractStartDate: customer.contractStartDate,
        contractEndDate: customer.contractEndDate,
        inspectionMonths: customer.inspectionMonths,
        annualInspectionMonth: customer.annualInspectionMonth,
      },
      { year, month },
    );
    const record = records.get(inspectionKey(customer.id, month, type)) ?? null;

    // 年次点検の回では設備別の周期を持ち出さない（別枠の点検のため）
    const dueFacilities =
      type === "regular"
        ? customer.facilities.filter((f) => f.inspectionMonths.includes(month))
        : [];

    return {
      customer,
      type,
      isTarget: type === "regular" ? target.regular : target.annual,
      isDone: !!record?.isDone,
      doneDate: record?.doneDate ?? null,
      record,
      dueFacilities,
    };
  };

  return { records, cellFor };
}

/** 指定年の請求・入金実績を顧客×月で引けるようにまとめる */
export function buildBillingGrid(
  doc: AppDocument,
  year: number,
  today: YearMonth,
) {
  const records = new Map<string, BillingRecord>();
  for (const r of doc.billingRecords) {
    if (r.year === year) records.set(billingKey(r.customerId, r.month), r);
  }

  const cellFor = (customer: CustomerView, month: number): BillingCell => {
    const isTarget = isBillingTarget(
      {
        isActive: customer.isActive,
        contractStartDate: customer.contractStartDate,
        contractEndDate: customer.contractEndDate,
        billingMonths: customer.billingMonths,
      },
      { year, month },
    );

    const defaultAmount = calcDefaultBillingAmount({
      monthlyIncl: customer.pricing.monthlyIncl,
      annualFeeHandling: customer.annualFeeHandling,
      annualInspectionFeeIncl: customer.pricing.annualInspectionFeeIncl,
      annualInspectionMonth: customer.annualInspectionMonth,
      targetMonth: month,
      // 隔月・3ヶ月請求などは、その回でまとめて請求する
      billingIntervalMonths: customer.billingCycle?.intervalMonths ?? 1,
    });

    const record = records.get(billingKey(customer.id, month)) ?? null;
    const expected = record
      ? { year: record.expectedPaymentYear, month: record.expectedPaymentMonth }
      : calcExpectedPayment({ year, month }, customer.paymentLagMonths);

    const isPaid = !!record?.isPaid;
    const isBilled = !!record?.isBilled;

    return {
      customer,
      isTarget,
      amount: record?.billingAmount ?? defaultAmount,
      defaultAmount,
      isBilled,
      billedDate: record?.billedDate ?? null,
      isPaid,
      paidDate: record?.paidDate ?? null,
      expected,
      // 請求していないものは「未入金」ではないので、期日超過の対象にしない
      isOverdue: isTarget && isBilled && isPaymentOverdue(expected, isPaid, today),
      monthsOverdue: monthsOverdue(expected, today),
      record,
    };
  };

  return { records, cellFor };
}

/** 今月サマリー */
export function summarizeMonth(
  doc: AppDocument,
  customers: CustomerView[],
  period: YearMonth,
  today: YearMonth,
) {
  const { cellFor: inspectionCell } = buildInspectionGrid(doc, period.year);
  const { cellFor: billingCell } = buildBillingGrid(doc, period.year, today);

  const regular = customers
    .map((c) => inspectionCell(c, period.month, "regular"))
    .filter((c) => c.isTarget);
  const annual = customers
    .map((c) => inspectionCell(c, period.month, "annual"))
    .filter((c) => c.isTarget);
  const billing = customers
    .map((c) => billingCell(c, period.month))
    .filter((c) => c.isTarget);

  return {
    regular: {
      cells: regular,
      total: regular.length,
      done: regular.filter((c) => c.isDone).length,
    },
    annual: {
      cells: annual,
      total: annual.length,
      done: annual.filter((c) => c.isDone).length,
    },
    billing: {
      cells: billing,
      total: billing.length,
      billed: billing.filter((c) => c.isBilled).length,
      amount: billing.reduce((s, c) => s + c.amount, 0),
      billedAmount: billing.filter((c) => c.isBilled).reduce((s, c) => s + c.amount, 0),
    },
  };
}

export type UnpaidItem = {
  customer: CustomerView;
  year: number;
  month: number;
  amount: number;
  expected: YearMonth;
  billedDate: string | null;
  overdueDays: number;
};

/** 予定月の末日を過ぎた日数 */
function daysSince(expected: YearMonth, now: Date): number {
  const dueEnd = new Date(expected.year, expected.month, 0, 23, 59, 59);
  return Math.max(0, Math.floor((now.getTime() - dueEnd.getTime()) / 86_400_000));
}

/** 未入金アラート。請求済みで入金予定を過ぎたもの */
export function getUnpaidItems(
  doc: AppDocument,
  customers: CustomerView[],
  now = new Date(),
): UnpaidItem[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 };

  return doc.billingRecords
    .filter((r) => r.isBilled && !r.isPaid)
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
