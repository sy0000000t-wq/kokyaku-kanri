import {
  billedMonths,
  calcDefaultBillingAmount,
  calcExpectedPayment,
  isBillingTarget,
  isPaymentOverdue,
  monthsOverdue,
} from "@/lib/calc/billing";
import { addMonths, getInspectionTarget, type YearMonth } from "@/lib/calc/schedule";
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
  /** 報告書を提出したか。実施とは別に追う */
  isReported: boolean;
  reportedDate: string | null;
  /** 中電PGへ開閉器操作を申し込んだか（年次点検でのみ使う） */
  isSwitchgearRequested: boolean;
  switchgearRequestedDate: string | null;
  /** 年次点検の応援依頼（通常点検では使わない） */
  needsHelper: boolean;
  helperName: string;
  record: InspectionRecord | null;
  /**
   * この訪問で点検する設備。
   * 訪問周期より長い周期の設備は、該当する月の訪問だけに現れる。
   */
  dueFacilities: CustomerView["facilities"];
};

export type BillingCell = {
  customer: CustomerView;
  /** この請求が立つ年月（入金月とは異なる） */
  year: number;
  month: number;
  isTarget: boolean;
  /** この請求が何月分をまとめたものか（古い順） */
  coveredMonths: number[];
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
      isReported: !!record?.isReported,
      reportedDate: record?.reportedDate ?? null,
      isSwitchgearRequested: !!record?.isSwitchgearRequested,
      switchgearRequestedDate: record?.switchgearRequestedDate ?? null,
      needsHelper: !!record?.needsHelper,
      helperName: record?.helperName ?? "",
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
  // 入金は請求の翌月以降に入るため、年をまたぐ請求（12月請求→翌1月入金）も引けるようにする
  const allRecords = new Map<string, BillingRecord>();
  for (const r of doc.billingRecords) {
    allRecords.set(`${r.customerId}:${r.year}:${r.month}`, r);
    if (r.year === year) records.set(billingKey(r.customerId, r.month), r);
  }

  /** 任意の年月の請求セルを組み立てる */
  const cellAt = (customer: CustomerView, ym: YearMonth): BillingCell => {
    const isTarget = isBillingTarget(
      {
        isActive: customer.isActive,
        contractStartDate: customer.contractStartDate,
        contractEndDate: customer.contractEndDate,
        billingMonths: customer.billingMonths,
      },
      ym,
    );

    const coveredMonths = billedMonths(customer.billingMonths, ym.month);

    const defaultAmount = calcDefaultBillingAmount({
      monthlyIncl: customer.pricing.monthlyIncl,
      annualFeeHandling: customer.annualFeeHandling,
      annualInspectionFeeIncl: customer.pricing.annualInspectionFeeIncl,
      annualInspectionMonth: customer.annualInspectionMonth,
      targetMonth: ym.month,
      // 隔月・3ヶ月請求などは、その回でまとめて請求する
      coveredMonthCount: coveredMonths.length,
    });

    const record = allRecords.get(`${customer.id}:${ym.year}:${ym.month}`) ?? null;
    const expected = record
      ? { year: record.expectedPaymentYear, month: record.expectedPaymentMonth }
      : calcExpectedPayment(ym, customer.paymentLagMonths);

    const isPaid = !!record?.isPaid;
    const isBilled = !!record?.isBilled;

    return {
      customer,
      year: ym.year,
      month: ym.month,
      isTarget,
      coveredMonths,
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

  /** この月に「立つ」請求 */
  const cellFor = (customer: CustomerView, month: number): BillingCell =>
    cellAt(customer, { year, month });

  /**
   * この月に「入る」入金。
   * 入金は請求の paymentLagMonths ヶ月後なので、さかのぼった月の請求を引く。
   * 対象がなければ null。
   */
  const paymentCellFor = (customer: CustomerView, month: number): BillingCell | null => {
    const source = addMonths({ year, month }, -customer.paymentLagMonths);
    const cell = cellAt(customer, source);
    return cell.isTarget ? cell : null;
  };

  return { records, cellFor, cellAt, paymentCellFor };
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
      reported: regular.filter((c) => c.isReported).length,
    },
    annual: {
      cells: annual,
      total: annual.length,
      done: annual.filter((c) => c.isDone).length,
      reported: annual.filter((c) => c.isReported).length,
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
