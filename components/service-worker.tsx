"use client";

import { useEffect } from "react";

/**
 * Service Worker の登録。
 * 圏外でもアプリの画面が開けるようにするためで、データは扱わない。
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // 開発中は邪魔になるので本番だけ
    if (process.env.NODE_ENV !== "production") return;

    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: `${base}/` })
      .catch((e) => console.warn("Service Worker を登録できませんでした", e));
  }, []);

  return null;
}
