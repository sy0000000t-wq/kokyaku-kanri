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
 * 「3・4月分」のように画面へ出して、取り違えを防ぐために使う。
 *
 * 請求月は不規則でもよいので、間隔からではなく
 * 「ひとつ前の請求月の翌月から、この請求月まで」で数える。
 * 例）請求月 4・6・8・10・12・2月 のとき 4月請求は 3・4月分
 *     請求月 12・3・6・9月 のとき 12月請求は 10・11・12月分
 *     請求月が年1回なら、その月までの12ヶ月分
 */
export function billedMonths(
  billingMonths: number[],
  billingMonth: number,
): number[] {
  const month = normalizeMonth(billingMonth);
  const months = [...new Set(billingMonths.map(normalizeMonth))];

  const span = (length: number) => {
    const out: number[] = [];
    for (let i = length - 1; i >= 0; i--) out.push(normalizeMonth(month - i));
    return out;
  };

  // 請求月として登録されていない月は、その月だけを対象とみなす
  if (!months.includes(month)) return span(1);
  if (months.length === 1) return span(12);

  // ひとつ前の請求月まで遡る
  let gap = 1;
  while (gap < 12 && !months.includes(normalizeMonth(month - gap))) gap += 1;
  return span(gap);
}

/**
 * 「何月分」の表示。
 * 3ヶ月ぶんまでは並べ、それより長いときは範囲で書く（12ヶ月ぶんが並ぶと読めないため）。
 */
export function formatBilledMonths(coveredMonths: number[]): string {
  if (coveredMonths.length === 0) return "";
  if (coveredMonths.length <= 3) return `${coveredMonths.join("・")}月分`;
  return `${coveredMonths[0]}〜${coveredMonths[coveredMonths.length - 1]}月分`;
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
  /** この請求がまとめる月数。隔月なら 2、3ヶ月なら 3 */
  coveredMonthCount?: number;
};

/**
 * 請求額の既定値。
 *
 * 月額 × まとめる月数 ＋（別途請求 かつ 年次点検月と同月なら）年次点検費。
 * 隔月請求なら1回の請求で2ヶ月分をまとめて請求するため、月額をそのまま出すと不足する。
 */
export function calcDefaultBillingAmount(input: BillingAmountInput): number {
  const months = Math.max(1, Math.round(input.coveredMonthCount ?? 1));

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
