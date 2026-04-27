import type { UnitTypeDef, UnitTypeId } from '../types';

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
    critRate: 3, // 沉穩刺擊，爆擊偏低
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
  },
  archer: {
    id: 'archer',
    name: '弓兵',
    shortName: '弓',
    color: 0x90b0e0,
    attackRange: 2,
    moveRange: 3,
    baseStats: { hp: 22, attack: 8, defense: 2 },
    hitRate: 85, // 遠程命中略低
    critRate: 12, // 但會瞄準弱點
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
  },
};
