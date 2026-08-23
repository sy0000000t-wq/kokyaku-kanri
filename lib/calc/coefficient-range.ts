import type { CoefficientRowLike } from "./coefficient";

export type RangeIssue = {
  level: "error" | "warning";
  message: string;
};

/**
 * §5.7 換算係数テーブルのレンジ検証。
 * 重複（オーバーラップ）と欠落（ギャップ）を保存前に警告する。
 */
export function validateCoefficientRanges(
  rows: CoefficientRowLike[],
): RangeIssue[] {
  const issues: RangeIssue[] = [];
  if (rows.length === 0) return [{ level: "warning", message: "行が1つもありません" }];

  const sorted = [...rows].sort((a, b) => a.minCapacity - b.minCapacity);

  for (const row of sorted) {
    if (row.maxCapacity != null && row.maxCapacity <= row.minCapacity) {
      issues.push({
        level: "error",
        message: `下限 ${row.minCapacity} が上限 ${row.maxCapacity} 以上になっています`,
      });
    }
  }

  if (sorted[0].minCapacity > 0) {
    issues.push({
      level: "warning",
      message: `0 から ${sorted[0].minCapacity} までの範囲に対応する行がありません`,
    });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.maxCapacity == null) {
      issues.push({
        level: "error",
        message: `上限なしの行（下限 ${current.minCapacity}）より上に行があります`,
      });
      continue;
    }
    if (current.maxCapacity > next.minCapacity) {
      issues.push({
        level: "error",
        message: `${next.minCapacity} 付近でレンジが重複しています`,
      });
    } else if (current.maxCapacity < next.minCapacity) {
      issues.push({
        level: "warning",
        message: `${current.maxCapacity} 以上 ${next.minCapacity} 未満に対応する行がありません`,
      });
    }
  }

  return issues;
}
