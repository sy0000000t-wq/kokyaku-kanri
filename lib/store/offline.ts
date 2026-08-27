import type { AppDocument } from "./document";
import { parseDocument } from "./seed";

/**
 * 端末内の控え。
 * 圏外でもアプリを開けるように、ドライブの内容をここに写しておく。
 * 未送信の変更があるかどうかもここで持つ。
 */

const MIRROR_KEY = "denki-hoan-customer-manager:mirror";
const PENDING_KEY = "denki-hoan-customer-manager:pending";
/** 控えを取ったときの、ドライブ側の版 */
const MIRROR_REVISION_KEY = "denki-hoan-customer-manager:mirror-revision";

export type Mirror = {
  doc: AppDocument;
  /** この控えの元になったドライブの版 */
  revision: string | null;
  /** まだドライブへ送れていない変更があるか */
  pending: boolean;
};

export function readMirror(): Mirror | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MIRROR_KEY);
  if (!raw) return null;
  try {
    return {
      doc: parseDocument(JSON.parse(raw)),
      revision: window.localStorage.getItem(MIRROR_REVISION_KEY),
      pending: window.localStorage.getItem(PENDING_KEY) === "1",
    };
  } catch {
    return null;
  }
}

export function writeMirror(
  doc: AppDocument,
  revision: string | null,
  pending: boolean,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(doc));
    if (revision === null) window.localStorage.removeItem(MIRROR_REVISION_KEY);
    else window.localStorage.setItem(MIRROR_REVISION_KEY, revision);
    window.localStorage.setItem(PENDING_KEY, pending ? "1" : "0");
  } catch {
    // 容量超過などは致命的ではないので握りつぶす（ドライブが正）
  }
}

export function clearMirror() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MIRROR_KEY);
  window.localStorage.removeItem(MIRROR_REVISION_KEY);
  window.localStorage.removeItem(PENDING_KEY);
}

/**
 * 通信できないことが原因の失敗かどうか。
 * オフラインなら「保存できなかった」ではなく「あとで送る」に倒したい。
 */
export function isOfflineError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = e instanceof Error ? e.message : String(e);
  return /Failed to fetch|NetworkError|Load failed|ネットワーク|ログイン用スクリプトを読み込めませんでした/i.test(
    message,
  );
}
