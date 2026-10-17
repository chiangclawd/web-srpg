import Phaser from 'phaser';
import { TEX, addText, fontPx } from '../config';
import { save } from '../save';

export const DEPTH = {
  bg: -1000,
  decal: -500,
  zone: -400,
  shadow: -300,
  rangeRing: -200,
  // 單位依 y 排序（0..720）
  proj: 5000,
  fx: 6000,
  hp: 7000,
  float: 8000,
  menu: 20000,
};

/**
 * 共用特效：粒子發射器在場景建立時建一次，之後 explode() 重用。
 */
export class Fx {
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private fire: Phaser.GameObjects.Particles.ParticleEmitter;
  private spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private heal: Phaser.GameObjects.Particles.ParticleEmitter;
  private star: Phaser.GameObjects.Particles.ParticleEmitter;
  private leaf: Phaser.GameObjects.Particles.ParticleEmitter;
  private holy: Phaser.GameObjects.Particles.ParticleEmitter;
  private poison: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = DEPTH.fx) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth);
      return e;
    };
    this.smoke = mk('fx_smoke', {
      lifespan: { min: 500, max: 900 },
      speed: { min: 20, max: 70 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.32, end: 0.7 },
      alpha: { start: 0.85, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: -30,
    });
    this.fire = mk('fx_fire', {
      lifespan: { min: 250, max: 500 },
      speed: { min: 40, max: 160 },
      scale: { start: 0.42, end: 0.08 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
    });
    this.spark = mk('fx_spark', {
      lifespan: { min: 150, max: 350 },
      speed: { min: 60, max: 180 },
      scale: { start: 0.5, end: 0 },
      blendMode: 'ADD',
    });
    this.debris = mk('fx_debris', {
      lifespan: { min: 500, max: 800 },
      speed: { min: 80, max: 200 },
      angle: { min: 200, max: 340 },
      gravityY: 520,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.3, max: 0.55 },
    });
    this.snow = mk('fx_snow', {
      lifespan: { min: 500, max: 900 },
      speed: { min: 30, max: 140 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
    });
    this.heal = mk('fx_heal', {
      lifespan: 800,
      speedY: { min: -60, max: -30 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.5, end: 0.25 },
      alpha: { start: 1, end: 0 },
    });
    this.star = mk('fx_star', {
      lifespan: 600,
      speed: { min: 40, max: 110 },
      angle: { min: 200, max: 340 },
      gravityY: 160,
      scale: { start: 0.42, end: 0.12 },
      rotate: { min: 0, max: 360 },
    });
    this.leaf = mk('fx_leaf', {
      lifespan: 900,
      speed: { min: 20, max: 70 },
      gravityY: 40,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.35, max: 0.55 },
      alpha: { start: 1, end: 0 },
    });
    this.holy = mk('fx_spark', {
      lifespan: 700,
      speed: { min: 30, max: 120 },
      tint: 0xffe08a,
      scale: { start: 0.65, end: 0 },
      blendMode: 'ADD',
    });
    this.poison = mk('fx_soft', {
      lifespan: 600,
      speedY: { min: -40, max: -15 },
      speedX: { min: -10, max: 10 },
      tint: 0x7aff4a,
      scale: { start: 0.18, end: 0.05 },
      alpha: { start: 0.8, end: 0 },
    });
  }

  explosion(x: number, y: number, r: number, kind: string): void {
    const s = this.scene;
    const big = kind === 'meteor' || kind === 'missile' || r > 70;
    if (kind === 'holy') {
      this.ring(x, y, r, 0xffe08a, 380);
      this.holy.explode(18, x, y - 10);
      return;
    }
    if (kind === 'nova') {
      this.ring(x, y, r, 0x9ae0ff, 420);
      this.snow.explode(26, x, y - 8);
      return;
    }
    if (kind === 'shock') {
      this.ring(x, y, r, 0x7ac8ff, 300);
      this.spark.explode(14, x, y - 6);
      return;
    }
    // 爆炸：閃光 + 火球 + 煙 + 碎石 + 地面焦痕
    const flash = s.add.image(x, y - 10, 'fx_soft').setDepth(DEPTH.fx).setTint(0xffd27a).setBlendMode('ADD');
    flash.setScale((r / 32) * 0.6);
    s.tweens.add({ targets: flash, scale: (r / 32) * 1.3, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    this.fire.explode(big ? 22 : 12, x, y - 8);
    this.smoke.explode(big ? 10 : 6, x, y - 6);
    this.debris.explode(big ? 10 : 5, x, y);
    const crack = s.add.image(x, y, 'fx_crack').setDepth(DEPTH.decal).setScale((r / 48) * (1 / TEX) * 1.1);
    crack.setAlpha(0.85);
    s.tweens.add({ targets: crack, alpha: 0, delay: 2200, duration: 1200, onComplete: () => crack.destroy() });
    if (big) camShake(s, 180, 0.006);
    else if (kind === 'bomb') camShake(s, 90, 0.0025);
  }

  ring(x: number, y: number, r: number, color: number, dur: number): void {
    const g = this.scene.add.image(x, y, 'fx_ring').setDepth(DEPTH.fx).setTint(color).setBlendMode('ADD');
    g.setScale(0.1);
    g.scaleY = 0.07;
    this.scene.tweens.add({
      targets: g,
      scaleX: (r * 2) / 128,
      scaleY: ((r * 2) / 128) * 0.72,
      alpha: 0,
      duration: dur,
      ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  hitSpark(x: number, y: number, n = 4): void {
    this.spark.explode(n, x, y);
  }

  meleeHit(x: number, y: number, heavy: boolean): void {
    this.spark.explode(heavy ? 8 : 3, x, y);
    if (heavy) this.debris.explode(4, x, y + 10);
  }

  rubble(x: number, y: number, n = 6): void {
    this.debris.explode(n, x, y);
  }

  smokePuff(x: number, y: number, n = 6): void {
    this.smoke.explode(n, x, y);
  }

  healFx(x: number, y: number): void {
    this.heal.explode(3, x, y - 20);
  }

  stars(x: number, y: number, n = 5): void {
    this.star.explode(n, x, y);
  }

  leaves(x: number, y: number): void {
    this.leaf.explode(6, x, y);
  }

  snowBurst(x: number, y: number, n = 10): void {
    this.snow.explode(n, x, y);
  }

  poisonPuff(x: number, y: number): void {
    this.poison.explode(2, x, y);
  }

  fireBurst(x: number, y: number, n = 6): void {
    this.fire.explode(n, x, y);
  }

  /** 漂浮文字（金幣、提示） */
  private textPool: Phaser.GameObjects.Text[] = [];

  floatText(x: number, y: number, text: string, color = '#ffe066', size = 18): void {
    let t = this.textPool.pop();
    if (!t) t = addText(this.scene, x, y, text, { size, color, display: true }).setOrigin(0.5).setDepth(DEPTH.float);
    else {
      const px = fontPx(size);
      t.setText(text).setColor(color).setFontSize(px).setStroke('#2a1708', Math.max(2, Math.round(px / 6)));
      t.setPosition(x, y).setVisible(true).setAlpha(1);
    }
    t.setScale(0.6);
    const tt = t;
    this.scene.tweens.add({ targets: tt, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: tt,
      y: y - 34,
      alpha: 0,
      delay: 350,
      duration: 650,
      onComplete: () => {
        tt.setVisible(false);
        if (this.textPool.length < 40) this.textPool.push(tt);
        else tt.destroy();
      },
    });
  }

  lightning(pts: { x: number; y: number }[]): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx).setBlendMode('ADD');
    const draw = (w: number, color: number, a: number) => {
      g.lineStyle(w, color, a);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const a0 = pts[i - 1];
        const a1 = pts[i];
        const segs = 5;
        for (let k = 1; k <= segs; k++) {
          const t = k / segs;
          const jx = k === segs ? 0 : (Math.random() - 0.5) * 14;
          const jy = k === segs ? 0 : (Math.random() - 0.5) * 14;
          g.lineTo(a0.x + (a1.x - a0.x) * t + jx, a0.y + (a1.y - a0.y) * t + jy);
        }
      }
      g.strokePath();
    };
    draw(7, 0x3a8aff, 0.5);
    draw(2.5, 0xe8f6ff, 1);
    for (let i = 1; i < pts.length; i++) this.spark.explode(3, pts[i].x, pts[i].y);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  beam(x1: number, y1: number, x2: number, y2: number, color: number, core: number): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx).setBlendMode('ADD');
    g.lineStyle(14, color, 0.45);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(5, core, 1);
    g.lineBetween(x1, y1, x2, y2);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
    this.spark.explode(10, x2, y2);
  }
}

/** 畫面震動（可在設定中關閉） */
export function camShake(scene: Phaser.Scene, ms: number, k: number): void {
  if (save().settings.shake) scene.cameras.main.shake(ms, k);
}
