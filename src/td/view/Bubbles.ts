import Phaser from 'phaser';
import { addText } from '../config';
import type { L10n } from '../sim/defs';
import { L } from '../i18n';
import { DEPTH } from './Fx';

/** 兩則台詞之間至少間隔（毫秒），避免一直講話 */
const GAP_MS = 2600;

/**
 * 單位頭上的對話泡泡：白底圓角框＋小尾巴，彈出後停留一下再淡出。
 * 同一個來源同時只留一個泡泡；全場有節流，偶爾才冒一句。
 */
export class Bubbles {
  private last = -GAP_MS;
  private live = new Map<string, Phaser.GameObjects.Container>();

  constructor(private scene: Phaser.Scene) {}

  /** chance：這次要講的機率（被節流擋下時不講） */
  say(key: string, x: number, y: number, lines: L10n[] | undefined, chance = 1): void {
    if (!lines?.length) return;
    const now = this.scene.time.now;
    if (now - this.last < GAP_MS || Math.random() > chance) return;
    this.last = now;
    this.live.get(key)?.destroy();
    const text = L(lines[Math.floor(Math.random() * lines.length)]);
    const t = addText(this.scene, 0, 0, text, { size: 15, bold: true, color: '#3a2412', strokeW: 0, shadow: false }).setOrigin(0.5);
    const w = t.width + 20;
    const h = t.height + 10;
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 9);
    g.fillStyle(0xfffaf0, 1);
    g.lineStyle(2, 0x5a3a1a, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    // 尾巴
    g.fillTriangle(-7, h / 2 - 1, 5, h / 2 - 1, -4, h / 2 + 9);
    g.lineBetween(-7, h / 2, -4, h / 2 + 9);
    g.lineBetween(5, h / 2, -4, h / 2 + 9);
    const c = this.scene.add.container(x + 6, y - h / 2 - 10, [g, t]).setDepth(DEPTH.float - 5).setScale(0.2);
    this.live.set(key, c);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      y: c.y - 10,
      delay: 1700,
      duration: 300,
      onComplete: () => {
        c.destroy();
        if (this.live.get(key) === c) this.live.delete(key);
      },
    });
  }
}
