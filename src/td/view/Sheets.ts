/**
 * 3D 預渲染角色（Meshy 試作）：模型綁骨架、套動作後，用 three.js 從遊戲的斜俯視角
 * 渲染成逐格圖表（卡通描邊）。有圖表的單位改用逐格動畫，沒有的維持網格變形。
 *
 * 圖表排法：每個方向一組列，組內依 ANIMS 順序一個動作一列，欄是格數。
 * 側面朝右（朝左時鏡像）、正面（往下走）、背面（往上走）。
 */
export type SheetAnim = 'idle' | 'walk' | 'attack' | 'hit' | 'death';
export type SheetDir = 'side' | 'front' | 'back';

export const SHEET_ANIMS: SheetAnim[] = ['idle', 'walk', 'attack', 'hit', 'death'];
export const SHEET_DIRS: SheetDir[] = ['side', 'front', 'back'];

export interface UnitSheet {
  /** 檔名（assets/m3d/<file>.webp）與貼圖 key */
  file: string;
  /** 每格邊長（像素） */
  size: number;
  /** 一列幾格（= 最多格數的動作） */
  cols: number;
  /** 腳底在格子裡的高度比例（origin y） */
  footAt: number;
  /** 站立時身高佔幾像素（換算遊戲裡的身高） */
  unitPx: number;
  /** 每個動作的格數與秒數 */
  anims: Record<SheetAnim, { frames: number; dur: number }>;
  /** 走路一個循環（兩步）前進多少「身高」 */
  cycle: number;
}

// 手繪精靈的人物大約佔貼圖高度的 9 成：3D 角色用同樣比例，兩種畫風並排時一樣大
const FILL = 0.9;
const sheet = (file: string, unitPx: number, cycle: number, attack: number, death: number): UnitSheet => ({
  file,
  size: 144,
  cols: 10,
  footAt: 0.82,
  unitPx: unitPx / FILL,
  cycle: cycle * FILL,
  anims: {
    idle: { frames: 8, dur: 4.03 },
    walk: { frames: 10, dur: 1.07 },
    attack: { frames: 10, dur: attack },
    hit: { frames: 5, dur: 0.35 },
    death: { frames: 10, dur: death },
  },
});

/** scripts/art/m3d 渲染出來的圖表（key = 原本的精靈貼圖） */
export const UNIT_SHEETS: Record<string, UnitSheet> = {
  sp_enemy_sword: sheet('raider', 80, 0.607, 0.7, 1.1),
  sp_arthur: sheet('arthur', 80, 0.601, 0.75, 1.25),
};

export const sheetKey = (s: UnitSheet): string => `m3d_${s.file}`;

/** 某方向某動作第 i 格在圖表裡的索引 */
export function sheetFrame(s: UnitSheet, dir: SheetDir, anim: SheetAnim, i: number): number {
  const row = SHEET_DIRS.indexOf(dir) * SHEET_ANIMS.length + SHEET_ANIMS.indexOf(anim);
  return row * s.cols + Math.min(s.anims[anim].frames - 1, Math.max(0, i));
}

let use3d = false;
/** 玩家在暫停選單切換「3D 角色（試作）」 */
export function setUse3d(on: boolean): void {
  use3d = on;
}
export function sheetFor(tex: string, scene: Phaser.Scene): UnitSheet | null {
  if (!use3d) return null;
  const s = UNIT_SHEETS[tex];
  return s && scene.textures.exists(sheetKey(s)) ? s : null;
}
