// 星墜殘響：離線遊玩（只管 starfall.html，不影響同一個網站上的另外兩款遊戲）。
// 這個檔案是樣板：建置時 scripts/starfall-offline.mjs 在最前面加上
//   BUILD = 這一版的代號，FILES = [[網址, 版本, 位元組數], …]（整個遊戲用到的檔案；檔名帶雜湊的打包檔版本是空字串）
// 變成網站上的 starfall-sw.js。清單一變這個檔案就變，瀏覽器就知道要更新。
// - 安裝：把清單上的檔案都抓進這一版自己的快取；上一版快取裡版本沒變的直接搬過來，不重新下載。全部到齊才算裝好
// - 啟用：刪掉舊版的快取，接手已經開著的頁面
// - 頁面：先走網路（拿到新版），四秒沒回應或斷網就用快取裡的
// - 其他檔案：快取裡有就用，沒有才走網路
// - 帶 Range 的請求（<audio> 播音樂）：從快取裡的整個檔案切出要的那一段回 206。iOS 的 Safari 要 206 才肯播
/* global BUILD, FILES */
const PREFIX = 'starfall-';
const CACHE = PREFIX + BUILD;
/** 這份快取裡每個檔案是哪個版本：安裝中斷後接著抓、下一版搬檔案時都靠它 */
const META = '__files__.json';
const PAGE = 'starfall.html';
const abs = (rel) => new URL(rel, self.location.href).href;

/** 告訴開著的頁面目前的進度（標題畫面右下角會顯示） */
async function tell(msg) {
  const pages = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  // 要送的時候才算內容：好幾個檔案同時在抓，先算好的數字等送出去時可能已經落後，畫面上的進度就會倒退
  const data = { sf: 'offline', build: BUILD, ...msg() };
  for (const c of pages) c.postMessage(data);
}

async function readMeta(cache) {
  const res = await cache.match(abs(META));
  return res ? res.json().catch(() => ({})) : {};
}

const writeMeta = (cache, revs) => cache.put(abs(META), new Response(JSON.stringify(revs), { headers: { 'content-type': 'application/json' } }));

async function precache() {
  const cache = await caches.open(CACHE);
  // 這一版上次抓到一半的（手機上慢的網路可能一次抓不完）
  const have = await readMeta(cache);
  // 最近的一份舊版快取
  let old = null;
  let oldRevs = {};
  for (const k of (await caches.keys()).reverse()) {
    if (!k.startsWith(PREFIX) || k === CACHE) continue;
    const c = await caches.open(k);
    const m = await readMeta(c);
    if (Object.keys(m).length) {
      old = c;
      oldRevs = m;
      break;
    }
  }
  const revs = {};
  const todo = FILES.slice();
  // 進度照大小算：最後那幾首音樂就佔了三分之一，照檔案數算的話會在九成多停很久
  const total = FILES.reduce((sum, f) => sum + f[2], 0);
  let bytes = 0;
  let count = 0;
  const one = async ([url, rev, size]) => {
    const key = abs(url);
    if (!(have[url] === rev && (await cache.match(key)))) {
      let res = old && oldRevs[url] === rev ? await old.match(key) : undefined;
      if (!res) {
        // no-cache：跟伺服器確認過才用瀏覽器自己的快取，免得把舊檔案存成新版
        res = await fetch(key, { cache: 'no-cache' });
        if (res.status !== 200) throw new Error(`${url}: HTTP ${res.status}`);
      }
      await cache.put(key, res);
    }
    revs[url] = rev;
    bytes += size;
    if (++count % 8 === 0) await writeMeta(cache, revs);
    await tell(() => ({ done: bytes, total }));
  };
  // 一次抓三個：第一次開遊戲時，玩家眼前要用的檔案也在下載，不要把頻寬佔滿。
  // 有一個抓不到（斷網了）就不再開新的，等手上的做完，把已經到手的記下來再回報失敗：下次從這裡接著抓
  let failed = null;
  const worker = async () => {
    for (let f = todo.shift(); f && !failed; f = todo.shift()) {
      try {
        await one(f);
      } catch (err) {
        failed = err;
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  await writeMeta(cache, revs);
  if (failed) throw failed;
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
      await tell(() => ({ ready: true }));
    })(),
  );
});

/** 頁面：先走網路；太慢或斷網就用快取 */
async function page(req) {
  const cached = () => caches.open(CACHE).then((c) => c.match(abs(PAGE)));
  let timer;
  const slow = new Promise((resolve) => {
    timer = setTimeout(() => resolve(cached()), 4000);
  });
  const net = fetch(req).then(
    (res) => (res.ok ? res : cached().then((hit) => hit || res)),
    () => cached().then((hit) => hit || Response.error()),
  );
  const res = await Promise.race([net, slow.then((hit) => hit || net)]);
  clearTimeout(timer);
  return res;
}

async function file(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  // 清單以外的同源檔案（圖示之類）：用過一次就留著
  if (res.status === 200) await cache.put(req.url, res.clone());
  return res;
}

/** <audio> 會用 Range 要檔案的一段：快取裡存的是整個檔案，切出那一段回 206 */
async function ranged(req) {
  const cache = await caches.open(CACHE);
  const full = await cache.match(req.url);
  if (!full) return fetch(req);
  const blob = await full.blob();
  const size = blob.size;
  const type = full.headers.get('content-type') || 'application/octet-stream';
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!m || (m[1] === '' && m[2] === '')) return new Response(blob, { status: 200, headers: { 'content-type': type, 'accept-ranges': 'bytes' } });
  // bytes=500-：從 500 到最後；bytes=-500：最後 500 個位元組
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(size - 1, Number(m[2]));
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1, type), {
    status: 206,
    statusText: 'Partial Content',
    headers: { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1), 'accept-ranges': 'bytes' },
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') e.respondWith(page(req));
  else if (req.headers.has('range')) e.respondWith(ranged(req));
  else e.respondWith(file(req));
});
