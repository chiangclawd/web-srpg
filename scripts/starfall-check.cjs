// 《星墜殘響》瀏覽器檢查：
//   1. 用手機尺寸 + 觸控實際點一遍第一關（選取、移動、退回、攻擊預估與確認、警戒、結束回合、選單）
//   2. 機庫：用零件買強化和專屬改造，確認存檔、餘額和開戰時的數值
//   3. 大地圖（後日談）：小地圖點了鏡頭會移過去，「下一台」會輪流選還沒行動的機體
//   4. 被機體擋住的落點和敵人：穿過前面那台點得到，連點兩下算前面那台
//   5. 圖鑑・成就：標題進得去、方塊和分頁點得到；戰鬥裡遇到的機體會記下來，成就會跳提示、結算畫面會列出來
//   6. 挑戰模式：主線打完才有入口；從挑戰的列表出擊敵人比較強，過關拿到徽章，回到的還是挑戰的列表
//   7. 每個任務各用自動對戰打完一次（我方也交給 AI），確認演出、敵方回合、結算都沒有程式錯誤
// 用法：先 npx vite build && npx vite preview --port 4173，再 node scripts/starfall-check.cjs [截圖資料夾]
// （Playwright 用全域安裝的版本時設 PLAYWRIGHT=/path/to/playwright；GAME_URL 可改網址；ONLY=click,hangar,big,pick,codex,challenge,m10 只跑其中幾段；
//   SLOW=4 把網頁的 CPU 放慢四倍，用來重現 CI 上慢的機器。CI 把這份檢查拆成幾個平行的工作，見 .github/workflows/phone-check.yml）
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const OUT = process.argv[2] ?? 'starfall-check';
const URL = process.env.GAME_URL ?? 'http://localhost:4173/starfall.html';
const TIPS = ['tip_move', 'tip_flank', 'tip_cover', 'tip_overwatch', 'tip_forecast'];
const ALL_TIPS = [...TIPS, 'tip_leap', 'tip_shield', 'tip_mender', 'tip_rally', 'tip_hold', 'tip_drones', 'tip_thunderer', 'tip_projector'];
const ALL_STARS = Object.fromEntries(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'].map((m) => [m, 3]));
// 六台機體全部改滿（後日談的自動對戰用）
const MAXED = {
  kai: { plating: 3, firepower: 3, mods: ['kai_link', 'kai_burst'] },
  bruno: { plating: 3, firepower: 3, mods: ['bruno_reactive', 'bruno_longshock'] },
  vey: { plating: 3, firepower: 3, mods: ['vey_scope', 'vey_core'] },
  echo: { plating: 3, firepower: 3, mods: ['echo_nano', 'echo_relay'] },
  sparrow: { plating: 3, firepower: 3, mods: ['sparrow_thrust', 'sparrow_barrel'] },
  hale_ally: { plating: 3, firepower: 3, mods: ['hale_net', 'hale_phalanx'] },
};
// CI 把這份檢查拆成幾個平行的工作，一個工作跑一份（PART=ui）。每一段都要放進其中一份，漏掉的話這支程式一開始就會報錯；
// 多加一份的時候 .github/workflows/phone-check.yml 的 matrix 也要加（tests/starfall/ci.test.ts 會對）。
const PARTS = {
  ui: ['click', 'hangar', 'big', 'pick', 'codex', 'challenge'],
  'ch1-2': ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
  ch3: ['m7', 'm8', 'm9'],
  epilogue: ['m10', 'm11', 'm12'],
};
let failed = 0;

const ok = (cond, msg, extra) => {
  if (cond) {
    console.log(`ok   ${msg}`);
  } else {
    failed++;
    console.log(`FAIL ${msg}${extra ? ` ${JSON.stringify(extra)}` : ''}`);
  }
};

async function open(browser, view, save) {
  const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: view.dpr, isMobile: !!view.touch, hasTouch: !!view.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ok(false, `程式錯誤：${e.message}`));
  // SLOW=4：把網頁的 CPU 放慢四倍，在自己的電腦上重現 CI 上比較慢的機器
  if (process.env.SLOW) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.SLOW) });
  await page.addInitScript((s) => localStorage.setItem('starfall_save_v1', JSON.stringify(s)), { lang: 'zh', sfx: 0, music: 0, stars: {}, tips: [], fast: true, ...save });
  await page.goto(URL);
  await page.waitForFunction(() => window.__sf && window.__sf.scene.isActive('SfTitle'), null, { timeout: 120000 });
  return { ctx, page };
}

const idle = (page, timeout = 60000) => page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode !== 'busy', null, { timeout });

/**
 * 連點兩下。兩下的時間直接寫在觸控事件裡（相隔 0.12 秒），遊戲是照事件的時間判斷連點的，
 * 所以機器再慢結果也一樣。分兩次 tap 送的話，慢的機器上兩下會隔超過 0.35 秒，被當成點了兩次。
 */
async function doubleTap(page, p) {
  const cdp = await page.context().newCDPSession(page);
  const t = Date.now() / 1000;
  const send = (type, at) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p[0], y: p[1] }], timestamp: at });
  await send('touchStart', t);
  await send('touchEnd', t + 0.03);
  await send('touchStart', t + 0.12);
  await send('touchEnd', t + 0.15);
  await cdp.detach();
}

/** 觸控點擊與「用按鈕上的文字找按鈕」 */
function ui(page) {
  const tap = async (p) => {
    await page.touchscreen.tap(p[0], p[1]);
    await page.waitForTimeout(350);
  };
  // 介面按鈕（用上面的文字找）→ 網頁座標
  const button = (scene, label) =>
    page.evaluate(
      ([scene, label]) => {
        const g = window.__sf;
        let hit = null;
        const walk = (o) => {
          if (hit || !o.list) return;
          const match = (t) => (label.endsWith('*') ? t.startsWith(label.slice(0, -1)) : t === label);
          if (o.list.some((c) => c.type === 'Text' && match(c.text)) && o.list.some((c) => c.type === 'Rectangle')) {
            const m = o.getWorldTransformMatrix();
            hit = [m.tx, m.ty];
            return;
          }
          o.list.forEach(walk);
        };
        g.scene.getScene(scene).children.list.forEach(walk);
        if (!hit) return null;
        const c = g.canvas.getBoundingClientRect();
        const k = c.height / 720;
        return [c.left + hit[0] * k, c.top + hit[1] * k];
      },
      [scene, label],
    );
  const press = async (scene, label) => {
    const p = await button(scene, label);
    ok(!!p, `找得到「${label}」按鈕`);
    if (p) await tap(p);
  };
  return { tap, button, press };
}

/** 實際點擊：標題 → 任務列表 → 第一關的第 1 回合 */
async function clickThrough(browser) {
  const view = { w: 844, h: 390, dpr: 2, touch: true };
  const { ctx, page } = await open(browser, view, {});
  const { tap, press } = ui(page);
  // 地圖格子 → 網頁座標
  const tile = (x, y, up = 0) =>
    page.evaluate(
      ([x, y, up]) => {
        const g = window.__sf;
        const s = g.scene.getScene('SfBattle');
        const cam = s.cameras.main;
        const wx = (x - y) * 48;
        const wy = (x + y) * 24 - s.battle.heightAt(x, y) * 24 - up;
        const c = g.canvas.getBoundingClientRect();
        return [c.left + (((wx - cam.midPoint.x) * cam.zoom + cam.width / 2) * c.width) / g.canvas.width, c.top + (((wy - cam.midPoint.y) * cam.zoom + cam.height / 2) * c.height) / g.canvas.height];
      },
      [x, y, up],
    );
  const state = () =>
    page.evaluate(() => {
      const s = window.__sf.scene.getScene('SfBattle');
      const b = s.battle;
      const u = (id) => b.units.find((v) => v.def.id === id);
      return { mode: s.mode, sel: s.sel?.def.id ?? null, turn: b.turn, phase: b.phase, kai: [u('kai').x, u('kai').y, u('kai').acted], bruno: [u('bruno').x, u('bruno').y, u('bruno').acted, u('bruno').overwatch], aim: s.aim, pending: s.pending?.kind ?? null };
    });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `click-${n}.png`) });

  await shot('01-title');
  await press('SfTitle', '開始作戰');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfMissions'));
  await page.waitForTimeout(400);
  await shot('02-missions');
  await press('SfMissions', '出擊');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfDialogue'), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  // 點兩下對話：第一下顯示整句，第二下換下一句
  await tap([view.w / 2, view.h * 0.4]);
  await tap([view.w / 2, view.h * 0.4]);
  ok((await page.evaluate(() => window.__sf.scene.getScene('SfDialogue').i)) === 1, '點對話會前進到下一句');
  await shot('03-dialogue');
  await press('SfDialogue', '跳過');
  await page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode === 'idle', null, { timeout: 30000 });
  await page.waitForTimeout(1300);

  await tap(await tile(1, 4, 30));
  let s = await state();
  ok(s.sel === 'kai' && s.mode === 'unit', '點機體選到凱', s);
  await shot('04-select');
  await tap(await tile(4, 4));
  await idle(page);
  s = await state();
  ok(s.kai[0] === 4 && s.kai[1] === 4 && s.sel === 'kai', '點藍色格子移動過去', s);
  await press('SfHud', '退回');
  s = await state();
  ok(s.kai[0] === 1 && s.kai[1] === 4, '退回移動', s);
  await tap(await tile(4, 3));
  await idle(page);
  await press('SfHud', '攻擊');
  s = await state();
  ok(s.mode === 'target' && s.aim && s.aim.x === 6 && s.aim.y === 3, '按攻擊：只有一個目標時自動瞄準並顯示預估', s);
  await shot('05-forecast');
  await press('SfHud', '確定');
  await idle(page);
  s = await state();
  ok(s.kai[2] === true, '確定後凱已行動', s);
  await tap(await tile(1, 5, 30));
  s = await state();
  ok(s.sel === 'bruno', '選到布魯諾', s);
  await tap(await tile(3, 5));
  await idle(page);
  await press('SfHud', '警戒');
  await idle(page);
  s = await state();
  ok(s.bruno[2] === true && s.bruno[3] === true && s.sel === null, '布魯諾進入警戒', s);
  // 還有艾可沒動：結束回合要按兩次
  await press('SfHud', '結束回合');
  s = await state();
  ok(s.phase === 'player' && s.turn === 1, '第一次按結束回合只提醒', s);
  await press('SfHud', '結束回合');
  await page.waitForFunction(
    () => {
      const b = window.__sf.scene.getScene('SfBattle');
      return b.battle.turn === 2 && b.mode === 'idle';
    },
    null,
    { timeout: 90000 },
  );
  ok(true, '敵方行動完進入第 2 回合');
  await page.waitForTimeout(1200);
  await shot('06-turn2');
  // 點敵人：顯示資訊和威脅範圍
  const foe = await page.evaluate(() => {
    const e = window.__sf.scene.getScene('SfBattle').battle.units.find((u) => u.alive && u.side === 'enemy');
    return [e.x, e.y, e.def.id];
  });
  await tap(await tile(foe[0], foe[1], 14));
  s = await state();
  ok(s.sel === foe[2], '點敵人顯示資訊', s);
  await shot('07-enemy');
  await ctx.close();
}

/** 機庫：手機尺寸實際點一遍 —— 進機庫、買一級裝甲、零件扣掉、回任務列表、開戰時數值真的變了 */
async function hangarCheck(browser) {
  const view = { w: 667, h: 375, dpr: 2, touch: true };
  const { ctx, page } = await open(browser, view, { stars: { m1: 3 }, tips: TIPS });
  const { tap, press } = ui(page);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('starfall_save_v1')).upgrades ?? {});
  // 第 n 顆「購買」按鈕的網頁座標（按鈕上只有價格，用名字找比較穩）
  const buy = async (n) => {
    const pos = await page.evaluate((n) => {
      const g = window.__sf;
      const b = g.scene.getScene('SfHangar').root.list.filter((o) => o.name === 'buy')[n];
      if (!b) return null;
      const m = b.getWorldTransformMatrix();
      const c = g.canvas.getBoundingClientRect();
      const k = c.height / 720;
      return [c.left + m.tx * k, c.top + m.ty * k];
    }, n);
    ok(!!pos, `找得到第 ${n + 1} 顆購買按鈕`);
    if (pos) await tap(pos);
  };
  await press('SfTitle', '開始作戰');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfMissions'));
  await page.waitForTimeout(400);
  await press('SfMissions', '機庫*');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfHangar'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'hangar-1.png') });
  // 六台機體都看一次，還沒加入的也畫出來檢查排版：每顆按鈕都要完整留在畫面裡（手機上整個畫面會放大，最容易超出去）
  const out = await page.evaluate(() => {
    const g = window.__sf;
    const s = g.scene.getScene('SfHangar');
    const w = g.scale.width / s.cameras.main.zoom;
    const bad = [];
    const walk = (o, f) => {
      if (o.type === 'Rectangle' && o.input?.enabled) {
        const m = o.getWorldTransformMatrix();
        const hw = (o.width * m.scaleX) / 2;
        const hh = (o.height * m.scaleY) / 2;
        if (m.tx - hw < -1 || m.ty - hh < -1 || m.tx + hw > w + 1 || m.ty + hh > 721) bad.push([f, Math.round(m.tx), Math.round(m.ty), Math.round(hw * 2), Math.round(hh * 2)]);
      }
      o.list?.forEach((c) => walk(c, f));
    };
    const first = s.frame;
    for (const f of ['kai', 'bruno', 'vey', 'echo', 'sparrow', 'hale_ally']) {
      s.frame = f;
      s.draw();
      s.children.list.forEach((c) => walk(c, f));
    }
    s.frame = first;
    s.draw();
    return bad;
  });
  ok(out.length === 0, '機庫的按鈕都在畫面裡（六台機體都看過）', out);
  await buy(0);
  let up = await saved();
  ok(up.kai?.plating === 1, '買了一級複合裝甲', up);
  await page.screenshot({ path: path.join(OUT, 'hangar-2.png') });
  // 換一台機體，裝專屬改造（剩 90，剛好一個）
  const tab = await page.evaluate(() => {
    const g = window.__sf;
    const s = g.scene.getScene('SfHangar');
    const t = s.root.list.find((o) => o.type === 'Text' && o.text === '鐵砧');
    const m = t.getWorldTransformMatrix();
    const c = g.canvas.getBoundingClientRect();
    const k = c.height / 720;
    return [c.left + m.tx * k, c.top + m.ty * k];
  });
  await tap(tab);
  ok((await page.evaluate(() => window.__sf.scene.getScene('SfHangar').frame)) === 'bruno', '點列表換到鐵砧');
  await buy(2);
  up = await saved();
  ok(up.bruno?.mods?.length === 1, '裝了一個專屬改造', up);
  ok((await page.evaluate(() => window.__sf.scene.getScene('SfHangar').root.list.filter((o) => o.name === 'buy' && o.enabled).length)) === 0, '零件用完，剩下的都買不起');
  await page.screenshot({ path: path.join(OUT, 'hangar-3.png') });
  // 拆掉鐵砧的改造：90 零件全額退還，存檔裡也拿掉
  await press('SfHangar', '拆除全部*');
  up = await saved();
  const left = await page.evaluate(() => window.__sf.scene.getScene('SfHangar').root.list.filter((o) => o.name === 'buy' && o.enabled).length);
  ok(!up.bruno && left > 0, '拆除全部：改造拿掉、零件退回來又買得起了', { up, left });
  await press('SfHangar', '返回');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfMissions'));
  await page.waitForTimeout(400);
  await press('SfMissions', '機庫*');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfHangar'));
  await page.waitForTimeout(400);
  // 開戰：凱的耐久 100 → 110（改造後的數值真的帶進戰鬥）
  await page.evaluate(() => {
    const g = window.__sf;
    g.scene.stop('SfHangar');
    g.scene.start('SfBattle', { missionId: 'm1' });
  });
  await page.waitForFunction(() => window.__sf.scene.isActive('SfDialogue'), null, { timeout: 30000 });
  const hp = await page.evaluate(() => window.__sf.scene.getScene('SfBattle').battle.units.find((u) => u.def.id === 'kai').maxHp);
  ok(hp === 110, '開戰時凱的耐久是改造後的 110', { hp });
  await ctx.close();
}

/** 大地圖：手機尺寸進第十關，點小地圖、按「下一台」 */
async function bigMapCheck(browser) {
  const view = { w: 844, h: 390, dpr: 2, touch: true };
  const { ctx, page } = await open(browser, view, { stars: ALL_STARS, tips: ALL_TIPS });
  const { tap, press } = ui(page);
  await page.evaluate(() => {
    const g = window.__sf;
    g.scene.stop('SfTitle');
    g.scene.start('SfBattle', { missionId: 'm10' });
  });
  await page.waitForFunction(() => window.__sf.scene.isActive('SfDialogue'), null, { timeout: 30000 });
  await page.evaluate(() => window.__sf.scene.getScene('SfDialogue').skip());
  await page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode === 'idle', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  const st = () =>
    page.evaluate(() => {
      const s = window.__sf.scene.getScene('SfBattle');
      const v = s.cameras.main.worldView;
      return { big: s.big, sel: s.sel?.uid ?? null, cx: Math.round(v.centerX), cy: Math.round(v.centerY), mini: !!window.__sf.scene.getScene('SfHud').miniDyn };
    });
  let a = await st();
  ok(a.big && a.mini, '第十關是大地圖，介面上有小地圖', a);
  await page.screenshot({ path: path.join(OUT, 'big-1.png') });
  // 小地圖的網頁座標：點它的右半邊，鏡頭應該往右移
  const mini = await page.evaluate(() => {
    const g = window.__sf;
    const h = g.scene.getScene('SfHud');
    const m = h.ml.getWorldTransformMatrix();
    const c = g.canvas.getBoundingClientRect();
    const k = c.height / 720;
    return { x: c.left + m.tx * k, y: c.top + m.ty * k, w: 176 * m.scaleX * k, h: 92 * m.scaleY * k };
  });
  await tap([mini.x + mini.w * 0.8, mini.y + mini.h * 0.6]);
  let b = await st();
  ok(b.cx > a.cx + 200, '點小地圖右邊，鏡頭往右移', { before: a, after: b });
  ok((await page.evaluate(() => window.__sf.scene.getScene('SfBattle').mode)) === 'idle', '點小地圖不會被當成點地圖（沒有選到東西）');
  await tap([mini.x + mini.w * 0.25, mini.y + mini.h * 0.35]);
  // 下一台：按兩次選到兩台不同的機體，鏡頭跟過去
  await press('SfHud', '下一台*');
  a = await st();
  ok(a.sel !== null, '按「下一台」選到一台還沒行動的機體', a);
  await press('SfHud', '下一台*');
  b = await st();
  ok(b.sel !== null && b.sel !== a.sel, '再按一次換下一台', { first: a.sel, second: b.sel });
  await page.screenshot({ path: path.join(OUT, 'big-2.png') });
  // 鏡頭自動移動到一半被小地圖打斷：等鏡頭的演出要照樣往下走，不能卡住
  const freed = await page.evaluate(async () => {
    const s = window.__sf.scene.getScene('SfBattle');
    s.toIdle();
    const p = s.focus(21, 13);
    s.lookAt(100, 100);
    return Promise.race([p.then(() => 'resolved'), new Promise((r) => setTimeout(() => r('pending'), 1500))]);
  });
  ok(freed === 'resolved', '鏡頭移動被小地圖打斷後，等它的演出會繼續', { freed });
  // 實際情境：敵方回合一邊演出一邊狂點小地圖，最後要回到我方回合
  await page.evaluate(() => void window.__sf.scene.getScene('SfBattle').endTurn(true));
  for (let i = 0; i < 30; i++) {
    await page.touchscreen.tap(mini.x + mini.w * (0.2 + 0.6 * ((i * 7) % 10) / 10), mini.y + mini.h * (0.3 + 0.4 * ((i * 3) % 10) / 10));
    await page.waitForTimeout(120);
  }
  const back = await page
    .waitForFunction(
      () => {
        const s = window.__sf.scene.getScene('SfBattle');
        return s.mode === 'idle' && s.battle.phase === 'player' && s.battle.turn === 2;
      },
      null,
      { timeout: 90000 },
    )
    .then(() => true)
    .catch(() => false);
  ok(back, '敵方回合中狂點小地圖，戰鬥不會卡住（回到第 2 回合）', await st());
  await ctx.close();
}

/** 自動對戰：整關照正常流程演出一次。後日談的關卡預期玩家已經有改造，用全部改滿的存檔打 */
/**
 * 被機體擋住的格子和敵人：手機尺寸實際點。機體比格子高，會蓋住身後那一格；
 * 走得到的落點、打得到的敵人要能穿過前面那台點到，連點兩下則一律算前面那台。
 */
async function pickCheck(browser) {
  const view = { w: 844, h: 390, dpr: 2, touch: true };
  const { ctx, page } = await open(browser, view, { tips: ALL_TIPS });
  await page.evaluate(() => {
    const g = window.__sf;
    g.scene.stop('SfTitle');
    g.scene.start('SfBattle', { missionId: 'm1' });
  });
  await page.waitForFunction(() => window.__sf.scene.isActive('SfDialogue'), null, { timeout: 30000 });
  await page.evaluate(() => window.__sf.scene.getScene('SfDialogue').skip());
  await page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode === 'idle', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  // 把單位擺到指定的格子（沒提到的停到角落）、回合狀態歸零、取消選取
  const setup = (spec) =>
    page.evaluate((spec) => {
      const s = window.__sf.scene.getScene('SfBattle');
      const b = s.battle;
      s.toIdle();
      const used = new Set();
      let park = 0;
      for (const u of b.units) {
        if (!u.alive) continue;
        const want = spec.find((q) => q.id === u.def.id && !used.has(q));
        if (want) {
          used.add(want);
          u.x = want.x;
          u.y = want.y;
        } else {
          u.x = 11 - (park % 2);
          u.y = 9 - Math.floor(park / 2);
          park++;
        }
        Object.assign(u, { moved: false, acted: false, overwatch: false, stun: 0, hp: u.maxHp });
        const v = s.view(u.uid);
        v.place(u.x, u.y);
        v.refresh();
      }
      s.lookAt(6, 216);
    }, spec);
  // (3,6) 的正中央：站在 (4,7) 的機體胸口的位置
  const behind = () =>
    page.evaluate(() => {
      const g = window.__sf;
      const cam = g.scene.getScene('SfBattle').cameras.main;
      const c = g.canvas.getBoundingClientRect();
      return [c.left + (((-144 - cam.midPoint.x) * cam.zoom + cam.width / 2) * c.width) / g.canvas.width, c.top + (((216 - cam.midPoint.y) * cam.zoom + cam.height / 2) * c.height) / g.canvas.height];
    });
  const tap = async (p, wait) => {
    await page.touchscreen.tap(p[0], p[1]);
    await page.waitForTimeout(wait);
  };
  const select = (id) => page.evaluate((id) => window.__sf.scene.getScene('SfBattle').select(window.__sf.scene.getScene('SfBattle').battle.units.find((u) => u.def.id === id)), id);
  const state = () =>
    page.evaluate(() => {
      const s = window.__sf.scene.getScene('SfBattle');
      const b = s.battle;
      const u = (id) => b.units.find((v) => v.def.id === id);
      return { mode: s.mode, sel: s.sel?.def.id ?? null, peek: s.peek ? [s.peek.x, s.peek.y] : null, aim: s.aim ? [s.aim.x, s.aim.y] : null, kai: [u('kai').x, u('kai').y], ghost: s.view(u('bruno').uid).ghost, foes: b.units.filter((v) => v.def.id === 'worker').reduce((n, v) => n + (v.alive ? v.hp : 0), 0) };
    });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // 走得到的落點在友軍身後
  const move = [{ id: 'kai', x: 2, y: 9 }, { id: 'bruno', x: 4, y: 7 }, { id: 'echo', x: 0, y: 9 }];
  await setup(move);
  await select('kai');
  await page.waitForTimeout(700);
  const p = await behind();
  await tap(p, 900);
  let s = await state();
  ok(same(s.peek, [3, 6]) && same(s.kai, [2, 9]) && s.sel === 'kai' && s.ghost, '點被友軍擋住的落點：先標出來，友軍變半透明，還沒移動', s);
  await page.screenshot({ path: path.join(OUT, 'pick-01-peek.png') });
  await tap(p, 300);
  await idle(page);
  s = await state();
  ok(same(s.kai, [3, 6]) && s.peek === null, '再點一次：走到那一格', s);
  await setup(move);
  await select('kai');
  await page.waitForTimeout(700);
  await doubleTap(page, p);
  await page.waitForTimeout(700);
  s = await state();
  ok(s.sel === 'bruno' && same(s.kai, [2, 9]) && s.peek === null, '在友軍身上連點兩下：改選友軍，沒有移動', s);

  // 打得到的小型敵人躲在友軍身後
  const foe = [{ id: 'kai', x: 1, y: 6 }, { id: 'bruno', x: 4, y: 7 }, { id: 'worker', x: 3, y: 6 }, { id: 'worker', x: 1, y: 4 }, { id: 'echo', x: 0, y: 9 }];
  await setup(foe);
  await select('kai');
  await page.waitForTimeout(700);
  const full = (await state()).foes;
  await doubleTap(page, p);
  await page.waitForTimeout(700);
  s = await state();
  ok(s.sel === 'bruno' && s.mode === 'unit' && s.foes === full, '敵人躲在友軍身後、在那裡連點兩下：改選友軍，沒有開火', s);
  await setup(foe);
  await select('kai');
  await page.waitForTimeout(700);
  s = await state();
  ok(s.ghost, '選了打得到它的機體：擋住敵人的友軍變半透明', s);
  await tap(p, 900);
  s = await state();
  ok(s.mode === 'target' && same(s.aim, [3, 6]) && s.sel === 'kai', '點被擋住的敵人：瞄準它', s);
  await page.screenshot({ path: path.join(OUT, 'pick-02-aim.png') });
  await tap(p, 300);
  await idle(page);
  s = await state();
  ok(s.foes < full, '再點一次：開火', s);
  await ctx.close();
}

/**
 * 圖鑑・成就：手機尺寸實際點。前半是畫面本身（標題進得去、方塊和分頁點得到、沒遇過的不露內容），
 * 後半是戰鬥：遇到的機體記進存檔、把敵人轟進裂谷當下就算成就並跳提示、過關後結算畫面列出這一場達成的。
 */
async function codexCheck(browser) {
  const view = { w: 844, h: 390, dpr: 2, touch: true };
  const { ctx, page } = await open(browser, view, { stars: { m1: 1, m2: 1 }, tips: ALL_TIPS });
  const { tap, press } = ui(page);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('starfall_save_v1')));
  // 畫面上的字（不換行空白換回一般空白）；at = 某一行字的中心在網頁上的位置
  const texts = (scene) =>
    page.evaluate((scene) => {
      const out = [];
      const walk = (l) => {
        for (const o of l) {
          if (o.type === 'Text' && o.visible && o.alpha > 0.2) out.push(o.text.replace(/\u00a0/g, ' '));
          if (o.list) walk(o.list);
        }
      };
      walk(window.__sf.scene.getScene(scene).children.list);
      return out;
    }, scene);
  const at = (scene, label) =>
    page.evaluate(
      ([scene, label]) => {
        const g = window.__sf;
        let t = null;
        const walk = (l) => {
          for (const o of l) {
            if (!t && o.type === 'Text' && o.text === label) t = o;
            if (o.list) walk(o.list);
          }
        };
        walk(g.scene.getScene(scene).children.list);
        if (!t) return null;
        const m = t.getWorldTransformMatrix();
        const c = g.canvas.getBoundingClientRect();
        const k = c.height / 720;
        return [c.left + (m.tx + (0.5 - t.originX) * t.width * m.scaleX) * k, c.top + (m.ty + (0.5 - t.originY) * t.height * m.scaleY) * k];
      },
      [scene, label],
    );
  const codex = () =>
    page.evaluate(() => {
      const s = window.__sf.scene.getScene('SfCodex');
      return { tab: s.tab, unit: s.unit, feat: s.feat };
    });

  await press('SfTitle', '圖鑑・成就');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfCodex'), null, { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  let t = await texts('SfCodex');
  // 前兩關過了：凱、布魯諾、艾可、薇、發電機、工蜂、哨兵、織網者 = 8 種
  ok(t.includes('機體圖鑑 8/27') && t.includes('成就 0/23'), '圖鑑：打完前兩關是 8/27、0/23', t.filter((x) => /\d\/\d/.test(x)));
  ok(t.filter((x) => x === '？？？').length === 19, '沒遇過的 19 格是問號', t.filter((x) => x === '？？？').length);
  let p = await at('SfCodex', '織網者');
  if (p) await tap(p);
  t = await texts('SfCodex');
  ok((await codex()).unit === 'weaver' && t.some((x) => x.startsWith('曲射：')) && t.some((x) => x.startsWith('首次出現：任務 2')), '點「織網者」：右邊是它的被動和第一次出現的任務', t.slice(-4));
  await page.screenshot({ path: path.join(OUT, 'codex-01-unit.png') });
  await press('SfCodex', '成就 0/23');
  t = await texts('SfCodex');
  ok((await codex()).tab === 'feats' && t.includes('尚未達成') && t.includes('完成第一章') && t.includes('2 / 3'), '成就分頁：沒達成的看得到條件和進度（第一章 2 / 3）', t.slice(-5));
  await page.screenshot({ path: path.join(OUT, 'codex-02-feats.png') });
  const before = JSON.stringify(await saved());
  await press('SfCodex', '返回');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfTitle'), null, { timeout: 10000 }).catch(() => undefined);
  ok(JSON.stringify(await saved()) === before, '只是看圖鑑不會改動存檔');

  // 第三關：牧者第一次出現；把哨兵擺在裂谷邊，鐵砧用震盪砲轟下去
  await page.evaluate(() => {
    const g = window.__sf;
    g.scene.stop('SfTitle');
    g.scene.start('SfBattle', { missionId: 'm3' });
  });
  const skip = async (until) => {
    for (let i = 0; i < 120; i++) {
      const done = await page.evaluate((until) => {
        const g = window.__sf;
        if (g.scene.isActive('SfDialogue')) g.scene.getScene('SfDialogue').skip();
        const b = g.scene.getScene('SfBattle');
        return until === 'result' ? !!b.hud && b.hud.modalOpen : g.scene.isActive('SfBattle') && !!b.hud && b.mode === 'idle' && !g.scene.isActive('SfDialogue');
      }, until);
      if (done) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  ok(await skip('idle'), '第三關開場');
  await page.waitForTimeout(400);
  let sv = await saved();
  ok(sv.tips.includes('seen_shepherd') && !sv.tips.includes('seen_kai'), '進第三關：牧者記進圖鑑；過關的任務裡就有的不重複記', sv.tips.filter((x) => x.startsWith('seen_')));
  const spot = await page.evaluate(() => {
    const s = window.__sf.scene.getScene('SfBattle');
    const b = s.battle;
    const bruno = b.units.find((u) => u.def.id === 'bruno');
    const foe = b.units.find((u) => u.side === 'enemy' && u.def.id === 'sentry');
    const free = (x, y) => b.inMap(x, y) && b.terrainAt(x, y) !== 'chasm' && b.terrainAt(x, y) !== 'wall' && !b.unitAt(x, y);
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!free(x, y) || !free(x - dx, y - dy) || !b.inMap(x + dx, y + dy) || b.terrainAt(x + dx, y + dy) !== 'chasm') continue;
          if (b.heightAt(x, y) !== b.heightAt(x - dx, y - dy)) continue;
          bruno.x = x - dx;
          bruno.y = y - dy;
          foe.x = x;
          foe.y = y;
          s.view(bruno.uid).place(bruno.x, bruno.y);
          s.view(foe.uid).place(foe.x, foe.y);
          return { x, y };
        }
      }
    }
    return null;
  });
  ok(!!spot, '第三關：裂谷邊找得到位置擺哨兵和鐵砧', spot);
  if (spot) {
    await page.evaluate((spot) => {
      const s = window.__sf.scene.getScene('SfBattle');
      const b = s.battle;
      void s.play(b.useSkill(b.units.find((u) => u.def.id === 'bruno'), 'shock', spot));
    }, spot);
    await page.waitForTimeout(200);
    sv = await saved();
    ok(sv.tips.includes('ach_fall'), '震盪砲把哨兵轟進裂谷：當下就記進存檔', sv.tips.filter((x) => x.startsWith('ach_')));
    await idle(page);
    await page.waitForTimeout(900);
    t = await texts('SfHud');
    ok(t.includes('成就達成') && t.includes('下去吧'), '演出播完，畫面上方跳出「成就達成　下去吧」', t.slice(-5));
    await page.screenshot({ path: path.join(OUT, 'codex-03-award.png') });
  }
  // 牧者剩 1 點耐久，凱補一槍：過關，第一章完成
  const shot = await page.evaluate(() => {
    const s = window.__sf.scene.getScene('SfBattle');
    const b = s.battle;
    const boss = b.byTag('boss');
    const kai = b.units.find((u) => u.def.id === 'kai');
    boss.hp = 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const x = boss.x + dx;
      const y = boss.y + dy;
      if (!b.inMap(x, y) || !b.canStop(kai, x, y) || !b.canHit(kai, { x, y }, boss.x, boss.y)) continue;
      kai.x = x;
      kai.y = y;
      s.view(kai.uid).place(x, y);
      s.mode = 'idle';
      void s.play(b.attack(kai, boss));
      return b.result;
    }
    return null;
  });
  ok(shot === 'win', '第三關：擊破牧者', shot);
  ok(await skip('result'), '結算畫面出來了');
  await page.waitForTimeout(1200);
  t = await texts('SfHud');
  const line = t.find((x) => x.startsWith('成就達成') && x.length > 5) ?? '';
  ok(line.includes('冰原上的訊號') && line.includes('下去吧'), '結算畫面列出這一場達成的成就（第一章完成、下去吧）', line);
  sv = await saved();
  ok(sv.stars.m3 > 0 && !sv.tips.includes('ach_ch1'), '章節的成就從星數算，不另外寫進存檔', sv.tips.filter((x) => x.startsWith('ach_')));
  await page.screenshot({ path: path.join(OUT, 'codex-04-result.png') });
  await ctx.close();
}

/**
 * 挑戰模式：手機尺寸實際點。主線沒打完看不到入口；打完之後任務列表多一顆「挑戰」，
 * 按下去換成挑戰的列表，從那裡出擊的戰鬥敵人比較強，過關拿到徽章和成就，回到的還是挑戰的列表。
 */
async function challengeCheck(browser) {
  const view = { w: 844, h: 390, dpr: 2, touch: true };
  const main = Object.fromEntries(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'].map((m) => [m, 2]));
  const texts = (page, scene) =>
    page.evaluate((scene) => {
      const out = [];
      const walk = (l) => {
        for (const o of l) {
          if (o.type === 'Text' && o.visible && o.alpha > 0.2) out.push(o.text.replace(/\u00a0/g, ' '));
          if (o.list) walk(o.list);
        }
      };
      walk(window.__sf.scene.getScene(scene).children.list);
      return out;
    }, scene);

  // 還差最後一關：沒有入口
  {
    const { ctx, page } = await open(browser, view, { stars: { ...main, m9: 0 }, tips: ALL_TIPS });
    const { press, button } = ui(page);
    await press('SfTitle', '開始作戰');
    await page.waitForFunction(() => window.__sf.scene.isActive('SfMissions'), null, { timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    ok(!(await button('SfMissions', '挑戰')), '主線還沒打完：任務列表沒有「挑戰」');
    await ctx.close();
  }

  const { ctx, page } = await open(browser, view, { stars: main, tips: ALL_TIPS });
  const { tap, press, button } = ui(page);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('starfall_save_v1')));
  await press('SfTitle', '開始作戰');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfMissions'), null, { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await press('SfMissions', '第 1 章');
  let t = await texts(page, 'SfMissions');
  ok(t.filter((x) => x === '出擊').length === 3 && !t.some((x) => x.includes('挑戰模式')), '主線打完：從標題進來是平常的列表', t);
  await press('SfMissions', '挑戰');
  t = await texts(page, 'SfMissions');
  ok(t.some((x) => x.includes('挑戰模式')) && t.filter((x) => x === '挑戰出擊').length === 3 && t.some((x) => x.includes('+30%') && x.includes('+20%')), '按「挑戰」：三張卡都是「挑戰出擊」，寫著敵方加強多少', t);
  await page.screenshot({ path: path.join(OUT, 'challenge-01-list.png') });

  // 第三張卡（第三關）的「挑戰出擊」
  const third = await page.evaluate(() => {
    const g = window.__sf;
    const hits = [];
    const walk = (o) => {
      if (!o.list) return;
      if (o.list.some((c) => c.type === 'Text' && c.text === '挑戰出擊') && o.list.some((c) => c.type === 'Rectangle')) {
        const m = o.getWorldTransformMatrix();
        hits.push([m.tx, m.ty]);
      }
      o.list.forEach(walk);
    };
    g.scene.getScene('SfMissions').children.list.forEach(walk);
    hits.sort((a, b) => a[0] - b[0]);
    const c = g.canvas.getBoundingClientRect();
    const k = c.height / 720;
    return hits[2] ? [c.left + hits[2][0] * k, c.top + hits[2][1] * k] : null;
  });
  ok(!!third, '找得到第三關的「挑戰出擊」');
  if (third) await tap(third);
  await page.waitForFunction(() => window.__sf.scene.isActive('SfBattle') && !!window.__sf.scene.getScene('SfBattle').hud, null, { timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  ok(!(await page.evaluate(() => window.__sf.scene.isActive('SfDialogue'))), '挑戰模式不再播開場劇情');
  await page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode === 'idle', null, { timeout: 60000 }).catch(() => undefined);
  const st = await page.evaluate(() => {
    const b = window.__sf.scene.getScene('SfBattle').battle;
    return { mission: b.mission.id, hard: b.hard, foes: b.units.filter((u) => u.side === 'enemy').map((u) => [u.def.id, u.maxHp, u.def.hp, u.power]), kai: b.units.find((u) => u.def.id === 'kai').maxHp };
  });
  ok(st.mission === 'm3' && st.hard, '進到第三關，是挑戰模式', st);
  ok(st.foes.length > 0 && st.foes.every(([, hp, base, power]) => hp === Math.round(base * 1.3) && power === 1.2) && st.kai === 100, '敵方耐久 ×1.3、傷害 ×1.2，我方不變', st);
  t = await texts(page, 'SfHud');
  ok(t.some((x) => x.includes('挑戰模式')), '左上角標著「挑戰模式」', t.slice(0, 6));
  await page.screenshot({ path: path.join(OUT, 'challenge-02-battle.png') });

  // 牧者剩 1 點耐久，凱補一槍：過關
  const shot = await page.evaluate(() => {
    const s = window.__sf.scene.getScene('SfBattle');
    const b = s.battle;
    const boss = b.byTag('boss');
    const kai = b.units.find((u) => u.def.id === 'kai');
    boss.hp = 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const x = boss.x + dx;
      const y = boss.y + dy;
      if (!b.inMap(x, y) || !b.canStop(kai, x, y) || !b.canHit(kai, { x, y }, boss.x, boss.y)) continue;
      kai.x = x;
      kai.y = y;
      s.view(kai.uid).place(x, y);
      s.mode = 'idle';
      void s.play(b.attack(kai, boss));
      return b.result;
    }
    return null;
  });
  ok(shot === 'win', '第三關的挑戰：擊破牧者', shot);
  await page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').hud.modalOpen, null, { timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(1800);
  t = await texts(page, 'SfHud');
  const line = t.find((x) => x.startsWith('成就達成') && x.length > 5) ?? '';
  ok(t.includes('挑戰完成') && line.includes('硬碰硬'), '結算畫面：挑戰完成，成就列出「硬碰硬」', t);
  const sv = await saved();
  ok(sv.tips.includes('chal_m3') && !sv.tips.some((x) => x.startsWith('ach_chal')), '存檔記下這一關的徽章；挑戰的成就不另外寫記號', sv.tips.filter((x) => x.startsWith('chal_') || x.startsWith('ach_')));
  await page.screenshot({ path: path.join(OUT, 'challenge-03-result.png') });

  await press('SfHud', '回任務列表');
  await page.waitForFunction(() => window.__sf.scene.isActive('SfMissions'), null, { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  t = await texts(page, 'SfMissions');
  ok(t.some((x) => x.includes('挑戰模式')) && t.filter((x) => x === '挑戰完成').length === 1, '回到的是挑戰的列表，第三關顯示完成', t);
  await page.screenshot({ path: path.join(OUT, 'challenge-04-back.png') });
  await press('SfMissions', '挑戰');
  t = await texts(page, 'SfMissions');
  ok(t.filter((x) => x === '出擊').length === 3 && !t.some((x) => x.includes('挑戰模式')), '再按一次「挑戰」：回到平常的列表', t);
  await ctx.close();
}

async function autoPlay(browser, mission) {
  const epilogue = ['m10', 'm11', 'm12'].includes(mission);
  const { ctx, page } = await open(browser, { w: 1280, h: 720, dpr: 1 }, epilogue ? { stars: ALL_STARS, tips: ALL_TIPS, upgrades: MAXED } : { stars: { m1: 1, m2: 1 }, tips: TIPS });
  await page.evaluate((m) => {
    const g = window.__sf;
    g.scene.stop('SfTitle');
    g.scene.start('SfBattle', { missionId: m });
  }, mission);
  // 對話一出現就跳過
  const skipper = setInterval(() => {
    page
      .evaluate(() => {
        if (window.__sf.scene.isActive('SfDialogue')) window.__sf.scene.getScene('SfDialogue').finish();
      })
      .catch(() => undefined);
  }, 400);
  await page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode === 'idle', null, { timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, `auto-${mission}-start.png`) });
  const result = await page.evaluate(() => window.__sf.scene.getScene('SfBattle').autoBattle());
  await page.waitForTimeout(3000);
  clearInterval(skipper);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `auto-${mission}-end.png`) });
  const turn = await page.evaluate(() => window.__sf.scene.getScene('SfBattle').battle.turn);
  ok(result === 'win', `${mission} 自動對戰打得過（第 ${turn} 回合，結果 ${result}）`);
  await ctx.close();
}

(async () => {
  const sections = { click: clickThrough, hangar: hangarCheck, big: bigMapCheck, pick: pickCheck, codex: codexCheck, challenge: challengeCheck };
  for (const m of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12']) sections[m] = (browser) => autoPlay(browser, m);
  const all = Object.keys(sections);
  const parted = Object.values(PARTS).flat();
  const stray = [...all.filter((k) => !parted.includes(k)), ...parted.filter((k, i) => !all.includes(k) || parted.indexOf(k) !== i)];
  if (stray.length) throw new Error(`PARTS 和實際的段落對不上：${stray.join(', ')}`);
  // PART=ui 跑其中一份（CI 用）；ONLY=big,m10 只跑指定的幾段（開發時用）；都沒設就全部跑
  const { PART, ONLY } = process.env;
  if (PART && !PARTS[PART]) throw new Error(`沒有 ${PART} 這一份，只有 ${Object.keys(PARTS).join(', ')}`);
  const only = PART ? PARTS[PART] : ONLY ? ONLY.split(',') : all;
  const unknown = only.filter((k) => !all.includes(k));
  if (unknown.length) throw new Error(`沒有這幾段：${unknown.join(', ')}（有的是 ${all.join(', ')}）`);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const k of all) {
    if (!only.includes(k)) continue;
    const t = Date.now();
    await sections[k](browser);
    // 每一段花的時間：CI 的機器快慢差到兩倍，哪一段變慢了看這裡
    console.log(`     ── ${k}：${Math.round((Date.now() - t) / 1000)} 秒`);
  }
  await browser.close();
  console.log(failed ? `${failed} 個問題（截圖在 ${OUT}）` : `全部通過（截圖在 ${OUT}）`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
