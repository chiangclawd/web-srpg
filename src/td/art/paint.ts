/**
 * Canvas 2D 卡通繪圖小工具：粗描邊、漸層、明暗。所有程序美術都建立在這上面。
 */

export type Ctx = CanvasRenderingContext2D;

export function mkCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

export function hexToRgb(hex: string): [number, number, number] {
  if (hex.startsWith('rgb')) {
    const m = hex.match(/[\d.]+/g) ?? ['0', '0', '0'];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgb(r: number, g: number, b: number, a = 1): string {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

/** amt > 0 變亮、< 0 變暗（-1..1） */
export function shade(hex: string, amt: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgb(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt, alpha);
  const k = 1 + amt;
  return rgb(r * k, g * k, b * k, alpha);
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgb(r, g, b, a);
}

export const OUTLINE = '#2a1a0c';

/** 描邊 + 填色（先畫路徑再呼叫） */
export function fillStroke(ctx: Ctx, fill: string | CanvasGradient, lw = 3, stroke = OUTLINE): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function poly(ctx: Ctx, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/** 垂直漸層 */
export function vgrad(ctx: Ctx, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

/** 水平漸層（圓柱體明暗） */
export function hgrad(ctx: Ctx, x0: number, x1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function rgrad(ctx: Ctx, x: number, y: number, r0: number, r1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

/** 圓柱體橫向明暗（左亮右暗） */
export function cylGrad(ctx: Ctx, x0: number, x1: number, base: string): CanvasGradient {
  return hgrad(ctx, x0, x1, [
    [0, shade(base, -0.15)],
    [0.25, shade(base, 0.22)],
    [0.55, base],
    [1, shade(base, -0.45)],
  ]);
}

/** 地面陰影 */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.32): void {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.7, `rgba(0,0,0,${a * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 石塊紋理：在矩形區域內畫一排排石磚 */
export function stoneBricks(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, rows: number, seed = 1): void {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const rh = h / rows;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? 0 : -rh * 0.8;
    let cx = x + off;
    while (cx < x + w) {
      const bw = rh * (1.4 + rnd() * 0.8);
      const shadeAmt = (rnd() - 0.5) * 0.18;
      roundRect(ctx, cx + 1, y + r * rh + 1, bw - 2, rh - 2, Math.min(4, rh * 0.25));
      ctx.fillStyle = shade(base, shadeAmt);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = shade(base, -0.5, 0.75);
      ctx.stroke();
      // 石塊高光
      ctx.fillStyle = shade(base, 0.35, 0.35);
      ctx.fillRect(cx + 3, y + r * rh + 2.5, bw - 8, Math.max(1, rh * 0.15));
      cx += bw;
    }
  }
  ctx.restore();
}

/** 木板紋理（直條） */
export function planks(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, n: number): void {
  const pw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shade(base, (i % 2 ? -0.06 : 0.04) + (i === 0 ? 0.08 : 0));
    ctx.fillRect(x + i * pw, y, pw, h);
    ctx.strokeStyle = shade(base, -0.5, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + i * pw, y);
    ctx.lineTo(x + i * pw, y + h);
    ctx.stroke();
  }
}

/** 城垛（矩形頂端一排凸起） */
export function crenels(ctx: Ctx, x: number, y: number, w: number, mh: number, n: number, base: string): void {
  const mw = w / (n * 2 - 1);
  for (let i = 0; i < n; i++) {
    const mx = x + i * mw * 2;
    roundRect(ctx, mx, y - mh, mw, mh + 2, 2);
    fillStroke(ctx, vgrad(ctx, y - mh, y, shade(base, 0.2), shade(base, -0.1)), 2.5);
  }
}

/** 旗幟 */
export function flag(ctx: Ctx, x: number, y: number, h: number, color: string, wave = 1): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  ctx.strokeStyle = '#d9b46a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  const fw = h * 0.62 * wave;
  const fh = h * 0.36;
  ctx.beginPath();
  ctx.moveTo(x + 1, y - h + 2);
  ctx.quadraticCurveTo(x + fw * 0.5, y - h - 4, x + fw, y - h + fh * 0.25);
  ctx.lineTo(x + fw * 0.8, y - h + fh * 0.6);
  ctx.quadraticCurveTo(x + fw * 0.5, y - h + fh * 1.1, x + 1, y - h + fh);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, y - h, y - h + fh, shade(color, 0.2), shade(color, -0.2)), 2);
}

/** 簡單的確定性 PRNG（美術用） */
export function artRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
