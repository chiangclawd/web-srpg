// 介面元件：科幻風的面板與按鈕（全部用向量畫，不需要圖檔）
import Phaser from 'phaser';
import { COL, TEX, addText, fitText } from '../config';
import { sfx } from '../audio';

export interface PanelOpts {
  fill?: number;
  alpha?: number;
  line?: number;
  /** 切角大小 */
  cut?: number;
}

/** 切角面板：深色半透明底 + 細邊框 + 角落亮線。(x, y) 是左上角 */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: PanelOpts = {}): void {
  const c = o.cut ?? 12;
  const pts = [x + c, y, x + w, y, x + w, y + h - c, x + w - c, y + h, x, y + h, x, y + c];
  g.fillStyle(o.fill ?? COL.panel, o.alpha ?? 0.9);
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.5, o.line ?? COL.lineDim, 1);
  g.strokePath();
  // 左上、右下的亮角
  g.lineStyle(2.5, o.line ?? COL.line, 1);
  g.beginPath();
  g.moveTo(x, y + c + 14);
  g.lineTo(x, y + c);
  g.lineTo(x + c, y);
  g.lineTo(x + c + 22, y);
  g.strokePath();
  g.beginPath();
  g.moveTo(x + w, y + h - c - 14);
  g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h);
  g.lineTo(x + w - c - 22, y + h);
  g.strokePath();
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: PanelOpts = {}): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, o);
  return g;
}

export interface ButtonOpts {
  icon?: string;
  /** 主色（邊框與文字） */
  color?: number;
  size?: number;
  disabled?: boolean;
  /** 右側的小字（冷卻回合數之類） */
  note?: string;
  primary?: boolean;
}

/** 按鈕：(x, y) 是中心。按下又放開在同一顆上才算點擊 */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private hit: Phaser.GameObjects.Rectangle;
  private enabled = true;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bw: number,
    private readonly bh: number,
    text: string,
    private readonly onClick: () => void,
    private readonly o: ButtonOpts = {},
  ) {
    super(scene, x, y);
    const w = bw;
    const h = bh;
    this.color = o.color ?? COL.line;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    const hasIcon = !!o.icon;
    if (o.icon) {
      const ic = scene.add
        .image(-w / 2 + h / 2 + 2, 0, o.icon)
        .setScale((h * 0.56) / 64 / TEX)
        .setTint(this.color);
      this.add(ic);
    }
    this.label = addText(scene, hasIcon ? h * 0.34 : 0, 0, text, { size: o.size ?? 18, strokeW: 0, raw: true }).setOrigin(0.5);
    fitText(this.label, w - (hasIcon ? h + 8 : 20) - (o.note ? 34 : 0));
    this.add(this.label);
    if (o.note) this.add(addText(scene, w / 2 - 10, 0, o.note, { size: 13, color: COL.dim, strokeW: 0, raw: true }).setOrigin(1, 0.5));
    this.hit = scene.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    this.add(this.hit);
    let down = false;
    this.hit.on('pointerdown', () => {
      down = true;
      this.draw(true);
    });
    this.hit.on('pointerout', () => {
      down = false;
      this.draw(false);
    });
    this.hit.on('pointerup', () => {
      if (!down) return;
      down = false;
      this.draw(false);
      if (!this.enabled) {
        sfx('error');
        return;
      }
      sfx('click');
      this.onClick();
    });
    this.setEnabled(!o.disabled);
    scene.add.existing(this);
  }

  private draw(pressed: boolean): void {
    const w = this.bw;
    const h = this.bh;
    const g = this.bg;
    g.clear();
    const col = this.enabled ? this.color : 0x4a5a6c;
    drawPanel(g, -w / 2, -h / 2, w, h, { fill: pressed ? COL.panelHi : this.o.primary ? 0x123a52 : COL.panel, alpha: 0.94, line: col, cut: Math.min(10, h / 4) });
    this.label.setColor(this.enabled ? '#e8f4ff' : '#6a7c90');
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.draw(false);
    return this;
  }

  setLabel(s: string): this {
    this.label.setText(s);
    fitText(this.label, this.bw - 20);
    return this;
  }
}
