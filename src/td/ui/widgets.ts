import Phaser from 'phaser';
import { TEX, addText, type TextOpts } from '../config';
import { sfx } from '../audio';

/** 9-slice 面板（紋理是 2 倍解析度，所以寬高乘 TEX 再整體縮回） */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, tex = 'ui_panel', corner = 30): Phaser.GameObjects.NineSlice {
  const c = corner * TEX;
  const p = scene.add.nineslice(x, y, tex, undefined, w * TEX, h * TEX, c, c, c, c);
  p.setScale(1 / TEX);
  return p;
}

export interface ButtonOpts {
  color?: 'green' | 'red' | 'blue' | 'gold' | 'grey' | 'wood';
  text?: TextOpts;
  icon?: string;
  iconSize?: number;
  disabled?: boolean;
  sound?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  readonly bg: Phaser.GameObjects.NineSlice;
  readonly label: Phaser.GameObjects.Text;
  readonly hit: Phaser.GameObjects.Rectangle;
  private icon?: Phaser.GameObjects.Image;
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.bg = scene.add.nineslice(0, 0, `ui_btn_${o.color ?? 'green'}`, undefined, w * TEX, h * TEX, 22 * TEX, 22 * TEX, 20 * TEX, 22 * TEX);
    this.bg.setScale(1 / TEX);
    this.add(this.bg);
    let tx = 0;
    if (o.icon) {
      const isz = o.iconSize ?? h * 0.62;
      this.icon = scene.add.image(text ? -w / 2 + isz * 0.5 + 12 : 0, -2, o.icon).setDisplaySize(isz, isz);
      this.add(this.icon);
      if (text) tx = isz * 0.45;
    }
    this.label = addText(scene, tx, -3, text, { size: Math.round(h * 0.4), display: true, ...o.text }).setOrigin(0.5);
    this.add(this.label);
    this.hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001);
    this.hit.setInteractive({ useHandCursor: true });
    this.add(this.hit);
    this.setSize(w, h);
    let pressed = false;
    this.hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (!this.enabled) {
        sfx.play('error', 0.6);
        return;
      }
      pressed = true;
      this.setScale(0.94);
    });
    this.hit.on('pointerout', () => {
      pressed = false;
      this.setScale(1);
    });
    this.hit.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      this.setScale(1);
      if (o.sound !== false) sfx.play('click');
      onClick();
    });
    if (o.disabled) this.setEnabled(false);
    scene.add.existing(this);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.bg.setTint(on ? 0xffffff : 0x8a8a8a);
    this.label.setAlpha(on ? 1 : 0.6);
    this.icon?.setAlpha(on ? 1 : 0.6);
    return this;
  }

  setText(s: string): this {
    this.label.setText(s);
    return this;
  }
}

/** 圓形圖示按鈕 */
export class IconButton extends Phaser.GameObjects.Container {
  readonly badge: Phaser.GameObjects.Image;
  readonly icon: Phaser.GameObjects.Image;
  readonly hit: Phaser.GameObjects.Arc;
  private enabled = true;
  private size: number;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number, icon: string, onClick: () => void, badge = 'ui_badge', iconScale = 0.62) {
    super(scene, x, y);
    this.size = size;
    this.badge = scene.add.image(0, 0, badge).setDisplaySize(size, size);
    this.icon = scene.add.image(0, 0, icon);
    this.icon.setDisplaySize(size * iconScale, size * iconScale);
    this.hit = scene.add.circle(0, 0, size / 2, 0xffffff, 0.001);
    this.hit.setInteractive({ useHandCursor: true });
    this.add([this.badge, this.icon, this.hit]);
    let pressed = false;
    this.hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      pressed = true;
      this.setScale(0.9);
    });
    this.hit.on('pointerout', () => {
      pressed = false;
      this.setScale(1);
    });
    this.hit.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      this.setScale(1);
      if (!this.enabled) {
        sfx.play('error', 0.6);
        return;
      }
      sfx.play('click');
      onClick();
    });
    scene.add.existing(this);
  }

  setIcon(icon: string): this {
    this.icon.setTexture(icon);
    this.icon.setDisplaySize(this.size * 0.62, this.size * 0.62);
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.badge.setTint(on ? 0xffffff : 0x777777);
    this.icon.setTint(on ? 0xffffff : 0x999999);
    return this;
  }
}

/** 全螢幕半透明遮罩（吃掉點擊） */
export function dimmer(scene: Phaser.Scene, w: number, h: number, alpha = 0.6): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(0, 0, w, h, 0x0a0604, alpha).setOrigin(0);
  r.setInteractive();
  r.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev?.stopPropagation?.());
  return r;
}

/** 彈出動畫 */
export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, delay = 0): void {
  const tr = target as unknown as { scale: number };
  tr.scale = 0.6;
  (target as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0);
  scene.tweens.add({ targets: target, scale: 1, alpha: 1, duration: 320, delay, ease: 'Back.easeOut' });
}
