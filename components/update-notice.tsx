"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { downloadFile } from "@/lib/csv";
import { useStore } from "@/lib/store/context";
import { shouldNotify, skipVersion, snooze } from "@/lib/update-preference";
import { APP_VERSION } from "@/lib/version";
import { todayIso } from "@/lib/utils";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** 開いたままの端末にも届くよう、ときどき見に行く */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** 公開されている版を見に行く。取れなければ null */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_PATH}/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    // 圏外なら次の機会に確かめる
    return null;
  }
}

/** 端末に残っている古い材料を捨てて開き直す */
export async function applyUpdate(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // 消せなくても、開き直せば新しいものが取れることが多い
  }
  window.location.reload();
}

/**
 * 新しい版が出たことを知らせる。
 *
 * 黙って入れ替えない。更新するかどうかは使う人が決める。
 * 「この版のまま使う」を選べば、その版についてはもう知らせない。
 * 更新の前には、いまのデータの控えを保存できるようにする。
 */
export function UpdateNotice() {
  const { doc } = useStore();
  const [latest, setLatest] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    const version = await fetchLatestVersion();
    if (version) setLatest(version);
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const saveBackup = () => {
    downloadFile(
      `顧客管理_更新前バックアップ_${todayIso()}.json`,
      JSON.stringify(doc, null, 2),
      "application/json",
    );
  };

  const show =
    !dismissed && latest !== null && shouldNotify(latest, APP_VERSION);

  if (!show) return null;

  return (
    <>
      <div className="no-print border-b border-brand/30 bg-brand-soft">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
          <p className="text-xs text-brand">
            新しい版 <span className="font-semibold">{latest}</span> が出ています
            <span className="ml-1 text-muted">（いまは {APP_VERSION}）</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAsking(true)}>
              更新する
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                snooze();
                setDismissed(true);
              }}
            >
              あとで
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                skipVersion(latest);
                setDismissed(true);
              }}
            >
              この版のまま使う
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        title={`${latest} に更新しますか？`}
        danger="更新の前に、いまのデータの控えを保存してください。万一のときに戻せるのは控えだけです。"
        detail={
          <>
            <p>
              「控えを保存して更新する」を押すと、
              <span className="mx-1 font-mono">顧客管理_更新前バックアップ_{todayIso()}.json</span>
              をダウンロードしてから開き直します。
            </p>
            <p className="mt-1.5">
              顧客データそのものはドライブに残るので、更新で消えることはありません。
              控えは、更新後に何かおかしくなったときに元の状態へ戻すためのものです。
            </p>
            <p className="mt-1.5">
              ホーム画面から開いている端末では、ダウンロードが保存されないことがあります。
              そのときは 設定 → データ管理 の「JSON 一括エクスポート」で先に取ってください。
            </p>
          </>
        }
        confirmLabel="控えを保存して更新する"
        cancelLabel="やめる"
        onConfirm={() => {
          saveBackup();
          setAsking(false);
          // 保存が始まるのを待ってから開き直す
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
    </>
  );
}
