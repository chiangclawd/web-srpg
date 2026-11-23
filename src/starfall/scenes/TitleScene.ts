import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { unlockAudio } from '../audio';
import { T, getLang, setLang } from '../i18n';
import { Button } from '../view/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('SfTitle');
  }

  create(): void {
    setupCamera(this);
    const w = viewW(this);
    const z = uiZoom();
    const bg = this.add.image(w / 2, VIEW_H / 2, 'title');
    bg.setScale(Math.max(w / bg.width, VIEW_H / bg.height));
    // 左側壓暗，讓標題和按鈕清楚
    const g = this.add.graphics();
    g.fillGradientStyle(0x040a14, 0x040a14, 0x040a14, 0x040a14, 0.88, 0, 0.88, 0);
    g.fillRect(0, 0, w * 0.62, VIEW_H);
    const x = 70;
    addText(this, x, 150, T('earlyBuild'), { size: 16, strokeW: 0, color: COL.orange });
    const title = addText(this, x, 176, T('title'), { size: 84, color: '#ffffff', stroke: '#0b2a44', strokeW: 10 });
    addText(this, x + 4, 182 + title.height, 'STARFALL ECHO', { size: 26, strokeW: 0, color: COL.cyan }).setLetterSpacing(10);
    addText(this, x + 4, 236 + title.height, T('tagline'), { size: 18, strokeW: 0, color: COL.dim, bold: false, wrap: 520 });
    const by = VIEW_H - 70 - 60 * z;
    new Button(
      this,
      x + 130 * z,
      by,
      260,
      64,
      T('start'),
      () => {
        unlockAudio();
        this.scene.start('SfMissions');
      },
      { primary: true, size: 24 },
    ).setScale(z);
    new Button(
      this,
      x + 130 * z,
      by + 76 * z,
      260,
      48,
      T('language'),
      () => {
        setLang(getLang() === 'zh' ? 'en' : 'zh');
        this.scene.restart();
      },
      { color: 0x8fb0c8, size: 17 },
    ).setScale(z);
    addText(this, w - 14, VIEW_H - 10, `v${__APP_VERSION__} · ${__GIT_SHA__}`, { size: 12, strokeW: 0, color: '#5a7088', bold: false }).setOrigin(1, 1);
  }
}
