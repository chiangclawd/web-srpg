import Phaser from 'phaser';
import { PLAY_W, PLAY_X0, RS, VIEW_H, WORLD_W, addText, setupCamera, viewW } from '../config';
import { LEVELS } from '../data/levels';
import { UPGRADE_COLUMNS } from '../data/upgrades';
import { HEROES } from '../data/heroes';
import { paintWorldMap } from '../art/worldmap';
import { Button, IconButton, panel } from '../ui/widgets';
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

  create(): void {
    setupCamera(this);
    const nodes = LEVELS.map((l) => ({ x: l.mapPos.x * PLAY_W, y: l.mapPos.y * VIEW_H, theme: l.theme }));
    const s = RS >= 2 ? 1.25 : 1;
    if (!this.textures.exists('bg_map')) this.textures.addCanvas('bg_map', paintWorldMap(WORLD_W, VIEW_H, PLAY_X0, s, nodes));
    this.add.image(-PLAY_X0, 0, 'bg_map').setOrigin(0).setScale(1 / s);

    const sv = save();
    let lastUnlocked = 0;
    LEVELS.forEach((lv, i) => {
      if (!isUnlocked(i)) return;
      lastUnlocked = i;
      const n = nodes[i];
      const stars = sv.stars[lv.id] ?? 0;
      const c = this.add.container(n.x, n.y);
      const glow = this.add.image(0, -4, 'fx_soft').setTint(stars ? 0x7ab0ff : 0xffd84a).setBlendMode('ADD').setScale(1.1).setAlpha(0.7);
      const base = this.add.ellipse(0, 6, 46, 18, 0x2a1a0c, 0.5);
      const pole = this.add.rectangle(-2, -14, 4, 42, 0x3a2412);
      const flagTex = this.add.graphics();
      flagTex.fillStyle(stars ? 0x3a6ad0 : 0xc0392b, 1);
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
      const hit = this.add.circle(0, 0, 34, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
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
    this.scale.on('resize', this.buildHud, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.buildHud, this));
    sfx.playBgm('peaceful');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const focusIdx = this.focus ? LEVELS.findIndex((l) => l.id === this.focus) : -1;
    const auto = focusIdx >= 0 && isUnlocked(focusIdx + 1) && focusIdx + 1 < LEVELS.length ? focusIdx + 1 : lastUnlocked;
    this.time.delayedCall(350, () => this.showLevel(auto));
  }

  private buildHud(): void {
    this.hud.forEach((o) => o.destroy());
    this.hud = [];
    const w = viewW(this);
    const left = -(w - PLAY_W) / 2;
    this.cameras.main.setScroll(left, 0);
    const right = left + w;
    // 總星數
    const sp = panel(this, left + 100, 34, 170, 46, 'ui_dark', 18);
    const si = this.add.image(left + 40, 34, 'ic_star').setDisplaySize(32, 32);
    const total = LEVELS.length * 5;
    const st = addText(this, left + 62, 34, `${totalStars()} / ${total}`, { size: 22, display: true, color: '#ffe066' }).setOrigin(0, 0.5);
    this.hud.push(sp, si, st);
    // 寶石
    const gp = panel(this, left + 280, 34, 150, 46, 'ui_dark', 18);
    const gi = this.add.image(left + 226, 34, 'ic_gem').setDisplaySize(30, 30);
    const gt = addText(this, left + 248, 34, String(save().gems ?? 0), { size: 22, display: true, color: '#e0c0ff' }).setOrigin(0, 0.5);
    this.hud.push(gp, gi, gt);
    // 底部按鈕
    const back = new IconButton(this, left + 44, VIEW_H - 44, 64, 'ic_close', () => this.leave('Menu'));
    const avail = starsAvailable();
    const up = new Button(this, right - 470, VIEW_H - 42, 140, 56, T('upgrades'), () => this.leave('Upgrade'), { color: 'gold', icon: 'ic_hammer', iconSize: 34, text: { size: 20 } });
    if (avail > 0) {
      const badge = this.add.circle(right - 410, VIEW_H - 68, 14, 0xc0392b).setStrokeStyle(2, 0xffffff);
      const bt = addText(this, right - 410, VIEW_H - 68, String(avail), { size: 14, display: true }).setOrigin(0.5);
      this.tweens.add({ targets: [badge, bt], scale: 1.2, duration: 500, yoyo: true, repeat: -1 });
      this.hud.push(badge, bt);
    }
    const hero = HEROES[save().selectedHero] ?? HEROES.arthur;
    const hb = new Button(this, right - 310, VIEW_H - 42, 140, 56, T('heroes'), () => this.leave('Hero'), { color: 'blue', icon: `ptc_${hero.id}`, iconSize: 38, text: { size: 20 } });
    const enc = new Button(this, right - 150, VIEW_H - 42, 140, 56, T('encyclopedia'), () => this.leave('Encyclopedia'), { color: 'wood', icon: 'ic_book', iconSize: 34, text: { size: 20 } });
    const ach = new Button(this, right - 630, VIEW_H - 42, 140, 56, T('achievements'), () => this.leave('Achievements'), { color: 'wood', icon: 'ic_crown', iconSize: 34, text: { size: 20 } });
    const shop = new Button(this, right - 790, VIEW_H - 42, 140, 56, T('shop'), () => this.leave('Shop'), { color: 'red', icon: 'ic_gem', iconSize: 32, text: { size: 20 } });
    this.hud.push(back, up, hb, enc, ach, shop);
    for (const o of [back, up, hb, enc, sp, si, st]) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(500);
    this.hud.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(500));
    void up;
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
    const modes: LevelMode[] = ['campaign', 'heroic', 'iron', 'endless'];
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
    c.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.infoPanel = c;
  }
}
