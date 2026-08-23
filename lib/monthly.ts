import "server-only";
import type { BillingRecord, InspectionRecord } from "@/db/schema";
import {
  calcDefaultBillingAmount,
  calcExpectedPayment,
  isBillingTarget,
  isPaymentOverdue,
  monthsOverdue,
} from "@/lib/calc/billing";
import { getInspectionTarget, type YearMonth } from "@/lib/calc/schedule";
import {
  billingKey,
  getBillingRecords,
  getInspectionRecords,
  inspectionKey,
  type InspectionType,
} from "@/lib/records";
import type { CustomerView } from "@/lib/queries";

export type InspectionCell = {
  customer: CustomerView;
  type: InspectionType;
  isTarget: boolean;
  isDone: boolean;
  doneDate: string | null;
  record: InspectionRecord | null;
};

export type BillingCell = {
  customer: CustomerView;
  isTarget: boolean;
  /** 保存済みの請求額、無ければ既定の自動計算値 */
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

/** 指定年の点検実績を、顧客×月×種別で参照できるようにまとめる */
export function buildInspectionGrid(customers: CustomerView[], year: number) {
  const records = getInspectionRecords(year);

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

    return {
      customer,
      type,
      isTarget: type === "regular" ? target.regular : target.annual,
      isDone: !!record?.isDone,
      doneDate: record?.doneDate ?? null,
      record,
    };
  };

  return { records, cellFor };
}

/** 指定年の請求・入金実績を顧客×月で参照できるようにまとめる */
export function buildBillingGrid(
  customers: CustomerView[],
  year: number,
  today: YearMonth,
) {
  const records = getBillingRecords(year);

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

/** §5.2 今月サマリー */
export function summarizeMonth(
  customers: CustomerView[],
  period: YearMonth,
  today: YearMonth,
) {
  const { cellFor: inspectionCell } = buildInspectionGrid(customers, period.year);
  const { cellFor: billingCell } = buildBillingGrid(customers, period.year, today);

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
      billedAmount: billing
        .filter((c) => c.isBilled)
        .reduce((s, c) => s + c.amount, 0),
    },
  };
}
