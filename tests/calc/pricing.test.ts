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
