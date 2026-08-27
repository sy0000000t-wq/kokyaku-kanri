"use client";

import { Button } from "@/components/ui";
import { useStore } from "@/lib/store/context";

/**
 * 保存状態の表示。
 * ふだんは何も出さず、圏外・競合・エラーだけ知らせる。
 */
export function StoreStatusBar() {
  const { status, message, reload, backendName, connectDrive } = useStore();

  if (status === "ready" || status === "saving") return null;

  if (status === "loading") {
    return (
      <div className="no-print border-b border-line bg-canvas px-4 py-2 text-xs text-muted">
        データを読み込んでいます…（{backendName}）
      </div>
    );
  }

  const tone =
    status === "conflict"
      ? "border-warn/40 bg-warn-soft text-warn"
      : status === "offline"
        ? "border-brand/30 bg-brand-soft text-brand"
        : status === "signin"
          ? "border-warn/40 bg-warn-soft text-warn"
          : "border-danger/40 bg-danger-soft text-danger";

  const label =
    status === "offline"
      ? "オフライン"
      : status === "conflict"
        ? "競合"
        : status === "signin"
          ? "サインインが必要"
          : "エラー";

  return (
    <div
      className={`no-print flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs ${tone}`}
      role="status"
    >
      <span className="font-medium">{label}</span>
      <span>{message}</span>
      {status === "conflict" && (
        <Button size="sm" variant="outline" onClick={() => void reload()}>
          ドライブの内容を読み込み直す
        </Button>
      )}
      {status === "signin" && (
        <Button size="sm" variant="outline" onClick={() => void connectDrive()}>
          サインインし直す
        </Button>
      )}
    </div>
  );
}
