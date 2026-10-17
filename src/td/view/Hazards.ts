import Phaser from 'phaser';
import { TEX, isTouchDevice } from '../config';
import { HAZARD, HAZARD_DROP, type World } from '../sim/World';
import type { HazardDef, HazardKind } from '../sim/defs';
import { DEPTH, Fx, camShake } from './Fx';
import { sfx } from '../audio';
import { T } from '../i18n';

type HazardArt = { ready: string; empty: string; ball: string };
const ART: Record<HazardKind, HazardArt> = {
  boulder: { ready: 'hz_rock_ready', empty: 'hz_rock_empty', ball: 'hz_boulder' },
  snowball: { ready: 'hz_snow_ready', empty: 'hz_snow_empty', ball: 'hz_snowball' },
};
const SKIN_ART: Record<NonNullable<HazardDef['skin']>, HazardArt> = {
  sand: { ready: 'hz_sand_ready', empty: 'hz_sand_empty', ball: 'hz_sandball' },
  dark: { ready: 'hz_dark_ready', empty: 'hz_dark_empty', ball: 'hz_darkball' },
};

function artOf(def: HazardDef): HazardArt {
  return def.skin ? SKIN_ART[def.skin] : ART[def.kind];
}

/** 關卡用到的機關圖檔（LevelScene.preload 按需下載） */
export function hazardTextures(defs: HazardDef[]): string[] {
  return [...new Set(defs.flatMap((d) => Object.values(artOf(d))))];
}

/** 崖邊機關的顯示倍率（圖檔是 2 倍解析度，再放大一點比較好點） */
const SCALE = 1.15 / TEX;

interface HazardView {
  base: Phaser.GameObjects.Image;
  dial: Phaser.GameObjects.Graphics;
  ball: Phaser.GameObjects.Image | null;
  /** 從崖上落到路面的拋物線起訖點；落地後清掉 */
  drop: { sx: number; sy: number; tx: number; ty: number } | null;
  /** 滾動中的上一個位置（算旋轉與揚塵） */
  last: { x: number; y: number } | null;
  dust: number;
  ready: boolean;
}

/**
 * 地圖機關的畫面：崖邊的落石／雪球，點擊後落到路上沿路滾動。
 * 冷卻中顯示空崖＋小圓盤倒數，好了以後石頭「長回來」並閃爍提示可以點。
 */
export class HazardLayer {
  private views: HazardView[] = [];

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private fx: Fx,
    isTap: (p: Phaser.Input.Pointer) => boolean,
  ) {
    world.hazards.forEach((h, i) => {
      const art = artOf(h.def);
      const base = scene.add.image(h.def.x, h.def.y, this.tex(art.ready)).setOrigin(0.5, 0.9).setScale(SCALE).setDepth(h.def.y);
      const dial = scene.add.graphics().setDepth(DEPTH.hp);
      const touch = isTouchDevice();
      const hit = scene.add.ellipse(h.def.x, h.def.y - 22, touch ? 96 : 84, touch ? 88 : 76, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        if (isTap(p)) this.tap(i);
      });
      hit.on('pointerover', () => base.setTint(0xfff0c0));
      hit.on('pointerout', () => base.clearTint());
      this.views.push({ base, dial, ball: null, drop: null, last: null, dust: 0, ready: true });
    });
  }

  /** 沒下載到手繪圖時退回內建的光暈圖，至少看得到、點得到 */
  private tex(key: string): string {
    return this.scene.textures.exists(key) ? key : 'fx_soft';
  }

  private tap(i: number): void {
    const h = this.world.hazards[i];
    if (this.world.triggerHazard(i)) return;
    if (h && h.cd > 0) {
      sfx.play('error');
      this.fx.floatText(h.def.x, h.def.y - 70, T('hazardWait', Math.ceil(h.cd)), '#d8e4ff', 16);
    }
  }

  /** 開始滾：換成空崖，球從崖上拋落到路面（落下的過程在 update 依模擬時間播放，暫停／加速都同步） */
  onTrigger(i: number, x: number, y: number, tx: number, ty: number): void {
    const v = this.views[i];
    const art = artOf(this.world.hazards[i].def);
    v.base.setTexture(this.tex(art.empty));
    v.ready = false;
    v.ball?.destroy();
    v.ball = this.scene.add.image(x, y - 44, this.tex(art.ball)).setScale(1 / TEX).setOrigin(0.5, 0.85).setDepth(y + 1);
    v.drop = { sx: x, sy: y - 44, tx, ty };
    v.last = null;
    sfx.play('whoosh');
  }

  private land(kind: HazardKind, x: number, y: number): void {
    sfx.play('thud');
    sfx.play('rumble', kind === 'snowball' ? 0.6 : 1);
    camShake(this.scene, 160, 0.005);
    if (kind === 'snowball') this.fx.snowBurst(x, y - 6, 10);
    else this.fx.rubble(x, y, 6);
    this.fx.smokePuff(x, y - 4, 6);
  }

  /** 首次提示：箭頭在機關上方跳動 */
  pointAt(i: number, ms: number): void {
    const h = this.world.hazards[i];
    if (!h) return;
    const a = this.scene.add.image(h.def.x, h.def.y - 92, 'fx_arrow').setScale(1 / TEX).setDepth(DEPTH.menu + 5);
    this.scene.tweens.add({ targets: a, y: h.def.y - 78, duration: 260, yoyo: true, repeat: Math.ceil(ms / 520), onComplete: () => a.destroy() });
  }

  /** 撞到終點碎掉 */
  onEnd(i: number, x: number, y: number, kills: number): void {
    const v = this.views[i];
    const kind = this.world.hazards[i].def.kind;
    v.ball?.destroy();
    v.ball = null;
    v.drop = null;
    v.last = null;
    camShake(this.scene, 200, 0.006);
    if (kind === 'snowball') {
      this.fx.snowBurst(x, y - 10, 26);
      this.fx.ring(x, y, 50, 0xc8e8ff, 360);
      sfx.play('freeze', 0.7);
    } else {
      this.fx.rubble(x, y, 12);
      this.fx.smokePuff(x, y - 8, 10);
      sfx.play('explosion', 0.7);
    }
    if (kills >= 2) this.fx.floatText(x, y - 50, T('hazardCombo', kills), '#ffd27a', 22);
  }

  update(): void {
    const w = this.world;
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      const h = w.hazards[i];
      const g = v.dial;
      g.clear();
      if (h.roll && v.ball && v.drop) {
        const d = v.drop;
        if (h.roll.t < HAZARD_DROP) {
          // 拋物線：先微微往上再落下
          const k = h.roll.t / HAZARD_DROP;
          v.ball.setPosition(d.sx + (d.tx - d.sx) * k, d.sy + (d.ty - d.sy) * k * k - Math.sin(k * Math.PI) * 26);
          v.ball.setDepth(Math.max(d.sy, v.ball.y) + 1);
          v.ball.rotation += 0.1;
        } else {
          v.drop = null;
          this.land(h.def.kind, d.tx, d.ty);
        }
      }
      // 滾動中：球跟著模擬位置走、依移動距離旋轉、一路揚塵
      if (h.roll && h.roll.t >= HAZARD_DROP && v.ball) {
        const r = h.roll;
        const grow = h.def.kind === 'snowball' ? 1 + Math.min(0.35, Math.abs(r.d - h.def.d0) / 900) : 1;
        v.ball.setPosition(r.x, r.y).setDepth(r.y + 1).setScale(grow / TEX);
        if (v.last) {
          const dx = r.x - v.last.x;
          const moved = Math.hypot(dx, r.y - v.last.y);
          v.ball.rotation += (dx >= 0 ? 1 : -1) * (moved / 22);
          v.dust += moved;
          if (v.dust > 18) {
            v.dust = 0;
            if (h.def.kind === 'snowball') this.fx.snowBurst(r.x, r.y - 4, 2);
            else this.fx.smokePuff(r.x, r.y - 2, 1);
          }
        }
        v.last = { x: r.x, y: r.y };
      }
      if (h.roll) continue;
      const ready = h.cd <= 0;
      if (ready && !v.ready) {
        // 冷卻結束：石頭長回來
        v.ready = true;
        v.base.setTexture(this.tex(artOf(h.def).ready));
        v.base.setScale(SCALE * 0.6);
        this.scene.tweens.add({ targets: v.base, scale: SCALE, duration: 300, ease: 'Back.easeOut' });
        this.fx.smokePuff(h.def.x, h.def.y - 20, 4);
      }
      const x = h.def.x;
      const y = h.def.y;
      if (ready) {
        // 可以點：腳下一圈金色光環呼吸
        const a = 0.35 + 0.3 * Math.sin(w.time * 4);
        g.lineStyle(3, 0xffd86a, a);
        g.strokeEllipse(x, y - 2, 74, 30);
      } else {
        const k = 1 - h.cd / HAZARD[h.def.kind].cd;
        const cy = y - 62;
        g.fillStyle(0x1a1208, 0.7);
        g.fillCircle(x, cy, 11);
        g.fillStyle(0xe8c070, 0.95);
        g.slice(x, cy, 9, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false);
        g.fillPath();
        g.lineStyle(2, 0xf4e2b8, 0.9);
        g.strokeCircle(x, cy, 11);
      }
    }
  }
}
