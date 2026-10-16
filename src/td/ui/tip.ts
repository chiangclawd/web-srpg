import Phaser from 'phaser';
import { VIEW_H, addText, viewW } from '../config';
import { panel } from './widgets';
import { T } from '../i18n';

/**
 * 首次提示泡泡：箭頭指向畫面上的某個 UI（tx, ty），點任意處關閉。
 * 目標在畫面下半部時泡泡放上方，反之放下方；水平位置夾在畫面內。
 */
export function showTipBubble(scene: Phaser.Scene, tx: number, ty: number, text: string, onClose: () => void, depth = 120): Phaser.GameObjects.Container {
  const w = viewW(scene);
  // 用螢幕座標：捲動過的相機（世界地圖）也能正確對位
  const c = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  // 全畫面點擊區（半透明，強調目標）
  const shade = scene.add.graphics();
  shade.fillStyle(0x0a0604, 0.45);
  shade.fillRect(0, 0, w, VIEW_H);
  shade.fillStyle(0xffffff, 0.12);
  shade.fillCircle(tx, ty, 44);
  const hit = scene.add.rectangle(0, 0, w, VIEW_H, 0x000000, 0.001).setOrigin(0).setInteractive();
  c.add([shade, hit]);
  const ring = scene.add.circle(tx, ty, 40).setStrokeStyle(4, 0xffd84a, 1);
  c.add(ring);
  scene.tweens.add({ targets: ring, scale: 1.15, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });

  const bw = 380;
  const msg = addText(scene, 0, 0, text, { size: 18, color: '#fff6dc', wrap: bw - 40, lineSpacing: 5 }).setOrigin(0.5);
  const bh = msg.height + 58;
  const above = ty > VIEW_H / 2;
  const by = above ? ty - 70 - bh / 2 : ty + 70 + bh / 2;
  const bx = Phaser.Math.Clamp(tx, bw / 2 + 12, w - bw / 2 - 12);
  const bubble = scene.add.container(bx, by);
  bubble.add(panel(scene, 0, 0, bw, bh, 'ui_dark', 20));
  msg.setPosition(0, -12);
  bubble.add(msg);
  bubble.add(addText(scene, 0, bh / 2 - 18, T('tapToContinue'), { size: 13, color: '#c8b48a' }).setOrigin(0.5));
  // 箭頭：從泡泡邊緣指向目標
  const arrow = scene.add.graphics();
  const ay = above ? by + bh / 2 - 2 : by - bh / 2 + 2;
  const ex = Phaser.Math.Clamp(tx, bx - bw / 2 + 30, bx + bw / 2 - 30);
  arrow.fillStyle(0xffd84a, 1);
  arrow.lineStyle(3, 0x2a1608, 1);
  const tipY = above ? ty - 44 : ty + 44;
  arrow.beginPath();
  arrow.moveTo(ex - 14, ay);
  arrow.lineTo(ex + 14, ay);
  arrow.lineTo(tx, tipY);
  arrow.closePath();
  arrow.fillPath();
  arrow.strokePath();
  c.add([arrow, bubble]);
  // 子物件也要固定在螢幕上（點擊判定用的是子物件自己的 scrollFactor）
  c.setScrollFactor(0, 0, true);
  bubble.setScale(0.6).setAlpha(0);
  scene.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  let done = false;
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    if (done) return;
    done = true;
    c.destroy();
    onClose();
  });
  return c;
}
