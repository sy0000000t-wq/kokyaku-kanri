import type { YearMonth } from "@/lib/calc/schedule";

/** URL の ?y=&m= から対象年月を決める。未指定なら今日 */
export function resolvePeriod(
  params: { y?: string; m?: string },
  now = new Date(),
): YearMonth {
  const year = Number(params.y);
  const month = Number(params.m);
  return {
    year: Number.isInteger(year) && year > 1900 && year < 2999 ? year : now.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };
}

export function resolveYear(params: { y?: string }, now = new Date()): number {
  const year = Number(params.y);
  return Number.isInteger(year) && year > 1900 && year < 2999
    ? year
    : now.getFullYear();
}

export function periodHref(base: string, ym: YearMonth, extra?: Record<string, string | undefined>) {
  const sp = new URLSearchParams({ y: String(ym.year), m: String(ym.month) });
  for (const [k, v] of Object.entries(extra ?? {})) if (v) sp.set(k, v);
  return `${base}?${sp.toString()}`;
}
