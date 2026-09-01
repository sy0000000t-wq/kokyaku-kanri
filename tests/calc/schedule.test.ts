import { describe, expect, it } from "vitest";
import {
  addMonths,
  generateCycleMonths,
  getInspectionTarget,
  isActiveInMonth,
  monthsWithoutVisit,
  normalizeMonth,
  parseYearMonth,
  resolveFacilityStartMonth,
  scheduleSymbol,
} from "@/lib/calc/schedule";

describe("generateCycleMonths §3.7", () => {
  it("T01: 3月開始・隔月 → 奇数月6件（既存シートと一致）", () => {
    expect(generateCycleMonths(3, 2)).toEqual([1, 3, 5, 7, 9, 11]);
  });

  it("4月開始・隔月 → 偶数月6件", () => {
    expect(generateCycleMonths(4, 2)).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it("毎月点検は1〜12の全月", () => {
    expect(generateCycleMonths(3, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("3ヶ月・6ヶ月・年1回", () => {
    expect(generateCycleMonths(3, 3)).toEqual([3, 6, 9, 12]);
    expect(generateCycleMonths(3, 6)).toEqual([3, 9]);
    expect(generateCycleMonths(3, 12)).toEqual([3]);
  });

  it("interval 0（実施なし）は空", () => {
    expect(generateCycleMonths(3, 0)).toEqual([]);
  });
});

describe("月の正規化", () => {
  it("normalizeMonth", () => {
    expect(normalizeMonth(13)).toBe(1);
    expect(normalizeMonth(12)).toBe(12);
    expect(normalizeMonth(0)).toBe(12);
  });

  it("addMonths は年をまたぐ", () => {
    expect(addMonths({ year: 2026, month: 11 }, 2)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("parseYearMonth", () => {
    expect(parseYearMonth("2026-03-01")).toEqual({ year: 2026, month: 3 });
    expect(parseYearMonth(null)).toBeNull();
    expect(parseYearMonth("")).toBeNull();
  });
});

describe("isActiveInMonth §4.4", () => {
  const base = { isActive: 1, contractStartDate: "2026-03-01", contractEndDate: null };

  it("契約開始月より前は対象外", () => {
    expect(isActiveInMonth(base, { year: 2026, month: 2 })).toBe(false);
    expect(isActiveInMonth(base, { year: 2026, month: 3 })).toBe(true);
  });

  it("契約開始月の途中開始でもその月は対象（月末との比較）", () => {
    const mid = { ...base, contractStartDate: "2026-03-25" };
    expect(isActiveInMonth(mid, { year: 2026, month: 3 })).toBe(true);
  });

  it("解除月は対象、その翌月から対象外", () => {
    const ended = { ...base, contractEndDate: "2026-09-30" };
    expect(isActiveInMonth(ended, { year: 2026, month: 9 })).toBe(true);
    expect(isActiveInMonth(ended, { year: 2026, month: 10 })).toBe(false);
  });

  it("is_active = 0 は常に対象外", () => {
    expect(isActiveInMonth({ ...base, isActive: 0 }, { year: 2026, month: 5 })).toBe(false);
  });
});

describe("getInspectionTarget / scheduleSymbol §4.4", () => {
  const t01 = {
    isActive: 1,
    contractStartDate: "2026-03-01",
    contractEndDate: null,
    inspectionMonths: [1, 3, 5, 7, 9, 11],
    annualInspectionMonth: 3,
  };

  it("通常点検月と年次点検月が同月なら両方対象", () => {
    const r = getInspectionTarget(t01, { year: 2026, month: 3 });
    expect(r).toEqual({ regular: true, annual: true });
    expect(scheduleSymbol(r)).toBe("●★");
  });

  it("通常点検のみの月", () => {
    const r = getInspectionTarget(t01, { year: 2026, month: 5 });
    expect(r).toEqual({ regular: true, annual: false });
    expect(scheduleSymbol(r)).toBe("●");
  });

  it("対象外の月", () => {
    const r = getInspectionTarget(t01, { year: 2026, month: 4 });
    expect(scheduleSymbol(r)).toBe("−");
  });

  it("契約開始前の1月は対象外（実施月に含まれていても）", () => {
    expect(getInspectionTarget(t01, { year: 2026, month: 1 })).toEqual({
      regular: false,
      annual: false,
    });
    // 翌年の1月は対象になる
    expect(getInspectionTarget(t01, { year: 2027, month: 1 }).regular).toBe(true);
  });
});

describe("resolveFacilityStartMonth（設備ごとの点検開始月）", () => {
  it("指定があればその月を使う", () => {
    expect(resolveFacilityStartMonth(9, 7, [7, 9, 11, 1, 3, 5])).toBe(9);
  });

  it("未指定なら契約開始月以降で最初に訪問する月に合わせる", () => {
    expect(resolveFacilityStartMonth(null, 7, [7, 9, 11, 1, 3, 5])).toBe(7);
    // 契約開始が8月でも、実際に行くのは9月
    expect(resolveFacilityStartMonth(null, 8, [7, 9, 11, 1, 3, 5])).toBe(9);
    // 年をまたいで一周して探す
    expect(resolveFacilityStartMonth(null, 12, [3, 6, 9])).toBe(3);
  });

  it("訪問月が未設定なら契約開始月をそのまま使う", () => {
    expect(resolveFacilityStartMonth(null, 7, [])).toBe(7);
  });

  it("7月開始・隔月訪問で、太陽光は通常7・1月、9月に実施したなら9・3月", () => {
    const visits = [7, 9, 11, 1, 3, 5];
    expect(generateCycleMonths(resolveFacilityStartMonth(null, 7, visits), 6)).toEqual([
      1, 7,
    ]);
    expect(generateCycleMonths(resolveFacilityStartMonth(9, 7, visits), 6)).toEqual([
      3, 9,
    ]);
  });
});

describe("monthsWithoutVisit", () => {
  it("訪問しない月だけを返す", () => {
    // 隔月訪問（奇数月）に3ヶ月周期の設備を置くと、偶数月にはみ出す
    expect(monthsWithoutVisit([7, 10, 1, 4], [7, 9, 11, 1, 3, 5])).toEqual([10, 4]);
  });

  it("訪問月が未設定なら判定しない", () => {
    expect(monthsWithoutVisit([7, 1], [])).toEqual([]);
  });
});
