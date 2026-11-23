// 3D 預先渲染的單位圖表（scripts/art/m3d/starfall/*.json → public/assets/starfall/units/）。
// 每張圖表有正面（面向畫面右下）與背面（面向右上）兩個方向，另外兩個方向用水平翻轉。
import type Phaser from 'phaser';
import type { Dir } from '../sim/types';

export type Anim = 'idle' | 'walk' | 'attack';

export interface SheetDef {
  /** 模型站直時在 256 格子裡的像素高度（render.mjs 印出來的 unitPx） */
  unitPx: number;
  cols: number;
  anims: Anim[];
  frames: Partial<Record<Anim, number>>;
  /** 畫面上的高度（邏輯像素，單位的 scale 再乘上去） */
  h: number;
  /** 懸浮高度 */
  hover?: number;
}

export const SHEET_CELL = 256;
export const SHEET_FOOT = 0.82;

const MECH = { cols: 8, anims: ['idle', 'walk', 'attack'] as Anim[], frames: { idle: 4, walk: 8, attack: 8 } };
const STATIC = { cols: 1, anims: ['idle'] as Anim[], frames: { idle: 1 } };

export const SHEETS: Record<string, SheetDef> = {
  hound: { ...MECH, unitPx: 150.6, h: 86 },
  anvil: { ...MECH, unitPx: 142.2, h: 92 },
  vesper: { ...MECH, unitPx: 134.7, h: 90 },
  sentry: { ...MECH, unitPx: 150.6, h: 84 },
  worker: { ...STATIC, unitPx: 91.4, h: 44 },
  echo: { ...STATIC, unitPx: 150.6, h: 52, hover: 20 },
  weaver: { ...STATIC, unitPx: 98.5, h: 54 },
  swift: { ...MECH, unitPx: 142.2, h: 80 },
  lancer: { ...MECH, unitPx: 150.6, h: 86 },
  bastion: { ...MECH, unitPx: 134.7, h: 88 },
  arbiter: { ...MECH, unitPx: 134.7, h: 86 },
  shepherd: { ...MECH, unitPx: 142.2, h: 82 },
  hunter: { ...STATIC, unitPx: 85.3, h: 44 },
  turret: { ...STATIC, unitPx: 128, h: 58 },
  choir: { ...STATIC, unitPx: 116.4, h: 62, hover: 24 },
  relay: { ...STATIC, unitPx: 170.7, h: 104 },
  pods: { ...STATIC, unitPx: 128, h: 80 },
  warden: { ...MECH, unitPx: 142.2, h: 88 },
  gatekeeper: { ...MECH, unitPx: 134.7, h: 90 },
  mender: { ...STATIC, unitPx: 128, h: 56, hover: 18 },
  needle: { ...STATIC, unitPx: 98.5, h: 58 },
  core: { ...STATIC, unitPx: 170.7, h: 132 },
  breacher: { ...MECH, unitPx: 142.2, h: 84 },
  tribunal: { ...MECH, unitPx: 134.7, h: 92 },
  thunderer: { ...STATIC, unitPx: 128, h: 62 },
  projector: { ...STATIC, unitPx: 94.8, h: 64 },
};

/** 面向 → 用正面還是背面的圖、要不要水平翻轉 */
export function facing(dir: Dir): { back: boolean; flip: boolean } {
  return { back: dir >= 2, flip: dir === 1 || dir === 2 };
}

export function frameName(def: SheetDef, anim: Anim, back: boolean, f: number): string {
  const ai = Math.max(0, def.anims.indexOf(anim));
  return String(((back ? 1 : 0) * def.anims.length + ai) * def.cols + f);
}

export const animKey = (sheet: string, anim: Anim, back: boolean): string => `sf_${sheet}_${anim}_${back ? 'b' : 'f'}`;

export function loadSheets(scene: Phaser.Scene): void {
  for (const k of Object.keys(SHEETS)) scene.load.atlas(`sf_${k}`, `assets/starfall/units/${k}.webp`, `assets/starfall/units/${k}.json`);
}

export function makeAnims(scene: Phaser.Scene): void {
  for (const [k, def] of Object.entries(SHEETS)) {
    for (const anim of def.anims) {
      const n = def.frames[anim] ?? 1;
      if (n < 2) continue;
      for (const back of [false, true]) {
        const key = animKey(k, anim, back);
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
          key,
          frames: Array.from({ length: n }, (_, f) => ({ key: `sf_${k}`, frame: frameName(def, anim, back, f) })),
          frameRate: anim === 'idle' ? 4 : anim === 'walk' ? 13 : 13,
          repeat: anim === 'attack' ? 0 : -1,
          yoyo: anim === 'idle',
        });
      }
    }
  }
}
