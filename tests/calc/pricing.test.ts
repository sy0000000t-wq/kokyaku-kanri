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
      monthlyFeeTaxMode: "included",
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
      monthlyFeeTaxMode: "excluded",
      annualFeeTaxMode: "excluded",
      annualFeeHandling: "separate",
      annualInspectionFee: 40000,
      taxRate: TAX,
      points: 0.6,
    });
    const included = calcPricing({
      monthlyFee: 15400,
      monthlyFeeTaxMode: "included",
      annualFeeTaxMode: "included",
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
      monthlyFeeTaxMode: "included",
      annualFeeTaxMode: "included",
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
      monthlyFeeTaxMode: "included",
      annualFeeHandling: "included",
      taxRate: TAX,
      points: 1,
    });
    // 税抜年額 20,000 × 12 = 240,000 →  240,000 ÷ 12 = 20,000
    expect(r.monthlyExcl).toBe(20000);
    expect(r.unitPrice).toBe(20000);
  });
});

describe("月額と年次点検費で税区分が違う契約", () => {
  it("月額は税抜、年次点検費は税込で入力できる", () => {
    const r = calcPricing({
      monthlyFee: 16000, // 税抜
      monthlyFeeTaxMode: "excluded",
      annualFeeHandling: "separate",
      annualInspectionFee: 44000, // 税込
      annualFeeTaxMode: "included",
      taxRate: TAX,
      points: 0.36,
    });

    expect(r.monthlyExcl).toBe(16000);
    expect(r.monthlyIncl).toBe(17600);
    expect(r.annualInspectionFeeIncl).toBe(44000);
    expect(r.annualInspectionFeeExcl).toBe(40000);

    // 年額は それぞれの税抜／税込を積み上げる
    expect(r.annualExcl).toBe(16000 * 12 + 40000);
    expect(r.annualIncl).toBe(17600 * 12 + 44000);
  });

  it("月額は税込、年次点検費は税抜でも計算できる", () => {
    const r = calcPricing({
      monthlyFee: 17600, // 税込
      monthlyFeeTaxMode: "included",
      annualFeeHandling: "separate",
      annualInspectionFee: 40000, // 税抜
      annualFeeTaxMode: "excluded",
      taxRate: TAX,
      points: 0.36,
    });

    expect(r.monthlyIncl).toBe(17600);
    expect(r.monthlyExcl).toBe(16000);
    expect(r.annualInspectionFeeExcl).toBe(40000);
    expect(r.annualInspectionFeeIncl).toBe(44000);
    expect(r.annualExcl).toBe(232000);
  });
});

describe("1回あたりの契約（巡回＋年次）", () => {
  /** 巡回1回5,000円（税込）を年3回、年次点検40,000円（税込）を年1回 */
  const chi01 = {
    monthlyFee: 5000,
    monthlyFeeTaxMode: "included" as const,
    feeBasis: "perVisit" as const,
    visitsPerYear: 3,
    annualFeeHandling: "separate" as const,
    annualInspectionFee: 40000,
    annualFeeTaxMode: "included" as const,
    taxRate: 0.1,
    points: null,
  };

  it("年額は 巡回15,000円 ＋ 年次40,000円 ＝ 55,000円（税込）", () => {
    const r = calcPricing(chi01);
    expect(r.annualIncl).toBe(55000);
    expect(r.annualExcl).toBe(50000);
  });

  it("巡回のぶんが内訳として引ける", () => {
    const r = calcPricing(chi01);
    expect(r.visitFeeIncl).toBe(5000);
    expect(r.visitsPerYear).toBe(3);
    expect(r.visitFeeIncl * r.visitsPerYear).toBe(15000);
  });

  it("月額換算は年額の12分の1", () => {
    const r = calcPricing(chi01);
    expect(r.monthlyIncl).toBe(Math.round(55000 / 12));
  });

  it("巡回がない年次だけの契約は年次点検費そのまま", () => {
    const r = calcPricing({ ...chi01, monthlyFee: 0, visitsPerYear: 0 });
    expect(r.annualIncl).toBe(40000);
    expect(r.annualExcl).toBe(36364);
  });

  it("月額制はこれまでどおり12ヶ月ぶん", () => {
    const r = calcPricing({
      monthlyFee: 17500,
      monthlyFeeTaxMode: "excluded",
      feeBasis: "monthly",
      annualFeeHandling: "included",
      annualInspectionFee: null,
      taxRate: 0.1,
      points: null,
    });
    expect(r.annualExcl).toBe(210000);
    expect(r.annualIncl).toBe(231000);
    expect(r.monthlyExcl).toBe(17500);
  });

  it("1回ぶんを丸めてから掛けないので、端数が積み上がらない", () => {
    // 4,545 × 3 = 13,635 ではなく、15,000 ÷ 1.1 = 13,636
    const r = calcPricing({ ...chi01, annualFeeHandling: "included" });
    expect(r.annualIncl).toBe(15000);
    expect(r.annualExcl).toBe(13636);
  });
});
