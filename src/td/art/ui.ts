import { OUTLINE, circle, ellipse, fillStroke, mkCanvas, poly, rgrad, roundRect, shade, vgrad, type Ctx } from './paint';
import { starPts } from './towers';

type Fn = (c: Ctx, w: number, h: number) => void;

// ═════════════════════════ 面板 / 按鈕（9-slice） ═════════════════════════

function woodPanel(c: Ctx, w: number, h: number): void {
  roundRect(c, 3, 3, w - 6, h - 6, 22);
  fillStroke(c, vgrad(c, 0, h, '#8a5a30', '#5a3618'), 4, '#2a1608');
  roundRect(c, 12, 12, w - 24, h - 24, 14);
  fillStroke(c, vgrad(c, 12, h - 12, '#f4e2b8', '#e2c890'), 3, '#6a4220');
  // 木紋
  c.strokeStyle = 'rgba(60,30,10,0.35)';
  c.lineWidth = 1.5;
  for (const y of [7, h - 8]) {
    c.beginPath();
    c.moveTo(18, y);
    c.lineTo(w - 18, y);
    c.stroke();
  }
  // 鉚釘
  for (const [x, y] of [
    [10, 10],
    [w - 10, 10],
    [10, h - 10],
    [w - 10, h - 10],
  ]) {
    circle(c, x, y, 4);
    fillStroke(c, rgrad(c, x - 1, y - 1, 0, 4, '#ffe9a0', '#b07a20'), 1.5);
  }
}

function darkPanel(c: Ctx, w: number, h: number): void {
  roundRect(c, 2, 2, w - 4, h - 4, 16);
  fillStroke(c, vgrad(c, 0, h, 'rgba(58,36,18,0.94)', 'rgba(34,20,8,0.94)'), 3, '#c89a50');
  roundRect(c, 7, 7, w - 14, h - 14, 11);
  c.lineWidth = 1.5;
  c.strokeStyle = 'rgba(255,220,150,0.25)';
  c.stroke();
}

function button(color: string): Fn {
  return (c, w, h) => {
    roundRect(c, 2, 4, w - 4, h - 6, 16);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fill();
    roundRect(c, 2, 1, w - 4, h - 7, 16);
    fillStroke(c, vgrad(c, 0, h, shade(color, 0.25), shade(color, -0.3)), 3.5, '#2a1608');
    roundRect(c, 8, 5, w - 16, (h - 10) * 0.42, 10);
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.fill();
  };
}

function badge(rim: string, inner: string): Fn {
  return (c, w) => {
    const r = w / 2;
    circle(c, r, r + 2, r - 3);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fill();
    circle(c, r, r, r - 3);
    fillStroke(c, vgrad(c, 0, w, shade(rim, 0.35), shade(rim, -0.35)), 3, '#2a1608');
    circle(c, r, r, r - 10);
    fillStroke(c, rgrad(c, r - 6, r - 8, 2, r, shade(inner, 0.25), shade(inner, -0.35)), 2, shade(rim, -0.5));
  };
}

function pill(c: Ctx, w: number, h: number): void {
  roundRect(c, 1.5, 1.5, w - 3, h - 3, h / 2);
  fillStroke(c, vgrad(c, 0, h, '#4a2e14', '#2a1808'), 2.5, '#d8a84a');
}

// ═════════════════════════ 圖示符號（透明底） ═════════════════════════

function arrowUp(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m, 8, w - 10, m, m + 8, m, m + 8, w - 10, m - 8, w - 10, m - 8, m, 10, m]);
  fillStroke(c, vgrad(c, 8, w - 10, '#b8ff7a', '#3aa02a'), 3);
}

function coinIcon(c: Ctx, w: number): void {
  const m = w / 2;
  for (const [ox, oy] of [
    [-7, 6],
    [6, 2],
  ]) {
    ellipse(c, m + ox, m + oy + 6, 15, 7);
    fillStroke(c, '#c88a1a', 2.5);
  }
  circle(c, m, m - 2, 16);
  fillStroke(c, rgrad(c, m - 5, m - 7, 2, 18, '#fff3a0', '#e0a020'), 3, '#6a3a00');
  c.fillStyle = '#8a5200';
  c.font = 'bold 20px Arial';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('$', m, m - 1);
}

function flagIcon(c: Ctx, w: number): void {
  c.strokeStyle = OUTLINE;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(20, w - 10);
  c.lineTo(20, 10);
  c.stroke();
  poly(c, [21, 11, w - 12, 19, 21, 30]);
  fillStroke(c, vgrad(c, 10, 30, '#7ab0ff', '#2a5ad0'), 3);
}

function lockIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 6;
  c.strokeStyle = OUTLINE;
  c.beginPath();
  c.arc(m, m - 4, 10, Math.PI, 0);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = '#c0c8d0';
  c.stroke();
  roundRect(c, m - 15, m - 4, 30, 24, 4);
  fillStroke(c, vgrad(c, m - 4, m + 20, '#ffd86a', '#b07a10'), 3);
  circle(c, m, m + 7, 3.5);
  c.fillStyle = OUTLINE;
  c.fill();
}

function checkIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m - 18, m, m - 8, m - 9, m - 3, m + 2, m + 14, m - 16, m + 22, m - 7, m - 4, m + 18]);
  fillStroke(c, vgrad(c, m - 16, m + 18, '#b8ff7a', '#2a9a2a'), 3);
}

function meteorIcon(c: Ctx, w: number): void {
  c.save();
  c.translate(w / 2, w / 2);
  c.rotate(-0.8);
  poly(c, [-6, -2, 8, -26, 6, -2, 14, -22, 10, 4, -10, 4]);
  c.fillStyle = 'rgba(255,170,40,0.9)';
  c.fill();
  c.restore();
  circle(c, w / 2 - 3, w / 2 + 5, 11);
  fillStroke(c, rgrad(c, w / 2 - 6, w / 2 + 2, 1, 12, '#ffef9a', '#d0401a'), 3, '#4a1a0a');
}

function swordsIcon(c: Ctx, w: number): void {
  const m = w / 2;
  for (const s of [-1, 1]) {
    c.save();
    c.translate(m, m);
    c.rotate(s * 0.75);
    roundRect(c, -3.5, -22, 7, 32, 3);
    fillStroke(c, vgrad(c, -22, 10, '#ffffff', '#9aa6b0'), 2.5);
    roundRect(c, -10, 9, 20, 5, 2);
    fillStroke(c, '#d9a441', 2);
    roundRect(c, -3, 14, 6, 9, 2);
    fillStroke(c, '#6b4423', 2);
    c.restore();
  }
}

function heartIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.beginPath();
  c.moveTo(m, w - 12);
  c.bezierCurveTo(m - 30, m - 2, m - 16, 8, m, m - 10);
  c.bezierCurveTo(m + 16, 8, m + 30, m - 2, m, w - 12);
  fillStroke(c, rgrad(c, m - 8, m - 10, 2, 26, '#ff8a8a', '#c81e2e'), 3);
  ellipse(c, m - 8, m - 6, 5, 3);
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fill();
}

function skullIcon(c: Ctx, w: number): void {
  const m = w / 2;
  ellipse(c, m, m - 4, 17, 16);
  fillStroke(c, vgrad(c, m - 20, m + 12, '#ffffff', '#cfc6b0'), 3);
  roundRect(c, m - 10, m + 6, 20, 12, 3);
  fillStroke(c, '#e8e0cc', 3);
  c.fillStyle = OUTLINE;
  ellipse(c, m - 7, m - 4, 5, 5.5);
  c.fill();
  ellipse(c, m + 7, m - 4, 5, 5.5);
  c.fill();
  poly(c, [m, m + 1, m - 3, m + 6, m + 3, m + 6]);
  c.fill();
  for (const x of [-5, 0, 5]) {
    c.fillRect(m + x - 0.8, m + 9, 1.6, 8);
  }
}

function pauseIcon(c: Ctx, w: number): void {
  const m = w / 2;
  for (const x of [m - 10, m + 4]) {
    roundRect(c, x, m - 14, 7, 28, 2);
    fillStroke(c, '#fff6dc', 3);
  }
}

function playIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m - 9, m - 15, m + 14, m, m - 9, m + 15]);
  fillStroke(c, '#fff6dc', 3);
}

function fastIcon(c: Ctx, w: number): void {
  const m = w / 2;
  for (const ox of [-12, 3]) {
    poly(c, [m + ox, m - 13, m + ox + 14, m, m + ox, m + 13]);
    fillStroke(c, '#fff6dc', 3);
  }
}

function starIcon(filled: boolean): Fn {
  return (c, w) => {
    poly(c, starPts(w / 2, w / 2 + 2, w / 2 - 4, w / 4.6, 5));
    if (filled) fillStroke(c, vgrad(c, 4, w, '#fff3a0', '#f0a020'), 3, '#5a3200');
    else fillStroke(c, 'rgba(60,40,20,0.75)', 3, '#2a1608');
  };
}

function closeIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineCap = 'round';
  c.lineWidth = 11;
  c.strokeStyle = OUTLINE;
  c.beginPath();
  c.moveTo(m - 12, m - 12);
  c.lineTo(m + 12, m + 12);
  c.moveTo(m + 12, m - 12);
  c.lineTo(m - 12, m + 12);
  c.stroke();
  c.lineWidth = 6;
  c.strokeStyle = '#ff6a5a';
  c.stroke();
}

function infoIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.fillStyle = '#fff6dc';
  c.strokeStyle = OUTLINE;
  c.lineWidth = 3;
  circle(c, m, m - 13, 4.5);
  c.fill();
  c.stroke();
  roundRect(c, m - 4.5, m - 4, 9, 22, 3);
  c.fill();
  c.stroke();
}

function gearIcon(c: Ctx, w: number): void {
  const m = w / 2;
  const pts: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? 19 : 14;
    pts.push(m + Math.cos(a) * r, m + Math.sin(a) * r);
  }
  poly(c, pts);
  fillStroke(c, vgrad(c, m - 19, m + 19, '#f0f0f0', '#9aa0a8'), 3);
  circle(c, m, m, 6);
  c.fillStyle = OUTLINE;
  c.fill();
}

function speakerIcon(on: boolean): Fn {
  return (c, w) => {
    const m = w / 2;
    poly(c, [m - 16, m - 7, m - 7, m - 7, m + 3, m - 16, m + 3, m + 16, m - 7, m + 7, m - 16, m + 7]);
    fillStroke(c, '#fff6dc', 3);
    c.lineWidth = 3.5;
    if (on) {
      c.strokeStyle = '#fff6dc';
      c.beginPath();
      c.arc(m + 4, m, 9, -0.8, 0.8);
      c.stroke();
      c.beginPath();
      c.arc(m + 4, m, 16, -0.8, 0.8);
      c.stroke();
    } else {
      c.strokeStyle = '#ff6a5a';
      c.beginPath();
      c.moveTo(m + 8, m - 8);
      c.lineTo(m + 20, m + 8);
      c.moveTo(m + 20, m - 8);
      c.lineTo(m + 8, m + 8);
      c.stroke();
    }
  };
}

function dropIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.beginPath();
  c.moveTo(m, m - 20);
  c.bezierCurveTo(m + 6, m - 8, m + 16, m, m + 14, m + 8);
  c.arc(m, m + 6, 14, 0.1, Math.PI - 0.1);
  c.bezierCurveTo(m - 16, m, m - 6, m - 8, m, m - 20);
  fillStroke(c, rgrad(c, m - 4, m, 2, 18, '#c8ff7a', '#3a9a1a'), 3);
}

function vineIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 6;
  c.strokeStyle = OUTLINE;
  c.beginPath();
  c.moveTo(m - 16, m + 18);
  c.bezierCurveTo(m - 10, m - 10, m + 18, m + 4, m + 8, m - 18);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = '#5aa02a';
  c.stroke();
  for (const [x, y] of [
    [m - 8, m + 4],
    [m + 6, m - 4],
    [m + 10, m - 14],
  ]) {
    poly(c, [x, y, x + 6, y - 3, x + 2, y + 4]);
    fillStroke(c, '#d0d0c0', 1.5);
  }
}

function crosshairIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 6;
  c.strokeStyle = OUTLINE;
  circle(c, m, m, 14);
  c.stroke();
  c.beginPath();
  c.moveTo(m, m - 22);
  c.lineTo(m, m + 22);
  c.moveTo(m - 22, m);
  c.lineTo(m + 22, m);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = '#ff5a4a';
  circle(c, m, m, 14);
  c.stroke();
  c.beginPath();
  c.moveTo(m, m - 22);
  c.lineTo(m, m + 22);
  c.moveTo(m - 22, m);
  c.lineTo(m + 22, m);
  c.stroke();
}

function fanIcon(c: Ctx, w: number): void {
  const m = w / 2;
  for (const a of [-0.5, 0, 0.5]) {
    c.save();
    c.translate(m - 10, m + 12);
    c.rotate(-Math.PI / 4 + a);
    c.lineWidth = 5;
    c.strokeStyle = OUTLINE;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(26, 0);
    c.stroke();
    c.lineWidth = 2;
    c.strokeStyle = '#d0a060';
    c.stroke();
    poly(c, [24, -4, 32, 0, 24, 4]);
    fillStroke(c, '#e8eef4', 1.5);
    c.restore();
  }
}

function crossIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m - 6, m - 18, m + 6, m - 18, m + 6, m - 6, m + 18, m - 6, m + 18, m + 6, m + 6, m + 6, m + 6, m + 18, m - 6, m + 18, m - 6, m + 6, m - 18, m + 6, m - 18, m - 6, m - 6, m - 6]);
  fillStroke(c, vgrad(c, m - 18, m + 18, '#ffffff', '#ffd86a'), 3);
}

function sunIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, starPts(m, m, 21, 11, 10));
  fillStroke(c, vgrad(c, m - 20, m + 20, '#fff7b0', '#f0a020'), 3);
  circle(c, m, m, 7);
  c.fillStyle = '#fffbe0';
  c.fill();
}

function spiralIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 6;
  c.strokeStyle = OUTLINE;
  c.beginPath();
  for (let t = 0; t < 12; t += 0.2) {
    const r = 2 + t * 1.6;
    const x = m + Math.cos(t) * r;
    const y = m + Math.sin(t) * r;
    if (t === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = '#c8e0ff';
  c.stroke();
}

function axeIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
  c.beginPath();
  c.moveTo(m - 14, m + 18);
  c.lineTo(m + 10, m - 14);
  c.stroke();
  c.lineWidth = 4;
  c.strokeStyle = '#8a5a2a';
  c.stroke();
  c.beginPath();
  c.moveTo(m + 2, m - 20);
  c.quadraticCurveTo(m + 24, m - 22, m + 20, m + 2);
  c.lineTo(m + 6, m - 8);
  c.closePath();
  fillStroke(c, vgrad(c, m - 22, m + 2, '#ffffff', '#9aa6b0'), 3);
}

function beamIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 12;
  c.strokeStyle = 'rgba(200,120,255,0.5)';
  c.beginPath();
  c.moveTo(m - 18, m + 18);
  c.lineTo(m + 18, m - 18);
  c.stroke();
  c.lineWidth = 5;
  c.strokeStyle = '#f4e0ff';
  c.stroke();
  poly(c, starPts(m + 14, m - 14, 9, 3, 4));
  c.fillStyle = '#ffffff';
  c.fill();
}

function boltIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m + 4, m - 22, m - 12, m + 2, m - 1, m + 2, m - 6, m + 22, m + 12, m - 4, m + 1, m - 4]);
  fillStroke(c, vgrad(c, m - 22, m + 22, '#ffffff', '#5ab0ff'), 3);
}

function rockIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m - 18, m + 12, m - 14, m - 10, m, m - 18, m + 16, m - 8, m + 18, m + 12, m, m + 18]);
  fillStroke(c, vgrad(c, m - 18, m + 18, '#d0b088', '#7a5a3a'), 3);
  c.strokeStyle = '#ff8a2a';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(m - 6, m - 8);
  c.lineTo(m + 2, m + 2);
  c.lineTo(m - 2, m + 12);
  c.stroke();
}

function sheepIcon(c: Ctx, w: number): void {
  const m = w / 2;
  for (const [x, y, r] of [
    [m - 8, m + 2, 10],
    [m + 4, m - 2, 11],
    [m + 2, m + 8, 9],
  ]) {
    circle(c, x, y, r);
    fillStroke(c, '#ffffff', 3);
  }
  ellipse(c, m + 14, m - 6, 7, 8);
  fillStroke(c, '#3a3a3a', 2.5);
}

function bombsIcon(c: Ctx, w: number): void {
  const m = w / 2;
  for (const [x, y] of [
    [m - 9, m + 8],
    [m + 9, m + 8],
    [m, m - 6],
  ]) {
    circle(c, x, y, 9);
    fillStroke(c, rgrad(c, x - 3, y - 3, 1, 10, '#7a7a7a', '#1e1e1e'), 2.5);
  }
}

function rocketIcon(c: Ctx, w: number): void {
  c.save();
  c.translate(w / 2, w / 2);
  c.rotate(-0.8);
  roundRect(c, -18, -6, 30, 12, 6);
  fillStroke(c, vgrad(c, -6, 6, '#f0f4f8', '#8a96a0'), 2.5);
  poly(c, [11, -6, 22, 0, 11, 6]);
  fillStroke(c, '#c0392b', 2.5);
  poly(c, [-18, -6, -24, -12, -22, 0, -24, 12, -18, 6]);
  fillStroke(c, '#c0392b', 2.5);
  c.restore();
}

function shieldIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.beginPath();
  c.moveTo(m - 16, m - 16);
  c.lineTo(m + 16, m - 16);
  c.lineTo(m + 16, m);
  c.quadraticCurveTo(m + 12, m + 16, m, m + 21);
  c.quadraticCurveTo(m - 12, m + 16, m - 16, m);
  c.closePath();
  fillStroke(c, vgrad(c, m - 16, m + 20, '#6aa0ff', '#2a4a9a'), 3);
  poly(c, starPts(m, m, 8, 3.5, 5));
  c.fillStyle = '#ffd86a';
  c.fill();
}

function bookIcon(c: Ctx, w: number): void {
  const m = w / 2;
  roundRect(c, m - 18, m - 16, 36, 32, 4);
  fillStroke(c, vgrad(c, m - 16, m + 16, '#c0392b', '#7a1a12'), 3);
  roundRect(c, m - 13, m - 12, 26, 24, 2);
  fillStroke(c, '#f4e2b8', 2);
  c.strokeStyle = '#8a6a3a';
  c.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(m - 9, m - 6 + i * 5);
    c.lineTo(m + 9, m - 6 + i * 5);
    c.stroke();
  }
}

function crownIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m - 18, m + 12, m - 20, m - 10, m - 9, m, m, m - 16, m + 9, m, m + 20, m - 10, m + 18, m + 12]);
  fillStroke(c, vgrad(c, m - 16, m + 12, '#fff3a0', '#e0a020'), 3);
  for (const x of [-9, 0, 9]) {
    circle(c, m + x, m + 6, 2.5);
    c.fillStyle = '#c0392b';
    c.fill();
  }
}

function hammerIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 7;
  c.strokeStyle = OUTLINE;
  c.beginPath();
  c.moveTo(m - 14, m + 18);
  c.lineTo(m + 6, m - 4);
  c.stroke();
  c.lineWidth = 4;
  c.strokeStyle = '#8a5a2a';
  c.stroke();
  c.save();
  c.translate(m + 8, m - 8);
  c.rotate(-0.8);
  roundRect(c, -14, -7, 28, 14, 3);
  fillStroke(c, vgrad(c, -7, 7, '#e0e6ea', '#7a8690'), 3);
  c.restore();
}

function mapIcon(c: Ctx, w: number): void {
  const m = w / 2;
  poly(c, [m - 20, m - 14, m - 7, m - 18, m + 7, m - 14, m + 20, m - 18, m + 20, m + 14, m + 7, m + 18, m - 7, m + 14, m - 20, m + 18]);
  fillStroke(c, vgrad(c, m - 18, m + 18, '#f4e2b8', '#d2b07a'), 3);
  c.strokeStyle = '#c0392b';
  c.lineWidth = 2.5;
  c.setLineDash([3, 3]);
  c.beginPath();
  c.moveTo(m - 14, m + 8);
  c.quadraticCurveTo(m - 4, m - 10, m + 12, m - 6);
  c.stroke();
  c.setLineDash([]);
}

function retryIcon(c: Ctx, w: number): void {
  const m = w / 2;
  c.lineWidth = 8;
  c.strokeStyle = OUTLINE;
  c.beginPath();
  c.arc(m, m, 14, -0.4, Math.PI * 1.5);
  c.stroke();
  c.lineWidth = 4;
  c.strokeStyle = '#fff6dc';
  c.stroke();
  poly(c, [m + 4, m - 24, m + 18, m - 14, m + 4, m - 6]);
  fillStroke(c, '#fff6dc', 2.5);
}

const ICONS: Record<string, Fn> = {
  ic_upgrade: arrowUp,
  ic_sell: coinIcon,
  ic_coin: coinIcon,
  ic_rally: flagIcon,
  ic_lock: lockIcon,
  ic_check: checkIcon,
  ic_meteor: meteorIcon,
  ic_reinforce: swordsIcon,
  ic_heart: heartIcon,
  ic_skull: skullIcon,
  ic_pause: pauseIcon,
  ic_play: playIcon,
  ic_fast: fastIcon,
  ic_star: starIcon(true),
  ic_star_empty: starIcon(false),
  ic_close: closeIcon,
  ic_info: infoIcon,
  ic_gear: gearIcon,
  ic_sound_on: speakerIcon(true),
  ic_sound_off: speakerIcon(false),
  ic_shield: shieldIcon,
  ic_book: bookIcon,
  ic_crown: crownIcon,
  ic_hammer: hammerIcon,
  ic_map: mapIcon,
  ic_retry: retryIcon,
  // 技能
  sk_poison: dropIcon,
  sk_thorns: vineIcon,
  sk_snipe: crosshairIcon,
  sk_scatter: fanIcon,
  sk_healing: crossIcon,
  sk_holystrike: sunIcon,
  sk_whirlwind: spiralIcon,
  sk_axes: axeIcon,
  sk_disintegrate: beamIcon,
  sk_teleport: spiralIcon,
  sk_golem: rockIcon,
  sk_polymorph: sheepIcon,
  sk_supercharge: boltIcon,
  sk_overcharge: sunIcon,
  sk_cluster: bombsIcon,
  sk_missile: rocketIcon,
  sk_bash: shieldIcon,
  sk_rally: crossIcon,
  sk_holyblade: sunIcon,
  sk_multishot: fanIcon,
  sk_pierce: crosshairIcon,
  sk_hail: fanIcon,
  sk_frostnova: spiralIcon,
  sk_icelance: beamIcon,
  sk_blizzard: spiralIcon,
};

const UI: Record<string, { w: number; h: number; paint: Fn }> = {
  ui_panel: { w: 120, h: 120, paint: woodPanel },
  ui_dark: { w: 80, h: 80, paint: darkPanel },
  ui_btn_green: { w: 100, h: 56, paint: button('#5aa83a') },
  ui_btn_red: { w: 100, h: 56, paint: button('#c8452e') },
  ui_btn_blue: { w: 100, h: 56, paint: button('#3a78c8') },
  ui_btn_gold: { w: 100, h: 56, paint: button('#e0a830') },
  ui_btn_grey: { w: 100, h: 56, paint: button('#7a7268') },
  ui_btn_wood: { w: 100, h: 56, paint: button('#9a6a38') },
  ui_badge: { w: 76, h: 76, paint: badge('#e0b050', '#5a3a1e') },
  ui_badge_blue: { w: 76, h: 76, paint: badge('#e0b050', '#2a4a7a') },
  ui_badge_green: { w: 76, h: 76, paint: badge('#e0b050', '#2a6a2a') },
  ui_badge_red: { w: 76, h: 76, paint: badge('#e0b050', '#7a2a1a') },
  ui_badge_grey: { w: 76, h: 76, paint: badge('#8a8278', '#3a3632') },
  ui_pill: { w: 64, h: 26, paint: pill },
};

export function paintUi(s: number): Record<string, HTMLCanvasElement> {
  const out: Record<string, HTMLCanvasElement> = {};
  for (const [k, f] of Object.entries(ICONS)) {
    const [cv, ctx] = mkCanvas(56 * s, 56 * s);
    ctx.scale(s, s);
    f(ctx, 56, 56);
    out[k] = cv;
  }
  for (const [k, f] of Object.entries(UI)) {
    const [cv, ctx] = mkCanvas(f.w * s, f.h * s);
    ctx.scale(s, s);
    f.paint(ctx, f.w, f.h);
    out[k] = cv;
  }
  return out;
}

/** 塔圖示：把塔的紋理縮進圓形徽章 */
export function towerBadge(tower: HTMLCanvasElement, s: number, inner = '#3a5a2a'): HTMLCanvasElement {
  const W = 76;
  const [cv, ctx] = mkCanvas(W * s, W * s);
  ctx.scale(s, s);
  badge('#e0b050', inner)(ctx, W, W);
  ctx.save();
  circle(ctx, W / 2, W / 2, W / 2 - 11);
  ctx.clip();
  const tw = tower.width / s;
  const th = tower.height / s;
  const k = 0.5;
  ctx.drawImage(tower, W / 2 - (tw * k) / 2, W / 2 - th * k * 0.58, tw * k, th * k);
  ctx.restore();
  return cv;
}
