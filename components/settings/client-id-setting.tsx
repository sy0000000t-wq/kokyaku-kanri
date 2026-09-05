"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import Link from "next/link";
import {
  hasOwnClientId,
  loadClientId,
  saveClientId,
} from "@/lib/store/client-id";

/**
 * Google への接続口（OAuth クライアントID）をこの端末で決める。
 *
 * 配布するビルドには接続口を埋め込んでいないので、ここに入れないと
 * ドライブに接続できない。入れた接続口はその人の Google Cloud のものなので、
 * Google との通信は必ずその人の枠を通る。
 * ドライブの文書ではなく端末に持つ（文書を読むためにこのIDが要るため）。
 */
export function ClientIdSetting() {
  const [value, setValue] = useState("");
  const [own, setOwn] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(hasOwnClientId() ? loadClientId() : "");
    setOwn(hasOwnClientId());
  }, []);

  const apply = () => {
    saveClientId(value);
    setSaved(true);
    // 接続口は起動時に読むので、入れ替えたら開き直す
    window.setTimeout(() => window.location.reload(), 600);
  };

  return (
    <Card>
      <CardHeader
        title="Google への接続口（この端末）"
        description="ドライブに接続するのに必要です。自分の Google Cloud で作ったクライアントIDを入れてください。端末ごとの設定です"
      />
      <div className="space-y-2 p-4">
        {own ? (
          <p className="text-xs text-ok">この端末には接続口が設定されています。</p>
        ) : (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
            この端末には接続口が設定されていません。ドライブに接続できないので、
            データはこの端末の中だけに残ります。
            <Link href="/help?tab=setup" className="ml-1 underline">
              作り方を見る
            </Link>
          </p>
        )}

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="000000000000-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
          className="font-mono text-xs"
          aria-label="Google クライアントID"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={apply}
            disabled={value.trim() === "" && !own}
          >
            {value.trim() === "" ? "設定を消す" : "この端末で使う"}
          </Button>
          {saved && (
            <span className="text-xs text-ok" role="status">
              保存しました。開き直します…
            </span>
          )}
        </div>

        <p className="text-xs text-muted">
          切り替えると一度サインインし直しになります。データはドライブに残るので消えません。
          端末ごとの設定なので、PC とスマホで別々に入れる必要があります。
        </p>
      </div>
    </Card>
  );
}
