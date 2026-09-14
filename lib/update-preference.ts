/**
 * 更新を受け取るかどうかの控え（端末ごと）。
 *
 * 新しい版が出ても、都合の悪いときや、いまの版で十分なときがある。
 * 押すまで古い版のまま使えるようにし、「この版のまま使う」を選んだら
 * その版についてはもう知らせない。
 */
const SKIP_KEY = "denki-hoan-customer-manager:skip-version";
const SNOOZE_KEY = "denki-hoan-customer-manager:update-snooze-until";

/** 「あとで」を押してから、次に知らせるまで */
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 保存できなくても、その場の操作は通す
  }
}

/** この版は見送る、と決めた版 */
export function skippedVersion(): string | null {
  return read(SKIP_KEY);
}

export function skipVersion(version: string): void {
  write(SKIP_KEY, version);
}

/** 見送りをやめて、また知らせてもらう */
export function clearSkip(): void {
  write(SKIP_KEY, null);
  write(SNOOZE_KEY, null);
}

export function snooze(now = Date.now()): void {
  write(SNOOZE_KEY, String(now + SNOOZE_MS));
}

export function isSnoozed(now = Date.now()): boolean {
  const until = Number(read(SNOOZE_KEY));
  return Number.isFinite(until) && until > now;
}

/** "V1.16" → [1, 16]。読めなければ null */
function parseVersion(version: string): number[] | null {
  const m = /^V?(\d+)\.(\d+)$/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * latest が current より新しいか。
 * 小数点以下は 10 進の小数ではなく通し番号なので、V1.10 は V1.9 より新しい。
 */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return latest !== current;
  return a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1];
}

/** その版を知らせるべきか */
export function shouldNotify(latest: string, current: string, now = Date.now()): boolean {
  // 公開側の控えが古いまま残っていることがあるので、新しいときだけ知らせる
  if (!isNewer(latest, current)) return false;
  if (skippedVersion() === latest) return false;
  return !isSnoozed(now);
}
