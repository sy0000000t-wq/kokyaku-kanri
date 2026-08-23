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

export type SecurityPointsInput = {
  /** 需要設備側のテーブル行（kVA）。使わない種別では空配列 */
  primaryRows: CoefficientRowLike[];
  primaryCapacity: number | null;
  /** 太陽光・蓄電所側のテーブル行（kW）。「需要設備＋太陽光」で合算に使う */
  secondaryRows?: CoefficientRowLike[];
  secondaryCapacity?: number | null;
  /** 点検周期の倍率 */
  cycleMultiplier: number;
  /** 手動上書き。設定されていればこれを採用する */
  override?: number | null;
};

export type SecurityPointsResult = {
  /** 周期倍率を掛ける前の基準換算係数（合算後） */
  base: number | null;
  multiplier: number;
  /** 保安管理点数（小数第2位） */
  points: number | null;
  isOverridden: boolean;
};

/**
 * §4.1 換算係数の算出。
 * 1. override があればそれを採用して終了
 * 2-3. 容量からテーブル行の係数を引く（＋太陽光は合算）
 * 4. 点検周期の倍率を掛ける
 * 5. 小数第3位を四捨五入して小数第2位まで
 */
export function calcSecurityPoints(
  input: SecurityPointsInput,
): SecurityPointsResult {
  const multiplier = input.cycleMultiplier;

  if (input.override != null && Number.isFinite(input.override)) {
    return {
      base: null,
      multiplier,
      points: roundPoints(input.override),
      isOverridden: true,
    };
  }

  const primary = findBaseCoefficient(input.primaryRows, input.primaryCapacity);
  const secondary =
    input.secondaryRows && input.secondaryRows.length > 0
      ? findBaseCoefficient(input.secondaryRows, input.secondaryCapacity)
      : null;

  if (primary == null && secondary == null) {
    return { base: null, multiplier, points: null, isOverridden: false };
  }

  const base = roundPoints((primary ?? 0) + (secondary ?? 0));
  return {
    base,
    multiplier,
    points: roundPoints(base * multiplier),
    isOverridden: false,
  };
}
