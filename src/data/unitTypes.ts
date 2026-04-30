import type { UnitTypeDef, UnitTypeId } from '../types';

// 移動 cost per terrain — FE / Advance Wars 風格
// 缺項時 fallback 到 TerrainTypeDef.moveCost（plain 1 / forest 2 / mountain 3 / water 99）
export const UNIT_TYPES: Record<UnitTypeId, UnitTypeDef> = {
  sword: {
    id: 'sword',
    name: '劍士',
    shortName: '劍',
    color: 0xc8c8c8,
    attackRange: 1,
    moveRange: 3,
    baseStats: { hp: 28, attack: 8, defense: 4 },
    hitRate: 95,
    critRate: 8, // 揮劍俐落，爆擊偏高
    // 標準步兵成本（沿用 terrain default）
    terrainCosts: { plain: 1, forest: 2, mountain: 3, water: 99 },
  },
  lance: {
    id: 'lance',
    name: '槍兵',
    shortName: '槍',
    color: 0xa0d0a0,
    attackRange: 1,
    moveRange: 3,
    baseStats: { hp: 30, attack: 7, defense: 5 },
    hitRate: 95,
    critRate: 5, // 穩重但仍會偶有刺破甲
    // 標準步兵成本
    terrainCosts: { plain: 1, forest: 2, mountain: 3, water: 99 },
  },
  cavalry: {
    id: 'cavalry',
    name: '騎兵',
    shortName: '騎',
    color: 0xd8a060,
    attackRange: 1,
    moveRange: 5,
    baseStats: { hp: 26, attack: 9, defense: 3 },
    hitRate: 90,
    critRate: 10, // 衝鋒爆發力強
    // 開闊地特化：森林 + 山地額外昂貴（馬不擅崎嶇）
    terrainCosts: { plain: 1, forest: 3, mountain: 4, water: 99 },
  },
  archer: {
    id: 'archer',
    name: '弓兵',
    shortName: '弓',
    color: 0x90b0e0,
    attackRange: 2,
    moveRange: 3,
    baseStats: { hp: 22, attack: 8, defense: 2 },
    hitRate: 88, // 遠程：略低於近戰，但 88 才不會 miss 太頻繁
    critRate: 12, // 但會瞄準弱點
    // 森林專家（獵人出身）：forest 1 不減速；mountain 仍正常
    terrainCosts: { plain: 1, forest: 1, mountain: 3, water: 99 },
  },
  mage: {
    id: 'mage',
    name: '法師',
    shortName: '法',
    color: 0xc090d8,
    attackRange: 2,
    moveRange: 2,
    baseStats: { hp: 20, attack: 11, defense: 2 },
    hitRate: 90,
    critRate: 5,
    // 學院師承「飛行步」：山地不再完全擋路（cost 2 = 全動作預算進去 1 格）
    terrainCosts: { plain: 1, forest: 2, mountain: 2, water: 99 },
  },
  flier: {
    id: 'flier',
    name: '飛兵',
    shortName: '飛',
    color: 0xeeeeff,
    attackRange: 1,
    moveRange: 6,
    baseStats: { hp: 22, attack: 8, defense: 2 },
    hitRate: 85,
    critRate: 8,
    // 飛兵無視地形：所有地形（含水）都是 cost 1
    terrainCosts: { plain: 1, forest: 1, mountain: 1, water: 1 },
  },
};

/**
 * 取得指定兵種對特定地形的移動成本。
 * 用於 Grid.bfsReachable 的 costFn 注入。
 */
export function getMoveCost(unitTypeId: UnitTypeId, terrainId: 'plain' | 'forest' | 'mountain' | 'water'): number {
  const ut = UNIT_TYPES[unitTypeId];
  return ut.terrainCosts?.[terrainId] ?? 99;
}
