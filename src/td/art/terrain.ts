import { Path, catmullRom } from '../sim/Path';
import type { LevelDef } from '../sim/defs';
import type { Vec } from '../sim/math';
import { artRng, circle, ellipse, groundShadow, mkCanvas, rgrad, shade, alpha, type Ctx } from './paint';
import {
  THEMES,
  drawAltar,
  drawBush,
  drawCactus,
  drawCampfire,
  drawCastle,
  drawDeadTree,
  drawDuneRipples,
  drawFlowers,
  drawHouse,
  drawPalm,
  drawPine,
  drawRock,
  drawRuin,
  drawTent,
  drawTree,
  type ThemePalette,
} from './scenery';

export const PATH_W = 58;

/** 有 AI 手繪背景的關卡（public/assets/levels/<id>.webp，以程序背景為構圖重繪，道路位置相同） */
export const PAINTED_LEVELS = new Set(['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11', 'l12', 'l13', 'l14']);

export function levelArtKey(id: string): string {
  return `lvbg_${id}`;
}

/**
 * 關卡背景：一張大畫布（WORLD_W × 720，乘上解析度倍率）。
 * 玩法座標 (x,y) → 畫布座標 ((x + offX) * s, y * s)。
 */
export function paintLevel(level: LevelDef, worldW: number, offX: number, s: number): HTMLCanvasElement {
  const H = 720;
  const [cv, ctx] = mkCanvas(worldW * s, H * s);
  const th = THEMES[level.theme];
  const rnd = artRng(level.seed * 7919 + 13);
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(offX, 0);
  const x0 = -offX;
  const x1 = worldW - offX;

  // 1) 地面底色 + 大塊明暗斑
  ctx.fillStyle = th.ground;
  ctx.fillRect(x0, 0, worldW, H);
  for (let i = 0; i < 260; i++) {
    const x = x0 + rnd() * worldW;
    const y = rnd() * H;
    const r = 30 + rnd() * 110;
    const light = rnd() < 0.5;
    ctx.fillStyle = rgrad(ctx, x, y, 0, r, alpha(light ? th.groundLight : th.groundDark, 0.28), alpha(light ? th.groundLight : th.groundDark, 0));
    circle(ctx, x, y, r);
    ctx.fill();
  }

  const paths = level.paths.map((p) => new Path(p));
  const near = (x: number, y: number, pad: number) => paths.some((p) => p.nearest({ x, y }).dist < PATH_W / 2 + pad);
  const nearSpot = (x: number, y: number, pad: number) => level.spots.some((sp) => Math.hypot(sp.x - x, (sp.y - y) * 1.4) < pad);
  const decor = level.decor ?? [];
  const clearZones = decor.filter((d): d is Extract<typeof d, { kind: 'clear' }> => d.kind === 'clear');
  const inClear = (x: number, y: number) => clearZones.some((c) => Math.hypot(c.x - x, c.y - y) < c.r);

  // 2) 草叢筆觸
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 2600; i++) {
    const x = x0 + rnd() * worldW;
    const y = rnd() * H;
    if (near(x, y, 2)) continue;
    const c = rnd() < 0.5 ? th.tuft : th.groundLight;
    ctx.strokeStyle = alpha(c, 0.55);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 1, y - 4, x + (rnd() - 0.5) * 6, y - 6 - rnd() * 4);
    ctx.stroke();
  }

  // 3) 水域（在路之前畫，橋會蓋在上面）
  for (const d of decor) {
    if (d.kind === 'river') paintRiver(ctx, d.points, d.width, th);
    if (d.kind === 'lake') paintLake(ctx, d.x, d.y, d.rx, d.ry, th);
  }

  // 4) 道路
  paintPaths(ctx, level.paths, th, rnd);

  // 5) 橋
  for (const d of decor) if (d.kind === 'bridge') paintBridge(ctx, d.x, d.y, d.length);

  // 6) 出口城門 / 入口標記
  // 7) 裝飾物：收集後依 y 排序再畫（近的蓋遠的）
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  const blocked = (x: number, y: number, pad: number) => near(x, y, pad) || nearSpot(x, y, 52) || inClear(x, y);

  for (const d of decor) {
    switch (d.kind) {
      case 'house':
        items.push({ y: d.y, draw: () => drawHouse(ctx, d.x, d.y, d.scale ?? 1, level.theme === 'autumn' ? '#8a4a2a' : '#b5482e', th.snowy) });
        break;
      case 'castle':
        items.push({ y: d.y, draw: () => drawCastle(ctx, d.x, d.y, 0.8) });
        break;
      case 'camp':
        items.push({ y: d.y - 10, draw: () => drawTent(ctx, d.x - 30, d.y - 10, 0.9, '#8a5a3a') });
        items.push({ y: d.y + 10, draw: () => drawTent(ctx, d.x + 34, d.y + 6, 0.8, '#7a3a2a') });
        items.push({ y: d.y + 20, draw: () => drawCampfire(ctx, d.x + 2, d.y + 26) });
        break;
      case 'tower_ruin':
        items.push({ y: d.y, draw: () => drawRuin(ctx, d.x, d.y, 1) });
        break;
      case 'altar':
        items.push({ y: d.y, draw: () => drawAltar(ctx, d.x, d.y, 1) });
        break;
      case 'rocks':
        for (let i = 0; i < d.n; i++) {
          const x = d.x + (rnd() - 0.5) * 90;
          const y = d.y + (rnd() - 0.5) * 50;
          if (blocked(x, y, 14)) continue;
          const r = 7 + rnd() * 12;
          items.push({ y, draw: () => drawRock(ctx, x, y, r, th.rock, rnd, th.snowy) });
        }
        break;
      case 'trees':
        for (let i = 0; i < d.n; i++) {
          const a = rnd() * Math.PI * 2;
          const rr = Math.sqrt(rnd()) * d.r;
          const x = d.x + Math.cos(a) * rr;
          const y = d.y + Math.sin(a) * rr * 0.7;
          if (blocked(x, y, 26)) continue;
          items.push({ y, draw: () => tree(ctx, x, y, 20 + rnd() * 10, th, level.theme, rnd) });
        }
        break;
      default:
        break;
    }
  }

  // 程序散佈：邊緣森林帶 + 零星灌木/石頭/花
  const density = level.theme === 'forest' ? 1.6 : level.theme === 'snow' ? 0.8 : level.theme === 'desert' ? 0.55 : 1;
  const edgeTrees = Math.round(120 * density);
  for (let i = 0; i < edgeTrees; i++) {
    // 偏向畫面邊緣
    let x: number;
    let y: number;
    const side = rnd();
    if (side < 0.3) {
      x = x0 + rnd() * worldW;
      y = rnd() * 70;
    } else if (side < 0.55) {
      x = x0 + rnd() * worldW;
      y = H - rnd() * 40;
    } else if (side < 0.78) {
      x = x0 + rnd() * (offX + 60);
      y = rnd() * H;
    } else {
      x = x1 - rnd() * (offX + 60);
      y = rnd() * H;
    }
    if (blocked(x, y, 30)) continue;
    const r = 18 + rnd() * 12;
    items.push({ y, draw: () => tree(ctx, x, y, r, th, level.theme, rnd) });
  }
  for (let i = 0; i < 70 * density; i++) {
    const x = x0 + rnd() * worldW;
    const y = 40 + rnd() * (H - 60);
    if (blocked(x, y, 20)) continue;
    const k = rnd();
    if (k < 0.35) {
      const r = 9 + rnd() * 6;
      if (level.theme === 'desert') items.push({ y, draw: () => drawCactus(ctx, x, y, r * 0.9, rnd) });
      else items.push({ y, draw: () => drawBush(ctx, x, y, r, th.canopy[0], rnd) });
    } else if (k < 0.55) {
      const r = 5 + rnd() * 7;
      items.push({ y, draw: () => drawRock(ctx, x, y, r, th.rock, rnd, th.snowy) });
    } else if (k < 0.62 && level.theme !== 'snow') {
      const r = 16 + rnd() * 8;
      items.push({ y, draw: () => tree(ctx, x, y, r, th, level.theme, rnd) });
    } else {
      items.push({ y: y - 100, draw: () => drawFlowers(ctx, x, y, th.flower, rnd) });
    }
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // 8) 荒地：裂痕與紫色微光；秋天：落葉
  if (level.theme === 'waste') {
    for (let i = 0; i < 70; i++) {
      const x = x0 + rnd() * worldW;
      const y = rnd() * H;
      if (near(x, y, 6)) continue;
      ctx.strokeStyle = 'rgba(30,18,12,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      let cx = x;
      let cy = y;
      for (let k = 0; k < 4; k++) {
        cx += (rnd() - 0.5) * 26;
        cy += (rnd() - 0.5) * 12;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = x0 + rnd() * worldW;
      const y = rnd() * H;
      ctx.fillStyle = rgrad(ctx, x, y, 0, 26, 'rgba(180,90,255,0.22)', 'rgba(180,90,255,0)');
      circle(ctx, x, y, 26);
      ctx.fill();
    }
  }
  if (level.theme === 'desert') {
    for (let i = 0; i < 90; i++) {
      const x = x0 + rnd() * worldW;
      const y = rnd() * H;
      if (near(x, y, 30)) continue;
      drawDuneRipples(ctx, x, y, rnd);
    }
  }
  if (level.theme === 'autumn') {
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = alpha(['#d9822b', '#c4512a', '#e3a93a'][i % 3], 0.7);
      ellipse(ctx, x0 + rnd() * worldW, rnd() * H, 2.2, 1.3);
      ctx.fill();
    }
  }

  // 9) 外框暗角
  const vg = ctx.createRadialGradient(worldW / 2 - offX, H / 2, H * 0.45, worldW / 2 - offX, H / 2, worldW * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,10,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(x0, 0, worldW, H);
  ctx.restore();
  return cv;
}

function tree(ctx: Ctx, x: number, y: number, r: number, th: ThemePalette, theme: string, rnd: () => number): void {
  if (theme === 'desert') {
    if (rnd() < 0.45) drawPalm(ctx, x, y, r * 0.95, rnd);
    else drawCactus(ctx, x, y, r * 0.75, rnd);
    return;
  }
  if (theme === 'waste') {
    if (rnd() < 0.6) drawDeadTree(ctx, x, y, r * 1.2, rnd);
    else drawPine(ctx, x, y, r * 0.9, th.pine, false);
    return;
  }
  if (theme === 'snow' || (theme === 'forest' && rnd() < 0.45)) drawPine(ctx, x, y, r * 0.95, th.pine, th.snowy);
  else drawTree(ctx, x, y, r, th.canopy, rnd, th.snowy);
}

/** 道路：先畫所有路的外緣，再畫所有路面 → 交會處無縫 */
function paintPaths(ctx: Ctx, ctrlPaths: Vec[][], th: ThemePalette, rnd: () => number): void {
  const dense = ctrlPaths.map((c) => extendPath(catmullRom(c, 24)));
  const stroke = (pts: Vec[], w: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };
  // 外陰影
  for (const p of dense) stroke(p, PATH_W + 16, alpha(th.groundDark, 0.45));
  for (const p of dense) stroke(p, PATH_W + 6, th.pathEdge);
  for (const p of dense) stroke(p, PATH_W - 2, shade(th.path, -0.08));
  for (const p of dense) stroke(p, PATH_W - 16, th.path);
  for (const p of dense) stroke(p, PATH_W - 34, alpha(shade(th.path, 0.15), 0.6));
  // 車轍
  for (const ctrl of ctrlPaths) {
    const path = new Path(ctrl);
    for (const off of [-11, 11]) {
      ctx.strokeStyle = alpha(shade(th.path, -0.35), 0.22);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let d = 0; d < path.length; d += 8) {
        const q = path.posAt(d, off);
        if (d === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    // 碎石
    for (let d = 0; d < path.length; d += 9) {
      if (rnd() < 0.55) continue;
      const q = path.posAt(d, (rnd() - 0.5) * (PATH_W - 14));
      ctx.fillStyle = alpha(shade(th.path, rnd() < 0.5 ? -0.3 : 0.25), 0.8);
      ellipse(ctx, q.x, q.y, 1.5 + rnd() * 2, 1 + rnd() * 1.2);
      ctx.fill();
    }
    // 路邊草叢
    for (let d = 0; d < path.length; d += 7) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.5) continue;
        const q = path.posAt(d, side * (PATH_W / 2 + 1 + rnd() * 3));
        ctx.strokeStyle = alpha(th.tuft, 0.9);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y + 2);
        ctx.lineTo(q.x + (rnd() - 0.5) * 4, q.y - 5 - rnd() * 4);
        ctx.stroke();
      }
    }
  }
}

/** 路徑首尾各延伸 260px，讓路一路延伸到畫布邊緣外 */
function extendPath(pts: Vec[]): Vec[] {
  if (pts.length < 2) return pts;
  const a = pts[0];
  const b = pts[Math.min(4, pts.length - 1)];
  const la = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const z = pts[pts.length - 1];
  const y = pts[Math.max(0, pts.length - 5)];
  const lz = Math.hypot(z.x - y.x, z.y - y.y) || 1;
  return [
    { x: a.x + ((a.x - b.x) / la) * 260, y: a.y + ((a.y - b.y) / la) * 260 },
    ...pts,
    { x: z.x + ((z.x - y.x) / lz) * 260, y: z.y + ((z.y - y.y) / lz) * 260 },
  ];
}

function paintRiver(ctx: Ctx, ctrl: Vec[], width: number, th: ThemePalette): void {
  const pts = catmullRom(ctrl, 24);
  const stroke = (w: number, c: string) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  stroke(width + 18, alpha('#6b5536', 0.55));
  stroke(width + 8, '#8a7a5a');
  stroke(width, shade(th.water, -0.2));
  stroke(width - 14, th.water);
  stroke(width - 36, shade(th.water, 0.18));
  // 波光
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (let i = 4; i < pts.length - 4; i += 6) {
    const p = pts[i];
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y);
    ctx.quadraticCurveTo(p.x, p.y - 3, p.x + 8, p.y);
    ctx.stroke();
  }
}

function paintLake(ctx: Ctx, x: number, y: number, rx: number, ry: number, th: ThemePalette): void {
  groundShadow(ctx, x, y + 4, rx + 14, ry + 8, 0.25);
  ctx.fillStyle = '#8a7a5a';
  ellipse(ctx, x, y, rx + 6, ry + 5);
  ctx.fill();
  ctx.fillStyle = shade(th.water, -0.2);
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.fillStyle = th.water;
  ellipse(ctx, x, y - 2, rx - 8, ry - 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.18);
  ctx.fill();
}

function paintBridge(ctx: Ctx, x: number, y: number, len: number): void {
  const w = PATH_W + 6;
  groundShadow(ctx, x, y + w / 2 + 6, len * 0.55, 8, 0.4);
  ctx.save();
  ctx.translate(x, y);
  // 木板
  const n = Math.round(len / 9);
  for (let i = 0; i < n; i++) {
    const px = -len / 2 + i * (len / n);
    ctx.fillStyle = shade('#9a6b3c', (i % 3) * 0.06 - 0.05);
    ctx.fillRect(px, -w / 2, len / n - 1, w);
    ctx.strokeStyle = '#3b2412';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(px, -w / 2, len / n - 1, w);
  }
  // 欄杆
  for (const sy of [-w / 2, w / 2]) {
    ctx.fillStyle = '#7a4e28';
    ctx.fillRect(-len / 2, sy - 4, len, 6);
    ctx.strokeStyle = '#3b2412';
    ctx.lineWidth = 2;
    ctx.strokeRect(-len / 2, sy - 4, len, 6);
    for (let i = 0; i <= 4; i++) {
      const px = -len / 2 + (i * len) / 4;
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(px - 3, sy - 10, 6, 12);
      ctx.strokeRect(px - 3, sy - 10, 6, 12);
    }
  }
  ctx.restore();
}

/** 建造點：泥土圓台 + 石圈 */
export function paintBuildSpot(s: number, snowy: boolean): HTMLCanvasElement {
  const W = 92;
  const H = 56;
  const [cv, ctx] = mkCanvas(W * s, H * s);
  ctx.scale(s, s);
  const cx = W / 2;
  const cy = H / 2 + 2;
  groundShadow(ctx, cx, cy + 4, 44, 20, 0.35);
  ctx.fillStyle = snowy ? '#9a8a74' : '#7a5a34';
  ellipse(ctx, cx, cy, 38, 18);
  ctx.fill();
  ctx.fillStyle = rgrad(ctx, cx - 6, cy - 4, 2, 34, snowy ? '#c8b89e' : '#b08a58', snowy ? '#a2927a' : '#8a6a40');
  ellipse(ctx, cx, cy - 1, 33, 15);
  ctx.fill();
  const rnd = artRng(5);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = cx + Math.cos(a) * 37;
    const y = cy + Math.sin(a) * 17;
    ctx.fillStyle = shade('#a8a296', (rnd() - 0.5) * 0.3);
    ellipse(ctx, x, y, 5 + rnd() * 2, 3.5 + rnd());
    ctx.fill();
    ctx.strokeStyle = '#3a3026';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  return cv;
}
