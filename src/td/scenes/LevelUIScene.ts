import Phaser from 'phaser';
import { VIEW_H, addText, setupCamera, viewW } from '../config';
import { ENEMIES } from '../data/enemies';
import { LEVELS } from '../data/levels';
import { HERO_XP_TABLE, HERO_MAX_LEVEL } from '../data/heroes';
import type { EnemyDef } from '../sim/defs';
import { IconButton, Button, panel, dimmer } from '../ui/widgets';
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
}

export class LevelUIScene extends Phaser.Scene {
  private lvl!: LevelScene;
  private livesTxt!: Phaser.GameObjects.Text;
  private goldTxt!: Phaser.GameObjects.Text;
  private waveTxt!: Phaser.GameObjects.Text;
  private statsPanel!: Phaser.GameObjects.Container;
  private pauseBtn!: IconButton;
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
  }

  create(): void {
    setupCamera(this);
    // 左上：生命 / 金幣 / 波次
    this.statsPanel = this.add.container(12, 10);
    const bg = panel(this, 0, 0, 316, 50, 'ui_dark', 20).setOrigin(0);
    const heart = this.add.image(26, 25, 'ic_heart').setDisplaySize(34, 34);
    this.livesTxt = addText(this, 46, 25, '20', { size: 24, display: true }).setOrigin(0, 0.5);
    const coin = this.add.image(112, 25, 'ic_coin').setDisplaySize(34, 34);
    this.goldTxt = addText(this, 132, 25, '0', { size: 24, display: true, color: '#ffe066' }).setOrigin(0, 0.5);
    const skull = this.add.image(214, 25, 'ic_skull').setDisplaySize(30, 30);
    this.waveTxt = addText(this, 232, 25, '0/0', { size: 20, display: true }).setOrigin(0, 0.5);
    this.statsPanel.add([bg, heart, this.livesTxt, coin, this.goldTxt, skull, this.waveTxt]);

    // 右上：暫停 / 速度
    this.pauseBtn = new IconButton(this, 0, 0, 52, 'ic_pause', () => this.lvl.togglePause(), 'ui_badge');
    this.speedBtn = new IconButton(this, 0, 0, 52, 'ic_fast', () => {
      this.lvl.toggleSpeed();
      this.refreshSpeed();
    }, 'ui_badge');
    this.speedTxt = addText(this, 0, 0, '', { size: 14, display: true, color: '#ffe066' }).setOrigin(0.5);

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
    const sx = hero ? 128 : 46;
    (['meteor', 'reinforce'] as const).forEach((k, i) => {
      const btn = new IconButton(this, sx + i * 72, -40, 62, k === 'meteor' ? 'ic_meteor' : 'ic_reinforce', () => this.lvl.enterSpell(k), 'ui_badge');
      const cd = this.add.graphics();
      cd.setPosition(sx + i * 72, -40);
      const txt = addText(this, sx + i * 72, -40, '', { size: 18, display: true }).setOrigin(0.5);
      this.bottomLeft.add([btn, cd, txt]);
      this.spellBtns[k] = { btn, cd, txt };
    });

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.refreshSpeed();
  }

  private layout(): void {
    const w = viewW(this);
    this.pauseBtn.setPosition(w - 38, 36);
    this.speedBtn.setPosition(w - 98, 36);
    this.speedTxt.setPosition(w - 98, 66);
    this.bottomLeft.setPosition(8, VIEW_H - 14);
    if (this.modal) this.modal.setPosition(w / 2, VIEW_H / 2);
  }

  private refreshSpeed(): void {
    this.speedTxt.setText(`${this.lvl.speed}x`);
    this.speedBtn.badge.setTint(this.lvl.speed > 1 ? 0xffe08a : 0xffffff);
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
    this.waveTxt.setText(`${Math.max(0, w.waveIndex + 1)}/${w.waveCount}`);
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
  }

  spellButton(k: 'meteor' | 'reinforce'): void {
    this.lvl.enterSpell(k);
  }

  flashSpell(k: 'meteor' | 'reinforce'): void {
    const s = this.spellBtns[k];
    this.tweens.add({ targets: s.btn, scale: 1.2, duration: 100, yoyo: true });
  }

  onModeChange(_m: string): void {
    // 由 refresh() 處理高亮
  }

  bumpLives(): void {
    this.tweens.add({ targets: this.statsPanel, x: this.statsPanel.x + 6, duration: 40, yoyo: true, repeat: 3 });
    this.livesTxt.setColor('#ff5a4a');
  }

  // ───────── 資訊面板 ─────────
  showInfo(d: InfoData): void {
    this.hideInfo();
    const w = viewW(this);
    const bw = 360;
    const lines = d.stats.length;
    const descH = d.desc ? 20 * Math.ceil(d.desc.length / 26) : 0;
    const bh = 54 + descH + Math.ceil(lines / 2) * 24;
    const c = this.add.container(w / 2, VIEW_H - bh / 2 - 10);
    c.add(panel(this, 0, 0, bw, bh, 'ui_dark', 18));
    const title = addText(this, -bw / 2 + 16, -bh / 2 + 10, d.title, { size: 20, display: true, color: '#ffe8a8' });
    c.add(title);
    if (d.cost !== undefined) {
      const ci = this.add.image(bw / 2 - 66, -bh / 2 + 22, 'ic_coin').setDisplaySize(24, 24);
      const ct = addText(this, bw / 2 - 52, -bh / 2 + 22, String(d.cost), { size: 18, display: true, color: this.lvl.world.gold >= d.cost ? '#ffe066' : '#ff7a6a' }).setOrigin(0, 0.5);
      c.add([ci, ct]);
    }
    let y = -bh / 2 + 38;
    if (d.desc) {
      const ds = addText(this, -bw / 2 + 16, y, d.desc, { size: 14, color: '#e8dcc0', wrap: bw - 32, strokeW: 2 });
      c.add(ds);
      y += ds.height + 4;
    }
    d.stats.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = -bw / 2 + 16 + col * (bw / 2 - 8);
      const ty = y + row * 22;
      const s = addText(this, tx, ty, k ? `${k}: ${v}` : v, { size: 14, color: k ? '#fff6dc' : '#9ad8ff', strokeW: 2 });
      c.add(s);
    });
    c.setDepth(50);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 120 });
    this.infoBox = c;
  }

  showEnemyInfo(e: EnemyDef): void {
    const stats: [string, string][] = [
      [T('hp'), String(Math.round(e.hp * (this.lvl.difficulty === 'veteran' ? 1.25 : this.lvl.difficulty === 'casual' ? 0.7 : 1)))],
      [T('armor'), armorWord(e.armor)],
      [T('magicRes'), armorWord(e.magicResist)],
      [T('speed'), e.speed >= 60 ? T('veryFast') : e.speed >= 45 ? T('fast') : e.speed >= 28 ? T('medium') : T('slow')],
      [T('livesCost'), String(e.lives)],
      [T('bounty'), String(e.gold)],
    ];
    this.showInfo({ title: L(e.name), desc: L(e.desc), stats });
  }

  showWavePreview(list: { enemy: string; count: number }[]): void {
    if (!list.length) return;
    const desc = list.map((x) => `${L(ENEMIES[x.enemy].name)} ×${x.count}`).join('、');
    this.showInfo({ title: `${T('wave')} ${this.lvl.world.waveIndex + 2} ${T('incoming')}`, desc: `${desc}\n${T('callWave')}`, stats: [] });
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
    const txt = boss ? T('bossIncoming') : `${T('wave')} ${n} / ${total}`;
    const t = addText(this, w / 2, VIEW_H * 0.3, txt, { size: boss ? 44 : 38, display: true, color: boss ? '#ff6a4a' : '#ffe8a8', strokeW: 7 }).setOrigin(0.5);
    t.setDepth(70).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, delay: 1300, duration: 400, onComplete: () => t.destroy() });
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
    (e.tags ?? []).forEach((tg, i) => {
      const tag = addText(this, -40 + i * 92, 50, L(tg), { size: 14, display: true, color: '#fff6dc', strokeW: 3 });
      const tb = this.add.rectangle(-40 + i * 92 - 6, 47, tag.width + 12, 24, 0x7a3a1a).setOrigin(0).setStrokeStyle(2, 0x2a1608);
      c.add([tb, tag]);
    });
    const ok = new Button(this, 0, 104, 160, 46, 'OK', () => {
      this.closeModal();
      this.lvl.togglePause(false);
      this.showEnemyIntro(ids.slice(1), done);
    }, { color: 'green' });
    c.add(ok);
    this.modal = c;
    c.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
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
    c.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  }

  // ───────── 結算 ─────────
  showResult(victory: boolean, stars: number, _newStars: number): void {
    this.closeModal();
    this.hideInfo();
    const w = viewW(this);
    const c = this.add.container(w / 2, VIEW_H / 2).setDepth(100);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.6).setPosition(-w, -VIEW_H));
    c.add(panel(this, 0, 20, 500, 380));
    const title = addText(this, 0, -150, victory ? T('victory') : T('defeat'), {
      size: 54,
      display: true,
      color: victory ? '#ffe066' : '#ff6a5a',
      strokeW: 8,
    }).setOrigin(0.5);
    c.add(title);
    if (victory) {
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
      const info = addText(this, 0, 22, `${T('lives')} ${w0.lives}/${w0.maxLives}   ·   ${T('enemies')} ${w0.stats.kills}`, {
        size: 18,
        color: '#4a2a10',
        stroke: '#f4e2b8',
        strokeW: 2,
        shadow: false,
      }).setOrigin(0.5);
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
        c.add(ht);
      }
      const idx = LEVELS.findIndex((l) => l.id === this.lvl.level.id);
      const next = LEVELS[idx + 1];
      c.add(new Button(this, -150, 140, 140, 52, T('retry'), () => this.lvl.restart(), { color: 'gold' }));
      c.add(new Button(this, 0, 140, 140, 52, T('toMap'), () => this.lvl.exitToMap(), { color: 'blue' }));
      if (next) c.add(new Button(this, 150, 140, 140, 52, T('next'), () => this.lvl.exitToMap(next.id), { color: 'green' }));
      else c.add(new Button(this, 150, 140, 140, 52, 'OK', () => this.lvl.exitToMap(), { color: 'green' }));
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
      c.add(new Button(this, -100, 120, 170, 56, T('retry'), () => this.lvl.restart(), { color: 'green' }));
      c.add(new Button(this, 100, 120, 170, 56, T('toMap'), () => this.lvl.exitToMap(), { color: 'blue' }));
    }
    this.modal = c;
    c.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
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
