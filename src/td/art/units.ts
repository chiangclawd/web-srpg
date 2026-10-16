import { OUTLINE, circle, ellipse, fillStroke, mkCanvas, poly, rgrad, roundRect, shade, vgrad, type Ctx } from './paint';

/**
 * 程序繪製的魔物（chibi 風格，粗描邊，面向右）。
 * 每張紋理：寬 W、高 H，腳底在底部中央（origin 0.5, 1）。
 */

function goblin(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  const skin = '#7cbf45';
  // 腳
  for (const ox of [-7, 6]) {
    roundRect(ctx, cx + ox - 4, by - 14, 8, 14, 3);
    fillStroke(ctx, shade(skin, -0.2), 2.5);
  }
  // 身體（皮衣）
  ellipse(ctx, cx, by - 22, 14, 13);
  fillStroke(ctx, vgrad(ctx, by - 35, by - 10, '#9a6a3c', '#6a4422'), 3);
  ctx.strokeStyle = '#3a2412';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, by - 26);
  ctx.lineTo(cx + 12, by - 18);
  ctx.stroke();
  // 匕首（右手）
  ctx.save();
  ctx.translate(cx + 14, by - 24);
  ctx.rotate(-0.5);
  poly(ctx, [0, 0, 4, -16, 8, 0]);
  fillStroke(ctx, vgrad(ctx, -16, 0, '#ffffff', '#9aa6b0'), 2);
  roundRect(ctx, 0, 0, 8, 6, 2);
  fillStroke(ctx, '#5a3a1e', 2);
  ctx.restore();
  // 手
  circle(ctx, cx + 14, by - 22, 4.5);
  fillStroke(ctx, skin, 2.5);
  circle(ctx, cx - 13, by - 22, 4.5);
  fillStroke(ctx, skin, 2.5);
  // 耳朵
  for (const sx of [-1, 1]) {
    poly(ctx, [cx + sx * 10, by - 50, cx + sx * 28, by - 58, cx + sx * 12, by - 42]);
    fillStroke(ctx, skin, 2.5);
    poly(ctx, [cx + sx * 12, by - 49, cx + sx * 23, by - 55, cx + sx * 13, by - 45]);
    ctx.fillStyle = '#e88aa0';
    ctx.fill();
  }
  // 頭
  ellipse(ctx, cx + 1, by - 46, 15, 14);
  fillStroke(ctx, rgrad(ctx, cx - 4, by - 52, 2, 18, shade(skin, 0.25), shade(skin, -0.15)), 3);
  // 眼睛
  for (const ox of [-5, 7]) {
    ellipse(ctx, cx + ox, by - 48, 4.2, 4.8);
    fillStroke(ctx, '#fff27a', 1.8);
    circle(ctx, cx + ox + 1.2, by - 47.5, 1.8);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
  }
  // 嘴與牙
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 4, by - 39);
  ctx.quadraticCurveTo(cx + 2, by - 36, cx + 8, by - 39);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  poly(ctx, [cx - 1, by - 38.5, cx + 1, by - 35, cx + 3, by - 38]);
  ctx.fill();
  // 鼻
  ellipse(ctx, cx + 3, by - 43, 3.5, 2.4);
  fillStroke(ctx, shade(skin, -0.1), 1.6);
}

function wolf(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  const fur = '#d9e2ea';
  const dark = '#8494a4';
  // 尾巴
  ctx.beginPath();
  ctx.moveTo(cx - 20, by - 26);
  ctx.quadraticCurveTo(cx - 40, by - 30, cx - 42, by - 44);
  ctx.quadraticCurveTo(cx - 30, by - 34, cx - 18, by - 32);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, by - 44, by - 26, fur, dark), 2.5);
  // 後腳
  for (const ox of [-16, -6]) {
    roundRect(ctx, cx + ox - 4, by - 18, 8, 18, 3);
    fillStroke(ctx, shade(dark, ox === -6 ? 0 : -0.15), 2.5);
  }
  // 身體
  ellipse(ctx, cx - 2, by - 25, 24, 12);
  fillStroke(ctx, vgrad(ctx, by - 37, by - 13, fur, dark), 3);
  // 前腳
  for (const ox of [12, 20]) {
    roundRect(ctx, cx + ox - 4, by - 18, 8, 18, 3);
    fillStroke(ctx, shade(dark, ox === 20 ? 0.1 : -0.1), 2.5);
  }
  // 頭
  ellipse(ctx, cx + 22, by - 34, 12, 10);
  fillStroke(ctx, vgrad(ctx, by - 44, by - 24, '#f2f6fa', dark), 3);
  // 嘴
  poly(ctx, [cx + 28, by - 36, cx + 44, by - 31, cx + 42, by - 26, cx + 27, by - 27]);
  fillStroke(ctx, vgrad(ctx, by - 36, by - 26, '#eef2f6', '#a8b4c0'), 2.5);
  circle(ctx, cx + 43, by - 32, 2.4);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  // 耳
  for (const ox of [16, 24]) {
    poly(ctx, [cx + ox - 4, by - 41, cx + ox, by - 54, cx + ox + 5, by - 41]);
    fillStroke(ctx, dark, 2.2);
  }
  // 眼
  ellipse(ctx, cx + 27, by - 37, 2.6, 2.2);
  ctx.fillStyle = '#ffcf3a';
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  circle(ctx, cx + 27.6, by - 37, 1.1);
  ctx.fill();
}

function troll(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  const skin = '#8aa39a';
  // 腿
  for (const ox of [-12, 12]) {
    roundRect(ctx, cx + ox - 9, by - 26, 18, 26, 6);
    fillStroke(ctx, shade(skin, -0.2), 3);
  }
  // 身體
  ellipse(ctx, cx, by - 50, 30, 30);
  fillStroke(ctx, rgrad(ctx, cx - 10, by - 62, 4, 38, shade(skin, 0.2), shade(skin, -0.25)), 3.5);
  // 肚子
  ellipse(ctx, cx + 2, by - 42, 18, 16);
  ctx.fillStyle = shade(skin, 0.25, 0.7);
  ctx.fill();
  // 腰布
  poly(ctx, [cx - 26, by - 30, cx + 26, by - 30, cx + 18, by - 16, cx - 4, by - 20, cx - 20, by - 14]);
  fillStroke(ctx, vgrad(ctx, by - 30, by - 14, '#8a5a32', '#5a3a1e'), 3);
  // 棍棒
  ctx.save();
  ctx.translate(cx + 30, by - 46);
  ctx.rotate(-0.6);
  roundRect(ctx, -6, -40, 14, 50, 7);
  fillStroke(ctx, vgrad(ctx, -40, 10, '#8a6038', '#5a3a1e'), 3);
  for (const [sx, sy] of [
    [-2, -32],
    [6, -22],
    [-3, -14],
  ]) {
    poly(ctx, [sx - 4, sy, sx, sy - 6, sx + 4, sy]);
    fillStroke(ctx, '#d0d0c8', 1.6);
  }
  ctx.restore();
  // 手臂
  ellipse(ctx, cx + 28, by - 46, 9, 12);
  fillStroke(ctx, skin, 3);
  ellipse(ctx, cx - 28, by - 44, 9, 13);
  fillStroke(ctx, shade(skin, -0.1), 3);
  // 頭
  ellipse(ctx, cx + 6, by - 82, 14, 12);
  fillStroke(ctx, rgrad(ctx, cx + 2, by - 86, 2, 16, shade(skin, 0.25), shade(skin, -0.15)), 3);
  // 獠牙
  for (const ox of [2, 12]) {
    poly(ctx, [cx + ox - 2, by - 76, cx + ox, by - 84, cx + ox + 2, by - 76]);
    fillStroke(ctx, '#fff8e0', 1.6);
  }
  // 眼
  for (const ox of [2, 11]) {
    circle(ctx, cx + ox, by - 86, 2.5);
    ctx.fillStyle = '#ffde3a';
    ctx.fill();
  }
  // 眉
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 2, by - 91);
  ctx.lineTo(cx + 15, by - 89);
  ctx.stroke();
}

function golem(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  const rock = '#9a8466';
  const lava = '#ff8a2a';
  const block = (x: number, y: number, rw: number, rh: number, k = 0) => {
    poly(ctx, [x - rw, y + rh * 0.6, x - rw * 0.8, y - rh, x + rw * 0.6, y - rh * 0.9, x + rw, y + rh * 0.3, x + rw * 0.4, y + rh]);
    fillStroke(ctx, vgrad(ctx, y - rh, y + rh, shade(rock, 0.25 + k), shade(rock, -0.25 + k)), 3);
  };
  block(cx - 12, by - 10, 9, 10);
  block(cx + 12, by - 10, 9, 10, -0.05);
  block(cx, by - 38, 24, 20);
  block(cx - 28, by - 40, 9, 14, -0.1);
  block(cx + 28, by - 42, 10, 15, 0.05);
  block(cx + 2, by - 66, 12, 10, 0.1);
  ctx.strokeStyle = lava;
  ctx.shadowColor = '#ff5a00';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, by - 48);
  ctx.lineTo(cx - 2, by - 38);
  ctx.lineTo(cx - 8, by - 28);
  ctx.moveTo(cx + 8, by - 44);
  ctx.lineTo(cx + 14, by - 34);
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (const ox of [-2, 6]) {
    circle(ctx, cx + ox, by - 67, 2.4);
    ctx.fillStyle = '#ffe07a';
    ctx.fill();
  }
}

function sheep(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  for (const ox of [-10, -3, 6, 12]) {
    roundRect(ctx, cx + ox - 2.5, by - 12, 5, 12, 2);
    fillStroke(ctx, '#2a2a2a', 1.5);
  }
  ctx.lineWidth = 5;
  ctx.strokeStyle = OUTLINE;
  const puffs: [number, number, number][] = [
    [cx - 10, by - 20, 9],
    [cx + 2, by - 24, 10],
    [cx + 12, by - 19, 8],
    [cx - 2, by - 15, 9],
  ];
  for (const [x, y, r] of puffs) {
    circle(ctx, x, y, r);
    ctx.stroke();
  }
  for (const [x, y, r] of puffs) {
    circle(ctx, x, y, r);
    ctx.fillStyle = rgrad(ctx, x - 3, y - 3, 1, r, '#ffffff', '#dcdcdc');
    ctx.fill();
  }
  ellipse(ctx, cx + 20, by - 24, 6, 7);
  fillStroke(ctx, '#3a3a3a', 2.5);
  circle(ctx, cx + 22, by - 26, 1.4);
  ctx.fillStyle = '#fff';
  ctx.fill();
}


function bat(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2 + 2;
  const body = '#5a3a6a';
  // 翅膀
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 6, cy - 4);
    ctx.quadraticCurveTo(cx + sx * 22, cy - 22, cx + sx * 34, cy - 10);
    ctx.quadraticCurveTo(cx + sx * 28, cy - 4, cx + sx * 30, cy + 4);
    ctx.quadraticCurveTo(cx + sx * 22, cy, cx + sx * 20, cy + 6);
    ctx.quadraticCurveTo(cx + sx * 13, cy + 1, cx + sx * 6, cy + 6);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, cy - 22, cy + 6, '#8a5aa0', '#3a2048'), 2.5);
  }
  ellipse(ctx, cx, cy, 9, 11);
  fillStroke(ctx, rgrad(ctx, cx - 2, cy - 4, 1, 12, shade(body, 0.3), shade(body, -0.3)), 2.5);
  for (const sx of [-1, 1]) {
    poly(ctx, [cx + sx * 3, cy - 8, cx + sx * 7, cy - 18, cx + sx * 8, cy - 7]);
    fillStroke(ctx, body, 2);
  }
  for (const ox of [-3.5, 3.5]) {
    circle(ctx, cx + ox, cy - 3, 2.2);
    ctx.fillStyle = '#ff4a4a';
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  poly(ctx, [cx - 3, cy + 3, cx - 2, cy + 7, cx - 1, cy + 3]);
  ctx.fill();
  poly(ctx, [cx + 1, cy + 3, cx + 2, cy + 7, cx + 3, cy + 3]);
  ctx.fill();
}

function skeleton(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  const bone = '#ece4d0';
  // 腿骨
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 6, by - 20);
  ctx.lineTo(cx - 8, by);
  ctx.moveTo(cx + 6, by - 20);
  ctx.lineTo(cx + 8, by);
  ctx.stroke();
  ctx.strokeStyle = bone;
  ctx.lineWidth = 3;
  ctx.stroke();
  // 骨盆
  ellipse(ctx, cx, by - 21, 9, 4);
  fillStroke(ctx, bone, 2.2);
  // 脊椎與肋骨
  roundRect(ctx, cx - 2, by - 40, 4, 20, 2);
  fillStroke(ctx, bone, 2);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, by - 36 + i * 5, 10 - i, 3, 0, Math.PI, 0);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = bone;
    ctx.stroke();
  }
  // 生鏽的劍
  ctx.save();
  ctx.translate(cx + 13, by - 30);
  ctx.rotate(0.5);
  roundRect(ctx, -2.5, -22, 5, 24, 2);
  fillStroke(ctx, vgrad(ctx, -22, 2, '#c8b89a', '#8a6a4a'), 2);
  roundRect(ctx, -6, 0, 12, 3.5, 1);
  fillStroke(ctx, '#5a3a1e', 1.6);
  ctx.restore();
  // 圓盾
  circle(ctx, cx - 12, by - 30, 8);
  fillStroke(ctx, rgrad(ctx, cx - 14, by - 32, 1, 9, '#9a7a5a', '#5a3a1e'), 2.5);
  // 頭骨
  ellipse(ctx, cx + 1, by - 50, 10, 10);
  fillStroke(ctx, rgrad(ctx, cx - 2, by - 54, 1, 12, '#ffffff', '#cfc6b0'), 2.6);
  roundRect(ctx, cx - 4, by - 44, 10, 6, 2);
  fillStroke(ctx, '#e8e0cc', 2);
  for (const ox of [-3, 5]) {
    ellipse(ctx, cx + ox, by - 51, 2.8, 3.2);
    ctx.fillStyle = '#1a1010';
    ctx.fill();
    circle(ctx, cx + ox, by - 51, 1);
    ctx.fillStyle = '#7aff9a';
    ctx.fill();
  }
}

function demon(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  const skin = '#c0392b';
  for (const ox of [-8, 8]) {
    roundRect(ctx, cx + ox - 5, by - 18, 10, 18, 4);
    fillStroke(ctx, shade(skin, -0.25), 2.5);
  }
  // 翅膀
  for (const sx of [-1, 1]) {
    poly(ctx, [cx + sx * 8, by - 40, cx + sx * 34, by - 58, cx + sx * 30, by - 38, cx + sx * 24, by - 30, cx + sx * 10, by - 28]);
    fillStroke(ctx, vgrad(ctx, by - 58, by - 28, '#5a1a1a', '#2a0a0a'), 2.5);
  }
  ellipse(ctx, cx, by - 30, 15, 15);
  fillStroke(ctx, rgrad(ctx, cx - 4, by - 36, 2, 18, shade(skin, 0.25), shade(skin, -0.3)), 3);
  ellipse(ctx, cx + 2, by - 50, 11, 10);
  fillStroke(ctx, rgrad(ctx, cx - 1, by - 54, 1, 12, shade(skin, 0.3), shade(skin, -0.2)), 2.8);
  for (const sx of [-1, 1]) {
    poly(ctx, [cx + 2 + sx * 6, by - 57, cx + 2 + sx * 13, by - 70, cx + 2 + sx * 10, by - 55]);
    fillStroke(ctx, '#f0e0c0', 2);
  }
  for (const ox of [-2, 6]) {
    circle(ctx, cx + ox, by - 51, 2.2);
    ctx.fillStyle = '#ffe04a';
    ctx.fill();
  }
}

function scorpion(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 3;
  const shell = '#c2763a';
  const dark = '#6a3414';
  // 腳（後排先畫）
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const lx = cx - 14 + i * 9;
    for (const [lw, col] of [
      [5, OUTLINE],
      [2.6, shade(dark, 0.15)],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(lx, by - 12);
      ctx.lineTo(lx - 5, by - 6);
      ctx.lineTo(lx - 3, by);
      ctx.stroke();
    }
  }
  // 尾巴：一節節往上捲到頭頂
  const segs = [
    [cx - 22, by - 16, 7],
    [cx - 30, by - 25, 6.5],
    [cx - 32, by - 37, 6],
    [cx - 26, by - 47, 5.5],
    [cx - 15, by - 52, 5],
  ];
  for (const [x, y, r] of segs) {
    circle(ctx, x, y, r);
    fillStroke(ctx, rgrad(ctx, x - 2, y - 2, 1, r, '#e8a060', shell), 2.5);
  }
  // 毒針
  poly(ctx, [cx - 12, by - 56, cx - 2, by - 50, cx - 10, by - 47]);
  fillStroke(ctx, '#3a1a3a', 2.2);
  circle(ctx, cx - 3, by - 50, 1.8);
  ctx.fillStyle = '#9aff4a';
  ctx.fill();
  // 身體（分節甲殼）
  ellipse(ctx, cx, by - 15, 20, 9);
  fillStroke(ctx, vgrad(ctx, by - 24, by - 6, '#e09a58', dark), 3);
  ctx.strokeStyle = 'rgba(60,20,0,0.5)';
  ctx.lineWidth = 1.5;
  for (const ox of [-8, 0, 8]) {
    ctx.beginPath();
    ctx.moveTo(cx + ox, by - 23);
    ctx.quadraticCurveTo(cx + ox + 2, by - 15, cx + ox, by - 7);
    ctx.stroke();
  }
  // 頭與螯
  ellipse(ctx, cx + 20, by - 15, 8, 7);
  fillStroke(ctx, vgrad(ctx, by - 22, by - 8, '#e8a462', dark), 2.5);
  for (const [oy, sc] of [
    [-6, 1],
    [4, 0.85],
  ] as const) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx + 24, by - 15 + oy * 0.5);
    ctx.lineTo(cx + 34, by - 15 + oy);
    ctx.stroke();
    ctx.strokeStyle = shell;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // 螯鉗
    ctx.save();
    ctx.translate(cx + 38, by - 15 + oy);
    ctx.scale(sc, sc);
    poly(ctx, [-5, -4, 9, -7, 4, -1, 10, 3, -5, 4]);
    fillStroke(ctx, vgrad(ctx, -7, 4, '#eaa868', dark), 2.2);
    ctx.restore();
  }
  // 眼
  for (const ox of [18, 23]) {
    circle(ctx, cx + ox, by - 20, 1.8);
    ctx.fillStyle = '#1a0a00';
    ctx.fill();
  }
}

/** 沙暴巨蟲（首領）：從沙堆中拱起的節狀身軀，張開的巨口朝右 */
function wyrm(ctx: Ctx, w: number, h: number): void {
  const by = h - 4;
  // 沙堆
  ellipse(ctx, w * 0.42, by - 10, w * 0.4, 13);
  fillStroke(ctx, vgrad(ctx, by - 24, by, '#f0d496', '#b48a4a'), 3, '#6a4a22');
  // 身體節：由左下拱起到右上
  const segs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = w * (0.16 + t * 0.52);
    const y = by - 14 - Math.sin(t * Math.PI * 0.95) * (h * 0.5) - t * h * 0.18;
    segs.push([x, y, 17 - t * 3]);
  }
  for (const [x, y, r] of segs) {
    circle(ctx, x, y, r);
    fillStroke(ctx, rgrad(ctx, x - r * 0.3, y - r * 0.4, 2, r, '#d8a870', '#7a4a2a'), 3);
    // 腹甲
    ctx.strokeStyle = 'rgba(255,230,180,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // 背刺
  for (let i = 1; i < segs.length - 1; i += 2) {
    const [x, y, r] = segs[i];
    poly(ctx, [x - 5, y - r + 3, x, y - r - 11, x + 5, y - r + 3]);
    fillStroke(ctx, '#5a3a5a', 2);
  }
  // 頭
  const [hx, hy] = segs[segs.length - 1];
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy - 16);
    ctx.quadraticCurveTo(hx + 22, hy - 30, hx + 40, hy - 10);
    ctx.lineTo(hx + 20, hy - 2);
    ctx.lineTo(hx + 38, hy + 10);
    ctx.quadraticCurveTo(hx + 14, hy + 26, hx - 14, hy + 14);
    ctx.closePath();
  };
  head();
  fillStroke(ctx, vgrad(ctx, hy - 28, hy + 24, '#e0b07a', '#6a3a24'), 3.5);
  // 口腔
  poly(ctx, [hx + 6, hy - 4, hx + 38, hy - 10, hx + 20, hy - 2, hx + 38, hy + 10]);
  ctx.fillStyle = '#5a1020';
  ctx.fill();
  // 牙
  ctx.fillStyle = '#fff6e0';
  for (let k = 0; k < 4; k++) {
    const tx = hx + 14 + k * 6;
    poly(ctx, [tx, hy - 6 - k * 0.8, tx + 3, hy + 1, tx + 6, hy - 7 - k * 0.8]);
    ctx.fill();
    poly(ctx, [tx, hy + 5 + k * 0.6, tx + 3, hy - 1, tx + 6, hy + 6 + k * 0.6]);
    ctx.fill();
  }
  // 眼
  for (const [ex, ey] of [
    [hx + 8, hy - 16],
    [hx - 2, hy - 13],
  ]) {
    ctx.fillStyle = rgrad(ctx, ex, ey, 0, 6, 'rgba(255,200,60,1)', 'rgba(255,120,0,0)');
    circle(ctx, ex, ey, 6);
    ctx.fill();
    circle(ctx, ex, ey, 2.4);
    ctx.fillStyle = '#ffe680';
    ctx.fill();
  }
  // 揚沙
  for (let i = 0; i < 10; i++) {
    circle(ctx, w * 0.12 + i * w * 0.07, by - 18 - (i % 3) * 5, 2.4);
    ctx.fillStyle = 'rgba(220,180,110,0.8)';
    ctx.fill();
  }
}

/** 鑽地時地面隆起的沙堆 */
function sandMound(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const by = h - 2;
  ellipse(ctx, cx, by - 7, 24, 8);
  fillStroke(ctx, vgrad(ctx, by - 15, by, '#f0d496', '#b48a4a'), 2.5, '#6a4a22');
  for (let i = 0; i < 6; i++) {
    circle(ctx, cx - 18 + i * 7, by - 12 - (i % 2) * 3, 2.2);
    ctx.fillStyle = '#d8b06a';
    ctx.fill();
  }
}

export const MONSTERS: Record<string, { w: number; h: number; paint: (ctx: Ctx, w: number, h: number) => void }> = {
  mon_goblin: { w: 64, h: 66, paint: goblin },
  mon_wolf: { w: 92, h: 60, paint: wolf },
  mon_troll: { w: 110, h: 104, paint: troll },
  mon_golem: { w: 86, h: 84, paint: golem },
  mon_sheep: { w: 56, h: 40, paint: sheep },
  mon_bat: { w: 72, h: 44, paint: bat },
  mon_skeleton: { w: 60, h: 66, paint: skeleton },
  mon_demon: { w: 76, h: 76, paint: demon },
  mon_scorpion: { w: 96, h: 64, paint: scorpion },
  mon_wyrm: { w: 160, h: 140, paint: wyrm },
  fx_mound: { w: 56, h: 22, paint: sandMound },
};

export function paintMonsters(s: number): Record<string, HTMLCanvasElement> {
  const out: Record<string, HTMLCanvasElement> = {};
  for (const [k, m] of Object.entries(MONSTERS)) {
    const [cv, ctx] = mkCanvas(m.w * s, m.h * s);
    ctx.scale(s, s);
    m.paint(ctx, m.w, m.h);
    out[k] = cv;
  }
  return out;
}
