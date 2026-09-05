"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_VERSION } from "@/lib/version";
import { Button } from "@/components/ui";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** 開いたままの端末にも届くよう、ときどき見に行く */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * 公開されている版と、いま動いている版を比べてお知らせする。
 *
 * 静的サイトなので、端末に残った古い材料がそのまま使われ続けることがある。
 * 黙って入れ替わると「変わっていない」と見えるので、
 * 気づける形にして、押したときに入れ替える。
 */
export function UpdateNotice() {
  const [latest, setLatest] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_PATH}/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data.version) setLatest(data.version);
    } catch {
      // 圏外なら次の機会に確かめる
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    // 画面に戻ってきたときにも確かめる
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const apply = async () => {
    setUpdating(true);
    try {
      // 端末に残っている古い材料を捨ててから開き直す
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // 消せなくても、開き直せば新しいものが取れることが多い
    }
    window.location.reload();
  };

  if (!latest || latest === APP_VERSION) return null;

  return (
    <div className="no-print border-b border-brand/30 bg-brand-soft">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
        <p className="text-xs text-brand">
          新しい版 <span className="font-semibold">{latest}</span> が出ています
          <span className="ml-1 text-muted">（いまは {APP_VERSION}）</span>
        </p>
        <Button size="sm" onClick={() => void apply()} disabled={updating}>
          {updating ? "更新しています…" : "更新する"}
        </Button>
      </div>
    </div>
  );
}
