import Phaser from 'phaser';
import { addText } from '../config';
import { DEPTH } from './Fx';
import { sfx } from '../audio';

export interface RadialOption {
  id: string;
  icon: string;
  badge?: string;
  /** 價格（null = 不顯示價格） */
  price?: number | null;
  /** 取代價格的文字（例如 MAX） */
  tag?: string;
  enabled: boolean;
  /** 技能等級 [目前, 最高] */
  pips?: [number, number];
  /** 角度（度）：-90 = 正上方 */
  angle: number;
  dist?: number;
  size?: number;
  /** 需要第二次點擊確認（預設 true） */
  confirm?: boolean;
  onPreview?: () => void;
  onConfirm: () => void;
}

/**
 * 塔防經典的環形選單：點一下預覽（顯示射程、說明），再點一下確認。
 */
export class RadialMenu extends Phaser.GameObjects.Container {
  private selected: string | null = null;
  private checks = new Map<string, Phaser.GameObjects.Image>();
  private items = new Map<string, Phaser.GameObjects.Container>();
  closing = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: RadialOption[],
    radius = 64,
  ) {
    super(scene, x, y);
    this.setDepth(DEPTH.menu);
    const ring = scene.add.graphics();
    ring.fillStyle(0x1a0e04, 0.35);
    ring.fillEllipse(0, 0, radius * 2 + 20, (radius * 2 + 20) * 0.9);
    ring.lineStyle(3, 0xf0d090, 0.85);
    ring.strokeEllipse(0, 0, radius * 2 + 20, (radius * 2 + 20) * 0.9);
    ring.lineStyle(1.5, 0x3a2410, 0.9);
    ring.strokeEllipse(0, 0, radius * 2 + 26, (radius * 2 + 26) * 0.9);
    this.add(ring);
    for (const o of options) this.addOption(o, radius);
    scene.add.existing(this);
    this.setScale(0.3);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  }

  private addOption(o: RadialOption, radius: number): void {
    const scene = this.scene;
    const a = Phaser.Math.DegToRad(o.angle);
    const d = o.dist ?? radius;
    const size = o.size ?? 54;
    const c = scene.add.container(Math.cos(a) * d, Math.sin(a) * d * 0.9);
    const badge = scene.add.image(0, 0, o.badge ?? 'ui_badge').setDisplaySize(size, size);
    const icon = scene.add.image(0, -1, o.icon);
    const isTower = o.icon.startsWith('icb_');
    icon.setDisplaySize(isTower ? size : size * 0.6, isTower ? size : size * 0.6);
    c.add([badge, icon]);
    if (!o.enabled) {
      badge.setTint(0x6a6a6a);
      icon.setTint(0x8a8a8a);
    }
    if (o.price !== undefined && o.price !== null) {
      const pill = scene.add.image(0, size / 2 + 4, 'ui_pill').setDisplaySize(50, 20);
      const pt = addText(scene, 0, size / 2 + 3, String(o.price), {
        size: 14,
        display: true,
        color: o.enabled ? '#ffe066' : '#c08a6a',
        strokeW: 3,
        shadow: false,
      }).setOrigin(0.5);
      c.add([pill, pt]);
    } else if (o.tag) {
      const pill = scene.add.image(0, size / 2 + 4, 'ui_pill').setDisplaySize(50, 20);
      const pt = addText(scene, 0, size / 2 + 3, o.tag, { size: 12, display: true, color: '#b8e0ff', strokeW: 3, shadow: false }).setOrigin(0.5);
      c.add([pill, pt]);
    }
    if (o.pips) {
      const [cur, max] = o.pips;
      for (let i = 0; i < max; i++) {
        const px = (i - (max - 1) / 2) * 11;
        const pip = scene.add.circle(px, -size / 2 - 2, 4, i < cur ? 0xffd84a : 0x3a2a1a).setStrokeStyle(1.5, 0x1a0a04);
        c.add(pip);
      }
    }
    const check = scene.add.image(0, -1, 'ic_check').setDisplaySize(size * 0.62, size * 0.62).setVisible(false);
    c.add(check);
    this.checks.set(o.id, check);
    const hit = scene.add.circle(0, 0, size / 2 + 2, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (this.closing) return;
      this.tap(o);
    });
    this.items.set(o.id, c);
    this.add(c);
    c.setScale(0.4);
    scene.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut', delay: 30 });
  }

  private tap(o: RadialOption): void {
    if (o.confirm === false) {
      if (!o.enabled) {
        sfx.play('error', 0.6);
        return;
      }
      sfx.play('click');
      o.onConfirm();
      return;
    }
    if (this.selected === o.id) {
      if (!o.enabled) {
        sfx.play('error', 0.6);
        const it = this.items.get(o.id);
        if (it) this.scene.tweens.add({ targets: it, x: it.x + 4, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      o.onConfirm();
      return;
    }
    sfx.play('click');
    this.selected = o.id;
    for (const [id, ck] of this.checks) {
      ck.setVisible(id === o.id && o.enabled);
      const it = this.items.get(id);
      if (it) it.setScale(id === o.id ? 1.12 : 1);
    }
    o.onPreview?.();
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    this.scene.tweens.add({ targets: this, scale: 0.4, alpha: 0, duration: 140, onComplete: () => this.destroy() });
  }
}
