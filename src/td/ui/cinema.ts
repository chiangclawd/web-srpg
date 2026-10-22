import Phaser from 'phaser';
import { VIEW_H, viewW } from '../config';
import { Puppet } from '../view/Puppet';
import { STORY_ART, type StoryAtmos } from '../data/story';

/** 劇情插畫的貼圖 key */
export const storyArtKey = (id: string): string => `story_${id}`;

/**
 * 需要時才載入劇情插畫（每張一百多 KB，不放進開機載入）。
 * 沒有插畫、離線載不到都直接回呼 null，劇情改用一般對話框。
 */
export function loadStoryArt(scene: Phaser.Scene, id: string, cb: (key: string | null) => void): void {
  if (!STORY_ART[id]) {
    cb(null);
    return;
  }
  const key = storyArtKey(id);
  if (scene.textures.exists(key)) {
    cb(key);
    return;
  }
  let settled = false;
  const finish = (ok: boolean): void => {
    if (settled) return;
    settled = true;
    scene.load.off('filecomplete-image-' + key);
    scene.load.off('loaderror', onError);
    cb(ok && scene.textures.exists(key) ? key : null);
  };
  const onError = (file: Phaser.Loader.File): void => {
    if (file.key === key) finish(false);
  };
  scene.load.once('filecomplete-image-' + key, () => finish(true));
  scene.load.on('loaderror', onError);
  scene.load.image(key, `assets/story/${id}.webp`);
  scene.load.start();
  // 網路很慢時不要讓玩家乾等：4 秒內沒載完就先用一般對話框
  scene.time.delayedCall(4000, () => finish(false));
}

const ATMOS: Record<StoryAtmos, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig & { tex: string }> = {
  leaves: { tex: 'fx_petal', lifespan: 7000, speedX: { min: -40, max: -10 }, speedY: { min: 25, max: 60 }, rotate: { min: 0, max: 360 }, scale: { min: 0.45, max: 0.8 }, alpha: { start: 0.95, end: 0.6 }, tint: [0xd8402a, 0xe86a2a, 0xc0301a, 0xf09a40], frequency: 240 },
  snow: { tex: 'fx_snow', lifespan: 8000, speedX: { min: -50, max: -5 }, speedY: { min: 30, max: 80 }, scale: { min: 0.25, max: 0.7 }, alpha: { start: 0.9, end: 0.4 }, frequency: 70 },
  blizzard: { tex: 'fx_snow', lifespan: 4000, speedX: { min: -260, max: -140 }, speedY: { min: 60, max: 140 }, scale: { min: 0.25, max: 0.8 }, alpha: { start: 0.9, end: 0.3 }, frequency: 25 },
  embers: { tex: 'fx_spark', lifespan: 5000, speedX: { min: -20, max: 30 }, speedY: { min: -90, max: -30 }, scale: { start: 0.5, end: 0.1 }, alpha: { start: 1, end: 0 }, tint: [0xffb040, 0xff6a20, 0xffe080], blendMode: 'ADD', frequency: 90 },
  sand: { tex: 'fx_soft', lifespan: 4500, speedX: { min: -160, max: -80 }, speedY: { min: -10, max: 20 }, scale: { min: 0.05, max: 0.14 }, alpha: { start: 0.55, end: 0 }, tint: 0xe8c890, frequency: 60 },
  ghost: { tex: 'fx_soft', lifespan: 5000, speedX: { min: -15, max: 15 }, speedY: { min: -40, max: -15 }, scale: { start: 0.12, end: 0.02 }, alpha: { start: 0.9, end: 0 }, tint: [0x7affa0, 0x9affd8], blendMode: 'ADD', frequency: 140 },
  motes: { tex: 'fx_soft', lifespan: 6000, speedX: { min: -12, max: 12 }, speedY: { min: -18, max: 6 }, scale: { start: 0.07, end: 0.02 }, alpha: { start: 0.7, end: 0 }, tint: 0xfff0c0, blendMode: 'ADD', frequency: 180 },
  dark: { tex: 'fx_soft', lifespan: 5000, speedX: { min: -25, max: 25 }, speedY: { min: -50, max: -15 }, scale: { start: 0.14, end: 0.03 }, alpha: { start: 0.8, end: 0 }, tint: [0xb070ff, 0x7a30d0], blendMode: 'ADD', frequency: 120 },
  petals: { tex: 'fx_petal', lifespan: 7000, speedX: { min: -30, max: 30 }, speedY: { min: 20, max: 55 }, rotate: { min: 0, max: 360 }, scale: { min: 0.4, max: 0.7 }, tint: [0xffb0c8, 0xffe070, 0x90d0ff, 0xffffff], frequency: 120 },
};

/** 白色葉片 / 花瓣（粒子再上色；綠葉貼圖染成紅色會變髒） */
function ensurePetal(scene: Phaser.Scene): void {
  if (scene.textures.exists('fx_petal')) return;
  const t = scene.textures.createCanvas('fx_petal', 28, 16);
  if (!t) return;
  const ctx = t.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.quadraticCurveTo(14, -3, 26, 8);
  ctx.quadraticCurveTo(14, 19, 2, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, 8);
  ctx.lineTo(24, 8);
  ctx.stroke();
  t.refresh();
}

/**
 * 劇情插畫的運鏡層：整張畫做成網格，鏡頭平移時前景（畫面下方）比遠景（上方）移動得多，
 * 再慢慢推近，看起來像在一個有深度的場景裡移動，而不是平面圖片在滑。
 * 上下黑邊、場景粒子（落葉、風雪、火星、鬼火…）一起放進同一個容器。
 */
export class StoryCinema {
  readonly layer: Phaser.GameObjects.Container;
  private art: Puppet;
  private bars: Phaser.GameObjects.Rectangle[];
  private t = 0;
  private panFrom = 0;
  private panTo = 0;
  private panT = 1;
  private shot = 0;
  private readonly cover: number;
  private readonly onUpdate: (time: number, delta: number) => void;

  constructor(
    private scene: Phaser.Scene,
    key: string,
    id: string,
  ) {
    const w = viewW(scene);
    this.layer = scene.add.container(0, 0);
    // 黑底：插畫淡入前、以及寬螢幕邊緣
    this.layer.add(scene.add.rectangle(0, 0, w, VIEW_H, 0x000000).setOrigin(0));
    this.art = new Puppet(scene, w / 2, VIEW_H / 2, key, 10, 6);
    this.art.setOrigin(0.5);
    this.art.resetGrid();
    // 蓋滿畫面再多留一點平移空間
    this.cover = Math.max(w / this.art.frame.width, VIEW_H / this.art.frame.height) * 1.12;
    this.art.setScale(this.cover).setAlpha(0);
    this.layer.add(this.art);
    const atmos = STORY_ART[id]?.atmos;
    if (atmos) {
      ensurePetal(scene);
      const { tex, ...cfg } = ATMOS[atmos];
      const fromTop = (cfg.speedY as { max: number }).max > 0;
      const em = scene.add.particles(0, 0, tex, {
        ...cfg,
        x: { min: -40, max: w + 200 },
        y: fromTop ? { min: -40, max: -10 } : { min: VIEW_H * 0.2, max: VIEW_H + 20 },
      });
      // 先跑一段，開場時畫面上就已經有粒子
      em.fastForward(4000, 1000 / 30);
      this.layer.add(em);
    }
    // 電影黑邊
    const bh = Math.round(VIEW_H * 0.075);
    this.bars = [scene.add.rectangle(0, -bh, w, bh, 0x000000).setOrigin(0), scene.add.rectangle(0, VIEW_H, w, bh, 0x000000).setOrigin(0)];
    this.layer.add(this.bars);
    scene.tweens.add({ targets: this.bars[0], y: 0, duration: 500, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: this.bars[1], y: VIEW_H - bh, duration: 500, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: this.art, alpha: 1, duration: 600, ease: 'Sine.easeOut' });
    this.panTo = (STORY_ART[id]?.startPan ?? -1) * 0.5;
    this.panFrom = this.panTo;
    this.onUpdate = (_time, delta) => this.tick(delta / 1000);
    scene.events.on('update', this.onUpdate);
    this.tick(0);
  }

  /** 每句台詞換一個鏡位：往另一側緩慢平移 */
  nextShot(): void {
    this.shot++;
    this.panFrom = this.currentPan();
    this.panTo = this.shot % 2 ? 0.5 : -0.5;
    this.panT = 0;
  }

  private currentPan(): number {
    const k = Phaser.Math.Easing.Sine.InOut(Math.min(1, this.panT));
    return this.panFrom + (this.panTo - this.panFrom) * k;
  }

  private tick(dt: number): void {
    if (!this.art.active) return;
    this.t += dt;
    this.panT = Math.min(1, this.panT + dt / 5);
    const p = this.art;
    const fw = p.frame.realWidth;
    const fh = p.frame.realHeight;
    // 平移量：畫面寬多出來的空間的一部分
    const pan = this.currentPan() * fw * 0.05;
    // 緩慢推近（呼吸感）
    const push = 1 + Math.min(0.06, this.t * 0.004);
    const sway = Math.sin(this.t * 0.35) * fh * 0.004;
    for (let r = 0; r <= p.rows; r++) {
      const v = r / p.rows;
      // 地面視差：越靠近畫面下方（前景）移動越多
      const depth = 0.25 + 0.75 * Math.pow(v, 1.4);
      for (let c = 0; c <= p.cols; c++) {
        const i = r * (p.cols + 1) + c;
        const u = c / p.cols;
        const bx = (u - 0.5) * fw;
        const by = (v - 0.5) * fh;
        p.px[i] = bx * push + pan * depth;
        p.py[i] = by * push + sway * (1 - v);
        // 邊緣稍暗（暗角），中間保持原色
        const dx = u - 0.5;
        const dy = v - 0.45;
        p.shade[i] = 1 - Math.min(0.45, (dx * dx + dy * dy) * 0.9);
      }
    }
  }

  /** 淡出後銷毀 */
  close(done: () => void): void {
    this.scene.events.off('update', this.onUpdate);
    this.scene.tweens.add({
      targets: this.layer,
      alpha: 0,
      duration: 350,
      onComplete: () => {
        this.layer.destroy();
        done();
      },
    });
  }

  destroy(): void {
    this.scene.events.off('update', this.onUpdate);
    this.layer.destroy();
  }
}
