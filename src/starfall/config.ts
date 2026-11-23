import Phaser from 'phaser';
import { getLang } from './i18n';
import { save } from './save';

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
/** 設定頁的「文字大小」：標準、大、特大 */
export const TEXT_SCALES = [1, 1.15, 1.3];

export function textScale(): number {
  const k = save().textScale;
  return TEXT_SCALES.includes(k) ? k : 1;
}

export function fontPx(size: number): number {
  const base = size >= textMin ? size : Math.round(Math.min(textMin, size * MAX_BOOST));
  // 大標題不跟著「文字大小」放大
  if (size > 32) return base;
  // 內文再乘上玩家選的倍率。上限跟手機的放大上限一樣：版面是照那個上限排的，再大就會擠出框
  return Math.round(Math.min(base * textScale(), Math.max(base, size * MAX_BOOST)));
}

/** 畫在戰場上的字（傷害數字、機體頭上的耐久）不在介面的容器裡，直接乘上文字大小的倍率 */
export const worldPx = (size: number): number => Math.round(size * textScale());

/** 手機上按鈕、面板整體放大的倍率：52px 的按鈕在手機上約 44 CSS px */
export function uiZoom(): number {
  // 「文字大小」選大的時候，按鈕和面板整組跟著放大（裡面的字一起變大）；最多 1.5 倍，跟手機一樣
  return Phaser.Math.Clamp(Math.max(1, 0.84 / screenScale()) * textScale(), 1, 1.5);
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
  // 下面幾個連同 enemy、red 會跟著「色盲配色」換（applyPalette）：
  /** 可以攻擊的格子、敵方的威脅範圍 */
  target: 0xff3a2a,
  threat: 0xff5a4a,
  /** 敵方的彈道 */
  enemyShot: 0xff6a5a,
  /** 我方被打中的傷害數字 */
  hurt: '#ff6a5a',
  /** 我方耐久偏低時的耐久條 */
  low: 0xffb03a,
};

/**
 * 敵我的顏色。預設是青對紅；色盲配色改成青對橘黃（紅綠色盲分得出藍和黃，紅色在深色背景上則會變得很暗）。
 * 我方耐久偏低原本用橘色，會跟橘黃的敵方混在一起，所以改成白色。
 */
const TEAM = {
  normal: { enemy: 0xff5a5a, red: '#ff5a5a', target: 0xff3a2a, threat: 0xff5a4a, enemyShot: 0xff6a5a, hurt: '#ff6a5a', low: 0xffb03a },
  safe: { enemy: 0xffb000, red: '#ffb000', target: 0xffb000, threat: 0xffb000, enemyShot: 0xffc24a, hurt: '#ffb000', low: 0xf2f2f2 },
};

export const colorBlind = (): boolean => !!save().colorBlind;

/** 照設定把敵我顏色換過來。已經畫好的東西要重畫才會變（設定頁關掉時會做） */
export function applyPalette(): void {
  Object.assign(COL, colorBlind() ? TEAM.safe : TEAM.normal);
}
applyPalette();
