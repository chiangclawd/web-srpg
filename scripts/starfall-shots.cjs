// 《星墜殘響》的宣傳截圖：自動擺好幾個畫面再拍。先 npx vite build && npx vite preview --port 4173 --no-open，再：
//
//   node scripts/starfall-shots.cjs [輸出資料夾，預設 public/echo/shots] [語言 zh|en，預設 zh]
//     介紹頁（public/echo/）用的那一批：八張 1600×900 的 webp。
//
//   node scripts/starfall-shots.cjs --store [輸出資料夾，預設 store-shots/starfall]
//     商店截圖：STORE_SIZES 的每一種尺寸、中英文各一套，存成 <尺寸>/<語言>/01-ice.png …（PNG，照上架的順序編號），
//     另外各一張 Google Play 的主題圖 feature-<語言>.png（1024×500）。輸出的資料夾不進版本庫。
//
// 環境變數：GAME_URL（遊戲的網址）、PLAYWRIGHT（用全域安裝的 Playwright 時）、ONLY=ice,cg 只拍其中幾張；
//           介紹頁那一批另有 SHOT_VIEW=1280x720（畫面大小）、SHOT_DPR=1.5（像素比）、SHOT_WIDTH=1600（存檔的寬度）；
//           商店那一批另有 SIZES=googleplay,ipad-13 只拍其中幾種尺寸、LANGS=zh 只拍一種語言。
// 戰鬥畫面的擺法：先讓雙方各自打幾回合（我方也交給 AI），再選一台打得到敵人的機體、按下攻擊，畫面上就有射程、目標和傷害預估。
const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const args = process.argv.slice(2);
const STORE = args.includes('--store');
const rest = args.filter((a) => !a.startsWith('--'));
const GAME = process.env.GAME_URL ?? 'http://localhost:4173/starfall.html';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

/** 商店要的尺寸（輸出的像素 = 畫面大小 × 像素比） */
const STORE_SIZES = [
  { name: 'appstore-6.9', w: 1434, h: 660, dpr: 2 }, // iPhone 6.9 吋橫向 2868×1320
  { name: 'appstore-6.5', w: 1389, h: 642, dpr: 2 }, // iPhone 6.5 吋橫向 2778×1284
  { name: 'ipad-13', w: 1376, h: 1032, dpr: 2 }, // iPad 13 吋橫向 2752×2064
  { name: 'googleplay', w: 1920, h: 1080, dpr: 1 }, // Google Play 1920×1080
];

const MISSIONS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];
const TIPS = ['tip_move', 'tip_flank', 'tip_cover', 'tip_overwatch', 'tip_forecast', 'tip_leap', 'tip_shield', 'tip_mender', 'tip_rally', 'tip_hold', 'tip_drones', 'tip_thunderer', 'tip_projector'];
// 存檔：主線和後日談都打完，機體改到一半（機庫的畫面上才看得到買過的和還能買的）
const saveFor = (lang) => ({
  lang,
  sfx: 0,
  music: 0,
  fast: true,
  tips: TIPS,
  stars: Object.fromEntries(MISSIONS.map((m, i) => [m, i % 3 === 1 ? 2 : 3])),
  upgrades: {
    kai: { plating: 2, firepower: 3, mods: ['kai_link'] },
    bruno: { plating: 3, firepower: 1, mods: ['bruno_reactive'] },
    vey: { plating: 1, firepower: 3, mods: ['vey_scope'] },
    echo: { plating: 2, firepower: 1, mods: ['echo_nano'] },
    sparrow: { plating: 1, firepower: 2, mods: [] },
    hale_ally: { plating: 2, firepower: 2, mods: [] },
  },
});

/**
 * 要拍的畫面，照拍的先後排。battle：哪一關、先打幾回合；say：播哪一段對話、停在第幾句（從 0 算）；scene：直接開哪個場景。
 * 名字就是檔名；store 是商店截圖裡排第幾張（第一張最重要）。
 */
const SHOTS = [
  // 選單的畫面先拍：打過戰鬥之後任務列表上會多出「接著打」
  { name: 'missions', store: 8, scene: 'SfMissions', data: { chapter: 2 } },
  { name: 'hangar', store: 7, scene: 'SfHangar', data: { chapter: 3 } },
  { name: 'ice', store: 1, battle: 'm1', turns: 2 },
  { name: 'bay', store: 2, battle: 'm6', turns: 2 },
  { name: 'reactor', store: 6, battle: 'm8', turns: 2 },
  { name: 'field', store: 4, battle: 'm11', turns: 2 },
  { name: 'talk', store: 5, battle: 'm2', say: 'm2_outro', at: 3 },
  { name: 'cg', store: 3, battle: 'm6', say: 'm6_outro', at: 1 },
];

/** 開一次遊戲，把 SHOTS 拍一輪。save(name, png, shot) 決定怎麼存 */
async function shoot(browser, { w, h, dpr, lang }, save) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript((s) => localStorage.setItem('starfall_save_v1', JSON.stringify(s)), saveFor(lang));
  await page.goto(GAME);
  await page.waitForFunction(() => window.__sf && window.__sf.scene.isActive('SfTitle'), null, { timeout: 120000 });
  await page.waitForTimeout(800);

  /** 換場景：先把戰場那一組收掉 */
  const go = (key, data) =>
    page.evaluate(
      ([key, data]) => {
        const g = window.__sf;
        for (const k of ['SfTitle', 'SfDialogue', 'SfHud', 'SfBattle', 'SfHangar', 'SfMissions', 'SfCodex']) if (k !== key && g.scene.isActive(k)) g.scene.stop(k);
        g.scene.start(key, data);
      },
      [key, data ?? {}],
    );
  const idle = () => page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode === 'idle', null, { timeout: 90000 });
  /** 對話一出現就結束掉（開場、回合中的插話） */
  const skipTalk = () =>
    page
      .evaluate(() => {
        const g = window.__sf;
        if (g.scene.isActive('SfDialogue')) g.scene.getScene('SfDialogue').finish();
      })
      .catch(() => undefined);

  for (const shot of SHOTS) {
    if (ONLY && !ONLY.includes(shot.name)) continue;
    if (shot.scene) {
      await go(shot.scene, shot.data);
      await page.waitForFunction((k) => window.__sf.scene.isActive(k), shot.scene, { timeout: 30000 });
      await page.waitForTimeout(900);
      await save(shot.name, await page.screenshot(), shot);
      continue;
    }
    await go('SfBattle', { missionId: shot.battle });
    const skipper = setInterval(skipTalk, 300);
    await idle();
    if (shot.turns) {
      // 不能在 evaluate 裡等它跑完：中途的對話要靠外面的 skipper 結束
      await page.evaluate((n) => {
        window.__shotDone = false;
        void window.__sf.scene
          .getScene('SfBattle')
          .autoBattle(n)
          .then(() => (window.__shotDone = true));
      }, shot.turns);
      await page.waitForFunction(() => window.__shotDone, null, { timeout: 180000 });
      await idle();
    }
    clearInterval(skipper);
    await page.waitForTimeout(500);
    if (shot.say) {
      await page.evaluate((id) => void window.__sf.scene.getScene('SfBattle').say(id), shot.say);
      await page.waitForFunction(() => window.__sf.scene.isActive('SfDialogue'), null, { timeout: 30000 });
      await page.waitForTimeout(300);
      for (;;) {
        const i = await page.evaluate(() => window.__sf.scene.getScene('SfDialogue').i);
        if (i >= shot.at) break;
        await page.evaluate(() => {
          const s = window.__sf.scene.getScene('SfDialogue');
          s.advance();
          s.advance();
        });
      }
      // 等立繪、表情和插圖都載好、淡入做完，再把整句字顯示出來
      await page.waitForTimeout(1800);
      await page.evaluate(() => {
        const s = window.__sf.scene.getScene('SfDialogue');
        if (s.timer) s.timer.remove();
        s.shown = s.full.length;
        s.text.setText(s.full);
      });
      await page.waitForTimeout(200);
    } else {
      const staged = await page.evaluate(() => {
        const s = window.__sf.scene.getScene('SfBattle');
        const b = s.battle;
        const mine = b.alive('player').filter((u) => !u.def.structure && b.canAct(u));
        const u = mine.slice().sort((a, c) => b.targets(c).length - b.targets(a).length)[0];
        if (!u) return null;
        s.select(u);
        const ts = b.targets(u);
        let mid = { x: u.x, y: u.y };
        if (ts.length) {
          s.beginTarget({ kind: 'attack' });
          if (!s.aim) s.aimAt({ x: ts[0].x, y: ts[0].y });
          mid = { x: (u.x + s.aim.x) / 2, y: (u.y + s.aim.y) / 2 };
        }
        s.lookAt((mid.x - mid.y) * 48, (mid.x + mid.y) * 24 - b.heightAt(Math.round(mid.x), Math.round(mid.y)) * 24);
        return { unit: u.def.id, targets: ts.length, turn: b.turn };
      });
      console.log(`  ${shot.name}: ${JSON.stringify(staged)}`);
      await page.waitForTimeout(900);
    }
    await save(shot.name, await page.screenshot(), shot);
  }
  await ctx.close();
}

/**
 * Google Play 的主題圖（1024×500）：主視覺加上遊戲名稱，字用遊戲內嵌的那套。
 * 頁面掛在遊戲同一個網站底下的一個假網址上，字型和圖才載得到。
 */
async function feature(browser, lang, file) {
  const origin = new URL(GAME).origin;
  const big = lang === 'zh' ? '星墜殘響' : 'STARFALL ECHO';
  const small = lang === 'zh' ? 'STARFALL ECHO' : '星墜殘響';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @font-face { font-family: sf; font-weight: 700; src: url('/assets/starfall/fonts/starfall-sans-700.woff2') format('woff2'); }
    html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; background: #050a14; }
    .art { position: absolute; inset: 0; background: url('/assets/starfall/title.webp') 70% 46% / 1240px auto no-repeat; }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(5, 10, 20, 0.92) 0%, rgba(5, 10, 20, 0.62) 36%, rgba(5, 10, 20, 0) 62%); }
    .text { position: absolute; left: 64px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; font-family: sf, sans-serif; font-weight: 700; }
    .big { color: #fff; font-size: ${lang === 'zh' ? 92 : 62}px; line-height: 1.1; letter-spacing: ${lang === 'zh' ? '0.06em' : '0.04em'}; text-shadow: 0 4px 0 #04101c, 0 10px 28px rgba(0, 0, 0, 0.8); }
    .small { margin-top: 14px; color: #5fe3ff; font-size: ${lang === 'zh' ? 26 : 34}px; letter-spacing: ${lang === 'zh' ? '0.42em' : '0.2em'}; text-shadow: 0 2px 8px #000; }
  </style></head><body><div class="art"></div><div class="shade"></div><div class="text"><div class="big">${big}</div><div class="small">${small}</div></div></body></html>`;
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route(`${origin}/__feature.html`, (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`${origin}/__feature.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: file });
  await ctx.close();
  console.log(`${path.basename(file)} 1024x500`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (STORE) {
    const out = path.resolve(rest[0] ?? 'store-shots/starfall');
    const sizes = STORE_SIZES.filter((s) => !process.env.SIZES || process.env.SIZES.split(',').includes(s.name));
    const langs = (process.env.LANGS ?? 'zh,en').split(',');
    for (const lang of langs) {
      fs.mkdirSync(out, { recursive: true });
      await feature(browser, lang, path.join(out, `feature-${lang}.png`));
      for (const size of sizes) {
        const dir = path.join(out, size.name, lang);
        fs.mkdirSync(dir, { recursive: true });
        console.log(`${size.name} ${lang} (${size.w * size.dpr}x${size.h * size.dpr})`);
        await shoot(browser, { ...size, lang }, async (name, png, shot) => {
          // 商店不收帶透明度的圖
          await sharp(png).flatten({ background: '#000000' }).png().toFile(path.join(dir, `${String(shot.store).padStart(2, '0')}-${name}.png`));
        });
      }
    }
  } else {
    const out = path.resolve(rest[0] ?? 'public/echo/shots');
    const [w, h] = (process.env.SHOT_VIEW ?? '1280x720').split('x').map(Number);
    const width = Number(process.env.SHOT_WIDTH ?? 1600);
    fs.mkdirSync(out, { recursive: true });
    await shoot(browser, { w, h, dpr: Number(process.env.SHOT_DPR ?? 1.5), lang: rest[1] ?? 'zh' }, async (name, png) => {
      const info = await sharp(png).resize({ width }).webp({ quality: 82, effort: 6 }).toFile(path.join(out, `${name}.webp`));
      console.log(`${name}.webp ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
    });
  }
  await browser.close();
})();
