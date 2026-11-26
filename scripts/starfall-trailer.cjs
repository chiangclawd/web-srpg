// 《星墜殘響》的預告片：用遊戲實際的畫面剪一支約 30 秒的影片（1920×1080、30 格，H.264 + AAC）。
// 先 npx vite build && npx vite preview --port 4173 --no-open，再：
//   node scripts/starfall-trailer.cjs [輸出資料夾，預設 store-shots/starfall/trailer] [語言 zh|en，預設 zh]
// 要有 ffmpeg。輸出 trailer-<語言>.mp4，中間的每一格畫面留在 frames-<語言>/（重剪時加 REUSE=1 就不用重錄）。
// 環境變數：GAME_URL、PLAYWRIGHT、REUSE=1（沿用上次錄的畫面，只重新剪接）、ONLY=boss（只重錄其中一段）。
//
// 怎麼錄：不是錄螢幕。每一段先把場面擺好，然後把遊戲的時鐘停下來，自己一格一格往前推（每格 1/30 秒），
// 每推一格就把畫布存成一張圖。這樣每一格都是完整算好的畫面，不會掉格，電腦快慢也不影響結果。
// 遊戲裡的等待、動畫、打字全都走 Phaser 的時鐘（沒有用 setTimeout），所以時鐘停了它們就跟著停。
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');

const OUT = path.resolve(process.argv[2] ?? 'store-shots/starfall/trailer');
const LANG = process.argv[3] ?? 'zh';
const GAME = process.env.GAME_URL ?? 'http://localhost:4173/starfall.html';
const ORIGIN = new URL(GAME).origin;
const FPS = 30;
const W = 1920;
const H = 1080;
const REUSE = !!process.env.REUSE;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const FRAMES = path.join(OUT, `frames-${LANG}`);

const MISSIONS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];
const TIPS = ['tip_move', 'tip_flank', 'tip_cover', 'tip_overwatch', 'tip_forecast', 'tip_leap', 'tip_shield', 'tip_mender', 'tip_rally', 'tip_hold', 'tip_drones', 'tip_thunderer', 'tip_projector'];
const SAVE = {
  lang: LANG,
  sfx: 0,
  music: 0,
  fast: false,
  tips: TIPS,
  stars: Object.fromEntries(MISSIONS.map((m) => [m, 3])),
  upgrades: {
    kai: { plating: 2, firepower: 3, mods: ['kai_link'] },
    bruno: { plating: 3, firepower: 1, mods: ['bruno_reactive'] },
    vey: { plating: 1, firepower: 3, mods: ['vey_scope'] },
    echo: { plating: 2, firepower: 1, mods: ['echo_nano'] },
    sparrow: { plating: 1, firepower: 2, mods: [] },
    hale_ally: { plating: 2, firepower: 2, mods: [] },
  },
};

const TEXT = {
  zh: {
    title: '星墜殘響',
    sub: 'STARFALL ECHO',
    tagline: '曙光號墜毀後第 80 年。船還記得它的任務。',
    forecast: ['出手前先看結果', 'See the result before you fire'],
    story: ['12 個任務的完整故事', 'A complete story in 12 missions'],
    boss: ['6 台機體，各有打法', 'Six frames, each with its own job'],
    field: ['後日談的大型作戰', 'Large battles in the epilogue'],
    free: '免費・瀏覽器直接玩・沒有廣告',
  },
  en: {
    title: 'STARFALL ECHO',
    sub: '星墜殘響',
    tagline: 'Eighty years after the Aurelia fell, the ship still remembers its mission.',
    forecast: ['See the result before you fire', '出手前先看結果'],
    story: ['A complete story in 12 missions', '12 個任務的完整故事'],
    boss: ['Six frames, each with its own job', '6 台機體，各有打法'],
    field: ['Large battles in the epilogue', '後日談的大型作戰'],
    free: 'Free · Plays in your browser · No ads',
  },
}[LANG];
const LINK = 'chiangclawd.github.io/web-srpg/echo';

const FONT = `@font-face { font-family: sf; font-weight: 700; src: url('/assets/starfall/fonts/starfall-sans-700.woff2') format('woff2'); }
  @font-face { font-family: sf; font-weight: 400; src: url('/assets/starfall/fonts/starfall-sans-400.woff2') format('woff2'); }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; font-family: sf, "Microsoft JhengHei", sans-serif; }`;

/** 片頭和片尾的卡片 */
const cardHtml = (end) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${FONT}
  body { background: #050a14; }
  .art { position: absolute; inset: 0; background: url('/assets/starfall/title.webp') center / cover no-repeat; ${end ? 'filter: brightness(0.45) blur(3px);' : ''} }
  .shade { position: absolute; inset: 0; background: ${end ? 'rgba(5, 10, 20, 0.35)' : 'linear-gradient(90deg, rgba(5, 10, 20, 0.85) 0%, rgba(5, 10, 20, 0.4) 40%, rgba(5, 10, 20, 0) 64%)'}; }
  .text { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; ${end ? 'align-items: center; text-align: center;' : 'padding-left: 130px;'} font-weight: 700; }
  .big { color: #fff; font-size: ${LANG === 'zh' ? 168 : 124}px; line-height: 1.1; letter-spacing: 0.06em; text-shadow: 0 6px 0 #04101c, 0 16px 44px rgba(0, 0, 0, 0.8); }
  .sub { margin-top: 20px; color: #5fe3ff; font-size: ${LANG === 'zh' ? 46 : 60}px; letter-spacing: ${LANG === 'zh' ? '0.42em' : '0.2em'}; text-shadow: 0 2px 10px #000; }
  .line { margin-top: 44px; color: #e2edf8; font-size: 40px; font-weight: 400; text-shadow: 0 2px 10px #000; max-width: 900px; }
  .link { margin-top: 26px; color: #ff9a3c; font-size: 44px; letter-spacing: 0.02em; text-shadow: 0 2px 10px #000; }
  </style></head><body><div class="art"></div><div class="shade"></div><div class="text">
  <div class="big">${TEXT.title}</div><div class="sub">${TEXT.sub}</div>
  ${end ? `<div class="line">${TEXT.free}</div><div class="link">${LINK}</div>` : `<div class="line">${TEXT.tagline}</div>`}
  </div></body></html>`;

/**
 * 疊在畫面上的說明：兩行字，背景透明。戰鬥畫面放下面中間（上面中間是傷害預估，左下和右下是機體資訊和按鈕），
 * 對話的畫面放上面（下面是對話框）。
 */
const captionHtml = ([a, b], where) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${FONT}
  body { background: transparent; }
  /* 戰鬥畫面的說明要高過左下角的機體資訊卡（英文那一行比較長，放最底下會壓到它） */
  .box { position: absolute; left: 0; right: 0; ${where}: ${where === 'top' ? 0 : 196}px; padding: 40px 0 44px; text-align: center; background: radial-gradient(ellipse 36% 62% at 50% 50%, rgba(5, 10, 20, 0.88), rgba(5, 10, 20, 0)); }
  .a { color: #fff; font-size: 62px; font-weight: 700; letter-spacing: 0.04em; text-shadow: 0 3px 0 #04101c, 0 6px 22px #000; }
  .b { margin-top: 6px; color: #5fe3ff; font-size: 30px; font-weight: 400; letter-spacing: 0.06em; text-shadow: 0 2px 8px #000; }
  </style></head><body><div class="box"><div class="a">${a}</div><div class="b">${b}</div></div></body></html>`;

const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ── 卡片和說明（網頁畫出來再截圖；掛在遊戲同一個網站底下，字型和圖才載得到）
  const still = async (name, html, { scale = 1, clear = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.route(`${ORIGIN}/__card.html`, (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`${ORIGIN}/__card.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: clear });
    await ctx.close();
  };
  // 卡片畫兩倍大：之後慢慢推近的時候才不會糊
  await still('card-open', cardHtml(false), { scale: 2 });
  await still('card-end', cardHtml(true), { scale: 2 });
  for (const k of ['forecast', 'story', 'boss', 'field']) await still(`cap-${k}`, captionHtml(TEXT[k], k === 'story' ? 'top' : 'bottom'), { clear: true });

  // ── 錄遊戲畫面
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript((s) => localStorage.setItem('starfall_save_v1', JSON.stringify(s)), SAVE);

  const go = (key, data) =>
    page.evaluate(
      ([key, data]) => {
        const g = window.__sf;
        for (const k of ['SfTitle', 'SfDialogue', 'SfHud', 'SfBattle', 'SfHangar', 'SfMissions', 'SfCodex']) if (k !== key && g.scene.isActive(k)) g.scene.stop(k);
        g.scene.start(key, data);
      },
      [key, data ?? {}],
    );
  const idle = () => page.waitForFunction(() => window.__sf.scene.getScene('SfBattle').mode === 'idle', null, { timeout: 120000 });
  const skipTalk = () =>
    page
      .evaluate(() => {
        const g = window.__sf;
        if (g.scene.isActive('SfDialogue')) g.scene.getScene('SfDialogue').finish();
      })
      .catch(() => undefined);
  /** 照平常的速度先打 n 回合，停在下一回合我方行動之前 */
  const prepare = async (mission, turns) => {
    await go('SfBattle', { missionId: mission });
    const skipper = setInterval(skipTalk, 300);
    await idle();
    if (turns) {
      await page.evaluate((n) => {
        window.__prepDone = false;
        void window.__sf.scene
          .getScene('SfBattle')
          .autoBattle(n)
          .then(() => (window.__prepDone = true));
      }, turns);
      await page.waitForFunction(() => window.__prepDone, null, { timeout: 240000 });
      await idle();
    }
    clearInterval(skipper);
    await page.waitForTimeout(600);
  };
  /**
   * 錄一段：把遊戲的時鐘停下來，一格一格推，每格存一張圖。hooks 是「第幾格的時候做什麼」（在網頁裡執行的函式）。
   */
  const record = async (name, frames, hooks = {}) => {
    const dir = path.join(FRAMES, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(() => {
      const g = window.__sf;
      g.loop.stop();
      window.__t = g.loop.time || performance.now();
    });
    for (let i = 0; i < frames; i++) {
      if (hooks[i]) await page.evaluate(hooks[i]);
      const url = await page.evaluate((dt) => {
        const g = window.__sf;
        window.__t += dt;
        g.step(window.__t, dt);
        return g.canvas.toDataURL('image/jpeg', 0.94);
      }, 1000 / FPS);
      fs.writeFileSync(path.join(dir, `${String(i).padStart(5, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    }
    await page.evaluate(() => {
      const g = window.__sf;
      g.loop.start(g.loop.callback);
    });
    console.log(`recorded ${name}: ${frames} frames`);
  };
  const want = (name) => !REUSE && (!ONLY || ONLY.includes(name));

  // 選一台打得到敵人的機體，鏡頭帶到它和目標中間
  const pick = () => {
    const s = window.__sf.scene.getScene('SfBattle');
    const b = s.battle;
    const mine = b.alive('player').filter((u) => !u.def.structure && b.canAct(u));
    const u = mine.slice().sort((a, c) => b.targets(c).length - b.targets(a).length)[0];
    if (!u) return;
    s.select(u);
    const t = b.targets(u)[0] ?? u;
    const mid = { x: (u.x + t.x) / 2, y: (u.y + t.y) / 2 };
    s.lookAt((mid.x - mid.y) * 48, (mid.x + mid.y) * 24 - b.heightAt(Math.round(mid.x), Math.round(mid.y)) * 24);
  };
  const aim = () => {
    const s = window.__sf.scene.getScene('SfBattle');
    if (!s.sel || !s.battle.targets(s.sel).length) return;
    s.beginTarget({ kind: 'attack' });
    if (!s.aim) {
      const t = s.battle.targets(s.sel)[0];
      s.aimAt({ x: t.x, y: t.y });
    }
  };
  const fire = () => {
    const s = window.__sf.scene.getScene('SfBattle');
    if (s.mode === 'target' && s.aim) void s.confirm();
  };
  /** 這一回合剩下的交給 AI（我方打完換敵方） */
  const rest = () => {
    const s = window.__sf.scene.getScene('SfBattle');
    if (s.mode === 'idle' || s.mode === 'unit') void s.autoBattle(s.battle.turn);
  };
  const nextLine = () => {
    const s = window.__sf.scene.getScene('SfDialogue');
    // 這一句還沒顯示完的話，第一下只是把它顯示完，第二下才換下一句
    if (s.shown < s.full.length) s.advance();
    s.advance();
  };

  if (!REUSE) {
    await page.goto(GAME);
    await page.waitForFunction(() => window.__sf && window.__sf.scene.isActive('SfTitle'), null, { timeout: 120000 });
    await page.waitForTimeout(800);
    const size = await page.evaluate(() => [window.__sf.canvas.width, window.__sf.canvas.height]);
    console.log(`canvas ${size.join('x')}`);
  }

  // 1. 第一關：選機體 → 瞄準（傷害預估）→ 開火 → 其餘的機體接著行動
  if (want('forecast')) {
    await prepare('m1', 2);
    await record('forecast', 190, { 0: pick, 24: aim, 78: fire, 150: rest });
  }
  // 2. 第一關開場的對話：布魯諾的那一句 → 撬開維修艙的插圖 → 艾可醒來
  if (want('story')) {
    await go('SfBattle', { missionId: 'm1' });
    await page.waitForFunction(() => window.__sf.scene.isActive('SfDialogue'), null, { timeout: 60000 });
    await page.waitForFunction(() => window.__sf.textures.exists('cg_wake') && window.__sf.textures.exists('pt_echo_calm'), null, { timeout: 30000 });
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const s = window.__sf.scene.getScene('SfDialogue');
        s.advance();
        s.advance();
      });
    }
    // 這一句直接顯示完（不靠等的：電腦忙的時候遊戲的時鐘走得比實際的慢）
    await page.evaluate(() => {
      const s = window.__sf.scene.getScene('SfDialogue');
      if (s.shown < s.full.length) s.advance();
    });
    await page.waitForTimeout(800);
    await record('story', 200, { 20: nextLine, 108: nextLine });
    await page.evaluate(() => window.__sf.scene.getScene('SfDialogue').finish());
    await idle();
  }
  // 3. 第六關的首領戰：我方輪流出手
  if (want('boss')) {
    await prepare('m6', 1);
    await record('boss', 190, { 4: rest });
  }
  // 4. 後日談的大地圖
  if (want('field')) {
    await prepare('m11', 1);
    await record('field', 170, { 4: rest });
  }
  await browser.close();

  // ── 剪接
  const seg = (name) => path.join(OUT, `seg-${name}.mp4`);
  const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
  /** 卡片：慢慢推近，頭尾淡入淡出 */
  const card = (name, seconds) => {
    const n = seconds * FPS;
    // 輸入只給一張圖：zoompan 的 d 是「每一張輸入要生出幾格」，圖重複餵進去的話長度會變成好幾倍
    ffmpeg(['-i', path.join(OUT, `${name}.png`), '-vf', `zoompan=z='1+0.05*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},fade=t=in:st=0:d=0.5,fade=t=out:st=${seconds - 0.4}:d=0.4`, ...enc, seg(name)]);
  };
  /** 錄的畫面：疊上說明（晚一點淡入、早一點淡出），頭尾淡入淡出 */
  const clip = (name, cap) => {
    const n = fs.readdirSync(path.join(FRAMES, name)).length;
    const d = n / FPS;
    ffmpeg([
      '-framerate', String(FPS), '-i', path.join(FRAMES, name, '%05d.jpg'),
      '-loop', '1', '-t', String(d), '-i', path.join(OUT, `cap-${cap}.png`),
      '-filter_complex',
      `[0]scale=${W}:${H}:flags=lanczos[v];[1]format=rgba,fade=t=in:st=0.5:d=0.4:alpha=1,fade=t=out:st=${(d - 0.9).toFixed(2)}:d=0.4:alpha=1[c];[v][c]overlay=shortest=1,fade=t=in:st=0:d=0.25,fade=t=out:st=${(d - 0.25).toFixed(2)}:d=0.25`,
      ...enc, seg(name),
    ]);
    return d;
  };
  card('card-open', 3);
  const order = ['card-open', 'forecast', 'story', 'boss', 'field', 'card-end'];
  let total = 3;
  for (const [name, cap] of [['forecast', 'forecast'], ['story', 'story'], ['boss', 'boss'], ['field', 'field']]) total += clip(name, cap);
  card('card-end', 4);
  total += 4;
  const list = path.join(OUT, 'list.txt');
  fs.writeFileSync(list, order.map((n) => `file '${seg(n).replace(/\\/g, '/')}'`).join('\n') + '\n');
  const silent = path.join(OUT, 'silent.mp4');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  // 配樂：第一章的戰鬥曲，跳過開頭比較安靜的十秒；頭尾淡入淡出
  const music = path.resolve(__dirname, '../public/assets/starfall/music/battle.mp3');
  const final = path.join(OUT, `trailer-${LANG}.mp4`);
  ffmpeg(['-i', silent, '-ss', '10', '-t', total.toFixed(2), '-i', music, '-af', `afade=t=in:st=0:d=0.6,afade=t=out:st=${(total - 2.2).toFixed(2)}:d=2.2`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
  for (const n of order) fs.rmSync(seg(n), { force: true });
  fs.rmSync(silent, { force: true });
  fs.rmSync(list, { force: true });
  const real = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final], { encoding: 'utf8' }));
  if (Math.abs(real - total) > 0.5) throw new Error(`影片長度 ${real} 秒，應該是 ${total.toFixed(1)} 秒`);
  console.log(`${path.basename(final)}: ${total.toFixed(1)} s, ${(fs.statSync(final).size / 1048576).toFixed(1)} MB`);
})();
