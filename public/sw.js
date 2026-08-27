// 顧客管理ツール Service Worker
// 方針: 画面の材料（HTML/JS/CSS）をキャッシュして、圏外でもアプリが開けるようにする。
//       データ本体はドライブと端末内の控えが持つので、ここでは扱わない。

const CACHE = "kokyaku-kanri-v1";

// インストール時は待たずに新しいものへ切り替える
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 自分のサイト以外（ドライブAPI、Googleのログイン、地図など）は素通し。
  // ここを触ると認証やデータ取得が壊れる。
  if (url.origin !== self.location.origin) return;

  // ハッシュ付きの静的ファイルは中身が変わらないのでキャッシュ優先
  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // 画面はネットワーク優先。取れたら控えを更新し、圏外なら控えを返す
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(request)
          .then((hit) => hit || caches.match(self.registration.scope)),
      ),
  );
});
