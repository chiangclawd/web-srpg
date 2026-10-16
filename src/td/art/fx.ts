import { OUTLINE, circle, ellipse, fillStroke, mkCanvas, poly, rgrad, roundRect, shade, vgrad, type Ctx } from './paint';
import { starPts } from './towers';

type Fn = (ctx: Ctx, w: number, h: number) => void;

const FX: Record<string, { w: number; h: number; paint: Fn }> = {
  fx_soft: {
    w: 64,
    h: 64,
    paint: (c, w, h) => {
      c.fillStyle = rgrad(c, w / 2, h / 2, 0, w / 2, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
      c.fillRect(0, 0, w, h);
    },
  },
  fx_shadow: {
    w: 64,
    h: 24,
    paint: (c, w, h) => {
      c.save();
      c.scale(1, h / w);
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
      c.fillRect(0, 0, w, w);
      c.restore();
    },
  },
  fx_smoke: {
    w: 48,
    h: 48,
    paint: (c, w) => {
      circle(c, w / 2, w / 2, w / 2 - 3);
      c.fillStyle = rgrad(c, w / 2 - 6, w / 2 - 8, 2, w / 2, 'rgba(255,255,255,0.95)', 'rgba(200,200,200,0.85)');
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(120,110,100,0.6)';
      c.stroke();
    },
  },
  fx_fire: {
    w: 48,
    h: 48,
    paint: (c, w) => {
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(255,250,200,1)', 'rgba(255,120,20,0)');
      circle(c, w / 2, w / 2, w / 2);
      c.fill();
    },
  },
  fx_spark: {
    w: 24,
    h: 24,
    paint: (c, w) => {
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(255,255,220,1)', 'rgba(255,220,80,0)');
      circle(c, w / 2, w / 2, w / 2);
      c.fill();
      poly(c, starPts(w / 2, w / 2, w / 2, w / 8, 4));
      c.fillStyle = '#fffbe0';
      c.fill();
    },
  },
  fx_star: {
    w: 28,
    h: 28,
    paint: (c, w) => {
      poly(c, starPts(w / 2, w / 2 + 1, w / 2 - 2, w / 4.5, 5));
      fillStroke(c, vgrad(c, 2, w, '#fff3a0', '#f0a020'), 2);
    },
  },
  fx_ring: {
    w: 128,
    h: 128,
    paint: (c, w) => {
      circle(c, w / 2, w / 2, w / 2 - 6);
      c.lineWidth = 8;
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.stroke();
    },
  },
  fx_coin: {
    w: 26,
    h: 26,
    paint: (c, w) => {
      circle(c, w / 2, w / 2, w / 2 - 2);
      fillStroke(c, rgrad(c, w / 2 - 3, w / 2 - 3, 1, w / 2, '#fff2a0', '#e0a020'), 2, '#7a4a00');
      circle(c, w / 2, w / 2, w / 2 - 6);
      c.lineWidth = 1.5;
      c.strokeStyle = '#a06a10';
      c.stroke();
    },
  },
  fx_debris: {
    w: 14,
    h: 14,
    paint: (c) => {
      poly(c, [2, 8, 5, 2, 11, 3, 12, 10, 6, 12]);
      fillStroke(c, '#8a6a4a', 1.5);
    },
  },
  fx_leaf: {
    w: 16,
    h: 12,
    paint: (c) => {
      ellipse(c, 8, 6, 6, 3.5);
      fillStroke(c, '#6fbf3a', 1.2, '#2a5a14');
    },
  },
  fx_snow: {
    w: 12,
    h: 12,
    paint: (c) => {
      c.fillStyle = rgrad(c, 6, 6, 0, 6, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
      circle(c, 6, 6, 6);
      c.fill();
    },
  },
  fx_heal: {
    w: 22,
    h: 22,
    paint: (c) => {
      poly(c, [8, 2, 14, 2, 14, 8, 20, 8, 20, 14, 14, 14, 14, 20, 8, 20, 8, 14, 2, 14, 2, 8, 8, 8]);
      fillStroke(c, vgrad(c, 2, 20, '#b8ffb0', '#3ad04a'), 1.8, '#145a1a');
    },
  },
  fx_skull: {
    w: 26,
    h: 26,
    paint: (c) => {
      ellipse(c, 13, 11, 9, 8.5);
      fillStroke(c, '#f2ecdc', 2);
      roundRect(c, 8, 15, 10, 7, 2);
      fillStroke(c, '#f2ecdc', 2);
      c.fillStyle = OUTLINE;
      circle(c, 9.5, 11, 2.6);
      c.fill();
      circle(c, 16.5, 11, 2.6);
      c.fill();
    },
  },
  fx_crack: {
    w: 96,
    h: 48,
    paint: (c, w, h) => {
      c.save();
      c.scale(1, h / w);
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(40,20,10,0.7)', 'rgba(40,20,10,0)');
      circle(c, w / 2, w / 2, w / 2);
      c.fill();
      c.strokeStyle = 'rgba(30,15,5,0.85)';
      c.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        c.beginPath();
        c.moveTo(w / 2, w / 2);
        c.lineTo(w / 2 + Math.cos(a) * w * 0.3, w / 2 + Math.sin(a) * w * 0.3);
        c.lineTo(w / 2 + Math.cos(a + 0.3) * w * 0.42, w / 2 + Math.sin(a + 0.3) * w * 0.42);
        c.stroke();
      }
      c.restore();
    },
  },
  fx_rally: {
    w: 40,
    h: 44,
    paint: (c) => {
      c.strokeStyle = OUTLINE;
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(12, 42);
      c.lineTo(12, 4);
      c.stroke();
      poly(c, [13, 5, 36, 11, 13, 20]);
      fillStroke(c, vgrad(c, 5, 20, '#6aa0ff', '#2a5ad0'), 2.5);
      ellipse(c, 12, 41, 8, 3);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fill();
    },
  },
  // ── 投射物 ──
  pj_arrow: {
    w: 34,
    h: 8,
    paint: (c) => {
      c.strokeStyle = '#3a2412';
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(3, 4);
      c.lineTo(27, 4);
      c.stroke();
      c.strokeStyle = '#d0a060';
      c.lineWidth = 1.6;
      c.stroke();
      poly(c, [26, 0.5, 34, 4, 26, 7.5]);
      fillStroke(c, '#e8eef4', 1.4, '#3a3a3a');
      poly(c, [1, 1, 7, 4, 1, 7, 4, 4]);
      c.fillStyle = '#ff5a4a';
      c.fill();
    },
  },
  pj_bolt: {
    w: 36,
    h: 36,
    paint: (c, w) => {
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(230,190,255,1)', 'rgba(150,60,255,0)');
      circle(c, w / 2, w / 2, w / 2);
      c.fill();
      circle(c, w / 2, w / 2, 6);
      c.fillStyle = '#ffffff';
      c.fill();
    },
  },
  pj_enemybolt: {
    w: 30,
    h: 30,
    paint: (c, w) => {
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(200,255,140,1)', 'rgba(60,200,40,0)');
      circle(c, w / 2, w / 2, w / 2);
      c.fill();
      circle(c, w / 2, w / 2, 4.5);
      c.fillStyle = '#f4ffe0';
      c.fill();
    },
  },
  pj_ice: {
    w: 30,
    h: 30,
    paint: (c, w) => {
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(200,240,255,1)', 'rgba(80,170,255,0)');
      circle(c, w / 2, w / 2, w / 2);
      c.fill();
      poly(c, [w / 2 - 7, w / 2, w / 2, w / 2 - 4, w / 2 + 9, w / 2, w / 2, w / 2 + 4]);
      fillStroke(c, '#e8f8ff', 1.5, '#4a8ad0');
    },
  },
  pj_bomb: {
    w: 22,
    h: 24,
    paint: (c) => {
      circle(c, 11, 14, 8.5);
      fillStroke(c, rgrad(c, 8, 11, 1, 9, '#7a7a7a', '#1e1e1e'), 2.2);
      c.strokeStyle = '#7a5a2a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(14, 7);
      c.quadraticCurveTo(17, 3, 19, 4);
      c.stroke();
      circle(c, 19, 4, 2.6);
      c.fillStyle = '#ffd24a';
      c.fill();
    },
  },
  pj_meteor: {
    w: 64,
    h: 64,
    paint: (c, w) => {
      c.fillStyle = rgrad(c, w / 2, w / 2, 0, w / 2, 'rgba(255,220,120,0.9)', 'rgba(255,80,0,0)');
      circle(c, w / 2, w / 2, w / 2);
      c.fill();
      circle(c, w / 2, w / 2, 12);
      fillStroke(c, rgrad(c, w / 2 - 4, w / 2 - 4, 1, 13, '#ffef9a', '#d0401a'), 2.5, '#5a1a0a');
      c.fillStyle = 'rgba(90,30,10,0.7)';
      circle(c, w / 2 + 4, w / 2 + 2, 3);
      c.fill();
      circle(c, w / 2 - 3, w / 2 + 5, 2);
      c.fill();
    },
  },
  pj_axe: {
    w: 24,
    h: 24,
    paint: (c) => {
      c.strokeStyle = OUTLINE;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(5, 20);
      c.lineTo(17, 6);
      c.stroke();
      c.strokeStyle = '#8a5a2a';
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.moveTo(13, 3);
      c.quadraticCurveTo(24, 2, 22, 13);
      c.lineTo(15, 8);
      c.closePath();
      fillStroke(c, vgrad(c, 2, 13, '#ffffff', '#9aa6b0'), 1.8);
    },
  },
  pj_missile: {
    w: 36,
    h: 14,
    paint: (c) => {
      roundRect(c, 4, 3, 24, 8, 4);
      fillStroke(c, vgrad(c, 3, 11, '#e0e6ea', '#7a8690'), 2);
      poly(c, [27, 2.5, 35, 7, 27, 11.5]);
      fillStroke(c, '#c0392b', 1.8);
      poly(c, [4, 3, 0, 0, 2, 7, 0, 14, 4, 11]);
      fillStroke(c, '#c0392b', 1.5);
    },
  },
  pj_snipe: {
    w: 46,
    h: 8,
    paint: (c) => {
      c.strokeStyle = 'rgba(255,240,180,0.6)';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(0, 4);
      c.lineTo(38, 4);
      c.stroke();
      c.strokeStyle = '#3a2412';
      c.lineWidth = 2.5;
      c.stroke();
      poly(c, [36, 0.5, 46, 4, 36, 7.5]);
      fillStroke(c, '#e8eef4', 1.4, '#3a3a3a');
    },
  },
};

export function paintFx(s: number): Record<string, HTMLCanvasElement> {
  const out: Record<string, HTMLCanvasElement> = {};
  for (const [k, f] of Object.entries(FX)) {
    const [cv, ctx] = mkCanvas(f.w * s, f.h * s);
    ctx.scale(s, s);
    f.paint(ctx, f.w, f.h);
    out[k] = cv;
  }
  void shade;
  return out;
}
