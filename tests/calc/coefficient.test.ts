import { describe, expect, it } from "vitest";
import {
  calcSecurityPoints,
  findBaseCoefficient,
} from "@/lib/calc/coefficient";
import {
  demandCoefficientRows,
  solarCoefficientRows,
  seedInspectionCycles,
} from "@/db/seed-data";

const cycle = (name: string) =>
  seedInspectionCycles.find((c) => c.name === name)!.coefficientMultiplier;

describe("findBaseCoefficient", () => {
  it("min 以上 max 未満で行を選ぶ", () => {
    expect(findBaseCoefficient(demandCoefficientRows, 210)).toBe(0.8);
    expect(findBaseCoefficient(demandCoefficientRows, 530)).toBe(1.0);
  });

  it("レンジ境界は下限側の行に含める（max は含まない）", () => {
    expect(findBaseCoefficient(demandCoefficientRows, 150)).toBe(0.8);
    expect(findBaseCoefficient(demandCoefficientRows, 349.9)).toBe(0.8);
    expect(findBaseCoefficient(demandCoefficientRows, 350)).toBe(1.0);
  });

  it("最小行は 0 から、最上位行は上限なし", () => {
    expect(findBaseCoefficient(demandCoefficientRows, 0)).toBe(0.3);
    expect(findBaseCoefficient(demandCoefficientRows, 8830)).toBe(3.0);
    expect(findBaseCoefficient(demandCoefficientRows, 99999)).toBe(3.0);
  });

  it("該当行がなければ null（太陽光は 5000kW 以上の行が未収録）", () => {
    expect(findBaseCoefficient(solarCoefficientRows, 5000)).toBeNull();
    expect(findBaseCoefficient(demandCoefficientRows, null)).toBeNull();
    expect(findBaseCoefficient(demandCoefficientRows, -1)).toBeNull();
  });
});

describe("calcSecurityPoints §4.1 検証ケース", () => {
  it("A社（サンプル） 需要設備 210kVA 隔月 → 0.48", () => {
    const r = calcSecurityPoints({
      primaryRows: demandCoefficientRows,
      primaryCapacity: 210,
      cycleMultiplier: cycle("隔月点検"),
    });
    expect(r.base).toBe(0.8);
    expect(r.multiplier).toBe(0.6);
    expect(r.points).toBe(0.48);
  });

  it("B社（サンプル） 需要設備 530kVA 隔月 → 0.60", () => {
    const r = calcSecurityPoints({
      primaryRows: demandCoefficientRows,
      primaryCapacity: 530,
      cycleMultiplier: cycle("隔月点検"),
    });
    expect(r.base).toBe(1.0);
    expect(r.points).toBe(0.6);
  });
});

describe("calcSecurityPoints その他", () => {
  it("需要設備＋太陽光は両テーブルの係数を合算する", () => {
    const r = calcSecurityPoints({
      primaryRows: demandCoefficientRows,
      primaryCapacity: 210, // 0.8
      secondaryRows: solarCoefficientRows,
      secondaryCapacity: 250, // 0.4
      cycleMultiplier: cycle("毎月点検"),
    });
    expect(r.base).toBe(1.2);
    expect(r.points).toBe(1.2);
  });

  it("換算係数の手動上書きが最優先される", () => {
    const r = calcSecurityPoints({
      primaryRows: demandCoefficientRows,
      primaryCapacity: 210,
      cycleMultiplier: cycle("隔月点検"),
      override: 0.75,
    });
    expect(r.isOverridden).toBe(true);
    expect(r.points).toBe(0.75);
  });

  it("容量がレンジ外なら点数は null", () => {
    const r = calcSecurityPoints({
      primaryRows: solarCoefficientRows,
      primaryCapacity: 6000,
      cycleMultiplier: cycle("毎月点検"),
    });
    expect(r.points).toBeNull();
  });

  it("小数第3位を四捨五入して小数第2位まで", () => {
    const r = calcSecurityPoints({
      primaryRows: demandCoefficientRows,
      primaryCapacity: 210, // 0.8
      cycleMultiplier: cycle("年1回点検"), // 0.125 → 0.1
      });
    expect(r.points).toBe(0.1);
  });
});
