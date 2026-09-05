"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { useStore } from "@/lib/store/context";
import { DRIVE_FILE_NAME } from "@/lib/store/drive-backend";

/** データの保存先。ドライブに繋ぐとPC・スマホで同じものを見られる */
export function DriveConnection() {
  const {
    driveAvailable,
    driveConnected,
    connectDrive,
    disconnectDrive,
    backendName,
    doc,
  } = useStore();
  const [pending, setPending] = useState(false);

  const connect = async () => {
    setPending(true);
    try {
      await connectDrive();
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="データの保存先"
        action={
          driveConnected ? (
            <Badge tone="ok">ドライブに接続中</Badge>
          ) : (
            <Badge tone="warn">この端末のみ</Badge>
          )
        }
      />

      <div className="space-y-3 p-4 text-sm">
        <p className="text-xs text-muted">
          いまの保存先：<span className="text-ink">{backendName}</span>
          {driveConnected && (
            <>
              {" / "}
              <span className="font-mono">{DRIVE_FILE_NAME}</span>
            </>
          )}
        </p>

        {!driveAvailable && (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
            Google のクライアントIDが未設定のため、ドライブに接続できません。
            下の「Google への接続口」に、自分の Google Cloud で作った
            クライアントIDを入れてください。
          </p>
        )}

        {driveConnected ? (
          <>
            <p className="text-xs text-muted">
              データはご自身の Google ドライブに保存されています。
              PC とスマホで同じファイルを見るため、どちらで変更しても反映されます。
              ドライブが版を自動で残すので、間違えても戻せます。
            </p>
            <Button variant="outline" size="sm" onClick={disconnectDrive}>
              接続を解除する（この端末のみの保存に戻す）
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">
              いまのデータはこのブラウザの中だけにあります。
              ドライブに繋ぐと、PC とスマホで同じデータを使えるようになります。
              初回はいまの内容（顧客 {doc.customers.length} 件）がそのまま移ります。
            </p>
            <Button size="sm" onClick={() => void connect()} disabled={!driveAvailable || pending}>
              {pending ? "接続しています…" : "Google ドライブに接続する"}
            </Button>
            <p className="text-xs text-muted">
              許可を求める権限は「このアプリが作ったファイル」だけです。
              ドライブにある他のファイルはアプリから見えません。
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
