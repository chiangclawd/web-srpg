import Phaser from 'phaser';
import { PLAY_W, PLAY_X0, VIEW_H, WORLD_W, bgScale, addText, fitText, fontPx, setupCamera, uiZoom, viewW } from '../config';
import { LEVELS } from '../data/levels';
import { UPGRADE_COLUMNS } from '../data/upgrades';
import { HEROES, HERO_ORDER } from '../data/heroes';
import { heroUnlocked } from './HeroScene';
import { mapRoads, paintWorldMap, type MapNode } from '../art/worldmap';
import { showTipBubble } from '../ui/tip';
import { DAILY_MODS, dailyBaseLevel, dailyKey, dailySpec } from '../data/daily';
import { LOGIN_GEMS, loginReward, previousDay } from '../data/login';
import { claimable, ensureQuests, questText, type QuestDay } from '../data/quests';
import { ACHIEVEMENTS } from '../data/achievements';
import { Button, IconButton, dimmer, panel, popIn } from '../ui/widgets';
import { L, T, getLang } from '../i18n';
import { save, persist, totalStars, STARS_PER_LEVEL } from '../save';
import { sfx } from '../audio';
import type { Difficulty } from '../sim/World';
import type { LevelMode } from '../sim/defs';
import { ironTowers } from '../data/challenges';
import { TOWERS } from '../data/towers';
import { PAINTED_LEVELS, levelArtId, levelArtKey } from '../art/terrain';
import { STORY } from '../data/story';
import { playDialog } from '../ui/dialog';
import { loadStoryArt } from '../ui/cinema';

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
  private heroPick: Phaser.GameObjects.Container | null = null;
  private heroHud: Button | null = null;
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
    const at = (id: string) => {
      const l = LEVELS.find((v) => v.id === id);
      return l ? { x: l.mapPos.x * PLAY_W, y: l.mapPos.y * VIEW_H } : undefined;
    };
    const nodes = LEVELS.map((l) => ({ x: l.mapPos.x * PLAY_W, y: l.mapPos.y * VIEW_H, theme: l.theme, bonus: l.bonus, link: l.mapLink ? at(l.mapLink) : undefined }));
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
      const glow = this.add.image(0, -4, 'fx_soft').setTint(lv.night ? 0x9a8aff : lv.bonus ? 0xffa040 : stars ? 0x7ab0ff : 0xffd84a).setBlendMode('ADD').setScale(1.1).setAlpha(0.7);
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
      // 夜戰關卡：旗子旁掛一彎月亮
      if (lv.night) c.add(addText(this, 26, -42, '☾', { size: 32, color: '#fff4c0', stroke: '#2a1a4a', strokeW: 5 }).setOrigin(0.5));
      this.tweens.add({ targets: flagTex, scaleX: 0.82, duration: 520 + (i % 4) * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
    sfx.playBgm('map');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const focusIdx = this.focus ? LEVELS.findIndex((l) => l.id === this.focus) : -1;
    const auto = focusIdx >= 0 && isUnlocked(focusIdx + 1) && focusIdx + 1 < LEVELS.length ? focusIdx + 1 : lastUnlocked;
    // 有新英雄要介紹時先不自動打開關卡面板，免得兩個視窗疊在一起
    // 順序：新英雄介紹 → 每日登入獎勵 → 自動打開關卡面板
    if (!this.announceHero() && !this.loginPopup(() => this.showLevel(auto))) this.time.delayedCall(350, () => this.showLevel(auto));
  }

  /** 每日登入獎勵（通關第一關後才出現，不打擾新手教學）；有跳出來回傳 true */
  private loginPopup(after: () => void): boolean {
    const sv = save();
    if (!(sv.stars.l1 > 0)) return false;
    const now = new Date();
    const today = dailyKey(now);
    const reward = loginReward(sv.login, today, dailyKey(previousDay(now)));
    if (!reward) return false;
    this.time.delayedCall(500, () => {
      const w = viewW(this);
      const left = -(w - PLAY_W) / 2;
      const root = this.add.container(0, 0).setDepth(9000);
      root.add(dimmer(this, w, VIEW_H, 0.6).setPosition(left, 0));
      const pw = 660;
      const ph = 300;
      const c = this.add.container(PLAY_W / 2, VIEW_H / 2);
      root.add(c);
      c.add(panel(this, 0, 0, pw, ph));
      c.add(addText(this, 0, -ph / 2 + 40, T('loginTitle'), { size: 30, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
      // 7 天的格子：已領過打勾、今天發亮
      LOGIN_GEMS.forEach((g, k) => {
        const day = k + 1;
        const x = (k - 3) * 84;
        const y = -26;
        const isToday = day === reward.day;
        const slot = this.add.container(x, y);
        slot.add(this.add.image(0, 0, isToday ? 'ui_badge_blue' : 'ui_badge').setDisplaySize(day === 7 ? 80 : 70, day === 7 ? 80 : 70));
        slot.add(this.add.image(0, -6, 'ic_gem').setDisplaySize(day === 7 ? 38 : 30, day === 7 ? 38 : 30));
        slot.add(addText(this, 0, 20, String(g), { size: 15, display: true, color: '#ffe8a8', strokeW: 3 }).setOrigin(0.5));
        slot.add(addText(this, 0, 52, T('loginDay', day), { size: 13, color: isToday ? '#c0392b' : '#5a3a1a', stroke: '#f4e2b8', strokeW: 0, shadow: false, bold: isToday }).setOrigin(0.5));
        if (day < reward.day) {
          slot.setAlpha(0.6);
          slot.add(this.add.image(16, -18, 'ic_check').setDisplaySize(26, 26));
        }
        if (isToday) this.tweens.add({ targets: slot, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        c.add(slot);
      });
      c.add(fitText(addText(this, 0, 58, T('loginHint'), { size: 15, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0.5), pw - 60));
      c.add(new Button(this, 0, ph / 2 - 42, 220, 56, `${T('claim')}  ${T('gemsEarned', reward.gems)}`, () => {
        sv.gems += reward.gems;
        sv.login = { last: today, streak: reward.day };
        // 連續 7 天：成就
        const ach = ACHIEVEMENTS.find((a) => a.id === 'login_7');
        if (reward.day === 7 && ach && !sv.achievements.includes(ach.id)) {
          sv.achievements.push(ach.id);
          this.time.delayedCall(500, () => this.toastMsg(`${T('achUnlocked')}  ${L(ach.name)}`));
        }
        persist();
        sfx.play('coin');
        sfx.play('sparkle');
        root.destroy();
        this.buildHud();
        after();
      }, { color: 'green', icon: 'ic_gem', iconSize: 30, text: { size: 20 } }));
      sfx.play('star');
      popIn(this, c, 0, { w: pw, h: ph }, 0.6, 320);
    });
    return true;
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
      // 介紹放不下（手機上英文字變大）就逐級縮小，不壓到按鈕
      let size = 15;
      const descText = () => addText(this, tx, -ph / 2 + 152, L(h.desc), { size, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: pw - 280 });
      let desc = descText();
      while (desc.height > ph - 230 && size > 11) {
        desc.destroy();
        size--;
        desc = descText();
      }
      c.add(desc);
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
  private paintedMap(nodes: MapNode[]): void {
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
    for (const l of roads.links) {
      dashed(l, 6, 0x5a320a, 0.55);
      dashed(l, 3, 0xffc860, 1);
    }
    this.mapLife();
  }

  /** 讓手繪地圖動起來：雲影與薄雲緩緩飄過、偶爾一群鳥飛過（都在旗子底下） */
  private mapLife(): void {
    const x0 = -PLAY_X0 - 260;
    const x1 = WORLD_W - PLAY_X0 + 260;
    const drift = (img: Phaser.GameObjects.Image, speed: number) => {
      const go = () => {
        this.tweens.add({
          targets: img,
          x: x1,
          duration: ((x1 - img.x) / speed) * 1000,
          onComplete: () => {
            img.x = x0;
            img.y = Phaser.Math.Between(60, VIEW_H - 120);
            go();
          },
        });
      };
      go();
    };
    for (let i = 0; i < 3; i++) {
      const shadow = this.add.image(Phaser.Math.Between(x0, x1), Phaser.Math.Between(80, VIEW_H - 140), 'fx_soft').setTint(0x0a1418).setAlpha(0.24).setScale(5.5 + i, 2.6 + i * 0.4);
      drift(shadow, 9 + i * 3);
    }
    for (let i = 0; i < 2; i++) {
      const cloud = this.add.image(Phaser.Math.Between(x0, x1), Phaser.Math.Between(60, VIEW_H - 160), 'fx_soft').setTint(0xffffff).setAlpha(0.3).setScale(5.5, 2.2);
      drift(cloud, 14 + i * 4);
    }
    if (!this.textures.exists('map_bird')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.lineStyle(3, 0x2a1a10, 1);
      g.beginPath();
      g.moveTo(2, 4);
      g.lineTo(9, 9);
      g.lineTo(16, 4);
      g.strokePath();
      g.generateTexture('map_bird', 18, 12);
      g.destroy();
    }
    const flock = () => {
      if (!this.sys.isActive()) return;
      const fromLeft = Math.random() < 0.5;
      const y = Phaser.Math.Between(90, VIEW_H - 200);
      const dy = Phaser.Math.Between(-120, 120);
      const n = Phaser.Math.Between(3, 5);
      for (let k = 0; k < n; k++) {
        const b = this.add.image(fromLeft ? x0 : x1, y + (k % 2 ? 14 : -14) * Math.ceil(k / 2), 'map_bird').setScale(1.4).setAlpha(0.9);
        this.tweens.add({ targets: b, scaleY: 0.5, duration: 150 + k * 12, yoyo: true, repeat: -1 });
        this.tweens.add({
          targets: b,
          x: fromLeft ? x1 : x0,
          y: b.y + dy,
          delay: k * 120 + Math.abs(k - n / 2) * 160,
          duration: 12000,
          onComplete: () => b.destroy(),
        });
      }
      this.time.delayedCall(Phaser.Math.Between(14000, 24000), flock);
    };
    this.time.delayedCall(600, flock);
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
    // 底部按鈕列（寬 870）放不下時縮小，免得最左邊的商店鈕被左下角的關閉鈕蓋住
    const zb = this.barZoom();
    const bottomRight = this.add.container(right, VIEW_H).setScale(zb);
    this.hud.push(topLeft, topRight, bottomRight);
    // 總星數
    const sp = panel(this, 100, 34, 170, 46, 'ui_dark', 18);
    const si = this.add.image(40, 34, 'ic_star').setDisplaySize(32, 32);
    const total = LEVELS.length * STARS_PER_LEVEL;
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
    this.heroHud = hb;
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
    // 每日任務（每日挑戰下方；有任務可領獎時亮紅點）
    const qb = new Button(this, -104, 92, 180, 48, T('quests'), () => this.showQuests(), { color: 'wood', icon: 'ic_check', iconSize: 26, text: { size: 18 } });
    topRight.add(qb);
    const ready = claimable(this.todayQuests());
    if (ready > 0) {
      const dot = this.add.circle(-22, 74, 11, 0xc0392b).setStrokeStyle(2, 0xffffff);
      const dt = addText(this, -22, 74, String(ready), { size: 13, display: true }).setOrigin(0.5);
      this.tweens.add({ targets: [dot, dt], scale: 1.2, duration: 500, yoyo: true, repeat: -1 });
      topRight.add([dot, dt]);
    }
    this.hud.push(back);
    this.hud.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(500));
  }

  /** 底部按鈕列的放大倍率：手機放大，但整列要塞進關閉鈕右邊 */
  private barZoom(): number {
    const z = uiZoom();
    return Math.min(z, (viewW(this) - (12 + 64 * z + 14)) / 870);
  }

  /** 今天的任務（換日自動重抽並存檔） */
  private todayQuests(): QuestDay {
    const sv = save();
    const cleared = LEVELS.filter((l) => !l.bonus && (sv.stars[l.id] ?? 0) > 0).length;
    const q = ensureQuests(sv.quests, dailyKey(), cleared);
    if (q !== sv.quests) {
      sv.quests = q;
      persist();
    }
    return q;
  }

  /** 每日任務面板：三個任務的進度條，完成的可以領寶石 */
  private showQuests(): void {
    this.infoPanel?.destroy();
    const q = this.todayQuests();
    const w = viewW(this);
    const left = -(w - PLAY_W) / 2;
    const pw = 560;
    const ph = 400;
    const c = this.add.container(left + w / 2, 340).setDepth(650);
    c.add(panel(this, 0, 0, pw, ph));
    c.add(addText(this, 0, -ph / 2 + 38, T('dailyQuests'), { size: 28, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    c.add(addText(this, 0, -ph / 2 + 70, T('questReset'), { size: 14, color: '#6a4a2a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0.5));
    q.list.forEach((s, k) => {
      const y = -ph / 2 + 128 + k * 86;
      const done = s.cur >= s.n;
      c.add(panel(this, 0, y, pw - 50, 74, done && !s.claimed ? 'ui_panel' : 'ui_dark', 16));
      const tc = done && !s.claimed ? '#4a2a10' : '#f4e2b8';
      c.add(fitText(addText(this, -pw / 2 + 46, y - 14, L(questText(s)), { size: 18, display: true, color: tc, stroke: done && !s.claimed ? '#f4e2b8' : '#2a1608', strokeW: 2, shadow: false }).setOrigin(0, 0.5), 300));
      // 進度條
      const bw = 230;
      const bar = this.add.graphics();
      bar.fillStyle(0x1a0e06, 0.8).fillRoundedRect(-pw / 2 + 46, y + 8, bw, 14, 7);
      bar.fillStyle(done ? 0x6ac04a : 0xe0b040, 1).fillRoundedRect(-pw / 2 + 46, y + 8, Math.max(14, (bw * s.cur) / s.n), 14, 7);
      c.add(bar);
      c.add(addText(this, -pw / 2 + 46 + bw + 10, y + 15, `${s.cur}/${s.n}`, { size: 14, color: tc, stroke: '#2a1608', strokeW: done && !s.claimed ? 0 : 2, shadow: false }).setOrigin(0, 0.5));
      // 獎勵＋領取
      const rx = pw / 2 - 96;
      if (s.claimed) {
        c.add(this.add.image(rx, y, 'ui_badge_green').setDisplaySize(48, 48));
        c.add(this.add.image(rx, y, 'ic_check').setDisplaySize(28, 28));
      } else {
        const b = new Button(this, rx, y, 120, 50, `${s.reward}`, () => {
          if (s.cur < s.n || s.claimed) return;
          s.claimed = true;
          const sv = save();
          sv.gems = (sv.gems ?? 0) + s.reward;
          persist();
          sfx.play('coin');
          sfx.play('sparkle', 0.6);
          this.buildHud();
          this.showQuests();
        }, { color: done ? 'green' : 'grey', icon: 'ic_gem', iconSize: 28, text: { size: 22 }, disabled: !done });
        c.add(b);
      }
    });
    c.add(new IconButton(this, pw / 2 - 18, -ph / 2 + 18, 40, 'ic_close', () => {
      this.infoPanel?.destroy();
      this.infoPanel = null;
    }));
    popIn(this, c, 0, { w: pw, h: ph }, 0.85, 220);
    this.infoPanel = c;
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
    // 修正列：名稱貼在圖示中線上方、說明貼在下方（手機字放大後兩行才不會疊在一起）
    const rowH = Math.max(58, fontPx(18) + fontPx(14) + 18);
    let y = nameY + 44;
    for (const id of spec.mods) {
      const m = DAILY_MODS[id];
      const col = m.good ? '#2a6a1a' : '#9a2a1a';
      c.add(this.add.image(-pw / 2 + 46, y + 10, m.good ? 'ui_badge_green' : 'ui_badge_red').setDisplaySize(40, 40));
      c.add(this.add.image(-pw / 2 + 46, y + 10, m.good ? 'ic_coin' : 'ic_skull').setDisplaySize(24, 24));
      c.add(addText(this, -pw / 2 + 76, y + 11, L(m.name), { size: 18, display: true, color: col, stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 1));
      const desc = id === 'limited' ? T('dailyLimited', spec.towers.map((t) => L(TOWERS[t].name)).join('、')) : L(m.desc);
      c.add(fitText(addText(this, -pw / 2 + 76, y + 11, desc, { size: 14, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0), pw - 100));
      y += rowH;
    }
    // 由下往上排：出征鈕 → 提示（戰役進度不夠時）→ 今日最佳
    const cleared = (sv.stars[lv.id] ?? 0) > 0;
    const warnY = ph / 2 - 80 - fontPx(15) / 2 - 6;
    const bestY = (cleared ? ph / 2 - 80 : warnY - fontPx(15) / 2) - 26;
    const best = sv.daily[key] ?? 0;
    c.add(addText(this, -60, bestY, T('todayBest'), { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(1, 0.5));
    for (let k = 0; k < 3; k++) c.add(this.add.image(-30 + k * 36, bestY, k < best ? 'ic_star' : 'ic_star_empty').setDisplaySize(32, 32));
    // 要先通過當天這一關（戰役進度不夠時提示要打哪一關）
    const go = new Button(this, 0, ph / 2 - 50, 220, 60, T('battle'), () => {
      sfx.play('horn', 0.7);
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(310, () => this.scene.start('Level', { levelId: lv.id, difficulty: 'normal', mode: 'daily' }));
    }, { color: 'green', icon: 'ic_reinforce', iconSize: 34, text: { size: 26 }, disabled: !cleared });
    c.add(go);
    if (!cleared) {
      c.add(fitText(addText(this, 0, warnY, T('dailyNeedLevel', `${idx + 1}. ${L(lv.name)}`), { size: 15, color: '#9a2a1a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0.5), pw - 40));
    }
    c.add(new IconButton(this, pw / 2 - 18, -ph / 2 + 18, 40, 'ic_close', () => {
      this.infoPanel?.destroy();
      this.infoPanel = null;
    }));
    popIn(this, c, 0, { w: pw, h: ph }, 0.85, 220);
    this.infoPanel = c;
  }

  /** 地圖首次提示：有星星可用 → 指向升級；打贏過一場 → 指向每日任務；寶石夠買道具 → 指向商店 */
  private mapTip(): void {
    const sv = save();
    let id: 'upgrades' | 'shop' | 'quests' | null = null;
    if (!sv.tipsSeen.includes('upgrades') && starsAvailable() > 0) id = 'upgrades';
    else if (!sv.tipsSeen.includes('quests') && sv.stats.victories > 0) id = 'quests';
    else if (!sv.tipsSeen.includes('shop') && (sv.gems ?? 0) >= 40) id = 'shop';
    if (!id) return;
    const tip = id;
    this.time.delayedCall(900, () => {
      if (!this.sys.isActive()) return;
      const w = viewW(this);
      // 底部按鈕位置（與 buildHud 一致；螢幕座標，手機上整組放大）
      const z = uiZoom();
      sv.tipsSeen.push(tip);
      persist();
      this.infoPanel?.destroy();
      this.infoPanel = null;
      // 任務鈕在右上（每日挑戰下方），升級／商店在底部
      if (tip === 'quests') showTipBubble(this, w - 104 * z, 92 * z, T('tipQuests'), () => {}, 2000);
      else {
        const zb = this.barZoom();
        showTipBubble(this, w - (tip === 'upgrades' ? 470 : 790) * zb, VIEW_H - 42 * zb, T(tip === 'upgrades' ? 'tipUpgrades' : 'tipShop'), () => {}, 2000);
      }
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
    this.heroPick = null;
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
    const modes = ['campaign', 'heroic', 'iron', 'endless', 'bossrush'] as const;
    const TAB_COLOR = { campaign: 'gold', heroic: 'red', iron: 'blue', endless: 'green', bossrush: 'wood' } as const;
    // 首領連戰：通關最終關後才開放（每張地圖都能打）
    const rushOpen = (sv.stars.l12 ?? 0) > 0;
    modes.forEach((m, k) => {
      const locked = m === 'bossrush' ? !rushOpen : m !== 'campaign' && !beaten;
      const label = T(m);
      const done = m === 'heroic' ? ch.heroic : m === 'iron' ? ch.iron : m === 'bossrush' ? (sv.bossrush[lv.id] ?? 0) > 0 : false;
      const b = new Button(this, (k - 2) * 75, -ph / 2 + 78, 72, 38, label, () => {
        if (locked) {
          sfx.play('error');
          this.toastMsg(T(m === 'bossrush' ? 'bossRushLocked' : 'unlockChallenge'));
          return;
        }
        this.showLevel(i, m);
      }, { color: mode === m ? TAB_COLOR[m] : 'grey', text: { size: getLang() === 'zh' ? (label.length >= 4 ? 13 : 15) : 12 }, sound: !locked });
      fitText(b.label, 64);
      if (locked) b.add(this.add.image(28, -10, 'ic_lock').setDisplaySize(18, 18));
      if (done) b.add(this.add.image(30, -12, 'ic_star').setDisplaySize(20, 20));
      c.add(b);
    });
    if (mode === 'campaign') {
      const stars = sv.stars[lv.id] ?? 0;
      const thumb = PAINTED_LEVELS.has(levelArtId(lv));
      if (thumb) this.levelThumb(c, levelArtId(lv), 0, -80, pw - 56, 84, lv);
      // 看過的開場劇情可以重播（有手繪插畫就用電影模式）
      const story = STORY[lv.id];
      if (story && sv.storySeen.includes(lv.id)) {
        const sb = new Button(this, (pw - 56) / 2 - 52, thumb ? -80 - 22 : -ph / 2 + 104, 96, 34, `▶ ${T('story')}`, () => {
          loadStoryArt(this, lv.id, (key) => playDialog(this, story, () => {}, { depth: 3000, art: key ? { key, id: lv.id } : undefined }));
        }, { color: 'blue', text: { size: 14 } });
        fitText(sb.label, 84);
        c.add(sb);
      }
      const sy = thumb ? -40 : -ph / 2 + 130;
      for (let k = 0; k < 3; k++) {
        c.add(this.add.image((k - 1) * 46, sy, k < stars ? 'ic_star' : 'ic_star_empty').setDisplaySize(40, 40));
      }
      // 說明文字放不下（英文較長、手機放大字體）就逐級縮小字級，不壓到下面的難度列
      const dy = thumb ? -14 : -ph / 2 + 158;
      const maxH = 66 - dy;
      let size = 16;
      let desc = addText(this, -pw / 2 + 28, dy, L(lv.desc), { size, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: pw - 56, lineSpacing: 4 });
      while (desc.height > maxH && size > 12) {
        desc.destroy();
        size--;
        desc = addText(this, -pw / 2 + 28, dy, L(lv.desc), { size, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: pw - 56, lineSpacing: size >= 15 ? 4 : 2 });
      }
      c.add(desc);
    } else if (mode === 'bossrush') {
      const best = sv.bossrush[lv.id] ?? 0;
      c.add(addText(this, 0, -ph / 2 + 118, T('bestStars'), { size: 15, color: '#5a3a1a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0.5));
      for (let k = 0; k < 3; k++) c.add(this.add.image((k - 1) * 46, -ph / 2 + 146, k < best ? 'ic_star' : 'ic_star_empty').setDisplaySize(38, 38));
      // 規則文字：放不下就逐級縮小，不壓到難度列
      let size = 16;
      const rules = () => addText(this, 0, -ph / 2 + 176, T('bossRushRules'), { size, color: '#5a2a10', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: pw - 56, align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0);
      let rt = rules();
      while (rt.height > 66 - (-ph / 2 + 176) && size > 12) {
        rt.destroy();
        size--;
        rt = rules();
      }
      c.add(rt);
    } else if (mode === 'endless') {
      const best = sv.endless[lv.id] ?? 0;
      c.add(this.add.image(-96, -ph / 2 + 130, 'ic_skull').setDisplaySize(40, 40));
      c.add(addText(this, -68, -ph / 2 + 130, best ? T('bestWave', best) : T('noRecord'), { size: 22, display: true, color: '#2a5a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      // 規則文字：放不下就逐級縮小，不壓到難度列
      let size = 17;
      const rules = () => addText(this, 0, -ph / 2 + 176, T('endlessRules'), { size, display: true, color: '#2a5a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false, wrap: pw - 56, align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0);
      let rt = rules();
      while (rt.height > 66 - (-ph / 2 + 176) && size > 12) {
        rt.destroy();
        size--;
        rt = rules();
      }
      c.add(rt);
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
    c.add(addText(this, 0, 80, T('difficulty'), { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0.5));
    const diffs: Difficulty[] = ['casual', 'normal', 'veteran'];
    const btns: Button[] = [];
    const refresh = () => btns.forEach((b, k) => b.bg.setTint(sv.settings.difficulty === diffs[k] ? 0xffffff : 0x8a8a8a));
    diffs.forEach((d, k) => {
      const b = new Button(this, (k - 1) * 112, 116, 104, 42, T(d), () => {
        sv.settings.difficulty = d;
        persist();
        refresh();
      }, { color: d === 'casual' ? 'green' : d === 'normal' ? 'blue' : 'red', text: { size: 17 } });
      btns.push(b);
      c.add(b);
    });
    refresh();
    // 出戰英雄：點頭像就地換人，不必跑去英雄室
    const cur = HEROES[sv.selectedHero] ? sv.selectedHero : 'arthur';
    const heroBtn = new IconButton(this, -pw / 2 + 50, ph / 2 - 50, 64, `ptc_${cur}`, () => this.toggleHeroPick(c, heroBtn), 'ui_badge_blue', 0.82);
    c.add(heroBtn);
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

  /** 關卡面板裡的英雄快選：兩排頭像蓋在難度列上，點了就換出戰英雄並喊一聲 */
  private toggleHeroPick(c: Phaser.GameObjects.Container, btn: IconButton): void {
    if (this.heroPick) {
      this.heroPick.destroy();
      this.heroPick = null;
      return;
    }
    const box = this.add.container(0, 56);
    // 實心底，免得下面的說明文字透出來
    const solid = this.add.graphics();
    solid.fillStyle(0x24160c, 1);
    solid.fillRoundedRect(-176, -80, 352, 160, 16);
    const bg = panel(this, 0, 0, 364, 172, 'ui_dark', 18).setInteractive();
    box.add([solid, bg]);
    HERO_ORDER.forEach((id, k) => {
      const ok = heroUnlocked(id);
      if (ok) sfx.preloadVoice(id);
      const bx = ((k % 4) - 1.5) * 84;
      const by = Math.floor(k / 4) * 78 - 46;
      const b = new IconButton(this, bx, by, 58, `ptc_${id}`, () => {
        if (!ok) {
          sfx.play('error');
          const after = LEVELS.find((l) => l.id === HEROES[id].unlockAfter);
          this.toastMsg(T('unlockAfter', L(after?.name)));
          return;
        }
        save().selectedHero = id;
        persist();
        btn.setIcon(`ptc_${id}`);
        btn.icon.setDisplaySize(64 * 0.82, 64 * 0.82);
        this.heroHud?.setIcon(`ptc_${id}`);
        sfx.voice(id, 'select');
        box.destroy();
        this.heroPick = null;
      }, save().selectedHero === id ? 'ui_badge_blue' : 'ui_badge', 0.82);
      if (!ok) {
        b.icon.setTint(0x333333);
        b.add(this.add.image(0, 0, 'ic_lock').setDisplaySize(26, 26));
      }
      box.add(b);
      // 頭像下方的名字（未解鎖顯示 ???）
      box.add(fitText(addText(this, bx, by + 36, ok ? L(HEROES[id].name) : '???', { size: 13, display: true, color: ok ? '#ffe8a8' : '#8a7a62', strokeW: 3 }).setOrigin(0.5), 80));
    });
    c.add(box);
    box.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    this.heroPick = box;
  }

  /**
   * 關卡面板上的戰場縮圖：按需下載該關的手繪背景（只留這一張），裁出中段。
   * 進關時 LevelScene 直接沿用同一張紋理，不必再下載。
   */
  private levelThumb(c: Phaser.GameObjects.Container, id: string, x: number, y: number, w: number, h: number, lv?: { mirror?: boolean; grade?: number }): void {
    const frame = this.add.graphics();
    frame.fillStyle(0x3a2412, 1);
    frame.fillRoundedRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 10, 10);
    frame.fillStyle(0xc8b088, 1);
    frame.fillRect(x - w / 2, y - h / 2, w, h);
    c.add(frame);
    const key = levelArtKey(id);
    const edge = this.add.graphics();
    const place = () => {
      if (!c.active || !this.textures.exists(key)) return;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const cw = (src.width * PLAY_W) / WORLD_W;
      const k = w / cw;
      const ch = h / k;
      const img = this.add.image(x, y, key).setScale(k).setAlpha(0);
      img.setCrop((src.width - cw) / 2, (src.height - ch) / 2, cw, ch);
      if (lv?.mirror) img.setFlipX(true);
      if (lv?.grade) img.setTint(lv.grade);
      c.addAt(img, c.getIndex(frame) + 1);
      this.tweens.add({ targets: img, alpha: 1, duration: 200 });
    };
    // 內框：金邊＋下緣陰影，讓壓在上面的星星看得清楚
    edge.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.45, 0.45);
    edge.fillRect(x - w / 2, y + h / 2 - 34, w, 34);
    edge.lineStyle(2, 0xe8c070, 1);
    edge.strokeRect(x - w / 2, y - h / 2, w, h);
    c.add(edge);
    if (this.textures.exists(key)) {
      place();
      return;
    }
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('lvbg_')) this.textures.remove(k);
    this.load.image(key, `assets/levels/${id}.webp`);
    this.load.once(`filecomplete-image-${key}`, place);
    this.load.start();
  }
}
