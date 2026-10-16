import Phaser from 'phaser';
import { DEPTH } from './Fx';
import { TEX } from '../config';
import { TOWER_ART, BARREL_ORIGIN, TW_BASE, TW_H } from '../art/towers';
import type { Tower } from '../sim/entities';

export interface UnitVisualState {
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  /** 模擬時間 */
  t: number;
  hpRatio: number;
  lastAttackAt: number;
  lastHitAt: number;
  tint?: number;
  stunned?: boolean;
  /** 冰霜水晶：包在冰塊裡 */
  frozen?: boolean;
  /** 鑽地中：只顯示移動的沙堆 */
  burrowed?: boolean;
}

/**
 * 單位外觀（敵人 / 士兵 / 英雄共用）：陰影 + 身體 + 血條，
 * 走路上下彈跳、攻擊前衝、受擊泛紅，全部由模擬狀態推導（不用 tween）。
 */
export class UnitView {
  readonly shadow: Phaser.GameObjects.Image;
  readonly body: Phaser.GameObjects.Image;
  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFg: Phaser.GameObjects.Rectangle;
  private baseScale = 1;
  private phase = Math.random() * 10;
  private stars: Phaser.GameObjects.Image[] = [];
  private ring: Phaser.GameObjects.Ellipse | null = null;
  private ice: Phaser.GameObjects.Image | null = null;
  private mound: Phaser.GameObjects.Image | null = null;
  dead = false;

  constructor(
    private scene: Phaser.Scene,
    tex: string,
    public height: number,
    public facesRight: boolean,
    public flying: boolean,
    private hpWidth: number,
    private alwaysHp: boolean,
    hpColor = 0x5ad04a,
  ) {
    this.shadow = scene.add.image(0, 0, 'fx_shadow').setDepth(DEPTH.shadow);
    this.shadow.setScale((hpWidth + 10) / 64, (hpWidth + 10) / 64);
    this.shadow.setAlpha(flying ? 0.35 : 0.7);
    this.body = scene.add.image(0, 0, tex).setOrigin(0.5, 1);
    this.setTexture(tex, height);
    this.hpBg = scene.add.rectangle(0, 0, hpWidth + 2, 5, 0x1a0a04).setDepth(DEPTH.hp).setOrigin(0.5);
    this.hpFg = scene.add.rectangle(0, 0, hpWidth, 3, hpColor).setDepth(DEPTH.hp + 1).setOrigin(0, 0.5);
    this.hpBg.setStrokeStyle(1, 0x000000, 0.6);
  }

  setTexture(tex: string, height: number): void {
    this.body.setTexture(tex);
    this.height = height;
    this.baseScale = height / this.body.frame.height;
    this.body.setScale(this.baseScale);
  }

  showRing(on: boolean, color = 0xffd84a): void {
    if (on && !this.ring) {
      this.ring = this.scene.add.ellipse(0, 0, this.hpWidth + 24, (this.hpWidth + 24) * 0.45).setDepth(DEPTH.shadow + 1);
      this.ring.setStrokeStyle(2.5, color, 0.95);
      this.ring.setFillStyle(color, 0.12);
    } else if (!on && this.ring) {
      this.ring.destroy();
      this.ring = null;
    }
  }

  update(s: UnitVisualState): void {
    if (this.dead) return;
    if (s.burrowed) {
      if (!this.mound) {
        this.mound = this.scene.add.image(0, 0, 'fx_mound').setOrigin(0.5, 1).setScale(1 / TEX);
        this.setVisible(false);
      }
      this.mound.setPosition(s.x, s.y + 2 + Math.sin(s.t * 14) * 1.2).setDepth(s.y);
      this.mound.setScale((1 / TEX) * (1 + Math.sin(s.t * 9) * 0.06), 1 / TEX);
      return;
    }
    if (this.mound) {
      this.mound.destroy();
      this.mound = null;
      this.body.setVisible(true);
      this.shadow.setVisible(true);
    }
    const t = s.t + this.phase;
    let ox = 0;
    let oy = 0;
    let sy = 1;
    let rot = 0;
    if (s.moving) {
      oy = -Math.abs(Math.sin(t * 9)) * 3.2;
      rot = Math.sin(t * 9) * 0.05;
      sy = 1 + Math.sin(t * 18) * 0.025;
    } else {
      sy = 1 + Math.sin(t * 2.5) * 0.02;
    }
    const since = s.t - s.lastAttackAt;
    if (since >= 0 && since < 0.22) {
      const k = Math.sin((since / 0.22) * Math.PI);
      ox = s.facing * k * 7;
      rot += s.facing * k * 0.12;
    }
    let fy = 0;
    if (this.flying) {
      fy = -30 + Math.sin(t * 3) * 4;
    }
    this.body.setPosition(s.x + ox, s.y + oy + fy);
    this.body.setDepth(s.y + (this.flying ? 400 : 0));
    this.body.setFlipX((s.facing > 0) !== this.facesRight);
    this.body.setScale(this.baseScale, this.baseScale * sy);
    this.body.setRotation(rot);
    const hit = s.t - s.lastHitAt < 0.09;
    if (hit) this.body.setTint(0xff9a8a);
    else if (s.tint !== undefined) this.body.setTint(s.tint);
    else this.body.clearTint();
    this.shadow.setPosition(s.x, s.y + 1);
    if (this.ring) {
      this.ring.setPosition(s.x, s.y + 2);
      this.ring.setScale(1 + Math.sin(s.t * 5) * 0.06);
    }
    const showHp = this.alwaysHp || s.hpRatio < 0.999;
    this.hpBg.setVisible(showHp);
    this.hpFg.setVisible(showHp);
    if (showHp) {
      const hy = s.y + fy - this.height - 6;
      this.hpBg.setPosition(s.x, hy);
      this.hpFg.setPosition(s.x - this.hpWidth / 2, hy);
      this.hpFg.width = Math.max(0, this.hpWidth * s.hpRatio);
      this.hpFg.fillColor = s.hpRatio > 0.5 ? this.hpFg.fillColor : s.hpRatio > 0.25 ? 0xf0c030 : 0xe04030;
    }
    // 冰塊
    if (s.frozen) {
      if (!this.ice) {
        this.ice = this.scene.add.image(0, 0, 'fx_iceblock').setOrigin(0.5, 1);
        this.ice.setDisplaySize(Math.max(30, this.hpWidth + 12), this.height * 1.08);
      }
      this.ice.setPosition(s.x, s.y + fy + 3).setDepth(this.body.depth + 0.5);
    } else if (this.ice) {
      this.ice.destroy();
      this.ice = null;
    }
    // 暈眩星星
    if (s.stunned) {
      if (!this.stars.length) {
        for (let i = 0; i < 3; i++) this.stars.push(this.scene.add.image(0, 0, 'fx_star').setScale(0.28).setDepth(DEPTH.hp - 1));
      }
      this.stars.forEach((st, i) => {
        const a = s.t * 5 + (i * Math.PI * 2) / 3;
        st.setPosition(s.x + Math.cos(a) * 12, s.y + fy - this.height - 2 + Math.sin(a) * 4);
      });
    } else if (this.stars.length) {
      this.stars.forEach((st) => st.destroy());
      this.stars = [];
    }
  }

  setVisible(v: boolean): void {
    this.body.setVisible(v);
    this.shadow.setVisible(v);
    if (!v) {
      this.hpBg.setVisible(false);
      this.hpFg.setVisible(false);
    }
  }

  /** 死亡動畫後銷毀 */
  die(kind: 'death' | 'leak' | 'fade' = 'death'): void {
    if (this.dead) return;
    this.dead = true;
    this.hpBg.destroy();
    this.hpFg.destroy();
    this.stars.forEach((s) => s.destroy());
    this.ring?.destroy();
    this.ice?.destroy();
    this.mound?.destroy();
    const b = this.body;
    const flip = b.flipX ? -1 : 1;
    if (kind === 'death') {
      b.setTint(0xffffff);
      this.scene.tweens.add({
        targets: b,
        alpha: 0,
        y: b.y + (this.flying ? 30 : 3),
        rotation: flip * 0.5,
        scaleY: b.scaleY * 0.7,
        duration: 380,
        ease: 'Quad.easeIn',
        onComplete: () => b.destroy(),
      });
    } else {
      this.scene.tweens.add({ targets: b, alpha: 0, duration: 300, onComplete: () => b.destroy() });
    }
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 300, onComplete: () => this.shadow.destroy() });
  }

  destroy(): void {
    this.dead = true;
    this.body.destroy();
    this.shadow.destroy();
    this.hpBg.destroy();
    this.hpFg.destroy();
    this.stars.forEach((s) => s.destroy());
    this.ring?.destroy();
    this.ice?.destroy();
    this.mound?.destroy();
  }
}

/** 塔頂單位設定 */
function topUnits(art: string): { tex: string; n: number; h: number; tint?: number } | null {
  if (art.startsWith('tw_archer')) {
    if (art === 'tw_archer_marksman') return { tex: 'sp_player_archer', n: 1, h: 34, tint: 0xffe6b0 };
    if (art === 'tw_archer_ranger') return { tex: 'sp_player_archer', n: 2, h: 30, tint: 0xc8ffb8 };
    return { tex: 'sp_player_archer', n: 2, h: art === 'tw_archer_1' ? 27 : 29 };
  }
  if (art.startsWith('tw_mage')) {
    if (art === 'tw_mage_arcane') return { tex: 'sp_player_mage', n: 1, h: 34, tint: 0xe6c8ff };
    if (art === 'tw_mage_elemental') return { tex: 'sp_player_mage', n: 1, h: 34, tint: 0xffd8a8 };
    return { tex: 'sp_player_mage', n: 1, h: art === 'tw_mage_1' ? 29 : 32 };
  }
  return null;
}

export class TowerView {
  readonly base: Phaser.GameObjects.Image;
  private units: Phaser.GameObjects.Image[] = [];
  private unitScale: number[] = [];
  private barrel: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private art = '';
  private lastShot = -10;
  private shooterIdx = 0;
  private buildBar: Phaser.GameObjects.Rectangle[] = [];

  constructor(
    private scene: Phaser.Scene,
    readonly tower: Tower,
  ) {
    this.base = scene.add.image(tower.x, tower.y, tower.def.art).setOrigin(0.5, TW_BASE / TW_H).setScale(1 / TEX);
    this.base.setDepth(tower.y);
    this.setArt(tower.def.art);
  }

  setArt(art: string): void {
    if (art === this.art) return;
    this.art = art;
    this.base.setTexture(art);
    this.units.forEach((u) => u.destroy());
    this.units = [];
    this.unitScale = [];
    this.barrel?.destroy();
    this.barrel = null;
    this.glow?.destroy();
    this.glow = null;
    const info = TOWER_ART[art];
    const tu = topUnits(art);
    const t = this.tower;
    if (tu) {
      for (let i = 0; i < tu.n; i++) {
        const ox = tu.n > 1 ? (i === 0 ? -12 : 12) : 0;
        const u = this.scene.add.image(t.x + ox, t.y - info.topY + 4, tu.tex).setOrigin(0.5, 1);
        const sc = tu.h / u.frame.height;
        u.setScale(sc).setDepth(t.y + 0.5);
        if (tu.tint) u.setTint(tu.tint);
        this.units.push(u);
        this.unitScale.push(sc);
      }
    }
    if (info.barrel) {
      this.barrel = this.scene.add
        .image(t.x, t.y - (info.barrelY ?? 30), info.barrel)
        .setOrigin(BARREL_ORIGIN.x, BARREL_ORIGIN.y)
        .setScale(1 / TEX)
        .setDepth(t.y + 0.5);
    }
    if (art === 'tw_art_tesla' || art.startsWith('tw_mage')) {
      const gy = art === 'tw_art_tesla' ? info.topY + 2 : info.topY + 22;
      this.glow = this.scene.add
        .image(t.x, t.y - gy, 'fx_soft')
        .setDepth(t.y + 0.6)
        .setBlendMode('ADD')
        .setTint(art === 'tw_art_tesla' ? 0x7ac8ff : art === 'tw_mage_elemental' ? 0xffa050 : 0xc890ff)
        .setScale(0.5)
        .setAlpha(0);
    }
  }

  update(time: number, simTime: number): void {
    const t = this.tower;
    this.setArt(t.def.art);
    // 建造中
    const building = simTime < t.buildUntil;
    if (building) {
      const k = 1 - (t.buildUntil - simTime) / 0.6;
      if (!this.buildBar.length) {
        this.buildBar = [
          this.scene.add.rectangle(t.x, t.y - 64, 52, 8, 0x1a0a04).setDepth(DEPTH.hp).setStrokeStyle(1.5, 0x000000),
          this.scene.add.rectangle(t.x - 25, t.y - 64, 2, 5, 0xffd84a).setOrigin(0, 0.5).setDepth(DEPTH.hp + 1),
        ];
      }
      this.buildBar[1].width = 50 * Phaser.Math.Clamp(k, 0, 1);
      this.base.setAlpha(0.55 + 0.45 * k);
    } else if (this.buildBar.length) {
      this.buildBar.forEach((b) => b.destroy());
      this.buildBar = [];
      this.base.setAlpha(1);
    }
    const shot = t.lastShotAt !== this.lastShot;
    if (shot) {
      this.lastShot = t.lastShotAt;
      this.shooterIdx = (this.shooterIdx + 1) % Math.max(1, this.units.length);
    }
    const since = simTime - t.lastShotAt;
    const face = t.aimX >= t.x ? 1 : -1;
    this.units.forEach((u, i) => {
      u.setFlipX(face < 0);
      const sc = this.unitScale[i];
      const active = i === this.shooterIdx && since < 0.2;
      const k = active ? Math.sin((since / 0.2) * Math.PI) : 0;
      u.setScale(sc * (1 + k * 0.08), sc * (1 - k * 0.06 + Math.sin(time / 400 + i) * 0.015));
      u.setAlpha(building ? 0 : 1);
    });
    if (this.barrel) {
      const ang = Phaser.Math.Clamp((t.aimX - t.x) / 300, -0.5, 0.5);
      this.barrel.setFlipX(face < 0);
      this.barrel.setRotation(face < 0 ? ang * 0.6 : ang * 0.6);
      const rk = since < 0.25 ? Math.sin((since / 0.25) * Math.PI) : 0;
      this.barrel.setScale((1 / TEX) * (1 + rk * 0.12), (1 / TEX) * (1 - rk * 0.18));
      this.barrel.setAlpha(building ? 0 : 1);
    }
    if (this.glow) {
      const pulse = 0.25 + Math.sin(time / 300) * 0.1;
      const flash = since < 0.3 ? (1 - since / 0.3) * 0.8 : 0;
      this.glow.setAlpha(building ? 0 : pulse + flash);
      this.glow.setScale(0.45 + flash * 0.4);
    }
    const stunned = simTime < t.stunUntil;
    this.base.setTint(stunned ? 0x8a8aff : 0xffffff);
  }

  /** 剛蓋好 / 升級的彈跳動畫 */
  pop(): void {
    const b = this.base;
    b.setScale((1 / TEX) * 1.15, (1 / TEX) * 0.8);
    this.scene.tweens.add({ targets: b, scaleX: 1 / TEX, scaleY: 1 / TEX, duration: 420, ease: 'Elastic.easeOut' });
  }

  destroy(): void {
    this.base.destroy();
    this.units.forEach((u) => u.destroy());
    this.barrel?.destroy();
    this.glow?.destroy();
    this.buildBar.forEach((b) => b.destroy());
  }
}
