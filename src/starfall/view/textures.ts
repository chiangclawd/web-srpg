// 程序繪圖的紋理：等角地塊、範圍標示、圖示、發電機、特效用的光點。
// 全部在開機時用 Canvas 畫一次（解析度 TEX 倍），不需要圖檔。
import Phaser from 'phaser';
import { TEX } from '../config';
import { DEPTH, EH, TH, TOP_PAD, TW } from './iso';
import type { TerrainId } from '../sim/types';

type Ctx = CanvasRenderingContext2D;

export const TILE_TEX_H = TOP_PAD + TH + DEPTH;
/** 每種地形有幾個花樣（依座標挑一個，地面才不會像貼磁磚） */
export const TILE_VARIANTS = 3;

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, Math.ceil(w * TEX), Math.ceil(h * TEX));
  if (!t) return;
  const g = t.getContext();
  g.scale(TEX, TEX);
  draw(g);
  t.refresh();
}

/** 固定種子的亂數（同一個花樣每次畫出來都一樣） */
function rng(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** 地塊座標 (u, v ∈ 0..1, z 往上的像素) → 紋理座標 */
const P = (u: number, v: number, z = 0): [number, number] => [TW / 2 + ((u - v) * TW) / 2, TOP_PAD + ((u + v) * TH) / 2 - z];

function poly(g: Ctx, pts: [number, number][]): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

function shade(hex: number, k: number): string {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const gr = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return `rgb(${r},${gr},${b})`;
}

/** 等角方塊：頂面 + 朝左下、朝右下兩個側面。fade：側面往下漸淡到透明（地塊本體用） */
function box(g: Ctx, u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, top: number, side: number, fade = false): void {
  const face = (pts: [number, number][], k: number): void => {
    poly(g, pts);
    if (fade) {
      const y0 = Math.min(...pts.map((p) => p[1]));
      const y1 = Math.max(...pts.map((p) => p[1]));
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, shade(side, k));
      gr.addColorStop(0.45, shade(side, k * 0.7));
      gr.addColorStop(1, 'rgba(8,14,24,0)');
      g.fillStyle = gr;
    } else {
      g.fillStyle = shade(side, k);
    }
    g.fill();
  };
  face([P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)], 1);
  face([P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)], 0.72);
  poly(g, [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)]);
  g.fillStyle = shade(top, 1);
  g.fill();
}

function clipTop(g: Ctx, z = 0): void {
  poly(g, [P(0, 0, z), P(1, 0, z), P(1, 1, z), P(0, 1, z)]);
  g.clip();
}

function line(g: Ctx, a: [number, number], b: [number, number], color: string, w: number): void {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
}

/** 頂面的格線：上緣亮、下緣暗，格子才分得清楚 */
function gridEdge(g: Ctx, z = 0): void {
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(...P(0, 1, z));
  g.lineTo(...P(0, 0, z));
  g.lineTo(...P(1, 0, z));
  g.stroke();
  g.strokeStyle = 'rgba(4,10,20,0.45)';
  g.beginPath();
  g.moveTo(...P(0, 1, z));
  g.lineTo(...P(1, 1, z));
  g.lineTo(...P(1, 0, z));
  g.stroke();
}

const DECK = { top: 0x6a7d96, side: 0x3c4a60 };
const ICE = { top: 0xb9deef, side: 0x6f9db8 };
const SNOW = { top: 0xeaf4fa, side: 0x8fb4c8 };

function deckTop(g: Ctx, variant: number, glow: boolean): void {
  g.save();
  clipTop(g);
  // 甲板接縫
  const seam = 'rgba(20,30,46,0.55)';
  if (variant !== 1) line(g, P(0.5, 0), P(0.5, 1), seam, 1.2);
  if (variant !== 0) line(g, P(0, 0.5), P(1, 0.5), seam, 1.2);
  // 內框亮線
  g.strokeStyle = 'rgba(190,215,240,0.16)';
  g.lineWidth = 1;
  poly(g, [P(0.1, 0.1), P(0.9, 0.1), P(0.9, 0.9), P(0.1, 0.9)]);
  g.stroke();
  // 鉚釘
  g.fillStyle = 'rgba(15,24,38,0.6)';
  for (const [u, v] of [
    [0.16, 0.16],
    [0.84, 0.16],
    [0.84, 0.84],
    [0.16, 0.84],
  ]) {
    const [x, y] = P(u, v);
    g.beginPath();
    g.ellipse(x, y, 1.6, 0.9, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (variant === 2 && !glow) {
    // 角落的警示斜紋
    for (let i = 0; i < 4; i++) {
      poly(g, [P(0.62 + i * 0.1, 0.9), P(0.67 + i * 0.1, 0.9), P(0.72 + i * 0.1, 1), P(0.67 + i * 0.1, 1)]);
      g.fillStyle = i % 2 ? 'rgba(20,24,30,0.7)' : 'rgba(240,190,60,0.75)';
      g.fill();
    }
  }
  if (glow) {
    // 導管：發光的青色線
    g.shadowColor = '#3fd6ff';
    g.shadowBlur = 8;
    line(g, P(0.5, 0), P(0.5, 1), 'rgba(95,227,255,0.95)', 2.4);
    line(g, P(0.2, 0.5), P(0.8, 0.5), 'rgba(95,227,255,0.7)', 1.4);
    g.shadowBlur = 0;
  }
  g.restore();
}

function iceTop(g: Ctx, variant: number, snow: boolean): void {
  const r = rng(variant * 7 + (snow ? 31 : 3));
  g.save();
  clipTop(g);
  if (snow) {
    // 雪堆的陰影
    for (let i = 0; i < 5; i++) {
      const [x, y] = P(0.15 + r() * 0.7, 0.15 + r() * 0.7);
      g.fillStyle = 'rgba(150,185,210,0.35)';
      g.beginPath();
      g.ellipse(x, y + 2, 9 + r() * 8, 3 + r() * 2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(x, y, 9 + r() * 6, 3 + r() * 2, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // 冰面的亮帶與裂紋
    const gr = g.createLinearGradient(0, TOP_PAD, TW, TOP_PAD + TH);
    gr.addColorStop(0, 'rgba(255,255,255,0.28)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(60,110,150,0.22)');
    g.fillStyle = gr;
    g.fillRect(0, TOP_PAD, TW, TH);
    for (let i = 0; i < 2 + variant; i++) {
      let u = r();
      let v = r();
      g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(70,125,165,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(...P(u, v));
      for (let k = 0; k < 3; k++) {
        u += (r() - 0.5) * 0.45;
        v += (r() - 0.5) * 0.45;
        g.lineTo(...P(u, v));
      }
      g.stroke();
    }
  }
  g.restore();
}

function drawTile(g: Ctx, id: TerrainId, variant: number): void {
  if (id === 'chasm') return;
  if (id === 'ice' || id === 'snow') {
    const c = id === 'snow' ? SNOW : ICE;
    box(g, 0, 0, 1, 1, -DEPTH, 0, c.top, c.side, true);
    iceTop(g, variant, id === 'snow');
    gridEdge(g);
    return;
  }
  if (id === 'wall') {
    // 艙壁：比地面高兩層的鋼牆
    const z = EH * 2;
    box(g, 0, 0, 1, 1, -DEPTH, z, 0x4a5a74, 0x2c3850, true);
    // 側面的燈條與警示帶
    g.shadowColor = '#3fd6ff';
    g.shadowBlur = 6;
    line(g, P(0.08, 1, z - 12), P(0.92, 1, z - 12), 'rgba(95,227,255,0.9)', 2);
    g.shadowBlur = 0;
    for (let i = 0; i < 6; i++) {
      poly(g, [P(1, 0.05 + i * 0.15, z - 22), P(1, 0.12 + i * 0.15, z - 22), P(1, 0.19 + i * 0.15, z - 30), P(1, 0.12 + i * 0.15, z - 30)]);
      g.fillStyle = 'rgba(240,190,60,0.7)';
      g.fill();
    }
    g.save();
    clipTop(g, z);
    line(g, P(0.5, 0, z), P(0.5, 1, z), 'rgba(15,24,38,0.6)', 1.2);
    g.restore();
    gridEdge(g, z);
    return;
  }
  box(g, 0, 0, 1, 1, -DEPTH, 0, id === 'rubble' ? 0x586a82 : DECK.top, DECK.side, true);
  deckTop(g, variant, id === 'grate');
  gridEdge(g);
  if (id === 'machine') {
    // 機組的底座：一圈深色的圓盤，上面擺場景裡的大型設備
    g.save();
    clipTop(g);
    g.fillStyle = 'rgba(16,24,38,0.75)';
    g.beginPath();
    g.ellipse(TW / 2, TOP_PAD + TH / 2, TW * 0.4, TH * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(95,227,255,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  } else if (id === 'rubble') {
    // 殘骸堆：幾塊歪斜的鋼板和一截橘色外殼
    const r = rng(variant + 11);
    for (let i = 0; i < 6; i++) {
      const u = 0.18 + r() * 0.55;
      const v = 0.18 + r() * 0.55;
      const s = 0.14 + r() * 0.14;
      const z = 3 + r() * 9;
      box(g, u, v, u + s, v + s * (0.6 + r() * 0.6), 0, z, i === 2 ? 0xd9772e : i % 2 ? 0x8494aa : 0x4c5a70, i === 2 ? 0x9a4f1c : 0x303c50);
    }
  } else if (id === 'barricade') {
    // 貨櫃掩體：靠後方兩側的貨櫃，單位站在前面
    box(g, 0.04, 0.04, 0.96, 0.3, 0, 20, 0xe07a2e, 0xa8551c);
    box(g, 0.04, 0.3, 0.3, 0.96, 0, 20, 0xdfe6ee, 0x9aa6b6);
    box(g, 0.3, 0.06, 0.62, 0.28, 20, 32, 0x3c4a60, 0x283446);
    line(g, P(0.06, 0.3, 12), P(0.96, 0.3, 12), 'rgba(30,20,10,0.5)', 1.2);
  }
}

/** 範圍標示用的菱形（白色，使用時染色） */
function drawOverlay(g: Ctx, kind: 'fill' | 'edge' | 'dot' | 'zone'): void {
  const pts: [number, number][] = [
    [TW / 2, 1],
    [TW - 2, TH / 2],
    [TW / 2, TH - 1],
    [2, TH / 2],
  ];
  if (kind === 'fill') {
    poly(g, pts);
    const gr = g.createRadialGradient(TW / 2, TH / 2, 2, TW / 2, TH / 2, TW / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0.85)');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 1.5;
    g.stroke();
  } else if (kind === 'edge') {
    poly(g, pts);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.stroke();
  } else if (kind === 'zone') {
    g.setLineDash([7, 5]);
    poly(g, pts);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2.5;
    g.stroke();
    g.setLineDash([]);
    poly(g, pts);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fill();
  } else {
    g.fillStyle = '#ffffff';
    poly(g, [
      [TW / 2, TH / 2 - 6],
      [TW / 2 + 12, TH / 2],
      [TW / 2, TH / 2 + 6],
      [TW / 2 - 12, TH / 2],
    ]);
    g.fill();
  }
}

/** 維生發電機：底座 + 發光的爐心柱 */
function drawGenerator(g: Ctx): void {
  const cx = 60;
  const base = 104;
  const ell = (y: number, rx: number, ry: number, fill: string): void => {
    g.fillStyle = fill;
    g.beginPath();
    g.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  const col = (y0: number, y1: number, rx: number, ry: number, c0: string, c1: string): void => {
    const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.fillRect(cx - rx, y1, rx * 2, y0 - y1);
    ell(y0, rx, ry, c1);
    ell(y1, rx, ry, c0);
  };
  col(base, base - 16, 38, 17, '#6a7d96', '#2c3850');
  g.shadowColor = '#5fe3ff';
  g.shadowBlur = 16;
  col(base - 16, base - 70, 17, 8, '#c8fbff', '#3fb8e0');
  g.shadowBlur = 0;
  for (const dx of [-28, 28]) {
    g.fillStyle = '#3c4a60';
    g.fillRect(cx + dx - 4, base - 78, 8, 70);
  }
  col(base - 70, base - 84, 34, 15, '#8494aa', '#3c4a60');
  ell(base - 84, 14, 6, '#ff9a3c');
  g.strokeStyle = '#0b1220';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(cx, base - 84, 34, 15, 0, 0, Math.PI * 2);
  g.stroke();
}

type IconFn = (g: Ctx) => void;
const stroke = (g: Ctx, w = 5): void => {
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
};

/** 64×64 的白色線條圖示（使用時染色） */
const ICONS: Record<string, IconFn> = {
  ic_attack: (g) => {
    stroke(g, 4);
    g.beginPath();
    g.arc(32, 32, 17, 0, Math.PI * 2);
    g.stroke();
    for (const [x0, y0, x1, y1] of [
      [32, 6, 32, 20],
      [32, 44, 32, 58],
      [6, 32, 20, 32],
      [44, 32, 58, 32],
    ])
      line(g, [x0, y0], [x1, y1], '#fff', 4);
    g.beginPath();
    g.arc(32, 32, 3.5, 0, Math.PI * 2);
    g.fill();
  },
  ic_overwatch: (g) => {
    stroke(g, 4);
    g.beginPath();
    g.moveTo(6, 32);
    g.quadraticCurveTo(32, 6, 58, 32);
    g.quadraticCurveTo(32, 58, 6, 32);
    g.stroke();
    g.beginPath();
    g.arc(32, 32, 8, 0, Math.PI * 2);
    g.fill();
  },
  ic_wait: (g) => {
    stroke(g, 4);
    g.beginPath();
    g.arc(32, 32, 22, 0, Math.PI * 2);
    g.stroke();
    line(g, [32, 32], [32, 17], '#fff', 4);
    line(g, [32, 32], [43, 38], '#fff', 4);
  },
  ic_undo: (g) => {
    stroke(g, 5);
    g.beginPath();
    g.arc(34, 36, 17, Math.PI * 1.15, Math.PI * 0.5);
    g.stroke();
    g.beginPath();
    g.moveTo(8, 18);
    g.lineTo(22, 16);
    g.lineTo(18, 30);
    g.closePath();
    g.fill();
  },
  ic_end: (g) => {
    stroke(g, 5);
    g.beginPath();
    g.moveTo(14, 14);
    g.lineTo(36, 32);
    g.lineTo(14, 50);
    g.closePath();
    g.fill();
    g.fillRect(42, 12, 8, 40);
  },
  ic_menu: (g) => {
    stroke(g, 6);
    for (const y of [18, 32, 46]) line(g, [12, y], [52, y], '#fff', 6);
  },
  ic_stun: (g) => {
    stroke(g, 3);
    g.beginPath();
    g.moveTo(36, 4);
    g.lineTo(14, 36);
    g.lineTo(30, 36);
    g.lineTo(24, 60);
    g.lineTo(50, 26);
    g.lineTo(34, 26);
    g.closePath();
    g.fill();
  },
  ic_star: (g) => {
    stroke(g, 3);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 12 : 28;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  },
  ic_lock: (g) => {
    stroke(g, 5);
    g.fillRect(14, 28, 36, 28);
    g.beginPath();
    g.arc(32, 28, 12, Math.PI, 0);
    g.stroke();
  },
  sk_focus: (g) => {
    stroke(g, 5);
    for (const y of [18, 32, 46]) {
      line(g, [8, y], [36, y], '#fff', 5);
      g.beginPath();
      g.moveTo(40, y - 8);
      g.lineTo(58, y);
      g.lineTo(40, y + 8);
      g.closePath();
      g.fill();
    }
  },
  sk_shock: (g) => {
    stroke(g, 5);
    g.beginPath();
    g.arc(14, 32, 8, 0, Math.PI * 2);
    g.fill();
    for (const r of [20, 32, 44]) {
      g.beginPath();
      g.arc(14, 32, r, -0.6, 0.6);
      g.stroke();
    }
  },
  sk_pierce: (g) => {
    stroke(g, 6);
    line(g, [6, 32], [46, 32], '#fff', 6);
    g.beginPath();
    g.moveTo(44, 18);
    g.lineTo(60, 32);
    g.lineTo(44, 46);
    g.closePath();
    g.fill();
    for (const x of [16, 30]) line(g, [x, 16], [x, 48], '#fff', 3);
  },
  sk_leap: (g) => {
    stroke(g, 5);
    g.beginPath();
    g.moveTo(8, 52);
    g.quadraticCurveTo(30, -6, 50, 34);
    g.stroke();
    g.beginPath();
    g.moveTo(40, 30);
    g.lineTo(52, 44);
    g.lineTo(58, 26);
    g.closePath();
    g.fill();
    line(g, [6, 58], [22, 58], '#fff', 4);
  },
  sk_rally: (g) => {
    stroke(g, 5);
    // 旗子：督戰令
    line(g, [16, 8], [16, 58], '#fff', 5);
    g.beginPath();
    g.moveTo(18, 10);
    g.lineTo(54, 20);
    g.lineTo(18, 34);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(42, 48, 9, Math.PI * 0.2, Math.PI * 1.8);
    g.stroke();
  },
  sk_repair: (g) => {
    stroke(g, 5);
    g.fillRect(25, 8, 14, 48);
    g.fillRect(8, 25, 48, 14);
  },
  sk_overload: (g) => {
    stroke(g, 4);
    g.beginPath();
    g.arc(32, 32, 24, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(35, 10);
    g.lineTo(20, 34);
    g.lineTo(31, 34);
    g.lineTo(27, 54);
    g.lineTo(44, 28);
    g.lineTo(33, 28);
    g.closePath();
    g.fill();
  },
};

export function tileKey(id: TerrainId, variant: number): string {
  return `tile_${id}_${variant}`;
}

export function makeTextures(scene: Phaser.Scene): void {
  const ids: TerrainId[] = ['deck', 'grate', 'ice', 'snow', 'rubble', 'barricade', 'wall', 'machine'];
  for (const id of ids) for (let v = 0; v < TILE_VARIANTS; v++) canvasTex(scene, tileKey(id, v), TW, TILE_TEX_H, (g) => drawTile(g, id, v));
  for (const k of ['fill', 'edge', 'dot', 'zone'] as const) canvasTex(scene, `ov_${k}`, TW, TH, (g) => drawOverlay(g, k));
  canvasTex(scene, 'generator', 120, 124, drawGenerator);
  for (const [k, fn] of Object.entries(ICONS)) canvasTex(scene, k, 64, 64, fn);
  canvasTex(scene, 'shadow', 64, 32, (g) => {
    g.scale(1, 0.5);
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(32, 32, 30, 0, Math.PI * 2);
    g.fill();
  });
  canvasTex(scene, 'glow', 64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, 'ring', 64, 64, (g) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(32, 32, 27, 0, Math.PI * 2);
    g.stroke();
  });
  // 面向箭頭（朝右的小三角，放在單位腳邊）
  canvasTex(scene, 'arrow', 20, 20, (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(4, 3);
    g.lineTo(17, 10);
    g.lineTo(4, 17);
    g.closePath();
    g.fill();
  });
  canvasTex(scene, 'px', 8, 8, (g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 8, 8);
  });
}
