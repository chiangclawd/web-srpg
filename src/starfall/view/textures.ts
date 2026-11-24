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
/** 渲染好的地塊圖（BootScene 載入）。載不到的話退回用 Canvas 現畫的版本 */
export const TILE_ATLAS = 'sf_tiles';
/** 冰面佔地圖最大的面積，花樣多一點才看不出重複 */
const ICE_VARIANTS = 8;
/**
 * 有自己一套地塊的主題（冷凍艙、反應爐、戰場）。冰原和船艙用 TILE_ATLAS 那一套。
 * 每套只收那個主題的關卡用得到的地形；圖集裡沒有的地形、或圖集載不到，就退回 TILE_ATLAS。
 */
const THEME_TILES = ['bay', 'reactor', 'field'];

/** 這個主題的地塊圖集叫什麼（沒有自己一套的回傳 null） */
export function themeAtlas(theme: string): string | null {
  return THEME_TILES.includes(theme) ? `sf_tiles_${theme}` : null;
}

/** 把這個主題的地塊圖集排進載入佇列（進到那一關才載入；已經載入過的跳過）。回傳這次是不是真的要載入 */
export function loadThemeTiles(scene: Phaser.Scene, theme: string): boolean {
  const key = themeAtlas(theme);
  // 別章的那一套先放掉：一套是 1536×1920 的貼圖，手機上不要三套都留在記憶體裡
  for (const t of THEME_TILES) if (t !== theme && scene.textures.exists(`sf_tiles_${t}`)) scene.textures.remove(`sf_tiles_${t}`);
  if (!key || scene.textures.exists(key)) return false;
  scene.load.atlas(key, `assets/starfall/tiles_${theme}.webp`, `assets/starfall/tiles_${theme}.json`);
  return true;
}

function variantsOf(id: TerrainId): number {
  return id === 'ice' ? ICE_VARIANTS : TILE_VARIANTS;
}

/** 這一格用哪個花樣（依座標打散，同一張地圖每次都一樣） */
export function tileVariant(id: TerrainId, x: number, y: number): number {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % variantsOf(id);
}

export function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Ctx) => void): void {
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

/** 頂面上往 u 方向（畫面右下）走一整格、而且跟 u = 常數的邊垂直的位移（等角投影下不是 P 的差） */
const NU: [number, number] = [TW / 5, (TW * 2) / 5];

/** 頂面的受光：光從畫面左邊來（跟側面的明暗一致），左上亮、右下暗。要先 clipTop */
function topLight(g: Ctx, z = 0, k = 1): void {
  const [x, y] = P(0, 0, z);
  const gr = g.createLinearGradient(x, y, x + NU[0], y + NU[1]);
  gr.addColorStop(0, `rgba(255,255,255,${0.13 * k})`);
  gr.addColorStop(0.5, 'rgba(255,255,255,0)');
  gr.addColorStop(1, `rgba(6,14,28,${0.15 * k})`);
  g.fillStyle = gr;
  g.fillRect(0, TOP_PAD - z, TW, TH);
}

/** 細碎的顆粒：大面積的平塗才有材質感。要先 clipTop */
function grain(g: Ctx, r: () => number, n: number, z = 0): void {
  for (let i = 0; i < n; i++) {
    const [x, y] = P(r(), r(), z);
    g.fillStyle = i % 3 ? 'rgba(255,255,255,0.10)' : 'rgba(6,14,28,0.14)';
    g.fillRect(x, y, 0.8 + r() * 1.4, 0.5 + r() * 0.5);
  }
}

/** 頂面上的圓（等角投影下是 2:1 的橢圓） */
function disc(g: Ctx, u: number, v: number, rad: number, fill: string, z = 0): void {
  const [x, y] = P(u, v, z);
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rad, rad / 2, 0, 0, Math.PI * 2);
  g.fill();
}

type SidePt = (t: number, z: number) => [number, number];

/** 在兩個側面上畫細節：lit = 朝左下的受光面，另一面朝右下、背光。t 沿著上緣 0..1，z 是高度（往下為負） */
function sides(g: Ctx, z1: number, draw: (pt: SidePt, lit: boolean) => void): void {
  for (const lit of [true, false]) {
    const pt: SidePt = lit ? (t, z) => P(t, 1, z) : (t, z) => P(1, 1 - t, z);
    g.save();
    poly(g, [pt(0, z1), pt(1, z1), pt(1, -DEPTH), pt(0, -DEPTH)]);
    g.clip();
    draw(pt, lit);
    g.restore();
  }
}

/** 方塊落在頂面上的影子（往畫面右下） */
function boxShadow(g: Ctx, u0: number, v0: number, u1: number, v1: number, len: number): void {
  g.save();
  clipTop(g);
  poly(g, [P(u0 + 0.04, v0 + 0.02), P(u1 + len, v0 + 0.02), P(u1 + len, v1), P(u0 + 0.04, v1)]);
  g.fillStyle = 'rgba(6,12,24,0.3)';
  g.fill();
  g.restore();
}

/** 船殼的側面：上緣受光、鋼板的橫縫與直肋、鉚釘；conduit = 導管格柵，側面多一條發光的管線 */
function hullSides(g: Ctx, z1: number, seams: [number, number][], conduit = false): void {
  sides(g, z1, (pt, lit) => {
    line(g, pt(0, z1 - 1), pt(1, z1 - 1), lit ? 'rgba(214,230,246,0.55)' : 'rgba(170,192,218,0.3)', 1.6);
    for (const [dz, a] of seams) {
      line(g, pt(0, z1 - dz), pt(1, z1 - dz), `rgba(10,18,32,${a})`, 1.2);
      line(g, pt(0, z1 - dz - 1.3), pt(1, z1 - dz - 1.3), `rgba(190,212,238,${a * 0.3})`, 0.8);
    }
    const rib = seams[1]?.[0] ?? 46;
    for (const t of [0.34, 0.67]) line(g, pt(t, z1 - 3), pt(t, z1 - rib), 'rgba(10,18,32,0.26)', 1);
    g.fillStyle = 'rgba(10,18,32,0.45)';
    for (const t of [0.08, 0.26, 0.42, 0.59, 0.75, 0.92]) {
      const [x, y] = pt(t, z1 - 8);
      g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }
    if (conduit && lit) {
      g.shadowColor = '#3fd6ff';
      g.shadowBlur = 6;
      line(g, pt(0.14, z1 - 12), pt(0.86, z1 - 12), 'rgba(95,227,255,0.85)', 1.8);
      g.shadowBlur = 0;
    }
  });
}

/** 冰層的側面：橫向的色帶、垂直的裂縫；積雪的話邊緣有雪垂下來 */
function iceSides(g: Ctx, r: () => number, snow: boolean): void {
  sides(g, 0, (pt, lit) => {
    for (const [dz, a, w] of [
      [12, 0.22, 5],
      [30, 0.16, 7],
      [54, 0.1, 9],
    ]) {
      poly(g, [pt(0, -dz), pt(1, -dz), pt(1, -dz - w), pt(0, -dz - w)]);
      g.fillStyle = `rgba(255,255,255,${lit ? a : a * 0.6})`;
      g.fill();
    }
    for (let i = 0; i < 3; i++) {
      const t = 0.12 + r() * 0.76;
      line(g, pt(t, -2), pt(t + (r() - 0.5) * 0.08, -14 - r() * 34), 'rgba(40,90,130,0.35)', 1);
    }
    if (snow) {
      g.fillStyle = lit ? 'rgba(255,255,255,0.96)' : 'rgba(214,232,244,0.96)';
      for (let i = 0; i < 6; i++) {
        const [x, y] = pt((i + 0.5) / 6, 0);
        g.beginPath();
        g.ellipse(x, y + 1, 9, 3 + r() * 4, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      line(g, pt(0, -1.2), pt(1, -1.2), lit ? 'rgba(255,255,255,0.9)' : 'rgba(226,243,252,0.55)', 2.2);
    }
  });
}

function deckTop(g: Ctx, variant: number, glow: boolean): void {
  const r = rng(variant * 5 + (glow ? 17 : 2));
  g.save();
  clipTop(g);
  // 四塊鋼板，明暗略有不同
  for (const [u, v, k] of [
    [0, 0, 0.05],
    [0.5, 0, -0.05],
    [0, 0.5, -0.03],
    [0.5, 0.5, 0.04],
  ]) {
    poly(g, [P(u, v), P(u + 0.5, v), P(u + 0.5, v + 0.5), P(u, v + 0.5)]);
    g.fillStyle = k > 0 ? `rgba(255,255,255,${k})` : `rgba(6,12,24,${-k})`;
    g.fill();
  }
  topLight(g);
  // 甲板接縫：一條暗線，下面貼一條亮線，看起來是凹下去的
  const seam = 'rgba(20,30,46,0.6)';
  const lip = 'rgba(200,220,242,0.2)';
  if (variant !== 1) {
    line(g, P(0.5, 0), P(0.5, 1), seam, 1.3);
    line(g, P(0.515, 0), P(0.515, 1), lip, 0.8);
  }
  if (variant !== 0) {
    line(g, P(0, 0.5), P(1, 0.5), seam, 1.3);
    line(g, P(0, 0.515), P(1, 0.515), lip, 0.8);
  }
  // 內框亮線
  g.strokeStyle = 'rgba(190,215,240,0.16)';
  g.lineWidth = 1;
  poly(g, [P(0.1, 0.1), P(0.9, 0.1), P(0.9, 0.9), P(0.1, 0.9)]);
  g.stroke();
  // 刮痕
  for (let i = 0; i < 5; i++) {
    const u = 0.12 + r() * 0.7;
    const v = 0.12 + r() * 0.7;
    const d = 0.05 + r() * 0.13;
    line(g, P(u, v), i % 2 ? P(u + d, v + d * 0.15) : P(u + d * 0.15, v + d), 'rgba(215,230,245,0.2)', 0.8);
  }
  // 鉚釘
  for (const [u, v] of [
    [0.16, 0.16],
    [0.84, 0.16],
    [0.84, 0.84],
    [0.16, 0.84],
  ]) {
    disc(g, u, v, 1.7, 'rgba(15,24,38,0.65)');
    disc(g, u - 0.008, v - 0.008, 0.7, 'rgba(210,228,245,0.5)');
  }
  if (variant === 1 && !glow) {
    // 通風口：一塊深色的格柵
    poly(g, [P(0.58, 0.16), P(0.86, 0.16), P(0.86, 0.42), P(0.58, 0.42)]);
    g.fillStyle = 'rgba(14,22,36,0.7)';
    g.fill();
    for (let i = 0; i < 4; i++) line(g, P(0.61 + i * 0.065, 0.19), P(0.61 + i * 0.065, 0.39), 'rgba(150,172,198,0.5)', 1);
  }
  if (variant === 2 && !glow) {
    // 角落的警示斜紋
    for (let i = 0; i < 4; i++) {
      poly(g, [P(0.62 + i * 0.1, 0.9), P(0.67 + i * 0.1, 0.9), P(0.72 + i * 0.1, 1), P(0.67 + i * 0.1, 1)]);
      g.fillStyle = i % 2 ? 'rgba(20,24,30,0.7)' : 'rgba(240,190,60,0.75)';
      g.fill();
    }
  }
  grain(g, r, 26);
  if (glow) {
    // 導管：一道凹槽，裡面是發光的青色線
    line(g, P(0.5, 0), P(0.5, 1), 'rgba(8,16,28,0.75)', 6);
    line(g, P(0.2, 0.5), P(0.8, 0.5), 'rgba(8,16,28,0.6)', 4);
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
    topLight(g, 0, 0.7);
    // 雪堆：右下有藍色的陰影，左上是亮面
    for (let i = 0; i < 5; i++) {
      const u = 0.15 + r() * 0.7;
      const v = 0.15 + r() * 0.7;
      const rad = 9 + r() * 7;
      disc(g, u + 0.05, v + 0.03, rad, 'rgba(120,162,198,0.42)');
      disc(g, u, v, rad, 'rgba(250,253,255,0.95)');
      disc(g, u - 0.04, v - 0.02, rad * 0.5, 'rgba(255,255,255,1)');
    }
    for (let i = 0; i < 12; i++) disc(g, r(), r(), 0.9, i % 2 ? 'rgba(255,255,255,0.95)' : 'rgba(150,190,220,0.6)');
  } else {
    // 冰面的亮帶：左上反光、右下透出底下的藍
    const sheen = g.createLinearGradient(0, TOP_PAD, TW, TOP_PAD + TH);
    sheen.addColorStop(0, 'rgba(255,255,255,0.3)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(60,110,150,0.2)');
    g.fillStyle = sheen;
    g.fillRect(0, TOP_PAD, TW, TH);
    // 邊緣的霜
    for (let i = 0; i < 5; i++) {
      const edge = r() < 0.5;
      const a = r();
      const b = r() < 0.5 ? 0.06 : 0.94;
      disc(g, edge ? a : b, edge ? b : a, 7 + r() * 8, 'rgba(255,255,255,0.2)');
    }
    // 大部分的冰面是平的，只有幾種花樣有裂紋、霜斑或薄雪：每一格都有花樣的話，整片看起來像貼磁磚
    const cracks = variant === 3 || variant === 4 ? 1 : variant === 5 ? 2 : 0;
    // 裂紋：下面一道深色的影子，上面一道白線
    for (let i = 0; i < cracks; i++) {
      let u = 0.15 + r() * 0.7;
      let v = 0.15 + r() * 0.7;
      const pts: [number, number][] = [P(u, v)];
      for (let k = 0; k < 4; k++) {
        u += (r() - 0.5) * 0.4;
        v += (r() - 0.5) * 0.4;
        pts.push(P(u, v));
      }
      for (const [dy, color, w] of [
        [1, 'rgba(48,104,148,0.5)', 1.4],
        [0, i % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(226,244,255,0.7)', 1],
      ] as [number, string, number][]) {
        g.strokeStyle = color;
        g.lineWidth = w;
        g.beginPath();
        pts.forEach(([x, y], k) => (k ? g.lineTo(x, y + dy) : g.moveTo(x, y + dy)));
        g.stroke();
      }
    }
    if (variant === 6) {
      // 一大片霜，上面有反光
      disc(g, 0.45 + r() * 0.1, 0.45 + r() * 0.1, 22, 'rgba(255,255,255,0.16)');
      const su = 0.25 + r() * 0.2;
      const sv = 0.35 + r() * 0.2;
      line(g, P(su, sv), P(su + 0.2, sv - 0.16), 'rgba(255,255,255,0.5)', 1.6);
      line(g, P(su + 0.07, sv + 0.05), P(su + 0.2, sv - 0.05), 'rgba(255,255,255,0.32)', 1);
    }
    // 不畫小雪堆：會跟「積雪」地形（移動要 2 點）搞混
    if (variant === 7) disc(g, 0.2 + r() * 0.15, 0.7 + r() * 0.15, 20, 'rgba(255,255,255,0.14)');
    for (let i = 0; i < 6; i++) disc(g, r(), r(), 0.8, 'rgba(255,255,255,0.8)');
  }
  g.restore();
}

function drawTile(g: Ctx, id: TerrainId, variant: number): void {
  if (id === 'chasm') return;
  const r = rng(variant * 13 + id.length * 3);
  if (id === 'ice' || id === 'snow') {
    const c = id === 'snow' ? SNOW : ICE;
    box(g, 0, 0, 1, 1, -DEPTH, 0, c.top, c.side, true);
    iceSides(g, r, id === 'snow');
    iceTop(g, variant, id === 'snow');
    gridEdge(g);
    return;
  }
  if (id === 'wall') {
    // 艙壁：比地面高兩層的鋼牆
    const z = EH * 2;
    box(g, 0, 0, 1, 1, -DEPTH, z, 0x4a5a74, 0x2c3850, true);
    hullSides(g, z, [
      [42, 0.45],
      [70, 0.3],
      [100, 0.14],
    ]);
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
    topLight(g, z);
    line(g, P(0.5, 0, z), P(0.5, 1, z), 'rgba(15,24,38,0.6)', 1.2);
    grain(g, r, 16, z);
    g.restore();
    gridEdge(g, z);
    return;
  }
  box(g, 0, 0, 1, 1, -DEPTH, 0, id === 'rubble' ? 0x586a82 : DECK.top, DECK.side, true);
  hullSides(
    g,
    0,
    [
      [20, 0.5],
      [46, 0.3],
      [74, 0.14],
    ],
    id === 'grate',
  );
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
    const rr = rng(variant + 11);
    disc(g, 0.52, 0.52, 30, 'rgba(8,14,26,0.28)');
    for (let i = 0; i < 6; i++) {
      const u = 0.18 + rr() * 0.55;
      const v = 0.18 + rr() * 0.55;
      const s = 0.14 + rr() * 0.14;
      const z = 3 + rr() * 9;
      const v1 = v + s * (0.6 + rr() * 0.6);
      boxShadow(g, u, v, u + s, v1, 0.07);
      box(g, u, v, u + s, v1, 0, z, i === 2 ? 0xd9772e : i % 2 ? 0x8494aa : 0x4c5a70, i === 2 ? 0x9a4f1c : 0x303c50);
      line(g, P(u, v, z), P(u, v1, z), 'rgba(255,255,255,0.3)', 0.8);
    }
  } else if (id === 'barricade') {
    // 貨櫃掩體：靠後方兩側的貨櫃，單位站在前面
    boxShadow(g, 0.04, 0.04, 0.96, 0.3, 0.14);
    boxShadow(g, 0.04, 0.3, 0.3, 0.96, 0.16);
    box(g, 0.04, 0.04, 0.96, 0.3, 0, 20, 0xe07a2e, 0xa8551c);
    box(g, 0.04, 0.3, 0.3, 0.96, 0, 20, 0xdfe6ee, 0x9aa6b6);
    box(g, 0.3, 0.06, 0.62, 0.28, 20, 32, 0x3c4a60, 0x283446);
    // 貨櫃的浪板、上緣的亮邊
    for (let i = 1; i < 7; i++) line(g, P(0.04 + i * 0.13, 0.3, 2), P(0.04 + i * 0.13, 0.3, 18), 'rgba(90,40,10,0.35)', 1);
    for (let i = 1; i < 5; i++) line(g, P(0.3, 0.3 + i * 0.13, 2), P(0.3, 0.3 + i * 0.13, 18), 'rgba(90,104,124,0.4)', 1);
    line(g, P(0.04, 0.3, 20), P(0.96, 0.3, 20), 'rgba(255,214,170,0.6)', 1);
    line(g, P(0.04, 0.96, 20), P(0.3, 0.96, 20), 'rgba(255,255,255,0.7)', 1);
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
  ic_parts: (g) => {
    stroke(g, 6);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.lineTo(32 + Math.cos(a) * 25, 32 + Math.sin(a) * 25);
    }
    g.closePath();
    g.stroke();
    g.beginPath();
    g.arc(32, 32, 9, 0, Math.PI * 2);
    g.stroke();
  },
  ic_plating: (g) => {
    stroke(g, 5);
    g.beginPath();
    g.moveTo(32, 7);
    g.lineTo(54, 15);
    g.lineTo(54, 32);
    g.quadraticCurveTo(54, 49, 32, 58);
    g.quadraticCurveTo(10, 49, 10, 32);
    g.lineTo(10, 15);
    g.closePath();
    g.stroke();
    line(g, [32, 20], [32, 44], '#fff', 5);
    line(g, [20, 32], [44, 32], '#fff', 5);
  },
  ic_firepower: (g) => {
    stroke(g, 5);
    g.beginPath();
    g.arc(32, 32, 19, 0, Math.PI * 2);
    g.stroke();
    for (const [a, b] of [
      [[32, 4], [32, 20]],
      [[32, 44], [32, 60]],
      [[4, 32], [20, 32]],
      [[44, 32], [60, 32]],
    ] as [[number, number], [number, number]][]) line(g, a, b, '#fff', 5);
    g.beginPath();
    g.arc(32, 32, 4, 0, Math.PI * 2);
    g.fill();
  },
  ic_mod: (g) => {
    stroke(g, 4);
    g.strokeRect(17, 17, 30, 30);
    g.fillRect(26, 26, 12, 12);
    for (const k of [24, 32, 40]) {
      line(g, [k, 6], [k, 17], '#fff', 4);
      line(g, [k, 47], [k, 58], '#fff', 4);
      line(g, [6, k], [17, k], '#fff', 4);
      line(g, [47, k], [58, k], '#fff', 4);
    }
  },
  // 獎章（成就）：兩條緞帶、圓牌、中間一顆星
  ic_medal: (g) => {
    stroke(g, 4);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(32 + s * 18, 3);
      g.lineTo(32 + s * 7, 3);
      g.lineTo(32 + s * 1, 22);
      g.lineTo(32 + s * 11, 26);
      g.closePath();
      g.fill();
    }
    g.beginPath();
    g.arc(32, 41, 18, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4.6 : 11;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(32 + Math.cos(a) * r, 41.5 + Math.sin(a) * r);
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
  if (!scene.textures.exists(TILE_ATLAS)) for (const id of ids) for (let v = 0; v < variantsOf(id); v++) canvasTex(scene, tileKey(id, v), TW, TILE_TEX_H, (g) => drawTile(g, id, v));
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
