// 設定：音量、演出速度、技能特寫、難度、語言、全螢幕，以及鍵盤操作的說明。
// 疊在別的場景上面（標題畫面或戰鬥選單開它）；關掉時呼叫 onClose，讓底下的畫面照新設定重畫。
import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { refreshMusic, sfx } from '../audio';
import { T, getLang, setLang } from '../i18n';
import type { StrKey } from '../i18n';
import { persist, save } from '../save';
import { Button, KeyNav, Slider, drawPanel, showKeyHints } from '../view/ui';

export interface SettingsData {
  onClose?: () => void;
}

const W = 660;
const ROW = 56;
/** 右邊控制項的中心與寬度 */
const CX = 150;
const CW = 250;

export class SettingsScene extends Phaser.Scene {
  private onClose: () => void = () => undefined;

  constructor() {
    super('SfSettings');
  }

  init(data: SettingsData): void {
    this.onClose = data.onClose ?? (() => undefined);
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    const w = viewW(this);
    const sv = save();
    const keys = showKeyHints();
    const full = this.scale.fullscreen.available;
    const rows = 6 + (full ? 1 : 0);
    const keysH = keys ? 112 : 0;
    const H = 84 + rows * ROW + 46 + keysH + 78;
    const z = Math.min(uiZoom(), (VIEW_H - 16) / H);
    // 擋住底下的畫面
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x02060c, 0.78).setInteractive();
    const box = this.add.container(w / 2, VIEW_H / 2).setScale(z);
    const g = this.add.graphics();
    drawPanel(g, -W / 2, -H / 2, W, H, { alpha: 0.97, cut: 18 });
    box.add(g);
    box.add(addText(this, 0, -H / 2 + 42, T('settings'), { size: 28, raw: true, strokeW: 0 }).setOrigin(0.5));

    let y = -H / 2 + 84 + ROW / 2;
    const label = (key: StrKey): void => {
      box.add(addText(this, -W / 2 + 44, y, T(key), { size: 19, raw: true, strokeW: 0 }).setOrigin(0, 0.5));
    };
    /** 一列開關：按一下換到另一個選項 */
    const toggle = (key: StrKey, text: () => string, flip: () => void): void => {
      label(key);
      const b: Button = new Button(
        this,
        CX,
        y,
        CW,
        44,
        text(),
        () => {
          flip();
          persist();
          b.setLabel(text());
        },
        { size: 17 },
      );
      box.add(b);
      y += ROW;
    };

    label('setSfx');
    const first = new Slider(this, CX - CW / 2, y, 190, sv.sfx, (v, done) => {
      sv.sfx = v;
      if (!done) return;
      persist();
      sfx('select');
    });
    box.add(first);
    y += ROW;
    label('setMusic');
    box.add(
      new Slider(this, CX - CW / 2, y, 190, sv.music, (v, done) => {
        sv.music = v;
        refreshMusic();
        if (done) persist();
      }),
    );
    y += ROW;
    toggle(
      'setSpeed',
      () => (sv.fast ? T('fast') : T('normal')),
      () => (sv.fast = !sv.fast),
    );
    toggle(
      'setCutIn',
      () => (sv.cutIn ? T('on') : T('off')),
      () => (sv.cutIn = !sv.cutIn),
    );
    toggle(
      'setDifficulty',
      () => (sv.easy ? T('diffEasy') : T('diffNormal')),
      () => (sv.easy = !sv.easy),
    );
    // 語言：整個畫面的字都要換，直接重開這個場景
    label('setLanguage');
    box.add(
      new Button(
        this,
        CX,
        y,
        CW,
        44,
        T('langName'),
        () => {
          setLang(getLang() === 'zh' ? 'en' : 'zh');
          this.scene.restart({ onClose: this.onClose });
        },
        { size: 17 },
      ),
    );
    y += ROW;
    if (full) {
      label('setFullscreen');
      const text = (): string => (this.scale.isFullscreen ? T('on') : T('off'));
      const b = new Button(this, CX, y, CW, 44, text(), () => this.scale.toggleFullscreen(), { size: 17 });
      box.add(b);
      const sync = (): void => void (b.active && b.setLabel(text()));
      this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
      this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
      this.events.once('shutdown', () => {
        this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
        this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
      });
      y += ROW;
    }
    // 難度的說明：輕鬆是什麼、什麼時候生效
    y -= ROW / 2 - 8;
    box.add(addText(this, 0, y, T('diffNote'), { size: 13, raw: true, strokeW: 0, color: COL.dim, bold: false, wrap: W - 80, align: 'center' }).setOrigin(0.5, 0));
    y += 38;
    if (keys) {
      box.add(addText(this, -W / 2 + 44, y, T('keysTitle'), { size: 16, raw: true, strokeW: 0, color: COL.cyan }));
      box.add(addText(this, -W / 2 + 44, y + 26, T('keysHelp'), { size: 13, raw: true, strokeW: 0, color: COL.dim, bold: false, wrap: W - 88, lineSpacing: 6 }));
    }
    box.add(new Button(this, 0, H / 2 - 44, 240, 52, T('close'), () => this.close(), { primary: true }));
    new KeyNav(this, { onBack: () => this.close(), first: () => first });
  }

  private close(): void {
    const done = this.onClose;
    this.scene.stop();
    done();
  }
}
