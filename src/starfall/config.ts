import Phaser from 'phaser';
import { getLang } from './i18n';

/** 邏輯高度固定 720；寬度依裝置比例 1280~1560 */
export const VIEW_H = 720;
export const MIN_W = 1280;
export const MAX_W = 1560;

/** 觸控為主的裝置（手機、平板） */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
}

/** 遊戲能用的畫面大小：iPhone 橫拿時 #game 會讓出左右的瀏海安全區域 */
function screenBox(): { w: number; h: number } {
  const el = document.getElementById('game');
  return { w: el?.clientWidth || window.innerWidth, h: el?.clientHeight || window.innerHeight };
}

/**
 * 渲染倍率：高 DPI 螢幕把 canvas 開大、相機 zoom 同倍率，邏輯座標仍是 720 高，但文字和線條銳利。
 * 手機記憶體吃緊，最多 1.5 倍。
 */
function autoRS(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const hPx = Math.min(window.innerHeight, window.innerWidth) * dpr;
  const fit = Math.floor((hPx / VIEW_H) * 4) / 4;
  return Phaser.Math.Clamp(fit, 1, isTouchDevice() ? 1.5 : 2);
}

export const RS: number = autoRS();

export function computeViewW(): number {
  if (typeof window === 'undefined') return MAX_W;
  const { w, h } = screenBox();
  const aspect = Math.max(w, h) / Math.min(w, h);
  return Math.round(Phaser.Math.Clamp(VIEW_H * aspect, MIN_W, MAX_W));
}

/** 目前的邏輯寬度 */
export function viewW(scene: Phaser.Scene): number {
  return Math.round(scene.scale.width / RS);
}

/** 介面場景：相機 zoom = RS、以左上為原點，之後都用邏輯座標排版 */
export function setupCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(RS);
  return cam;
}

const CJK_FONTS = '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Heiti TC", "PingFang SC", "Microsoft YaHei", "Noto Sans SC"';
export const FONT = `"Trebuchet MS", "Segoe UI", ${CJK_FONTS}, sans-serif`;

/** 手機字體放大：720 高的畫面在手機上縮到約一半，小字放大到實際至少約 12.5 CSS px（最多 1.5 倍） */
const MIN_CSS_PX = 12.5;
const MAX_BOOST = 1.5;

function screenScale(): number {
  if (typeof window === 'undefined') return 1;
  const box = screenBox();
  return Math.min(Math.max(box.w, box.h) / computeViewW(), Math.min(box.w, box.h) / VIEW_H);
}

let textMin = MIN_CSS_PX / screenScale();

export function refreshTextScale(): void {
  textMin = MIN_CSS_PX / screenScale();
}

/** 邏輯字級 → 實際使用的字級（小螢幕放大） */
export function fontPx(size: number): number {
  if (size >= textMin) return size;
  return Math.round(Math.min(textMin, size * MAX_BOOST));
}

/** 手機上按鈕、面板整體放大的倍率：52px 的按鈕在手機上約 44 CSS px */
export function uiZoom(): number {
  return Phaser.Math.Clamp(0.84 / screenScale(), 1, 1.5);
}

export interface TextOpts {
  size?: number;
  color?: string;
  stroke?: string;
  strokeW?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  lineSpacing?: number;
  /** 不套用手機放大（已經跟著面板一起放大的字） */
  raw?: boolean;
}

const CJK = /[　-鿿＀-￯]/;
const NO_LINE_START = '。，、．！？：；」』）】》〉〕…～,.!?:;)';

export function addText(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const size = o.raw ? (o.size ?? 20) : fontPx(o.size ?? 20);
  const st: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: o.color ?? '#e8f4ff',
    fontStyle: o.bold === false ? 'normal' : 'bold',
    align: o.align ?? 'left',
    resolution: RS,
    lineSpacing: o.lineSpacing ?? 4,
  };
  if (o.strokeW !== 0) {
    st.stroke = o.stroke ?? '#06101c';
    st.strokeThickness = o.strokeW ?? Math.max(2, Math.round(size / 7));
  }
  if (o.wrap) st.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  // 中文段落裡的空白換成不換行空白，整段逐字折行；再把落到行首的標點接回上一行
  const cjk = !!o.wrap && CJK.test(s) && getLang() === 'zh';
  if (cjk) s = s.replace(/ /g, ' ');
  const t = scene.add.text(x, y, s, st);
  if (cjk) {
    const lines = t.getWrappedText(s);
    let changed = false;
    for (let i = 1; i < lines.length; i++) {
      let guard = 0;
      while (lines[i] && NO_LINE_START.includes(lines[i][0]) && guard++ < 3) {
        lines[i - 1] += lines[i][0];
        lines[i] = lines[i].slice(1);
        changed = true;
      }
      if (!lines[i]) lines.splice(i--, 1);
    }
    if (changed) {
      t.setWordWrapWidth(o.wrap! + size, true);
      t.setText(lines.join('\n'));
    }
  }
  return t;
}

/** 單行文字太寬就等比縮小 */
export function fitText<T extends Phaser.GameObjects.Text>(t: T, maxW: number): T {
  t.setScale(1);
  if (t.width > maxW) t.setScale(maxW / t.width);
  return t;
}

/** 程序繪圖紋理的解析度倍率 */
export const TEX = 2;

/** 介面配色 */
export const COL = {
  bg: 0x070d18,
  panel: 0x0d1a2c,
  panelHi: 0x16304c,
  line: 0x3fd6ff,
  lineDim: 0x1e5a78,
  text: '#e8f4ff',
  dim: '#8fb0c8',
  cyan: '#5fe3ff',
  orange: '#ff9a3c',
  red: '#ff5a5a',
  green: '#6dff9a',
  yellow: '#ffd75a',
  player: 0x3fd6ff,
  enemy: 0xff5a5a,
};
