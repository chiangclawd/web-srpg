import type { TerrainTypeDef, TerrainTypeId } from '../types';

// 配色（fallback 色塊；實際視覺由 public/assets/tiles/<terrain>_<variant>.png
// 決定）。色調往「painterly anime」方向調整：
//   - 平原：暖調晨光草地（陽光感而非陰沉）
//   - 森林：藍綠調濃密針葉林（區別於平原的黃綠）
//   - 山地：暖石棕（陽光下的岩體，非泥灰）
//   - 河流：明亮青藍（活水而非死水）
// 缺 tile PNG 時這些色塊就是視覺；補完 tile PNG 後色塊只當 1ms 載入空檔的 fallback。
export const TERRAIN_TYPES: Record<TerrainTypeId, TerrainTypeDef> = {
  plain: {
    id: 'plain',
    name: '平原',
    shortName: '平',
    color: 0x6e8a5a,
    moveCost: 1,
    defBonus: 0,
    blocked: false,
  },
  forest: {
    id: 'forest',
    name: '森林',
    shortName: '林',
    color: 0x305a4a,
    moveCost: 2,
    defBonus: 3,
    blocked: false,
  },
  mountain: {
    id: 'mountain',
    name: '山地',
    shortName: '山',
    color: 0x7e6a52,
    moveCost: 3,
    defBonus: 5,
    blocked: false,
  },
  water: {
    id: 'water',
    name: '河流',
    shortName: '川',
    color: 0x4a78a8,
    moveCost: 99,
    defBonus: 0,
    blocked: true,
  },
};

const CHAR_MAP: Record<string, TerrainTypeId> = {
  '.': 'plain',
  F: 'forest',
  M: 'mountain',
  W: 'water',
};

/**
 * 把 scenario 的字串陣列展開成 [y][x] 的地形 ID 二維陣列。
 * 缺漏處或未知字元預設為 plain。
 */
export function parseTerrain(
  rows: string[] | undefined,
  width: number,
  height: number
): TerrainTypeId[][] {
  const grid: TerrainTypeId[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TerrainTypeId[] = [];
    const src = rows?.[y] ?? '';
    for (let x = 0; x < width; x++) {
      const ch = src[x] ?? '.';
      row.push(CHAR_MAP[ch] ?? 'plain');
    }
    grid.push(row);
  }
  return grid;
}
