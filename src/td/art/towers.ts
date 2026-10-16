import {
  OUTLINE,
  circle,
  crenels,
  cylGrad,
  ellipse,
  fillStroke,
  flag,
  groundShadow,
  mkCanvas,
  planks,
  poly,
  rgrad,
  roundRect,
  shade,
  stoneBricks,
  vgrad,
  type Ctx,
} from './paint';

/** 塔紋理尺寸（邏輯像素）與地面基準線 */
export const TW_W = 132;
export const TW_H = 160;
export const TW_BASE = 144;

/** 每個塔外觀：單位站立高度（距地面）與砲管位置 */
export interface TowerArtInfo {
  topY: number;
  barrel?: string;
  barrelY?: number;
  /** 塔頂單位畫在塔身後面（被城垛擋住下半身，像站在塔裡） */
  behind?: boolean;
  /** 塔頂單位的水平偏移（避開塔頂裝飾） */
  unitX?: number;
  /** 砲管縮放（手繪塔的砲台比較小） */
  barrelScale?: number;
}

export const TOWER_ART: Record<string, TowerArtInfo> = {
  tw_archer_1: { topY: 70 },
  tw_archer_2: { topY: 76 },
  tw_archer_3: { topY: 84 },
  tw_archer_ranger: { topY: 86 },
  tw_archer_marksman: { topY: 96 },
  tw_mage_1: { topY: 54 },
  tw_mage_2: { topY: 66 },
  tw_mage_3: { topY: 80 },
  tw_mage_arcane: { topY: 84 },
  tw_mage_elemental: { topY: 78 },
  tw_art_1: { topY: 30, barrel: 'barrel_1', barrelY: 34 },
  tw_art_2: { topY: 38, barrel: 'barrel_2', barrelY: 42 },
  tw_art_3: { topY: 46, barrel: 'barrel_3', barrelY: 50 },
  tw_art_tesla: { topY: 108 },
  tw_art_bertha: { topY: 50, barrel: 'barrel_bertha', barrelY: 54 },
  tw_barracks_1: { topY: 50 },
  tw_barracks_2: { topY: 60 },
  tw_barracks_3: { topY: 70 },
  tw_barracks_paladin: { topY: 70 },
  tw_barracks_barbarian: { topY: 64 },
};

/**
 * AI 手繪塔（public/assets/sprites/tw/*.webp，264×320、地面線 y=288）的錨點。
 * 圖檔比程式畫的塔高，只有成功載入時才套用，否則沿用上面的數值。
 */
export const PAINTED_TOWER_ART: Record<string, TowerArtInfo> = {
  tw_archer_1: { topY: 70, behind: true },
  tw_archer_2: { topY: 77, behind: true },
  tw_archer_3: { topY: 116, behind: true },
  tw_archer_ranger: { topY: 104 },
  tw_archer_marksman: { topY: 133, behind: true },
  tw_mage_1: { topY: 62, behind: true },
  tw_mage_2: { topY: 78, behind: true },
  tw_mage_3: { topY: 106, behind: true },
  tw_mage_arcane: { topY: 111, behind: true, unitX: -13 },
  tw_mage_elemental: { topY: 101, behind: true },
  tw_art_1: { topY: 28, barrel: 'barrel_1', barrelY: 31, barrelScale: 0.72 },
  tw_art_2: { topY: 42, barrel: 'barrel_2', barrelY: 47, barrelScale: 0.72 },
  tw_art_3: { topY: 50, barrel: 'barrel_3', barrelY: 55, barrelScale: 0.75 },
  tw_art_tesla: { topY: 122 },
  tw_art_bertha: { topY: 48, barrel: 'barrel_bertha', barrelY: 53, barrelScale: 0.72 },
  tw_barracks_1: { topY: 55 },
  tw_barracks_2: { topY: 66 },
  tw_barracks_3: { topY: 79 },
  tw_barracks_paladin: { topY: 67 },
  tw_barracks_barbarian: { topY: 60 },
};

/** 畫面上的射擊高度（距地面）：模擬的 muzzle 固定較低，投射物出發時由畫面補上差距 */
export function visualMuzzleH(art: string): number {
  const info = TOWER_ART[art];
  if (!info) return 0;
  if (info.barrel) return (info.barrelY ?? 30) + (BARREL_MUZZLE[info.barrel] ?? 22) * (info.barrelScale ?? 1);
  if (art === 'tw_art_tesla') return info.topY + 2;
  return info.topY + 10;
}

/** 砲口中心在旋轉軸上方幾像素（邏輯）；手繪砲管比較長 */
const BARREL_MUZZLE: Record<string, number> = {};

/** AI 手繪砲管（public/assets/sprites/tw/barrel_*.webp，160×160，旋轉軸在 (80,100)） */
export const PAINTED_BARRELS: Record<string, number> = { barrel_1: 24, barrel_2: 32, barrel_3: 39, barrel_bertha: 42 };

export function usePaintedBarrel(key: string): void {
  if (PAINTED_BARRELS[key]) BARREL_MUZZLE[key] = PAINTED_BARRELS[key];
}

export function usePaintedTower(key: string): void {
  const info = PAINTED_TOWER_ART[key];
  if (info) TOWER_ART[key] = info;
}

const WOOD = '#a0703c';
const WOOD_D = '#6e4522';
const STONE = '#b4ad9e';

function pad(ctx: Ctx, cx: number, by: number, rx = 50): void {
  groundShadow(ctx, cx + 4, by + 2, rx + 6, 18, 0.38);
  ctx.fillStyle = '#7a5a34';
  ellipse(ctx, cx, by, rx, 15);
  ctx.fill();
  ctx.fillStyle = rgrad(ctx, cx - 8, by - 4, 2, rx, '#b08a58', '#86663c');
  ellipse(ctx, cx, by - 1, rx - 5, 12);
  ctx.fill();
}

/** 木架腳 */
function woodLegs(ctx: Ctx, cx: number, by: number, top: number, wBot: number, wTop: number): void {
  // 後腳
  ctx.lineWidth = 9;
  ctx.strokeStyle = OUTLINE;
  const legs: [number, number][] = [
    [-wBot * 0.55, -wTop * 0.42],
    [wBot * 0.55, wTop * 0.42],
  ];
  for (const [b, t] of legs) {
    ctx.beginPath();
    ctx.moveTo(cx + b, by - 8);
    ctx.lineTo(cx + t, top);
    ctx.stroke();
  }
  ctx.lineWidth = 5;
  ctx.strokeStyle = shade(WOOD, -0.3);
  for (const [b, t] of legs) {
    ctx.beginPath();
    ctx.moveTo(cx + b, by - 8);
    ctx.lineTo(cx + t, top);
    ctx.stroke();
  }
  // 前腳 + 斜撐
  const front: [number, number][] = [
    [-wBot, -wTop],
    [wBot, wTop],
  ];
  ctx.lineWidth = 6;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(cx - wBot * 0.92, by - 14);
  ctx.lineTo(cx + wTop * 0.9, top + 10);
  ctx.moveTo(cx + wBot * 0.92, by - 14);
  ctx.lineTo(cx - wTop * 0.9, top + 10);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = WOOD_D;
  ctx.stroke();
  for (const [b, t] of front) {
    ctx.lineWidth = 11;
    ctx.strokeStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(cx + b, by - 2);
    ctx.lineTo(cx + t, top);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = WOOD;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = shade(WOOD, 0.3);
    ctx.beginPath();
    ctx.moveTo(cx + b - 2, by - 4);
    ctx.lineTo(cx + t - 2, top + 2);
    ctx.stroke();
  }
}

/** 木製平台（含欄杆） */
function woodPlatform(ctx: Ctx, cx: number, top: number, w: number, color = WOOD): void {
  // 平台頂面
  ellipse(ctx, cx, top, w / 2 + 2, 10);
  fillStroke(ctx, shade(color, 0.12), 3);
  // 欄杆正面
  roundRect(ctx, cx - w / 2, top - 2, w, 20, 3);
  ctx.save();
  ctx.clip();
  planks(ctx, cx - w / 2, top - 2, w, 20, color, 7);
  ctx.restore();
  roundRect(ctx, cx - w / 2, top - 2, w, 20, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // 上緣橫木
  roundRect(ctx, cx - w / 2 - 3, top - 6, w + 6, 7, 3);
  fillStroke(ctx, shade(color, -0.15), 2.5);
}

function stonePlatform(ctx: Ctx, cx: number, top: number, w: number, base = STONE, merlons = 5): void {
  ellipse(ctx, cx, top, w / 2, 10);
  fillStroke(ctx, shade(base, 0.1), 3);
  roundRect(ctx, cx - w / 2, top - 2, w, 20, 3);
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, cx - w / 2, top - 2, w, 20, base, 2, 3);
  ctx.restore();
  roundRect(ctx, cx - w / 2, top - 2, w, 20, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  crenels(ctx, cx - w / 2, top - 1, w, 9, merlons, shade(base, 0.08));
}

/** 圓柱石塔身 */
function stoneBody(ctx: Ctx, cx: number, by: number, top: number, wBot: number, wTop: number, base = STONE, seed = 1): void {
  ctx.beginPath();
  ctx.moveTo(cx - wBot / 2, by - 6);
  ctx.quadraticCurveTo(cx, by + 6, cx + wBot / 2, by - 6);
  ctx.lineTo(cx + wTop / 2, top);
  ctx.lineTo(cx - wTop / 2, top);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, cx - wBot / 2, top, wBot, by - top + 6, base, Math.max(3, Math.round((by - top) / 13)), seed);
  ctx.fillStyle = cylGrad(ctx, cx - wBot / 2, cx + wBot / 2, '#808080');
  ctx.globalAlpha = 0.35;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillRect(cx - wBot / 2, top, wBot, by - top + 6);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - wBot / 2, by - 6);
  ctx.quadraticCurveTo(cx, by + 6, cx + wBot / 2, by - 6);
  ctx.lineTo(cx + wTop / 2, top);
  ctx.lineTo(cx - wTop / 2, top);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function banner(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, emblem: 'none' | 'arrow' | 'star' | 'sword' | 'leaf' = 'none'): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h - w * 0.35);
  ctx.lineTo(x - w / 2, y + h);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, y, y + h, shade(color, 0.15), shade(color, -0.25)), 2.5);
  ctx.fillStyle = '#ffd77a';
  ctx.strokeStyle = '#ffd77a';
  ctx.lineWidth = 2;
  const ey = y + h * 0.4;
  if (emblem === 'star') {
    poly(ctx, starPts(x, ey, w * 0.26, w * 0.11, 5));
    ctx.fill();
  } else if (emblem === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(x, ey - w * 0.3);
    ctx.lineTo(x, ey + w * 0.3);
    ctx.moveTo(x - w * 0.15, ey - w * 0.12);
    ctx.lineTo(x, ey - w * 0.3);
    ctx.lineTo(x + w * 0.15, ey - w * 0.12);
    ctx.stroke();
  } else if (emblem === 'sword') {
    ctx.beginPath();
    ctx.moveTo(x, ey - w * 0.32);
    ctx.lineTo(x, ey + w * 0.3);
    ctx.moveTo(x - w * 0.18, ey + w * 0.1);
    ctx.lineTo(x + w * 0.18, ey + w * 0.1);
    ctx.stroke();
  } else if (emblem === 'leaf') {
    ellipse(ctx, x, ey, w * 0.14, w * 0.26);
    ctx.fill();
  }
}

export function starPts(x: number, y: number, r1: number, r2: number, n: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? r1 : r2;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  return pts;
}

function window_(ctx: Ctx, x: number, y: number, w: number, h: number, glow = '#ffd67a'): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2, y - h / 2 + w / 2);
  ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, y - h / 2, y + h / 2, shade(glow, 0.3), shade(glow, -0.3)), 2.5);
}

function crystal(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = rgrad(ctx, x, y, 0, s * 2.2, alpha2(color, 0.55), alpha2(color, 0));
  circle(ctx, x, y, s * 2.2);
  ctx.fill();
  poly(ctx, [x, y - s * 1.4, x + s * 0.7, y, x, y + s * 1.2, x - s * 0.7, y]);
  fillStroke(ctx, vgrad(ctx, y - s, y + s, shade(color, 0.5), shade(color, -0.2)), 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  poly(ctx, [x - s * 0.15, y - s * 1.0, x + s * 0.2, y - s * 0.2, x - s * 0.35, y - s * 0.1]);
  ctx.fill();
}

function alpha2(hex: string, a: number): string {
  return shade(hex, 0, a);
}

// ═════════════════════════ 弓箭塔 ═════════════════════════

function archer1(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 44);
  woodLegs(ctx, cx, by, by - 62, 30, 24);
  woodPlatform(ctx, cx, by - 70, 66);
  flag(ctx, cx + 36, by - 70, 30, '#3a6ad0');
}

function archer2(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 46);
  // 石基
  stoneBody(ctx, cx, by, by - 34, 70, 62, STONE, 2);
  woodLegs(ctx, cx, by - 30, by - 70, 26, 26);
  woodPlatform(ctx, cx, by - 76, 70);
  flag(ctx, cx - 38, by - 76, 34, '#3a6ad0');
  flag(ctx, cx + 38, by - 76, 34, '#3a6ad0');
}

function archer3(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 48);
  stoneBody(ctx, cx, by, by - 76, 70, 58, STONE, 3);
  // 拱窗
  window_(ctx, cx, by - 40, 12, 20, '#2a1a0c');
  stonePlatform(ctx, cx, by - 84, 78, STONE, 5);
  banner(ctx, cx - 22, by - 66, 14, 34, '#3a6ad0', 'arrow');
  banner(ctx, cx + 22, by - 66, 14, 34, '#3a6ad0', 'arrow');
}

function archerRanger(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 48);
  // 巨大樹幹當塔身
  ctx.beginPath();
  ctx.moveTo(cx - 36, by - 2);
  ctx.bezierCurveTo(cx - 22, by - 30, cx - 30, by - 60, cx - 26, by - 82);
  ctx.lineTo(cx + 26, by - 82);
  ctx.bezierCurveTo(cx + 30, by - 60, cx + 22, by - 30, cx + 36, by - 2);
  ctx.quadraticCurveTo(cx, by + 8, cx - 36, by - 2);
  fillStroke(ctx, cylGrad(ctx, cx - 36, cx + 36, '#7a5230'), 3);
  ctx.strokeStyle = shade('#7a5230', -0.4);
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 10, by - 4);
    ctx.quadraticCurveTo(cx + i * 6, by - 40, cx + i * 8, by - 80);
    ctx.stroke();
  }
  // 藤蔓
  ctx.strokeStyle = '#3f8a2c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 30, by - 10);
  ctx.bezierCurveTo(cx - 10, by - 30, cx + 20, by - 40, cx + 24, by - 76);
  ctx.stroke();
  woodPlatform(ctx, cx, by - 86, 80, '#8a6236');
  // 樹冠屋頂裝飾（兩側）
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      circle(ctx, cx + sx * (40 + k * 6), by - 96 - k * 8, 14 - k * 2);
      fillStroke(ctx, rgrad(ctx, cx + sx * 40, by - 104, 2, 20, '#7cc24a', '#3f8a2c'), 2.5, '#1f4a14');
    }
  }
  banner(ctx, cx, by - 68, 16, 30, '#2f8a3a', 'leaf');
}

function archerMarksman(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 50);
  stoneBody(ctx, cx, by, by - 88, 76, 54, '#a8a092', 4);
  // 青銅箍
  for (const yy of [by - 30, by - 62]) {
    roundRect(ctx, cx - 36, yy, 72, 7, 3);
    fillStroke(ctx, vgrad(ctx, yy, yy + 7, '#e3b25a', '#9a6a22'), 2);
  }
  window_(ctx, cx, by - 46, 10, 18, '#2a1a0c');
  stonePlatform(ctx, cx, by - 96, 82, '#a8a092', 5);
  banner(ctx, cx, by - 80, 18, 36, '#8a2a2a', 'star');
}

// ═════════════════════════ 法師塔 ═════════════════════════

const MAGE_STONE = '#a9a3bf';

function mage1(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 44);
  stoneBody(ctx, cx, by, by - 48, 62, 54, MAGE_STONE, 5);
  window_(ctx, cx, by - 24, 14, 20, '#b48aff');
  stonePlatform(ctx, cx, by - 54, 64, MAGE_STONE, 4);
  crystal(ctx, cx - 30, by - 70, 6, '#b48aff');
}

function mage2(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 46);
  stoneBody(ctx, cx, by, by - 60, 66, 54, MAGE_STONE, 6);
  roundRect(ctx, cx - 33, by - 36, 66, 6, 3);
  fillStroke(ctx, '#6a4aa8', 2);
  window_(ctx, cx, by - 22, 14, 18, '#b48aff');
  window_(ctx, cx, by - 48, 10, 12, '#b48aff');
  stonePlatform(ctx, cx, by - 66, 68, MAGE_STONE, 4);
  crystal(ctx, cx - 36, by - 84, 7, '#b48aff');
  crystal(ctx, cx + 36, by - 84, 7, '#b48aff');
}

function mage3(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 48);
  stoneBody(ctx, cx, by, by - 74, 70, 56, MAGE_STONE, 7);
  for (const yy of [by - 30, by - 56]) {
    roundRect(ctx, cx - 34, yy, 68, 7, 3);
    fillStroke(ctx, vgrad(ctx, yy, yy + 7, '#f0c860', '#a87a22'), 2);
  }
  window_(ctx, cx, by - 16, 14, 18, '#c79bff');
  window_(ctx, cx, by - 43, 12, 14, '#c79bff');
  stonePlatform(ctx, cx, by - 80, 72, MAGE_STONE, 4);
  crystal(ctx, cx - 42, by - 96, 8, '#c79bff');
  crystal(ctx, cx + 42, by - 96, 8, '#c79bff');
  banner(ctx, cx, by - 66, 14, 26, '#6a3ab8', 'star');
}

function mageArcane(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 48);
  // 深紫水晶尖塔基座
  stoneBody(ctx, cx, by, by - 78, 72, 50, '#7c6aa0', 8);
  for (const sx of [-1, 1]) {
    poly(ctx, [cx + sx * 30, by - 4, cx + sx * 46, by - 50, cx + sx * 26, by - 30]);
    fillStroke(ctx, vgrad(ctx, by - 50, by, '#e0b8ff', '#7a3ad0'), 2.5);
  }
  window_(ctx, cx, by - 36, 14, 22, '#e0b8ff');
  stonePlatform(ctx, cx, by - 84, 70, '#7c6aa0', 4);
  crystal(ctx, cx, by - 124, 11, '#e07aff');
}

function mageElemental(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 50);
  stoneBody(ctx, cx, by, by - 70, 76, 60, '#a08a6a', 9);
  // 熔岩符文
  ctx.strokeStyle = '#ff8a2a';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff6a00';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 20, by - 14);
  ctx.lineTo(cx - 10, by - 30);
  ctx.lineTo(cx - 18, by - 44);
  ctx.moveTo(cx + 16, by - 18);
  ctx.lineTo(cx + 8, by - 36);
  ctx.lineTo(cx + 20, by - 52);
  ctx.stroke();
  ctx.shadowBlur = 0;
  stonePlatform(ctx, cx, by - 76, 74, '#a08a6a', 4);
  // 漂浮岩塊
  for (const [ox, oy, r] of [
    [-44, -96, 8],
    [42, -104, 7],
    [30, -86, 5],
  ]) {
    poly(ctx, [cx + ox - r, by + oy, cx + ox - r * 0.3, by + oy - r, cx + ox + r, by + oy - r * 0.4, cx + ox + r * 0.6, by + oy + r * 0.6]);
    fillStroke(ctx, vgrad(ctx, by + oy - r, by + oy + r, '#c8a87a', '#7a5a3a'), 2);
  }
}

// ═════════════════════════ 砲塔 ═════════════════════════

function artBase(ctx: Ctx, cx: number, by: number, h: number, w: number, base: string, merl: number, seed: number): void {
  pad(ctx, cx, by, w / 2 + 4);
  // 圓形矮牆
  const wall = () => {
    ctx.beginPath();
    ctx.ellipse(cx, by - 6, w / 2, 16, 0, 0, Math.PI);
    ctx.lineTo(cx - w / 2, by - 6 - h);
    ctx.ellipse(cx, by - 6 - h, w / 2, 16, 0, Math.PI, 0, true);
    ctx.closePath();
  };
  wall();
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, cx - w / 2, by - h - 24, w, h + 34, base, Math.max(2, Math.round(h / 12)), seed);
  ctx.restore();
  // save/restore 不會保存路徑：畫完磚塊後要重建牆的路徑再描邊（否則會描到最後一塊磚，出現多餘的黑框）
  wall();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // 頂面（內部地板）
  ellipse(ctx, cx, by - 6 - h, w / 2, 16);
  fillStroke(ctx, vgrad(ctx, by - h - 22, by - h + 10, shade('#8a7458', 0.1), '#6a5438'), 3);
  if (merl > 0) {
    for (let i = 0; i < merl; i++) {
      const a = Math.PI * (0.08 + (0.84 * i) / (merl - 1));
      const mx = cx - Math.cos(a) * (w / 2 - 4);
      const my = by - 6 - h + Math.sin(a) * 14;
      roundRect(ctx, mx - 6, my - 10, 12, 12, 2);
      fillStroke(ctx, vgrad(ctx, my - 10, my + 2, shade(base, 0.2), shade(base, -0.1)), 2);
    }
  }
}

function art1(ctx: Ctx, cx: number, by: number): void {
  artBase(ctx, cx, by, 20, 92, '#a59c8a', 0, 10);
  // 木框
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 34, by - 18);
  ctx.lineTo(cx - 20, by - 34);
  ctx.moveTo(cx + 34, by - 18);
  ctx.lineTo(cx + 20, by - 34);
  ctx.stroke();
  ctx.strokeStyle = WOOD;
  ctx.lineWidth = 4;
  ctx.stroke();
  // 彈藥堆
  for (const [ox, oy] of [
    [26, -20],
    [32, -24],
    [20, -24],
  ]) {
    circle(ctx, cx + ox, by + oy, 5);
    fillStroke(ctx, rgrad(ctx, cx + ox - 2, by + oy - 2, 0, 6, '#6a6a6a', '#2a2a2a'), 1.5);
  }
}

function art2(ctx: Ctx, cx: number, by: number): void {
  artBase(ctx, cx, by, 28, 98, '#a59c8a', 7, 11);
  for (const [ox, oy] of [
    [30, -30],
    [36, -34],
    [24, -34],
    [30, -38],
  ]) {
    circle(ctx, cx + ox, by + oy, 5.5);
    fillStroke(ctx, rgrad(ctx, cx + ox - 2, by + oy - 2, 0, 6, '#6a6a6a', '#2a2a2a'), 1.5);
  }
  flag(ctx, cx - 44, by - 34, 30, '#c0392b');
}

function art3(ctx: Ctx, cx: number, by: number): void {
  artBase(ctx, cx, by, 36, 106, '#9a8f7c', 8, 12);
  // 青銅飾帶
  ctx.beginPath();
  ctx.ellipse(cx, by - 18, 53, 15, 0, 0.1, Math.PI - 0.1);
  ctx.lineWidth = 6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d9a441';
  ctx.stroke();
  flag(ctx, cx - 48, by - 42, 34, '#c0392b');
  flag(ctx, cx + 48, by - 42, 34, '#c0392b');
}

function artTesla(ctx: Ctx, cx: number, by: number): void {
  artBase(ctx, cx, by, 22, 92, '#8f8676', 0, 13);
  // 銅柱
  roundRect(ctx, cx - 9, by - 104, 18, 78, 5);
  fillStroke(ctx, cylGrad(ctx, cx - 9, cx + 9, '#b87333'), 3);
  // 線圈
  for (let i = 0; i < 5; i++) {
    const yy = by - 40 - i * 13;
    const rw = 26 - i * 2.5;
    ellipse(ctx, cx, yy, rw, 6);
    ctx.lineWidth = 6;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = i % 2 ? '#e0a050' : '#c87a30';
    ctx.stroke();
  }
  // 頂端電球
  ctx.fillStyle = rgrad(ctx, cx, by - 110, 2, 26, 'rgba(160,220,255,0.9)', 'rgba(80,140,255,0)');
  circle(ctx, cx, by - 110, 26);
  ctx.fill();
  circle(ctx, cx, by - 110, 11);
  fillStroke(ctx, rgrad(ctx, cx - 3, by - 114, 1, 12, '#ffffff', '#5ab0ff'), 2.5);
}

function artBertha(ctx: Ctx, cx: number, by: number): void {
  artBase(ctx, cx, by, 40, 114, '#8a8070', 9, 14);
  // 鋼鉚釘帶
  ctx.beginPath();
  ctx.ellipse(cx, by - 22, 57, 15, 0, 0.1, Math.PI - 0.1);
  ctx.lineWidth = 7;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#7a8a9a';
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = 0.25 + (i / 8) * (Math.PI - 0.5);
    circle(ctx, cx + Math.cos(a) * 57, by - 22 + Math.sin(a) * 15, 2.2);
    ctx.fillStyle = '#dfe6ee';
    ctx.fill();
  }
  // 火箭架
  for (const sx of [-1, 1]) {
    roundRect(ctx, cx + sx * 44 - 6, by - 66, 12, 26, 3);
    fillStroke(ctx, '#5a6672', 2);
    poly(ctx, [cx + sx * 44 - 6, by - 66, cx + sx * 44, by - 76, cx + sx * 44 + 6, by - 66]);
    fillStroke(ctx, '#c0392b', 2);
  }
}

// 砲管（獨立紋理，可後座力動畫）
function barrel(ctx: Ctx, cx: number, cy: number, kind: 1 | 2 | 3 | 4): void {
  const sz = kind === 4 ? 1.45 : 0.8 + kind * 0.15;
  const col = kind === 1 ? '#7a5a3a' : kind === 2 ? '#4a4f56' : kind === 3 ? '#b07a30' : '#3e4650';
  // 砲座
  ellipse(ctx, cx, cy + 10 * sz, 20 * sz, 8 * sz);
  fillStroke(ctx, '#4a3a2a', 2.5);
  // 砲身（朝上斜的臼砲）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.35); // 砲口朝右上：未翻轉時對準右邊的目標（TowerView 朝左時 flipX）
  roundRect(ctx, -13 * sz, -30 * sz, 26 * sz, 40 * sz, 8 * sz);
  fillStroke(ctx, cylGrad(ctx, -13 * sz, 13 * sz, col), 3);
  // 箍
  for (const yy of [-24, -6]) {
    roundRect(ctx, -15 * sz, yy * sz, 30 * sz, 6 * sz, 3);
    fillStroke(ctx, kind === 1 ? '#3a3a3a' : '#d9a441', 2);
  }
  // 砲口
  ellipse(ctx, 0, -30 * sz, 13 * sz, 5 * sz);
  fillStroke(ctx, '#1a1a1a', 2.5);
  ctx.restore();
}

// ═════════════════════════ 兵營 ═════════════════════════

function barracks1(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 50);
  // 木屋
  const w = 78;
  const h = 34;
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.save();
  ctx.clip();
  planks(ctx, cx - w / 2, by - h - 6, w, h, '#a87a48', 9);
  ctx.restore();
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // 門
  ctx.beginPath();
  ctx.moveTo(cx - 10, by - 6);
  ctx.lineTo(cx - 10, by - 24);
  ctx.arc(cx, by - 24, 10, Math.PI, 0);
  ctx.lineTo(cx + 10, by - 6);
  ctx.closePath();
  fillStroke(ctx, '#4a2e16', 2.5);
  // 茅草屋頂
  poly(ctx, [cx - w / 2 - 10, by - h - 2, cx, by - h - 44, cx + w / 2 + 10, by - h - 2]);
  fillStroke(ctx, vgrad(ctx, by - h - 44, by - h, '#e8c870', '#b08a38'), 3);
  ctx.strokeStyle = 'rgba(120,80,20,0.6)';
  ctx.lineWidth = 1.5;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 3, by - h - 40);
    ctx.lineTo(cx + i * 11, by - h - 4);
    ctx.stroke();
  }
  // 武器架
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 34, by - 4);
  ctx.lineTo(cx + 46, by - 40);
  ctx.moveTo(cx + 42, by - 4);
  ctx.lineTo(cx + 40, by - 42);
  ctx.stroke();
  flag(ctx, cx - 44, by - 8, 40, '#3a6ad0');
}

function barracks2(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 52);
  const w = 86;
  const h = 42;
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, cx - w / 2, by - h - 6, w, h, STONE, 4, 21);
  ctx.restore();
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 12, by - 6);
  ctx.lineTo(cx - 12, by - 28);
  ctx.arc(cx, by - 28, 12, Math.PI, 0);
  ctx.lineTo(cx + 12, by - 6);
  ctx.closePath();
  fillStroke(ctx, '#5a361a', 2.5);
  // 紅瓦屋頂
  poly(ctx, [cx - w / 2 - 10, by - h - 2, cx - w / 2 + 14, by - h - 40, cx + w / 2 - 14, by - h - 40, cx + w / 2 + 10, by - h - 2]);
  fillStroke(ctx, vgrad(ctx, by - h - 40, by - h, '#d0563a', '#8a2e1e'), 3);
  ctx.strokeStyle = 'rgba(70,20,10,0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    const yy = by - h - 2 - i * 10;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 10 + i * 6, yy);
    ctx.lineTo(cx + w / 2 + 10 - i * 6, yy);
    ctx.stroke();
  }
  // 盾牌徽章
  ctx.beginPath();
  ctx.moveTo(cx - 10, by - h - 18);
  ctx.lineTo(cx + 10, by - h - 18);
  ctx.lineTo(cx + 10, by - h - 6);
  ctx.quadraticCurveTo(cx, by - h + 4, cx - 10, by - h - 6);
  ctx.closePath();
  fillStroke(ctx, '#3a6ad0', 2);
  flag(ctx, cx + 50, by - 8, 46, '#3a6ad0');
}

function barracks3(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 54);
  const w = 92;
  const h = 46;
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, cx - w / 2, by - h - 6, w, h, '#bab3a3', 4, 22);
  ctx.restore();
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  crenels(ctx, cx - w / 2, by - h - 6, w, 9, 6, '#c4bdad');
  ctx.beginPath();
  ctx.moveTo(cx - 13, by - 6);
  ctx.lineTo(cx - 13, by - 30);
  ctx.arc(cx, by - 30, 13, Math.PI, 0);
  ctx.lineTo(cx + 13, by - 6);
  ctx.closePath();
  fillStroke(ctx, '#5a361a', 2.5);
  // 兩側塔樓
  for (const sx of [-1, 1]) {
    const tx = cx + sx * (w / 2 - 4);
    roundRect(ctx, tx - 14, by - h - 40, 28, h + 34, 3);
    ctx.save();
    ctx.clip();
    stoneBricks(ctx, tx - 14, by - h - 40, 28, h + 34, '#b0a999', 6, 23 + sx);
    ctx.restore();
    roundRect(ctx, tx - 14, by - h - 40, 28, h + 34, 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    poly(ctx, [tx - 18, by - h - 40, tx, by - h - 72, tx + 18, by - h - 40]);
    fillStroke(ctx, vgrad(ctx, by - h - 72, by - h - 40, '#4a74c9', '#2a4a8a'), 3);
    flag(ctx, tx, by - h - 70, 22, '#3a6ad0');
  }
}

function barracksPaladin(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 54);
  const w = 92;
  const h = 50;
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.save();
  ctx.clip();
  stoneBricks(ctx, cx - w / 2, by - h - 6, w, h, '#ece6d8', 4, 31);
  ctx.restore();
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 13, by - 6);
  ctx.lineTo(cx - 13, by - 32);
  ctx.arc(cx, by - 32, 13, Math.PI, 0);
  ctx.lineTo(cx + 13, by - 6);
  ctx.closePath();
  fillStroke(ctx, '#7a5a2a', 2.5);
  // 金色尖頂
  poly(ctx, [cx - w / 2 - 8, by - h - 2, cx, by - h - 54, cx + w / 2 + 8, by - h - 2]);
  fillStroke(ctx, vgrad(ctx, by - h - 54, by - h, '#4a78d0', '#23408a'), 3);
  // 聖光徽章
  ctx.fillStyle = rgrad(ctx, cx, by - h - 22, 2, 18, 'rgba(255,240,170,1)', 'rgba(255,200,80,0)');
  circle(ctx, cx, by - h - 22, 18);
  ctx.fill();
  poly(ctx, starPts(cx, by - h - 22, 10, 4, 8));
  fillStroke(ctx, '#ffd84a', 2);
  banner(ctx, cx - 34, by - h + 4, 14, 30, '#f0f0f0', 'sword');
  banner(ctx, cx + 34, by - h + 4, 14, 30, '#f0f0f0', 'sword');
}

function barracksBarbarian(ctx: Ctx, cx: number, by: number): void {
  pad(ctx, cx, by, 54);
  const w = 96;
  const h = 40;
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.save();
  ctx.clip();
  planks(ctx, cx - w / 2, by - h - 6, w, h, '#8a5a32', 10);
  ctx.restore();
  roundRect(ctx, cx - w / 2, by - h - 6, w, h, 3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 12, by - 6);
  ctx.lineTo(cx - 12, by - 30);
  ctx.lineTo(cx + 12, by - 30);
  ctx.lineTo(cx + 12, by - 6);
  ctx.closePath();
  fillStroke(ctx, '#3a2010', 2.5);
  // 毛皮屋頂
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 10, by - h);
  ctx.quadraticCurveTo(cx, by - h - 66, cx + w / 2 + 10, by - h);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, by - h - 46, by - h, '#9a7a5a', '#5a422a'), 3);
  ctx.strokeStyle = 'rgba(40,24,10,0.5)';
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 4, by - h - 30);
    ctx.lineTo(cx + i * 15, by - h - 2);
    ctx.stroke();
  }
  // 牛角
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 6, by - h - 30);
    ctx.quadraticCurveTo(cx + sx * 28, by - h - 40, cx + sx * 30, by - h - 64);
    ctx.quadraticCurveTo(cx + sx * 18, by - h - 42, cx + sx * 4, by - h - 38);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, by - h - 64, by - h - 30, '#fff4dc', '#c8b48a'), 2.5);
  }
  // 交叉斧
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 38, by - 4);
  ctx.lineTo(cx + 56, by - 40);
  ctx.moveTo(cx + 56, by - 4);
  ctx.lineTo(cx + 38, by - 40);
  ctx.stroke();
  for (const ax of [38, 56]) {
    ellipse(ctx, cx + (ax === 38 ? 56 : 38), by - 40, 7, 5);
    fillStroke(ctx, '#b8c0c8', 2);
  }
}

// ═════════════════════════ 匯出 ═════════════════════════

type Painter = (ctx: Ctx, cx: number, by: number) => void;

const PAINTERS: Record<string, Painter> = {
  tw_archer_1: archer1,
  tw_archer_2: archer2,
  tw_archer_3: archer3,
  tw_archer_ranger: archerRanger,
  tw_archer_marksman: archerMarksman,
  tw_mage_1: mage1,
  tw_mage_2: mage2,
  tw_mage_3: mage3,
  tw_mage_arcane: mageArcane,
  tw_mage_elemental: mageElemental,
  tw_art_1: art1,
  tw_art_2: art2,
  tw_art_3: art3,
  tw_art_tesla: artTesla,
  tw_art_bertha: artBertha,
  tw_barracks_1: barracks1,
  tw_barracks_2: barracks2,
  tw_barracks_3: barracks3,
  tw_barracks_paladin: barracksPaladin,
  tw_barracks_barbarian: barracksBarbarian,
};

export function paintTowers(s: number): Record<string, HTMLCanvasElement> {
  const out: Record<string, HTMLCanvasElement> = {};
  for (const [key, fn] of Object.entries(PAINTERS)) {
    const [cv, ctx] = mkCanvas(TW_W * s, TW_H * s);
    ctx.scale(s, s);
    fn(ctx, TW_W / 2, TW_BASE);
    out[key] = cv;
  }
  const barrels: [string, 1 | 2 | 3 | 4][] = [
    ['barrel_1', 1],
    ['barrel_2', 2],
    ['barrel_3', 3],
    ['barrel_bertha', 4],
  ];
  for (const [key, k] of barrels) {
    const [cv, ctx] = mkCanvas(80 * s, 80 * s);
    ctx.scale(s, s);
    barrel(ctx, 40, 50, k);
    out[key] = cv;
  }
  return out;
}

/** 砲管紋理的錨點（砲座中心）在 80×80 內的位置 */
export const BARREL_ORIGIN = { x: 0.5, y: 50 / 80 };
