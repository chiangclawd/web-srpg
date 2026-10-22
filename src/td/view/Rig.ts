import type { Puppet } from './Puppet';

/** 步態：決定單張手繪圖怎麼「動起來」 */
export type Gait = 'walk' | 'quad' | 'heavy' | 'fly' | 'float' | 'skitter' | 'slither';

const GAIT_BY_TEX: Record<string, Gait> = {
  sp_enemy_flier: 'fly',
  mon_bat: 'fly',
  mon_demon: 'fly',
  mon_wraith: 'float',
  mon_frost_sprite: 'float',
  mon_wolf: 'quad',
  sp_enemy_cavalry: 'quad',
  sp_player_cavalry: 'quad',
  mon_scorpion: 'skitter',
  mon_reef_crab: 'skitter',
  mon_troll: 'heavy',
  mon_golem: 'heavy',
  mon_lava_golem: 'heavy',
  mon_yeti: 'heavy',
  mon_frost_giant: 'heavy',
  mon_fire_lord: 'heavy',
  mon_wyrm: 'slither',
  mon_leviathan: 'slither',
};

export function gaitFor(tex: string, flying: boolean): Gait {
  return GAIT_BY_TEX[tex] ?? (flying ? 'fly' : 'walk');
}

/** 一個姿勢：全部以貼圖寬 / 高的比例表示，跟單位大小無關 */
export interface Pose {
  /** 腰部、肩膀的轉身角度（弧度，正值 = 往前方轉） */
  yawHip: number;
  yawTop: number;
  /** 頭頂往前傾（寬度比例） */
  lean: number;
  /** 腳往前擺（寬度比例） */
  legSwing: number;
  /** 腰以上抬高（高度比例） */
  bob: number;
  /** 正 = 壓扁、負 = 拉長（體積守恆：壓扁時變寬） */
  squash: number;
  /** 以腳底為支點前後擺（弧度） */
  rock: number;
  /** 翅膀上下（-1..1） */
  flap: number;
  /** 斗篷 / 幽靈下襬飄動 */
  ripple: number;
  rippleAmp: number;
  /** 四足：前半身抬高（正）或後半身抬高（負） */
  pitch: number;
  /** 蛇形：身體左右擺動 */
  wave: number;
  waveAmp: number;
  /** 0..1 倒地（往後倒進地面，有透視縮短） */
  fall: number;
  /** 0..1 從地面長出來（蓋塔） */
  rise: number;
}

export function restPose(): Pose {
  return { yawHip: 0, yawTop: 0, lean: 0, legSwing: 0, bob: 0, squash: 0, rock: 0, flap: 0, ripple: 0, rippleAmp: 0, pitch: 0, wave: 0, waveAmp: 0, fall: 0, rise: 1 };
}

// 圓柱面的弧度：轉身時圖案沿著圓柱滑動，近的一側變寬、遠的一側變窄
const K = 0.75;
const SK = Math.sin(K);
const CK = Math.cos(K);
/** 光從左上前方來：右側較暗，腳邊有一點環境遮蔽 */
const LX = -0.55;
const LZ = 0.84;
/** 投影陰影往右下方拉長（跟手繪地圖上房子的影子同方向） */
export const SHADOW_SX = 0.55;
export const SHADOW_SY = 0.16;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * 把姿勢寫進網格頂點。
 * face：畫面上朝右 = 1、朝左 = -1；native：貼圖本身朝右 = 1、朝左 = -1。
 * shadow：同一個姿勢投在地上的影子（可省略）。
 * shadeAmt：立體明暗強度（建築本身已經畫好光影，給小一點）。
 */
export function applyPose(p: Puppet, pose: Pose, face: number, native: number, shadow: Puppet | null = null, shadeAmt = 1): void {
  const fw = p.frame.realWidth;
  const ox = p.displayOriginX;
  const oy = p.displayOriginY;
  const half = fw / 2;
  const cols = p.cols;
  const rows = p.rows;
  const fallA = pose.fall * 1.38;
  const fs = Math.sin(fallA);
  const fc = Math.cos(fallA);
  // 裁切過的圖表：格子只鋪在 frame.x/y 起、cutWidth × cutHeight 的範圍（一般貼圖這兩個位移是 0）
  const fr = p.frame;
  for (let r = 0; r <= rows; r++) {
    const by = fr.y + (r / rows) * fr.cutHeight - oy;
    const Y0 = -by;
    const h = oy > 0 ? Math.min(1, Math.max(0, Y0 / oy)) : 0;
    const twist = smooth(0.25, 0.85, h);
    const yaw = pose.yawHip + (pose.yawTop - pose.yawHip) * twist;
    const sy = Math.sin(yaw);
    const bul = Math.sin(Math.PI * h);
    for (let c = 0; c <= cols; c++) {
      const i = r * (cols + 1) + c;
      const bx = fr.x + (c / cols) * fr.cutWidth - ox;
      // 往前 = +x 的座標系
      const uf = (bx / half) * native;
      const a0 = K * uf;
      const af = a0 + yaw;
      // 轉身：只取跟靜止時的差，靜止時圖案完全不變形
      let X = uf * half + (half * (Math.sin(af) - sy * CK - Math.sin(a0))) / SK;
      let Yv = Y0 * (1 + 0.12 * (Math.cos(af) - Math.cos(a0)));
      Yv *= 1 - pose.squash;
      X *= 1 + pose.squash * 0.7 * (0.4 + 0.6 * bul);
      if (pose.rise < 1) Yv *= pose.rise;
      Yv += pose.bob * oy * smooth(0, 0.35, h);
      if (pose.legSwing) X += pose.legSwing * fw * Math.pow(Math.max(0, 1 - h / 0.33), 1.5);
      if (pose.lean) X += pose.lean * fw * Math.pow(h, 1.6);
      if (pose.flap) {
        const wing = Math.min(1, Math.max(0, (Math.abs(uf) - 0.2) / 0.8)) * smooth(0.25, 0.65, h);
        Yv += pose.flap * oy * 0.25 * wing;
        X *= 1 - Math.abs(pose.flap) * 0.12 * wing;
      }
      if (pose.rippleAmp) X += pose.rippleAmp * fw * Math.sin(pose.ripple - h * 5) * Math.pow(1 - h, 1.5);
      if (pose.pitch) Yv += pose.pitch * oy * uf * smooth(0.2, 0.5, h);
      if (pose.waveAmp) X += pose.waveAmp * fw * Math.sin(pose.wave + h * 5) * (0.3 + 0.7 * h);
      if (pose.rock) {
        const x0 = X;
        X += Yv * pose.rock;
        Yv -= x0 * pose.rock * 0.5;
      }
      if (pose.fall) {
        // 以腳跟為支點往後倒，同時被「壓」到斜看的地面上（躺平後變扁），不是整片卡片旋轉
        const x0 = X;
        X = x0 * fc - Yv * fs;
        Yv = (x0 * fs + Yv * fc) * (1 - 0.38 * pose.fall);
      }
      const sx = face * X;
      p.px[i] = sx;
      p.py[i] = -Yv;
      // 圓柱面的法線 → 明暗
      const nx = face * Math.sin(af);
      const lam = LX * nx + LZ * Math.cos(af);
      let sh = 0.66 + 0.36 * Math.max(0, lam);
      sh *= 0.78 + 0.22 * smooth(0, 0.2, h);
      sh *= 1 - 0.18 * pose.fall;
      p.shade[i] = 1 - (1 - Math.min(1, sh)) * shadeAmt;
      if (shadow) {
        const ys = Math.max(0, Yv);
        shadow.px[i] = sx + ys * SHADOW_SX;
        shadow.py[i] = ys * SHADOW_SY;
        shadow.va[i] = 1 - 0.6 * h;
      }
    }
  }
}
