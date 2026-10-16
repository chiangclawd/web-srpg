/** 基本向量 / 亂數工具（純邏輯，不依賴 Phaser，可在 Node 下跑 headless 模擬） */

export interface Vec {
  x: number;
  y: number;
}

/** 塔的射程用「透視橢圓」：水平半徑 r、垂直半徑 r * RANGE_Y。 */
export const RANGE_Y = 0.72;

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** 透視橢圓內判定（塔射程、技能範圍都用這個） */
export function inEllipse(cx: number, cy: number, px: number, py: number, r: number): boolean {
  const dx = px - cx;
  const dy = (py - cy) / RANGE_Y;
  return dx * dx + dy * dy <= r * r;
}

/** 透視距離（用於範圍傷害衰減） */
export function ellipseDist(cx: number, cy: number, px: number, py: number): number {
  const dx = px - cx;
  const dy = (py - cy) / RANGE_Y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Mulberry32 — 小巧、可重現的 PRNG（headless 平衡模擬需要可重現） */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
