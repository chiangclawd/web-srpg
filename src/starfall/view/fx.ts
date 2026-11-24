// 戰場的氣氛與特效：
//   - 地面：高低差的陰影、導管的光、棋盤底部的霧、環境粒子（飄雪 / 塵埃 / 火星）、畫面四角壓暗
//   - 粒子：火花、火焰、煙
//   - 擊破：連環小爆 → 主爆 → 機體碎成幾塊飛散，下半身落地變成殘骸留在場上，地上一塊焦痕
// 用到的紋理第一次進戰場時用 Canvas 畫一次，不需要圖檔。
import Phaser from 'phaser';
import { TEX } from '../config';
import { sfx } from '../audio';
import { TH, TW, isoX, isoY, tileDepth } from './iso';
import { canvasTex } from './textures';
import type { UnitView } from './UnitView';

export const FX_DEPTH = 100000;

type Ctx = CanvasRenderingContext2D;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
export type Theme = 'ice' | 'hull' | 'bay' | 'reactor' | 'field';

export interface GroundInfo {
  w: number;
  h: number;
  /** 這一格頂面的高度（艙壁算到牆頂）；裂谷回傳 null */
  top: (x: number, y: number) => number | null;
  /** 這一格是不是會發光的導管 */
  glow: (x: number, y: number) => boolean;
  /** 這一格開戰前就有一塊焦痕（戰場主題的冰面，零星幾處） */
  scar?: (x: number, y: number) => boolean;
  theme: Theme;
  bounds: Phaser.Geom.Rectangle;
}

/** 霧和環境粒子的顏色 */
const AIR: Record<Theme, number> = { ice: 0xcfe8f6, field: 0xcfe8f6, hull: 0x7fa0c4, bay: 0x8fb0cc, reactor: 0xffa66a };
/** 導管格柵的光暈：跟那個主題的地塊上畫的燈同一個顏色 */
const CONDUIT: Record<Theme, number> = { ice: 0x3fd6ff, hull: 0x3fd6ff, bay: 0x58f0d2, reactor: 0xff8a2a, field: 0xffd27a };

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

function makeFxTextures(scene: Phaser.Scene): void {
  // 高低差的陰影（白色，使用時染成深藍）。
  // 漸層要跟格子的邊平行：等角投影下，跟 u = 常數的邊垂直、走一整格的位移是 (TW/5, TW*2/5)，v 那邊是 (-TW/5, TW*2/5)
  const fall = (g: Ctx, dx: number, dy: number, stops: [number, number][]): void => {
    g.beginPath();
    g.moveTo(TW / 2, 0);
    g.lineTo(TW, TH / 2);
    g.lineTo(TW / 2, TH);
    g.lineTo(0, TH / 2);
    g.closePath();
    g.clip();
    const gr = g.createLinearGradient(TW / 2, 0, TW / 2 + dx, dy);
    for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, TW, TH);
  };
  canvasTex(scene, 'sh_cast', TW, TH, (g) =>
    fall(g, (TW / 5) * 0.85, ((TW * 2) / 5) * 0.85, [
      [0, 1],
      [0.3, 0.62],
      [1, 0],
    ]),
  );
  canvasTex(scene, 'sh_ao', TW, TH, (g) =>
    fall(g, (-TW / 5) * 0.4, ((TW * 2) / 5) * 0.4, [
      [0, 1],
      [0.4, 0.45],
      [1, 0],
    ]),
  );
  // 焦痕：幾團深色疊起來，加上放射狀的燒痕
  canvasTex(scene, 'scorch', TW, TH, (g) => {
    const r = seeded(7);
    g.translate(TW / 2, TH / 2);
    g.scale(1, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 13;
      const rad = 12 + r() * 15;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 1, x, y, rad);
      gr.addColorStop(0, 'rgba(6,6,9,0.5)');
      gr.addColorStop(1, 'rgba(6,6,9,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(6,6,9,0.3)';
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = r() * Math.PI * 2;
      const r0 = 8 + r() * 6;
      const r1 = 24 + r() * 16;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.stroke();
    }
  });
  // 煙：幾團柔邊的圓疊成不規則的形狀（白色，使用時染色）
  canvasTex(scene, 'smoke', 64, 64, (g) => {
    const r = seeded(3);
    for (let i = 0; i < 7; i++) {
      const x = 32 + (r() - 0.5) * 24;
      const y = 32 + (r() - 0.5) * 24;
      const rad = 10 + r() * 10;
      const gr = g.createRadialGradient(x, y, 1, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
  });
  canvasTex(scene, 'mist', 256, 96, (g) => {
    g.translate(128, 48);
    g.scale(1, 0.375);
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, 126);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 126, 0, Math.PI * 2);
    g.fill();
  });
  canvasTex(scene, 'vignette', 256, 144, (g) => {
    g.translate(128, 72);
    g.scale(1, 144 / 256);
    // 只壓最外圈：畫面拉近時棋盤會佔滿畫面，壓太多格子會看不清楚
    const gr = g.createRadialGradient(0, 0, 96, 0, 0, 158);
    gr.addColorStop(0, 'rgba(3,7,16,0)');
    gr.addColorStop(0.6, 'rgba(3,7,16,0.12)');
    gr.addColorStop(1, 'rgba(3,7,16,0.42)');
    g.fillStyle = gr;
    g.fillRect(-128, -128, 256, 256);
  });
}

export class BattleFx {
  private readonly sparkE: Emitter;
  private readonly fireE: Emitter;
  private readonly smokeE: Emitter;
  private readonly wispE: Emitter;
  private sparkDir = -90;
  private sparkSpread = 180;
  private sparkTint = 0xffe2a0;
  private vignette: Phaser.GameObjects.Image | null = null;
  private nextWisp = 0;

  /** ms：演出時間（毫秒）換算，快速模式會縮短 */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ms: (n: number) => number,
  ) {
    makeFxTextures(scene);
    const smokeTint = [0x2a2f38, 0x3a404c, 0x1c2028];
    this.smokeE = scene.add
      .particles(0, 0, 'smoke', {
        emitting: false,
        lifespan: { min: 900, max: 1700 },
        speedX: { min: -26, max: 26 },
        speedY: { min: -70, max: -24 },
        scale: { start: 0.25, end: 0.85 },
        alpha: { start: 0.55, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: smokeTint,
        gravityY: -18,
      })
      .setDepth(FX_DEPTH);
    // 受損的機體冒的煙：比較細、比較淡，才不會蓋住耐久條
    this.wispE = scene.add
      .particles(0, 0, 'smoke', {
        emitting: false,
        lifespan: { min: 700, max: 1100 },
        speedX: { min: -10, max: 10 },
        speedY: { min: -46, max: -22 },
        scale: { start: 0.1, end: 0.38 },
        alpha: { start: 0.34, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: smokeTint,
      })
      .setDepth(FX_DEPTH);
    this.fireE = scene.add
      .particles(0, 0, 'glow', {
        emitting: false,
        lifespan: { min: 320, max: 640 },
        speed: { min: 20, max: 120 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.55, end: 0.08 },
        alpha: { start: 0.95, end: 0 },
        color: [0xfff3c4, 0xffb23a, 0xff5a1e, 0x3a1c14],
        colorEase: 'quad.out',
        gravityY: -120,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(FX_DEPTH + 1);
    this.sparkE = scene.add
      .particles(0, 0, 'glow', {
        emitting: false,
        lifespan: { min: 260, max: 560 },
        speed: { min: 90, max: 320 },
        angle: { onEmit: () => this.sparkDir + Phaser.Math.FloatBetween(-this.sparkSpread, this.sparkSpread) },
        scale: { start: 0.14, end: 0 },
        alpha: { start: 1, end: 0.2 },
        tint: { onEmit: () => this.sparkTint },
        gravityY: 520,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(FX_DEPTH + 2);
  }

  // ───────── 地面與氣氛 ─────────

  ground(info: GroundInfo): void {
    const s = this.scene;
    const { w, h, top } = info;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = top(x, y);
        if (t === null) continue;
        const px = isoX(x, y);
        const py = isoY(x, y, t);
        const shade = (tex: string, alpha: number): void => {
          s.add
            .image(px, py, tex)
            .setScale(1 / TEX)
            .setTint(0x040c1c)
            .setAlpha(alpha)
            .setDepth(tileDepth(x, y) + 0.4);
        };
        // 光從畫面左邊來：左上（x-1）的鄰格比較高，影子蓋到這一格；右上（y-1）比較高，只在牆腳留一道暗邊
        const a = x > 0 ? top(x - 1, y) : null;
        if (a !== null && a > t) shade('sh_cast', Math.min(0.52, 0.26 + 0.1 * (a - t)));
        const b = y > 0 ? top(x, y - 1) : null;
        if (b !== null && b > t) shade('sh_ao', Math.min(0.48, 0.24 + 0.1 * (b - t)));
        if (info.scar?.(x, y)) {
          // 打過仗的痕跡：跟擊破留下的焦痕同一張圖，大小、左右、深淺各不相同，才不會看起來像蓋章
          const k = ((x * 31 + y * 17) % 7) / 6;
          s.add
            .image(px, py, 'scorch')
            .setScale((0.7 + k * 0.45) / TEX)
            .setFlipX((x + y) % 2 === 0)
            .setAlpha(0.3 + k * 0.3)
            .setDepth(tileDepth(x, y) + 0.45);
        }
        if (info.glow(x, y)) {
          // 導管的光暈：慢慢明滅
          const im = s.add
            .image(px, py, 'glow')
            .setScale(0.9, 0.45)
            .setTint(CONDUIT[info.theme])
            .setAlpha(0.16)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(tileDepth(x, y) + 0.5);
          s.tweens.add({ targets: im, alpha: 0.42, duration: 1300 + ((x * 7 + y * 13) % 5) * 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        // 棋盤前緣（最靠近鏡頭的兩條邊）底下的霧：每隔一格放一團，慢慢左右飄
        const front = (x === w - 1 || top(x + 1, y) === null) && (x + y) % 2 === 0;
        const left = (y === h - 1 || top(x, y + 1) === null) && (x + y) % 2 === 1;
        if (front || left) {
          const k = 0.9 + ((x * 5 + y * 3) % 4) * 0.12;
          const im = s.add
            .image(px + (front ? 26 : -26), py + 96, 'mist')
            .setScale(k / TEX)
            .setTint(AIR[info.theme])
            .setAlpha(0.1)
            .setDepth(tileDepth(x, y) + 8);
          s.tweens.add({ targets: im, x: im.x + (front ? 18 : -18), alpha: 0.2, duration: 3600 + ((x * 3 + y * 7) % 5) * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      }
    }
    this.ambient(info.theme, info.bounds);
    this.vignette = s.add
      .image(0, 0, 'vignette')
      .setScrollFactor(0)
      .setDepth(FX_DEPTH + 50);
    this.update(0, []);
  }

  /** 環境粒子：冰原飄雪、反應爐有火星往上飄、船艙裡是浮塵 */
  private ambient(theme: Theme, bounds: Phaser.Geom.Rectangle): void {
    const s = this.scene;
    const zone = new Phaser.Geom.Rectangle(bounds.x - 160, bounds.y - 140, bounds.width + 320, bounds.height + 300);
    const count = (per: number, lo: number, hi: number): number => Phaser.Math.Clamp(Math.round((zone.width * zone.height) / per), lo, hi);
    if (theme === 'ice' || theme === 'field') {
      const life = (zone.height / 52) * 1000;
      s.add
        .particles(0, 0, 'glow', {
          x: { min: zone.left, max: zone.right + 260 },
          y: zone.top,
          lifespan: life,
          speedX: { min: -48, max: -14 },
          speedY: { min: 36, max: 70 },
          scale: { min: 0.035, max: 0.1 },
          alpha: { start: 0.85, end: 0, ease: 'Cubic.easeIn' },
          frequency: life / count(13000, 40, 120),
          advance: life,
        })
        .setDepth(FX_DEPTH - 5);
    } else if (theme === 'reactor') {
      const life = 7000;
      s.add
        .particles(0, 0, 'glow', {
          x: { min: zone.left, max: zone.right },
          y: { min: zone.centerY, max: zone.bottom },
          lifespan: life,
          speedX: { min: -10, max: 10 },
          speedY: { min: -52, max: -20 },
          scale: { min: 0.03, max: 0.075 },
          alpha: { onUpdate: (_p: unknown, _k: unknown, t: number) => Math.sin(t * Math.PI) * 0.8 },
          tint: AIR.reactor,
          blendMode: Phaser.BlendModes.ADD,
          frequency: life / count(26000, 24, 60),
          advance: life,
        })
        .setDepth(FX_DEPTH - 5);
    } else {
      const life = 6500;
      s.add
        .particles(0, 0, 'glow', {
          x: { min: zone.left, max: zone.right },
          y: { min: zone.top, max: zone.bottom },
          lifespan: life,
          speed: { min: 4, max: 15 },
          angle: { min: 0, max: 360 },
          scale: { min: 0.025, max: 0.06 },
          alpha: { onUpdate: (_p: unknown, _k: unknown, t: number) => Math.sin(t * Math.PI) * 0.38 },
          tint: AIR[theme],
          frequency: life / count(22000, 26, 70),
          advance: life,
        })
        .setDepth(FX_DEPTH - 5);
    }
  }

  /** 每格更新：四角壓暗固定在畫面上（不跟著鏡頭縮放）；耐久剩三分之一以下的機體冒煙 */
  update(time: number, views: Iterable<UnitView>): void {
    const cam = this.scene.cameras.main;
    this.vignette?.setPosition(cam.width / 2, cam.height / 2).setScale(cam.width / (256 * TEX) / cam.zoom, cam.height / (144 * TEX) / cam.zoom);
    if (time < this.nextWisp) return;
    this.nextWisp = time + 300;
    for (const v of views) {
      const u = v.unit;
      if (!u.alive || v.hp <= 0 || v.hp / u.maxHp > 0.34 || !v.root.visible) continue;
      const c = v.center();
      this.wispE.explode(1, c.x + Phaser.Math.Between(-9, 9), c.y - v.tall * 0.12);
      if (Math.random() < 0.22) this.sparks(c.x + Phaser.Math.Between(-10, 10), c.y + Phaser.Math.Between(-10, 10), -90, 0xffd27a, 2, 70);
    }
  }

  // ───────── 粒子 ─────────

  /** 火花：往 dir（度，0 = 右、90 = 下）左右 spread 度噴出去 */
  sparks(x: number, y: number, dir: number, tint = 0xffe2a0, n = 9, spread = 40): void {
    this.sparkDir = dir;
    this.sparkSpread = spread;
    this.sparkTint = tint;
    this.sparkE.explode(n, x, y);
  }

  fire(x: number, y: number, n = 8): void {
    this.fireE.explode(n, x, y);
  }

  smoke(x: number, y: number, n = 1): void {
    this.smokeE.explode(n, x, y);
  }

  /** 砲彈拖的一縷煙 */
  trail(x: number, y: number): void {
    this.wispE.explode(1, x, y);
  }

  /** 一閃：加亮的光球，放大同時淡出 */
  flash(x: number, y: number, tint: number, size: number): void {
    const im = this.scene.add
      .image(x, y, 'glow')
      .setTint(tint)
      .setScale(size * 0.3)
      .setDepth(FX_DEPTH + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: im, scale: size * 1.1, alpha: 0, duration: this.ms(280), ease: 'Quad.easeOut', onComplete: () => im.destroy() });
  }

  /** 地面的衝擊波 */
  ring(x: number, y: number, tint: number, size = 1): void {
    const im = this.scene.add
      .image(x, y, 'ring')
      .setTint(tint)
      .setScale(0.2 * size, 0.1 * size)
      .setDepth(FX_DEPTH);
    this.scene.tweens.add({ targets: im, scaleX: 1.7 * size, scaleY: 0.85 * size, alpha: 0, duration: this.ms(440), ease: 'Quad.easeOut', onComplete: () => im.destroy() });
  }

  /** 命中：火花順著射擊方向噴出去，重擊再加一點鏡頭震動 */
  hit(x: number, y: number, dir: number, heavy: boolean): void {
    this.sparks(x, y, dir, 0xffe9b8, heavy ? 14 : 8, 55);
    this.sparks(x, y, dir + 180, 0xffd27a, heavy ? 5 : 3, 50);
    if (heavy) this.scene.cameras.main.shake(this.ms(110), 0.0024);
  }

  // ───────── 擊破 ─────────

  /** 機體被擊破的演出。演完之後圖像已經藏起來，呼叫的人再把 UnitView 銷毀 */
  async destroy(v: UnitView): Promise<void> {
    const s = this.scene;
    const sp = v.sprite;
    const boss = !!v.unit.def.boss;
    const small = v.tall < 60;
    const c = v.center();
    const wait = (n: number): Promise<void> => new Promise((ok) => s.time.delayedCall(this.ms(n), () => ok()));

    // 有骨架的機體先癱下去（膝蓋一軟、往前倒），爆炸是從癱倒的姿勢炸開
    const slump = v.frames('down') > 1;
    if (slump) v.play('down');
    // 一、連環小爆：機體抖動，身上到處冒火
    const shake = s.tweens.add({ targets: sp, x: { from: -2.5, to: 2.5 }, duration: 40, yoyo: true, repeat: -1 });
    const pops = boss ? 6 : small ? 1 : slump ? 5 : 3;
    for (let i = 0; i < pops; i++) {
      const x = c.x + Phaser.Math.Between(-16, 16);
      const y = c.y + Phaser.Math.Between(-v.tall * 0.3, v.tall * 0.3);
      if (i) sfx('hit');
      this.flash(x, y, 0xffc46a, 0.8);
      this.sparks(x, y, -90, 0xffd27a, 7, 150);
      this.fire(x, y, 3);
      sp.setTintFill(0xffffff);
      s.time.delayedCall(45, () => sp.active && sp.setTint(0xff9a5a));
      await wait(boss ? 140 : 100);
    }
    shake.stop();
    sp.x = 0;

    // 二、主爆
    sfx('boom');
    const k = boss ? 1.7 : small ? 0.65 : 1;
    s.cameras.main.shake(this.ms(boss ? 420 : 220), boss ? 0.011 : small ? 0.003 : 0.0055);
    this.flash(c.x, c.y, 0xffffff, 2.4 * k);
    this.flash(c.x, c.y, 0xffa53a, 3.4 * k);
    this.fire(c.x, c.y, Math.round(16 * k));
    this.smoke(c.x, c.y, Math.round(7 * k));
    this.sparks(c.x, c.y, -90, 0xffe2a0, Math.round(22 * k), 180);
    this.ring(v.root.x, v.root.y, 0xffc46a, 1.2 * k);

    // 三、焦痕、碎片、餘煙
    const ground = v.root.depth - 5;
    const mark = s.add
      .image(v.root.x, v.root.y, 'scorch')
      .setScale((small ? 0.8 : boss ? 1.25 : 1.05) / TEX)
      .setAlpha(0)
      .setDepth(ground + 0.6);
    s.tweens.add({ targets: mark, alpha: 0.9, duration: 180 });
    this.shatter(v, ground + 0.7);
    v.root.setVisible(false);
    const x0 = v.root.x;
    const y0 = v.root.y;
    s.time.addEvent({ delay: 230, repeat: boss ? 26 : 14, callback: () => this.wispE.explode(1, x0 + Phaser.Math.Between(-12, 12), y0 - 8) });
    await wait(460);
  }

  /**
   * 把機體的圖像切成幾塊飛出去。上面那一排飛得遠、在半空中淡掉；其餘落在自己的格子上，變暗、壓扁，留著當殘骸。
   * 每一塊都是同一張圖表裁出來的（setCrop），原點設在那一塊的中心，旋轉才會繞著自己轉。
   * 圖像有水平翻轉的話改用負的 scaleX：裁切跟翻轉一起用時，Phaser 取的區域跟畫出來的位置對不起來。
   */
  private shatter(v: UnitView, restDepth: number): void {
    const s = this.scene;
    const sp = v.sprite;
    const f = sp.frame;
    const W = f.realWidth;
    const H = f.realHeight;
    // 圖表的格子裁掉了透明邊：x / y / width / height 是實際有圖的範圍
    const box = { x: f.x, y: f.y, w: f.width, h: f.height };
    const sx = sp.scaleX * (sp.flipX ? -1 : 1);
    const sy = sp.scaleY;
    const ox = v.root.x + sp.x;
    const oy = v.root.y + sp.y;
    const cols = 2;
    const rows = v.tall < 60 ? 2 : 3;
    const w = box.w / cols;
    const h = box.h / rows;
    const G = 900;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = box.x + (c + 0.5) * w;
        const cy = box.y + (r + 0.5) * h;
        const x0 = ox + (cx - W * sp.originX) * sx;
        const y0 = oy + (cy - H * sp.originY) * sy;
        const im = s.add
          .image(x0, y0, sp.texture.key, f.name)
          .setOrigin(cx / W, cy / H)
          .setScale(sx, sy)
          .setCrop(box.x + c * w, box.y + r * h, w, h)
          .setDepth(FX_DEPTH - 1);
        const side = x0 >= v.root.x ? 1 : -1;
        const stay = r > 0;
        // 落點：留下來的落在自己這一格裡，飛走的往外拋
        const lx = stay ? v.root.x + side * Phaser.Math.Between(4, 24) : x0 + side * Phaser.Math.Between(70, 150);
        const ly = stay ? v.root.y + Phaser.Math.Between(-8, 7) : v.root.y + Phaser.Math.Between(10, 50);
        const T = stay ? Phaser.Math.FloatBetween(0.5, 0.72) : Phaser.Math.FloatBetween(0.62, 0.8);
        const vx = (lx - x0) / T;
        const vy = (ly - y0 - 0.5 * G * T * T) / T;
        const spin = Phaser.Math.FloatBetween(2.5, 6.5) * side;
        s.tweens.addCounter({
          from: 0,
          to: T,
          duration: this.ms(T * 1000),
          onUpdate: (tw) => {
            const t = tw.getValue() ?? 0;
            im.setPosition(x0 + vx * t, y0 + vy * t + 0.5 * G * t * t);
            im.rotation = spin * t;
            if (!stay) im.setAlpha(1 - Math.max(0, t / T - 0.55) / 0.45);
          },
          onComplete: () => {
            if (!stay) {
              im.destroy();
              return;
            }
            // 落地：變成地上的殘骸（排在範圍標示和單位底下）
            im.setPosition(lx, ly)
              .setDepth(restDepth)
              .setTint(0x5a626e)
              .setScale(sx * 0.9, sy * 0.72);
            s.tweens.add({ targets: im, y: ly - 4, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
            this.wispE.explode(1, lx, ly - 4);
            // 餘燼：一點橘色的光，慢慢熄掉
            const ember = s.add
              .image(lx, ly - 2, 'glow')
              .setTint(0xff7a2a)
              .setScale(0.22, 0.12)
              .setAlpha(0.7)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(restDepth + 0.05);
            s.tweens.add({ targets: ember, alpha: 0, duration: 2600 + Phaser.Math.Between(0, 1400), onComplete: () => ember.destroy() });
          },
        });
      }
    }
  }
}
