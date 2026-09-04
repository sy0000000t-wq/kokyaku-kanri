import { roundPoints } from "./round";

export type CoefficientRowLike = {
  minCapacity: number;
  /** NULL は上限なし */
  maxCapacity: number | null;
  coefficient: number;
};

/**
 * 容量が min_capacity <= capacity < max_capacity を満たす行の係数を返す。
 * 該当行がなければ null（呼び出し側で警告を出す）。
 */
export function findBaseCoefficient(
  rows: CoefficientRowLike[],
  capacity: number | null | undefined,
): number | null {
  if (capacity == null || !Number.isFinite(capacity) || capacity < 0) return null;
  const hit = rows.find(
    (r) =>
      capacity >= r.minCapacity &&
      (r.maxCapacity == null || capacity < r.maxCapacity),
  );
  return hit ? hit.coefficient : null;
}

/** 設備区分（換算値算出フロー図の分岐） */
export type CategoryLike = {
  calculationMethod: "table" | "fixed" | "excluded";
  capacityUnit: "kVA" | "kW" | "none";
  /** calculationMethod = "table" のときに引く係数表の行 */
  rows?: CoefficientRowLike[];
  minCapacity?: number | null;
  maxCapacity?: number | null;
};

/** 設備区分に紐づく点検周期と、その周期での補正 */
export type CategoryCycleLike = {
  intervalMonths: number;
  /** table 方式：係数に掛ける倍率 */
  multiplier?: number | null;
  /** fixed 方式：容量によらず使う固定点数 */
  fixedPoints?: number | null;
};

export type FacilityPointsInput = {
  category: CategoryLike;
  cycle: CategoryCycleLike;
  capacity: number | null;
  /** 換算係数（基準値）の手動指定。table 方式のとき容量判定より優先する */
  coefficientOverride?: number | null;
};

export type FacilityPointsResult = {
  /** 補正前の基準換算係数。fixed 方式では固定点数そのもの */
  base: number | null;
  /** table 方式の倍率。fixed 方式では null */
  multiplier: number | null;
  /** この設備の保安管理点数 */
  points: number | null;
  isOverridden: boolean;
  /** 容量が区分の適用範囲から外れている */
  capacityOutOfRange: boolean;
};

/**
 * 設備1台の保安管理点数。
 *
 * - fixed 方式：周期ごとの固定点数をそのまま使う
 *   （低圧、64kVA未満、64〜100kVA、EV充電設備、配電線路のみ）
 * - excluded 方式：換算係数を適用せず 0 点（年次請けなど、保安管理点数に入らないもの）
 * - table 方式：係数表から基準係数を引き、周期ごとの倍率を掛ける
 *   （100kVA超過、火力、太陽光、蓄電所）
 *
 * 出典：換算値算出フロー図（2025-01-09）
 */
export function calcFacilityPoints(
  input: FacilityPointsInput,
): FacilityPointsResult {
  const { category, cycle } = input;

  const capacityOutOfRange =
    category.capacityUnit !== "none" &&
    input.capacity != null &&
    ((category.minCapacity != null && input.capacity < category.minCapacity) ||
      (category.maxCapacity != null && input.capacity > category.maxCapacity));

  // 換算係数の対象外。点数を持たないので合算しても総点数は変わらない
  if (category.calculationMethod === "excluded") {
    return {
      base: null,
      multiplier: null,
      points: 0,
      isOverridden: false,
      capacityOutOfRange: false,
    };
  }

  if (category.calculationMethod === "fixed") {
    const fixed = cycle.fixedPoints;
    if (fixed == null || !Number.isFinite(fixed)) {
      return {
        base: null,
        multiplier: null,
        points: null,
        isOverridden: false,
        capacityOutOfRange,
      };
    }
    return {
      base: fixed,
      multiplier: null,
      points: roundPoints(fixed),
      isOverridden: false,
      capacityOutOfRange,
    };
  }

  const multiplier = cycle.multiplier ?? 1;
  const isOverridden =
    input.coefficientOverride != null &&
    Number.isFinite(input.coefficientOverride);

  const base = isOverridden
    ? input.coefficientOverride!
    : findBaseCoefficient(category.rows ?? [], input.capacity);

  if (base == null) {
    return {
      base: null,
      multiplier,
      points: null,
      isOverridden,
      capacityOutOfRange,
    };
  }

  return {
    base,
    multiplier,
    points: roundPoints(base * multiplier),
    isOverridden,
    capacityOutOfRange,
  };
}

export type SitePointsResult = {
  facilities: FacilityPointsResult[];
  /** 事業場の合計点数。1つでも算出できない設備があれば null */
  total: number | null;
  /** 算出できなかった設備の位置 */
  unresolvedIndexes: number[];
};

/**
 * 事業場（1顧客）の保安管理点数。設備ごとに算出して合算する。
 * 例）需要設備300kVA 2ヶ月 0.48 + 太陽光80kW自家消費 6ヶ月 0.075 = 0.555
 */
export function calcSitePoints(
  facilities: FacilityPointsInput[],
): SitePointsResult {
  const results = facilities.map(calcFacilityPoints);
  const unresolvedIndexes = results
    .map((r, i) => (r.points == null ? i : -1))
    .filter((i) => i >= 0);

  if (results.length === 0) {
    return { facilities: results, total: null, unresolvedIndexes };
  }

  const sum = results.reduce((acc, r) => acc + (r.points ?? 0), 0);
  return {
    facilities: results,
    total: unresolvedIndexes.length > 0 ? null : roundPoints(sum),
    unresolvedIndexes,
  };
}
