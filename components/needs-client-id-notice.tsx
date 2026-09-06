"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { useStore } from "@/lib/store/context";

/**
 * 接続口が無くてドライブを読めていないときの知らせ。
 *
 * この状態で空の画面を出すと「データが消えた」ようにしか見えない。
 * 何が起きているのか、データはどこにあるのか、何をすれば戻るのかを
 * 画面の先頭に出しっぱなしにする。消せないようにしてある。
 */
export function NeedsClientIdNotice() {
  const { needsClientId } = useStore();
  if (!needsClientId) return null;

  return (
    <div className="no-print border-b-2 border-danger bg-danger-soft">
      <div className="mx-auto w-full max-w-[1400px] space-y-2 px-3 py-3 sm:px-5">
        <p className="text-sm font-semibold text-danger">
          ドライブのデータを読み込めていません（データは消えていません）
        </p>
        <p className="text-xs text-ink">
          Google への接続口がこの端末に設定されていないため、ドライブに繋がっていません。
          顧客データはご自身のドライブの
          <span className="mx-1 font-mono">顧客管理データ.json</span>
          にそのまま残っています。下から接続口を設定すると元どおり表示されます。
        </p>
        <p className="text-xs text-danger">
          戻るまでは、新しく入力しないでください（ドライブ側と食い違うため、保存も止めています）。
        </p>
        <div className="flex flex-wrap gap-2 pt-0.5">
          <Link href="/settings?tab=data" className={buttonClass("default", "sm")}>
            接続口を設定する
          </Link>
          <Link href="/help?tab=setup" className={buttonClass("outline", "sm")}>
            作り方を見る
          </Link>
        </div>
      </div>
    </div>
  );
}
