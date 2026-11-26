// 《星墜殘響》的宣傳截圖：自動擺好幾個畫面，存成 webp。介紹頁（public/echo/）用的那一批就是這支拍的。
// 先 npx vite build && npx vite preview --port 4173 --no-open，再：
//   node scripts/starfall-shots.cjs [輸出資料夾，預設 public/echo/shots] [語言 zh|en，預設 zh]
// 環境變數：GAME_URL（遊戲的網址）、PLAYWRIGHT（用全域安裝的 Playwright 時）、ONLY=ice,cg 只拍其中幾張、
//           SHOT_VIEW=1280x720（畫面大小）、SHOT_DPR=1.5（像素比）、SHOT_WIDTH=1600（存檔的寬度）
// 戰鬥畫面的擺法：先讓雙方各自打幾回合（我方也交給 AI），再選一台打得到敵人的機體、按下攻擊，畫面上就有射程、目標和傷害預估。
const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const OUT = path.resolve(process.argv[2] ?? 'public/echo/shots');
const LANG = process.argv[3] ?? 'zh';
const URL = process.env.GAME_URL ?? 'http://localhost:4173/starfall.html';
const [VW, VH] = (process.env.SHOT_VIEW ?? '1280x720').split('x').map(Number);
const DPR = Number(process.env.SHOT_DPR ?? 1.5);
const WIDTH = Number(process.env.SHOT_WIDTH ?? 1600);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const MISSIONS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];
const TIPS = ['tip_move', 'tip_flank', 'tip_cover', 'tip_overwatch', 'tip_forecast', 'tip_leap', 'tip_shield', 'tip_mender', 'tip_rally', 'tip_hold', 'tip_drones', 'tip_thunderer', 'tip_projector'];
// 存檔：主線和後日談都打完，機體改到一半（機庫的畫面上才看得到買過的和還能買的）
const SAVE = {
  lang: LANG,
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
};

/**
 * 要拍的畫面。battle：哪一關、先打幾回合；say：播哪一段對話、停在第幾句（從 0 算）；scene：直接開哪個場景。
 * 名字就是檔名。
 */
const SHOTS = [
  // 選單的畫面先拍：打過戰鬥之後任務列表上會多出「接著打」
  { name: 'missions', scene: 'SfMissions', data: { chapter: 2 } },
  { name: 'hangar', scene: 'SfHangar', data: { chapter: 3 } },
  { name: 'ice', battle: 'm1', turns: 2 },
  { name: 'bay', battle: 'm6', turns: 2 },
  { name: 'reactor', battle: 'm8', turns: 2 },
  { name: 'field', battle: 'm11', turns: 2 },
  { name: 'talk', battle: 'm2', say: 'm2_outro', at: 3 },
  { name: 'cg', battle: 'm6', say: 'm6_outro', at: 1 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript((s) => localStorage.setItem('starfall_save_v1', JSON.stringify(s)), SAVE);
  await page.goto(URL);
  await page.waitForFunction(() => window.__sf && window.__sf.scene.isActive('SfTitle'), null, { timeout: 120000 });
  await page.waitForTimeout(800);

  const save = async (name) => {
    const png = await page.screenshot();
    const info = await sharp(png).resize({ width: WIDTH }).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT, `${name}.webp`));
    console.log(`${name}.webp ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
  };
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
      await save(shot.name);
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
    await save(shot.name);
  }
  await browser.close();
})();
