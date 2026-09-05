/**
 * Google への接続口（OAuth クライアントID）。
 *
 * 端末ごとに localStorage で持つ。ドライブの文書には入れない。
 * 文書はドライブから読むもので、それを読むためにこのIDが要るため。
 *
 * 配布するビルドには埋め込まない。使う人が自分の Google Cloud で作った
 * ものを設定画面から入れる。こうすると Google との通信は必ずその人の枠を通り、
 * 配布元のプロジェクトには一切かからない。
 *
 * 手元で動かして確認するときだけ .env.local から拾う。
 */
const KEY = "denki-hoan-customer-manager:google-client-id";

/** 手元で確認するとき用。配布するビルドでは空 */
export const BUILT_IN_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function loadClientId(): string {
  if (typeof window === "undefined") return BUILT_IN_CLIENT_ID;
  try {
    return window.localStorage.getItem(KEY) || BUILT_IN_CLIENT_ID;
  } catch {
    return BUILT_IN_CLIENT_ID;
  }
}

/** この端末で使う接続口を決める。空にすると既定に戻る */
export function saveClientId(value: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = value.trim();
    if (trimmed === "") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, trimmed);
  } catch {
    // 保存できなくても、その場では使えるので黙って進む
  }
}

/** 自分のIDを入れているか（既定のままかどうか） */
export function hasOwnClientId(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(KEY);
  } catch {
    return false;
  }
}
