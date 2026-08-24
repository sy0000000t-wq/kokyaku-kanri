import { describe, expect, it } from "vitest";
import {
  calcFacilityPoints,
  calcSitePoints,
  findBaseCoefficient,
  type CategoryLike,
  type FacilityPointsInput,
} from "@/lib/calc/coefficient";
import {
  demandCoefficientRows,
  solarCoefficientRows,
  seedEquipmentCategories,
  COEFFICIENT_TABLE_DEMAND,
  COEFFICIENT_TABLE_SOLAR,
} from "@/db/seed-data";

/** シードの設備区分を、計算関数が受け取る形に組み立てる */
function category(name: string): CategoryLike {
  const seed = seedEquipmentCategories.find((c) => c.name === name);
  if (!seed) throw new Error(`設備区分が見つかりません: ${name}`);
  const rows =
    seed.table === COEFFICIENT_TABLE_DEMAND
      ? demandCoefficientRows
      : seed.table === COEFFICIENT_TABLE_SOLAR
        ? solarCoefficientRows
        : [];
  return {
    calculationMethod: seed.calculationMethod,
    capacityUnit: seed.capacityUnit,
    rows,
    minCapacity: seed.minCapacity ?? null,
    maxCapacity: seed.maxCapacity ?? null,
  };
}

function facility(
  categoryName: string,
  cycleName: string,
  capacity: number | null = null,
  coefficientOverride: number | null = null,
): FacilityPointsInput {
  const seed = seedEquipmentCategories.find((c) => c.name === categoryName)!;
  const cycle = seed.cycles.find((c) => c.name === cycleName);
  if (!cycle) throw new Error(`周期が見つかりません: ${categoryName} / ${cycleName}`);
  return {
    category: category(categoryName),
    cycle: {
      intervalMonths: cycle.intervalMonths,
      multiplier: cycle.multiplier ?? null,
      fixedPoints: cycle.fixedPoints ?? null,
    },
    capacity,
    coefficientOverride,
  };
}

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

describe("換算値算出フロー図：需要設備", () => {
  it("低圧は固定点数（月1回 0.3 / 2ヶ月 0.18）", () => {
    expect(facilityPoints("需要設備（低圧）", "月1回")).toBe(0.3);
    expect(facilityPoints("需要設備（低圧）", "2ヶ月に1回")).toBe(0.18);
  });

  it("64kVA未満の小規模高圧設備は 3ヶ月に1回 0.2 点で固定（容量によらない）", () => {
    expect(
      facilityPoints("需要設備（高圧・64kVA未満・小規模高圧設備）", "3ヶ月に1回", 50),
    ).toBe(0.2);
    // 容量を変えても点数は変わらない
    expect(
      facilityPoints("需要設備（高圧・64kVA未満・小規模高圧設備）", "3ヶ月に1回", 10),
    ).toBe(0.2);
  });

  it("小規模高圧設備の 3ヶ月点検は絶縁監視装置が必須", () => {
    const seed = seedEquipmentCategories.find(
      (c) => c.name === "需要設備（高圧・64kVA未満・小規模高圧設備）",
    )!;
    expect(seed.cycles[0].requiresInsulationMonitor).toBe(true);
  });

  it("64kVA未満・非常用予備発電設備あり（月1回 0.4 / 2ヶ月 0.24）", () => {
    const name = "需要設備（高圧・64kVA未満・非常用予備発電設備あり）";
    expect(facilityPoints(name, "月1回", 40)).toBe(0.4);
    expect(facilityPoints(name, "2ヶ月に1回", 40)).toBe(0.24);
  });

  it("64kVA以上100kVA以下（月1回 0.6 / 2ヶ月 0.36 / 3ヶ月 0.27）", () => {
    const name = "需要設備（高圧・64kVA以上100kVA以下）";
    expect(facilityPoints(name, "月1回", 80)).toBe(0.6);
    expect(facilityPoints(name, "2ヶ月に1回", 80)).toBe(0.36);
    expect(facilityPoints(name, "3ヶ月に1回", 80)).toBe(0.27);
  });

  it("100kVA超過は係数表 × 倍率（月1回 1.0 / 2ヶ月 0.6）", () => {
    const name = "需要設備（高圧・100kVA超過）";
    expect(facilityPoints(name, "月1回", 210)).toBe(0.8);
    expect(facilityPoints(name, "2ヶ月に1回", 210)).toBe(0.48);
    expect(facilityPoints(name, "2ヶ月に1回", 530)).toBe(0.6);
  });

  it("EV専用充電設備（月1回 0.40 / 2ヶ月 0.24）", () => {
    const name = "EV専用充電設備（1000kVA未満）";
    expect(facilityPoints(name, "月1回", 500)).toBe(0.4);
    expect(facilityPoints(name, "2ヶ月に1回", 500)).toBe(0.24);
  });
});

describe("換算値算出フロー図：発電所等", () => {
  it("火力（ディーゼル・ガスタービン等）は月1回 ×1.0 / 3ヶ月 ×0.45", () => {
    const name = "火力発電所（ディーゼル・ガスタービン等）";
    expect(facilityPoints(name, "月1回", 80)).toBe(0.3);
    expect(facilityPoints(name, "3ヶ月に1回", 80)).toBe(0.135);
  });

  it("太陽光・自家消費は 6ヶ月に1回 ×0.25", () => {
    expect(facilityPoints("太陽電池発電所（自家消費）", "6ヶ月に1回", 80)).toBe(0.075);
  });

  it("太陽光・全量売電は 2/3/4/6ヶ月で 0.36 / 0.33 / 0.32 / 0.31", () => {
    const name = "太陽電池発電所（全量売電）";
    expect(facilityPoints(name, "2ヶ月に1回", 100)).toBe(0.144);
    expect(facilityPoints(name, "3ヶ月に1回", 100)).toBe(0.132);
    expect(facilityPoints(name, "4ヶ月に1回", 100)).toBe(0.128);
    expect(facilityPoints(name, "6ヶ月に1回", 100)).toBe(0.124);
  });

  it("配電線路のみは 0.1 点で固定", () => {
    expect(facilityPoints("配電線路のみ", "（周期によらず固定）")).toBe(0.1);
  });
});

describe("換算値算出フロー図：参考例（併設の事業場は合算する）", () => {
  it("参考例1：需要設備300kVA 2ヶ月 + 太陽光80kW 自家消費 6ヶ月 = 0.555 点", () => {
    const site = calcSitePoints([
      facility("需要設備（高圧・100kVA超過）", "2ヶ月に1回", 300),
      facility("太陽電池発電所（自家消費）", "6ヶ月に1回", 80),
    ]);
    expect(site.facilities[0].points).toBe(0.48); // 0.8 × 0.6
    expect(site.facilities[1].points).toBe(0.075); // 0.3 × 0.25
    expect(site.total).toBe(0.555);
  });

  it("参考例2：需要設備550kVA + ディーゼル80kW + 太陽光100kW全量売電 = 1.152 点", () => {
    const site = calcSitePoints([
      facility("需要設備（高圧・100kVA超過）", "2ヶ月に1回", 550),
      facility("火力発電所（ディーゼル・ガスタービン等）", "月1回", 80),
      facility("太陽電池発電所（全量売電）", "3ヶ月に1回", 100),
    ]);
    expect(site.facilities[0].points).toBe(0.72); // 1.2 × 0.6
    expect(site.facilities[1].points).toBe(0.3);
    expect(site.facilities[2].points).toBe(0.132); // 0.4 × 0.33
    expect(site.total).toBe(1.152);
  });
});

describe("既存シートとの一致（仕様書 §4.1）", () => {
  it("A社（サンプル） 需要設備 210kVA 隔月 → 0.48", () => {
    expect(facilityPoints("需要設備（高圧・100kVA超過）", "2ヶ月に1回", 210)).toBe(0.48);
  });

  it("B社（サンプル） 需要設備 530kVA 隔月 → 0.60", () => {
    expect(facilityPoints("需要設備（高圧・100kVA超過）", "2ヶ月に1回", 530)).toBe(0.6);
  });
});

describe("換算係数の手動指定", () => {
  it("table 方式では容量判定より手動指定を優先する", () => {
    const r = calcFacilityPoints(
      facility("需要設備（高圧・100kVA超過）", "2ヶ月に1回", 210, 1.0),
    );
    expect(r.isOverridden).toBe(true);
    expect(r.base).toBe(1.0);
    expect(r.points).toBe(0.6);
  });

  it("容量が未入力でも手動指定があれば算出できる", () => {
    const r = calcFacilityPoints(
      facility("需要設備（高圧・100kVA超過）", "月1回", null, 1.4),
    );
    expect(r.points).toBe(1.4);
  });

  it("fixed 方式は手動指定を受け付けない（固定点数のまま）", () => {
    const r = calcFacilityPoints(facility("需要設備（低圧）", "月1回", null, 0.9));
    expect(r.points).toBe(0.3);
  });
});

describe("算出できないケース", () => {
  it("容量がレンジ外なら点数は null", () => {
    const r = calcFacilityPoints(
      facility("太陽電池発電所（全量売電）", "2ヶ月に1回", 6000),
    );
    expect(r.points).toBeNull();
  });

  it("1つでも算出できない設備があれば合計も null", () => {
    const site = calcSitePoints([
      facility("需要設備（高圧・100kVA超過）", "月1回", 210),
      facility("太陽電池発電所（全量売電）", "2ヶ月に1回", 6000),
    ]);
    expect(site.total).toBeNull();
    expect(site.unresolvedIndexes).toEqual([1]);
  });

  it("設備が1つも無ければ合計は null", () => {
    expect(calcSitePoints([]).total).toBeNull();
  });

  it("区分の適用容量から外れていると警告フラグが立つ", () => {
    const r = calcFacilityPoints(
      facility("需要設備（高圧・64kVA以上100kVA以下）", "月1回", 150),
    );
    expect(r.capacityOutOfRange).toBe(true);
    // 固定点数なので値自体は出る
    expect(r.points).toBe(0.6);
  });
});

function facilityPoints(
  categoryName: string,
  cycleName: string,
  capacity: number | null = null,
): number | null {
  return calcFacilityPoints(facility(categoryName, cycleName, capacity)).points;
}
