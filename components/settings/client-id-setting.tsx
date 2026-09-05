"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import {
  BUILT_IN_CLIENT_ID,
  hasOwnClientId,
  loadClientId,
  saveClientId,
} from "@/lib/store/client-id";

/**
 * Google への接続口（OAuth クライアントID）をこの端末で決める。
 *
 * 空のままなら配布元の接続口を使う。自分のIDを入れると、
 * Google との通信は自分の枠だけを通り、配布元には一切かからない。
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
        description="自分の Google Cloud で作ったクライアントIDを入れると、Google との通信が自分の枠だけを通ります。空のままなら配布元の接続口を使います"
      />
      <div className="space-y-2 p-4">
        <p className="text-xs text-muted">
          いま使っているのは
          <span className="ml-1 font-medium text-ink">
            {own ? "自分の接続口" : "配布元の接続口"}
          </span>
          です。
          {!own && BUILT_IN_CLIENT_ID === "" && (
            <span className="ml-1 text-warn">
              配布元の接続口も未設定なので、ドライブに接続できません。
            </span>
          )}
        </p>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="000000000000-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
          className="font-mono text-xs"
          aria-label="Google クライアントID"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={apply}>
            {value.trim() === "" ? "配布元の接続口に戻す" : "この端末で使う"}
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
