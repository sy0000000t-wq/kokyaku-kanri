import { describe, expect, it } from "vitest";
import { validateCoefficientRanges } from "@/lib/calc/coefficient-range";
import { demandCoefficientRows, solarCoefficientRows } from "@/db/seed-data";

describe("validateCoefficientRanges §5.7", () => {
  it("初期データ（需要設備）は指摘なし", () => {
    expect(validateCoefficientRanges(demandCoefficientRows)).toEqual([]);
  });

  it("初期データ（太陽光）は指摘なし。5000kW 以上が無いのは上限なし行が無いだけ", () => {
    expect(validateCoefficientRanges(solarCoefficientRows)).toEqual([]);
  });

  it("重複を検出する", () => {
    const issues = validateCoefficientRanges([
      { minCapacity: 0, maxCapacity: 100, coefficient: 0.3 },
      { minCapacity: 50, maxCapacity: 200, coefficient: 0.4 },
    ]);
    expect(issues.some((i) => i.level === "error" && i.message.includes("重複"))).toBe(true);
  });

  it("欠落を検出する", () => {
    const issues = validateCoefficientRanges([
      { minCapacity: 0, maxCapacity: 100, coefficient: 0.3 },
      { minCapacity: 150, maxCapacity: 200, coefficient: 0.4 },
    ]);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("対応する行がありません"))).toBe(true);
  });

  it("0 から始まっていなければ警告する", () => {
    const issues = validateCoefficientRanges([
      { minCapacity: 10, maxCapacity: 100, coefficient: 0.3 },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe("warning");
  });

  it("上下限が逆転した行はエラー", () => {
    const issues = validateCoefficientRanges([
      { minCapacity: 100, maxCapacity: 50, coefficient: 0.3 },
    ]);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("上限なしの行が最上位でなければエラー", () => {
    const issues = validateCoefficientRanges([
      { minCapacity: 0, maxCapacity: null, coefficient: 0.3 },
      { minCapacity: 100, maxCapacity: 200, coefficient: 0.4 },
    ]);
    expect(issues.some((i) => i.level === "error" && i.message.includes("上限なし"))).toBe(true);
  });

  it("行が無ければ警告", () => {
    expect(validateCoefficientRanges([])).toHaveLength(1);
  });
});
