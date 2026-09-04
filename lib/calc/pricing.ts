import { roundYen } from "./round";

export type AnnualFeeHandling = "included" | "separate";
/** 入力した金額が税抜か税込か */
export type FeeTaxMode = "excluded" | "included";
/**
 * 料金の決め方。
 * monthly  … 月額 × 12ヶ月（保安管理契約）
 * perVisit … 1回あたりの金額 × 実施回数（保安管理契約外）
 */
export type FeeBasis = "monthly" | "perVisit";

export type PricingInput = {
  /**
   * 月額、または1回あたりの金額（feeBasis で意味が変わる）。
   * 税抜か税込かは monthlyFeeTaxMode で決まる
   */
  monthlyFee: number;
  monthlyFeeTaxMode?: FeeTaxMode;
  feeBasis?: FeeBasis;
  /** perVisit のときの実施回数（通常点検の実施月の数） */
  visitsPerYear?: number;
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
  /** 月額。perVisit のときは年額を12で割った月額換算 */
  monthlyExcl: number;
  monthlyIncl: number;
  /** 1回あたりの金額。monthly のときは月額と同じ値 */
  visitFeeExcl: number;
  visitFeeIncl: number;
  /** 年間の実施回数。monthly のときは 12 */
  visitsPerYear: number;
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
  return expandTotal(amount, 1, mode, taxFactor);
}

/**
 * 同じ金額を count 回ぶん積んだ合計を、税抜・税込の両方に展開する。
 *
 * 1回ぶんを丸めてから掛けると端数が積み上がるので、掛けてから1回だけ丸める。
 * 例）税込5,000円を3回 → 税込15,000円・税抜13,636円
 *     （1回ずつ割り戻して4,545×3=13,635 とはしない）
 */
function expandTotal(
  amount: number,
  count: number,
  mode: FeeTaxMode,
  taxFactor: number,
) {
  const total = amount * count;
  if (mode === "included") {
    return { excl: roundYen(total / taxFactor), incl: total };
  }
  return { excl: total, incl: roundYen(total * taxFactor) };
}

/** 料金と点数単価 */
export function calcPricing(input: PricingInput): PricingResult {
  const taxFactor = 1 + input.taxRate;

  // 月額と年次点検費は、契約によって税抜・税込がそろっていないことがある
  const fee = expand(
    input.monthlyFee,
    input.monthlyFeeTaxMode ?? "excluded",
    taxFactor,
  );

  const basis = input.feeBasis ?? "monthly";
  // 月額制は毎月ぶん、保安管理契約外なら実際に行く回数ぶんを積む
  const visitsPerYear =
    basis === "perVisit" ? Math.max(0, Math.round(input.visitsPerYear ?? 0)) : 12;

  const rawAnnualFee =
    input.annualFeeHandling === "separate" ? (input.annualInspectionFee ?? 0) : 0;
  const annualFee = expand(
    rawAnnualFee,
    input.annualFeeTaxMode ?? "excluded",
    taxFactor,
  );

  // 年間ぶんは、回数を掛けてから1回だけ税を計算する
  const feeTotal = expandTotal(
    input.monthlyFee,
    visitsPerYear,
    input.monthlyFeeTaxMode ?? "excluded",
    taxFactor,
  );

  // 年額は実施ぶんと年次点検費の合計
  const annualExcl = feeTotal.excl + annualFee.excl;
  const annualIncl = feeTotal.incl + annualFee.incl;

  // 一覧では月額の列で見比べるので、保安管理契約外は月額換算を出す
  const monthly =
    basis === "perVisit"
      ? { excl: roundYen(annualExcl / 12), incl: roundYen(annualIncl / 12) }
      : fee;

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
    visitFeeExcl: fee.excl,
    visitFeeIncl: fee.incl,
    visitsPerYear,
    annualExcl,
    annualIncl,
    annualInspectionFeeExcl: annualFee.excl,
    annualInspectionFeeIncl: annualFee.incl,
    unitPrice,
    isUnitPriceOverridden,
  };
}
