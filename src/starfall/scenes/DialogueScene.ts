// 對話演出：立繪 + 對話框，逐字顯示；點一下顯示整句 / 下一句，右上角可以跳過
import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { music, sfx } from '../audio';
import { L, T } from '../i18n';
import { CG_FOCUS, SPEAKERS, cgAt, cgKeys, closingCg, portraitKey } from '../data/story';
import type { Line } from '../data/story';
import { Button, drawPanel } from '../view/ui';

export class DialogueScene extends Phaser.Scene {
  private lines: Line[] = [];
  private onDone: () => void = () => undefined;
  private i = 0;
  private text!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private namePlate!: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Image | null = null;
  /** 現在畫面上的立繪是誰的：同一個人接著說話時只換表情，不重新滑進來 */
  private portraitWho = '';
  /** 畫面上那張全螢幕插圖；cgKey 是劇本這一句要的那一張（圖還沒載好時兩個會不一樣） */
  private cg: Phaser.GameObjects.Image | null = null;
  private cgKey = '';
  /** 視窗比例變了、從中間接著播 */
  private resumed = false;
  private full = '';
  private shown = 0;
  private timer: Phaser.Time.TimerEvent | null = null;
  private w = 1280;
  private boxH = 170;
  private boxW = 900;

  constructor() {
    super('SfDialogue');
  }

  init(data: { lines: Line[]; onDone: () => void; at?: number }): void {
    this.lines = data.lines;
    this.onDone = data.onDone;
    this.i = Phaser.Math.Clamp(data.at ?? 0, 0, Math.max(0, data.lines.length - 1));
    this.portrait = null;
    this.portraitWho = '';
    this.cg = null;
    this.cgKey = '';
    this.resumed = data.at !== undefined;
    this.timer = null;
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    this.w = viewW(this);
    const z = uiZoom();
    this.boxH = 150 * Math.min(z, 1.25) + 20;
    this.boxW = Math.min(this.w - 60, 1040);
    const dim = this.add.rectangle(this.w / 2, VIEW_H / 2, this.w, VIEW_H, 0x02060c, 0.55).setInteractive();
    dim.on('pointerup', () => this.advance());
    const g = this.add.graphics().setDepth(2);
    const x0 = (this.w - this.boxW) / 2;
    const y0 = VIEW_H - this.boxH - 14;
    drawPanel(g, x0, y0, this.boxW, this.boxH, { alpha: 0.95, cut: 16 });
    this.namePlate = this.add.graphics().setDepth(3);
    this.nameText = addText(this, x0 + 34, y0 - 4, '', { size: 20, strokeW: 0 }).setOrigin(0, 0.5).setDepth(4);
    this.text = addText(this, x0 + 30, y0 + 30, '', { size: 21, strokeW: 0, bold: false, wrap: this.boxW - 60, lineSpacing: 8 }).setDepth(4);
    addText(this, x0 + this.boxW - 20, y0 + this.boxH - 12, `▼ ${T('tapNext')}`, { size: 13, strokeW: 0, color: COL.dim }).setOrigin(1, 1).setDepth(4);
    const skip = new Button(this, this.w - 16 - 55 * z, 14 + 24 * z, 110, 46, T('skip'), () => this.skip(), { color: 0x8fb0c8 });
    skip.setScale(z).setDepth(5);
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.skip());
    // 表情差分和全螢幕插圖用到才載入（開機只載平常的立繪和結局圖）。
    // 還沒載好的那幾句：表情先用平常的那一張，插圖先不鋪；載好了就換上
    const need = new Set<string>();
    for (const l of this.lines) {
      const k = portraitKey(l);
      if (k && !this.textures.exists(k)) need.add(k);
    }
    for (const k of cgKeys(this.lines)) if (!this.textures.exists(k)) need.add(k);
    if (need.size) {
      for (const k of need) this.load.image(k, `assets/starfall/${k}.webp`);
      this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
        if (this.portrait && key === portraitKey(this.lines[this.i])) this.portrait.setTexture(key);
        if (key === this.cgKey) this.syncCg(false);
      });
      this.load.start();
    }
    // 從中間接著播（視窗比例變了重排）：畫面上本來有的全螢幕插圖直接鋪回去，不用淡入
    if (this.resumed) this.syncCg(true);
    this.show();
  }

  /** 視窗比例變了：照新的寬度重排，停在同一句 */
  resized(): void {
    this.scene.restart({ lines: this.lines, onDone: this.onDone, at: this.i });
  }

  private show(): void {
    const line = this.lines[this.i];
    const sp = SPEAKERS[line.who];
    this.syncCg(false);
    if (line.music) music(line.music);
    const x0 = (this.w - this.boxW) / 2;
    const y0 = VIEW_H - this.boxH - 14;
    // 立繪：從對話框上緣往上長，換人說話時淡入。這一句有指定表情、圖也載好了就用那一張
    const want = portraitKey(line);
    const key = want && this.textures.exists(want) ? want : sp.portrait;
    // 有全螢幕插圖時不放立繪：人物已經在畫面裡了，名牌就夠分辨誰在說話
    if (key && !this.cgKey && this.portrait && this.portraitWho === line.who) {
      // 同一個人接著說：表情差分跟原圖一樣大、身體一模一樣，原地換圖就只有臉在變
      this.portrait.setTexture(key);
    } else {
      this.portrait?.destroy();
      this.portrait = null;
      this.portraitWho = '';
      if (key && !this.cgKey) {
        const im = this.add.image(x0 + 150, y0 + 6, key).setOrigin(0.5, 1).setDepth(1);
        im.setScale(Math.min(430, y0 - 20) / im.height);
        im.setAlpha(0);
        this.tweens.add({ targets: im, alpha: 1, x: { from: x0 + 130, to: x0 + 150 }, duration: 180 });
        this.portrait = im;
        this.portraitWho = line.who;
      }
    }
    const name = L(sp.name);
    this.nameText.setText(name).setColor(`#${sp.color.toString(16).padStart(6, '0')}`);
    this.namePlate.clear();
    if (name) drawPanel(this.namePlate, x0 + 18, y0 - 22, this.nameText.width + 34, 36, { fill: 0x0a1626, alpha: 1, line: sp.color, cut: 8 });
    // 旁白用淡色斜體，跟角色說的話區分
    const narr = line.who === 'sys';
    this.text.setColor(narr ? COL.dim : COL.text).setFontStyle(narr ? 'italic' : 'normal');
    this.full = L(line);
    // 先排好整句的換行，再逐字顯示，字才不會打到一半跳行
    this.text.setText(this.full);
    this.full = this.text.getWrappedText(this.full).join('\n');
    this.shown = 0;
    this.text.setText('');
    this.timer?.remove();
    this.timer = this.time.addEvent({
      delay: 22,
      loop: true,
      callback: () => {
        this.shown = Math.min(this.full.length, this.shown + 1);
        this.text.setText(this.full.slice(0, this.shown));
        if (this.shown % 3 === 0 && !narr) sfx('talk');
        if (this.shown >= this.full.length) this.timer?.remove();
      },
    });
  }

  /**
   * 全螢幕插圖：鋪在暗幕上面、對話框下面。照劇本這一句該有的那一張鋪上、換掉或收掉（cgAt）。
   * 圖還沒載好就先維持原樣，載好了（FILE_COMPLETE）再來一次。
   */
  private syncCg(instant: boolean): void {
    const want = cgAt(this.lines, this.i);
    this.cgKey = want;
    if (want === (this.cg?.texture.key ?? '')) return;
    if (want && !this.textures.exists(want)) return;
    const old = this.cg;
    this.cg = null;
    if (want) {
      const im = this.add.image(this.w / 2, VIEW_H / 2, want).setDepth(0.5);
      im.setScale(Math.max(this.w / im.width, VIEW_H / im.height));
      // 比畫面高的時候（寬螢幕）上下要裁：照 CG_FOCUS 決定留哪一段
      im.y += (0.5 - (CG_FOCUS[want] ?? 0.5)) * (im.displayHeight - VIEW_H);
      this.cg = im;
      if (instant) old?.destroy();
      else {
        im.setAlpha(0);
        this.tweens.add({ targets: im, alpha: 1, duration: 900, onComplete: () => old?.destroy() });
      }
    } else if (old) {
      if (instant) old.destroy();
      else this.tweens.add({ targets: old, alpha: 0, duration: 500, onComplete: () => old.destroy() });
    }
  }

  private advance(): void {
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.text.setText(this.full);
      this.timer?.remove();
      return;
    }
    this.i++;
    if (this.i >= this.lines.length) this.finish();
    else this.show();
  }

  /** 還沒播到的句子裡最後一次換音樂（跳過時照樣要換，不然結局會配著戰鬥音樂） */
  private pendingMusic(from: number, to: number): void {
    const m = this.lines
      .slice(from, to)
      .map((l) => l.music)
      .filter((k) => !!k)
      .pop();
    if (m) music(m);
  }

  /** 跳過：後面還有留到最後的全螢幕插圖就先跳到那一句（結局圖不該被一鍵略過），沒有才直接結束 */
  private skip(): void {
    const next = closingCg(this.lines, this.i);
    if (next < 0) return this.finish();
    this.pendingMusic(this.i + 1, next);
    this.i = next;
    this.show();
  }

  private finish(): void {
    this.pendingMusic(this.i + 1, this.lines.length);
    this.timer?.remove();
    const done = this.onDone;
    this.scene.stop();
    done();
  }
}
