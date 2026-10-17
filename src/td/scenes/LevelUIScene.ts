import Phaser from 'phaser';
import { VIEW_H, addText, fitText, fontPx, hudZoom, setupCamera, uiZoom, viewW } from '../config';
import { ENEMIES } from '../data/enemies';
import { ACHIEVEMENTS } from '../data/achievements';
import type { StoryLine } from '../data/story';
import { LEVELS } from '../data/levels';
import { HERO_XP_TABLE, HERO_MAX_LEVEL } from '../data/heroes';
import { ITEMS, ITEM_ORDER, GOLD_SACK, POTION_LIVES, type ItemId } from '../data/items';
import type { EliteAffix, EnemyDef } from '../sim/defs';
import { ELITE } from '../sim/World';
import { IconButton, Button, panel, dimmer, popIn } from '../ui/widgets';
import { playDialog } from '../ui/dialog';
import { showTipBubble } from '../ui/tip';
import { shareResult } from '../ui/share';
import { DAILY_MODS, dailySpec } from '../data/daily';
import { L, T } from '../i18n';
import { save, persist } from '../save';
import { sfx } from '../audio';
import type { LevelScene } from './LevelScene';
import { armorWord } from './LevelScene';

export interface InfoData {
  title: string;
  desc: string;
  stats: [string, string][];
  cost?: number;
  icon?: string;
  icons?: { tex: string; count: number; tint?: number; boss?: boolean }[];
}

export class LevelUIScene extends Phaser.Scene {
  private lvl!: LevelScene;
  private livesTxt!: Phaser.GameObjects.Text;
  private goldTxt!: Phaser.GameObjects.Text;
  private waveTxt!: Phaser.GameObjects.Text;
  private statsPanel!: Phaser.GameObjects.Container;
  private pauseBtn!: IconButton;
  /** 右上角：暫停 / 速度（手機上整組放大） */
  private topRight!: Phaser.GameObjects.Container;
  /** HUD 放大倍率（手機上讓按鈕接近手指大小；桌機為 1） */
  private hudZoom = 1;
  private speedBtn!: IconButton;
  private speedTxt!: Phaser.GameObjects.Text;
  private heroBtn: IconButton | null = null;
  private heroHp!: Phaser.GameObjects.Rectangle;
  private heroXp!: Phaser.GameObjects.Rectangle;
  private heroLv!: Phaser.GameObjects.Text;
  private heroDead!: Phaser.GameObjects.Text;
  private heroShade!: Phaser.GameObjects.Arc;
  private spellBtns: Record<'meteor' | 'reinforce', { btn: IconButton; cd: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text }> = {} as never;
  private bottomLeft!: Phaser.GameObjects.Container;
  private infoBox: Phaser.GameObjects.Container | null = null;
  private toastTxt: Phaser.GameObjects.Container | null = null;
  private modal: Phaser.GameObjects.Container | null = null;
  private lastGold = -1;
  private lastLives = -1;
  private bossBar: Phaser.GameObjects.Container | null = null;
  private bossFill: Phaser.GameObjects.Rectangle | null = null;
  private bossId = -1;
  private itemBar!: Phaser.GameObjects.Container;
  private ult: { btn: IconButton; cd: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text } | null = null;
  private itemSlots: Partial<Record<ItemId, { btn: IconButton; count: Phaser.GameObjects.Text; dot: Phaser.GameObjects.Arc }>> = {};

  constructor() {
    super('LevelUI');
  }

  init(data: { level: LevelScene }): void {
    this.lvl = data.level;
    this.infoBox = null;
    this.toastTxt = null;
    this.modal = null;
    this.lastGold = -1;
    this.lastLives = -1;
    this.bossBar = null;
    this.bossFill = null;
    this.bossId = -1;
  }

  create(): void {
    setupCamera(this);
    this.hudZoom = hudZoom();
    // 左上：生命 / 金幣 / 波次
    this.statsPanel = this.add.container(12, 10);
    const bg = panel(this, 0, 0, 336, 50, 'ui_dark', 20).setOrigin(0);
    const heart = this.add.image(26, 25, 'ic_heart').setDisplaySize(34, 34);
    this.livesTxt = addText(this, 46, 25, '20', { size: 24, display: true }).setOrigin(0, 0.5);
    const coin = this.add.image(112, 25, 'ic_coin').setDisplaySize(34, 34);
    this.goldTxt = addText(this, 132, 25, '0', { size: 24, display: true, color: '#ffe066' }).setOrigin(0, 0.5);
    const skull = this.add.image(234, 25, 'ic_skull').setDisplaySize(30, 30);
    this.waveTxt = addText(this, 252, 25, '0/0', { size: 20, display: true }).setOrigin(0, 0.5);
    this.statsPanel.add([bg, heart, this.livesTxt, coin, this.goldTxt, skull, this.waveTxt]);

    // 右上：暫停 / 速度（以右上角為錨點）
    this.topRight = this.add.container(0, 0);
    this.pauseBtn = new IconButton(this, -30, 28, 52, 'ic_pause', () => this.lvl.togglePause(), 'ui_badge');
    this.speedBtn = new IconButton(this, -90, 28, 52, 'ic_fast', () => {
      this.lvl.toggleSpeed();
      this.refreshSpeed();
    }, 'ui_badge');
    this.speedTxt = addText(this, -90, 58, '', { size: 14, display: true, color: '#ffe066' }).setOrigin(0.5);
    this.topRight.add([this.pauseBtn, this.speedBtn, this.speedTxt]);

    // 左下：英雄 + 法術
    this.bottomLeft = this.add.container(0, 0);
    const hero = this.lvl.world.hero;
    if (hero?.hero) {
      const hid = hero.hero.def.id;
      this.heroBtn = new IconButton(this, 46, -48, 76, `ptc_${hid}`, () => this.lvl.selectHero(), 'ui_badge', 0.8);
      this.heroShade = this.add.circle(46, -48, 30, 0x000000, 0.55).setVisible(false);
      this.heroDead = addText(this, 46, -48, '', { size: 22, display: true }).setOrigin(0.5);
      const hpBg = this.add.rectangle(46, -4, 70, 9, 0x1a0a04).setStrokeStyle(1.5, 0x000000);
      this.heroHp = this.add.rectangle(12, -4, 66, 6, 0x4ab0ff).setOrigin(0, 0.5);
      const xpBg = this.add.rectangle(46, 5, 70, 5, 0x1a0a04);
      this.heroXp = this.add.rectangle(12, 5, 66, 3, 0xffd84a).setOrigin(0, 0.5);
      const lvBadge = this.add.circle(78, -78, 13, 0x2a1608).setStrokeStyle(2, 0xe0b050);
      this.heroLv = addText(this, 78, -78, '1', { size: 14, display: true }).setOrigin(0.5);
      this.bottomLeft.add([this.heroBtn, this.heroShade, this.heroDead, hpBg, this.heroHp, xpBg, this.heroXp, lvBadge, this.heroLv]);
    }
    // 英雄絕招：緊鄰英雄頭像
    this.ult = null;
    if (hero?.hero) {
      const ux = 128;
      const btn = new IconButton(this, ux, -40, 62, hero.hero.def.ult.icon, () => this.lvl.enterHeroUlt(), 'ui_badge_gold');
      const cd = this.add.graphics();
      cd.setPosition(ux, -40);
      const txt = addText(this, ux, -40, '', { size: 18, display: true }).setOrigin(0.5);
      this.bottomLeft.add([btn, cd, txt]);
      this.ult = { btn, cd, txt };
    }
    const sx = hero ? 200 : 46;
    (['meteor', 'reinforce'] as const).forEach((k, i) => {
      const btn = new IconButton(this, sx + i * 72, -40, 62, k === 'meteor' ? 'ic_meteor' : 'ic_reinforce', () => this.lvl.enterSpell(k), 'ui_badge');
      const cd = this.add.graphics();
      cd.setPosition(sx + i * 72, -40);
      const txt = addText(this, sx + i * 72, -40, '', { size: 18, display: true }).setOrigin(0.5);
      this.bottomLeft.add([btn, cd, txt]);
      this.spellBtns[k] = { btn, cd, txt };
      if (!this.lvl.world.spellsEnabled) {
        btn.setEnabled(false);
        this.bottomLeft.add(this.add.image(sx + i * 72 + 18, -22, 'ic_lock').setDisplaySize(24, 24));
      }
    });

    // 右下：道具列
    this.itemBar = this.add.container(0, 0);
    this.itemSlots = {};
    ITEM_ORDER.forEach((id, i) => {
      const x = -30 - (ITEM_ORDER.length - 1 - i) * 56;
      const btn = new IconButton(this, x, -32, 50, ITEMS[id].icon, () => this.lvl.useItem(id), 'ui_badge', 0.7);
      const dot = this.add.circle(x + 17, -13, 10, 0x2a1608).setStrokeStyle(2, 0xe0b050);
      const count = addText(this, x + 17, -13, '0', { size: 12, display: true }).setOrigin(0.5);
      this.itemBar.add([btn, dot, count]);
      this.itemSlots[id] = { btn, count, dot };
      if (!this.lvl.world.spellsEnabled) {
        btn.setEnabled(false);
        this.itemBar.add(this.add.image(x - 15, -15, 'ic_lock').setDisplaySize(18, 18));
      }
    });
    this.refreshItems();

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.refreshSpeed();
  }

  private layout(): void {
    const w = viewW(this);
    // 四個角的 HUD 各自以角落為錨點縮放：手機上按鈕放大，不會跑出畫面
    const z = this.hudZoom;
    this.statsPanel.setPosition(12, 10).setScale(z);
    this.topRight.setPosition(w - 8, 8).setScale(z);
    this.bottomLeft.setPosition(8, VIEW_H - 14).setScale(z);
    this.itemBar.setPosition(w - 8, VIEW_H - 8).setScale(z);
    if (this.modal) this.modal.setPosition(w / 2, VIEW_H / 2);
  }

  private refreshSpeed(): void {
    this.speedTxt.setText(`${this.lvl.speed}x`);
    this.speedBtn.badge.setTint(this.lvl.speed >= 3 ? 0xffb070 : this.lvl.speed > 1 ? 0xffe08a : 0xffffff);
  }

  /** 每幀由 LevelScene 呼叫 */
  refresh(): void {
    const w = this.lvl.world;
    if (!this.livesTxt) return;
    if (w.gold !== this.lastGold) {
      if (this.lastGold >= 0 && w.gold > this.lastGold) {
        this.tweens.add({ targets: this.goldTxt, scale: 1.18, duration: 80, yoyo: true });
      }
      this.lastGold = w.gold;
      this.goldTxt.setText(String(w.gold));
    }
    if (w.lives !== this.lastLives) {
      this.lastLives = w.lives;
      this.livesTxt.setText(String(Math.max(0, w.lives)));
      this.livesTxt.setColor(w.lives <= 5 ? '#ff7a6a' : '#fff6dc');
    }
    this.waveTxt.setText(`${Math.max(0, w.waveIndex + 1)}/${this.lvl.mode0 === 'endless' ? '∞' : w.waveCount}`);
    // 英雄
    const h = w.hero;
    if (h?.hero && this.heroBtn) {
      const hr = h.hero;
      this.heroHp.width = 66 * Phaser.Math.Clamp(h.hp / h.maxHp, 0, 1);
      const lv = hr.level;
      const cur = HERO_XP_TABLE[lv - 1];
      const nxt = lv >= HERO_MAX_LEVEL ? cur + 1 : HERO_XP_TABLE[lv];
      this.heroXp.width = lv >= HERO_MAX_LEVEL ? 66 : 66 * Phaser.Math.Clamp((hr.xp - cur) / (nxt - cur), 0, 1);
      this.heroLv.setText(String(lv));
      const dead = !h.alive;
      this.heroShade.setVisible(dead);
      this.heroDead.setText(dead ? String(Math.ceil(Math.max(0, hr.respawnAt - w.time))) : '');
      this.heroBtn.badge.setTint(this.lvl.mode === 'hero' ? 0xffe08a : 0xffffff);
    }
    // 法術冷卻
    const drawCd = (k: 'meteor' | 'reinforce', cd: number, max: number) => {
      const s = this.spellBtns[k];
      s.cd.clear();
      const active = this.lvl.mode === k;
      s.btn.badge.setTint(active ? 0xffe08a : 0xffffff);
      if (cd > 0) {
        const f = cd / max;
        s.cd.fillStyle(0x000000, 0.55);
        s.cd.slice(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false);
        s.cd.fillPath();
        s.txt.setText(String(Math.ceil(cd)));
        s.btn.icon.setAlpha(0.6);
      } else {
        s.txt.setText('');
        s.btn.icon.setAlpha(1);
      }
    };
    drawCd('meteor', w.meteorCd, w.meteorCdMax);
    drawCd('reinforce', w.reinfCd, w.reinfCdMax);
    if (this.ult) {
      const u = this.ult;
      u.cd.clear();
      u.btn.badge.setTint(this.lvl.mode === 'ult' ? 0xffffff : 0xe8e0d0);
      if (w.heroUltCd > 0) {
        u.cd.fillStyle(0x000000, 0.55);
        u.cd.slice(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (w.heroUltCd / w.heroUltCdMax), false);
        u.cd.fillPath();
        u.txt.setText(String(Math.ceil(w.heroUltCd)));
        u.btn.icon.setAlpha(0.6);
        u.btn.setScale(1);
      } else {
        u.txt.setText('');
        u.btn.icon.setAlpha(1);
        // 冷卻好了：輕微脈動提醒
        u.btn.setScale(this.lvl.mode === 'ult' ? 1.08 : 1 + Math.abs(Math.sin(this.time.now / 300)) * 0.06);
      }
    }
    // 首領血條
    const boss = w.enemies.find((e) => e.def.boss && e.alive);
    if (boss) {
      if (!this.bossBar || this.bossId !== boss.id) this.makeBossBar(boss.id, L(boss.def.name), boss.def.sprite);
      if (this.bossFill) this.bossFill.width = 356 * Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    } else if (this.bossBar) {
      const b = this.bossBar;
      this.bossBar = null;
      this.bossFill = null;
      this.bossId = -1;
      this.tweens.add({ targets: b, alpha: 0, y: b.y - 20, duration: 300, onComplete: () => b.destroy() });
    }
  }

  private makeBossBar(id: number, name: string, sprite: string): void {
    this.bossBar?.destroy();
    const w = viewW(this);
    const c = this.add.container(w / 2, 34).setDepth(40);
    c.add(panel(this, 0, 0, 420, 50, 'ui_dark', 18));
    const face = this.add.image(-188, 18, sprite).setOrigin(0.5, 1);
    face.setScale(Math.min(46 / face.frame.height, 46 / face.frame.width));
    c.add(face);
    c.add(addText(this, -160, -12, name, { size: 15, display: true, color: '#ffb08a' }).setOrigin(0, 0.5));
    c.add(this.add.rectangle(-160, 10, 360, 12, 0x1a0a04).setOrigin(0, 0.5).setStrokeStyle(2, 0x000000));
    this.bossFill = this.add.rectangle(-158, 10, 356, 8, 0xd8402a).setOrigin(0, 0.5);
    c.add(this.bossFill);
    this.bossBar = c;
    this.bossId = id;
    c.setAlpha(0).setY(10);
    this.tweens.add({ targets: c, alpha: 1, y: 34, duration: 300, ease: 'Back.easeOut' });
  }

  /** 成就解鎖提示 */
  achievementToast(id: string): void {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    const w = viewW(this);
    const c = this.add.container(w / 2, -60).setDepth(200);
    c.add(panel(this, 0, 0, 380, 70, 'ui_dark', 20));
    c.add(this.add.image(-150, 0, 'ui_badge_green').setDisplaySize(54, 54));
    c.add(this.add.image(-150, 0, a.icon).setDisplaySize(32, 32));
    c.add(addText(this, -114, -14, T('achUnlocked'), { size: 13, color: '#9aff7a', strokeW: 2 }).setOrigin(0, 0.5));
    c.add(addText(this, -114, 10, L(a.name), { size: 20, display: true, color: '#ffe8a8' }).setOrigin(0, 0.5));
    sfx.play('star');
    // 停在結算面板上方，不蓋住「勝利」標題
    this.tweens.add({ targets: c, y: 66, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: -60, alpha: 0, delay: 2600, duration: 380, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
  }

  spellButton(k: 'meteor' | 'reinforce'): void {
    this.lvl.enterSpell(k);
  }

  flashSpell(k: 'meteor' | 'reinforce'): void {
    const s = this.spellBtns[k];
    this.tweens.add({ targets: s.btn, scale: 1.2, duration: 100, yoyo: true });
  }

  onModeChange(m: string): void {
    // 法術高亮由 refresh() 處理；道具在這裡
    for (const id of ITEM_ORDER) this.itemSlots[id]?.btn.badge.setTint(m === id ? 0xffe08a : 0xffffff);
  }

  hasModal(): boolean {
    return !!this.modal;
  }

  /** 首次提示：暫停並用泡泡指向對應按鈕；有開對話框時不顯示（下次再試） */
  showTip(id: 'spells' | 'ult' | 'items'): boolean {
    if (this.modal) return false;
    const bl = this.bottomLeft;
    let x = 0;
    let y = 0;
    if (id === 'ult') {
      if (!this.ult) return false;
      x = bl.x + this.ult.btn.x * bl.scaleX;
      y = bl.y + this.ult.btn.y * bl.scaleY;
    } else if (id === 'spells') {
      const m = this.spellBtns.meteor.btn;
      const r = this.spellBtns.reinforce.btn;
      x = bl.x + ((m.x + r.x) / 2) * bl.scaleX;
      y = bl.y + m.y * bl.scaleY;
    } else {
      x = this.itemBar.x - 114 * this.itemBar.scaleX;
      y = this.itemBar.y - 32 * this.itemBar.scaleY;
    }
    const sv = save();
    if (!sv.tipsSeen.includes(id)) sv.tipsSeen.push(id);
    persist();
    this.lvl.togglePause(true);
    this.closeModal();
    const text = T(id === 'ult' ? 'tipUlt' : id === 'spells' ? 'tipSpells' : 'tipItems');
    this.modal = showTipBubble(this, x, y, text, () => {
      this.modal = null;
      this.lvl.togglePause(false);
    });
    return true;
  }

  /** 更新道具數量（用掉或開場時） */
  refreshItems(): void {
    const inv = save().items;
    for (const id of ITEM_ORDER) {
      const sl = this.itemSlots[id];
      if (!sl) continue;
      const n = inv[id] ?? 0;
      sl.count.setText(String(n));
      sl.btn.icon.setAlpha(n > 0 ? 1 : 0.4);
      sl.dot.setFillStyle(n > 0 ? 0x2a1608 : 0x5a1a10);
    }
  }

  /** 絕招施放：英雄立繪從左側滑入＋絕招名稱 */
  ultPop(): void {
    const h = this.lvl.world.hero?.hero;
    if (!h) return;
    const c = this.add.container(0, VIEW_H * 0.36).setDepth(64);
    if (this.textures.exists(`pt_${h.def.id}`)) {
      const p = this.add.image(0, 120, `pt_${h.def.id}`).setOrigin(0, 1);
      p.setScale(260 / p.frame.height);
      c.add(p);
    }
    const name = addText(this, 190, 40, L(h.def.ult.name), { size: 36, display: true, color: '#ffe066', strokeW: 7 }).setOrigin(0, 0.5);
    c.add(name);
    c.x = -260;
    c.setAlpha(0);
    this.tweens.add({ targets: c, x: 10, alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: c, x: -40, alpha: 0, delay: 1000, duration: 350, onComplete: () => c.destroy() });
  }

  /** 使用道具時在畫面中央彈出圖示與效果文字 */
  itemPop(id: ItemId): void {
    const w = viewW(this);
    const c = this.add.container(w / 2, VIEW_H * 0.42).setDepth(65);
    const icon = this.add.image(0, 0, ITEMS[id].icon).setDisplaySize(84, 84);
    c.add(icon);
    const label = id === 'potion' ? `+${POTION_LIVES} ❤` : id === 'gold' ? `+${GOLD_SACK}` : L(ITEMS[id].name);
    const color = id === 'potion' ? '#ff8a9a' : id === 'gold' ? '#ffe066' : id === 'frost' ? '#9ae4ff' : '#ffb05a';
    c.add(addText(this, 0, 56, label, { size: 28, display: true, color, strokeW: 6 }).setOrigin(0.5));
    c.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, y: c.y - 40, delay: 900, duration: 400, onComplete: () => c.destroy() });
    if (id === 'potion') this.tweens.add({ targets: this.livesTxt, scale: 1.4, duration: 140, yoyo: true, repeat: 1 });
  }

  /** 結算面板上的寶石獎勵列 */
  /** 結算面板左側：本場傷害最高的塔（MVP） */
  private mvpBadge(c: Phaser.GameObjects.Container, x: number, y: number): void {
    const t = [...this.lvl.world.towers].sort((a, b) => b.dmgDealt - a.dmgDealt)[0];
    if (!t || t.dmgDealt <= 0) return;
    const key = t.level >= 4 && t.def.branchId ? `icb_${t.def.branchId}` : `icb_${t.type}`;
    const glow = this.add.image(x, y, 'fx_soft').setTint(0xffd86a).setBlendMode('ADD').setAlpha(0.5).setScale(1.1);
    c.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    c.add(addText(this, x, y - 50, 'MVP', { size: 20, display: true, color: '#ffe066', strokeW: 5 }).setOrigin(0.5));
    c.add(this.add.image(x, y, this.textures.exists(key) ? key : `icb_${t.type}`).setDisplaySize(66, 66));
    // 依實際字高往下排（手機會放大小字）
    const sub = { size: 13, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 0, shadow: false };
    let ly = y + 36;
    for (const [text, bold] of [
      [L(t.def.name), true],
      [T('mvpDmg', Math.round(t.dmgDealt).toLocaleString()), false],
      [T('mvpKills', t.kills), false],
    ] as const) {
      const line = fitText(addText(this, x, ly, text, { ...sub, size: bold ? 14 : 13, bold }).setOrigin(0.5, 0), 96);
      c.add(line);
      ly += line.height * line.scaleY - 2;
    }
  }

  private gemLine(c: Phaser.GameObjects.Container, y: number): void {
    const n = this.lvl.gemsEarned;
    if (n <= 0) return;
    const t = addText(this, 0, y, T('gemsEarned', n), { size: 20, display: true, color: '#8a3ad0', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0, 0.5);
    const rowW = 30 + 6 + t.width;
    t.x = -rowW / 2 + 36;
    const g = this.add.image(-rowW / 2 + 15, y, 'ic_gem').setDisplaySize(30, 30);
    c.add([g, t]);
    g.setScale(0);
    this.tweens.add({ targets: g, scale: 30 / 56 / 2, duration: 300, delay: 900, ease: 'Back.easeOut' });
  }

  bumpLives(): void {
    this.tweens.add({ targets: this.statsPanel, x: this.statsPanel.x + 6, duration: 40, yoyo: true, repeat: 3 });
    this.livesTxt.setColor('#ff5a4a');
  }

  // ───────── 資訊面板 ─────────
  showInfo(d: InfoData): void {
    this.hideInfo();
    const w = viewW(this);
    const bw = 380;
    const c = this.add.container(w / 2, 0);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const left = -bw / 2 + 16;
    let y = 10;
    parts.push(addText(this, left, y, d.title, { size: 20, display: true, color: '#ffe8a8' }));
    if (d.cost !== undefined) {
      parts.push(this.add.image(bw / 2 - 66, y + 12, 'ic_coin').setDisplaySize(24, 24));
      parts.push(addText(this, bw / 2 - 52, y + 12, String(d.cost), { size: 18, display: true, color: this.lvl.world.gold >= d.cost ? '#ffe066' : '#ff7a6a' }).setOrigin(0, 0.5));
    }
    y += 30;
    if (d.icons?.length) {
      // 敵人頭像列（下一波預告）
      const n = d.icons.length;
      const step = Math.min(70, (bw - 32) / n);
      d.icons.forEach((ic, i) => {
        const x = left + 22 + i * step;
        const img = this.add.image(x, y + 46, ic.tex).setOrigin(0.5, 1);
        img.setScale(Math.min(44 / img.frame.height, 50 / img.frame.width));
        if (ic.tint) img.setTint(ic.tint);
        parts.push(img);
        parts.push(addText(this, x + 14, y + 40, `×${ic.count}`, { size: 15, display: true, color: ic.boss ? '#ff7a5a' : '#fff6dc' }).setOrigin(0, 0.5));
      });
      y += 54;
    }
    if (d.desc) {
      const ds = addText(this, left, y, d.desc, { size: 14, color: '#e8dcc0', wrap: bw - 32, strokeW: 2 });
      parts.push(ds);
      y += ds.height + 6;
    }
    const rowH = fontPx(14) + 8;
    d.stats.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      parts.push(addText(this, left + col * (bw / 2 - 8), y + row * rowH, k ? `${k}: ${v}` : v, { size: 14, color: k ? '#fff6dc' : '#9ad8ff', strokeW: 2 }));
    });
    y += Math.ceil(d.stats.length / 2) * rowH + 8;
    const bh = Math.max(56, y);
    c.add(panel(this, 0, bh / 2, bw, bh, 'ui_dark', 18));
    c.add(parts);
    // 手機放大，底邊對齊畫面下緣
    c.setScale(Math.max(1, Math.min(uiZoom(), (VIEW_H * 0.45) / bh)));
    c.setY(VIEW_H - bh * c.scale - 10);
    c.setDepth(50);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
    this.infoBox = c;
  }

  showEnemyInfo(e: EnemyDef, elite: EliteAffix | null = null): void {
    const hpMul = (this.lvl.difficulty === 'veteran' ? 1.25 : this.lvl.difficulty === 'casual' ? 0.7 : 1) * (elite === 'tough' ? ELITE.toughHp : 1);
    const stats: [string, string][] = [
      [T('hp'), String(Math.round(e.hp * hpMul))],
      [T('armor'), armorWord(e.armor)],
      [T('magicRes'), armorWord(e.magicResist)],
      [T('speed'), e.speed >= 60 ? T('veryFast') : e.speed >= 45 ? T('fast') : e.speed >= 28 ? T('medium') : T('slow')],
      [T('livesCost'), String(e.lives)],
      [T('bounty'), String(e.gold * (elite ? ELITE.bounty : 1))],
    ];
    if (elite) this.showInfo({ title: `${T('elite')}・${T(`elite_${elite}`)} ${L(e.name)}`, desc: `${T(`eliteDesc_${elite}`)}\n${L(e.desc)}`, stats });
    else this.showInfo({ title: L(e.name), desc: L(e.desc), stats });
  }

  showWavePreview(list: { enemy: string; count: number }[]): void {
    if (!list.length) return;
    const icons = list.map((x) => ({ tex: ENEMIES[x.enemy].sprite, count: x.count, tint: ENEMIES[x.enemy].tint, boss: !!ENEMIES[x.enemy].boss }));
    const names = list.map((x) => L(ENEMIES[x.enemy].name)).join('、');
    this.showInfo({ title: `${T('wave')} ${this.lvl.world.waveIndex + 2} ${T('incoming')}`, desc: `${names}\n${T('callWave')}`, stats: [], icons });
  }

  hideInfo(): void {
    if (this.infoBox) {
      const b = this.infoBox;
      this.infoBox = null;
      this.tweens.add({ targets: b, alpha: 0, duration: 100, onComplete: () => b.destroy() });
    }
  }

  // ───────── 提示 / 橫幅 ─────────
  toast(msg: string, dur = 2200): void {
    if (this.toastTxt) this.toastTxt.destroy();
    const w = viewW(this);
    const c = this.add.container(w / 2, 96);
    const t = addText(this, 0, 0, msg, { size: 18, color: '#fff6dc' }).setOrigin(0.5);
    const bg = panel(this, 0, 0, t.width + 40, 40, 'ui_dark', 16);
    c.add([bg, t]);
    c.setDepth(60);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, y: 90, duration: 160 });
    this.tweens.add({ targets: c, alpha: 0, delay: dur, duration: 300, onComplete: () => c.destroy() });
    this.toastTxt = c;
  }

  waveBanner(n: number, total: number, boss: boolean): void {
    const w = viewW(this);
    const txt = boss ? T('bossIncoming') : this.lvl.mode0 === 'endless' ? `${T('wave')} ${n}` : `${T('wave')} ${n} / ${total}`;
    const t = addText(this, w / 2, VIEW_H * 0.3, txt, { size: boss ? 44 : 38, display: true, color: boss ? '#ff6a4a' : '#ffe8a8', strokeW: 7 }).setOrigin(0.5);
    t.setDepth(70).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  }

  /** 首領倒下：金色大字＋首領名 */
  bossDefeated(name: string): void {
    const w = viewW(this);
    const c = this.add.container(w / 2, VIEW_H * 0.24).setDepth(70);
    const glow = this.add.image(0, 10, 'fx_soft').setTint(0xffd86a).setBlendMode('ADD').setAlpha(0.55).setScale(5, 1.6);
    const t = addText(this, 0, 0, T('bossDefeated'), { size: 46, display: true, color: '#ffe066', strokeW: 8 }).setOrigin(0.5);
    const n = addText(this, 0, 44, name, { size: 22, display: true, color: '#fff2d0', strokeW: 5 }).setOrigin(0.5);
    c.add([glow, t, n]);
    c.setScale(1.8).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, y: c.y - 24, delay: 1500, duration: 400, onComplete: () => c.destroy() });
  }

  // ───────── 新敵人介紹卡 ─────────
  showEnemyIntro(ids: string[], done: () => void): void {
    if (!ids.length) {
      done();
      return;
    }
    const id = ids[0];
    const e = ENEMIES[id];
    this.lvl.togglePause(true);
    this.closeModal();
    const w = viewW(this);
    const c = this.add.container(w / 2, VIEW_H / 2).setDepth(100);
    const dim = dimmer(this, w * 2, VIEW_H * 2, 0.55).setPosition(-w, -VIEW_H);
    c.add(dim);
    c.add(panel(this, 0, 0, 520, 280));
    const head = addText(this, 0, -112, T('newEnemy'), { size: 26, display: true, color: '#c0392b', stroke: '#fff2d0', strokeW: 4, shadow: false }).setOrigin(0.5);
    c.add(head);
    const img = this.add.image(-150, 40, e.sprite).setOrigin(0.5, 1);
    img.setScale(Math.min(140 / img.frame.height, 160 / img.frame.width));
    if (!e.facesRight) img.setFlipX(true);
    if (e.tint) img.setTint(e.tint);
    c.add(img);
    const name = addText(this, -40, -74, L(e.name), { size: 26, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false });
    const desc = addText(this, -40, -36, L(e.desc), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: 250 });
    c.add([name, desc]);
    let tagX = -40;
    for (const tg of e.tags ?? []) {
      const tag = addText(this, tagX, 50, L(tg), { size: 14, display: true, color: '#fff6dc', strokeW: 3 });
      const tb = this.add.rectangle(tagX - 6, 47, tag.width + 12, tag.height + 2, 0x7a3a1a).setOrigin(0).setStrokeStyle(2, 0x2a1608);
      c.add([tb, tag]);
      tagX += tag.width + 22;
    }
    const ok = new Button(this, 0, 104, 160, 46, 'OK', () => {
      this.closeModal();
      this.lvl.togglePause(false);
      this.showEnemyIntro(ids.slice(1), done);
    }, { color: 'green' });
    c.add(ok);
    this.modal = c;
    popIn(this, c, 0, { w: 520, h: 280 }, 0.7, 260);
  }

  // ───────── 開場劇情 ─────────
  showStory(lines: StoryLine[], done: () => void): void {
    this.lvl.togglePause(true);
    this.closeModal();
    this.modal = playDialog(this, lines, () => {
      this.modal = null;
      this.lvl.togglePause(false);
      done();
    });
  }

  private closeModal(): void {
    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
    }
  }

  // ───────── 暫停 ─────────
  showPause(on: boolean): void {
    if (!on) {
      if (this.modal?.getData('pause')) this.closeModal();
      return;
    }
    if (this.modal) return;
    const w = viewW(this);
    const c = this.add.container(w / 2, VIEW_H / 2).setDepth(100);
    c.setData('pause', true);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.55).setPosition(-w, -VIEW_H));
    c.add(panel(this, 0, 0, 420, 380));
    c.add(addText(this, 0, -150, T('pause'), { size: 34, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    const sv = save();
    const mkVol = (y: number, label: string, key: 'music' | 'sfx') => {
      const t = addText(this, -150, y, label, { size: 20, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5);
      const b = new IconButton(this, 120, y, 48, sv.settings[key] > 0 ? 'ic_sound_on' : 'ic_sound_off', () => {
        sv.settings[key] = sv.settings[key] > 0 ? 0 : key === 'music' ? 0.6 : 0.8;
        persist();
        sfx.refreshVolumes();
        b.setIcon(sv.settings[key] > 0 ? 'ic_sound_on' : 'ic_sound_off');
      });
      c.add([t, b]);
    };
    mkVol(-92, T('music'), 'music');
    mkVol(-38, T('sound'), 'sfx');
    c.add(new Button(this, 0, 30, 240, 52, T('resume'), () => this.lvl.togglePause(false), { color: 'green' }));
    c.add(new Button(this, 0, 92, 240, 52, T('restart'), () => this.lvl.restart(), { color: 'gold' }));
    c.add(new Button(this, 0, 154, 240, 52, T('quit'), () => this.lvl.exitToMap(), { color: 'red' }));
    this.modal = c;
    popIn(this, c, 0, { w: 420, h: 380 }, 0.8, 200);
  }

  // ───────── 結算 ─────────
  showResult(victory: boolean, stars: number, _newStars: number): void {
    this.closeModal();
    this.hideInfo();
    const w = viewW(this);
    const c = this.add.container(w / 2, VIEW_H / 2).setDepth(100);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.6).setPosition(-w, -VIEW_H));
    c.add(panel(this, 0, 20, 500, 380));
    const challenge = this.lvl.mode0 === 'heroic' || this.lvl.mode0 === 'iron';
    // 每日挑戰與首領連戰：結算只有再試／回地圖
    const daily = this.lvl.mode0 === 'daily' || this.lvl.mode0 === 'bossrush';
    const title = addText(this, 0, -150, victory ? (challenge ? T('challengeDone') : T('victory')) : T('defeat'), {
      size: 54,
      display: true,
      color: victory ? '#ffe066' : '#ff6a5a',
      strokeW: 8,
    }).setOrigin(0.5);
    c.add(title);
    if (victory && challenge) {
      const st = this.add.image(0, -50, 'ic_star').setDisplaySize(96, 96).setScale(0);
      c.add(this.add.image(0, -50, 'ic_star_empty').setDisplaySize(96, 96));
      c.add(st);
      this.tweens.add({ targets: st, scale: 96 / 56 / 2, duration: 420, delay: 500, ease: 'Back.easeOut', onStart: () => sfx.play('star') });
      c.add(
        addText(this, 0, 30, this.lvl.mode0 === 'heroic' ? T('heroic') : T('iron'), { size: 22, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0.5),
      );
      this.gemLine(c, 72);
      this.mvpBadge(c, -184, -60);
      c.add(new Button(this, -100, 140, 170, 52, T('retry'), () => this.lvl.restart(), { color: 'gold' }));
      c.add(new Button(this, 100, 140, 170, 52, T('toMap'), () => this.lvl.exitToMap(), { color: 'blue' }));
    } else if (victory) {
      for (let i = 0; i < 3; i++) {
        const sx = (i - 1) * 96;
        const sy = i === 1 ? -62 : -46;
        const empty = this.add.image(sx, sy, 'ic_star_empty').setDisplaySize(84, 84);
        c.add(empty);
        if (i < stars) {
          const st = this.add.image(sx, sy, 'ic_star').setDisplaySize(84, 84).setScale(0);
          c.add(st);
          this.tweens.add({
            targets: st,
            scale: 84 / 56 / 2,
            duration: 380,
            delay: 500 + i * 350,
            ease: 'Back.easeOut',
            onStart: () => sfx.play('star'),
          });
        }
      }
      const w0 = this.lvl.world;
      this.mvpBadge(c, -184, -60);
      const info = addText(this, 0, 22, `${T('lives')} ${w0.lives}/${w0.maxLives}   ·   ${T('enemies')} ${w0.stats.kills}`, {
        size: 18,
        color: '#4a2a10',
        stroke: '#f4e2b8',
        strokeW: 2,
        shadow: false,
      }).setOrigin(0.5);
      // 左邊是 MVP 欄，手機放大字後要留出空間
      fitText(info, 250);
      c.add(info);
      const hero = w0.hero?.hero;
      if (hero) {
        const ht = addText(this, 0, 52, `${L(hero.def.name)}  LV ${hero.level}  (+${Math.round(hero.xp - hero.startXp)} XP)`, {
          size: 16,
          color: '#2a5a8a',
          stroke: '#f4e2b8',
          strokeW: 2,
          shadow: false,
        }).setOrigin(0.5);
        fitText(ht, 250);
        c.add(ht);
      }
      this.gemLine(c, 84);
      const idx = LEVELS.findIndex((l) => l.id === this.lvl.level.id);
      const next = LEVELS[idx + 1];
      // 每日挑戰只有再試／回地圖；主線最終關 → 尾聲；外傳終章 → 外傳尾聲；外傳關卡之間 → 下一關；番外篇最後一關 → 番外尾聲
      if (daily) {
        c.add(new Button(this, -100, 140, 170, 52, T('retry'), () => this.lvl.restart(), { color: 'gold' }));
        c.add(new Button(this, 100, 140, 170, 52, T('toMap'), () => this.lvl.exitToMap(), { color: 'blue' }));
      } else {
        c.add(new Button(this, -150, 140, 140, 52, T('retry'), () => this.lvl.restart(), { color: 'gold' }));
        c.add(new Button(this, 0, 140, 140, 52, T('toMap'), () => this.lvl.exitToMap(), { color: 'blue' }));
        const finale = !this.lvl.level.bonus && (!next || next.bonus);
        const story = finale ? 'main' : this.lvl.level.sideFinale ? 'side' : next ? null : 'extra';
        if (story) c.add(new Button(this, 150, 140, 140, 52, T('epilogue'), () => this.lvl.exitToEnding(story), { color: 'green' }));
        else if (next) c.add(new Button(this, 150, 140, 140, 52, T('next'), () => this.lvl.exitToMap(next.id), { color: 'green' }));
      }
    } else {
      const tip = addText(this, 0, -30, TIPS[Math.floor(Math.random() * TIPS.length)][save().settings.lang], {
        size: 18,
        color: '#4a2a10',
        stroke: '#f4e2b8',
        strokeW: 2,
        shadow: false,
        wrap: 420,
        align: 'center',
      }).setOrigin(0.5);
      c.add(tip);
      this.gemLine(c, 50);
      c.add(new Button(this, -100, 120, 170, 56, T('retry'), () => this.lvl.restart(), { color: 'green' }));
      c.add(new Button(this, 100, 120, 170, 56, T('toMap'), () => this.lvl.exitToMap(), { color: 'blue' }));
    }
    if (victory) this.addShare(c, this.shareText(stars));
    this.modal = c;
    popIn(this, c, 0, { w: 520, h: 440 }, 0.6, 350);
  }

  /** 結算面板右上角的分享鈕 */
  private addShare(c: Phaser.GameObjects.Container, text: string): void {
    const b = new IconButton(this, 218, -150, 58, 'ic_share', () => shareResult(text, () => this.toast(T('shareCopied'))), 'ui_badge_blue');
    c.add(b);
  }

  private shareText(stars: number, wave = 0): string {
    const lv = this.lvl.level;
    const idx = LEVELS.findIndex((l) => l.id === lv.id);
    const starStr = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    switch (this.lvl.mode0) {
      case 'endless':
        return T('shareEndless', L(lv.name), wave);
      case 'heroic':
      case 'iron':
        return T('shareChallenge', L(lv.name), T(this.lvl.mode0));
      case 'bossrush':
        return T('shareBossRush', L(lv.name), starStr);
      case 'daily': {
        const spec = dailySpec(this.lvl.dailyKey);
        return T('shareDaily', this.lvl.dailyKey, starStr, spec.mods.map((m) => L(DAILY_MODS[m].name)).join('・'));
      }
      default:
        return T('shareCampaign', idx + 1, L(lv.name), starStr);
    }
  }

  /** 無盡模式結算：到達波數＋最佳紀錄 */
  showEndlessResult(reached: number, best: number, newRecord: boolean): void {
    this.closeModal();
    this.hideInfo();
    const w = viewW(this);
    const c = this.add.container(w / 2, VIEW_H / 2).setDepth(100);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.6).setPosition(-w, -VIEW_H));
    c.add(panel(this, 0, 20, 500, 380));
    c.add(addText(this, 0, -150, T('endlessOver'), { size: 44, display: true, color: '#ffb05a', strokeW: 8 }).setOrigin(0.5));
    // 骷髏圖示＋波數置中排成一列
    const big = addText(this, 0, -58, T('waveReached', reached), { size: 36, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0, 0.5);
    const rowW = 56 + 14 + big.width;
    big.x = -rowW / 2 + 70;
    c.add(this.add.image(-rowW / 2 + 28, -58, 'ic_skull').setDisplaySize(56, 56));
    c.add(big);
    if (newRecord) {
      const nr = addText(this, 0, 2, T('newRecord'), { size: 30, display: true, color: '#ffe066', strokeW: 6 }).setOrigin(0.5).setScale(0);
      c.add(nr);
      this.tweens.add({ targets: nr, scale: 1, duration: 420, delay: 450, ease: 'Back.easeOut', onStart: () => sfx.play('star') });
      this.tweens.add({ targets: nr, angle: { from: -4, to: 4 }, duration: 600, yoyo: true, repeat: -1, delay: 900 });
    } else {
      c.add(addText(this, 0, 2, T('bestWave', best), { size: 22, display: true, color: '#7a5a30', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0.5));
    }
    const w0 = this.lvl.world;
    c.add(
      addText(this, 0, 52, `${T('enemies')} ${w0.stats.kills}   ·   ${T('gold')} +${w0.stats.goldEarned}`, {
        size: 17,
        color: '#4a2a10',
        stroke: '#f4e2b8',
        strokeW: 2,
        shadow: false,
      }).setOrigin(0.5),
    );
    this.gemLine(c, 86);
    this.addShare(c, this.shareText(0, reached));
    c.add(new Button(this, -100, 140, 170, 56, T('retry'), () => this.lvl.restart(), { color: 'green' }));
    c.add(new Button(this, 100, 140, 170, 56, T('toMap'), () => this.lvl.exitToMap(), { color: 'blue' }));
    this.modal = c;
    popIn(this, c, 0, { w: 520, h: 440 }, 0.6, 350);
  }
}

const TIPS = [
  { zh: '提示：鐵甲槍兵幾乎免疫弓箭，用法師塔對付他們。', en: 'Tip: Ironclad lancers shrug off arrows — use mage towers.' },
  { zh: '提示：兵營的士兵能擋住敵人，讓其他塔有更多時間輸出。', en: 'Tip: Barracks soldiers hold enemies so your towers get more shots.' },
  { zh: '提示：砲塔打不到飛行單位，記得多蓋弓箭塔或法師塔。', en: 'Tip: Artillery can’t hit flyers — build archers or mages.' },
  { zh: '提示：教派術士會治療同伴，優先集火他們！', en: 'Tip: Cult adepts heal allies — focus them down first!' },
  { zh: '提示：用星星在「升級」中強化你的防禦塔與法術。', en: 'Tip: Spend stars in Upgrades to strengthen towers and spells.' },
  { zh: '提示：提前呼叫下一波可以拿到額外金幣。', en: 'Tip: Calling waves early grants bonus gold.' },
  { zh: '提示：流星火雨對成群的敵人特別有效。', en: 'Tip: Meteor Rain is devastating against clustered enemies.' },
];
