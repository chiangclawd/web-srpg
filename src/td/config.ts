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
 * 渲染倍率：在高 DPI 螢幕把 canvas 開成 2 倍、相機 zoom 2，
 * 所有邏輯仍在 1280×720 座標系，但畫面銳利（文字、程序繪圖都清楚）。
 */
function autoRS(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  // 橫屏時的實體像素高度；超過 ~900 就值得開 2 倍
  const hPx = Math.min(window.innerHeight, window.innerWidth) * dpr;
  return hPx >= 900 ? 2 : 1;
}

export type Quality = 'auto' | 'high' | 'low';

/** 渲染倍率（live binding：遊戲建立前依畫質設定調整） */
export let RS: number = autoRS();

/** 畫質設定：低 = 1 倍渲染（省電、低階手機更順）；高 = 一律 2 倍 */
export function applyQuality(q: Quality): void {
  RS = q === 'low' ? 1 : q === 'high' ? 2 : autoRS();
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

/** 統一文字樣式：粗描邊卡通字 */
export function textStyle(o: TextOpts = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const size = o.size ?? 20;
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
  return scene.add.text(x, y, s, textStyle(o));
}

/** 程序繪圖紋理的解析度倍率（畫在 2 倍大小，顯示時縮 0.5） */
export const TEX = 2;
