// 《星墜殘響》瀏覽器檢查：
//   1. 用手機尺寸 + 觸控實際點一遍第一關（選取、移動、退回、攻擊預估與確認、警戒、結束回合、選單）
//   2. 機庫：用零件買強化和專屬改造，確認存檔、餘額和開戰時的數值
//   3. 大地圖（後日談）：小地圖點了鏡頭會移過去，「下一台」會輪流選還沒行動的機體
//   4. 被機體擋住的落點和敵人：穿過前面那台點得到，連點兩下算前面那台
//   5. 每個任務各用自動對戰打完一次（我方也交給 AI），確認演出、敵方回合、結算都沒有程式錯誤
// 用法：先 npx vite build && npx vite preview --port 4173，再 node scripts/starfall-check.cjs [截圖資料夾]
// （Playwright 用全域安裝的版本時設 PLAYWRIGHT=/path/to/playwright；GAME_URL 可改網址；ONLY=click,hangar,big,pick,m10 只跑其中幾段）
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
  await page.addInitScript((s) => localStorage.setItem('starfall_save_v1', JSON.stringify(s)), { lang: 'zh', sfx: 0, music: 0, stars: {}, tips: [], fast: true, ...save });
  await page.goto(URL);
  await page.waitForFunction(() => window.__sf && window.__sf.scene.isActive('SfTitle'), null, { timeout: 120000 });
  return { ctx, page };
}

const idle = (page, timeout = 60000) => page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode !== 'busy', null, { timeout });

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
  await tap(p, 90);
  await tap(p, 700);
  s = await state();
  ok(s.sel === 'bruno' && same(s.kai, [2, 9]) && s.peek === null, '在友軍身上連點兩下：改選友軍，沒有移動', s);

  // 打得到的小型敵人躲在友軍身後
  const foe = [{ id: 'kai', x: 1, y: 6 }, { id: 'bruno', x: 4, y: 7 }, { id: 'worker', x: 3, y: 6 }, { id: 'worker', x: 1, y: 4 }, { id: 'echo', x: 0, y: 9 }];
  await setup(foe);
  await select('kai');
  await page.waitForTimeout(700);
  const full = (await state()).foes;
  await tap(p, 90);
  await tap(p, 700);
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
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // ONLY=big,m10 之類可以只跑其中幾段（開發時用；CI 全部跑）
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = (k) => !only || only.includes(k);
  if (want('click')) await clickThrough(browser);
  if (want('hangar')) await hangarCheck(browser);
  if (want('big')) await bigMapCheck(browser);
  if (want('pick')) await pickCheck(browser);
  for (const m of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12']) if (want(m)) await autoPlay(browser, m);
  await browser.close();
  console.log(failed ? `${failed} 個問題（截圖在 ${OUT}）` : `全部通過（截圖在 ${OUT}）`);
  process.exit(failed ? 1 : 0);
})();
