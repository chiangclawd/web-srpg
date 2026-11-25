// 任務列表：上方切換章節，每章三張任務卡（名稱、簡介、星數）；前一關過了才開下一關。
// 主線全部過關之後，章節分頁的右邊多一顆「挑戰」：按下去整個列表換成挑戰模式
// （同樣的任務、敵方比較強；完成的任務拿到一枚徽章）。
import Phaser from 'phaser';
import { COL, HARD_COL, HARD_TEXT, TEX, VIEW_H, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { music } from '../audio';
import { L, T } from '../i18n';
import type { StrKey } from '../i18n';
import { save } from '../save';
import { suspendInfo } from '../suspend';
import { MISSIONS } from '../data/missions';
import { FRAMES, canAffordAny, frameUnlocked, missionOpen as openWith, partsLeft } from '../data/upgrades';
import { challengeDone, challengeOpen, challengeReady } from '../records';
import { HARD_DMG, HARD_HP } from '../sim/Battle';
import { Button, KeyNav, drawPanel } from '../view/ui';

const CHAPTERS = [1, 2, 3, 4];
const CHAPTER_BG = ['bg_ice', 'bg_bay', 'bg_reactor', 'bg_field'];

/**
 * 任務列表現在是不是挑戰模式。放在場景外面：去機庫再回來、打完一場回來，都要停在同一邊。
 * 戰鬥開始時會照那一場設定（從標題畫面接著打挑戰的戰鬥，打完回到的也是挑戰的列表）。
 */
let hardView = false;
export function setChallengeView(on: boolean): void {
  hardView = on;
}

/** 這一關開放了沒：第一關一定開，其他要前一關拿過星 */
export function missionOpen(index: number): boolean {
  return openWith(index, save().stars);
}

export class MissionScene extends Phaser.Scene {
  private chapter = 1;
  private hard = false;

  constructor() {
    super('SfMissions');
  }

  init(data: { chapter?: number; hard?: boolean }): void {
    if (data.hard !== undefined) hardView = data.hard;
    this.hard = hardView && challengeOpen(save());
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
    // 挑戰模式：整個畫面偏暗紅，一眼看得出來不是平常的列表
    if (this.hard) this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x3a0c04, 0.34);
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
    // 章節分頁：排在「返回」和「機庫」兩顆按鈕中間；放不下就縮窄，並往空位的中間靠。
    // 主線打完之後最右邊多一顆「挑戰」（開關，不是分頁）
    const tz = Math.min(z, 1.2);
    const chalOpen = challengeOpen(sv0);
    const n4 = CHAPTERS.length + (chalOpen ? 1 : 0);
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
    if (chalOpen) {
      new Button(this, tabsX + ((n4 - 1) / 2) * (tabW + 12), 40, tabW / tz, 44, T('challenge'), () => this.scene.restart({ chapter: this.chapter, hard: !this.hard }), {
        color: HARD_COL,
        primary: this.hard,
        icon: 'ic_chal',
        size: 17,
      }).setScale(tz);
    }
    const title = T(`chapter${this.chapter}` as StrKey);
    fitText(addText(this, w / 2, 96, this.hard ? `${title}　${T('challengeMode')}` : title, { size: 26, strokeW: 5, color: this.hard ? HARD_TEXT : COL.text }).setOrigin(0.5), w - 40);
    const sv = save();
    const done = challengeDone(sv);
    const pct = (mul: number): number => Math.round((mul - 1) * 100);
    const list = MISSIONS.map((m, index) => ({ m, index })).filter((x) => x.m.chapter === this.chapter);
    const n = list.length;
    const cw = Math.min(380, (w - 80 - (n - 1) * 24) / n);
    const top = 132;
    const ch = VIEW_H - top - 40;
    const x0 = w / 2 - ((n - 1) * (cw + 24)) / 2;
    const sorties: Button[] = [];
    // 有沒有打到一半的戰鬥：那一關的卡片多一顆「接著打」
    const sus = suspendInfo();
    list.forEach(({ m, index }, i) => {
      const unlocked = missionOpen(index);
      // 挑戰模式：這一關要先過關才能打
      const open = unlocked && (!this.hard || challengeReady(sv, m.id));
      const cx = x0 + i * (cw + 24);
      const g = this.add.graphics();
      drawPanel(g, cx - cw / 2, top, cw, ch, { alpha: 0.88, line: open ? (this.hard ? HARD_COL : COL.line) : 0x3a4a5c, cut: 16 });
      const label = addText(this, cx - cw / 2 + 22, top + 18, T('mission', index + 1), { size: 16, strokeW: 0, color: open ? COL.orange : '#5a6a7c' });
      const name = fitText(addText(this, cx - cw / 2 + 22, label.y + label.height + 4, L(m.name), { size: 30, strokeW: 0, color: open ? COL.text : '#6a7c90' }), cw - 44);
      const sy = name.y + name.height + 26;
      const badge = (x: number): Phaser.GameObjects.Image =>
        this.add
          .image(x, sy, 'ic_chal')
          .setScale(36 / 64 / TEX)
          .setTint(done.has(m.id) ? HARD_COL : 0x2c3a4c);
      if (this.hard) {
        // 挑戰模式的卡片：星星的位置換成徽章和完成了沒
        badge(cx - cw / 2 + 40);
        addText(this, cx - cw / 2 + 68, sy, T(done.has(m.id) ? 'chalDone' : 'chalTodo'), { size: 17, strokeW: 0, color: done.has(m.id) ? HARD_TEXT : '#6a7c90' }).setOrigin(0, 0.5);
      } else {
        const stars = sv.stars[m.id] ?? 0;
        for (let s = 0; s < 3; s++) {
          this.add
            .image(cx - cw / 2 + 40 + s * 40, sy, 'ic_star')
            .setScale(34 / 64 / TEX)
            .setTint(s < stars ? 0xffd75a : 0x2c3a4c);
        }
        // 挑戰模式開放之後，星星右邊多一枚徽章（完成了才亮）
        if (chalOpen) badge(cx + cw / 2 - 40);
      }
      if (open) {
        const text = this.hard ? T('challengeRule', pct(HARD_HP), pct(HARD_DMG)) : L(m.brief);
        addText(this, cx - cw / 2 + 22, sy + 30, text, { size: 16, strokeW: 0, color: COL.dim, bold: false, wrap: cw - 44, lineSpacing: 6 });
        addText(this, cx - cw / 2 + 22, top + ch - 86, `${T('objective')}：${L(m.objective)}`, { size: 15, strokeW: 0, color: COL.cyan, wrap: cw - 44 }).setOrigin(0, 1);
        const go = (resume: boolean): void => void this.scene.start('SfBattle', { missionId: m.id, resume, hard: this.hard });
        // 打到一半的那一場是這一邊的（一般 / 挑戰）才有「接著打」
        if (sus?.mission === m.id && sus.hard === this.hard) {
          const bw = (Math.min(cw - 44, 340) - 10) / 2;
          sorties.push(new Button(this, cx - bw / 2 - 5, top + ch - 44, bw, 56, T('resumeTurn', sus.turn), () => go(true), { primary: true, size: 18, color: this.hard ? HARD_COL : undefined }));
          new Button(this, cx + bw / 2 + 5, top + ch - 44, bw, 56, T('sortieNew'), () => go(false), { color: 0x8fb0c8, size: 18 });
        } else {
          sorties.push(new Button(this, cx, top + ch - 44, Math.min(cw - 44, 240), 56, T(this.hard ? 'sortieHard' : 'sortie'), () => go(false), { primary: true, size: 22, color: this.hard ? HARD_COL : undefined }));
        }
      } else {
        this.add
          .image(cx, top + ch / 2, 'ic_lock')
          .setScale(60 / 64 / TEX)
          .setTint(0x3a4a5c);
        addText(this, cx, top + ch / 2 + 60, T(unlocked ? 'challengeLocked' : 'locked'), { size: 15, strokeW: 0, color: '#6a7c90', wrap: cw - 50, align: 'center', bold: false }).setOrigin(0.5, 0);
      }
    });
    // 鍵盤：焦點先停在這一章打到的那一關
    new KeyNav(this, { onBack: () => this.scene.start('SfTitle'), first: () => sorties[sorties.length - 1] });
  }
}
