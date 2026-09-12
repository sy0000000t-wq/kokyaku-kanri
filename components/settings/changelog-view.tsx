"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { applyUpdate, fetchLatestVersion } from "@/components/update-notice";
import { CHANGELOG } from "@/lib/changelog";
import { downloadFile } from "@/lib/csv";
import { useStore } from "@/lib/store/context";
import { clearSkip, skippedVersion } from "@/lib/update-preference";
import { todayIso } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

/**
 * 更新の確認。お知らせを閉じたあとでも、ここからいつでも更新できる。
 * 古い版のまま使い続けてよいので、押さなければ何も起きない。
 */
function UpdateCheck() {
  const { doc } = useStore();
  const [latest, setLatest] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [asking, setAsking] = useState(false);

  const check = async () => {
    setChecking(true);
    setLatest(await fetchLatestVersion());
    setSkipped(skippedVersion());
    setChecking(false);
  };

  useEffect(() => {
    void check();
  }, []);

  const isLatest = latest !== null && latest === APP_VERSION;

  return (
    <Card>
      <CardHeader
        title="更新の確認"
        description="古い版のまま使い続けても構いません。更新するかどうかはここで決められます"
      />
      <div className="space-y-2 p-4 text-sm">
        <p>
          いまお使いの版：<span className="font-mono font-semibold">{APP_VERSION}</span>
          {checking ? (
            <span className="ml-2 text-xs text-muted">確認しています…</span>
          ) : latest === null ? (
            <span className="ml-2 text-xs text-muted">
              公開されている版を確認できませんでした（圏外かもしれません）
            </span>
          ) : isLatest ? (
            <span className="ml-2 text-xs text-ok">最新です</span>
          ) : (
            <span className="ml-2 text-xs text-brand">
              新しい版 <span className="font-mono font-semibold">{latest}</span> があります
            </span>
          )}
        </p>

        {skipped && (
          <p className="rounded-md bg-canvas px-2.5 py-2 text-xs text-muted">
            <span className="font-mono">{skipped}</span>{" "}
            は「この版のまま使う」を選んでいるので、お知らせを出していません。
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-0.5">
          <Button size="sm" variant="outline" onClick={() => void check()}>
            いま確認する
          </Button>
          {latest !== null && !isLatest && (
            <Button size="sm" onClick={() => setAsking(true)}>
              {latest} に更新する
            </Button>
          )}
          {skipped && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearSkip();
                setSkipped(null);
              }}
            >
              お知らせを再開する
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        title={`${latest} に更新しますか？`}
        danger="更新の前に、いまのデータの控えを保存してください。万一のときに戻せるのは控えだけです。"
        detail={
          <p>
            顧客データそのものはドライブに残るので、更新で消えることはありません。
            控えは、更新後に何かおかしくなったときに元の状態へ戻すためのものです。
          </p>
        }
        confirmLabel="控えを保存して更新する"
        cancelLabel="やめる"
        onConfirm={() => {
          downloadFile(
            `顧客管理_更新前バックアップ_${todayIso()}.json`,
            JSON.stringify(doc, null, 2),
            "application/json",
          );
          setAsking(false);
          window.setTimeout(() => void applyUpdate(), 1200);
        }}
        onCancel={() => setAsking(false)}
        extraAction={{
          label: "控えなしで更新する",
          onClick: () => {
            setAsking(false);
            void applyUpdate();
          },
        }}
      />
    </Card>
  );
}

/** 何がいつ変わったかを、使う人の言葉で並べる */
export function ChangelogView() {
  return (
    <div className="space-y-4">
      <UpdateCheck />
      <Card>
      <CardHeader
        title="更新履歴"
        description={`いまお使いの版は ${APP_VERSION} です。画面上部にお知らせが出たら「更新する」を押してください`}
      />
      <ol className="divide-y divide-line">
        {CHANGELOG.map((entry) => (
          <li key={entry.version} className="px-4 py-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{entry.version}</span>
              {entry.version === APP_VERSION && <Badge tone="brand">使用中</Badge>}
              <span className="tabular text-xs text-muted">{entry.date}</span>
            </div>
            <ul className="space-y-0.5">
              {entry.changes.map((change) => (
                <li key={change} className="text-sm text-ink">
                  ・{change}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      </Card>
    </div>
  );
}
