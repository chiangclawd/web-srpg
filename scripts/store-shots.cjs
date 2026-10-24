// 商店截圖：自動擺好幾個精彩畫面，輸出 App Store（iPhone 6.5 吋橫向 2778×1284）與 Google Play（1920×1080）兩種尺寸。
// 先 npm run build && npx vite preview --port 4173，再：
//   node scripts/store-shots.cjs [輸出資料夾，預設 store-shots/] [語言 zh|en，預設 zh]
// （Playwright 用全域安裝的版本時設 PLAYWRIGHT=/path/to/playwright）
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const OUT = path.resolve(process.argv[2] ?? 'store-shots');
const LANG = process.argv[3] ?? 'zh';
const URL = process.env.GAME_URL ?? 'http://localhost:4173/td.html';
const SIZES = [
  { name: 'appstore-6.5', w: 1389, h: 642, dpr: 2 },
  { name: 'googleplay', w: 1920, h: 1080, dpr: 1 },
];
// 戰鬥畫面：關卡、英雄、敵人（沿路排開）、要升級成特化塔的數量
const BATTLES = [
  { id: '02-forest', level: 'l3', hero: 'arthur', enemies: ['wolf', 'raider', 'troll', 'wolf', 'hunter', 'raider', 'goblin', 'wolf', 'werewolf', 'raider'], branches: 2 },
  { id: '03-snow', level: 'l4', hero: 'elena', enemies: ['rider', 'griffin', 'troll', 'lancer', 'griffin', 'blackguard', 'rider', 'wolf', 'griffin'], branches: 3 },
  { id: '04-night', level: 'l18', hero: 'shadow', enemies: ['werewolf', 'bat', 'bat', 'necromancer', 'skeleton', 'skeleton', 'demon', 'bat', 'werewolf', 'assassin'], branches: 4 },
  { id: '05-volcano', level: 'l16', hero: 'viktor', enemies: ['demon', 'magma_imp', 'cultist', 'adept', 'demon', 'magma_imp', 'lava_golem', 'cultist'], branches: 4 },
];
const IDS = Array.from({ length: 22 }, (_, i) => 'l' + (i + 1));
const TIPS = ['build', 'hero', 'spell', 'ult', 'item', 'speed', 'wave', 'upgrade', 'branch', 'map', 'daily', 'spells', 'items', 'zoom', 'hazard', 'hazard_keg', 'elite', 'train', 'night'];

function saveFor(hero) {
  const stars = {};
  IDS.forEach((id) => (stars[id] = 3));
  return {
    selectedHero: hero,
    settings: { lang: LANG, speed: 1, voice: false, sfx: 0, music: 0, art3d: true },
    stars,
    unlockedSeen: IDS,
    newsSeen: 999,
    storySeen: IDS,
    seenEnemies: [],
    tipsSeen: TIPS,
    heroesSeen: ['arthur', 'elena', 'lila', 'rain', 'aria', 'sharon', 'viktor', 'shadow'],
    stats: { kills: 4821, victories: 64, towers: 1290 },
  };
}

async function shot(page, file) {
  await page.waitForTimeout(400);
  // 軟體繪圖（沒有 GPU 的環境）一張大圖要畫很久
  await page.screenshot({ path: file, timeout: 240000 });
  console.log('saved', path.relative(process.cwd(), file));
}

async function boot(browser, size, hero) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dpr });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.addInitScript((sv) => localStorage.setItem('kb_td_save_v1', JSON.stringify(sv)), saveFor(hero));
  await page.goto(URL);
  await page.waitForFunction(() => window.__td && window.__td.scene.isActive('Menu'), null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  return page;
}

async function battle(browser, size, b, dir) {
  const page = await boot(browser, size, b.hero);
  await page.evaluate((lv) => {
    const g = window.__td;
    for (const s of g.scene.getScenes(true)) s.scene.stop();
    g.scene.start('Level', { levelId: lv, difficulty: 'normal', mode: 'campaign' });
  }, b.level);
  await page.waitForFunction(() => window.__td.scene.isActive('Level') && window.__td.scene.getScene('Level').world, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  await page.evaluate((b) => {
    const ui = window.__td.scene.getScene('LevelUI');
    try { while (ui.modal) ui.closeModal(); } catch {}
    const l = window.__td.scene.getScene('Level');
    l.togglePause(false);
    const w = l.world;
    w.lives = 20;
    w.gold = 1e6;
    // 每個建塔點輪流蓋四種塔，升到三級；前幾座選特化
    const types = ['archer', 'mage', 'barracks', 'artillery'];
    let branched = 0;
    w.spots.forEach((sp, i) => {
      const t = w.build(i, types[i % types.length]);
      if (!t) return;
      t.buildUntil = 0;
      w.upgrade(t); t.buildUntil = 0;
      w.upgrade(t); t.buildUntil = 0;
      if (branched < b.branches && w.chooseBranch(t, i % 2)) { t.buildUntil = 0; branched++; }
    });
    w.gold = 1480;
    // 敵人沿路排開
    const len = w.paths?.[0]?.length ?? 900;
    b.enemies.forEach((id, i) => w.spawnEnemy(id, i % Math.max(1, w.paths?.length ?? 1), len * (0.18 + 0.62 * (i / b.enemies.length))));
  }, b);
  // 跑幾秒，讓塔開火、士兵上前
  await page.evaluate(() => {
    const g = window.__td;
    g.loop.sleep();
    let now = performance.now();
    for (let i = 0; i < 150; i++) { now += 1000 / 60; g.step(now, 1000 / 60); }
    const ui = g.scene.getScene('LevelUI');
    try { while (ui.modal) ui.closeModal(); } catch {}
    for (let i = 0; i < 2; i++) { now += 1000 / 60; g.step(now, 1000 / 60); }
    // 擺好之後讓遊戲照常跑：截圖要等瀏覽器畫出新的一幀
    g.loop.wake();
  });
  await shot(page, path.join(dir, `${b.id}.png`));
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const size of SIZES) {
    const dir = path.join(OUT, `${size.name}-${LANG}`);
    fs.mkdirSync(dir, { recursive: true });
    // 標題畫面
    let page = await boot(browser, size, 'arthur');
    await shot(page, path.join(dir, '01-title.png'));
    // 世界地圖
    await page.evaluate(() => {
      const g = window.__td;
      for (const s of g.scene.getScenes(true)) s.scene.stop();
      g.scene.start('Map');
    });
    await page.waitForFunction(() => window.__td.scene.isActive('Map'), null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    await shot(page, path.join(dir, '06-map.png'));
    // 英雄
    await page.evaluate(() => {
      const g = window.__td;
      for (const s of g.scene.getScenes(true)) s.scene.stop();
      g.scene.start('Hero');
    });
    await page.waitForFunction(() => window.__td.scene.isActive('Hero'), null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    await shot(page, path.join(dir, '07-heroes.png'));
    await page.close();
    for (const b of BATTLES) await battle(browser, size, b, dir);
  }
  await browser.close();
})();
