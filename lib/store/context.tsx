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
import { DriveBackend } from "./drive-backend";
import { clearMirror } from "./offline";
import { GoogleAuth } from "./google-auth";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
/** 前回ドライブに繋いでいたかどうか。次回は黙って繋ぎ直す */
const DRIVE_FLAG = "denki-hoan-customer-manager:use-drive";

export type StoreStatus =
  | "loading"
  | "ready"
  | "saving"
  /** 圏外。変更は端末内に貯めてあり、繋がったら送る */
  | "offline"
  /** 通信はできるがトークンが取れない。再サインインが要る */
  | "signin"
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
  /** Google のクライアントIDが設定されているか */
  driveAvailable: boolean;
  /** いまドライブに繋がっているか */
  driveConnected: boolean;
  /** ドライブに繋ぐ。初回はファイルを作り、いまの内容を引き継ぐ */
  connectDrive: () => Promise<void>;
  disconnectDrive: () => void;
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
  const localBackend = useRef<DocumentBackend>(new LocalStorageBackend());
  const authRef = useRef<GoogleAuth | null>(null);
  const backendRef = useRef<DocumentBackend>(backend ?? localBackend.current);
  const [driveConnected, setDriveConnected] = useState(false);
  const [doc, setDoc] = useState<AppDocument>(() => createInitialDocument());
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);

  const revisionRef = useRef<string | null>(null);
  const pendingRef = useRef<AppDocument | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  /**
   * 最初の読み込みが終わるまで保存しない。
   * 読み込み前は「まっさらな初期データ」を持っているので、
   * ここで保存すると保存先を空で上書きしてしまう。
   */
  const readyRef = useRef(false);

  // 初回読み込み。前回ドライブを使っていたら、画面を出さずに繋ぎ直す
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wantsDrive =
        CLIENT_ID !== "" && window.localStorage.getItem(DRIVE_FLAG) === "1";

      if (wantsDrive) {
        // ここでトークンを取りに行かない。圏外だと必ず失敗し、
        // ドライブ接続そのものを諦めてしまうため。
        // トークンは実際に通信するときに取り、失敗したら端末内の控えで開く。
        const auth = new GoogleAuth(CLIENT_ID);
        authRef.current = auth;
        backendRef.current = new DriveBackend(auth);
        if (!cancelled) setDriveConnected(true);
      }

      try {
        const loaded = await backendRef.current.load();
        if (cancelled) return;
        if (loaded) {
          setDoc(loaded.doc);
          revisionRef.current = loaded.revision;

          readyRef.current = true;

          if (loaded.conflictWithLocal) {
            setStatus("conflict");
            setMessage(
              "オフライン中の変更と、ほかの端末での更新が競合しています。ドライブ側の内容を表示しています。",
            );
            return;
          }
          if (loaded.degraded === "signin") {
            setStatus("signin");
            setMessage(
              "Google の再サインインが必要です。表示しているのはこの端末に保存された内容です。",
            );
            return;
          }
          if (loaded.degraded === "offline") {
            setStatus("offline");
            setMessage(
              loaded.pendingLocalChanges
                ? "オフラインです。未送信の変更があります。接続が戻ると自動で送信します。"
                : "オフラインです。この端末に保存された内容を表示しています。",
            );
            return;
          }
          if (loaded.pendingLocalChanges) {
            // 圏外中の変更が残っている。すぐ送る
            pendingRef.current = loaded.doc;
            void flushRef.current?.();
          }
        }
        readyRef.current = true;
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        // 読み込めなかったときは保存も許さない。中身が分からないまま上書きしないため
        setStatus("error");
        setMessage(
          `データを読み込めませんでした: ${(e as Error).message}。` +
            "この状態では保存しません。再読み込みしてください。",
        );
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
    } else if (result.status === "offline") {
      // 端末内には残っているので、繋がったときに送り直す
      pendingRef.current = next;
      setStatus("offline");
      setMessage("オフラインです。変更はこの端末に保存され、接続が戻ったら送信します。");
    } else if (result.status === "conflict") {
      setStatus("conflict");
      setMessage(
        "保存先の内容が変わっているため、上書きせずに止めました。" +
          "読み込み直すと最新の内容になります（この端末の変更は反映されません）。",
      );
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }, []);

  // 初回読み込みの中からも呼べるようにしておく
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // 接続が戻ったら、貯めていた変更を送る
  useEffect(() => {
    const onOnline = () => {
      if (pendingRef.current) void flushRef.current?.();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const scheduleSave = useCallback(
    (next: AppDocument) => {
      if (!readyRef.current) {
        // 読み込みが終わる前の変更は捨てる。空データでの上書きを防ぐため
        console.warn("読み込みが終わるまで保存しません");
        return;
      }
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
      readyRef.current = true;
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

  /**
   * ドライブに繋ぐ。
   * 向こうにファイルがあればそれを読み込み、無ければ今の内容で作る。
   */
  const connectDrive = useCallback(async () => {
    if (!CLIENT_ID) {
      setStatus("error");
      setMessage("Google のクライアントIDが設定されていません");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const auth = authRef.current ?? new GoogleAuth(CLIENT_ID);
      const drive = new DriveBackend(auth);
      await drive.ensureSignedIn();

      const loaded = await drive.load();
      if (loaded) {
        setDoc(loaded.doc);
        revisionRef.current = loaded.revision;
      } else {
        // 初回：いま手元にある内容をそのままドライブへ移す
        const result = await drive.save(doc, null);
        if (result.status === "error") throw new Error(result.message);
        revisionRef.current =
          result.status === "saved" ? result.revision : revisionRef.current;
      }

      authRef.current = auth;
      backendRef.current = drive;
      window.localStorage.setItem(DRIVE_FLAG, "1");
      readyRef.current = true;
      setDriveConnected(true);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setMessage(`ドライブに繋げませんでした: ${(e as Error).message}`);
    }
  }, [doc]);

  const disconnectDrive = useCallback(() => {
    authRef.current?.signOut();
    authRef.current = null;
    backendRef.current = localBackend.current;
    revisionRef.current = null;
    window.localStorage.removeItem(DRIVE_FLAG);
    clearMirror();
    setDriveConnected(false);
    setStatus("ready");
    setMessage(null);
    // いまの内容を端末内保存へ引き継ぐ。そうしないと解除した瞬間に空に見える
    setDoc((current) => {
      scheduleSave(current);
      return current;
    });
  }, [scheduleSave]);

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
      backendName: driveConnected ? "Google ドライブ" : "このブラウザ",
      update,
      updateWith,
      reload,
      replace,
      driveAvailable: CLIENT_ID !== "",
      driveConnected,
      connectDrive,
      disconnectDrive,
    }),
    [
      doc,
      indexes,
      status,
      message,
      update,
      updateWith,
      reload,
      replace,
      driveConnected,
      connectDrive,
      disconnectDrive,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
