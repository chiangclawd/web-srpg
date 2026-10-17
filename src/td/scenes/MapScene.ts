import Phaser from 'phaser';
import { PLAY_W, PLAY_X0, VIEW_H, WORLD_W, bgScale, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { LEVELS } from '../data/levels';
import { UPGRADE_COLUMNS } from '../data/upgrades';
import { HEROES, HERO_ORDER } from '../data/heroes';
import { heroUnlocked } from './HeroScene';
import { mapRoads, paintWorldMap } from '../art/worldmap';
import { showTipBubble } from '../ui/tip';
import { DAILY_MODS, dailyBaseLevel, dailyKey, dailySpec } from '../data/daily';
import { Button, IconButton, dimmer, panel, popIn } from '../ui/widgets';
import { L, T, getLang } from '../i18n';
import { save, persist, totalStars } from '../save';
import { sfx } from '../audio';
import type { Difficulty } from '../sim/World';
import type { LevelMode } from '../sim/defs';
import { ironTowers } from '../data/challenges';
import { TOWERS } from '../data/towers';

export function isUnlocked(i: number): boolean {
  if (i === 0) return true;
  const prev = LEVELS[i - 1];
  return (save().stars[prev.id] ?? 0) > 0;
}

export function starsAvailable(): number {
  const sv = save();
  let spent = 0;
  for (const col of UPGRADE_COLUMNS) {
    const n = sv.upgrades[col.id] ?? 0;
    for (let i = 0; i < n; i++) spent += col.tiers[i].cost;
  }
  return totalStars() - spent;
}

export class MapScene extends Phaser.Scene {
  private infoPanel: Phaser.GameObjects.Container | null = null;
  private hud: Phaser.GameObjects.GameObject[] = [];
  private focus?: string;

  constructor() {
    super('Map');
  }

  init(data: { focus?: string }): void {
    this.focus = data?.focus;
    this.infoPanel = null;
    this.hud = [];
  }

  preload(): void {
    // 戰鬥時會釋放世界地圖，回來時重新載入（瀏覽器快取，很快）
    if (!this.textures.exists('worldmap')) this.load.image('worldmap', 'assets/worldmap.webp');
  }

  create(): void {
    setupCamera(this);
    // 離開戰鬥後釋放戰場背景（重玩時從快取重新載入）
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('lvbg_')) this.textures.remove(k);
    const nodes = LEVELS.map((l) => ({ x: l.mapPos.x * PLAY_W, y: l.mapPos.y * VIEW_H, theme: l.theme, bonus: l.bonus }));
    if (this.textures.exists('worldmap')) this.paintedMap(nodes);
    else {
      const s = bgScale(1.25);
      if (!this.textures.exists('bg_map')) this.textures.addCanvas('bg_map', paintWorldMap(WORLD_W, VIEW_H, PLAY_X0, s, nodes));
      this.add.image(-PLAY_X0, 0, 'bg_map').setOrigin(0).setScale(1 / s);
    }

    const sv = save();
    let lastUnlocked = 0;
    LEVELS.forEach((lv, i) => {
      if (!isUnlocked(i)) return;
      lastUnlocked = i;
      const n = nodes[i];
      const stars = sv.stars[lv.id] ?? 0;
      const c = this.add.container(n.x, n.y);
      const glow = this.add.image(0, -4, 'fx_soft').setTint(lv.bonus ? 0xffa040 : stars ? 0x7ab0ff : 0xffd84a).setBlendMode('ADD').setScale(1.1).setAlpha(0.7);
      const base = this.add.ellipse(0, 6, 46, 18, 0x2a1a0c, 0.5);
      const pole = this.add.rectangle(-2, -14, 4, 42, 0x3a2412);
      const flagTex = this.add.graphics();
      flagTex.fillStyle(lv.bonus ? 0xe0a020 : stars ? 0x3a6ad0 : 0xc0392b, 1);
      flagTex.lineStyle(2.5, 0x1a0a04, 1);
      flagTex.beginPath();
      flagTex.moveTo(0, -34);
      flagTex.lineTo(28, -27);
      flagTex.lineTo(0, -16);
      flagTex.closePath();
      flagTex.fillPath();
      flagTex.strokePath();
      const num = addText(this, 0, 22, String(i + 1), { size: 16, display: true }).setOrigin(0.5);
      c.add([glow, base, pole, flagTex, num]);
      for (let k = 0; k < 3; k++) {
        const st = this.add.image((k - 1) * 18, 42, k < stars ? 'ic_star' : 'ic_star_empty').setDisplaySize(20, 20);
        c.add(st);
      }
      // 手機上點擊範圍放大（旗子本身不變）
      const hit = this.add.circle(0, 0, 34 * uiZoom(), 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        sfx.play('click');
        this.showLevel(i);
      });
      c.add(hit);
      this.tweens.add({ targets: glow, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
      const fresh = !sv.unlockedSeen.includes(lv.id);
      if (fresh) {
        // 新解鎖：旗子從天而降 + 星光
        sv.unlockedSeen.push(lv.id);
        persist();
        c.setY(n.y - 120).setAlpha(0);
        this.tweens.add({
          targets: c,
          y: n.y,
          alpha: 1,
          delay: 700,
          duration: 520,
          ease: 'Bounce.easeOut',
          onStart: () => sfx.play('whoosh', 0.5),
          onComplete: () => {
            sfx.play('star');
            const burst = this.add.particles(n.x, n.y - 10, 'fx_star', {
              speed: { min: 60, max: 160 },
              lifespan: 700,
              scale: { start: 0.5, end: 0 },
              emitting: false,
            });
            burst.explode(14);
            this.time.delayedCall(900, () => burst.destroy());
            if (!stars) this.tweens.add({ targets: c, y: n.y - 5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          },
        });
      } else if (!stars) this.tweens.add({ targets: c, y: n.y - 5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    this.buildHud();
    this.mapTip();
    this.scale.on('resize', this.buildHud, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.buildHud, this));
    sfx.playBgm('peaceful');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const focusIdx = this.focus ? LEVELS.findIndex((l) => l.id === this.focus) : -1;
    const auto = focusIdx >= 0 && isUnlocked(focusIdx + 1) && focusIdx + 1 < LEVELS.length ? focusIdx + 1 : lastUnlocked;
    // 有新英雄要介紹時先不自動打開關卡面板，免得兩個視窗疊在一起
    if (!this.announceHero()) this.time.delayedCall(350, () => this.showLevel(auto));
  }

  /** 剛解鎖的英雄：地圖上跳一次介紹卡（每位只介紹一次） */
  private announceHero(): boolean {
    const sv = save();
    // 舊存檔第一次進來：已經解鎖的英雄當作看過（維克托是這次新加的，仍會介紹）
    if (!sv.heroesSeen) {
      sv.heroesSeen = HERO_ORDER.filter((id) => id !== 'viktor' && heroUnlocked(id));
      persist();
    }
    const id = HERO_ORDER.find((h) => HEROES[h].unlockAfter && heroUnlocked(h) && !sv.heroesSeen!.includes(h));
    if (!id) return false;
    sv.heroesSeen.push(id);
    persist();
    const h = HEROES[id];
    this.time.delayedCall(900, () => {
      const w = viewW(this);
      const left = -(w - PLAY_W) / 2;
      const root = this.add.container(0, 0).setDepth(9000);
      root.add(dimmer(this, w, VIEW_H, 0.6).setPosition(left, 0));
      const pw = 620;
      const ph = 330;
      const c = this.add.container(PLAY_W / 2, VIEW_H / 2);
      root.add(c);
      c.add(panel(this, 0, 0, pw, ph));
      const pt = this.add.image(-pw / 2 + 120, ph / 2 - 14, `pt_${id}`).setOrigin(0.5, 1);
      pt.setScale(Math.min(300 / pt.frame.height, 220 / pt.frame.width));
      c.add(pt);
      const tx = -pw / 2 + 250;
      c.add(addText(this, tx, -ph / 2 + 40, T('heroJoined'), { size: 22, display: true, color: '#c0392b', stroke: '#fff2d0', strokeW: 4, shadow: false }).setOrigin(0, 0.5));
      c.add(addText(this, tx, -ph / 2 + 86, L(h.name), { size: 36, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0, 0.5));
      c.add(addText(this, tx, -ph / 2 + 126, L(h.title), { size: 18, display: true, color: '#7a4a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      c.add(addText(this, tx, -ph / 2 + 152, L(h.desc), { size: 15, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: pw - 280 }));
      const close = () => {
        sfx.play('click');
        root.destroy();
      };
      c.add(new Button(this, tx + 90, ph / 2 - 44, 170, 52, T('heroes'), () => {
        sfx.play('click');
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.time.delayedCall(260, () => this.scene.start('Hero'));
      }, { color: 'green' }));
      c.add(new Button(this, tx + 280, ph / 2 - 44, 150, 52, T('later'), close, { color: 'wood' }));
      sfx.play('levelup');
      popIn(this, c, 0, { w: pw, h: ph }, 0.6, 320);
    });
    return true;
  }

  /** 手繪世界地圖（Gemini 依程序地圖構圖重繪）＋向量虛線路線 */
  private paintedMap(nodes: { x: number; y: number; bonus?: boolean }[]): void {
    const img = this.add.image(-PLAY_X0, 0, 'worldmap').setOrigin(0);
    img.setScale(WORLD_W / img.width, VIEW_H / img.height);
    const g = this.add.graphics();
    const dashed = (pts: { x: number; y: number }[], width: number, color: number, a: number) => {
      g.lineStyle(width, color, a);
      // 8 實 9 空的虛線（Graphics 沒有 setLineDash，沿路徑自己切）
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        let t = 0;
        while (t < len) {
          const phase = acc % 17;
          const step = Math.min(len - t, phase < 8 ? 8 - phase : 17 - phase);
          if (phase < 8) {
            const a0 = t / len;
            const a1 = (t + step) / len;
            g.lineBetween(p0.x + (p1.x - p0.x) * a0, p0.y + (p1.y - p0.y) * a0, p0.x + (p1.x - p0.x) * a1, p0.y + (p1.y - p0.y) * a1);
          }
          t += step;
          acc += step;
        }
      }
    };
    const roads = mapRoads(nodes);
    dashed(roads.main, 6, 0x3c1e0a, 0.55);
    dashed(roads.main, 3, 0xf0d8a0, 1);
    dashed(roads.side, 6, 0x5a320a, 0.55);
    dashed(roads.side, 3, 0xffc860, 1);
  }

  private buildHud(): void {
    this.hud.forEach((o) => o.destroy());
    this.hud = [];
    const w = viewW(this);
    const left = -(w - PLAY_W) / 2;
    this.cameras.main.setScroll(left, 0);
    const right = left + w;
    // 四個角各一組，以角落為錨點；手機上整組放大（按鈕接近手指大小）
    const z = uiZoom();
    const topLeft = this.add.container(left, 0).setScale(z);
    const topRight = this.add.container(right, 0).setScale(z);
    const bottomRight = this.add.container(right, VIEW_H).setScale(z);
    this.hud.push(topLeft, topRight, bottomRight);
    // 總星數
    const sp = panel(this, 100, 34, 170, 46, 'ui_dark', 18);
    const si = this.add.image(40, 34, 'ic_star').setDisplaySize(32, 32);
    const total = LEVELS.length * 5;
    const st = addText(this, 62, 34, `${totalStars()} / ${total}`, { size: 22, display: true, color: '#ffe066' }).setOrigin(0, 0.5);
    // 寶石
    const gp = panel(this, 280, 34, 150, 46, 'ui_dark', 18);
    const gi = this.add.image(226, 34, 'ic_gem').setDisplaySize(30, 30);
    const gt = addText(this, 248, 34, String(save().gems ?? 0), { size: 22, display: true, color: '#e0c0ff' }).setOrigin(0, 0.5);
    topLeft.add([sp, si, st, gp, gi, gt]);
    // 底部按鈕（座標相對右下角）
    const back = new IconButton(this, left + 12 + 32 * z, VIEW_H - 12 - 32 * z, 64, 'ic_close', () => this.leave('Menu')).setBaseScale(z);
    const avail = starsAvailable();
    const up = new Button(this, -470, -42, 140, 56, T('upgrades'), () => this.leave('Upgrade'), { color: 'gold', icon: 'ic_hammer', iconSize: 34, text: { size: 20 } });
    const hero = HEROES[save().selectedHero] ?? HEROES.arthur;
    const hb = new Button(this, -310, -42, 140, 56, T('heroes'), () => this.leave('Hero'), { color: 'blue', icon: `ptc_${hero.id}`, iconSize: 38, text: { size: 20 } });
    const enc = new Button(this, -150, -42, 140, 56, T('encyclopedia'), () => this.leave('Encyclopedia'), { color: 'wood', icon: 'ic_book', iconSize: 34, text: { size: 20 } });
    const ach = new Button(this, -630, -42, 140, 56, T('achievements'), () => this.leave('Achievements'), { color: 'wood', icon: 'ic_crown', iconSize: 34, text: { size: 20 } });
    const shop = new Button(this, -790, -42, 140, 56, T('shop'), () => this.leave('Shop'), { color: 'red', icon: 'ic_gem', iconSize: 32, text: { size: 20 } });
    bottomRight.add([up, hb, enc, ach, shop]);
    if (avail > 0) {
      const badge = this.add.circle(-410, -68, 14, 0xc0392b).setStrokeStyle(2, 0xffffff);
      const bt = addText(this, -410, -68, String(avail), { size: 14, display: true }).setOrigin(0.5);
      this.tweens.add({ targets: [badge, bt], scale: 1.2, duration: 500, yoyo: true, repeat: -1 });
      bottomRight.add([badge, bt]);
    }
    // 每日挑戰（通關第 3 關後開放）
    const dailyOpen = (save().stars.l3 ?? 0) > 0;
    const dly = new Button(this, -104, 34, 180, 48, T('daily'), () => {
      if (!dailyOpen) {
        sfx.play('error');
        this.toastMsg(T('dailyLocked'));
        return;
      }
      this.showDaily();
    }, { color: dailyOpen ? 'gold' : 'grey', icon: 'ic_star', iconSize: 28, text: { size: 18 }, sound: dailyOpen });
    topRight.add(dly);
    if (!dailyOpen) dly.add(this.add.image(72, -14, 'ic_lock').setDisplaySize(20, 20));
    else if (!save().daily[dailyKey()] && (save().stars[dailySpec(dailyKey()).levelId] ?? 0) > 0) {
      // 今天的挑戰打得了、還沒過：小紅點提醒
      const dot = this.add.circle(-22, 16, 9, 0xc0392b).setStrokeStyle(2, 0xffffff);
      this.tweens.add({ targets: dot, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
      topRight.add(dot);
    }
    this.hud.push(back);
    this.hud.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(500));
  }

  /** 每日挑戰面板：今天的關卡、兩個修正、今日最佳 */
  private showDaily(): void {
    this.infoPanel?.destroy();
    const key = dailyKey();
    const spec = dailySpec(key);
    const lv = dailyBaseLevel(key);
    const idx = LEVELS.indexOf(lv);
    const sv = save();
    const w = viewW(this);
    const left = -(w - PLAY_W) / 2;
    const pw = 460;
    const ph = 470;
    const c = this.add.container(left + w / 2, 335).setDepth(650);
    c.add(panel(this, 0, 0, pw, ph));
    c.add(addText(this, 0, -ph / 2 + 36, T('dailyTitle', key), { size: 26, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    const hint = addText(this, 0, -ph / 2 + 64, T('dailyHint'), { size: 14, color: '#5a3a1a', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: pw - 60, align: 'center' }).setOrigin(0.5, 0);
    c.add(hint);
    // 手機字體放大後提示可能變兩行：下面的內容跟著往下排
    const nameY = hint.y + hint.height + 26;
    c.add(addText(this, 0, nameY, `${idx + 1}. ${L(lv.name)}`, { size: 24, display: true, color: '#7a4a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0.5));
    let y = nameY + 44;
    for (const id of spec.mods) {
      const m = DAILY_MODS[id];
      const col = m.good ? '#2a6a1a' : '#9a2a1a';
      c.add(this.add.image(-pw / 2 + 46, y + 10, m.good ? 'ui_badge_green' : 'ui_badge_red').setDisplaySize(40, 40));
      c.add(this.add.image(-pw / 2 + 46, y + 10, m.good ? 'ic_coin' : 'ic_skull').setDisplaySize(24, 24));
      c.add(addText(this, -pw / 2 + 76, y, L(m.name), { size: 18, display: true, color: col, stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      const desc = id === 'limited' ? T('dailyLimited', spec.towers.map((t) => L(TOWERS[t].name)).join('、')) : L(m.desc);
      c.add(addText(this, -pw / 2 + 76, y + 22, desc, { size: 14, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5));
      y += 58;
    }
    const best = sv.daily[key] ?? 0;
    c.add(addText(this, -60, ph / 2 - 120, T('todayBest'), { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(1, 0.5));
    for (let k = 0; k < 3; k++) c.add(this.add.image(-30 + k * 36, ph / 2 - 120, k < best ? 'ic_star' : 'ic_star_empty').setDisplaySize(32, 32));
    // 要先通過當天這一關（戰役進度不夠時提示要打哪一關）
    const cleared = (sv.stars[lv.id] ?? 0) > 0;
    const go = new Button(this, 0, ph / 2 - 50, 220, 60, T('battle'), () => {
      sfx.play('horn', 0.7);
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(310, () => this.scene.start('Level', { levelId: lv.id, difficulty: 'normal', mode: 'daily' }));
    }, { color: 'green', icon: 'ic_reinforce', iconSize: 34, text: { size: 26 }, disabled: !cleared });
    c.add(go);
    if (!cleared) {
      c.add(fitText(addText(this, 0, ph / 2 - 92, T('dailyNeedLevel', `${idx + 1}. ${L(lv.name)}`), { size: 15, color: '#9a2a1a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0.5), pw - 40));
    }
    c.add(new IconButton(this, pw / 2 - 18, -ph / 2 + 18, 40, 'ic_close', () => {
      this.infoPanel?.destroy();
      this.infoPanel = null;
    }));
    popIn(this, c, 0, { w: pw, h: ph }, 0.85, 220);
    this.infoPanel = c;
  }

  /** 地圖首次提示：有星星可用 → 指向升級；寶石夠買道具 → 指向商店 */
  private mapTip(): void {
    const sv = save();
    let id: 'upgrades' | 'shop' | null = null;
    if (!sv.tipsSeen.includes('upgrades') && starsAvailable() > 0) id = 'upgrades';
    else if (!sv.tipsSeen.includes('shop') && (sv.gems ?? 0) >= 40) id = 'shop';
    if (!id) return;
    const tip = id;
    this.time.delayedCall(900, () => {
      if (!this.sys.isActive()) return;
      const w = viewW(this);
      // 底部按鈕位置（與 buildHud 一致；螢幕座標，手機上整組放大）
      const z = uiZoom();
      const x = w - (tip === 'upgrades' ? 470 : 790) * z;
      sv.tipsSeen.push(tip);
      persist();
      this.infoPanel?.destroy();
      this.infoPanel = null;
      showTipBubble(this, x, VIEW_H - 42 * z, T(tip === 'upgrades' ? 'tipUpgrades' : 'tipShop'), () => {}, 2000);
    });
  }

  private toastMsg(msg: string): void {
    const w = viewW(this);
    const left = -(w - PLAY_W) / 2;
    const t = addText(this, left + w / 2, 90, msg, { size: 18 }).setOrigin(0.5).setDepth(900);
    this.tweens.add({ targets: t, alpha: 0, y: 70, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }

  private leave(scene: string): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(260, () => this.scene.start(scene));
  }

  private showLevel(i: number, mode: LevelMode = 'campaign'): void {
    this.infoPanel?.destroy();
    const lv = LEVELS[i];
    const sv = save();
    const w = viewW(this);
    const left = -(w - PLAY_W) / 2;
    const pw = 400;
    const ph = 460;
    const n = { x: lv.mapPos.x * PLAY_W, y: lv.mapPos.y * VIEW_H };
    const onRight = n.x < PLAY_W * 0.55;
    const px = onRight ? left + w - pw / 2 - 20 : left + pw / 2 + 20;
    const c = this.add.container(px, 320).setDepth(600);
    c.add(panel(this, 0, 0, pw, ph));
    c.add(addText(this, 0, -ph / 2 + 34, `${i + 1}. ${L(lv.name)}`, { size: 28, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    // 模式分頁：戰役 / 英雄挑戰 / 鋼鐵挑戰（通關戰役後解鎖，各給 1 星）
    const beaten = (sv.stars[lv.id] ?? 0) > 0;
    const ch = sv.challenges[lv.id] ?? {};
    const modes = ['campaign', 'heroic', 'iron', 'endless'] as const;
    const TAB_COLOR = { campaign: 'gold', heroic: 'red', iron: 'blue', endless: 'green' } as const;
    modes.forEach((m, k) => {
      const locked = m !== 'campaign' && !beaten;
      const label = T(m);
      const done = m === 'heroic' ? ch.heroic : m === 'iron' ? ch.iron : false;
      const b = new Button(this, (k - 1.5) * 92, -ph / 2 + 78, 88, 38, label, () => {
        if (locked) {
          sfx.play('error');
          this.toastMsg(T('unlockChallenge'));
          return;
        }
        this.showLevel(i, m);
      }, { color: mode === m ? TAB_COLOR[m] : 'grey', text: { size: getLang() === 'zh' ? (label.length >= 4 ? 14 : 16) : 13 }, sound: !locked });
      if (locked) b.add(this.add.image(34, -10, 'ic_lock').setDisplaySize(20, 20));
      if (done) b.add(this.add.image(36, -12, 'ic_star').setDisplaySize(22, 22));
      c.add(b);
    });
    if (mode === 'campaign') {
      const stars = sv.stars[lv.id] ?? 0;
      for (let k = 0; k < 3; k++) {
        c.add(this.add.image((k - 1) * 46, -ph / 2 + 130, k < stars ? 'ic_star' : 'ic_star_empty').setDisplaySize(40, 40));
      }
      c.add(addText(this, -pw / 2 + 28, -ph / 2 + 158, L(lv.desc), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: pw - 56, lineSpacing: 4 }));
    } else if (mode === 'endless') {
      const best = sv.endless[lv.id] ?? 0;
      c.add(this.add.image(-96, -ph / 2 + 130, 'ic_skull').setDisplaySize(40, 40));
      c.add(addText(this, -68, -ph / 2 + 130, best ? T('bestWave', best) : T('noRecord'), { size: 22, display: true, color: '#2a5a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      c.add(addText(this, 0, -ph / 2 + 176, T('endlessRules'), { size: 17, display: true, color: '#2a5a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false, wrap: pw - 56, align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
    } else {
      const done = mode === 'heroic' ? ch.heroic : ch.iron;
      c.add(this.add.image(0, -ph / 2 + 130, done ? 'ic_star' : 'ic_star_empty').setDisplaySize(44, 44));
      const towers = ironTowers(lv)
        .map((t) => L(TOWERS[t].name))
        .join('、');
      const rules = mode === 'heroic' ? T('heroicRules') : T('ironRules', towers);
      c.add(addText(this, 0, -ph / 2 + 176, rules, { size: 17, display: true, color: mode === 'heroic' ? '#8a2a1a' : '#2a4a7a', stroke: '#f4e2b8', strokeW: 2, shadow: false, wrap: pw - 56, align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
    }
    // 難度
    c.add(addText(this, 0, 74, T('difficulty'), { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0.5));
    const diffs: Difficulty[] = ['casual', 'normal', 'veteran'];
    const btns: Button[] = [];
    const refresh = () => btns.forEach((b, k) => b.bg.setTint(sv.settings.difficulty === diffs[k] ? 0xffffff : 0x8a8a8a));
    diffs.forEach((d, k) => {
      const b = new Button(this, (k - 1) * 112, 112, 104, 42, T(d), () => {
        sv.settings.difficulty = d;
        persist();
        refresh();
      }, { color: d === 'casual' ? 'green' : d === 'normal' ? 'blue' : 'red', text: { size: 17 } });
      btns.push(b);
      c.add(b);
    });
    refresh();
    const go = new Button(this, 0, ph / 2 - 50, 220, 64, T('battle'), () => {
      sfx.play('horn', 0.7);
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(310, () => this.scene.start('Level', { levelId: lv.id, difficulty: sv.settings.difficulty, mode }));
    }, { color: 'green', icon: 'ic_reinforce', iconSize: 36, text: { size: 28 } });
    c.add(go);
    c.add(new IconButton(this, pw / 2 - 18, -ph / 2 + 18, 40, 'ic_close', () => {
      this.infoPanel?.destroy();
      this.infoPanel = null;
    }));
    this.tweens.add({ targets: go, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    popIn(this, c, 0, { w: pw, h: ph }, 0.85, 220);
    this.infoPanel = c;
  }
}
