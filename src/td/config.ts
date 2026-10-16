import Phaser from 'phaser';

/** 邏輯高度固定 720；寬度依裝置比例 1280~1560（玩法區永遠是中央 1280） */
export const VIEW_H = 720;
export const MIN_W = 1280;
export const MAX_W = 1560;
/** 關卡背景寬度（比玩法區寬，寬螢幕兩側看得到延伸景物） */
export const WORLD_W = 1560;
export const PLAY_W = 1280;
export const PLAY_X0 = (WORLD_W - PLAY_W) / 2;

/**
 * 渲染倍率：在高 DPI 螢幕把 canvas 開大、相機 zoom 同倍率，
 * 所有邏輯仍在 1280×720 座標系，但畫面銳利（文字、程序繪圖都清楚）。
 * 倍率以 0.25 為一級，不超過螢幕實體像素（再大只是浪費記憶體）。
 */
function autoRS(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  // 橫屏時的實體像素高度
  const hPx = Math.min(window.innerHeight, window.innerWidth) * dpr;
  const fit = Math.floor((hPx / VIEW_H) * 4) / 4;
  // 手機 / 平板記憶體吃緊（iOS Safari 超量會直接把分頁砍掉），最多 1.5 倍
  return Phaser.Math.Clamp(fit, 1, isTouchDevice() ? 1.5 : 2);
}

/** 觸控為主的裝置（手機、平板） */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
}

export type Quality = 'auto' | 'high' | 'low';

/** 渲染倍率（live binding：遊戲建立前依畫質設定調整） */
export let RS: number = autoRS();

/** 畫質設定：低 = 1 倍渲染（省電、低階手機更順）；高 = 一律 2 倍 */
export function applyQuality(q: Quality): void {
  RS = q === 'low' ? 1 : q === 'high' ? 2 : autoRS();
}

/** 程序繪圖背景的解析度：跟著渲染倍率，但有上限（大圖最吃記憶體） */
export function bgScale(max: number): number {
  return Math.min(RS, max);
}

/**
 * 移除畫布紋理並立刻釋放畫布記憶體。
 * iOS Safari 的畫布記憶體要等 GC 才回收、而且有總量上限，大背景一定要手動清掉。
 */
export function freeCanvasTexture(scene: Phaser.Scene, key: string): void {
  if (!scene.textures.exists(key)) return;
  const src = scene.textures.get(key).getSourceImage();
  scene.textures.remove(key);
  if (src instanceof HTMLCanvasElement) {
    src.width = 0;
    src.height = 0;
  }
}

export function computeViewW(): number {
  if (typeof window === 'undefined') return MAX_W;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = Math.max(w, h) / Math.min(w, h);
  return Math.round(Phaser.Math.Clamp(VIEW_H * aspect, MIN_W, MAX_W));
}

/** 目前的邏輯寬度（scene 內用 this.scale.width / RS 也可以） */
export function viewW(scene: Phaser.Scene): number {
  return Math.round(scene.scale.width / RS);
}

/** 每個 scene 建立時呼叫：相機 zoom = RS、以左上為原點 */
export function setupCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(RS);
  return cam;
}

export const FONT_DISPLAY = '"Luckiest Guy", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Heiti TC", sans-serif';
export const FONT_BODY = '"Trebuchet MS", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Heiti TC", sans-serif';

export interface TextOpts {
  size?: number;
  color?: string;
  stroke?: string;
  strokeW?: number;
  display?: boolean;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  shadow?: boolean;
  lineSpacing?: number;
}

/**
 * 手機字體放大：整個 1280×720 畫面在手機上會縮到約一半，14px 的字實際只剩 7px。
 * 依畫面縮放比例把小字放大，讓實際顯示至少約 11 CSS px（最多放大 1.35 倍，避免撐爆版面）。
 * 桌機縮放比例 ≥ 1，不受影響。以橫向尺寸計算（直向開啟時也一樣）。
 */
const MIN_CSS_PX = 11;
const MAX_BOOST = 1.35;

function screenScale(): number {
  if (typeof window === 'undefined') return 1;
  const w = Math.max(window.innerWidth, window.innerHeight);
  const h = Math.min(window.innerWidth, window.innerHeight);
  return Math.min(w / computeViewW(), h / VIEW_H);
}

let textMin = MIN_CSS_PX / screenScale();

/** 邏輯字級 → 實際使用的字級（小螢幕放大） */
export function fontPx(size: number): number {
  if (size >= textMin) return size;
  return Math.round(Math.min(textMin, size * MAX_BOOST));
}

/**
 * 手機上彈出面板整體放大的倍率（字與版面一起放大，不會擠爆版面）。
 * 讓面板裡的 1 邏輯像素至少約 0.7 CSS px；桌機、平板為 1。
 */
export function uiZoom(): number {
  return Phaser.Math.Clamp(0.7 / screenScale(), 1, 1.35);
}

/** 視窗大小改變時重新計算（之後建立的文字才會套用） */
export function refreshTextScale(): void {
  textMin = MIN_CSS_PX / screenScale();
}

/** 統一文字樣式：粗描邊卡通字 */
export function textStyle(o: TextOpts = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const size = fontPx(o.size ?? 20);
  const st: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: o.display ? FONT_DISPLAY : FONT_BODY,
    fontSize: `${size}px`,
    color: o.color ?? '#fff6dc',
    stroke: o.stroke ?? '#2a1708',
    strokeThickness: o.strokeW ?? Math.max(2, Math.round(size / 6)),
    fontStyle: o.bold === false ? 'normal' : 'bold',
    align: o.align ?? 'left',
    resolution: RS,
    lineSpacing: o.lineSpacing ?? 2,
  };
  if (o.wrap) st.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  if (o.shadow !== false) {
    st.shadow = { offsetX: 0, offsetY: Math.max(1, size / 12), color: '#00000088', blur: 0, fill: true, stroke: true };
  }
  return st;
}

export function addText(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, s, textStyle(o));
  if (o.wrap && CJK.test(s)) {
    const r = cjkWrap(t, s);
    if (r.changed) {
      t.setWordWrapWidth(o.wrap + fontPx(o.size ?? 20), true);
      t.setText(r.text);
    }
  }
  return t;
}

/** 單行文字太寬就等比縮小（手機放大字體、英文版較長時） */
export function fitText<T extends Phaser.GameObjects.Text>(t: T, maxW: number): T {
  t.setScale(1);
  if (t.width > maxW) t.setScale(maxW / t.width);
  return t;
}

const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
/** 不能出現在行首的標點（中文排版的避頭點） */
const NO_LINE_START = '。，、．！？：；」』）】》〉〕…～,.!?:;)';

/**
 * 依文字物件目前的換行寬度把字串排成多行，並處理中文避頭點：
 * 句號、逗號等標點不該落到行首，把上一行最後一個字一起帶下來。
 * 回傳含手動換行的字串；改過的話，呼叫端要把換行寬度放寬一個字，避免又被重新折行。
 */
export function cjkWrap(t: Phaser.GameObjects.Text, s: string): { text: string; changed: boolean } {
  let changed = false;
  const out: string[] = [];
  for (const para of s.split('\n')) {
    const lines = t.getWrappedText(para);
    for (let i = 1; i < lines.length; i++) {
      let guard = 0;
      while (lines[i] && NO_LINE_START.includes(lines[i][0]) && lines[i - 1].length > 2 && guard++ < 3) {
        lines[i] = lines[i - 1].slice(-1) + lines[i];
        lines[i - 1] = lines[i - 1].slice(0, -1);
        changed = true;
      }
    }
    out.push(...(lines.length ? lines : ['']));
  }
  return { text: out.join('\n'), changed };
}

/** 程序繪圖紋理的解析度倍率（畫在 2 倍大小，顯示時縮 0.5） */
export const TEX = 2;
