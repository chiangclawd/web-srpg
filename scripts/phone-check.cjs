// 手機版面檢查：用幾種手機尺寸打開主選單、世界地圖、關卡面板、戰鬥畫面，
// 對每個可點的按鈕 / 地圖節點問遊戲自己的點擊判定「正中間最上面是誰」——不是它自己就代表被別的東西蓋住；
// 也檢查按鈕有沒有超出畫面、有沒有程式錯誤。截圖存到輸出資料夾（CI 會上傳）。
//   npm run build && npx vite preview --port 4173 &
//   node scripts/phone-check.cjs [輸出資料夾，預設 phone-check/]
// （Playwright 用全域安裝的版本時設 PLAYWRIGHT=/path/to/playwright；GAME_URL 可改網址）
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const OUT = path.resolve(process.argv[2] ?? 'phone-check');
const URL = process.env.GAME_URL ?? 'http://localhost:4173/td.html';
// iPhone SE/8（16:9）、iPhone 14（19.5:9）、同一台讓出瀏海、iPad（4:3）
const DEVICES = [
  { name: 'phone-16x9', w: 667, h: 375, dpr: 2 },
  { name: 'phone-wide', w: 844, h: 390, dpr: 3 },
  { name: 'phone-notch', w: 844, h: 390, dpr: 3, inset: 47 },
  { name: 'tablet-4x3', w: 1024, h: 768, dpr: 2 },
];
const IDS = Array.from({ length: 24 }, (_, i) => 'l' + (i + 1));
const TIPS = ['build', 'hero', 'spell', 'ult', 'item', 'speed', 'wave', 'upgrade', 'branch', 'map', 'daily', 'spells', 'items', 'zoom', 'hazard', 'hazard_keg', 'elite', 'train', 'night', 'upgrades', 'quests', 'shop'];

function fullSave() {
  const stars = {};
  IDS.forEach((id) => (stars[id] = 3));
  return {
    selectedHero: 'arthur',
    settings: { lang: 'zh', speed: 1, voice: false, sfx: 0, music: 0, art3d: false },
    stars,
    gems: 200,
    newsSeen: 999,
    storySeen: IDS,
    unlockedSeen: IDS,
    seenEnemies: ['goblin', 'raider', 'wolf'],
    tipsSeen: TIPS,
    tutorialDone: true,
    heroesSeen: ['arthur', 'elena', 'lila', 'rain', 'aria', 'sharon', 'viktor', 'shadow'],
  };
}

/** 在頁面裡跑：檢查一個場景所有可點物件 */
function inspect(sceneKey) {
  const g = window.__td;
  const s = g.scene.getScene(sceneKey);
  const cam = s.cameras.main;
  // 畫面上看得到的世界範圍（用相機自己的換算，不管原點設在哪）
  const p0 = cam.getWorldPoint(0, 0);
  const p1 = cam.getWorldPoint(cam.width, cam.height);
  const view = new Phaser.Geom.Rectangle(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
  const k = cam.width / view.width;
  const ptr = s.input.activePointer;
  const big = (o) => {
    const b = o.getBounds();
    return b.width * b.height > 0.3 * view.width * view.height;
  };
  const shown = (o) => {
    for (let p = o; p; p = p.parentContainer) if (!p.visible || p.alpha === 0 || !p.active) return false;
    return true;
  };
  const name = (o) => {
    for (let p = o; p; p = p.parentContainer) {
      if (p.label?.text) return `「${p.label.text}」`;
      if (p.icon?.texture?.key) return `[${p.icon.texture.key}]`;
      if (p.getData?.('name')) return p.getData('name');
    }
    const b = o.getBounds();
    return `${o.type}@${Math.round(b.centerX)},${Math.round(b.centerY)}`;
  };
  const same = (a, b) => {
    for (let p = a; p; p = p.parentContainer) if (p === b) return true;
    for (let p = b; p; p = p.parentContainer) if (p === a) return true;
    return false;
  };
  const problems = [];
  const list = s.input._list.filter((o) => o.input?.enabled && shown(o));
  let checked = 0;
  for (const o of list) {
    const b = o.getBounds();
    // 整片的底圖、遮罩不算按鈕
    if (big(o) || b.width < 4 || b.height < 4) continue;
    checked++;
    if (b.x < view.x - 2 || b.y < view.y - 2 || b.right > view.right + 2 || b.bottom > view.bottom + 2) problems.push(`${name(o)} 超出畫面`);
    ptr.position.set(cam.x + (b.centerX - view.x) * k, cam.y + (b.centerY - view.y) * k);
    const hits = s.input.sortGameObjects(s.input.hitTestPointer(ptr), ptr);
    const top = hits[0];
    // 被彈出視窗的半透明底蓋住是正常的（視窗開著時本來就不能點後面）；地圖節點被關卡面板蓋住也是（面板浮在地圖上）。
    // 被別的按鈕、節點蓋住才算
    const panel = s.infoPanel;
    const nodeUnderPanel = sceneKey === 'Map' && o.type === 'Arc' && panel && same(top, panel);
    if (top && top !== o && !same(top, o) && !big(top) && !nodeUnderPanel) problems.push(`${name(o)} 被 ${name(top)} 蓋住`);
  }
  return { checked, problems };
}

/** 不要讓每日登入獎勵、地圖提示泡泡蓋住要檢查的畫面 */
function quietSave(sv) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  sv.login = { last: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, streak: 1 };
  localStorage.setItem('kb_td_save_v1', JSON.stringify(sv));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let failed = 0;
  for (const d of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (d.inset) {
      // 模擬 iPhone 橫拿時左右的安全區域
      await page.route('**/td.html', async (route) => {
        const r = await route.fetch();
        const body = (await r.text()).replace('env(safe-area-inset-left, 0px)', `${d.inset}px`).replace('env(safe-area-inset-right, 0px)', `${d.inset}px`);
        await route.fulfill({ response: r, body });
      });
    }
    await page.addInitScript(quietSave, fullSave());
    await page.goto(URL);
    await page.waitForFunction(() => window.__td && window.__td.scene.isActive('Menu'), null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const step = async (label, scene) => {
      const r = await page.evaluate(inspect, scene);
      await page.screenshot({ path: path.join(OUT, `${d.name}-${label}.png`), timeout: 120000 });
      const bad = [...r.problems, ...errors.splice(0).map((e) => `程式錯誤：${e}`)];
      console.log(`${bad.length ? 'FAIL' : 'ok  '} ${d.name} ${label}（檢查 ${r.checked} 個可點物件）`);
      for (const p of bad) console.log(`       ${p}`);
      failed += bad.length;
    };
    const go = async (key, data) => {
      await page.evaluate(([k, v]) => {
        const g = window.__td;
        for (const s of g.scene.getScenes(true)) s.scene.stop();
        g.scene.start(k, v);
      }, [key, data]);
      await page.waitForFunction((k) => window.__td.scene.isActive(k), key, { timeout: 120000 });
      await page.waitForTimeout(2000);
    };
    await step('menu', 'Menu');
    await go('Map');
    // 地圖一進來會自動打開最新關卡的面板；先關掉看整張地圖
    await page.evaluate(() => {
      const m = window.__td.scene.getScene('Map');
      m.infoPanel?.destroy();
      m.infoPanel = null;
    });
    await page.waitForTimeout(300);
    await step('map', 'Map');
    await page.evaluate(() => window.__td.scene.getScene('Map').showLevel(0));
    await page.waitForTimeout(800);
    await step('map-panel', 'Map');
    await go('Level', { levelId: 'l2', difficulty: 'normal', mode: 'campaign' });
    await page.waitForFunction(() => window.__td.scene.getScene('Level').world, null, { timeout: 120000 });
    await page.evaluate(() => {
      const ui = window.__td.scene.getScene('LevelUI');
      try {
        while (ui.modal) ui.closeModal();
      } catch {
        // 沒有開著的視窗
      }
      window.__td.scene.getScene('Level').togglePause(false);
    });
    await page.waitForTimeout(800);
    await step('battle', 'LevelUI');
    await page.evaluate(() => window.__td.scene.getScene('Level').togglePause(true));
    await page.waitForTimeout(800);
    await step('pause', 'LevelUI');
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `${failed} 個問題（截圖在 ${OUT}）` : `全部通過（截圖在 ${OUT}）`);
  process.exit(failed ? 1 : 0);
})();
