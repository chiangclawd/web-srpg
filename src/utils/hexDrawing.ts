import Phaser from 'phaser';
import { HEX_SIZE } from '../Grid';

/**
 * 在 Graphics 上繪製一個 pointy-top 六角形的路徑（含 fillPath / strokePath 由呼叫端決定）。
 * 角度從頂點 30°（東上）順時鐘繞行。
 */
export function tracePointyHexPath(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number = HEX_SIZE
): void {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = ((30 + i * 60) * Math.PI) / 180;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}
