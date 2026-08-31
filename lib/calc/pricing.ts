import { roundYen } from "./round";

export type AnnualFeeHandling = "included" | "separate";
/** 入力した金額が税抜か税込か */
export type FeeTaxMode = "excluded" | "included";

export type PricingInput = {
  /** 月額。税抜か税込かは monthlyFeeTaxMode で決まる */
  monthlyFee: number;
  monthlyFeeTaxMode?: FeeTaxMode;
  annualFeeHandling: AnnualFeeHandling;
  /** 年次点検費。separate のときのみ加算する */
  annualInspectionFee?: number | null;
  /** 年次点検費を税抜で入れたか税込で入れたか。月額とは別に選べる */
  annualFeeTaxMode?: FeeTaxMode;
  taxRate: number;
  /** 保安管理点数。0 または null のとき点数単価は null */
  points: number | null;
  unitPriceOverride?: number | null;
};

export type PricingResult = {
  monthlyExcl: number;
  monthlyIncl: number;
  annualExcl: number;
  annualIncl: number;
  /** 年次点検費。included のときは 0 */
  annualInspectionFeeExcl: number;
  annualInspectionFeeIncl: number;
  /** 点数単価（円/点）。常に税抜の年額から求める。点数 0 のときは null */
  unitPrice: number | null;
  isUnitPriceOverridden: boolean;
};

/**
 * 入力された金額を税抜・税込の両方に展開する。
 * 税込で入力された場合は、その値をそのまま税込として扱い、税抜を割り戻す。
 * 契約で決めた金額をそのまま入れられるようにするため、
 * 入力した側の値は丸め直さない。
 */
function expand(amount: number, mode: FeeTaxMode, taxFactor: number) {
  if (mode === "included") {
    return { excl: roundYen(amount / taxFactor), incl: amount };
  }
  return { excl: amount, incl: roundYen(amount * taxFactor) };
}

/** 料金と点数単価 */
export function calcPricing(input: PricingInput): PricingResult {
  const taxFactor = 1 + input.taxRate;

  // 月額と年次点検費は、契約によって税抜・税込がそろっていないことがある
  const monthly = expand(
    input.monthlyFee,
    input.monthlyFeeTaxMode ?? "excluded",
    taxFactor,
  );

  const rawAnnualFee =
    input.annualFeeHandling === "separate" ? (input.annualInspectionFee ?? 0) : 0;
  const annualFee = expand(
    rawAnnualFee,
    input.annualFeeTaxMode ?? "excluded",
    taxFactor,
  );

  // 年額は月額12回分と年次点検費の合計。請求する額をそのまま積み上げる
  const annualExcl = monthly.excl * 12 + annualFee.excl;
  const annualIncl = monthly.incl * 12 + annualFee.incl;

  const isUnitPriceOverridden =
    input.unitPriceOverride != null && Number.isFinite(input.unitPriceOverride);

  let unitPrice: number | null = null;
  if (isUnitPriceOverridden) {
    unitPrice = input.unitPriceOverride!;
  } else if (input.points != null && input.points > 0) {
    // 点数単価は税抜で求める。点数 0 でゼロ除算しないこと
    unitPrice = roundYen(annualExcl / (input.points * 12));
  }

  return {
    monthlyExcl: monthly.excl,
    monthlyIncl: monthly.incl,
    annualExcl,
    annualIncl,
    annualInspectionFeeExcl: annualFee.excl,
    annualInspectionFeeIncl: annualFee.incl,
    unitPrice,
    isUnitPriceOverridden,
  };
}
