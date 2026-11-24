// 直射武器的彈道演出：每一種武器看起來不一樣（點放、掃射、霰彈、砲彈、磁軌、持續光束、電弧、衝擊波）。
// 只影響畫面：傷害還是模擬算好的數字。fire() 回傳的 Promise 在「打到目標」的時候結束，後面接命中的演出。
import Phaser from 'phaser';
import { TEX } from '../config';
import { sfx } from '../audio';
import type { ShotKind } from '../sim/types';
import { FX_DEPTH } from './fx';
import type { BattleFx } from './fx';
import { canvasTex } from './textures';

type V2 = Phaser.Math.Vector2;
const ADD = Phaser.BlendModes.ADD;

export interface ShotOpts {
  color: number;
  /** 技能打出來的：加強版（發數更多、光束更粗更久） */
  power?: boolean;
}

/** 開火時機體往後頓一下的幅度（像素） */
export const RECOIL: Record<ShotKind, number> = { pulse: 2, smg: 1.5, scatter: 6, cannon: 7, rail: 5, beam: 1.5, arc: 0, wave: 3 };

export class Shots {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: BattleFx,
    private readonly ms: (n: number) => number,
  ) {
    // 曳光彈：尾巴透明、頭是亮的（白色，使用時染色）
    canvasTex(scene, 'tracer', 64, 10, (g) => {
      const gr = g.createLinearGradient(0, 0, 64, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.85)');
      gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, 5);
      g.lineTo(52, 1);
      g.arc(59, 5, 4, -Math.PI / 2, Math.PI / 2);
      g.lineTo(52, 9);
      g.closePath();
      g.fill();
    });
    // 震波用的圈：線比 'ring' 粗，縮得很小的時候還看得到
    canvasTex(scene, 'hoop', 64, 64, (g) => {
      g.strokeStyle = '#fff';
      g.lineWidth = 13;
      g.beginPath();
      g.arc(32, 32, 24, 0, Math.PI * 2);
      g.stroke();
    });
  }

  fire(kind: ShotKind, a: V2, c: V2, o: ShotOpts): Promise<void> {
    switch (kind) {
      case 'pulse':
        return this.burst(a, c, o, o.power ? 6 : 3, 75, 46, 5, 0, 'laser');
      case 'smg':
        return this.burst(a, c, o, o.power ? 10 : 6, 42, 30, 3.5, 4, 'laser');
      case 'scatter':
        return this.scatter(a, c, o);
      case 'cannon':
        return this.shell(a, c, o);
      case 'rail':
        return this.rail(a, c, o);
      case 'beam':
        return this.beam(a, c, o);
      case 'arc':
        return this.arc(a, c, o);
      case 'wave':
        return this.wave(a, c, o);
    }
  }

  // ───────── 小工具 ─────────

  private wait(n: number): Promise<void> {
    return new Promise((ok) => this.scene.time.delayedCall(this.ms(n), () => ok()));
  }

  private deg(a: V2, c: V2): number {
    return Phaser.Math.RadToDeg(Math.atan2(c.y - a.y, c.x - a.x));
  }

  /** 一發曳光彈從 a 飛到 c（speed：每秒像素） */
  private bolt(a: V2, c: V2, color: number, len: number, thick: number, speed: number): Promise<void> {
    const s = this.scene;
    const ang = Math.atan2(c.y - a.y, c.x - a.x);
    const dist = Phaser.Math.Distance.Between(a.x, a.y, c.x, c.y);
    const mk = (tint: number, k: number): Phaser.GameObjects.Image =>
      s.add
        .image(a.x, a.y, 'tracer')
        .setOrigin(1, 0.5)
        .setRotation(ang)
        .setTint(tint)
        .setBlendMode(ADD)
        .setDepth(FX_DEPTH + 1)
        .setScale((len * k) / (64 * TEX), (thick * k) / (10 * TEX));
    const parts = [mk(color, 1), mk(0xffffff, 0.55)];
    return new Promise((ok) => {
      s.tweens.add({
        targets: parts,
        x: c.x,
        y: c.y,
        duration: this.ms(Math.max(50, (dist / speed) * 1000)),
        onComplete: () => {
          for (const p of parts) p.destroy();
          ok();
        },
      });
    });
  }

  /** 在 a→c 上畫一道光：外圈光暈、主體、白色的芯 */
  private streak(g: Phaser.GameObjects.Graphics, a: V2, c: V2, color: number, width: number, alpha = 1): void {
    g.lineStyle(width + 8, color, 0.22 * alpha);
    g.lineBetween(a.x, a.y, c.x, c.y);
    g.lineStyle(width, color, 0.95 * alpha);
    g.lineBetween(a.x, a.y, c.x, c.y);
    g.lineStyle(Math.max(1.5, width * 0.36), 0xffffff, alpha);
    g.lineBetween(a.x, a.y, c.x, c.y);
  }

  // ───────── 各種武器 ─────────

  /** 點放 / 掃射：幾發曳光彈接連打出去（spread：雙管武器左右交替的間距） */
  private async burst(a: V2, c: V2, o: ShotOpts, n: number, gap: number, len: number, thick: number, spread: number, sound: 'laser'): Promise<void> {
    const ang = Math.atan2(c.y - a.y, c.x - a.x);
    const px = -Math.sin(ang);
    const py = Math.cos(ang);
    const dir = this.deg(a, c);
    for (let i = 0; i < n; i++) {
      // 連發的聲音隔一發才響，不然疊在一起變成噪音
      if (n <= 3 || i % 2 === 0) sfx(sound);
      const off = spread ? (i % 2 ? spread : -spread) : 0;
      const from = new Phaser.Math.Vector2(a.x + px * off, a.y + py * off);
      const to = new Phaser.Math.Vector2(c.x + Phaser.Math.Between(-6, 6), c.y + Phaser.Math.Between(-9, 9));
      this.fx.flash(from.x, from.y, o.color, 0.42);
      const landed = this.bolt(from, to, o.color, len, thick, 1150).then(() => {
        this.fx.flash(to.x, to.y, 0xffffff, 0.32);
        this.fx.sparks(to.x, to.y, dir, 0xffe9b8, 3, 55);
      });
      if (i === n - 1) await landed;
      else await this.wait(gap);
    }
  }

  /** 霰彈：一次打出一片，扇形散開 */
  private async scatter(a: V2, c: V2, o: ShotOpts): Promise<void> {
    sfx('cannon');
    const dir = this.deg(a, c);
    this.fx.flash(a.x, a.y, 0xffd9a0, 1.3);
    this.fx.sparks(a.x, a.y, dir, 0xffd27a, 10, 24);
    this.fx.smoke(a.x, a.y, 1);
    const dist = Phaser.Math.Distance.Between(a.x, a.y, c.x, c.y);
    const n = o.power ? 11 : 7;
    const all: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const ang = Phaser.Math.DegToRad(dir + (i / (n - 1) - 0.5) * 22 + Phaser.Math.FloatBetween(-2, 2));
      const d = dist * Phaser.Math.FloatBetween(0.92, 1.08);
      const to = new Phaser.Math.Vector2(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d);
      all.push(this.bolt(a, to, o.color, 22, 3.5, 1700).then(() => this.fx.sparks(to.x, to.y, dir, 0xffe9b8, 2, 60)));
    }
    await Promise.all(all);
    this.fx.flash(c.x, c.y, 0xffffff, 0.7);
  }

  /** 加農砲：一發看得到的砲彈，拖著煙，打到會炸開 */
  private async shell(a: V2, c: V2, o: ShotOpts): Promise<void> {
    const s = this.scene;
    sfx('cannon');
    const dir = this.deg(a, c);
    this.fx.flash(a.x, a.y, 0xffd9a0, 1.5);
    this.fx.flash(a.x, a.y, 0xffffff, 0.8);
    this.fx.sparks(a.x, a.y, dir, 0xffd27a, 8, 28);
    this.fx.smoke(a.x, a.y, 2);
    const dist = Phaser.Math.Distance.Between(a.x, a.y, c.x, c.y);
    const head = s.add.image(a.x, a.y, 'glow').setTint(0xffe2b0).setScale(0.26).setBlendMode(ADD).setDepth(FX_DEPTH + 2);
    const tail = s.add
      .image(a.x, a.y, 'tracer')
      .setOrigin(1, 0.5)
      .setRotation(Math.atan2(c.y - a.y, c.x - a.x))
      .setTint(0xffb86a)
      .setBlendMode(ADD)
      .setDepth(FX_DEPTH + 1)
      .setScale(40 / (64 * TEX), 7 / (10 * TEX));
    let puff = 0;
    await new Promise<void>((ok) => {
      s.tweens.add({
        targets: [head, tail],
        x: c.x,
        y: c.y,
        duration: this.ms(Math.max(90, (dist / 1000) * 1000)),
        onUpdate: () => {
          if (++puff % 2 === 0) this.fx.trail(head.x, head.y);
        },
        onComplete: () => ok(),
      });
    });
    head.destroy();
    tail.destroy();
    const k = o.power ? 1.4 : 1;
    this.fx.flash(c.x, c.y, 0xffffff, 1.2 * k);
    this.fx.flash(c.x, c.y, 0xffa53a, 1.9 * k);
    this.fx.fire(c.x, c.y, Math.round(7 * k));
    this.fx.smoke(c.x, c.y, 2);
    this.fx.ring(c.x, c.y + 20, o.power ? 0xffe2b0 : 0xffc46a, 0.7 * k);
    s.cameras.main.shake(this.ms(120), 0.0026 * k);
  }

  /** 磁軌砲：先蓄能，然後瞬間貫穿的一道光，沿路留下幾圈震波 */
  private async rail(a: V2, c: V2, o: ShotOpts): Promise<void> {
    const s = this.scene;
    const ang = Math.atan2(c.y - a.y, c.x - a.x);
    // 蓄能：槍口一圈光收進來
    const charge = s.add.image(a.x, a.y, 'ring').setTint(o.color).setScale(0.55).setBlendMode(ADD).setDepth(FX_DEPTH + 2);
    this.fx.flash(a.x, a.y, o.color, 0.6);
    await new Promise<void>((ok) => s.tweens.add({ targets: charge, scale: 0.05, duration: this.ms(130), ease: 'Quad.easeIn', onComplete: () => ok() }));
    charge.destroy();
    sfx('rail');
    const w = o.power ? 10 : 6;
    const g = s.add.graphics().setDepth(FX_DEPTH + 1).setBlendMode(ADD);
    this.streak(g, a, c, o.color, w);
    this.fx.flash(a.x, a.y, 0xffffff, 1.3);
    s.cameras.main.shake(this.ms(130), o.power ? 0.004 : 0.003);
    // 震波：垂直於彈道的橢圓，一圈一圈放大
    const rings = o.power ? 7 : 5;
    for (let i = 0; i < rings; i++) {
      const t = 0.12 + (i / rings) * 0.8;
      const r = s.add
        .image(Phaser.Math.Linear(a.x, c.x, t), Phaser.Math.Linear(a.y, c.y, t), 'hoop')
        .setRotation(ang)
        .setTint(o.color)
        .setScale(0.04, 0.12)
        .setAlpha(0.9)
        .setBlendMode(ADD)
        .setDepth(FX_DEPTH + 1);
      s.tweens.add({ targets: r, scaleX: 0.13, scaleY: 0.42, alpha: 0, duration: this.ms(380), delay: this.ms(i * 22), ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }
    s.tweens.add({ targets: g, alpha: 0, duration: this.ms(320), delay: this.ms(90), onComplete: () => g.destroy() });
    this.fx.flash(c.x, c.y, 0xffffff, 1.4);
    this.fx.sparks(c.x, c.y, Phaser.Math.RadToDeg(ang), 0xffffff, 12, 30);
    await this.wait(70);
  }

  /** 持續光束：照著目標燒一小段時間，粗細和亮度會抖動，命中點一直噴火花 */
  private async beam(a: V2, c: V2, o: ShotOpts): Promise<void> {
    const s = this.scene;
    sfx('laser');
    const dir = this.deg(a, c);
    const w = o.power ? 7 : 4.5;
    const g = s.add.graphics().setDepth(FX_DEPTH + 1).setBlendMode(ADD);
    const glow = s.add.image(c.x, c.y, 'glow').setTint(o.color).setScale(0.5).setBlendMode(ADD).setDepth(FX_DEPTH + 2);
    let tick = 0;
    await new Promise<void>((ok) => {
      s.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.ms(o.power ? 420 : 300),
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          // 開頭很快變粗，結尾收細
          const env = Math.min(1, t * 6) * Math.min(1, (1 - t) * 5 + 0.25);
          g.clear();
          this.streak(g, a, c, o.color, w * env * Phaser.Math.FloatBetween(0.8, 1.2), 0.8 + Math.random() * 0.2);
          glow.setScale(0.4 + Math.random() * 0.25);
          if (++tick % 3 === 0) this.fx.sparks(c.x, c.y, dir + 180, 0xffe9b8, 2, 70);
        },
        onComplete: () => ok(),
      });
    });
    s.tweens.add({ targets: [g, glow], alpha: 0, duration: this.ms(110), onComplete: () => (g.destroy(), glow.destroy()) });
  }

  /** 電弧：一道會跳動的閃電 */
  private async arc(a: V2, c: V2, o: ShotOpts): Promise<void> {
    const s = this.scene;
    sfx('stun');
    const ang = Math.atan2(c.y - a.y, c.x - a.x);
    const px = -Math.sin(ang);
    const py = Math.cos(ang);
    const g = s.add.graphics().setDepth(FX_DEPTH + 1).setBlendMode(ADD);
    this.fx.flash(a.x, a.y, o.color, 0.5);
    const strikes = o.power ? 6 : 4;
    for (let k = 0; k < strikes; k++) {
      const pts: [number, number][] = [[a.x, a.y]];
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        const j = Phaser.Math.FloatBetween(-11, 11) * Math.sin(t * Math.PI);
        pts.push([Phaser.Math.Linear(a.x, c.x, t) + px * j, Phaser.Math.Linear(a.y, c.y, t) + py * j]);
      }
      pts.push([c.x, c.y]);
      g.clear();
      for (const [width, color, alpha] of [
        [7, o.color, 0.25],
        [3, o.color, 0.95],
        [1.4, 0xffffff, 1],
      ]) {
        g.lineStyle(width, color, alpha);
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokePath();
      }
      this.fx.sparks(c.x, c.y, -90, 0xffffff, 2, 180);
      await this.wait(48);
    }
    s.tweens.add({ targets: g, alpha: 0, duration: this.ms(120), onComplete: () => g.destroy() });
  }

  /** 衝擊波：幾圈波紋一路放大著推過去 */
  private async wave(a: V2, c: V2, o: ShotOpts): Promise<void> {
    const s = this.scene;
    sfx('rail');
    const ang = Math.atan2(c.y - a.y, c.x - a.x);
    const n = o.power ? 5 : 3;
    let last: Promise<void> = Promise.resolve();
    this.fx.flash(a.x, a.y, o.color, 0.7);
    for (let i = 0; i < n; i++) {
      // 一圈波紋，中間墊一團光，才看得出是一股力量推過去
      const r = s.add.image(a.x, a.y, 'hoop').setRotation(ang).setTint(o.color).setScale(0.07, 0.2).setBlendMode(ADD).setDepth(FX_DEPTH + 1);
      const body = s.add.image(a.x, a.y, 'glow').setRotation(ang).setTint(o.color).setScale(0.08, 0.2).setAlpha(0.55).setBlendMode(ADD).setDepth(FX_DEPTH + 1);
      s.tweens.add({ targets: body, x: c.x, y: c.y, scaleX: 0.2, scaleY: 0.6, alpha: 0.15, duration: this.ms(280), ease: 'Quad.easeIn', onComplete: () => body.destroy() });
      last = new Promise<void>((ok) =>
        s.tweens.add({ targets: r, x: c.x, y: c.y, scaleX: 0.2, scaleY: 0.62, duration: this.ms(280), ease: 'Quad.easeIn', onComplete: () => (r.destroy(), ok()) }),
      );
      if (i < n - 1) await this.wait(70);
    }
    await last;
    this.fx.flash(c.x, c.y, o.color, 1.3);
    this.fx.ring(c.x, c.y + 20, o.color, 0.8);
  }
}
