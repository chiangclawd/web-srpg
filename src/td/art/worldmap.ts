import { catmullRom } from '../sim/Path';
import type { Vec } from '../sim/math';
import { artRng, circle, ellipse, fillStroke, mkCanvas, poly, rgrad, shade, alpha, type Ctx } from './paint';
import { drawAltar, drawCactus, drawCastle, drawDeadTree, drawDuneRipples, drawHouse, drawPalm, drawPine, drawTree, drawTent } from './scenery';

/**
 * 世界地圖：羊皮紙風格大陸。南方草原（王國）→ 中部森林 → 北方雪原 → 東方楓林 → 東北蠻族要塞。
 * 座標同關卡 1280×720（mapPos 比例 × 尺寸）。
 */
export function paintWorldMap(
  w: number,
  h: number,
  offX: number,
  s: number,
  nodes: (Vec & { theme: string; bonus?: boolean })[],
  /** base：只畫地形（不含路線、羅盤、暗角），給 AI 重繪當構圖參考 */
  opts: { base?: boolean } = {},
): HTMLCanvasElement {
  // 外傳關卡不在主線路線上
  const main = nodes.filter((n) => !n.bonus);
  const [cv, ctx] = mkCanvas(w * s, h * s);
  ctx.scale(s, s);
  ctx.translate(offX, 0);
  const rnd = artRng(99);
  const x0 = -offX;
  // 海
  const sea = ctx.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, '#3a6a8a');
  sea.addColorStop(1, '#2a5070');
  ctx.fillStyle = sea;
  ctx.fillRect(x0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    const x = x0 + rnd() * w;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.quadraticCurveTo(x, y - 3, x + 8, y);
    ctx.stroke();
  }
  // 大陸輪廓
  const land: Vec[] = [];
  const cx = 640;
  const cy = 370;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 1 + 0.07 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 11);
    land.push({ x: cx + Math.cos(a) * 690 * r, y: cy + Math.sin(a) * 340 * r });
  }
  const shape = catmullRom([...land, land[0], land[1]], 6);
  const pathLand = () => {
    ctx.beginPath();
    ctx.moveTo(shape[0].x, shape[0].y);
    for (const p of shape) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  };
  // 淺灘
  ctx.save();
  pathLand();
  ctx.lineWidth = 40;
  ctx.strokeStyle = 'rgba(140,200,220,0.35)';
  ctx.stroke();
  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(200,230,230,0.45)';
  ctx.stroke();
  ctx.restore();
  pathLand();
  ctx.fillStyle = '#9cba6a';
  ctx.fill();
  ctx.save();
  pathLand();
  ctx.clip();
  // 地區色塊
  const region = (x: number, y: number, r: number, c: string, a: number) => {
    ctx.fillStyle = rgrad(ctx, x, y, r * 0.2, r, alpha(c, a), alpha(c, 0));
    circle(ctx, x, y, r);
    ctx.fill();
  };
  // 依各關主題在節點周圍鋪地區色
  const REGION: Record<string, string> = { grass: '#a8c870', forest: '#4f8a3a', snow: '#eef4f8', autumn: '#c8a24a', waste: '#6a5a5e', desert: '#ecd28c' };
  for (const n of nodes) {
    // 沙漠要蓋過周圍的草原色，加深一些
    if (n.theme === 'desert') region(n.x, n.y, 230, REGION.desert, 0.95);
    region(n.x, n.y, n.theme === 'waste' ? 190 : 210, REGION[n.theme] ?? '#a8c870', 0.75);
  }
  // 紙張紋理
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '60,40,10' : '255,250,230'},${0.04 + rnd() * 0.05})`;
    ctx.fillRect(x0 + rnd() * w, rnd() * h, 2, 2);
  }
  // 河流
  const river = catmullRom(
    [
      { x: 720, y: 60 },
      { x: 640, y: 220 },
      { x: 520, y: 360 },
      { x: 430, y: 520 },
      { x: 360, y: 760 },
    ],
    20,
  );
  ctx.strokeStyle = '#4a8ab0';
  ctx.lineWidth = 10;
  ctx.beginPath();
  river.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = '#7ab8d8';
  ctx.lineWidth = 4;
  ctx.stroke();
  // 山脈
  const mountain = (x: number, y: number, sc: number, snow: boolean) => {
    poly(ctx, [x - 36 * sc, y, x - 4 * sc, y - 58 * sc, x + 34 * sc, y]);
    const g = ctx.createLinearGradient(x - 36 * sc, 0, x + 34 * sc, 0);
    g.addColorStop(0, '#b8a88a');
    g.addColorStop(0.5, '#8a7a62');
    g.addColorStop(1, '#5a4c3a');
    fillStroke(ctx, g, 2.5, '#3a2a18');
    if (snow) {
      poly(ctx, [x - 16 * sc, y - 32 * sc, x - 4 * sc, y - 58 * sc, x + 10 * sc, y - 36 * sc, x + 2 * sc, y - 30 * sc, x - 6 * sc, y - 36 * sc]);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  };
  // 依主題在節點周圍散佈景物（避開節點與路線）
  const nearNode = (x: number, y: number, r: number) => nodes.some((n) => Math.hypot(n.x - x, n.y - y) < r);
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  for (const n of nodes) {
    const count = n.theme === 'waste' ? 12 : 16;
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 50 + rnd() * 110;
      const x = n.x + Math.cos(a) * d;
      const y = n.y + Math.sin(a) * d * 0.7;
      if (nearNode(x, y, 44) || x < 60 || x > 1220 || y < 40 || y > 690) continue;
      switch (n.theme) {
        case 'snow':
          if (rnd() < 0.35) items.push({ y, draw: () => mountain(x, y, 0.6 + rnd() * 0.5, true) });
          else items.push({ y, draw: () => drawPine(ctx, x, y, 10, '#2f5f4c', true) });
          break;
        case 'forest':
          items.push({ y, draw: () => (rnd() < 0.5 ? drawPine(ctx, x, y, 11, '#2f6a34', false) : drawTree(ctx, x, y, 11, ['#3f8a2c', '#4f9a33'], rnd, false)) });
          break;
        case 'autumn':
          if (rnd() < 0.2) items.push({ y, draw: () => mountain(x, y, 0.5 + rnd() * 0.4, false) });
          else items.push({ y, draw: () => drawTree(ctx, x, y, 10, ['#d9822b', '#c4512a', '#e3a93a'], rnd, false) });
          break;
        case 'waste':
          if (rnd() < 0.3) items.push({ y, draw: () => mountain(x, y, 0.5 + rnd() * 0.4, false) });
          else items.push({ y, draw: () => drawDeadTree(ctx, x, y, 12, rnd) });
          break;
        case 'desert':
          if (rnd() < 0.5) items.push({ y, draw: () => drawCactus(ctx, x, y, 9, rnd) });
          else if (rnd() < 0.6) items.push({ y, draw: () => drawPalm(ctx, x, y, 9, rnd) });
          else items.push({ y, draw: () => drawDuneRipples(ctx, x, y, rnd) });
          break;
        default:
          items.push({ y, draw: () => drawTree(ctx, x, y, 10, ['#4f9a33', '#5fae3c'], rnd, false) });
      }
    }
  }
  // 北方遠山
  for (let i = 0; i < 18; i++) {
    const x = 380 + rnd() * 760;
    const y = 50 + rnd() * 50;
    if (!nearNode(x, y, 70)) items.push({ y, draw: () => mountain(x, y, 0.7 + rnd() * 0.5, true) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  // 王都與村莊
  drawCastle(ctx, 120, 640, 0.55);
  drawHouse(ctx, 300, 600, 0.45);
  drawHouse(ctx, 380, 650, 0.4);
  // 教派深淵之門（最終關附近）
  const last = main[main.length - 1];
  if (last) {
    drawAltar(ctx, last.x + 70, last.y - 40, 0.7);
    ctx.fillStyle = rgrad(ctx, last.x + 70, last.y - 60, 4, 70, 'rgba(160,60,255,0.45)', 'rgba(160,60,255,0)');
    circle(ctx, last.x + 70, last.y - 60, 70);
    ctx.fill();
  }
  // 蠻族營地（北方）
  drawTent(ctx, 1040, 70, 0.55, '#8a3a2a');
  drawTent(ctx, 1080, 86, 0.45, '#6a2a1a');
  ctx.restore();
  // 海岸線描邊
  pathLand();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#5a4a2a';
  ctx.stroke();
  if (opts.base) return cv;
  // 路線虛線
  const road = catmullRom(main, 20);
  ctx.setLineDash([8, 9]);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(60,30,10,0.55)';
  ctx.beginPath();
  road.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f0d8a0';
  ctx.stroke();
  // 外傳路線（金色虛線，只連外傳關卡）
  const side = nodes.filter((n) => n.bonus);
  if (side.length >= 2) {
    const sr = catmullRom(side, 20);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(90,50,10,0.55)';
    ctx.beginPath();
    sr.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffc860';
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // 羅盤
  compass(ctx, 1180, 600);
  // 暗角
  const vg = ctx.createRadialGradient(640, 360, 300, 640, 360, 900);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,10,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(x0, 0, w, h);
  void shade;
  void ellipse;
  return cv;
}

/** 地圖路線（主線與外傳），手繪地圖時由 MapScene 用向量線畫在圖上 */
export function mapRoads(nodes: (Vec & { bonus?: boolean })[]): { main: Vec[]; side: Vec[] } {
  const main = nodes.filter((n) => !n.bonus);
  const side = nodes.filter((n) => n.bonus);
  return { main: main.length >= 2 ? catmullRom(main, 20) : [], side: side.length >= 2 ? catmullRom(side, 20) : [] };
}

function compass(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  circle(ctx, 0, 0, 42);
  fillStroke(ctx, 'rgba(244,226,184,0.85)', 2.5, '#5a3a1a');
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    poly(ctx, [0, -38, 7, -7, 0, 0, -7, -7]);
    fillStroke(ctx, i % 2 ? '#c0392b' : '#3a2a1a', 1.5);
  }
  ctx.fillStyle = '#3a2412';
  ctx.font = 'bold 13px serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -46);
  ctx.restore();
}
