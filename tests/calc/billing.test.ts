import { describe, expect, it } from "vitest";
import {
  calcDefaultBillingAmount,
  calcExpectedPayment,
  isBillingTarget,
  isPaymentOverdue,
  monthsOverdue,
} from "@/lib/calc/billing";

describe("isBillingTarget §4.5", () => {
  const monthly = {
    isActive: 1,
    contractStartDate: "2026-04-01",
    contractEndDate: null,
    billingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  };

  it("点検が隔月でも請求は毎月というケースを表現できる", () => {
    expect(isBillingTarget(monthly, { year: 2026, month: 5 })).toBe(true);
    expect(isBillingTarget(monthly, { year: 2026, month: 6 })).toBe(true);
  });

  it("契約開始前は請求対象外", () => {
    expect(isBillingTarget(monthly, { year: 2026, month: 3 })).toBe(false);
  });
});

describe("calcDefaultBillingAmount：請求サイクルぶんをまとめて請求する", () => {
  it("隔月請求は2ヶ月分をまとめる", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 19250,
        annualFeeHandling: "included",
        annualInspectionFeeIncl: 0,
        annualInspectionMonth: null,
        targetMonth: 5,
        billingIntervalMonths: 2,
      }),
    ).toBe(38500);
  });

  it("3ヶ月請求は3ヶ月分", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 19250,
        annualFeeHandling: "included",
        annualInspectionFeeIncl: 0,
        annualInspectionMonth: null,
        targetMonth: 6,
        billingIntervalMonths: 3,
      }),
    ).toBe(57750);
  });

  it("年1回請求は12ヶ月分", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 19250,
        annualFeeHandling: "included",
        annualInspectionFeeIncl: 0,
        annualInspectionMonth: null,
        targetMonth: 4,
        billingIntervalMonths: 12,
      }),
    ).toBe(231000);
  });

  it("まとめ請求でも年次点検費は1回分だけ足す", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 15400,
        annualFeeHandling: "separate",
        annualInspectionFeeIncl: 44000,
        annualInspectionMonth: 4,
        targetMonth: 4,
        billingIntervalMonths: 2,
      }),
    ).toBe(74800); // 15,400 × 2 + 44,000
  });

  it("指定が無ければ従来どおり1ヶ月分", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 19250,
        annualFeeHandling: "included",
        annualInspectionFeeIncl: 0,
        annualInspectionMonth: null,
        targetMonth: 5,
      }),
    ).toBe(19250);
  });
});

describe("calcDefaultBillingAmount §4.5", () => {
  it("通常月は月額税込のみ", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 15400,
        annualFeeHandling: "separate",
        annualInspectionFeeIncl: 44000,
        annualInspectionMonth: 4,
        targetMonth: 5,
      }),
    ).toBe(15400);
  });

  it("別途請求かつ年次点検月なら年次点検費の税込額を加算", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 15400,
        annualFeeHandling: "separate",
        annualInspectionFeeIncl: 44000,
        annualInspectionMonth: 4,
        targetMonth: 4,
      }),
    ).toBe(59400);
  });

  it("月額に含む場合は年次点検月でも加算しない", () => {
    expect(
      calcDefaultBillingAmount({
        monthlyIncl: 19250,
        annualFeeHandling: "included",
        annualInspectionFeeIncl: 0,
        annualInspectionMonth: 3,
        targetMonth: 3,
      }),
    ).toBe(19250);
  });
});

describe("入金予定と未入金判定 §4.5", () => {
  it("入金予定年月 = 請求年月 + payment_lag_months", () => {
    expect(calcExpectedPayment({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(calcExpectedPayment({ year: 2026, month: 5 }, 2)).toEqual({
      year: 2026,
      month: 7,
    });
  });

  it("入金予定月を過ぎて未入金なら期日超過", () => {
    const expected = { year: 2026, month: 5 };
    expect(isPaymentOverdue(expected, false, { year: 2026, month: 5 })).toBe(false);
    expect(isPaymentOverdue(expected, false, { year: 2026, month: 6 })).toBe(true);
    expect(isPaymentOverdue(expected, true, { year: 2026, month: 8 })).toBe(false);
  });

  it("経過月数", () => {
    expect(monthsOverdue({ year: 2026, month: 5 }, { year: 2026, month: 8 })).toBe(3);
    expect(monthsOverdue({ year: 2026, month: 5 }, { year: 2026, month: 4 })).toBe(0);
  });
});
