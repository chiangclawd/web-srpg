import Phaser from 'phaser';
import { TEX, addText } from '../config';

/**
 * 新手引導：上下跳的箭頭＋箭頭上方一行說明，指向戰場上的某個位置。
 * 只是畫面提示，不擋點擊（玩家照著點下去就是在操作遊戲本身）。
 */
export class Coach {
  private arrow: Phaser.GameObjects.Image;
  private box: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private text = '';

  constructor(scene: Phaser.Scene, depth: number) {
    this.arrow = scene.add.image(0, 0, 'fx_arrow').setScale(1 / TEX).setDepth(depth).setVisible(false);
    this.bg = scene.add.graphics();
    this.label = addText(scene, 0, 0, '', { size: 17, color: '#fff6dc', strokeW: 3, shadow: false, align: 'center', wrap: 420 }).setOrigin(0.5);
    this.box = scene.add.container(0, 0, [this.bg, this.label]).setDepth(depth).setVisible(false);
  }

  /** 箭頭尖端指向 (x, y)。z：箭頭的縮放；bz：說明框的縮放（字在手機上已經自動放大，不用再乘 z）；
   *  view：可放說明的範圍（top 要扣掉上方 HUD） */
  show(x: number, y: number, text: string, time: number, z = 1, bz = 1, view?: { left: number; right: number; top: number }): void {
    if (text !== this.text) {
      this.text = text;
      this.label.setText(text);
      const w = this.label.width + 28;
      const h = this.label.height + 16;
      this.bg.clear();
      this.bg.fillStyle(0x1a0e04, 0.88);
      this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      this.bg.lineStyle(2.5, 0xffd84a, 1);
      this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      this.box.setSize(w, h);
      // 換一句話時跳一下，玩家才會注意到下一步
      this.box.setScale(bz * 0.7);
      this.box.scene.tweens.add({ targets: this.box, scale: bz, duration: 220, ease: 'Back.easeOut' });
    } else if (!this.box.scene.tweens.isTweening(this.box)) this.box.setScale(bz);
    const bob = Math.abs(Math.sin(time / 220)) * 12 * z;
    const ay = y - 28 * z - bob;
    this.arrow.setScale(z / TEX).setPosition(x, ay).setVisible(true);
    // 說明放箭頭上方；靠近畫面邊緣時往內推
    const hw = (this.box.width / 2) * bz;
    const hh = (this.box.height / 2) * bz;
    let bx = x;
    let by = ay - 28 * z - hh;
    if (view) {
      if (by - hh < view.top + 4) {
        // 上面放不下：放在箭頭旁邊（空間大的那一側），不蓋住要點的東西
        const side = x - view.left > view.right - x ? -1 : 1;
        bx = x + side * (24 * z + hw + 6);
        by = Math.max(ay, view.top + hh + 4);
      }
      bx = Phaser.Math.Clamp(bx, view.left + hw + 8, Math.max(view.left + hw + 8, view.right - hw - 8));
    }
    this.box.setPosition(bx, by).setVisible(true);
  }

  hide(): void {
    this.arrow.setVisible(false);
    this.box.setVisible(false);
  }

  destroy(): void {
    this.arrow.destroy();
    this.box.destroy();
  }
}
