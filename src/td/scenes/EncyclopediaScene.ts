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

/** 手指移動超過這麼多（螢幕像素）就算拖曳，不算點選 */
const DRAG_PX = 8;

export class EncyclopediaScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private tab: Tab = 'towers';
  private sel = '';
  /** 手機版格子：捲動容器、目前捲動量與上限、可點的範圍 */
  private grid: Phaser.GameObjects.Container | null = null;
  private gridScroll = 0;
  private gridMax = 0;
  private gridTop = 0;
  private gridBottom = VIEW_H;

  constructor() {
    super('Encyclopedia');
  }

  create(): void {
    setupCamera(this);
    this.tab = 'towers';
    this.sel = 'archer:0';
    this.gridScroll = 0;
    // 手機版圖鑑格子可以上下拖曳（拖過就不算點選；格子按鈕會攔下 pointerdown，所以用指標自己記的按下位置）
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.grid || this.gridMax <= 0 || Math.abs(p.y - p.downY) <= DRAG_PX) return;
      this.scrollGrid(this.gridScroll - (p.y - p.prevPosition.y) / this.cameras.main.zoom);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollGrid(this.gridScroll + dy * 0.6));
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private build(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.grid = null;
    this.gridMax = 0;
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
    // 敵人超過 30 種改成 6 欄；超過 5 排時縮小格距，最後一排才不會壓到左下的關閉鈕（兩個分頁用同一格距，版面才不會跳）
    // 手機：格子放大成好點的大小，放不下的部分在格子面板裡上下拖曳
    const nEnemies = Object.keys(ENEMIES).length;
    const phone = uiZoom() > 1.05;
    const cols = phone ? 5 : nEnemies > 30 ? 6 : 5;
    // 手機格子大小也受畫面寬度限制（16:9 手機要留給右邊的說明面板）
    const cell = phone ? Math.round(Math.min(72 * Math.min(uiZoom(), 1.4), (w * 0.42 - 84) / cols)) : Math.ceil(nEnemies / cols) > 5 ? 72 : 82;
    const iconSize = phone ? cell - 10 : 70;
    const gridX = phone ? 44 + cell / 2 : 84;
    const panelTop = 174;
    const panelBottom = 654;
    const gridY = phone ? panelTop + 12 + cell / 2 : 222;
    const gridPanelW = cols * cell + 40;
    add(panel(this, gridX - cell / 2 - 20 + gridPanelW / 2 + (phone ? 0 : cell / 2 - 41), 414, gridPanelW, 480, 'ui_dark', 18));
    const grid = add(this.add.container(0, 0));
    this.grid = grid;
    const cellBtn = (b: IconButton): IconButton => {
      grid.add(b);
      return b;
    };
    if (phone) {
      // 只露出面板裡面那一塊（捲出去的格子被遮住，也不能點）
      const m = this.make.graphics({}, false);
      m.fillRect(0, panelTop + 6, w, panelBottom - panelTop - 12);
      grid.setMask(m.createGeometryMask());
      this.gridTop = panelTop + 6;
      this.gridBottom = panelBottom - 6;
    } else {
      this.gridTop = 0;
      this.gridBottom = VIEW_H;
    }
    const count = this.tab === 'towers' ? TOWER_ORDER.reduce((n, t) => n + TOWERS[t].levels.length + TOWERS[t].branches.length, 0) : nEnemies;
    this.gridMax = phone ? Math.max(0, gridY + (Math.ceil(count / cols) - 1) * cell + cell / 2 + 12 - panelBottom) : 0;
    this.scrollGrid(this.gridScroll);
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
          const b = cellBtn(new IconButton(this, x, y, iconSize, def.art, () => this.select(id), this.sel === id ? 'ui_badge_blue' : 'ui_badge', 0.9));
          b.icon.setDisplaySize((52 * iconSize) / 70, (63 * iconSize) / 70);
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
        const b = cellBtn(new IconButton(this, x, y, iconSize, e.sprite, () => this.select(e.id), this.sel === e.id ? 'ui_badge_blue' : 'ui_badge', 0.8));
        const fh = b.icon.frame.height;
        const fw = b.icon.frame.width;
        const k = (Math.min(52 / fh, 52 / fw) * iconSize) / 70;
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
        const desc = add(addText(this, tx, 244, known ? L(e.desc) : T('unknown'), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: detailW - 290 }));
        // 說明太長（手機放大字體、英文版）時，數值與標籤跟著往下排，不疊在說明上
        const statY = Math.max(330, desc.y + desc.height + 14);
        if (known) {
          const stats: [string, string][] = [
            [T('hp'), String(e.hp)],
            [T('armor'), armorWord(e.armor)],
            [T('magicRes'), armorWord(e.magicResist)],
            [T('speed'), e.speed >= 60 ? T('veryFast') : e.speed >= 45 ? T('fast') : e.speed >= 28 ? T('medium') : T('slow')],
            [T('livesCost'), String(e.lives)],
            [T('bounty'), String(e.gold)],
          ];
          const cells = stats.map(([k, v], i) => add(addText(this, tx, statY + Math.floor(i / 2) * 32, `${k}: ${v}`, { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false })));
          // 右欄位置依左欄最寬的一格決定，免得「魔抗：中等」和右欄撞在一起
          const col2 = tx + Math.max(200, ...cells.filter((_, i) => i % 2 === 0).map((t) => t.width + 28));
          cells.forEach((t, i) => i % 2 && t.setX(col2));
          const tagY = statY + 110;
          let tagX = tx;
          for (const tg of e.tags ?? []) {
            // 底框先建立、文字疊在上面（底框的深度不能低於面板，否則會被面板蓋住）
            const r = add(this.add.rectangle(tagX - 6, tagY - 3, 10, 10, 0x7a3a1a).setOrigin(0).setStrokeStyle(2, 0x2a1608));
            const tag = add(addText(this, tagX, tagY, L(tg), { size: 15, display: true }));
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
    const desc = add(addText(this, tx, 240, L(def.desc), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: w - 280 }));
    const statY = Math.max(310, desc.y + desc.height + 14);
    const stats: [string, string][] = [];
    if (type === 'barracks' && def.soldier) {
      stats.push([T('soldiers'), String(def.soldier.count)], [T('hp'), String(def.soldier.hp)], [T('damage'), `${def.soldier.dmg[0]}-${def.soldier.dmg[1]}`], [T('armor'), armorWord(def.soldier.armor)]);
    } else {
      stats.push([T('damage'), `${def.damage[0]}-${def.damage[1]}`], [T('rate'), `${def.cooldown}s`], [T('range'), String(def.range)], ['', def.hitsAir ? T('hitsAir') : T('groundOnly')]);
    }
    stats.push([T('gold'), String(def.cost)]);
    const cells = stats.map(([k, v], i) => add(addText(this, tx, statY + Math.floor(i / 2) * 32, k ? `${k}: ${v}` : v, { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false })));
    const col2 = tx + Math.max(200, ...cells.filter((_, i) => i % 2 === 0).map((t) => t.width + 28));
    cells.forEach((t, i) => i % 2 && t.setX(col2));
    (def.skills ?? []).forEach((sk, i) => {
      const sy = statY + 120 + i * 56;
      add(this.add.image(tx + 20, sy, 'ui_badge_blue').setDisplaySize(44, 44));
      add(this.add.image(tx + 20, sy, `sk_${sk.id}`).setDisplaySize(28, 28));
      add(addText(this, tx + 52, sy - 12, L(sk.name), { size: 16, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      add(addText(this, tx + 52, sy + 13, L(sk.desc), { size: 14, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5));
    });
  }

  private scrollGrid(y: number): void {
    this.gridScroll = Phaser.Math.Clamp(y, 0, this.gridMax);
    this.grid?.setY(-this.gridScroll);
  }

  private setTab(t: Tab): void {
    this.tab = t;
    this.gridScroll = 0;
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
    // 拖曳捲動後放開不算點選；被遮住（捲到面板外）的格子也不能點
    const p = this.input.activePointer;
    if ((this.gridMax > 0 && Math.abs(p.upY - p.downY) > DRAG_PX) || p.worldY < this.gridTop || p.worldY > this.gridBottom) return;
    this.sel = id;
    this.build();
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
