"use client";

import { Button } from "@/components/ui";
import { useStore } from "@/lib/store/context";

/**
 * 保存状態の表示。
 * ふだんは何も出さず、競合・エラー・読み込み中だけ知らせる。
 */
export function StoreStatusBar() {
  const { status, message, reload, backendName } = useStore();

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
      : "border-danger/40 bg-danger-soft text-danger";

  return (
    <div className={`no-print flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs ${tone}`}>
      <span>{message}</span>
      {status === "conflict" && (
        <Button size="sm" variant="outline" onClick={() => void reload()}>
          読み込み直す
        </Button>
      )}
    </div>
  );
}
