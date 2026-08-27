import type { AppDocument } from "./document";
import { parseDocument } from "./seed";

/**
 * 文書の保存先。
 * いまはブラウザのローカル保存、のちに Google ドライブへ差し替える。
 * 距離算出（lib/geo）と同じく、実装を入れ替えられるようにしておく。
 */
export interface DocumentBackend {
  readonly name: string;
  /** 保存済みの文書。まだ無ければ null */
  load(): Promise<LoadResult | null>;
  /**
   * 保存する。expectedRevision と保存先の現在の版が食い違えば
   * 上書きせず conflict を返す。
   */
  save(doc: AppDocument, expectedRevision: string | null): Promise<SaveResult>;
}

export type LoadResult = {
  doc: AppDocument;
  /** 保存先が持つ版。競合検出に使う */
  revision: string | null;
  /** 端末内の控えで開いた理由。通信不能か、サインインが切れたか */
  degraded?: "offline" | "signin";
  /** まだ送れていない変更が手元にある */
  pendingLocalChanges?: boolean;
  /** 手元とドライブの両方が進んでいる */
  conflictWithLocal?: boolean;
};

export type SaveResult =
  | { status: "saved"; revision: string | null }
  | { status: "conflict"; revision: string | null }
  /** 通信できないので送れていない。端末内には残っている */
  | { status: "offline" }
  | { status: "error"; message: string };

const STORAGE_KEY = "denki-hoan-customer-manager:document";
const REVISION_KEY = "denki-hoan-customer-manager:revision";

/**
 * ブラウザのローカル保存。ドライブ連携までのつなぎであり、
 * この実装では端末をまたいだ共有はできない。
 */
export class LocalStorageBackend implements DocumentBackend {
  readonly name = "このブラウザ";

  async load(): Promise<LoadResult | null> {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    return {
      doc: parseDocument(JSON.parse(raw)),
      revision: window.localStorage.getItem(REVISION_KEY),
    };
  }

  async save(doc: AppDocument, expectedRevision: string | null): Promise<SaveResult> {
    if (typeof window === "undefined") {
      return { status: "error", message: "ブラウザ以外では保存できません" };
    }

    const current = window.localStorage.getItem(REVISION_KEY);
    if (expectedRevision !== null && current !== null && current !== expectedRevision) {
      return { status: "conflict", revision: current };
    }

    const revision = `${Date.now()}`;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      window.localStorage.setItem(REVISION_KEY, revision);
    } catch (e) {
      return { status: "error", message: (e as Error).message };
    }
    return { status: "saved", revision };
  }
}
