"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppDocument } from "./document";
import { createInitialDocument } from "./seed";
import { buildIndexes, type Indexes } from "./selectors";
import {
  LocalStorageBackend,
  type DocumentBackend,
  type SaveResult,
} from "./backend";

export type StoreStatus =
  | "loading"
  | "ready"
  | "saving"
  | "conflict"
  | "error";

type StoreValue = {
  doc: AppDocument;
  indexes: Indexes;
  status: StoreStatus;
  message: string | null;
  /** 保存先の表示名 */
  backendName: string;
  /** 文書を書き換えて保存する */
  update: (fn: (doc: AppDocument) => AppDocument) => void;
  /** 書き換えた結果を使いたい場合（採番した ID を知りたいときなど） */
  updateWith: <T>(fn: (doc: AppDocument) => { doc: AppDocument; result: T }) => T;
  /** 保存先から読み直す（競合を解消するとき） */
  reload: () => Promise<void>;
  /** 文書を丸ごと差し替える（インポート） */
  replace: (doc: AppDocument) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("StoreProvider の中で使ってください");
  return value;
}

/** 保存はまとめて行う。連続操作のたびに書き込まない */
const SAVE_DEBOUNCE_MS = 600;

export function StoreProvider({
  children,
  backend,
}: {
  children: React.ReactNode;
  backend?: DocumentBackend;
}) {
  const backendRef = useRef<DocumentBackend>(backend ?? new LocalStorageBackend());
  const [doc, setDoc] = useState<AppDocument>(() => createInitialDocument());
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);

  const revisionRef = useRef<string | null>(null);
  const pendingRef = useRef<AppDocument | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初回読み込み
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await backendRef.current.load();
        if (cancelled) return;
        if (loaded) {
          setDoc(loaded.doc);
          revisionRef.current = loaded.revision;
        }
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setMessage(`データを読み込めませんでした: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(async () => {
    const next = pendingRef.current;
    if (!next) return;
    pendingRef.current = null;

    setStatus("saving");
    let result: SaveResult;
    try {
      result = await backendRef.current.save(next, revisionRef.current);
    } catch (e) {
      setStatus("error");
      setMessage(`保存できませんでした: ${(e as Error).message}`);
      return;
    }

    if (result.status === "saved") {
      revisionRef.current = result.revision;
      setStatus("ready");
      setMessage(null);
    } else if (result.status === "conflict") {
      setStatus("conflict");
      setMessage(
        "ほかの端末で更新されています。読み込み直すまで、この端末の変更は保存されません。",
      );
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }, []);

  const scheduleSave = useCallback(
    (next: AppDocument) => {
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const update = useCallback(
    (fn: (doc: AppDocument) => AppDocument) => {
      setDoc((prev) => {
        const next = fn(prev);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const updateWith = useCallback(
    <T,>(fn: (doc: AppDocument) => { doc: AppDocument; result: T }): T => {
      let captured!: T;
      setDoc((prev) => {
        const { doc: next, result } = fn(prev);
        captured = result;
        scheduleSave(next);
        return next;
      });
      return captured;
    },
    [scheduleSave],
  );

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const loaded = await backendRef.current.load();
      if (loaded) {
        setDoc(loaded.doc);
        revisionRef.current = loaded.revision;
      }
      pendingRef.current = null;
      setStatus("ready");
      setMessage(null);
    } catch (e) {
      setStatus("error");
      setMessage(`読み込めませんでした: ${(e as Error).message}`);
    }
  }, []);

  const replace = useCallback(
    (next: AppDocument) => {
      setDoc(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  // 未保存のまま離脱しないようにする
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const indexes = useMemo(() => buildIndexes(doc), [doc]);

  const value = useMemo<StoreValue>(
    () => ({
      doc,
      indexes,
      status,
      message,
      backendName: backendRef.current.name,
      update,
      updateWith,
      reload,
      replace,
    }),
    [doc, indexes, status, message, update, updateWith, reload, replace],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
