// 製作名單：誰做的、圖和音樂是用什麼工具生成的、用了哪些字型和程式庫。授權全文在遊戲外面的那一頁（legal.ts）。
// 從設定頁開，疊在它上面；關掉回到設定頁。
import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { T } from '../i18n';
import type { StrKey } from '../i18n';
import { Button, KeyNav, drawPanel } from '../view/ui';
import { MAKER, openLegal } from '../legal';

export interface CreditsData {
  onClose?: () => void;
}

const W = 900;
const LABEL_W = 250;

/** 每一列：左邊是做了什麼，右邊是誰或用什麼做的 */
const ROWS: [StrKey, StrKey | null][] = [
  ['creditsMade', null],
  ['creditsArt', 'creditsArtBy'],
  ['creditsUnits', 'creditsUnitsBy'],
  ['creditsMusic', 'creditsMusicBy'],
  ['creditsSfx', 'creditsSfxBy'],
  ['creditsFont', 'creditsFontBy'],
  ['creditsEngine', 'creditsEngineBy'],
  ['creditsTools', 'creditsToolsBy'],
];

export class CreditsScene extends Phaser.Scene {
  private onClose: () => void = () => undefined;

  constructor() {
    super('SfCredits');
  }

  init(data: CreditsData): void {
    this.onClose = data.onClose ?? (() => undefined);
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    const w = viewW(this);
    // 先排內容、量出高度，再決定面板多高（中英文的行數不一樣）
    const rows = this.add.container(0, 0);
    let y = 0;
    for (const [label, value] of ROWS) {
      const l = addText(this, -W / 2 + 50, y, T(label), { size: 16, raw: true, strokeW: 0, color: COL.dim, bold: false });
      const v = addText(this, -W / 2 + 50 + LABEL_W, y, value ? T(value) : MAKER, { size: 16, raw: true, strokeW: 0, wrap: W - 100 - LABEL_W, lineSpacing: 4 });
      rows.add([l, v]);
      y += Math.max(l.height, v.height) + 12;
    }
    y += 6;
    const note = addText(this, -W / 2 + 50, y, T('creditsNote'), { size: 14, raw: true, strokeW: 0, color: COL.dim, bold: false, wrap: W - 100, lineSpacing: 4 });
    rows.add(note);
    y += note.height;

    const H = 96 + y + 96;
    const z = Math.min(uiZoom(), (VIEW_H - 16) / H, (w - 16) / W);
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x02060c, 0.82).setInteractive();
    const box = this.add.container(w / 2, VIEW_H / 2).setScale(z);
    const g = this.add.graphics();
    drawPanel(g, -W / 2, -H / 2, W, H, { alpha: 0.98, cut: 18 });
    box.add(g);
    box.add(addText(this, 0, -H / 2 + 40, T('credits'), { size: 26, raw: true, strokeW: 0 }).setOrigin(0.5));
    box.add(addText(this, W / 2 - 50, -H / 2 + 42, `${T('title')}　v${__APP_VERSION__}`, { size: 13, raw: true, strokeW: 0, color: COL.dim, bold: false }).setOrigin(1, 0.5));
    rows.setPosition(0, -H / 2 + 96);
    box.add(rows);

    const by = H / 2 - 44;
    const licenses = new Button(this, -130, by, 240, 52, T('creditsLicenses'), () => openLegal('licenses'), { size: 18, primary: true });
    box.add(licenses);
    box.add(new Button(this, 130, by, 200, 52, T('close'), () => this.close(), { size: 18, color: 0x8fb0c8 }));
    new KeyNav(this, { onBack: () => this.close(), first: () => licenses });
  }

  private close(): void {
    const done = this.onClose;
    this.scene.stop();
    done();
  }
}
