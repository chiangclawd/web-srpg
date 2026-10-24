import Phaser from 'phaser';
import { DEPTH } from './Fx';
import { TEX } from '../config';
import { TOWER_ART, BARREL_ORIGIN, TW_BASE, TW_H } from '../art/towers';
import type { Tower } from '../sim/entities';
import { Puppet } from './Puppet';
import { applyPose, gaitFor, restPose, type Gait } from './Rig';
import { sheetFor, sheetFrame, sheetKey, type SheetAnim, type SheetDir, type UnitSheet } from './Sheets';

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
  /** 怨靈躲在黑暗裡：半透明閃爍 */
  shrouded?: boolean;
}

/** 逐格動畫的身體不變形，只用來投影子 */
const STILL = restPose();

/** 死亡倒地時揚起的塵土（由關卡場景接上特效層） */
let dustFx: ((x: number, y: number) => void) | null = null;
export function setUnitDust(fn: ((x: number, y: number) => void) | null): void {
  dustFx = fn;
}

/**
 * 單位外觀（敵人 / 士兵 / 英雄共用）：投影 + 可變形身體 + 血條。
 * 身體是一張切成網格的手繪圖（Puppet），依步態做出腳步、扭腰、前傾、轉身、出招、受擊、倒地，
 * 全部由模擬狀態推導（倒地除外），遊戲暫停或加速時動作也跟著停或加速。
 */
export class UnitView {
  readonly shadow: Phaser.GameObjects.Image;
  readonly body: Puppet;
  /** 投在地上的身影（飛行單位沒有，只有腳下的圓影） */
  private cast: Puppet | null = null;
  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFg: Phaser.GameObjects.Rectangle;
  private baseScale = 1;
  private phase = Math.random() * 10;
  private stars: Phaser.GameObjects.Image[] = [];
  private ring: Phaser.GameObjects.Ellipse | null = null;
  private ice: Phaser.GameObjects.Image | null = null;
  private mound: Phaser.GameObjects.Image | null = null;
  /** 精英光環（腳下發光的圈） */
  private aura: Phaser.GameObjects.Image | null = null;
  private auraRing: Phaser.GameObjects.Image | null = null;
  private wasShrouded = false;
  private gait: Gait;
  private pose = restPose();
  /** 目前的外觀貼圖（3D 圖表依這個 key 對應） */
  tex = '';
  /** 3D 預渲染的逐格動畫（沒有就用網格變形） */
  private sheet: UnitSheet | null = null;
  private dir: SheetDir = 'side';
  private dirY = 0;
  /** 畫面上的朝向（轉身動畫播完才換） */
  private face = 1;
  private turnT = -1;
  private turnTo = 1;
  private lastT = -1;
  private lastX = 0;
  private lastY = 0;
  private lastSpeed = 0;
  /** 0 = 站著、1 = 走路（平滑過渡） */
  private walk = 0;
  /** 頭頂的慣性擺動（彈簧） */
  private sway = 0;
  private swayV = 0;
  private seenHit = -1;
  private seenAttack = -1;
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
    this.shadow.setAlpha(flying ? 0.35 : 0.5);
    this.gait = gaitFor(tex, flying);
    const big = height > 70;
    this.body = new Puppet(scene, 0, 0, tex, big ? 6 : 4, big ? 8 : 6).setOrigin(0.5, 1);
    this.body.resetGrid();
    if (!flying) {
      this.cast = new Puppet(scene, 0, 0, tex, big ? 6 : 4, big ? 8 : 6).setOrigin(0.5, 1);
      this.cast.resetGrid();
      this.cast.setTintFill(0x1a1408).setAlpha(0.26).setDepth(DEPTH.shadow + 0.5);
    }
    this.setTexture(tex, height);
    this.hpBg = scene.add.rectangle(0, 0, hpWidth + 2, 5, 0x1a0a04).setDepth(DEPTH.hp).setOrigin(0.5);
    this.hpFg = scene.add.rectangle(0, 0, hpWidth, 3, hpColor).setDepth(DEPTH.hp + 1).setOrigin(0, 0.5);
    this.hpBg.setStrokeStyle(1, 0x000000, 0.6);
  }

  setTexture(tex: string, height: number): void {
    this.tex = tex;
    this.sheet = sheetFor(tex, this.scene);
    const sh = this.sheet;
    for (const p of [this.body, this.cast]) {
      if (!p) continue;
      if (sh) p.setTexture(sheetKey(sh), sheetFrame(sh, this.dir, 'idle', 0)).setOrigin(0.5, sh.footAt);
      else p.setTexture(tex).setOrigin(0.5, 1);
      p.resetGrid();
    }
    this.gait = gaitFor(tex, this.flying);
    this.height = height;
    this.baseScale = height / (sh ? sh.unitPx : this.body.frame.height);
    this.body.setScale(this.baseScale);
    this.cast?.setScale(this.baseScale);
  }

  /** 切換「3D 角色」後重新套用外觀 */
  refreshArt(): void {
    if (!this.dead && this.tex) this.setTexture(this.tex, this.height);
  }

  /** 逐格動畫：依移動方向選側面 / 正面 / 背面，依狀態選動作 */
  private animateSheet(s: UnitVisualState, dt: number): void {
    const sh = this.sheet!;
    const dx = s.x - this.lastX;
    const dy = s.y - this.lastY;
    const dist = Math.hypot(dx, dy);
    const moving = s.moving && !s.frozen && !s.stunned;
    this.face = s.facing >= 0 ? 1 : -1;
    if (dist > 0.01) this.dirY += (dy / dist - this.dirY) * Math.min(1, dt * 10);
    // 往上下走才轉正面 / 背面（有遲滯，斜走時不會一直換）
    if (!moving) this.dir = 'side';
    else if (this.dir === 'side' ? this.dirY > 0.8 : this.dirY > 0.6) this.dir = 'front';
    else if (this.dir === 'side' ? this.dirY < -0.8 : this.dirY < -0.6) this.dir = 'back';
    else this.dir = 'side';
    if (s.frozen) return;
    const sinceAtk = s.t - s.lastAttackAt;
    const sinceHit = s.t - s.lastHitAt;
    let anim: SheetAnim;
    let k: number;
    if (sinceAtk >= 0 && sinceAtk < sh.anims.attack.dur) {
      anim = 'attack';
      k = sinceAtk / sh.anims.attack.dur;
      this.dir = 'side';
    } else if (moving) {
      anim = 'walk';
      // 腳步跟實際移動距離同步
      this.phase += dist / (sh.cycle * this.height);
      k = this.phase % 1;
    } else if (sinceHit >= 0 && sinceHit < sh.anims.hit.dur) {
      anim = 'hit';
      k = sinceHit / sh.anims.hit.dur;
    } else {
      anim = 'idle';
      k = ((s.t + this.phase) / sh.anims.idle.dur) % 1;
    }
    const f = sheetFrame(sh, this.dir, anim, Math.floor(k * sh.anims[anim].frames));
    this.body.setFrame(f);
    this.cast?.setFrame(f);
  }

  /** 精英：腳下一圈發光光環＋身體放大一點 */
  setElite(color: number): void {
    if (this.aura) return;
    // 紋理是 2 倍解析度：用 displaySize 指定實際大小
    const w = this.hpWidth + 26;
    this.aura = this.scene.add.image(0, 0, 'fx_soft').setTint(color).setBlendMode('ADD').setDepth(DEPTH.shadow + 1);
    this.aura.setDisplaySize(w, w * 0.42).setAlpha(0.8);
    this.auraRing = this.scene.add.image(0, 0, 'fx_ring').setTint(color).setDepth(DEPTH.shadow + 2);
    this.auraRing.setDisplaySize(w, w * 0.42).setAlpha(0.95);
    this.scene.tweens.add({ targets: [this.aura, this.auraRing], alpha: 0.4, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.baseScale *= 1.15;
    this.height *= 1.15;
    this.body.setScale(this.baseScale);
    this.cast?.setScale(this.baseScale);
    this.hpFg.setStrokeStyle(1, color, 1);
    this.hpBg.setStrokeStyle(1.5, color, 1);
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

  /** 依模擬狀態算出這一幀的姿勢 */
  private animate(s: UnitVisualState, dt: number): void {
    const p = this.pose;
    const t = s.t + this.phase;
    // 移動距離推動步伐（腳步跟實際速度同步，不會滑步）
    const dist = Math.hypot(s.x - this.lastX, s.y - this.lastY);
    const speed = dt > 0 ? dist / dt : this.lastSpeed;
    const moving = s.moving && !s.frozen && !s.stunned;
    this.walk += ((moving ? 1 : 0) - this.walk) * Math.min(1, dt * (moving ? 8 : 5));
    const stride = this.height * (this.gait === 'quad' ? 0.6 : this.gait === 'heavy' ? 0.55 : this.gait === 'skitter' ? 0.3 : 0.45);
    if (moving) this.phase += (dist / stride) * Math.PI;
    const ph = this.phase;
    // 起步 / 停下 / 轉身的慣性：頭頂往反方向甩，再彈回來
    if (dt > 0) {
      const accel = (speed - this.lastSpeed) / dt;
      this.swayV -= Phaser.Math.Clamp(accel * 0.0012, -1.5, 1.5);
      this.lastSpeed = speed;
    }
    // 轉身：頭先轉、身體跟上，中途換邊，並且小跳一下
    const want = s.facing >= 0 ? 1 : -1;
    if (want !== this.face && this.turnT < 0) {
      this.turnT = 0;
      this.turnTo = want;
    }
    let turnYawTop = 0;
    let turnYawHip = 0;
    let turnHop = 0;
    if (this.turnT >= 0) {
      this.turnT += dt / 0.22;
      const k = Math.min(1, this.turnT);
      if (k >= 0.5 && this.face !== this.turnTo) this.face = this.turnTo;
      if (k < 0.5) {
        const q = k / 0.5;
        turnYawTop = -0.75 * Math.min(1, q * 1.3);
        turnYawHip = -0.75 * q * 0.8;
      } else {
        const q = (k - 0.5) / 0.5;
        turnYawTop = 0.75 * (1 - Math.min(1, q * 1.3));
        turnYawHip = 0.75 * (1 - q) * 0.8;
      }
      turnHop = Math.sin(k * Math.PI);
      if (this.turnT >= 1) this.turnT = -1;
    }
    // 受擊：上半身被打得往後仰
    if (s.lastHitAt !== this.seenHit) {
      if (this.seenHit >= 0 && s.t - s.lastHitAt < 0.1) this.swayV -= 1.1;
      this.seenHit = s.lastHitAt;
    }
    if (s.lastAttackAt !== this.seenAttack) {
      if (this.seenAttack >= 0 && s.t - s.lastAttackAt < 0.1) this.swayV += 0.9;
      this.seenAttack = s.lastAttackAt;
    }
    if (dt > 0) {
      this.swayV += (-170 * this.sway - 10 * this.swayV) * dt;
      this.sway += this.swayV * dt;
      this.sway = Phaser.Math.Clamp(this.sway, -0.25, 0.25);
    }
    const w = this.walk;
    const s1 = Math.sin(ph);
    const c1 = Math.cos(ph);
    p.yawHip = 0;
    p.yawTop = 0;
    p.lean = 0;
    p.legSwing = 0;
    p.bob = 0;
    p.squash = 0;
    p.rock = 0;
    p.flap = 0;
    p.rippleAmp = 0;
    p.pitch = 0;
    p.waveAmp = 0;
    const idle = 1 - w;
    if (!s.frozen) {
      switch (this.gait) {
        case 'walk':
          p.legSwing = 0.1 * s1 * w;
          p.bob = 0.045 * Math.abs(c1) * w;
          p.squash = 0.05 * Math.pow(1 - Math.abs(c1), 3) * w + 0.015 * Math.sin(t * 2.4) * idle;
          p.rock = 0.035 * s1 * w;
          p.yawHip = 0.12 * s1 * w + 0.05 * Math.sin(t * 0.9) * idle;
          p.yawTop = -0.1 * s1 * w + 0.08 * Math.sin(t * 0.9 + 0.6) * idle;
          p.lean = 0.05 * w;
          break;
        case 'heavy':
          p.legSwing = 0.08 * s1 * w;
          p.bob = 0.04 * Math.abs(c1) * w;
          p.squash = 0.09 * Math.pow(1 - Math.abs(c1), 4) * w + 0.02 * Math.sin(t * 1.8) * idle;
          p.rock = 0.05 * s1 * w;
          p.yawHip = 0.15 * s1 * w + 0.04 * Math.sin(t * 0.7) * idle;
          p.yawTop = -0.14 * s1 * w + 0.06 * Math.sin(t * 0.7 + 0.5) * idle;
          p.lean = 0.04 * w;
          break;
        case 'quad':
          p.legSwing = 0.08 * s1 * w;
          p.pitch = 0.07 * s1 * w;
          p.bob = 0.05 * Math.abs(c1) * w;
          p.squash = 0.03 * Math.pow(1 - Math.abs(c1), 3) * w + 0.015 * Math.sin(t * 2.2) * idle;
          p.yawHip = 0.06 * c1 * w;
          p.yawTop = 0.05 * Math.sin(t * 0.8) * idle;
          break;
        case 'skitter':
          p.legSwing = 0.05 * Math.sin(ph * 2) * w;
          p.bob = 0.025 * Math.abs(Math.sin(ph * 2)) * w;
          p.pitch = 0.035 * s1 * w + 0.02 * Math.sin(t * 1.6) * idle;
          p.squash = 0.02 * Math.sin(t * 3) * idle;
          p.yawHip = 0.05 * s1 * w;
          break;
        case 'fly': {
          const rate = this.height < 40 ? 15 : 9;
          p.flap = Math.sin(t * rate);
          p.bob = -0.03 * p.flap;
          p.lean = 0.06 * w;
          p.yawTop = 0.06 * Math.sin(t * 1.3);
          p.yawHip = 0.04 * Math.sin(t * 1.3 - 0.4);
          break;
        }
        case 'float':
          p.ripple = t * 4;
          p.rippleAmp = 0.06;
          p.bob = 0.03 * Math.sin(t * 2);
          p.lean = 0.06 * w;
          p.yawTop = 0.1 * Math.sin(t * 1.1);
          p.yawHip = 0.05 * Math.sin(t * 1.1 - 0.5);
          break;
        case 'slither':
          p.wave = t * 3 + ph * 0.5;
          p.waveAmp = 0.04 + 0.03 * w;
          p.bob = 0.02 * Math.sin(t * 2.5);
          p.yawTop = 0.1 * Math.sin(t * 1.2);
          break;
      }
      if (s.stunned) {
        p.yawTop += 0.22 * Math.sin(t * 6);
        p.rock += 0.06 * Math.sin(t * 5);
      }
    }
    // 出招：往前撲、肩膀扭進去、身體拉長
    const since = s.t - s.lastAttackAt;
    if (since >= 0 && since < 0.35 && !s.frozen) {
      const k = since < 0.07 ? since / 0.07 : Math.max(0, 1 - (since - 0.07) / 0.28);
      p.lean += 0.16 * k;
      p.yawTop += 0.3 * k;
      p.squash -= 0.06 * k;
    }
    const sinceHit = s.t - s.lastHitAt;
    if (sinceHit >= 0 && sinceHit < 0.12) p.squash += 0.06 * (1 - sinceHit / 0.12);
    p.lean += this.sway;
    p.yawTop += turnYawTop;
    p.yawHip += turnYawHip;
    p.bob += 0.06 * turnHop;
    p.squash -= 0.04 * turnHop;
  }

  update(s: UnitVisualState): void {
    if (this.dead) return;
    if (s.burrowed) {
      if (!this.mound) {
        this.mound = this.scene.add.image(0, 0, 'fx_mound').setOrigin(0.5, 1).setScale(1 / TEX);
        this.setVisible(false);
      }
      // 沙堆大小隨單位體型（首領的沙堆比較大）
      const k = Math.max(1, (this.hpWidth + 10) / 46);
      this.mound.setPosition(s.x, s.y + 2 + Math.sin(s.t * 14) * 1.2).setDepth(s.y);
      this.mound.setScale((k / TEX) * (1 + Math.sin(s.t * 9) * 0.06), (k * 0.85) / TEX);
      this.lastX = s.x;
      this.lastY = s.y;
      this.lastT = s.t;
      return;
    }
    if (this.mound) {
      this.mound.destroy();
      this.mound = null;
      this.body.setVisible(true);
      this.shadow.setVisible(true);
      this.cast?.setVisible(true);
    }
    if (this.lastT < 0) {
      this.lastX = s.x;
      this.lastY = s.y;
      this.face = s.facing >= 0 ? 1 : -1;
    }
    const dt = this.lastT < 0 ? 0 : Phaser.Math.Clamp(s.t - this.lastT, 0, 0.05);
    if (this.sheet) this.animateSheet(s, dt);
    else this.animate(s, dt);
    this.lastX = s.x;
    this.lastY = s.y;
    this.lastT = s.t;
    const t = s.t + this.phase;
    let fy = 0;
    if (this.flying) {
      fy = -30 + Math.sin(t * 3) * 4;
    }
    this.body.setPosition(s.x, s.y + fy);
    this.body.setDepth(s.y + (this.flying ? 400 : 0));
    if (this.sheet) applyPose(this.body, STILL, this.face, 1, this.cast, 0);
    else applyPose(this.body, this.pose, this.face, this.facesRight ? 1 : -1, this.cast);
    const hit = s.t - s.lastHitAt < 0.09;
    if (hit) this.body.setTint(0xff9a8a);
    else if (s.tint !== undefined) this.body.setTint(s.tint);
    else this.body.clearTint();
    if (s.shrouded) {
      this.body.setAlpha(0.45 + Math.sin(t * 4) * 0.1);
      this.cast?.setVisible(false);
      this.wasShrouded = true;
    } else if (this.wasShrouded) {
      this.body.setAlpha(1);
      this.cast?.setVisible(true);
      this.wasShrouded = false;
    }
    this.cast?.setPosition(s.x, s.y);
    this.shadow.setPosition(s.x, s.y + 1);
    if (this.flying) {
      // 飛得越高影子越小越淡
      const k = (this.hpWidth + 10) / 64;
      const lift = 1 + (fy + 30) / 30;
      this.shadow.setScale(k * (0.85 + 0.15 * lift), k * (0.85 + 0.15 * lift));
    }
    this.aura?.setPosition(s.x, s.y + 2).setVisible(this.body.visible);
    this.auraRing?.setPosition(s.x, s.y + 2).setVisible(this.body.visible);
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
    this.cast?.setVisible(v);
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
    this.aura?.destroy();
    this.auraRing?.destroy();
    const b = this.body;
    const cast = this.cast;
    const sh = this.sheet;
    if (kind === 'death' && sh) {
      // 3D 動作：播完倒地那幾格，落地揚塵，再淡出
      b.setTint(0xffffff);
      const st = { k: 0 };
      const groundY = this.shadow.y - 1;
      let landed = false;
      // 背面倒地會倒向鏡頭、超出格子：改用側面
      const dir = this.dir === 'back' ? 'side' : this.dir;
      // 飛行單位邊播倒下的格子邊從空中掉到地面（加速落下）
      const y0 = b.y;
      const fly = this.flying;
      this.scene.tweens.add({
        targets: st,
        k: 1,
        duration: sh.anims.death.dur * 1000,
        onUpdate: () => {
          const f = sheetFrame(sh, dir, 'death', Math.floor(st.k * sh.anims.death.frames));
          b.setFrame(f);
          cast?.setFrame(f);
          applyPose(b, STILL, this.face, 1, cast, 0);
          if (fly) b.setY(y0 + (groundY - y0) * Math.min(1, Math.pow(st.k / 0.5, 2)));
          if (!landed && st.k > 0.6) {
            landed = true;
            dustFx?.(b.x, groundY);
          }
        },
        onComplete: () => {
          this.scene.tweens.add({
            targets: [b, ...(cast ? [cast] : [])],
            alpha: 0,
            y: '+=3',
            delay: 260,
            duration: 420,
            onComplete: () => {
              b.destroy();
              cast?.destroy();
            },
          });
        },
      });
    } else if (kind === 'death') {
      // 往後倒進地面（有透視縮短），落地彈一下、揚起塵土，再沉下去淡出
      b.setTint(0xffffff);
      const pose = this.pose;
      pose.lean = 0;
      pose.legSwing = 0;
      pose.flap = 0;
      const groundY = this.shadow.y - 1;
      const st = { k: 0 };
      const y0 = b.y;
      const native = this.facesRight ? 1 : -1;
      const fly = this.flying;
      let landed = false;
      // 飛行單位先掉到地上（加速落下），再倒下
      const dropK = fly ? 0.45 : 0;
      const land = (): void => {
        if (landed) return;
        landed = true;
        dustFx?.(b.x, groundY);
      };
      this.scene.tweens.add({
        targets: st,
        k: 1,
        duration: fly ? 640 : 480,
        onUpdate: () => {
          const k = st.k;
          if (fly) b.setY(y0 + (groundY - y0) * Math.min(1, Math.pow(k / dropK, 2)));
          // 倒下：重力加速（二次方）→ 撞地 → 小彈一下
          const q = Math.max(0, (k - dropK) / (1 - dropK));
          const f = q < 0.62 ? Math.pow(q / 0.62, 1.6) : 1 - 0.09 * Math.sin(((q - 0.62) / 0.38) * Math.PI);
          if (q >= 0.62) land();
          pose.fall = f;
          pose.yawTop = 0.35 * f;
          pose.squash = q >= 0.62 ? 0.05 * Math.sin(((q - 0.62) / 0.38) * Math.PI) : 0;
          applyPose(b, pose, this.face, native, cast);
        },
        onComplete: () => {
          land();
          this.scene.tweens.add({
            targets: [b, ...(cast ? [cast] : [])],
            alpha: 0,
            y: '+=3',
            delay: 220,
            duration: 420,
            onComplete: () => {
              b.destroy();
              cast?.destroy();
            },
          });
        },
      });
    } else {
      this.scene.tweens.add({
        targets: [b, ...(cast ? [cast] : [])],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          b.destroy();
          cast?.destroy();
        },
      });
    }
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 300, onComplete: () => this.shadow.destroy() });
  }

  destroy(): void {
    this.dead = true;
    this.body.destroy();
    this.cast?.destroy();
    this.shadow.destroy();
    this.hpBg.destroy();
    this.hpFg.destroy();
    this.aura?.destroy();
    this.auraRing?.destroy();
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
  readonly base: Puppet;
  /** 塔投在地上的影子 */
  private cast: Puppet;
  private units: Puppet[] = [];
  private unitScale: number[] = [];
  private barrel: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private art = '';
  private barrelK = 1 / TEX;
  private lastShot = -10;
  private shooterIdx = 0;
  private buildBar: Phaser.GameObjects.Rectangle[] = [];
  private pose = restPose();
  private unitPose = restPose();

  constructor(
    private scene: Phaser.Scene,
    readonly tower: Tower,
  ) {
    this.cast = new Puppet(scene, tower.x, tower.y, tower.def.art, 4, 6).setOrigin(0.5, TW_BASE / TW_H).setScale(1 / TEX);
    this.cast.setTintFill(0x1a1408).setAlpha(0.3).setDepth(DEPTH.shadow + 0.4);
    this.base = new Puppet(scene, tower.x, tower.y, tower.def.art, 4, 6).setOrigin(0.5, TW_BASE / TW_H).setScale(1 / TEX);
    this.base.setDepth(tower.y);
    this.setArt(tower.def.art);
  }

  setArt(art: string): void {
    if (art === this.art) return;
    this.art = art;
    this.base.setTexture(art);
    this.cast.setTexture(art);
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
        const ox = (tu.n > 1 ? (i === 0 ? -12 : 12) : 0) + (info.unitX ?? 0);
        const u = new Puppet(this.scene, t.x + ox, t.y - info.topY + 4, tu.tex, 3, 5).setOrigin(0.5, 1);
        const sc = tu.h / u.frame.height;
        u.setScale(sc).setDepth(info.behind ? t.y - 0.05 : t.y + 0.5);
        if (tu.tint) u.setTint(tu.tint);
        this.units.push(u);
        this.unitScale.push(sc);
      }
    }
    this.barrelK = (info.barrelScale ?? 1) / TEX;
    if (info.barrel) {
      this.barrel = this.scene.add
        .image(t.x, t.y - (info.barrelY ?? 30), info.barrel)
        .setOrigin(BARREL_ORIGIN.x, BARREL_ORIGIN.y)
        .setScale(this.barrelK)
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
    // 建造中：塔從地裡長出來（先冒出一截、最後回彈）
    const building = simTime < t.buildUntil;
    const p = this.pose;
    p.rise = 1;
    p.squash = 0;
    if (building) {
      const k = Phaser.Math.Clamp(1 - (t.buildUntil - simTime) / 0.6, 0, 1);
      if (!this.buildBar.length) {
        this.buildBar = [
          this.scene.add.rectangle(t.x, t.y - 64, 52, 8, 0x1a0a04).setDepth(DEPTH.hp).setStrokeStyle(1.5, 0x000000),
          this.scene.add.rectangle(t.x - 25, t.y - 64, 2, 5, 0xffd84a).setOrigin(0, 0.5).setDepth(DEPTH.hp + 1),
        ];
      }
      this.buildBar[1].width = 50 * k;
      p.rise = 0.15 + 0.85 * Phaser.Math.Easing.Back.Out(k);
      p.squash = -0.06 * Math.sin(k * Math.PI);
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
    // 開砲：整座塔被後座力壓一下再彈回（砲塔最明顯）
    if (!building && since >= 0 && since < 0.3) {
      const amt = this.barrel ? 0.07 : 0.03;
      p.squash += amt * Math.sin((since / 0.3) * Math.PI) * (1 - since / 0.3);
    }
    applyPose(this.base, p, 1, 1, this.cast, 0.35);
    // 塔上的弓手 / 法師：拉弓（往後仰、扭肩）→ 放箭（往前送）
    const up = this.unitPose;
    const active = simTime - t.lastShotAt < 3;
    this.units.forEach((u, i) => {
      const me = i === this.shooterIdx;
      const draw = me && active && t.cd < 0.3 && t.cd > 0 ? 1 - t.cd / 0.3 : 0;
      const rel = me && since >= 0 && since < 0.22 ? Math.sin((since / 0.22) * Math.PI) : 0;
      up.lean = -0.1 * draw + 0.12 * rel;
      up.yawTop = 0.25 * draw - 0.1 * rel;
      up.squash = -0.05 * draw + 0.04 * rel + Math.sin(time / 400 + i) * 0.015;
      applyPose(u, up, face, 1);
      u.setScale(this.unitScale[i]);
      u.setAlpha(building ? 0 : 1);
    });
    if (this.barrel) {
      const ang = Phaser.Math.Clamp((t.aimX - t.x) / 300, -0.5, 0.5);
      this.barrel.setFlipX(face < 0);
      this.barrel.setRotation(face < 0 ? ang * 0.6 : ang * 0.6);
      const rk = since < 0.25 ? Math.sin((since / 0.25) * Math.PI) : 0;
      this.barrel.setScale(this.barrelK * (1 + rk * 0.12), this.barrelK * (1 - rk * 0.18));
      this.barrel.setAlpha(building ? 0 : 1);
    }
    if (this.glow) {
      const pulse = 0.25 + Math.sin(time / 300) * 0.1;
      const flash = since < 0.3 ? (1 - since / 0.3) * 0.8 : 0;
      this.glow.setAlpha(building ? 0 : pulse + flash);
      this.glow.setScale(0.45 + flash * 0.4);
    }
    const stunned = simTime < t.stunUntil;
    // 冰封 → 藍；熔岩燒停 → 紅；夏儂加護 → 金
    this.base.setTint(stunned ? (t.stunFire ? 0xff8a6a : t.stunWave ? 0x7ad0e8 : 0x8a8aff) : simTime < t.hasteUntil ? 0xffe8a0 : 0xffffff);
  }

  /** 剛蓋好 / 升級的彈跳動畫 */
  pop(): void {
    const b = this.base;
    b.setScale((1 / TEX) * 1.15, (1 / TEX) * 0.8);
    this.scene.tweens.add({ targets: b, scaleX: 1 / TEX, scaleY: 1 / TEX, duration: 420, ease: 'Elastic.easeOut' });
  }

  destroy(): void {
    this.base.destroy();
    this.cast.destroy();
    this.units.forEach((u) => u.destroy());
    this.barrel?.destroy();
    this.glow?.destroy();
    this.buildBar.forEach((b) => b.destroy());
  }
}
