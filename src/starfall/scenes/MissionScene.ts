// 任務列表：上方切換章節，每章三張任務卡（名稱、簡介、星數）；前一關過了才開下一關
import Phaser from 'phaser';
import { COL, TEX, VIEW_H, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { music } from '../audio';
import { L, T } from '../i18n';
import type { StrKey } from '../i18n';
import { save } from '../save';
import { MISSIONS } from '../data/missions';
import { FRAMES, canAffordAny, frameUnlocked, missionOpen as openWith, partsLeft } from '../data/upgrades';
import { Button, KeyNav, drawPanel } from '../view/ui';

const CHAPTERS = [1, 2, 3, 4];
const CHAPTER_BG = ['bg_ice', 'bg_bay', 'bg_reactor', 'bg_field'];

/** 這一關開放了沒：第一關一定開，其他要前一關拿過星 */
export function missionOpen(index: number): boolean {
  return openWith(index, save().stars);
}

export class MissionScene extends Phaser.Scene {
  private chapter = 1;

  constructor() {
    super('SfMissions');
  }

  init(data: { chapter?: number }): void {
    // 預設停在玩家打到的那一章
    const latest = MISSIONS.filter((_m, i) => missionOpen(i)).pop();
    this.chapter = data.chapter ?? latest?.chapter ?? 1;
  }

  create(): void {
    setupCamera(this);
    music('title');
    const w = viewW(this);
    const z = uiZoom();
    const bg = this.add.image(w / 2, VIEW_H / 2, CHAPTER_BG[this.chapter - 1] ?? 'bg_ice');
    bg.setScale(Math.max(w / bg.width, VIEW_H / bg.height));
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x040a14, 0.45);
    new Button(this, 16 + 60 * z, 14 + 24 * z, 120, 48, T('back'), () => this.scene.start('SfTitle'), { color: 0x8fb0c8 }).setScale(z);
    // 右上：機庫（顯示手上的零件；買得起東西時亮一顆點）
    const sv0 = save();
    const parts = partsLeft(sv0.stars, sv0.upgrades);
    const hx = w - 16 - 86 * z;
    const hy = 14 + 24 * z;
    new Button(this, hx, hy, 172, 48, `${T('hangar')}  ${parts}`, () => this.scene.start('SfHangar', { chapter: this.chapter }), { color: 0xffd75a, icon: 'ic_parts' }).setScale(z);
    if (FRAMES.some((f) => frameUnlocked(f, sv0.stars) && canAffordAny(sv0.stars, sv0.upgrades, f))) {
      const dot = this.add.circle(hx + 80 * z, hy - 20 * z, 6 * z, 0xff9a3c).setStrokeStyle(2, 0x06101c);
      this.tweens.add({ targets: dot, scale: 1.25, duration: 600, yoyo: true, repeat: -1 });
    }
    // 章節分頁：排在「返回」和「機庫」兩顆按鈕中間；放不下就縮窄，並往空位的中間靠
    const tz = Math.min(z, 1.2);
    const n4 = CHAPTERS.length;
    const freeL = 16 + 120 * z + 14;
    const freeR = w - 16 - 172 * z - 14;
    const tabW = Math.min(150 * tz, (freeR - freeL - 12 * (n4 - 1)) / n4);
    const tabsW = n4 * tabW + 12 * (n4 - 1);
    const tabsX = Phaser.Math.Clamp(w / 2, freeL + tabsW / 2, Math.max(freeL + tabsW / 2, freeR - tabsW / 2));
    CHAPTERS.forEach((c, i) => {
      const open = missionOpen(MISSIONS.findIndex((m) => m.chapter === c));
      const on = c === this.chapter;
      new Button(
        this,
        tabsX + (i - (n4 - 1) / 2) * (tabW + 12),
        40,
        tabW / tz,
        44,
        c === 4 ? T('chapterTabEpilogue') : T('chapterTab', c),
        () => {
          if (!on) this.scene.restart({ chapter: c });
        },
        { color: on ? COL.line : 0x8fb0c8, primary: on, disabled: !open, icon: open ? undefined : 'ic_lock', size: 17 },
      ).setScale(tz);
    });
    addText(this, w / 2, 96, T(`chapter${this.chapter}` as StrKey), { size: 26, strokeW: 5 }).setOrigin(0.5);
    const sv = save();
    const list = MISSIONS.map((m, index) => ({ m, index })).filter((x) => x.m.chapter === this.chapter);
    const n = list.length;
    const cw = Math.min(380, (w - 80 - (n - 1) * 24) / n);
    const top = 132;
    const ch = VIEW_H - top - 40;
    const x0 = w / 2 - ((n - 1) * (cw + 24)) / 2;
    const sorties: Button[] = [];
    list.forEach(({ m, index }, i) => {
      const open = missionOpen(index);
      const cx = x0 + i * (cw + 24);
      const g = this.add.graphics();
      drawPanel(g, cx - cw / 2, top, cw, ch, { alpha: 0.88, line: open ? COL.line : 0x3a4a5c, cut: 16 });
      const label = addText(this, cx - cw / 2 + 22, top + 18, T('mission', index + 1), { size: 16, strokeW: 0, color: open ? COL.orange : '#5a6a7c' });
      const name = fitText(addText(this, cx - cw / 2 + 22, label.y + label.height + 4, L(m.name), { size: 30, strokeW: 0, color: open ? COL.text : '#6a7c90' }), cw - 44);
      const sy = name.y + name.height + 26;
      const stars = sv.stars[m.id] ?? 0;
      for (let s = 0; s < 3; s++) {
        this.add
          .image(cx - cw / 2 + 40 + s * 40, sy, 'ic_star')
          .setScale(34 / 64 / TEX)
          .setTint(s < stars ? 0xffd75a : 0x2c3a4c);
      }
      if (open) {
        addText(this, cx - cw / 2 + 22, sy + 30, L(m.brief), { size: 16, strokeW: 0, color: COL.dim, bold: false, wrap: cw - 44, lineSpacing: 6 });
        addText(this, cx - cw / 2 + 22, top + ch - 86, `${T('objective')}：${L(m.objective)}`, { size: 15, strokeW: 0, color: COL.cyan, wrap: cw - 44 }).setOrigin(0, 1);
        sorties.push(new Button(this, cx, top + ch - 44, Math.min(cw - 44, 240), 56, T('sortie'), () => this.scene.start('SfBattle', { missionId: m.id }), { primary: true, size: 22 }));
      } else {
        this.add
          .image(cx, top + ch / 2, 'ic_lock')
          .setScale(60 / 64 / TEX)
          .setTint(0x3a4a5c);
        addText(this, cx, top + ch / 2 + 60, T('locked'), { size: 15, strokeW: 0, color: '#6a7c90', wrap: cw - 50, align: 'center', bold: false }).setOrigin(0.5, 0);
      }
    });
    // 鍵盤：焦點先停在這一章打到的那一關
    new KeyNav(this, { onBack: () => this.scene.start('SfTitle'), first: () => sorties[sorties.length - 1] });
  }
}
