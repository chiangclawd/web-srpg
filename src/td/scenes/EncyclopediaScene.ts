import Phaser from 'phaser';
import { VIEW_H, addText, setupCamera, viewW, uiZoom } from '../config';
import { ENEMIES } from '../data/enemies';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { Button, IconButton, panel } from '../ui/widgets';
import { L, T } from '../i18n';
import { save } from '../save';
import { sfx } from '../audio';
import { MUSIC_TRACKS } from '../data/music';
import { armorWord } from './LevelScene';
import type { TowerLevelDef, TowerType } from '../sim/defs';

type Tab = 'towers' | 'enemies' | 'music';

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
    add(new Button(this, w / 2 - 210, 100, 190, 48, T('towers'), () => this.setTab('towers'), { color: this.tab === 'towers' ? 'gold' : 'grey' }));
    add(new Button(this, w / 2, 100, 190, 48, T('enemies'), () => this.setTab('enemies'), { color: this.tab === 'enemies' ? 'gold' : 'grey' }));
    add(new Button(this, w / 2 + 210, 100, 190, 48, T('music'), () => this.setTab('music'), { color: this.tab === 'music' ? 'gold' : 'grey' }));
    if (this.tab === 'music') {
      this.musicRoom(w, add);
      add(new IconButton(this, 12 + 30 * uiZoom(), VIEW_H - 10 - 30 * uiZoom(), 60, 'ic_close', () => this.back()).setBaseScale(uiZoom()));
      return;
    }
    const gridX = 84;
    const gridY = 222;
    // 敵人超過 30 種改成 6 欄；超過 5 排時縮小格距，最後一排才不會壓到左下的關閉鈕（兩個分頁用同一格距，版面才不會跳）
    const nEnemies = Object.keys(ENEMIES).length;
    const cols = nEnemies > 30 ? 6 : 5;
    const cell = Math.ceil(nEnemies / cols) > 5 ? 72 : 82;
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
        const img = add(this.add.image(detailX + 130, 400, e.sprite).setOrigin(0.5, 1));
        img.setScale(Math.min(185 / img.frame.height, 220 / img.frame.width));
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
            // 底框先建立、文字疊在上面（底框的深度不能低於面板，否則會被面板蓋住）
            const r = add(this.add.rectangle(tagX - 6, 437, 10, 10, 0x7a3a1a).setOrigin(0).setStrokeStyle(2, 0x2a1608));
            const tag = add(addText(this, tagX, 440, L(tg), { size: 15, display: true }));
            r.setSize(tag.width + 12, tag.height + 4);
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

  /** 音樂室：兩欄曲目，到過那片土地才解鎖；點了就切換配樂（回地圖會換回地圖音樂） */
  private musicRoom(w: number, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const sv = save();
    const colW = Math.min(520, (w - 120) / 2);
    // 兩欄；曲目變多時列距縮小，整個放得進面板
    const rows = Math.ceil(MUSIC_TRACKS.length / 2);
    const pitch = Math.min(88, 400 / Math.max(1, rows - 1));
    const bh = Math.min(72, pitch - 10);
    const bottom = 212 + (rows - 1) * pitch + bh / 2 + 18;
    add(panel(this, w / 2, (164 + bottom) / 2, colW * 2 + 60, bottom - 164, 'ui_dark', 18));
    MUSIC_TRACKS.forEach((tr, k) => {
      const x = w / 2 + (k % 2 === 0 ? -1 : 1) * (colW / 2 + 6);
      const y = 212 + Math.floor(k / 2) * pitch;
      const open = !tr.reach || sv.unlockedSeen.includes(tr.reach) || (sv.stars[tr.reach] ?? 0) > 0;
      const playing = sfx.currentBgm === tr.id;
      const b = add(
        new Button(this, x, y, colW - 12, bh, open ? L(tr.name) : '???', () => {
          if (!open) return;
          sfx.playBgm(tr.id);
          this.build();
        }, { color: playing ? 'gold' : open ? 'wood' : 'grey', icon: open ? (playing ? 'ic_sound_on' : 'ic_music') : 'ic_lock', iconSize: 36, text: { size: 20 }, sound: open }),
      );
      if (open) {
        b.label.setY(b.label.y - 10);
        const sub = addText(this, b.label.x, 14, L(tr.where), { size: 13, color: '#f4e2b8', strokeW: 2 }).setOrigin(b.label.originX, 0.5);
        b.add(sub);
      }
    });
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
