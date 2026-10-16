// 王國防線：離線快取（只控制 td.html，不影響 SRPG 主頁）
// - 頁面導覽：先走網路（拿到新版），失敗才用快取
// - 其他同源 GET（打包檔、圖片、字型）：先回快取、背景更新（stale-while-revalidate）
// - 帶 Range 的請求（音樂串流）不處理：206 部分回應無法安全快取
const CACHE = 'kb-td-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kb-td-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req)
        .then((res) => {
          if (res.status === 200) c.put(req, res.clone());
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || net;
    }),
  );
});
