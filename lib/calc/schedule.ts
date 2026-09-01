export type YearMonth = { year: number; month: number };

/** 1〜12 に正規化する（0 → 12、13 → 1） */
export function normalizeMonth(month: number): number {
  const m = ((month - 1) % 12 + 12) % 12;
  return m + 1;
}

export function addMonths(ym: YearMonth, months: number): YearMonth {
  const total = ym.year * 12 + (ym.month - 1) + months;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** "YYYY-MM-DD" → YearMonth。不正な値は null */
export function parseYearMonth(date: string | null | undefined): YearMonth | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * §3.7 契約開始月を起点に interval_months ごとに加算し、1〜12 に正規化した
 * 実施月の集合を返す。1周して既出の月に戻った時点で打ち切る。
 * 例）3月開始・隔月 → [1,3,5,7,9,11]（＝奇数月・6件）
 *     3月開始・3ヶ月 → [3,6,9,12]
 *     3月開始・年1回 → [3]
 * interval_months が 0（実施なし）のときは空配列。
 */
export function generateCycleMonths(
  startMonth: number,
  intervalMonths: number,
): number[] {
  if (!Number.isFinite(intervalMonths) || intervalMonths <= 0) return [];
  if (intervalMonths >= 12) return [normalizeMonth(startMonth)];

  const months = new Set<number>();
  let cursor = normalizeMonth(startMonth);
  // 最大 12 回で必ず既出に戻る
  for (let i = 0; i < 12; i++) {
    if (months.has(cursor)) break;
    months.add(cursor);
    cursor = normalizeMonth(cursor + intervalMonths);
  }
  return [...months].sort((a, b) => a - b);
}

/**
 * 設備の点検を始める月を決める。
 * 明示指定があればそれを使い、無ければ契約開始月以降で最初に訪問する月に合わせる。
 * 訪問月が未設定なら契約開始月そのもの。
 */
export function resolveFacilityStartMonth(
  explicit: number | null | undefined,
  contractStartMonth: number,
  inspectionMonths: number[],
): number {
  if (explicit != null && explicit >= 1 && explicit <= 12) return normalizeMonth(explicit);

  const start = normalizeMonth(contractStartMonth);
  if (inspectionMonths.length === 0) return start;

  // 契約開始月から数えて最初に来る訪問月（見つからなければ契約開始月）
  for (let i = 0; i < 12; i++) {
    const m = normalizeMonth(start + i);
    if (inspectionMonths.includes(m)) return m;
  }
  return start;
}

/**
 * 設備の点検月のうち、現場に行かない月。
 * 訪問と噛み合っていない設定を画面で知らせるために使う。
 */
export function monthsWithoutVisit(
  facilityMonths: number[],
  inspectionMonths: number[],
): number[] {
  if (inspectionMonths.length === 0) return [];
  return facilityMonths.filter((m) => !inspectionMonths.includes(m));
}

export type ContractLike = {
  isActive: number | boolean;
  contractStartDate: string;
  contractEndDate: string | null;
};

/**
 * §4.4 稼働条件。
 * is_active = 1 かつ 契約開始日 <= 対象月の月末 かつ
 * （解除日が未設定 または 解除日 >= 対象月の月初）
 */
export function isActiveInMonth(
  customer: ContractLike,
  target: YearMonth,
): boolean {
  if (!customer.isActive) return false;

  const start = parseYearMonth(customer.contractStartDate);
  if (!start) return false;
  // 契約開始日 <= 対象月の月末 ⇔ 開始年月 <= 対象年月
  if (compareYearMonth(start, target) > 0) return false;

  const end = parseYearMonth(customer.contractEndDate);
  // 解除日 >= 対象月の月初 ⇔ 解除年月 >= 対象年月
  if (end && compareYearMonth(end, target) < 0) return false;

  return true;
}

export type InspectionTargetInput = ContractLike & {
  /** customer_inspection_months の内容（最終的な正） */
  inspectionMonths: number[];
  annualInspectionMonth: number | null;
};

export type InspectionTarget = {
  regular: boolean;
  annual: boolean;
};

/** §4.4 対象年月における点検対象の判定 */
export function getInspectionTarget(
  customer: InspectionTargetInput,
  target: YearMonth,
): InspectionTarget {
  if (!isActiveInMonth(customer, target)) {
    return { regular: false, annual: false };
  }
  return {
    regular: customer.inspectionMonths.includes(target.month),
    annual: customer.annualInspectionMonth === target.month,
  };
}

/** §4.4 年間マトリクスの表示記号 */
export function scheduleSymbol(target: InspectionTarget): string {
  if (target.regular && target.annual) return "●★";
  if (target.regular) return "●";
  if (target.annual) return "★";
  return "−";
}
