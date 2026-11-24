// 3D 預先渲染的單位圖表（scripts/art/m3d/starfall/*.json → public/assets/starfall/units/）。
// 每張圖表四個方向都實際渲染（不用水平翻轉：機體左右不對稱，翻過來武器會換手）。
import type Phaser from 'phaser';
import type { Dir } from '../sim/types';

/** hit = 受擊後仰，down = 被擊破前癱倒（兩個都是渲染時用程序擺骨頭做的，見 render.html 的 PROC） */
export type Anim = 'idle' | 'walk' | 'attack' | 'hit' | 'down';

export interface SheetDef {
  /** 模型站直時在 256 格子裡的像素高度（render.mjs 印出來的 unitPx） */
  unitPx: number;
  cols: number;
  anims: Anim[];
  frames: Partial<Record<Anim, number>>;
  /** 待機是一圈循環的搖晃（沒有骨架的無人機），不是來回播放 */
  sway?: boolean;
  /** 畫面上的高度（邏輯像素，單位的 scale 再乘上去） */
  h: number;
  /** 懸浮高度 */
  hover?: number;
}

export const SHEET_CELL = 256;
export const SHEET_FOOT = 0.82;

const MECH = { cols: 8, anims: ['idle', 'walk', 'attack', 'hit', 'down'] as Anim[], frames: { idle: 4, walk: 8, attack: 8, hit: 4, down: 6 } };
const STATIC = { cols: 1, anims: ['idle'] as Anim[], frames: { idle: 1 } };
const DRONE = { cols: 6, anims: ['idle'] as Anim[], frames: { idle: 6 }, sway: true };

export const SHEETS: Record<string, SheetDef> = {
  hound: { ...MECH, unitPx: 150.6, h: 86 },
  anvil: { ...MECH, unitPx: 142.2, h: 92 },
  vesper: { ...MECH, unitPx: 134.7, h: 90 },
  sentry: { ...MECH, unitPx: 150.6, h: 84 },
  worker: { ...DRONE, unitPx: 91.4, h: 44 },
  echo: { ...DRONE, unitPx: 150.6, h: 52, hover: 20 },
  weaver: { ...DRONE, unitPx: 98.5, h: 54 },
  swift: { ...MECH, unitPx: 142.2, h: 80 },
  lancer: { ...MECH, unitPx: 150.6, h: 86 },
  bastion: { ...MECH, unitPx: 134.7, h: 88 },
  arbiter: { ...MECH, unitPx: 134.7, h: 86 },
  shepherd: { ...MECH, unitPx: 142.2, h: 82 },
  hunter: { ...DRONE, unitPx: 85.3, h: 44 },
  turret: { ...STATIC, unitPx: 128, h: 58 },
  choir: { ...DRONE, unitPx: 116.4, h: 62, hover: 24 },
  relay: { ...STATIC, unitPx: 170.7, h: 104 },
  pods: { ...STATIC, unitPx: 128, h: 80 },
  warden: { ...MECH, unitPx: 142.2, h: 88 },
  gatekeeper: { ...MECH, unitPx: 134.7, h: 90 },
  mender: { ...DRONE, unitPx: 128, h: 56, hover: 18 },
  needle: { ...DRONE, unitPx: 98.5, h: 58 },
  core: { ...STATIC, unitPx: 170.7, h: 132 },
  breacher: { ...MECH, unitPx: 142.2, h: 84 },
  tribunal: { ...MECH, unitPx: 134.7, h: 92 },
  thunderer: { ...STATIC, unitPx: 128, h: 62 },
  projector: { ...STATIC, unitPx: 94.8, h: 64 },
};

/** 面向在畫面上的樣子：back = 背對鏡頭（朝畫面上方），flip = 朝畫面左邊。算槍口位置、箭頭用；取圖用 dirIndex */
export function facing(dir: Dir): { back: boolean; flip: boolean } {
  return { back: dir >= 2, flip: dir === 1 || dir === 2 };
}

/**
 * 面向 → 圖表裡的第幾組方向。圖表的順序是渲染設定的 dirs：正面右（yaw 45）、背面右（135）、正面左（315）、背面左（225）；
 * 面向 0 = 朝畫面右下、1 = 左下、2 = 左上、3 = 右上。
 */
export const dirIndex = (dir: Dir): number => [0, 2, 3, 1][dir];
const DIRS = 4;

/** di：第幾組方向（dirIndex 的結果）；傳 false / true 是「正面右 / 背面右」 */
export function frameName(def: SheetDef, anim: Anim, di: number | boolean, f: number): string {
  const ai = Math.max(0, def.anims.indexOf(anim));
  return String((Number(di) * def.anims.length + ai) * def.cols + f);
}

export const animKey = (sheet: string, anim: Anim, di: number | boolean): string => `sf_${sheet}_${anim}_${Number(di)}`;

/** 我方六台機體的圖表：機庫、資訊卡隨時會用到，開機就載入。其他（敵人、設施、擺設）進戰場時才載入那一關用到的 */
export const PLAYER_SHEETS = ['hound', 'anvil', 'vesper', 'echo', 'swift', 'arbiter'];

/** 把這些圖表排進載入佇列（已經載入過的跳過）。回傳這次真的要載入幾張 */
export function loadSheets(scene: Phaser.Scene, keys: Iterable<string>): number {
  let n = 0;
  for (const k of new Set(keys)) {
    if (!SHEETS[k] || scene.textures.exists(`sf_${k}`)) continue;
    scene.load.atlas(`sf_${k}`, `assets/starfall/units/${k}.webp`, `assets/starfall/units/${k}.json`);
    n++;
  }
  return n;
}

export function makeAnims(scene: Phaser.Scene): void {
  for (const [k, def] of Object.entries(SHEETS)) {
    // 還沒載入的圖表先不建動畫（進到用得到它的關卡、載入之後再呼叫一次）
    if (!scene.textures.exists(`sf_${k}`)) continue;
    for (const anim of def.anims) {
      const n = def.frames[anim] ?? 1;
      if (n < 2) continue;
      for (let di = 0; di < DIRS; di++) {
        const key = animKey(k, anim, di);
        if (scene.anims.exists(key)) continue;
        const loop = anim === 'idle' || anim === 'walk';
        scene.anims.create({
          key,
          frames: Array.from({ length: n }, (_, f) => ({ key: `sf_${k}`, frame: frameName(def, anim, di, f) })),
          frameRate: anim === 'idle' ? (def.sway ? 6 : 4) : anim === 'down' ? 11 : 13,
          repeat: loop ? -1 : 0,
          yoyo: anim === 'idle' && !def.sway,
        });
      }
    }
  }
}
