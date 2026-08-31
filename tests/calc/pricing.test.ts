import { describe, expect, it } from "vitest";
import { calcPricing } from "@/lib/calc/pricing";

const TAX = 0.1;

describe("calcPricing §4.2 検証ケース", () => {
  it("A社（サンプル） 点数0.48 月額17,500 月額に含む → 年額210,000 / 点数単価36,458", () => {
    const r = calcPricing({
      monthlyFee: 17500,
      annualFeeHandling: "included",
      taxRate: TAX,
      points: 0.48,
    });
    expect(r.monthlyIncl).toBe(19250);
    expect(r.annualExcl).toBe(210000);
    expect(r.annualIncl).toBe(231000);
    expect(r.unitPrice).toBe(36458);
  });

  it("B社（サンプル） 点数0.60 月額14,000 別途40,000 → 年額208,000 / 点数単価28,889", () => {
    const r = calcPricing({
      monthlyFee: 14000,
      annualFeeHandling: "separate",
      annualInspectionFee: 40000,
      taxRate: TAX,
      points: 0.6,
    });
    expect(r.monthlyIncl).toBe(15400);
    expect(r.annualExcl).toBe(208000);
    expect(r.annualIncl).toBe(228800);
    expect(r.unitPrice).toBe(28889);
  });
});

describe("calcPricing その他", () => {
  it("「月額に含む」のとき年次点検費は年額に加算しない", () => {
    const r = calcPricing({
      monthlyFee: 14000,
      annualFeeHandling: "included",
      annualInspectionFee: 40000,
      taxRate: TAX,
      points: 0.6,
    });
    expect(r.annualExcl).toBe(168000);
    expect(r.annualInspectionFeeExcl).toBe(0);
  });

  it("保安管理点数が 0 / null のとき点数単価は null（ゼロ除算しない）", () => {
    expect(
      calcPricing({
        monthlyFee: 17500,
        annualFeeHandling: "included",
        taxRate: TAX,
        points: 0,
      }).unitPrice,
    ).toBeNull();

    expect(
      calcPricing({
        monthlyFee: 17500,
        annualFeeHandling: "included",
        taxRate: TAX,
        points: null,
      }).unitPrice,
    ).toBeNull();
  });

  it("点数単価の手動上書きは点数が null でも有効", () => {
    const r = calcPricing({
      monthlyFee: 17500,
      annualFeeHandling: "included",
      taxRate: TAX,
      points: null,
      unitPriceOverride: 40000,
    });
    expect(r.unitPrice).toBe(40000);
    expect(r.isUnitPriceOverridden).toBe(true);
  });

  it("税率は設定値に従う（10% 以外でも動く）", () => {
    const r = calcPricing({
      monthlyFee: 17500,
      annualFeeHandling: "included",
      taxRate: 0.08,
      points: 0.48,
    });
    expect(r.monthlyIncl).toBe(18900);
    expect(r.annualIncl).toBe(226800);
  });
});

describe("税込で入力した場合", () => {
  it("入力した税込額はそのまま使い、税抜を割り戻す", () => {
    const r = calcPricing({
      monthlyFee: 19250, // 税込で入力
      feeTaxMode: "included",
      annualFeeHandling: "included",
      taxRate: TAX,
      points: 0.48,
    });
    expect(r.monthlyIncl).toBe(19250);
    expect(r.monthlyExcl).toBe(17500);
    expect(r.annualIncl).toBe(231000);
    expect(r.annualExcl).toBe(210000);
    // 点数単価は税抜の年額から求める
    expect(r.unitPrice).toBe(36458);
  });

  it("税抜で入れても税込で入れても、同じ契約なら同じ結果になる", () => {
    const excluded = calcPricing({
      monthlyFee: 14000,
      feeTaxMode: "excluded",
      annualFeeHandling: "separate",
      annualInspectionFee: 40000,
      taxRate: TAX,
      points: 0.6,
    });
    const included = calcPricing({
      monthlyFee: 15400,
      feeTaxMode: "included",
      annualFeeHandling: "separate",
      annualInspectionFee: 44000,
      taxRate: TAX,
      points: 0.6,
    });

    expect(included.monthlyExcl).toBe(excluded.monthlyExcl);
    expect(included.annualExcl).toBe(excluded.annualExcl);
    expect(included.annualIncl).toBe(excluded.annualIncl);
    expect(included.unitPrice).toBe(excluded.unitPrice);
    expect(included.unitPrice).toBe(28889);
  });

  it("年次点検費も税込で扱う", () => {
    const r = calcPricing({
      monthlyFee: 15400,
      feeTaxMode: "included",
      annualFeeHandling: "separate",
      annualInspectionFee: 44000,
      taxRate: TAX,
      points: 0.6,
    });
    expect(r.annualInspectionFeeIncl).toBe(44000);
    expect(r.annualInspectionFeeExcl).toBe(40000);
  });

  it("指定が無ければ従来どおり税抜として扱う", () => {
    const r = calcPricing({
      monthlyFee: 17500,
      annualFeeHandling: "included",
      taxRate: TAX,
      points: 0.48,
    });
    expect(r.monthlyExcl).toBe(17500);
    expect(r.monthlyIncl).toBe(19250);
  });
});

describe("点数単価は常に税抜で求める", () => {
  it("税込入力でも税抜の年額を基準にする", () => {
    const r = calcPricing({
      monthlyFee: 22000, // 税込
      feeTaxMode: "included",
      annualFeeHandling: "included",
      taxRate: TAX,
      points: 1,
    });
    // 税抜年額 20,000 × 12 = 240,000 →  240,000 ÷ 12 = 20,000
    expect(r.monthlyExcl).toBe(20000);
    expect(r.unitPrice).toBe(20000);
  });
});
