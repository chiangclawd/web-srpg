// 離線遊玩：建置時的檔案清單（scripts/starfall-offline.mjs）和 service worker 的行為（src/starfall/offline/sw.js）。
// service worker 在假的環境裡跑（假的快取、假的網路），所以「更新時只重抓有變的檔案」「抓到一半斷網下次接著抓」
// 這些在瀏覽器裡很難重現的情況這裡測得到。真的瀏覽器裡斷網能不能玩，由 scripts/starfall-check.cjs 的 offline 那一段檢查。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import sharp from 'sharp';
import { chunkFiles, offlineList, publicFiles, swSource } from '../../scripts/starfall-offline.mjs';

const TEMPLATE = fs.readFileSync('src/starfall/offline/sw.js', 'utf8');
const SITE = 'https://example.test/game/';
/** 清單的一項：[網址, 版本, 位元組數] */
type Entry = [string, string, number];

// ───────── 檔案清單 ─────────

test('打包檔：從進入點一路找到動態載入的，不收原始碼對照檔，也不收別的遊戲的', () => {
  const chunk = (imports: string[] = [], dynamicImports: string[] = [], css: string[] = []) => ({ type: 'chunk', code: 'console.log(1)', imports, dynamicImports, viteMetadata: { importedCss: new Set(css), importedAssets: new Set<string>() } });
  const bundle = {
    'assets/starfall-a.js': chunk(['assets/phaser-b.js', 'assets/helper-c.js'], ['assets/firebase-d.js'], ['assets/starfall-e.css']),
    'assets/phaser-b.js': chunk(),
    'assets/helper-c.js': chunk(['assets/phaser-b.js']),
    // 互相引用也不會繞不出來
    'assets/firebase-d.js': chunk(['assets/helper-c.js'], ['assets/starfall-a.js']),
    'assets/starfall-e.css': { type: 'asset', source: 'body{}' },
    'assets/starfall-a.js.map': { type: 'asset', source: '{}' },
    'assets/td-z.js': chunk(['assets/phaser-b.js']),
  };
  const found = chunkFiles(bundle, 'assets/starfall-a.js');
  assert.deepEqual(
    found.map((f: Entry) => f[0]),
    ['assets/firebase-d.js', 'assets/helper-c.js', 'assets/phaser-b.js', 'assets/starfall-a.js', 'assets/starfall-e.css'],
  );
  // 檔名已經帶雜湊，版本留空；大小是內容的位元組數
  assert.deepEqual(found.at(-1), ['assets/starfall-e.css', '', 6]);
  assert.ok(found.every((f: Entry) => f[1] === '' && f[2] > 0));
});

test('素材：public 底下這個遊戲的檔案都在，分享卡片的預覽圖不收', () => {
  const files = publicFiles('public');
  const urls = files.map((f: Entry) => f[0]);
  for (const need of ['assets/starfall/title.webp', 'assets/starfall/tiles.json', 'assets/starfall/units/anvil.webp', 'assets/starfall/units/anvil.json', 'assets/starfall/music/battle.mp3', 'assets/starfall/fonts/starfall-sans-400.woff2']) {
    assert.ok(urls.includes(need), `${need} 要在清單裡`);
  }
  assert.ok(!urls.includes('assets/starfall/og.jpg'));
  assert.ok(urls.every((u: string) => u.startsWith('assets/starfall/')));
  assert.ok(files.every((f: Entry) => /^[0-9a-f]{10}$/.test(f[1])));
  assert.ok(files.every((f: Entry) => f[2] === fs.statSync(`public/${f[0]}`).size));
  assert.deepEqual(publicFiles('public'), files, '同樣的檔案要算出同樣的結果');
});

test('清單：頁面和程式排最前面、音樂排最後；內容一變代號就變', () => {
  const assets: Entry[] = [
    ['assets/starfall/music/title.mp3', 'm1', 900],
    ['assets/starfall/units/anvil.webp', 'u1', 300],
    ['assets/starfall/title.webp', 't1', 100],
    ['assets/starfall/fonts/a.woff2', 'f1', 200],
    ['assets/starfall/sfx/hit.m4a', 's1', 50],
  ];
  const page: Entry = ['starfall.html', 'p1', 40];
  const chunks: Entry[] = [['assets/starfall-a.js', '', 500]];
  const a = offlineList(page, chunks, assets);
  assert.deepEqual(
    a.files.map((f: Entry) => f[0]),
    ['starfall.html', 'assets/starfall-a.js', 'assets/starfall/fonts/a.woff2', 'assets/starfall/title.webp', 'assets/starfall/units/anvil.webp', 'assets/starfall/sfx/hit.m4a', 'assets/starfall/music/title.mp3'],
  );
  assert.equal(offlineList(page, chunks, assets).build, a.build);
  const changed = assets.map((f): Entry => (f[0].endsWith('anvil.webp') ? [f[0], 'u2', f[2]] : f));
  assert.notEqual(offlineList(page, chunks, changed).build, a.build);
  assert.notEqual(offlineList(['starfall.html', 'p2', 40], chunks, assets).build, a.build);
  assert.notEqual(offlineList(page, [['assets/starfall-b.js', '', 500]], assets).build, a.build);
});

// ───────── 安裝設定 ─────────

test('安裝設定：頁面連到它、圖示的尺寸跟寫的一樣、開始的頁面在範圍裡', async () => {
  const manifest = JSON.parse(fs.readFileSync('public/starfall-manifest.json', 'utf8'));
  const html = fs.readFileSync('starfall.html', 'utf8');
  assert.match(html, /<link rel="manifest" href="starfall-manifest\.json" \/>/);
  const touch = /<link rel="apple-touch-icon" href="([^"]+)" \/>/.exec(html)?.[1];
  assert.ok(touch && fs.existsSync(`public/${touch}`));
  assert.equal(manifest.orientation, 'landscape');
  const at = (rel: string): string => new URL(rel, SITE).pathname;
  assert.ok(at(manifest.start_url).startsWith(at(manifest.scope)));
  // 快取管的範圍要跟安裝設定的一樣，而且管不到另外兩款遊戲的頁面
  const scope = /register\('starfall-sw\.js', \{ scope: '([^']+)' \}\)/.exec(fs.readFileSync('src/starfall/offline.ts', 'utf8'))?.[1];
  assert.equal(scope, manifest.scope);
  for (const other of ['index.html', 'td.html', '']) assert.ok(!at(other).startsWith(at(manifest.scope)), `${other || '首頁'} 不該在範圍裡`);
  assert.ok(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const meta = await sharp(`public/${icon.src}`).metadata();
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes, icon.src);
  }
});

// ───────── service worker ─────────

interface Stored {
  body: Uint8Array;
  type: string;
}

/** 假的快取儲存區，幾個版本的 service worker 共用同一份（就像同一個瀏覽器） */
class FakeCaches {
  stores = new Map<string, Map<string, Stored>>();
  async open(name: string) {
    let s = this.stores.get(name);
    if (!s) this.stores.set(name, (s = new Map()));
    const store = s;
    return {
      match: async (key: string) => {
        const hit = store.get(key);
        return hit ? new Response(hit.body, { headers: { 'content-type': hit.type } }) : undefined;
      },
      put: async (key: string, res: Response) => {
        store.set(key, { body: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' });
      },
    };
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
}

type Net = (url: string) => Response;

/** 把某一版的 service worker 跑起來 */
function boot(build: string, files: Entry[], caches: FakeCaches, net: Net) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const messages: Record<string, unknown>[] = [];
  const fetched: string[] = [];
  const state = { skipped: false, claimed: false };
  const self = {
    location: { href: `${SITE}starfall-sw.js`, origin: new URL(SITE).origin },
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: async () => void (state.skipped = true),
    clients: { matchAll: async () => [{ postMessage: (m: Record<string, unknown>) => messages.push(m) }], claim: async () => void (state.claimed = true) },
  };
  const fetch = async (input: string | { url: string }) => {
    const url = typeof input === 'string' ? input : input.url;
    fetched.push(url.replace(SITE, ''));
    return net(url.replace(SITE, ''));
  };
  vm.runInNewContext(swSource(TEMPLATE, build, files), { self, caches, fetch, Response, URL, Blob, Headers, setTimeout, clearTimeout, console });
  /** 安裝或啟用：等它做完，失敗會丟出來 */
  const lifecycle = async (type: 'install' | 'activate') => {
    let done: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  /** 頁面發出一個請求；回傳 null 表示 service worker 不管這個請求 */
  const request = async (url: string, o: { range?: string; mode?: string; method?: string } = {}): Promise<Response | null> => {
    let res: Promise<Response> | null = null;
    const headers = new Headers(o.range ? { range: o.range } : {});
    handlers.fetch({ request: { url: url.startsWith('http') ? url : SITE + url, method: o.method ?? 'GET', mode: o.mode ?? 'no-cors', headers }, respondWith: (p: Promise<Response>) => (res = p) });
    return res;
  };
  return { install: () => lifecycle('install'), activate: () => lifecycle('activate'), request, messages, fetched, state };
}

const text = (s: string, type = 'text/plain') => new Response(s, { headers: { 'content-type': type } });
/** 伺服器上的檔案：內容就是「網址@版本」，看內容就知道拿到的是哪一版 */
const F = (url: string, rev: string): Entry => [url, rev, `${url}@${rev}`.length];
const V1: Entry[] = [
  F('starfall.html', 'p1'),
  F('assets/starfall-a.js', ''),
  F('assets/phaser-b.js', ''),
  F('assets/starfall/title.webp', 't1'),
  F('assets/starfall/units/kai.webp', 'k1'),
  F('assets/starfall/units/bruno.webp', 'b1'),
  F('assets/starfall/units/vey.webp', 'v1'),
  F('assets/starfall/sfx/hit.m4a', 's1'),
  F('assets/starfall/music/title.mp3', 'm1'),
  F('assets/starfall/music/battle.mp3', 'm2'),
];
const server =
  (files: Entry[]): Net =>
  (url) => {
    const f = files.find((x) => x[0] === url);
    return f ? text(`${f[0]}@${f[1]}`) : new Response('not found', { status: 404 });
  };

const stored = async (caches: FakeCaches, cache: string, url: string): Promise<string | undefined> => {
  const hit = caches.stores.get(cache)?.get(SITE + url);
  return hit ? new TextDecoder().decode(hit.body) : undefined;
};

test('第一次安裝：清單上每個檔案各抓一次，全部到齊才算裝好，進度有回報給頁面', async () => {
  const caches = new FakeCaches();
  const sw = boot('one', V1, caches, server(V1));
  await sw.install();
  assert.deepEqual([...sw.fetched].sort(), V1.map((f) => f[0]).sort());
  for (const [url, rev] of V1) assert.equal(await stored(caches, 'starfall-one', url), `${url}@${rev}`);
  assert.ok(sw.state.skipped, '裝好就該接手，不用等下次開頁面');
  // 進度照大小算，不會倒退，最後剛好是全部
  const total = V1.reduce((sum, f) => sum + f[2], 0);
  const progress = sw.messages.map((m) => m.done as number);
  assert.equal(progress.length, V1.length);
  assert.ok(progress.every((d, i) => d > 0 && d >= (progress[i - 1] ?? 0)));
  assert.equal(progress.at(-1), total);
  assert.ok(sw.messages.every((m) => m.total === total));
  await sw.activate();
  assert.ok(sw.state.claimed);
  // 訊息是在 service worker 那個環境裡建的物件，攤開來再比
  assert.deepEqual({ ...sw.messages.at(-1) }, { sf: 'offline', build: 'one', ready: true });
});

test('更新：沒變的檔案從上一版搬過來，只重抓有變的；啟用後舊版的快取刪掉', async () => {
  const caches = new FakeCaches();
  const v1 = boot('one', V1, caches, server(V1));
  await v1.install();
  await v1.activate();
  // 新版：程式換了（檔名不同）、一張圖表重畫了、少了一首音樂
  const V2: Entry[] = V1.filter((f) => f[0] !== 'assets/starfall/music/battle.mp3').map((f) =>
    f[0] === 'assets/starfall-a.js' ? F('assets/starfall-a2.js', '') : f[0].endsWith('kai.webp') ? F(f[0], 'k2') : f[0] === 'starfall.html' ? F(f[0], 'p2') : f,
  );
  const v2 = boot('two', V2, caches, server(V2));
  await v2.install();
  assert.deepEqual([...v2.fetched].sort(), ['assets/starfall-a2.js', 'assets/starfall/units/kai.webp', 'starfall.html']);
  // 安裝完、還沒啟用：舊版還在服務開著的頁面，它的快取要原封不動
  assert.equal(await stored(caches, 'starfall-one', 'assets/starfall/units/kai.webp'), 'assets/starfall/units/kai.webp@k1');
  await v2.activate();
  assert.deepEqual(await caches.keys(), ['starfall-two']);
  assert.equal(await stored(caches, 'starfall-two', 'assets/starfall/units/kai.webp'), 'assets/starfall/units/kai.webp@k2');
  assert.equal(await stored(caches, 'starfall-two', 'assets/starfall/units/bruno.webp'), 'assets/starfall/units/bruno.webp@b1');
  assert.equal(await stored(caches, 'starfall-two', 'assets/starfall/music/battle.mp3'), undefined);
});

test('抓到一半斷網：安裝失敗，但已經到手的記著，下次只抓剩下的', async () => {
  const caches = new FakeCaches();
  let served = 0;
  const flaky: Net = (url) => {
    if (++served > 4) throw new TypeError('network down');
    return server(V1)(url);
  };
  const first = boot('one', V1, caches, flaky);
  await assert.rejects(first.install());
  assert.ok(!first.state.skipped, '沒裝好就不能接手');
  const got = [...(caches.stores.get('starfall-one')?.keys() ?? [])].filter((k) => !k.endsWith('__files__.json')).length;
  assert.equal(got, 4);
  const second = boot('one', V1, caches, server(V1));
  await second.install();
  assert.equal(second.fetched.length, V1.length - 4);
  assert.ok(second.state.skipped);
  for (const [url, rev] of V1) assert.equal(await stored(caches, 'starfall-one', url), `${url}@${rev}`);
});

test('伺服器回錯誤（檔案不見了）也算安裝失敗，不會把錯誤頁存起來', async () => {
  const caches = new FakeCaches();
  const sw = boot('one', V1, caches, server(V1.filter((f) => !f[0].endsWith('vey.webp'))));
  await assert.rejects(sw.install(), /vey\.webp: HTTP 404/);
  assert.equal(await stored(caches, 'starfall-one', 'assets/starfall/units/vey.webp'), undefined);
});

test('斷網時：頁面、程式、圖都從快取來；音樂用 Range 要哪一段就給哪一段', async () => {
  const caches = new FakeCaches();
  const online = boot('one', V1, caches, server(V1));
  await online.install();
  await online.activate();
  const sw = boot('one', V1, caches, () => {
    throw new TypeError('offline');
  });
  const page = await sw.request('starfall.html?from=home', { mode: 'navigate' });
  assert.equal(await page?.text(), 'starfall.html@p1');
  assert.equal(await (await sw.request('assets/starfall/units/kai.webp'))?.text(), 'assets/starfall/units/kai.webp@k1');
  const song = 'assets/starfall/music/title.mp3';
  const whole = `${song}@m1`;
  const part = await sw.request(song, { range: 'bytes=7-14' });
  assert.equal(part?.status, 206);
  assert.equal(await part?.clone().text(), whole.slice(7, 15));
  assert.equal(part?.headers.get('content-range'), `bytes 7-14/${whole.length}`);
  assert.equal(part?.headers.get('content-length'), '8');
  // 瀏覽器第一個請求通常是「從頭到尾」
  const all = await sw.request(song, { range: 'bytes=0-' });
  assert.equal(all?.status, 206);
  assert.equal(await all?.clone().text(), whole);
  assert.equal(all?.headers.get('content-range'), `bytes 0-${whole.length - 1}/${whole.length}`);
  assert.equal(await (await sw.request(song, { range: 'bytes=-5' }))?.text(), whole.slice(-5));
  assert.equal(await (await sw.request(song, { range: 'bytes=20-9999' }))?.text(), whole.slice(20));
  assert.equal((await sw.request(song, { range: `bytes=${whole.length}-` }))?.status, 416);
  assert.equal(sw.fetched.filter((u) => !u.startsWith('starfall.html')).length, 0, '快取裡有的檔案不該再去碰網路');
});

test('連線時：頁面先走網路拿新版；清單以外的同源檔案用過一次就留著；別的網站和非 GET 的請求不管', async () => {
  const caches = new FakeCaches();
  const net: Net = (url) => (url.startsWith('starfall.html') ? text('newer page') : url === 'starfall-icon-192.png' ? text('icon', 'image/png') : server(V1)(url));
  const sw = boot('one', V1, caches, net);
  await sw.install();
  await sw.activate();
  assert.equal(await (await sw.request('starfall.html', { mode: 'navigate' }))?.text(), 'newer page');
  assert.equal(await (await sw.request('starfall-icon-192.png'))?.text(), 'icon');
  assert.equal(await stored(caches, 'starfall-one', 'starfall-icon-192.png'), 'icon');
  assert.equal(await sw.request('https://firestore.googleapis.com/v1/projects/x'), null);
  assert.equal(await sw.request('assets/starfall/title.webp', { method: 'POST' }), null);
});
