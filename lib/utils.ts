import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const yen = new Intl.NumberFormat("ja-JP");

/** 3桁区切り（§9 日本語ロケール） */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return yen.format(value);
}

/** 円表示 */
export function formatYen(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `¥${yen.format(value)}`;
}

/** 保安管理点数（小数第2位固定） */
export function formatPoints(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

/** 距離（小数第1位） */
export function formatKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} km`;
}

/** 2026年8月 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}年${month}月`;
}

/** 2026/08/23 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

/** 今日の YYYY-MM-DD（ローカル時刻） */
export function todayIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** カンマ区切りの電話番号を配列にする */
export function splitPhones(phone: string | null | undefined): string[] {
  if (!phone) return [];
  return phone
    .split(/[,、\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** tel: リンク用に記号を落とす */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
