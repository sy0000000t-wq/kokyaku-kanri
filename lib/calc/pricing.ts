import { roundYen } from "./round";

export type AnnualFeeHandling = "included" | "separate";

export type PricingInput = {
  /** 月額（税抜・円）＝入力値 */
  monthlyFee: number;
  annualFeeHandling: AnnualFeeHandling;
  /** 年次点検費（税抜）。separate のときのみ加算する */
  annualInspectionFee?: number | null;
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
  /** 年次点検費（税抜）。included のときは 0 */
  annualInspectionFeeExcl: number;
  annualInspectionFeeIncl: number;
  /** 点数単価（円/点）。点数 0 のときは null */
  unitPrice: number | null;
  isUnitPriceOverridden: boolean;
};

/** §4.2 料金と点数単価 */
export function calcPricing(input: PricingInput): PricingResult {
  const monthlyExcl = input.monthlyFee;
  const taxFactor = 1 + input.taxRate;

  const annualInspectionFeeExcl =
    input.annualFeeHandling === "separate" ? (input.annualInspectionFee ?? 0) : 0;

  const annualExcl = monthlyExcl * 12 + annualInspectionFeeExcl;

  const isUnitPriceOverridden =
    input.unitPriceOverride != null && Number.isFinite(input.unitPriceOverride);

  let unitPrice: number | null = null;
  if (isUnitPriceOverridden) {
    unitPrice = input.unitPriceOverride!;
  } else if (input.points != null && input.points > 0) {
    // 点数 0 でゼロ除算しないこと（§4.2）
    unitPrice = roundYen(annualExcl / (input.points * 12));
  }

  return {
    monthlyExcl,
    monthlyIncl: roundYen(monthlyExcl * taxFactor),
    annualExcl,
    annualIncl: roundYen(annualExcl * taxFactor),
    annualInspectionFeeExcl,
    annualInspectionFeeIncl: roundYen(annualInspectionFeeExcl * taxFactor),
    unitPrice,
    isUnitPriceOverridden,
  };
}
