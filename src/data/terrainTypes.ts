import type { TerrainTypeDef, TerrainTypeId } from '../types';

export const TERRAIN_TYPES: Record<TerrainTypeId, TerrainTypeDef> = {
  plain: {
    id: 'plain',
    name: '平原',
    shortName: '平',
    color: 0x4a5a4a,
    moveCost: 1,
    defBonus: 0,
    blocked: false,
  },
  forest: {
    id: 'forest',
    name: '森林',
    shortName: '林',
    color: 0x2a5a3a,
    moveCost: 2,
    defBonus: 1,
    blocked: false,
  },
  mountain: {
    id: 'mountain',
    name: '山地',
    shortName: '山',
    color: 0x6a5a4a,
    moveCost: 3,
    defBonus: 2,
    blocked: false,
  },
  water: {
    id: 'water',
    name: '河流',
    shortName: '川',
    color: 0x3a5a8a,
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
