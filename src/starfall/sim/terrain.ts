import type { TerrainDef, TerrainId } from './types';

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  deck: { id: 'deck', name: { zh: '甲板', en: 'Deck' }, cost: 1, cover: 0, blocksFire: false },
  grate: { id: 'grate', name: { zh: '導管格柵', en: 'Conduit Grate' }, cost: 1, cover: 0, blocksFire: false },
  ice: { id: 'ice', name: { zh: '冰面', en: 'Ice' }, cost: 1, cover: 0, blocksFire: false },
  snow: { id: 'snow', name: { zh: '積雪', en: 'Snowdrift' }, cost: 2, cover: 0, blocksFire: false },
  rubble: { id: 'rubble', name: { zh: '殘骸堆', en: 'Wreckage' }, cost: 2, cover: 1, blocksFire: false },
  barricade: { id: 'barricade', name: { zh: '貨櫃掩體', en: 'Cargo Cover' }, cost: 1, cover: 2, blocksFire: false },
  wall: { id: 'wall', name: { zh: '艙壁', en: 'Bulkhead' }, cost: 0, cover: 0, blocksFire: true },
  chasm: { id: 'chasm', name: { zh: '裂谷', en: 'Chasm' }, cost: 0, cover: 0, blocksFire: false },
};

/** 關卡地圖字元 → 地形 */
export const TERRAIN_CHARS: Record<string, TerrainId> = {
  '.': 'deck',
  g: 'grate',
  ',': 'ice',
  s: 'snow',
  r: 'rubble',
  b: 'barricade',
  '#': 'wall',
  '~': 'chasm',
};

export const COVER_REDUCTION = [0, 0.25, 0.4] as const;
