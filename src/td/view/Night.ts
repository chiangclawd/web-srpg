import Phaser from 'phaser';
import { PLAY_X0, VIEW_H, WORLD_W } from '../config';
import type { World } from '../sim/World';
import type { DecorItem } from '../sim/defs';
import { DEPTH } from './Fx';

/** 夜幕貼圖的解析度倍率（光圈很柔，用半解析度再放大就夠了，省下大半填充率） */
const RES = 0.5;

/**
 * 夜戰畫面：整張戰場蓋一層深藍色的夜幕，在塔、營火、民房、空建造點周圍「擦」出光圈。
 * 夜幕只在塔蓋好／賣掉時重畫（手機上每幀重畫太吃效能）；
 * 會移動的英雄、士兵與爆炸火光改用加亮的柔光貼圖跟著走（同一張貼圖，一次就畫完）。
 * 夜幕在單位之上、特效與血條之下，所以爆炸火光仍然亮眼。
 */
export class NightLayer {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private fixed: { x: number; y: number; r: number }[] = [];
  private sig = '';
  private glows: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    decor: DecorItem[],
  ) {
    this.rt = scene.add
      .renderTexture(-PLAY_X0, 0, Math.ceil(WORLD_W * RES), Math.ceil(VIEW_H * RES))
      .setOrigin(0)
      .setScale(1 / RES)
      .setDepth(DEPTH.proj + 500);
    this.brush = scene.make.image({ key: 'fx_soft', add: false });
    // 固定光源：營火、民房窗戶、城堡、祭壇
    for (const d of decor) {
      const flicker = d.kind === 'camp' ? 1 : d.kind === 'altar' ? 0.6 : 0.3;
      let f: { x: number; y: number; r: number } | null = null;
      // 光圈大小和「燈火照到、塔射程不打折」的範圍一致（World.litAt）
      if (d.kind === 'camp') f = { x: d.x, y: d.y, r: 175 };
      else if (d.kind === 'house') f = { x: d.x, y: d.y, r: 120 };
      else if (d.kind === 'castle') f = { x: d.x, y: d.y, r: 165 };
      else if (d.kind === 'altar') f = { x: d.x, y: d.y, r: 140 };
      if (!f) continue;
      this.fixed.push(f);
      // 營火、窗戶的暖色光暈（ADD 疊在夜幕上，搖曳用 tween，不必重畫夜幕）
      const g = scene.add.image(f.x, f.y, 'fx_soft').setTint(0xffb050).setBlendMode('ADD').setDepth(DEPTH.proj + 501);
      g.setDisplaySize(f.r * 1.1, f.r * 0.85).setAlpha(0.2 + flicker * 0.12);
      if (flicker > 0.5) scene.tweens.add({ targets: g, alpha: 0.18, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** 爆炸、流星、雷擊：短暫照亮（加亮的柔光，自己淡出） */
  flash(x: number, y: number, r: number): void {
    const g = this.scene.add.image(x, y, 'fx_soft').setTint(0xffd89a).setBlendMode('ADD').setDepth(DEPTH.proj + 502);
    g.setDisplaySize(r * 2, r * 1.6).setAlpha(0.55);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
  }

  update(): void {
    const w = this.world;
    // 夜幕：塔或建造點變動時才重畫
    const sig = w.spots.map((s) => (s.tower ? s.tower.id : '-')).join(',');
    if (sig !== this.sig) {
      this.sig = sig;
      this.redraw();
    }
    // 英雄與士兵身上的光（同一張柔光貼圖、ADD 混色，一次批次就畫完）
    let n = 0;
    for (const s of w.soldiers) {
      if (!s.alive) continue;
      const hero = s.kind === 'hero';
      let g = this.glows[n];
      if (!g) {
        g = this.scene.add.image(0, 0, 'fx_soft').setTint(0xfff0c8).setBlendMode('ADD').setDepth(DEPTH.proj + 501);
        this.glows.push(g);
      }
      g.setVisible(true).setPosition(s.x, s.y - 14);
      g.setDisplaySize(hero ? 170 : 70, hero ? 130 : 54).setAlpha(hero ? 0.32 : 0.2);
      n++;
    }
    for (let i = n; i < this.glows.length; i++) this.glows[i].setVisible(false);
  }

  private redraw(): void {
    const w = this.world;
    const rt = this.rt;
    rt.clear();
    rt.fill(0x050a24, 0.72);
    const light = (x: number, y: number, r: number, a = 1) => {
      this.brush.setDisplaySize(r * 2 * RES, r * 1.6 * RES).setAlpha(a);
      rt.erase(this.brush, (x + PLAY_X0) * RES, y * RES);
    };
    for (const f of this.fixed) light(f.x, f.y, f.r);
    // 空建造點有小燈籠，晚上也找得到；蓋好的塔照亮周圍
    for (const s of w.spots) {
      if (s.tower) light(s.tower.x, s.tower.y - 20, 115);
      else light(s.x, s.y - 6, 48, 0.7);
    }
  }

  destroy(): void {
    this.rt.destroy();
    this.brush.destroy();
    this.glows.forEach((g) => g.destroy());
  }
}
