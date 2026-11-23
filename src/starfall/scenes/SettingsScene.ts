// 設定：音量、演出速度、技能特寫、難度、語言、文字大小、色盲配色、全螢幕，以及鍵盤操作的說明。
// 疊在別的場景上面（標題畫面或戰鬥選單開它）；關掉時呼叫 onClose，讓底下的畫面照新設定重畫。
import Phaser from 'phaser';
import { COL, TEXT_SCALES, VIEW_H, addText, applyPalette, refreshTextScale, setupCamera, textScale, uiZoom, viewW } from '../config';
import { refreshMusic, sfx } from '../audio';
import { T, getLang, setLang } from '../i18n';
import type { StrKey } from '../i18n';
import { persist, save } from '../save';
import { Button, KeyNav, Slider, drawPanel, showKeyHints } from '../view/ui';

export interface SettingsData {
  onClose?: () => void;
}

/** 兩欄：每欄左邊是名稱、右邊是控制項 */
const W = 1080;
const COL_W = 490;
const ROW = 56;
const CTL_W = 230;

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
    const keysH = keys ? 104 : 0;
    const H = 84 + 5 * ROW + 74 + keysH + 78;
    // 放大到文字大小設定的倍率，但整塊面板要留在畫面裡
    const z = Math.min(uiZoom(), (VIEW_H - 16) / H, (w - 16) / W);
    // 擋住底下的畫面
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x02060c, 0.78).setInteractive();
    const box = this.add.container(w / 2, VIEW_H / 2).setScale(z);
    const g = this.add.graphics();
    drawPanel(g, -W / 2, -H / 2, W, H, { alpha: 0.97, cut: 18 });
    box.add(g);
    box.add(addText(this, 0, -H / 2 + 42, T('settings'), { size: 28, raw: true, strokeW: 0 }).setOrigin(0.5));

    const top = -H / 2 + 84 + ROW / 2;
    let col = 0;
    let row = 0;
    const next = (): { x: number; cx: number; y: number } => {
      const left = col === 0 ? -W / 2 + 40 : W / 2 - 40 - COL_W;
      const at = { x: left, cx: left + COL_W - CTL_W / 2, y: top + row * ROW };
      row++;
      return at;
    };
    const label = (x: number, y: number, key: StrKey): void => {
      box.add(addText(this, x, y, T(key), { size: 19, raw: true, strokeW: 0 }).setOrigin(0, 0.5));
    };
    /** 一列按鈕：按一下換到下一個選項。after：換完之後要做的事（重畫、套用） */
    const choice = (key: StrKey, text: () => string, flip: () => void, after?: () => void): void => {
      const p = next();
      label(p.x, p.y, key);
      const b: Button = new Button(
        this,
        p.cx,
        p.y,
        CTL_W,
        44,
        text(),
        () => {
          flip();
          persist();
          if (after) after();
          else b.setLabel(text());
        },
        { size: 17 },
      );
      box.add(b);
    };
    const slider = (key: StrKey, value: number, onChange: (v: number, done: boolean) => void): Slider => {
      const p = next();
      label(p.x, p.y, key);
      const s = new Slider(this, p.cx - CTL_W / 2, p.y, CTL_W - 60, value, onChange);
      box.add(s);
      return s;
    };
    /** 整個設定頁重畫一次（語言、文字大小換了之後，每一行字都要換） */
    const redraw = (): void => void this.scene.restart({ onClose: this.onClose });

    // ── 左欄：聲音與戰鬥 ──
    const first = slider('setSfx', sv.sfx, (v, done) => {
      sv.sfx = v;
      if (!done) return;
      persist();
      sfx('select');
    });
    slider('setMusic', sv.music, (v, done) => {
      sv.music = v;
      refreshMusic();
      if (done) persist();
    });
    choice(
      'setSpeed',
      () => (sv.fast ? T('fast') : T('normal')),
      () => (sv.fast = !sv.fast),
    );
    choice(
      'setCutIn',
      () => (sv.cutIn ? T('on') : T('off')),
      () => (sv.cutIn = !sv.cutIn),
    );
    choice(
      'setDifficulty',
      () => (sv.easy ? T('diffEasy') : T('diffNormal')),
      () => (sv.easy = !sv.easy),
    );

    // ── 右欄：顯示 ──
    col = 1;
    row = 0;
    choice(
      'setLanguage',
      () => T('langName'),
      () => setLang(getLang() === 'zh' ? 'en' : 'zh'),
      redraw,
    );
    choice(
      'setTextSize',
      () => T(`textSize${Math.max(0, TEXT_SCALES.indexOf(textScale()))}` as StrKey),
      () => (sv.textScale = TEXT_SCALES[(TEXT_SCALES.indexOf(textScale()) + 1) % TEXT_SCALES.length]),
      () => {
        refreshTextScale();
        redraw();
      },
    );
    choice(
      'setColorBlind',
      () => (sv.colorBlind ? T('on') : T('off')),
      () => (sv.colorBlind = !sv.colorBlind),
      () => {
        applyPalette();
        redraw();
      },
    );
    if (full) {
      const p = next();
      label(p.x, p.y, 'setFullscreen');
      const text = (): string => (this.scale.isFullscreen ? T('on') : T('off'));
      const b = new Button(this, p.cx, p.y, CTL_W, 44, text(), () => this.scale.toggleFullscreen(), { size: 17 });
      box.add(b);
      const sync = (): void => void (b.active && b.setLabel(text()));
      this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
      this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
      this.events.once('shutdown', () => {
        this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
        this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
      });
    }
    // 色盲配色的樣本：我方、敵方現在各是什麼顏色
    {
      const p = next();
      const sw = this.add.graphics();
      sw.fillStyle(COL.player, 1).fillRect(p.x, p.y - 7, 44, 14);
      sw.fillStyle(COL.enemy, 1).fillRect(p.x + COL_W / 2, p.y - 7, 44, 14);
      box.add(sw);
      box.add(addText(this, p.x + 54, p.y, T('swatchPlayer'), { size: 15, raw: true, strokeW: 0, color: COL.dim, bold: false }).setOrigin(0, 0.5));
      box.add(addText(this, p.x + COL_W / 2 + 54, p.y, `${sv.colorBlind ? '▼ ' : ''}${T('swatchEnemy')}`, { size: 15, raw: true, strokeW: 0, color: COL.dim, bold: false }).setOrigin(0, 0.5));
    }

    // 說明：輕鬆難度是什麼、什麼時候生效；色盲配色改了什麼
    let y = top + 5 * ROW - ROW / 2 + 10;
    box.add(addText(this, 0, y, `${T('diffNote')}\n${T('colorBlindNote')}`, { size: 13, raw: true, strokeW: 0, color: COL.dim, bold: false, wrap: W - 80, align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0));
    y += 64;
    if (keys) {
      box.add(addText(this, -W / 2 + 40, y, T('keysTitle'), { size: 16, raw: true, strokeW: 0, color: COL.cyan }));
      box.add(addText(this, -W / 2 + 40, y + 26, T('keysHelp'), { size: 13, raw: true, strokeW: 0, color: COL.dim, bold: false, wrap: W - 80, lineSpacing: 6 }));
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
