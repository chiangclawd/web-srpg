// npm run build:app 的最後一步：把 dist-app 整理成 Capacitor App 用的網頁資料夾
// - Capacitor 從 index.html 開啟 App：寫一個轉到 td.html 的入口（遊戲內的連結、隱私權政策頁都照舊用 td.html）
// - 拿掉只有戰術 SRPG 用到的素材（CG、地圖格、SRPG 配樂、SRPG 的 PWA 設定），App 小將近 20 MB
// - 拿掉《星墜殘響》的素材和安裝設定（public 底下的東西會整個被複製進來，那是另一款遊戲，約 22 MB）
// - 網站用的介紹頁與宣傳圖也不用放進 App（《星墜殘響》的介紹頁在 echo/）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath：Windows 上、或路徑裡有空白時，直接拿網址的 pathname 會是錯的路徑
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist-app');
if (!fs.existsSync(path.join(dir, 'td.html'))) {
  console.error('dist-app/td.html not found: run vite build --mode app first');
  process.exit(1);
}

fs.writeFileSync(
  path.join(dir, 'index.html'),
  '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=td.html">' +
    '<style>html{background:#120d08}</style><script>location.replace("td.html")</script></head><body></body></html>\n',
);

const drop = ['assets/cg', 'assets/tiles', 'manifest.json', 'kingdom-bastion.html', 'assets/promo', 'assets/starfall', 'echo'];
for (const f of fs.readdirSync(dir)) if (f.startsWith('starfall-')) drop.push(f);
// 《星墜殘響》的隱私權說明和授權頁（legal 底下只有它的檔案的話，整個資料夾拿掉）
const legal = fs.existsSync(path.join(dir, 'legal')) ? fs.readdirSync(path.join(dir, 'legal')) : [];
if (legal.length && legal.every((f) => f.startsWith('starfall-'))) drop.push('legal');
else for (const f of legal) if (f.startsWith('starfall-')) drop.push(`legal/${f}`);
for (const f of fs.readdirSync(path.join(dir, 'assets/audio'))) if (/^bgm_.*\.mp3$/.test(f)) drop.push(`assets/audio/${f}`);
let saved = 0;
const size = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((s, f) => s + size(path.join(p, f)), 0) : fs.statSync(p).size);
for (const rel of drop) {
  const p = path.join(dir, rel);
  if (!fs.existsSync(p)) continue;
  saved += size(p);
  fs.rmSync(p, { recursive: true, force: true });
}
console.log(`dist-app ready: removed ${(saved / 1e6).toFixed(1)} MB of files the tower defence app does not use, total ${(size(dir) / 1e6).toFixed(1)} MB`);
