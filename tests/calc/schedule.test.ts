import { describe, expect, it } from "vitest";
import {
  addMonths,
  generateCycleMonths,
  getInspectionTarget,
  isActiveInMonth,
  normalizeMonth,
  parseYearMonth,
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
