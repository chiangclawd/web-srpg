// 回報問題：顯示這一版和這台裝置的診斷資訊，可以帶到回報表單（設定好了的話）或複製起來。
// 從設定頁開，疊在它上面；關掉回到設定頁。資訊怎麼收的見 report-env.ts。
import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { T } from '../i18n';
import { Button, KeyNav, drawPanel } from '../view/ui';
import { copyText, reportLink, reportText } from '../report-env';

export interface ReportData {
  onClose?: () => void;
}

const W = 960;
const H = 610;

export class ReportScene extends Phaser.Scene {
  private onClose: () => void = () => undefined;

  constructor() {
    super('SfReport');
  }

  init(data: ReportData): void {
    this.onClose = data.onClose ?? (() => undefined);
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    const w = viewW(this);
    // 跟設定頁一樣：放大到文字大小設定的倍率，但整塊要留在畫面裡
    const z = Math.min(uiZoom(), (VIEW_H - 16) / H, (w - 16) / W);
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x02060c, 0.82).setInteractive();
    const box = this.add.container(w / 2, VIEW_H / 2).setScale(z);
    const g = this.add.graphics();
    drawPanel(g, -W / 2, -H / 2, W, H, { alpha: 0.98, cut: 18 });
    box.add(g);
    box.add(addText(this, 0, -H / 2 + 40, T('report'), { size: 26, raw: true, strokeW: 0 }).setOrigin(0.5));

    const text = reportText();
    const link = reportLink();
    const intro = addText(this, 0, -H / 2 + 72, `${T('reportIntro')}${T(link ? 'reportHowForm' : 'reportHowCopy')}`, { size: 15, raw: true, strokeW: 0, color: COL.dim, bold: false, wrap: W - 90, align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0);
    box.add(intro);

    // 診斷資訊放在深色的框裡，讓玩家看得到送出去的是什麼；太長就整段縮小到放得下
    const top = -H / 2 + 72 + intro.height + 14;
    const frameH = H / 2 - 84 - top;
    g.fillStyle(0x040a14, 0.92).fillRect(-W / 2 + 36, top, W - 72, frameH);
    g.lineStyle(1, COL.lineDim, 0.8).strokeRect(-W / 2 + 36, top, W - 72, frameH);
    const body = addText(this, -W / 2 + 50, top + 12, text, { size: 17, raw: true, strokeW: 0, color: '#c4d8e8', bold: false, wrap: W - 100, lineSpacing: 5 });
    body.setScale(Math.min(1, (frameH - 24) / body.height));
    box.add(body);

    const by = H / 2 - 44;
    const copy: Button = new Button(
      this,
      link ? 60 : -125,
      by,
      link ? 180 : 220,
      52,
      T('reportCopy'),
      () => {
        void copyText(text).then((ok) => {
          if (copy.active) copy.setLabel(T(ok ? 'reportCopied' : 'reportCopyFailed'));
        });
      },
      { size: 18, primary: !link },
    );
    box.add(copy);
    // 表單開在新分頁，診斷資訊已經填在裡面，玩家只要補上發生了什麼事
    const open = link ? new Button(this, -210, by, 320, 52, T('reportOpen'), () => window.open(link, '_blank', 'noopener'), { size: 18, primary: true }) : null;
    if (open) box.add(open);
    box.add(new Button(this, link ? 260 : 125, by, link ? 180 : 220, 52, T('close'), () => this.close(), { size: 18, color: 0x8fb0c8 }));
    new KeyNav(this, { onBack: () => this.close(), first: () => open ?? copy });
  }

  private close(): void {
    const done = this.onClose;
    this.scene.stop();
    done();
  }
}
