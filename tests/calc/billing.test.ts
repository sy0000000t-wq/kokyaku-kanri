import { describe, expect, it } from "vitest";
import {
  billedMonths,
  calcDefaultBillingAmount,
  calcExpectedPayment,
  formatBilledMonths,
  generateBillingMonths,
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
        coveredMonthCount: 2,
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
        coveredMonthCount: 3,
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
        coveredMonthCount: 12,
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
        coveredMonthCount: 2,
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

describe("請求月は対象期間の最終月（後払い）", () => {
  it("3月契約・隔月請求 → 4月・6月・8月…に請求する", () => {
    // 3月4月分を4月に請求。翌月入金なら5月に入金
    expect(generateBillingMonths(3, 2)).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it("10月契約・3ヶ月請求 → 12月・3月・6月・9月に請求する", () => {
    // 10〜12月分を12月に請求。翌月入金なら1月に入金
    expect(generateBillingMonths(10, 3)).toEqual([3, 6, 9, 12]);
  });

  it("毎月請求は契約月からその月ごと", () => {
    expect(generateBillingMonths(4, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("6ヶ月請求は契約月の5ヶ月後から", () => {
    expect(generateBillingMonths(4, 6)).toEqual([3, 9]);
  });

  it("実施なし（0）は請求しない", () => {
    expect(generateBillingMonths(3, 0)).toEqual([]);
  });
});

describe("billedMonths：その請求が何月分か", () => {
  it("隔月請求の4月は、3月と4月の2ヶ月分", () => {
    expect(billedMonths([2, 4, 6, 8, 10, 12], 4)).toEqual([3, 4]);
  });

  it("3ヶ月請求の12月は、10・11・12月分", () => {
    expect(billedMonths([3, 6, 9, 12], 12)).toEqual([10, 11, 12]);
  });

  it("年をまたぐ場合も1〜12に収まる", () => {
    expect(billedMonths([2, 5, 8, 11], 2)).toEqual([12, 1, 2]);
  });

  it("毎月請求はその月だけ", () => {
    expect(billedMonths([1,2,3,4,5,6,7,8,9,10,11,12], 7)).toEqual([7]);
  });
});

describe("請求と入金のスケジュール（本人の運用に合わせた確認）", () => {
  it("3月契約・隔月請求・翌月入金 → 4月請求5月入金、6月請求7月入金", () => {
    const months = generateBillingMonths(3, 2);
    expect(months).toContain(4);
    expect(months).toContain(6);

    expect(calcExpectedPayment({ year: 2026, month: 4 }, 1)).toEqual({
      year: 2026,
      month: 5,
    });
    expect(calcExpectedPayment({ year: 2026, month: 6 }, 1)).toEqual({
      year: 2026,
      month: 7,
    });
  });

  it("10月契約・3ヶ月請求・翌月入金 → 12月請求1月入金、3月請求4月入金", () => {
    const months = generateBillingMonths(10, 3);
    expect(months).toContain(12);
    expect(months).toContain(3);

    expect(calcExpectedPayment({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(calcExpectedPayment({ year: 2027, month: 3 }, 1)).toEqual({
      year: 2027,
      month: 4,
    });
  });
});

describe("不規則な請求月", () => {
  it("巡回のように間隔がそろわなくても、前回請求の翌月からを対象にする", () => {
    // 5・8・11月に請求する契約
    const months = [5, 8, 11];
    expect(billedMonths(months, 5)).toEqual([12, 1, 2, 3, 4, 5]);
    expect(billedMonths(months, 8)).toEqual([6, 7, 8]);
    expect(billedMonths(months, 11)).toEqual([9, 10, 11]);
  });

  it("年1回の請求は、その月までの12ヶ月分", () => {
    expect(billedMonths([2], 2)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]);
  });

  it("請求月として登録していない月は、その月だけを対象にする", () => {
    expect(billedMonths([5, 8, 11], 7)).toEqual([7]);
  });

  it("請求月が空なら、その月だけを対象にする", () => {
    expect(billedMonths([], 7)).toEqual([7]);
  });
});

describe("formatBilledMonths：何月分の表示", () => {
  it("3ヶ月分までは並べる", () => {
    expect(formatBilledMonths([3, 4])).toBe("3・4月分");
    expect(formatBilledMonths([10, 11, 12])).toBe("10・11・12月分");
  });

  it("4ヶ月分以上は範囲で書く", () => {
    expect(formatBilledMonths([12, 1, 2, 3, 4, 5])).toBe("12〜5月分");
    expect(formatBilledMonths([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2])).toBe("3〜2月分");
  });

  it("空なら何も出さない", () => {
    expect(formatBilledMonths([])).toBe("");
  });
});

describe("当月分のみの請求（年次請け・不規則な物件）", () => {
  it("実施した月をその月に請求するので、対象は当月だけ", () => {
    // 巡回 5・8・11月。まとめずに、行った月のぶんだけ請求する
    const months = [5, 8, 11];
    expect(billedMonths(months, 5, "single")).toEqual([5]);
    expect(billedMonths(months, 8, "single")).toEqual([8]);
    expect(billedMonths(months, 11, "single")).toEqual([11]);
  });

  it("年1回でも12ヶ月分にはならない", () => {
    expect(billedMonths([2], 2, "single")).toEqual([2]);
    // まとめて請求する契約なら、これまでどおり12ヶ月分
    expect(billedMonths([2], 2, "period")).toHaveLength(12);
  });

  it("表示は「◯月分」だけになる", () => {
    expect(formatBilledMonths(billedMonths([2], 2, "single"))).toBe("2月分");
  });

  it("請求額は1ヶ月ぶん。年次点検月なら年次点検費が乗る", () => {
    const base = {
      monthlyIncl: 5500,
      annualFeeHandling: "separate" as const,
      annualInspectionFeeIncl: 44000,
      annualInspectionMonth: 2,
    };

    // 巡回の月は月額1ヶ月ぶんだけ
    expect(
      calcDefaultBillingAmount({ ...base, targetMonth: 5, coveredMonthCount: 1 }),
    ).toBe(5500);

    // 年次点検の月は年次点検費が乗る
    expect(
      calcDefaultBillingAmount({ ...base, targetMonth: 2, coveredMonthCount: 1 }),
    ).toBe(49500);
  });
});
