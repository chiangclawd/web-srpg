import Phaser from 'phaser';
import { VIEW_H, addText, setupCamera, viewW, uiZoom } from '../config';
import { ENEMIES } from '../data/enemies';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { Button, IconButton, panel } from '../ui/widgets';
import { L, T } from '../i18n';
import { save } from '../save';
import { armorWord } from './LevelScene';
import type { TowerLevelDef, TowerType } from '../sim/defs';

type Tab = 'towers' | 'enemies';

export class EncyclopediaScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private tab: Tab = 'towers';
  private sel = '';

  constructor() {
    super('Encyclopedia');
  }

  create(): void {
    setupCamera(this);
    this.tab = 'towers';
    this.sel = 'archer:0';
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private build(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.objs.push(o);
      return o;
    };
    const w = viewW(this);
    const bg = add(this.add.graphics());
    bg.fillGradientStyle(0x2a1a2a, 0x2a1a2a, 0x100810, 0x100810, 1);
    bg.fillRect(0, 0, w, VIEW_H);
    add(addText(this, w / 2, 40, T('encyclopedia'), { size: 38, display: true, color: '#ffd36b', strokeW: 7 }).setOrigin(0.5));
    add(new Button(this, w / 2 - 110, 100, 190, 48, T('towers'), () => this.setTab('towers'), { color: this.tab === 'towers' ? 'gold' : 'grey' }));
    add(new Button(this, w / 2 + 110, 100, 190, 48, T('enemies'), () => this.setTab('enemies'), { color: this.tab === 'enemies' ? 'gold' : 'grey' }));
    const gridX = 84;
    const gridY = 222;
    const cell = 82;
    const cols = 5;
    add(panel(this, gridX + (cols * cell) / 2 - 41, 414, cols * cell + 40, 480, 'ui_dark', 18));
    const detailX = gridX + cols * cell + 60;
    const detailW = w - detailX - 30;
    add(panel(this, detailX + detailW / 2, 410, detailW, 480));
    if (this.tab === 'towers') {
      let i = 0;
      for (const type of TOWER_ORDER) {
        const td = TOWERS[type];
        const entries: [string, TowerLevelDef][] = [
          ...td.levels.map((l, k) => [`${type}:${k}`, l] as [string, TowerLevelDef]),
          ...td.branches.map((b, k) => [`${type}:b${k}`, b] as [string, TowerLevelDef]),
        ];
        for (const [id, def] of entries) {
          const x = gridX + (i % cols) * cell;
          const y = gridY + Math.floor(i / cols) * cell;
          const b = add(new IconButton(this, x, y, 70, def.art, () => this.select(id), this.sel === id ? 'ui_badge_blue' : 'ui_badge', 0.9));
          b.icon.setDisplaySize(52, 63);
          i++;
        }
      }
      const [type, k] = this.sel.split(':');
      const td = TOWERS[type as TowerType];
      if (td) {
        const def = k.startsWith('b') ? td.branches[Number(k.slice(1))] : td.levels[Number(k)];
        this.towerDetail(add, detailX, detailW, type as TowerType, def);
      }
    } else {
      const seen = new Set(save().seenEnemies);
      Object.values(ENEMIES).forEach((e, i) => {
        const x = gridX + (i % cols) * cell;
        const y = gridY + Math.floor(i / cols) * cell;
        const known = seen.has(e.id);
        const b = add(new IconButton(this, x, y, 70, e.sprite, () => this.select(e.id), this.sel === e.id ? 'ui_badge_blue' : 'ui_badge', 0.8));
        const fh = b.icon.frame.height;
        const fw = b.icon.frame.width;
        const k = Math.min(52 / fh, 52 / fw);
        b.icon.setDisplaySize(fw * k, fh * k);
        if (!known) b.icon.setTint(0x000000);
        else if (e.tint) b.icon.setTint(e.tint);
      });
      const e = ENEMIES[this.sel];
      if (e) {
        const known = seen.has(e.id);
        const img = add(this.add.image(detailX + 130, 380, e.sprite).setOrigin(0.5, 1));
        img.setScale(Math.min(200 / img.frame.height, 220 / img.frame.width));
        if (!known) img.setTint(0x000000);
        else if (e.tint) img.setTint(e.tint);
        const tx = detailX + 260;
        add(addText(this, tx, 196, known ? L(e.name) : '???', { size: 32, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }));
        add(addText(this, tx, 244, known ? L(e.desc) : T('unknown'), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: detailW - 290 }));
        if (known) {
          const stats: [string, string][] = [
            [T('hp'), String(e.hp)],
            [T('armor'), armorWord(e.armor)],
            [T('magicRes'), armorWord(e.magicResist)],
            [T('speed'), e.speed >= 60 ? T('veryFast') : e.speed >= 45 ? T('fast') : e.speed >= 28 ? T('medium') : T('slow')],
            [T('livesCost'), String(e.lives)],
            [T('bounty'), String(e.gold)],
          ];
          stats.forEach(([k, v], i) => {
            add(addText(this, tx + (i % 2) * 200, 330 + Math.floor(i / 2) * 32, `${k}: ${v}`, { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }));
          });
          let tagX = tx;
          for (const tg of e.tags ?? []) {
            const tag = add(addText(this, tagX, 440, L(tg), { size: 15, display: true }));
            const r = add(this.add.rectangle(tagX - 6, 437, tag.width + 12, tag.height + 4, 0x7a3a1a).setOrigin(0).setStrokeStyle(2, 0x2a1608));
            r.setDepth(-1);
            tagX += tag.width + 24;
          }
        }
      }
    }
    // 手機上關閉鈕放大（以左下角為錨點）
    add(new IconButton(this, 12 + 32 * uiZoom(), VIEW_H - 12 - 32 * uiZoom(), 64, 'ic_close', () => this.back()).setBaseScale(uiZoom()));
  }

  private towerDetail(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, x: number, w: number, type: TowerType, def: TowerLevelDef): void {
    const img = add(this.add.image(x + 125, 420, def.art).setOrigin(0.5, 0.9));
    img.setScale(0.85);
    const tx = x + 250;
    add(addText(this, tx, 196, L(def.name), { size: 30, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }));
    add(addText(this, tx, 240, L(def.desc), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: w - 280 }));
    const stats: [string, string][] = [];
    if (type === 'barracks' && def.soldier) {
      stats.push([T('soldiers'), String(def.soldier.count)], [T('hp'), String(def.soldier.hp)], [T('damage'), `${def.soldier.dmg[0]}-${def.soldier.dmg[1]}`], [T('armor'), armorWord(def.soldier.armor)]);
    } else {
      stats.push([T('damage'), `${def.damage[0]}-${def.damage[1]}`], [T('rate'), `${def.cooldown}s`], [T('range'), String(def.range)], ['', def.hitsAir ? T('hitsAir') : T('groundOnly')]);
    }
    stats.push([T('gold'), String(def.cost)]);
    stats.forEach(([k, v], i) => {
      add(addText(this, tx + (i % 2) * 200, 310 + Math.floor(i / 2) * 32, k ? `${k}: ${v}` : v, { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }));
    });
    (def.skills ?? []).forEach((sk, i) => {
      const sy = 430 + i * 56;
      add(this.add.image(tx + 20, sy, 'ui_badge_blue').setDisplaySize(44, 44));
      add(this.add.image(tx + 20, sy, `sk_${sk.id}`).setDisplaySize(28, 28));
      add(addText(this, tx + 52, sy - 12, L(sk.name), { size: 16, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      add(addText(this, tx + 52, sy + 13, L(sk.desc), { size: 14, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5));
    });
  }

  private setTab(t: Tab): void {
    this.tab = t;
    this.sel = t === 'towers' ? 'archer:0' : save().seenEnemies[0] ?? 'goblin';
    this.build();
  }

  private select(id: string): void {
    this.sel = id;
    this.build();
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
