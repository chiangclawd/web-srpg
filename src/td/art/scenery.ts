import {
  OUTLINE,
  circle,
  crenels,
  ellipse,
  fillStroke,
  flag,
  groundShadow,
  poly,
  rgrad,
  roundRect,
  shade,
  stoneBricks,
  vgrad,
  type Ctx,
} from './paint';
import type { ThemeId } from '../sim/defs';

export interface ThemePalette {
  ground: string;
  groundLight: string;
  groundDark: string;
  path: string;
  pathEdge: string;
  canopy: string[];
  pine: string;
  trunk: string;
  rock: string;
  flower: string[];
  snowy: boolean;
  water: string;
  tuft: string;
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  grass: {
    ground: '#7dae47',
    groundLight: '#97c459',
    groundDark: '#5e8f34',
    path: '#cfa76a',
    pathEdge: '#8d6a3b',
    canopy: ['#4f9a33', '#5fae3c', '#3f8a2c'],
    pine: '#3c7a35',
    trunk: '#6b4423',
    rock: '#9c9a90',
    flower: ['#ffe066', '#ff8fa3', '#ffffff', '#b7a4ff'],
    snowy: false,
    water: '#4aa3d8',
    tuft: '#4f8a2e',
  },
  forest: {
    ground: '#4f8436',
    groundLight: '#629c42',
    groundDark: '#3a6828',
    path: '#b8925a',
    pathEdge: '#6f5130',
    canopy: ['#2f7032', '#3b8139', '#275f2c'],
    pine: '#2a5f34',
    trunk: '#5a3a1e',
    rock: '#8a8d84',
    flower: ['#e8f0a0', '#b7e0ff', '#ffffff'],
    snowy: false,
    water: '#3d8fbf',
    tuft: '#2f6424',
  },
  snow: {
    ground: '#e3ebf2',
    groundLight: '#ffffff',
    groundDark: '#bccbd9',
    path: '#b8a487',
    pathEdge: '#7f6c56',
    canopy: ['#3c6b55', '#477a60', '#335d4a'],
    pine: '#2f5f4c',
    trunk: '#5a3e28',
    rock: '#8e98a3',
    flower: ['#ffffff', '#d6ecff'],
    snowy: true,
    water: '#8fc8e8',
    tuft: '#9fb2c4',
  },
  autumn: {
    ground: '#a9a24b',
    groundLight: '#c2b65c',
    groundDark: '#8a8238',
    path: '#d1a86c',
    pathEdge: '#8a6338',
    canopy: ['#d9822b', '#c4512a', '#e3a93a', '#b8a03a'],
    pine: '#5a6e2c',
    trunk: '#5e3b20',
    rock: '#a0968a',
    flower: ['#ffcf5c', '#ff8a5c', '#ffffff'],
    snowy: false,
    water: '#4b98c4',
    tuft: '#7f7a2c',
  },
  waste: {
    ground: '#77695a',
    groundLight: '#8a7b69',
    groundDark: '#5c5046',
    path: '#a89070',
    pathEdge: '#5e4c3a',
    canopy: ['#5a5a3a', '#4c4c32'],
    pine: '#3f4630',
    trunk: '#3e2c1e',
    rock: '#7f7a74',
    flower: ['#c8a0ff', '#a0e0ff'],
    snowy: false,
    water: '#5a7a6a',
    tuft: '#4c4234',
  },
  desert: {
    ground: '#dcbc78',
    groundLight: '#ead08f',
    groundDark: '#c29e5a',
    path: '#c49a5c',
    pathEdge: '#8a6236',
    canopy: ['#5f9a3a', '#6fae44', '#4f8a30'],
    pine: '#4f8a30',
    trunk: '#8a6236',
    rock: '#c4865a',
    flower: ['#ff8a5c', '#ffd36b', '#ff5c7a'],
    snowy: false,
    water: '#3ab0c0',
    tuft: '#b49a50',
  },
  volcano: {
    ground: '#4e403a',
    groundLight: '#62514a',
    groundDark: '#382c28',
    path: '#8a6a52',
    pathEdge: '#4a3426',
    canopy: ['#4a4a30', '#3c3c28'],
    pine: '#36382a',
    trunk: '#2e221a',
    rock: '#46403e',
    flower: ['#ff9a3a', '#ffcf5c'],
    snowy: false,
    // 湖泊畫成熔岩池
    water: '#ff6a1a',
    tuft: '#3a302a',
  },
};

/** 圓頂闊葉樹 */
export function drawTree(ctx: Ctx, x: number, y: number, r: number, colors: string[], rnd: () => number, snowy = false): void {
  groundShadow(ctx, x + r * 0.25, y + 2, r * 1.05, r * 0.42, 0.3);
  // 樹幹
  roundRect(ctx, x - r * 0.14, y - r * 0.55, r * 0.28, r * 0.6, 3);
  fillStroke(ctx, shade('#6b4423', 0), 2.5);
  const col = colors[Math.floor(rnd() * colors.length)];
  const blobs: [number, number, number][] = [
    [x, y - r * 1.05, r * 0.72],
    [x - r * 0.5, y - r * 0.72, r * 0.55],
    [x + r * 0.5, y - r * 0.7, r * 0.56],
    [x + r * 0.1, y - r * 1.45, r * 0.5],
  ];
  // 外框：先粗描邊再填色 → 只留下聯集外輪廓
  ctx.lineWidth = 5;
  ctx.strokeStyle = shade(col, -0.7);
  for (const [bx, by, br] of blobs) {
    circle(ctx, bx, by, br);
    ctx.stroke();
  }
  for (const [bx, by, br] of blobs) {
    circle(ctx, bx, by, br);
    ctx.fillStyle = rgrad(ctx, bx - br * 0.35, by - br * 0.4, br * 0.1, br * 1.1, shade(col, 0.18), shade(col, -0.25));
    ctx.fill();
  }
  // 高光葉團
  ctx.fillStyle = shade(col, 0.35, 0.55);
  for (let i = 0; i < 4; i++) {
    const a = -2.3 + rnd() * 1.2;
    const d = r * (0.3 + rnd() * 0.4);
    circle(ctx, x + Math.cos(a) * d, y - r * 1.1 + Math.sin(a) * d, r * (0.12 + rnd() * 0.1));
    ctx.fill();
  }
  if (snowy) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ellipse(ctx, x - r * 0.1, y - r * 1.62, r * 0.42, r * 0.18);
    ctx.fill();
    ellipse(ctx, x - r * 0.55, y - r * 1.05, r * 0.3, r * 0.12);
    ctx.fill();
  }
}

/** 針葉樹（雪地 / 森林） */
export function drawPine(ctx: Ctx, x: number, y: number, r: number, color: string, snowy: boolean): void {
  groundShadow(ctx, x + r * 0.25, y + 2, r * 0.9, r * 0.36, 0.3);
  roundRect(ctx, x - r * 0.12, y - r * 0.45, r * 0.24, r * 0.5, 2);
  fillStroke(ctx, '#5a3a1e', 2);
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const ly = y - r * 0.35 - i * r * 0.62;
    const lw = r * (0.95 - i * 0.22);
    poly(ctx, [x, ly - r * 0.95, x + lw, ly, x - lw, ly]);
    const g = ctx.createLinearGradient(x - lw, 0, x + lw, 0);
    g.addColorStop(0, shade(color, 0.15));
    g.addColorStop(0.6, color);
    g.addColorStop(1, shade(color, -0.35));
    fillStroke(ctx, g, 3, shade(color, -0.7));
    if (snowy) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      poly(ctx, [x, ly - r * 0.95, x + lw * 0.45, ly - r * 0.5, x + lw * 0.1, ly - r * 0.42, x - lw * 0.2, ly - r * 0.5, x - lw * 0.45, ly - r * 0.48]);
      ctx.fill();
    }
  }
}

export function drawRock(ctx: Ctx, x: number, y: number, r: number, color: string, rnd: () => number, snowy = false): void {
  groundShadow(ctx, x + r * 0.2, y + r * 0.1, r * 1.2, r * 0.45, 0.3);
  const pts: number[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const rr = r * (0.75 + rnd() * 0.35);
    pts.push(x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr * 0.95);
  }
  poly(ctx, pts);
  fillStroke(ctx, vgrad(ctx, y - r, y, shade(color, 0.25), shade(color, -0.25)), 2.5);
  ctx.fillStyle = shade(color, 0.45, 0.6);
  ellipse(ctx, x - r * 0.35, y - r * 0.55, r * 0.35, r * 0.15);
  ctx.fill();
  if (snowy) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ellipse(ctx, x - r * 0.1, y - r * 0.78, r * 0.75, r * 0.22);
    ctx.fill();
  }
}

export function drawBush(ctx: Ctx, x: number, y: number, r: number, color: string, rnd: () => number): void {
  groundShadow(ctx, x + 2, y + 1, r * 1.3, r * 0.4, 0.25);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = shade(color, -0.65);
  const blobs = [
    [x - r * 0.6, y - r * 0.4, r * 0.6],
    [x + r * 0.55, y - r * 0.38, r * 0.62],
    [x, y - r * 0.7, r * 0.72],
  ];
  for (const [bx, by, br] of blobs) {
    circle(ctx, bx, by, br);
    ctx.stroke();
  }
  for (const [bx, by, br] of blobs) {
    circle(ctx, bx, by, br);
    ctx.fillStyle = rgrad(ctx, bx - br * 0.3, by - br * 0.4, 0, br, shade(color, 0.2), shade(color, -0.2));
    ctx.fill();
  }
  if (rnd() < 0.4) {
    ctx.fillStyle = rnd() < 0.5 ? '#ff6b6b' : '#ffe066';
    for (let i = 0; i < 3; i++) {
      circle(ctx, x + (rnd() - 0.5) * r * 1.4, y - r * (0.4 + rnd() * 0.6), r * 0.12);
      ctx.fill();
    }
  }
}

export function drawFlowers(ctx: Ctx, x: number, y: number, colors: string[], rnd: () => number): void {
  for (let i = 0; i < 5; i++) {
    const fx = x + (rnd() - 0.5) * 22;
    const fy = y + (rnd() - 0.5) * 10;
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    circle(ctx, fx, fy, 2 + rnd() * 1.4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    circle(ctx, fx, fy, 0.9);
    ctx.fill();
  }
}

/** 小屋（3/4 視角） */
export function drawHouse(ctx: Ctx, x: number, y: number, s: number, roof = '#b5482e', snowy = false): void {
  const w = 74 * s;
  const h = 44 * s;
  groundShadow(ctx, x + 8 * s, y + 2, w * 0.75, 16 * s, 0.32);
  // 側牆
  poly(ctx, [x + w * 0.5, y, x + w * 0.5 + 18 * s, y - 10 * s, x + w * 0.5 + 18 * s, y - h - 8 * s, x + w * 0.5, y - h]);
  fillStroke(ctx, shade('#d9c49a', -0.25), 2.5);
  // 正面牆
  roundRect(ctx, x - w * 0.5, y - h, w, h, 2);
  fillStroke(ctx, vgrad(ctx, y - h, y, '#efdcb2', '#cdb486'), 2.5);
  // 木樑
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5 + 3, y - h * 0.5);
  ctx.lineTo(x + w * 0.5 - 3, y - h * 0.5);
  ctx.moveTo(x - w * 0.18, y - h + 2);
  ctx.lineTo(x - w * 0.18, y - 2);
  ctx.stroke();
  // 門
  roundRect(ctx, x + w * 0.05, y - h * 0.62, w * 0.2, h * 0.62, 6 * s);
  fillStroke(ctx, '#7a4a26', 2);
  // 窗
  roundRect(ctx, x - w * 0.42, y - h * 0.86, w * 0.18, h * 0.3, 2);
  fillStroke(ctx, '#ffd67a', 2);
  // 屋頂
  poly(ctx, [x - w * 0.62, y - h + 2, x - w * 0.05, y - h - 34 * s, x + w * 0.5 + 22 * s, y - h - 40 * s, x + w * 0.62 + 18 * s, y - h - 6 * s]);
  fillStroke(ctx, vgrad(ctx, y - h - 40 * s, y - h, shade(roof, 0.15), shade(roof, -0.25)), 3);
  // 屋瓦線
  ctx.strokeStyle = shade(roof, -0.45, 0.8);
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62 + (w * 0.57) * t, y - h + 2 - 36 * s * t);
    ctx.lineTo(x + w * 0.62 + 18 * s - (w * 0.12 + 18 * s) * t * 0.3, y - h - 6 * s - 34 * s * t);
    ctx.stroke();
  }
  if (snowy) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    poly(ctx, [x - w * 0.58, y - h - 4, x - w * 0.05, y - h - 34 * s, x + w * 0.5 + 22 * s, y - h - 40 * s, x + w * 0.4, y - h - 22 * s, x - w * 0.3, y - h - 12 * s]);
    ctx.fill();
  }
  // 煙囪
  roundRect(ctx, x + w * 0.3, y - h - 46 * s, 10 * s, 18 * s, 2);
  fillStroke(ctx, '#8a7a6a', 2);
}

/** 王國城門（出口） */
export function drawCastle(ctx: Ctx, x: number, y: number, s: number): void {
  const w = 150 * s;
  const h = 70 * s;
  groundShadow(ctx, x, y + 4, w * 0.65, 20 * s, 0.35);
  roundRect(ctx, x - w / 2, y - h, w, h, 3);
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, x - w / 2, y - h, w, h, '#b8b2a4', 6, 7);
  ctx.restore();
  roundRect(ctx, x - w / 2, y - h, w, h, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  crenels(ctx, x - w / 2, y - h, w, 10 * s, 7, '#c8c2b4');
  // 兩側塔
  for (const sx of [-1, 1]) {
    const tx = x + sx * (w / 2);
    const tw = 40 * s;
    roundRect(ctx, tx - tw / 2, y - h - 30 * s, tw, h + 30 * s, 4);
    ctx.save();
    ctx.clip();
    stoneBricks(ctx, tx - tw / 2, y - h - 30 * s, tw, h + 30 * s, '#aaa496', 8, 3 + sx);
    ctx.restore();
    roundRect(ctx, tx - tw / 2, y - h - 30 * s, tw, h + 30 * s, 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    poly(ctx, [tx - tw * 0.62, y - h - 30 * s, tx, y - h - 72 * s, tx + tw * 0.62, y - h - 30 * s]);
    fillStroke(ctx, vgrad(ctx, y - h - 72 * s, y - h - 30 * s, '#4a74c9', '#2a4a8a'), 3);
    flag(ctx, tx, y - h - 70 * s, 26 * s, '#3a6ad0');
  }
  // 城門
  ctx.beginPath();
  ctx.moveTo(x - 22 * s, y);
  ctx.lineTo(x - 22 * s, y - 36 * s);
  ctx.arc(x, y - 36 * s, 22 * s, Math.PI, 0);
  ctx.lineTo(x + 22 * s, y);
  ctx.closePath();
  fillStroke(ctx, '#3a2614', 3);
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 8 * s, y - 2);
    ctx.lineTo(x + i * 8 * s, y - 50 * s);
    ctx.stroke();
  }
}

export function drawTent(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  groundShadow(ctx, x + 6, y + 2, 36 * s, 12 * s, 0.3);
  poly(ctx, [x - 34 * s, y, x, y - 46 * s, x + 34 * s, y]);
  fillStroke(ctx, vgrad(ctx, y - 46 * s, y, shade(color, 0.15), shade(color, -0.3)), 3);
  poly(ctx, [x - 8 * s, y, x, y - 30 * s, x + 8 * s, y]);
  fillStroke(ctx, '#2a1a0c', 2);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 46 * s);
  ctx.lineTo(x - 4 * s, y - 56 * s);
  ctx.moveTo(x, y - 46 * s);
  ctx.lineTo(x + 5 * s, y - 55 * s);
  ctx.stroke();
}

export function drawCampfire(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#6b6b6b';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ellipse(ctx, x + Math.cos(a) * 12, y + Math.sin(a) * 6, 4, 3);
    fillStroke(ctx, '#8a8a8a', 1.5);
  }
  ctx.fillStyle = rgrad(ctx, x, y - 6, 1, 14, 'rgba(255,240,120,1)', 'rgba(255,90,20,0)');
  circle(ctx, x, y - 6, 14);
  ctx.fill();
  poly(ctx, [x - 6, y, x, y - 16, x + 6, y]);
  ctx.fillStyle = '#ff9a2a';
  ctx.fill();
}

export function drawRuin(ctx: Ctx, x: number, y: number, s: number): void {
  groundShadow(ctx, x + 6, y + 2, 40 * s, 14 * s, 0.3);
  const w = 56 * s;
  const h = 64 * s;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h * 0.7);
  ctx.lineTo(x - w * 0.2, y - h);
  ctx.lineTo(x, y - h * 0.78);
  ctx.lineTo(x + w * 0.2, y - h * 0.86);
  ctx.lineTo(x + w / 2, y - h * 0.5);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, x - w / 2, y - h, w, h, '#9a968a', 6, 11);
  ctx.fillStyle = 'rgba(70,110,50,0.35)';
  ctx.fillRect(x - w / 2, y - h * 0.3, w, h * 0.3);
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

/** 祭壇（教派關卡用） */
export function drawAltar(ctx: Ctx, x: number, y: number, s: number): void {
  groundShadow(ctx, x, y + 2, 50 * s, 16 * s, 0.35);
  roundRect(ctx, x - 40 * s, y - 24 * s, 80 * s, 24 * s, 4);
  fillStroke(ctx, vgrad(ctx, y - 24 * s, y, '#6a6070', '#3e3646'), 3);
  ctx.fillStyle = rgrad(ctx, x, y - 34 * s, 2, 30 * s, 'rgba(200,120,255,0.9)', 'rgba(120,40,200,0)');
  circle(ctx, x, y - 34 * s, 30 * s);
  ctx.fill();
}

/** 枯樹（教派荒地） */
export function drawDeadTree(ctx: Ctx, x: number, y: number, r: number, rnd: () => number): void {
  groundShadow(ctx, x + r * 0.2, y + 2, r * 0.8, r * 0.3, 0.3);
  const branch = (bx: number, by: number, len: number, ang: number, w: number, depth: number) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e140c';
    ctx.lineWidth = w + 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = '#5a4434';
    ctx.lineWidth = w;
    ctx.stroke();
    if (depth > 0) {
      branch(ex, ey, len * 0.68, ang - 0.5 - rnd() * 0.3, w * 0.62, depth - 1);
      branch(ex, ey, len * 0.62, ang + 0.45 + rnd() * 0.3, w * 0.62, depth - 1);
    }
  };
  branch(x, y, r * 0.9, -Math.PI / 2 + (rnd() - 0.5) * 0.2, r * 0.28, 3);
}

/** 毒沼泡泡 */
export function drawBubbles(ctx: Ctx, x: number, y: number, rnd: () => number): void {
  for (let i = 0; i < 4; i++) {
    circle(ctx, x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 12, 2 + rnd() * 3);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(200,255,160,0.7)';
    ctx.stroke();
  }
}

/** 棕櫚樹（沙漠綠洲） */
export function drawPalm(ctx: Ctx, x: number, y: number, r: number, rnd: () => number): void {
  groundShadow(ctx, x + r * 0.3, y + 2, r * 0.9, r * 0.3, 0.28);
  const lean = (rnd() - 0.5) * 0.5;
  const tx = x + lean * r * 1.6;
  const ty = y - r * 2.1;
  // 樹幹：一節一節
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = r * 0.34 + 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * r * 0.4, y - r, tx, ty);
  ctx.stroke();
  ctx.strokeStyle = '#a07a46';
  ctx.lineWidth = r * 0.34;
  ctx.stroke();
  for (let k = 1; k < 6; k++) {
    const t = k / 6;
    const px = x + (tx - x) * t + lean * r * 0.2 * Math.sin(t * Math.PI);
    const py = y + (ty - y) * t;
    ctx.strokeStyle = 'rgba(90,60,30,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - r * 0.16, py);
    ctx.lineTo(px + r * 0.16, py + 2);
    ctx.stroke();
  }
  // 葉子
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i - (n - 1) / 2) / n) * Math.PI * 1.9 + (rnd() - 0.5) * 0.2;
    const len = r * (1.2 + rnd() * 0.3);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.55 + len * 0.35;
    const mx = tx + Math.cos(a) * len * 0.5;
    const my = ty + Math.sin(a) * len * 0.5 - r * 0.25;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my - r * 0.18, ex, ey);
    ctx.quadraticCurveTo(mx, my + r * 0.12, tx, ty);
    fillStroke(ctx, i % 2 ? '#5f9a3a' : '#4f8a30', 2);
  }
  circle(ctx, tx, ty + 2, r * 0.14);
  fillStroke(ctx, '#7a4a20', 1.5);
}

/** 仙人掌 */
export function drawCactus(ctx: Ctx, x: number, y: number, r: number, rnd: () => number): void {
  groundShadow(ctx, x + r * 0.2, y + 2, r * 0.6, r * 0.22, 0.28);
  const body = (bx: number, by: number, w: number, h: number) => {
    roundRect(ctx, bx - w / 2, by - h, w, h, w / 2);
    fillStroke(ctx, vgrad(ctx, by - h, by, '#7ab84a', '#4a8a2a'), 2.5);
    ctx.strokeStyle = 'rgba(40,80,20,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx, by - h + w * 0.4);
    ctx.lineTo(bx, by - 3);
    ctx.stroke();
  };
  const w = r * 0.5;
  const h = r * 1.8;
  // 側枝
  if (rnd() < 0.85) {
    const side = rnd() < 0.5 ? -1 : 1;
    const ay = y - h * (0.4 + rnd() * 0.15);
    roundRect(ctx, side > 0 ? x : x - w * 1.2, ay - w * 0.35, w * 1.2, w * 0.7, w * 0.35);
    fillStroke(ctx, '#5a9a38', 2.5);
    body(x + side * w * 1.05, ay + w * 0.2, w * 0.75, h * 0.42);
  }
  body(x, y, w, h);
  if (rnd() < 0.4) {
    circle(ctx, x, y - h + 2, w * 0.28);
    fillStroke(ctx, '#ff7a9a', 1.5);
  }
}

/** 沙丘紋路：地面上淺色弧線 */
export function drawDuneRipples(ctx: Ctx, x: number, y: number, rnd: () => number): void {
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const w = 30 + rnd() * 40;
    const yy = y + i * 7;
    ctx.strokeStyle = i % 2 ? 'rgba(255,240,200,0.45)' : 'rgba(150,110,60,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yy);
    ctx.quadraticCurveTo(x, yy - 6, x + w / 2, yy);
    ctx.stroke();
  }
}
