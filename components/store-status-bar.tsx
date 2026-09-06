"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
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

  // どちらを選んでも片方は消える。押す前に必ず一度止める
  const [asking, setAsking] = useState<"local" | "remote" | null>(null);

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
          <Button size="sm" onClick={() => setAsking("local")}>
            この端末の変更を送る
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAsking("remote")}>
            ドライブの内容を取り込む
          </Button>
        </span>
      )}

      <ConfirmDialog
        open={asking === "local"}
        title="この端末の変更をドライブに送りますか？"
        danger="ドライブにある内容は、この端末の内容で上書きされます。ほかの端末で入れた分は消えます。"
        detail={
          <>
            <p>
              この端末で開いている内容が正しいときだけ選んでください。
              画面に顧客が出ていない、件数が少ないなど、心当たりがあるときは選ばないでください。
            </p>
            <p className="mt-1.5">
              迷ったら「いいえ」を押し、先に
              <span className="mx-1 font-medium">設定 → データ管理 → JSON 一括エクスポート</span>
              で控えを取ってください。
            </p>
          </>
        }
        confirmLabel="はい、この端末の内容で上書きする"
        onConfirm={() => {
          setAsking(null);
          void keepLocal();
        }}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "remote"}
        title="ドライブの内容を取り込みますか？"
        danger="この端末でまだ送れていない変更は捨てられます。"
        detail={
          <>
            <p>
              ドライブにある内容で置き換えます。ほかの端末で入れた分を取り込みたいときは、
              こちらを選びます。
            </p>
            <p className="mt-1.5">
              この端末で入力したばかりの内容があるなら、先に控えを取ってから選んでください。
            </p>
          </>
        }
        confirmLabel="はい、ドライブの内容にする"
        onConfirm={() => {
          setAsking(null);
          void takeRemote();
        }}
        onCancel={() => setAsking(null)}
      />

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
