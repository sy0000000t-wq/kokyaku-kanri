"use client";

import { Button } from "@/components/ui";
import { useStore } from "@/lib/store/context";

/**
 * 保存状態の表示。
 * ふだんは何も出さず、圏外・競合・要サインイン・エラーだけ知らせる。
 * 競合したときは、どちらを残すかを必ず利用者に選んでもらう（勝手に捨てない）。
 */
export function StoreStatusBar() {
  const {
    status,
    message,
    backendName,
    connectDrive,
    takeRemote,
    keepLocal,
    hasPendingChanges,
  } = useStore();

  if (status === "ready" || status === "saving") return null;

  if (status === "loading") {
    return (
      <div className="no-print border-b border-line bg-canvas px-4 py-2 text-xs text-muted">
        データを読み込んでいます…（{backendName}）
      </div>
    );
  }

  const tone =
    status === "conflict" || status === "signin"
      ? "border-warn/40 bg-warn-soft text-warn"
      : status === "offline"
        ? "border-brand/30 bg-brand-soft text-brand"
        : "border-danger/40 bg-danger-soft text-danger";

  const label =
    status === "offline"
      ? "オフライン"
      : status === "conflict"
        ? "どちらを残しますか"
        : status === "signin"
          ? "サインインが必要"
          : "エラー";

  return (
    <div
      className={`no-print flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-xs ${tone}`}
      role="status"
    >
      <span className="font-medium whitespace-nowrap">{label}</span>
      <span className="flex-1 min-w-40">{message}</span>

      {status === "conflict" && (
        <span className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void keepLocal()}>
            この端末の変更を送る
          </Button>
          <Button size="sm" variant="outline" onClick={() => void takeRemote()}>
            ドライブの内容を取り込む
          </Button>
        </span>
      )}

      {status === "signin" && (
        <Button size="sm" variant="outline" onClick={() => void connectDrive()}>
          サインインし直す
        </Button>
      )}

      {status === "error" && hasPendingChanges && (
        <Button size="sm" variant="outline" onClick={() => void connectDrive()}>
          もう一度送る
        </Button>
      )}

      {(status === "offline" || status === "error") && hasPendingChanges && (
        <span className="whitespace-nowrap opacity-80">未送信の変更があります</span>
      )}
    </div>
  );
}
