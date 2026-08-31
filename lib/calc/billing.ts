import { roundYen } from "./round";
import {
  addMonths,
  compareYearMonth,
  generateCycleMonths,
  normalizeMonth,
  isActiveInMonth,
  type ContractLike,
  type YearMonth,
} from "./schedule";

/** §4.5 請求月は点検月と同じロジック（契約開始月起点）で導出する */
/**
 * 請求月を出す。
 *
 * 請求は「対象期間の最終月」に行う（後払い）。
 * 例）3月契約・隔月請求 → 3月4月分を4月に請求し、以後 6月・8月…
 *     10月契約・3ヶ月請求 → 10〜12月分を12月に請求し、以後 3月・6月…
 * 毎月請求のときは、その月のぶんをその月に請求する。
 */
export function generateBillingMonths(
  contractStartMonth: number,
  intervalMonths: number,
): number[] {
  if (!Number.isFinite(intervalMonths) || intervalMonths <= 0) return [];
  const firstBillingMonth = normalizeMonth(
    contractStartMonth + intervalMonths - 1,
  );
  return generateCycleMonths(firstBillingMonth, intervalMonths);
}

/**
 * その請求が何月分をまとめたものかを返す（古い順）。
 * 「3月4月分」のように画面へ出して、取り違えを防ぐために使う。
 */
export function billedMonths(
  billingMonth: number,
  intervalMonths: number,
): number[] {
  const months = Math.max(1, Math.round(intervalMonths || 1));
  const out: number[] = [];
  for (let i = months - 1; i >= 0; i--) {
    out.push(normalizeMonth(billingMonth - i));
  }
  return out;
}

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
  /**
   * 請求サイクルの間隔（月）。隔月なら 2、3ヶ月なら 3。
   * 毎月でない場合、その回で間隔ぶんをまとめて請求する。
   */
  billingIntervalMonths?: number;
};

/**
 * 請求額の既定値。
 *
 * 月額 × 請求サイクルの月数 ＋（別途請求 かつ 年次点検月と同月なら）年次点検費。
 * 隔月請求なら1回の請求で2ヶ月分をまとめて請求するため、月額をそのまま出すと不足する。
 */
export function calcDefaultBillingAmount(input: BillingAmountInput): number {
  const months = Math.max(1, Math.round(input.billingIntervalMonths ?? 1));

  const annual =
    input.annualFeeHandling === "separate" &&
    input.annualInspectionMonth === input.targetMonth
      ? input.annualInspectionFeeIncl
      : 0;

  return roundYen(input.monthlyIncl * months + annual);
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
