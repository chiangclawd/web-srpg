// 等角投影：格子 (x, y, 高度) ↔ 畫面座標
export const TW = 96;
export const TH = 48;
/** 每一層高度的像素 */
export const EH = 24;
/** 地塊側面往下畫多長（比最高的 3 層再多一點，底部漸淡，像懸空的模型台） */
export const DEPTH = 132;
/** 地塊紋理在菱形上方預留的空間（艙壁、貨櫃會凸出來） */
export const TOP_PAD = 60;

export const isoX = (x: number, y: number): number => ((x - y) * TW) / 2;
export const isoY = (x: number, y: number, h = 0): number => ((x + y) * TH) / 2 - h * EH;
/** 畫面前後順序：x + y 越大越靠前 */
export const tileDepth = (x: number, y: number): number => (x + y) * 10;
