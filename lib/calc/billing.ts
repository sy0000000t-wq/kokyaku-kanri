import { roundYen } from "./round";
import {
  addMonths,
  compareYearMonth,
  generateCycleMonths,
  isActiveInMonth,
  type ContractLike,
  type YearMonth,
} from "./schedule";

/** §4.5 請求月は点検月と同じロジック（契約開始月起点）で導出する */
export const generateBillingMonths = generateCycleMonths;

export type BillingTargetInput = ContractLike & {
  billingMonths: number[];
};

/** §4.5 対象年月が請求対象かどうか */
export function isBillingTarget(
  customer: BillingTargetInput,
  target: YearMonth,
): boolean {
  if (!isActiveInMonth(customer, target)) return false;
  return customer.billingMonths.includes(target.month);
}

export type BillingAmountInput = {
  /** 月額税込 */
  monthlyIncl: number;
  annualFeeHandling: "included" | "separate";
  /** 年次点検費の税込額 */
  annualInspectionFeeIncl: number;
  annualInspectionMonth: number | null;
  targetMonth: number;
};

/**
 * §4.5 請求額の既定値。
 * 月額税込 ＋（別途請求 かつ 年次点検月と同月なら）年次点検費の税込額
 */
export function calcDefaultBillingAmount(input: BillingAmountInput): number {
  const annual =
    input.annualFeeHandling === "separate" &&
    input.annualInspectionMonth === input.targetMonth
      ? input.annualInspectionFeeIncl
      : 0;
  return roundYen(input.monthlyIncl + annual);
}

/** §4.5 入金予定年月 ＝ 請求年月 ＋ payment_lag_months */
export function calcExpectedPayment(
  billing: YearMonth,
  paymentLagMonths: number,
): YearMonth {
  return addMonths(billing, paymentLagMonths);
}

/**
 * §4.5 未入金アラート。
 * 入金予定年月を過ぎても未入金のレコードを「未入金（期日超過）」とする。
 */
export function isPaymentOverdue(
  expected: YearMonth,
  isPaid: boolean,
  today: YearMonth,
): boolean {
  if (isPaid) return false;
  return compareYearMonth(expected, today) < 0;
}

/** 入金予定年月からの経過月数（未超過なら 0） */
export function monthsOverdue(expected: YearMonth, today: YearMonth): number {
  const diff = compareYearMonth(today, expected);
  return diff > 0 ? diff : 0;
}
