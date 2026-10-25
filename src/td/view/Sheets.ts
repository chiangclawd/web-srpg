/**
 * 3D 預渲染角色（Meshy 試作）：模型綁骨架、套動作後，用 three.js 從遊戲的斜俯視角
 * 渲染成逐格圖表（卡通描邊）。有圖表的單位改用逐格動畫，沒有的維持網格變形。
 *
 * 圖表排法：每個方向一組列，組內依 ANIMS 順序一個動作一列，欄是格數。
 * 側面朝右（朝左時鏡像）、正面（往下走）、背面（往上走）。
 */
import { SHEET_REV } from './sheetRev';

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

/**
 * fill：手繪精靈的人物佔貼圖高度的比例（大多 9 成；骷髏、哥布林畫滿整張）。
 * 3D 角色用同樣比例，兩種畫風並排時一樣大。
 * size：每格邊長。一般 144（角色約 80 px 高）；英雄用 288，手機放大看時跟手繪一樣清楚。
 * span：渲染時鏡頭框住幾個身高（預設 1.8）。
 */
const sheet = (file: string, cycle: number, o: { attack?: number; death?: number; fill?: number; size?: number; span?: number } = {}): UnitSheet => {
  const fill = o.fill ?? 0.9;
  const size = o.size ?? 144;
  // 渲染時鏡頭框住幾個身高（翅膀很寬、倒地很長的角色放大一點，跟渲染設定的 span 一致）
  const span = o.span ?? 1.8;
  return {
    file,
    size,
    cols: 10,
    footAt: 0.82,
    unitPx: size / span / fill,
    cycle: cycle * fill,
    anims: {
      idle: { frames: 8, dur: 4.03 },
      walk: { frames: 10, dur: 1.07 },
      attack: { frames: 10, dur: o.attack ?? 0.7 },
      hit: { frames: 5, dur: 0.35 },
      death: { frames: 10, dur: o.death ?? 1.1 },
    },
  };
};

/** 英雄的格子大小（2 倍解析度） */
const HERO = 288;

/** scripts/art/m3d 渲染出來的圖表（key = 原本的精靈貼圖；cycle 由 render.mjs 量腳步算出） */
export const UNIT_SHEETS: Record<string, UnitSheet> = {
  sp_enemy_sword: sheet('raider', 0.607),
  sp_arthur: sheet('arthur', 0.601, { attack: 0.75, death: 1.25, size: HERO }),
  // 長槍兵、黑衛士、鏡影騎士共用
  sp_enemy_lance: sheet('lancer', 0.763, { attack: 0.75 }),
  sp_eo: sheet('cultist', 0.625),
  mon_skeleton: sheet('skeleton', 0.587, { fill: 1 }),
  // 刺客與英雄影刃共用
  sp_shadow: sheet('shadow', 0.602, { attack: 0.55, size: HERO }),
  sp_player_sword: sheet('soldier', 0.612),
  sp_player_lancer: sheet('pike', 0.783, { attack: 0.75 }),
  mon_goblin: sheet('goblin', 0.593, { fill: 1 }),
  // 四足：Meshy 只綁人形骨架，狼用 scripts/art/m3d/quadrig.py 自己綁骨架、程式做動作
  mon_wolf: sheet('wolf', 0.804, { fill: 1 }),
  // 騎兵：馬用四足骨架，騎士整塊綁在 Rider 骨頭（scripts/art/m3d/cavalry.rig.json 框出騎士和劍）
  sp_enemy_cavalry: sheet('cavalry', 0.716, { fill: 1 }),
  // 獅鷲騎手：四足骨架加左右翅膀（griffin.rig 見 scripts/art/m3d/flier.rig.json）。
  // 飛行時腳不動、量不到步幅：cycle 手動設成每秒拍翅約 1.6 下
  sp_enemy_flier: sheet('griffin', 0.42, { attack: 0.8, fill: 1 }),
  // Meshy 人形流程（兩足怪物也能綁）
  sp_zerin: sheet('necro', 0.842, { attack: 0.9, fill: 1 }),
  mon_troll: sheet('troll', 0.693, { attack: 0.8, death: 1.25, fill: 1 }),
  mon_werewolf: sheet('werewolf', 0.723, { fill: 1 }),
  // 惡魔：人形骨架加會拍的翅膀（scripts/art/m3d/wingrig.py）；飛行時腳不動，cycle 手動設成每秒拍翅約 1.6 下
  mon_demon: sheet('demon', 0.475, { attack: 0.8, fill: 1, span: 1.9 }),
  // 蝙蝠：沒有腳，wingrig.py 綁身體 + 頭 + 翅膀；翅膀很寬，鏡頭框 2.6 個身高。每秒拍翅約 4 下
  mon_bat: sheet('bat', 0.89, { fill: 1, span: 2.6 }),
  sp_enemy_archer: sheet('hunter', 0.688, { attack: 0.8 }),
  sp_enemy_mage: sheet('adept', 0.555, { attack: 0.9 }),
  // 英雄
  // 雷恩：敵方騎兵的模型換色（scripts/art/m3d/rain.json 的 recolor：騎士紅甲 → 銀甲、黑馬 → 栗色馬，保留紅色馬鎧）
  sp_rain: sheet('rain', 0.716, { fill: 1, size: HERO }),
  // 艾莉亞：敵方獅鷲騎手的模型換色（aria.json：灰甲 → 白甲、面罩 → 臉、金髮、金色獅鷲），劍剪掉換成綁綠緞帶的長矛
  sp_aria: sheet('aria', 0.42, { attack: 0.8, fill: 1, size: HERO }),
  sp_elena: sheet('elena', 0.817, { attack: 0.8, fill: 1, size: HERO }),
  sp_lila: sheet('lila', 0.846, { attack: 0.9, fill: 1, size: HERO }),
  sp_sharon: sheet('sharon', 0.577, { attack: 0.9, size: HERO }),
  // 維克多與他的近衛兵營共用
  sp_viktor: sheet('viktor', 0.962, { attack: 0.75, fill: 1, size: HERO }),
};

export const sheetKey = (s: UnitSheet): string => `m3d_${s.file}`;

/** 每張圖表原本（一般解析度）的檔名、格子大小、身高像素 */
const BASE = new Map<UnitSheet, { file: string; size: number; unitPx: number }>();

/**
 * 一般角色（144 格）另外渲染了 2 倍解析度版 <file>_hd（288 格，scripts/art/m3d 同一組模型與設定）。
 * 開遊戲時依畫質決定用哪一版（main.ts）；有沒有 _hd 版看 sheetRev.ts 有沒有那個檔。
 */
export function setHdSheets(on: boolean): void {
  for (const s of Object.values(UNIT_SHEETS)) {
    if (!BASE.has(s)) BASE.set(s, { file: s.file, size: s.size, unitPx: s.unitPx });
    const b = BASE.get(s)!;
    const hd = on && b.size < HERO && SHEET_REV[`${b.file}_hd`] !== undefined;
    s.file = hd ? `${b.file}_hd` : b.file;
    s.size = hd ? b.size * 2 : b.size;
    s.unitPx = hd ? b.unitPx * 2 : b.unitPx;
  }
}

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

/**
 * 介面裡展示用的 3D 角色（圖鑑、新敵人卡）：面向右，走兩步、出手一次，一直輪播。
 * 站立身高約 height；翅膀寬、倒地長的圖表整格不超過 maxBox。精靈銷毀時計時器跟著停。
 */
export function showcaseSprite(scene: Phaser.Scene, sh: UnitSheet, x: number, y: number, height: number, maxBox: number, tint?: number): Phaser.GameObjects.Sprite {
  const spr = scene.add.sprite(x, y, sheetKey(sh), sheetFrame(sh, 'side', 'walk', 0)).setOrigin(0.5, sh.footAt);
  spr.setScale(Math.min(height / sh.unitPx, maxBox / sh.size));
  if (tint) spr.setTint(tint);
  const seq: SheetAnim[] = ['walk', 'walk', 'attack'];
  let step = 0;
  let frame = 0;
  let timer: Phaser.Time.TimerEvent | null = null;
  const tick = () => {
    const anim = seq[step];
    const a = sh.anims[anim];
    spr.setFrame(sheetFrame(sh, 'side', anim, frame));
    frame++;
    if (frame >= a.frames) {
      frame = 0;
      step = (step + 1) % seq.length;
    }
    timer = scene.time.delayedCall((a.dur / a.frames) * 1000, tick);
  };
  spr.once('destroy', () => timer?.remove());
  tick();
  return spr;
}
