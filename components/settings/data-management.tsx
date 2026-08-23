"use client";

import { useActionState } from "react";
import { importJson, type ImportState } from "@/app/actions/data";
import { Button, buttonClass, Card, CardHeader, Input } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

const initial: ImportState = { status: "idle" };

/** 6. データ管理 */
export function DataManagement({
  backups,
  dbPath,
}: {
  backups: { file: string; size: number; mtime: string }[];
  dbPath: string;
}) {
  const [state, action, pending] = useActionState(importJson, initial);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="エクスポート" description="ブラウザにダウンロードされます" />
        <div className="flex flex-wrap gap-2 p-4">
          <a href="/api/export/json" className={buttonClass("default", "sm")}>
            JSON 一括エクスポート
          </a>
          <a href="/api/export/customers" className={buttonClass("outline", "sm")}>
            顧客マスタ CSV
          </a>
          <a href="/api/export/inspections" className={buttonClass("outline", "sm")}>
            点検実績 CSV
          </a>
          <a href="/api/export/billings" className={buttonClass("outline", "sm")}>
            請求実績 CSV
          </a>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="JSON インポート"
          description="現在のデータをすべて置き換えます。実行前に JSON エクスポートを取ってください"
        />
        <form action={action} className="flex flex-wrap items-center gap-2 p-4">
          <Input
            type="file"
            name="file"
            accept="application/json,.json"
            className="h-auto max-w-xs py-1.5"
            required
          />
          <Button type="submit" variant="danger" size="sm" disabled={pending}>
            {pending ? "取り込み中…" : "インポートして置き換える"}
          </Button>
          {state.status !== "idle" && (
            <p
              className={
                state.status === "ok" ? "text-xs text-ok" : "text-xs text-danger"
              }
              role="status"
            >
              {state.message}
            </p>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="自動バックアップ"
          description="起動時に data/backup/app-YYYYMMDD.db へ保存し、30日で自動削除します"
        />
        {backups.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            バックアップはまだありません。
          </p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {backups.map((b) => (
              <li key={b.file} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="font-mono text-xs">{b.file}</span>
                <span className="tabular text-xs text-muted">
                  {formatNumber(Math.round(b.size / 1024))} KB
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          復元するときはアプリを停止し、バックアップファイルを{" "}
          <code className="font-mono">{dbPath}</code> に上書きコピーしてから再起動します。
        </p>
      </Card>
    </div>
  );
}
