import type { EquipmentDef } from '../types';

/**
 * 裝備清單 — 各兵種專屬，依等級漸進開放。
 *
 * 規則：
 *   - unitTypes：哪些兵種可裝備（不能跨兵種通用）
 *   - requiredLevel：到該等級才在裝備選單出現（< 等級 = 灰色不能選）
 *   - hitBonus / critBonus：可選的命中／爆擊加成（百分點）
 *
 * 命名約定：
 *   <class>_<tier>   tier: 1=新手 / 2=精良 / 3=傳說
 *   也保留少數舊 id（iron_sword 等）作劇情向後相容用，但都已加上 unitTypes 限制
 */
export const EQUIPMENT: Record<string, EquipmentDef> = {
  // ============================================
  // 劍士（sword）
  // ============================================
  iron_sword: {
    id: 'iron_sword', name: '鐵劍', kind: 'weapon',
    atk: 2, def: 0, hpBonus: 0,
    unitTypes: ['sword'], requiredLevel: 1,
  },
  steel_sword: {
    id: 'steel_sword', name: '鋼劍', kind: 'weapon',
    atk: 4, def: 0, hpBonus: 0,
    unitTypes: ['sword'], requiredLevel: 5, critBonus: 5,
  },
  silver_sword: {
    id: 'silver_sword', name: '銀劍', kind: 'weapon',
    atk: 6, def: 0, hpBonus: 0,
    unitTypes: ['sword'], requiredLevel: 10, critBonus: 8,
  },
  rune_sword: {
    id: 'rune_sword', name: '符文劍', kind: 'weapon',
    atk: 8, def: 1, hpBonus: 0,
    unitTypes: ['sword'], requiredLevel: 14, critBonus: 12,
  },

  // 劍士／槍兵共用的重甲（步戰系）
  leather_armor: {
    id: 'leather_armor', name: '皮甲', kind: 'armor',
    atk: 0, def: 1, hpBonus: 2,
    unitTypes: ['sword', 'lance'], requiredLevel: 1,
  },
  chain_mail: {
    id: 'chain_mail', name: '鎖甲', kind: 'armor',
    atk: 0, def: 2, hpBonus: 4,
    unitTypes: ['sword', 'lance'], requiredLevel: 5,
  },
  knight_armor: {
    id: 'knight_armor', name: '騎士鎧', kind: 'armor',
    atk: 0, def: 3, hpBonus: 6,
    unitTypes: ['sword', 'lance'], requiredLevel: 10,
  },
  champion_plate: {
    id: 'champion_plate', name: '勇者鎧', kind: 'armor',
    atk: 0, def: 4, hpBonus: 10,
    unitTypes: ['sword', 'lance'], requiredLevel: 14,
  },

  // ============================================
  // 槍兵（lance）
  // ============================================
  iron_lance: {
    id: 'iron_lance', name: '鐵槍', kind: 'weapon',
    atk: 2, def: 0, hpBonus: 0,
    unitTypes: ['lance'], requiredLevel: 1,
  },
  knight_lance: {
    id: 'knight_lance', name: '騎士槍', kind: 'weapon',
    atk: 3, def: 1, hpBonus: 0,
    unitTypes: ['lance'], requiredLevel: 5,
  },
  holy_lance: {
    id: 'holy_lance', name: '聖光槍', kind: 'weapon',
    atk: 5, def: 2, hpBonus: 0,
    unitTypes: ['lance'], requiredLevel: 10, hitBonus: 5,
  },
  dragon_pike: {
    id: 'dragon_pike', name: '屠龍長戟', kind: 'weapon',
    atk: 7, def: 2, hpBonus: 0,
    unitTypes: ['lance'], requiredLevel: 14,
  },

  // ============================================
  // 騎兵（cavalry）
  // ============================================
  cavalry_blade: {
    id: 'cavalry_blade', name: '騎兵刀', kind: 'weapon',
    atk: 3, def: 0, hpBonus: 0,
    unitTypes: ['cavalry'], requiredLevel: 1,
  },
  charger_lance: {
    id: 'charger_lance', name: '衝陣騎槍', kind: 'weapon',
    atk: 5, def: 0, hpBonus: 0,
    unitTypes: ['cavalry'], requiredLevel: 5,
  },
  pegasus_blade: {
    id: 'pegasus_blade', name: '飛馬之刃', kind: 'weapon',
    atk: 7, def: 0, hpBonus: 0,
    unitTypes: ['cavalry'], requiredLevel: 10, critBonus: 5,
  },

  cavalry_leather: {
    id: 'cavalry_leather', name: '輕騎皮甲', kind: 'armor',
    atk: 0, def: 1, hpBonus: 1,
    unitTypes: ['cavalry'], requiredLevel: 1,
  },
  cavalry_mail: {
    id: 'cavalry_mail', name: '重騎鎧', kind: 'armor',
    atk: 0, def: 2, hpBonus: 3,
    unitTypes: ['cavalry'], requiredLevel: 5,
  },
  cavalry_plate: {
    id: 'cavalry_plate', name: '騎兵全鎧', kind: 'armor',
    atk: 0, def: 3, hpBonus: 5,
    unitTypes: ['cavalry'], requiredLevel: 10,
  },

  // ============================================
  // 弓兵（archer）
  // ============================================
  short_bow: {
    id: 'short_bow', name: '短弓', kind: 'weapon',
    atk: 1, def: 0, hpBonus: 0,
    unitTypes: ['archer'], requiredLevel: 1, hitBonus: 5,
  },
  long_bow: {
    id: 'long_bow', name: '長弓', kind: 'weapon',
    atk: 3, def: 0, hpBonus: 0,
    unitTypes: ['archer'], requiredLevel: 5, hitBonus: 5,
  },
  elven_bow: {
    id: 'elven_bow', name: '精靈弓', kind: 'weapon',
    atk: 5, def: 0, hpBonus: 0,
    unitTypes: ['archer'], requiredLevel: 10, hitBonus: 10, critBonus: 10,
  },
  dragon_bow: {
    id: 'dragon_bow', name: '惡龍弓', kind: 'weapon',
    atk: 7, def: 0, hpBonus: 0,
    unitTypes: ['archer'], requiredLevel: 14, hitBonus: 8, critBonus: 15,
  },

  cloth: {
    id: 'cloth', name: '布衣', kind: 'armor',
    atk: 0, def: 0, hpBonus: 2,
    unitTypes: ['archer', 'mage'], requiredLevel: 1,
  },
  ranger_cloak: {
    id: 'ranger_cloak', name: '遊俠斗篷', kind: 'armor',
    atk: 0, def: 1, hpBonus: 3,
    unitTypes: ['archer'], requiredLevel: 5,
  },
  hunter_garb: {
    id: 'hunter_garb', name: '獵人裝束', kind: 'armor',
    atk: 0, def: 2, hpBonus: 4,
    unitTypes: ['archer'], requiredLevel: 10, critBonus: 5,
  },

  // ============================================
  // 法師（mage）
  // ============================================
  spark_tome: {
    id: 'spark_tome', name: '電光之書', kind: 'weapon',
    atk: 2, def: 0, hpBonus: 0,
    unitTypes: ['mage'], requiredLevel: 1,
  },
  fire_tome: {
    id: 'fire_tome', name: '火焰之書', kind: 'weapon',
    atk: 3, def: 0, hpBonus: 0,
    unitTypes: ['mage'], requiredLevel: 5,
  },
  ice_tome: {
    id: 'ice_tome', name: '冰霜之書', kind: 'weapon',
    atk: 4, def: 0, hpBonus: 0,
    unitTypes: ['mage'], requiredLevel: 10, hitBonus: 5,
  },
  arcane_tome: {
    id: 'arcane_tome', name: '秘奧之書', kind: 'weapon',
    atk: 6, def: 0, hpBonus: 0,
    unitTypes: ['mage'], requiredLevel: 14, hitBonus: 10, critBonus: 5,
  },

  robe: {
    id: 'robe', name: '法袍', kind: 'armor',
    atk: 0, def: 0, hpBonus: 3,
    unitTypes: ['mage'], requiredLevel: 1,
  },
  arcane_robe: {
    id: 'arcane_robe', name: '秘術法袍', kind: 'armor',
    atk: 0, def: 1, hpBonus: 5,
    unitTypes: ['mage'], requiredLevel: 5,
  },
  magus_robe: {
    id: 'magus_robe', name: '大魔導師袍', kind: 'armor',
    atk: 0, def: 2, hpBonus: 8,
    unitTypes: ['mage'], requiredLevel: 10,
  },

  // ============================================
  // 飛兵（flier）
  // ============================================
  light_sword: {
    id: 'light_sword', name: '輕劍', kind: 'weapon',
    atk: 2, def: 0, hpBonus: 0,
    unitTypes: ['flier'], requiredLevel: 1,
  },
  wing_blade: {
    id: 'wing_blade', name: '羽翼之刃', kind: 'weapon',
    atk: 4, def: 0, hpBonus: 0,
    unitTypes: ['flier'], requiredLevel: 5, critBonus: 5,
  },
  sky_lance: {
    id: 'sky_lance', name: '蒼穹槍', kind: 'weapon',
    atk: 6, def: 0, hpBonus: 0,
    unitTypes: ['flier'], requiredLevel: 10, hitBonus: 5,
  },

  light_mail: {
    id: 'light_mail', name: '輕量鎖甲', kind: 'armor',
    atk: 0, def: 1, hpBonus: 2,
    unitTypes: ['flier'], requiredLevel: 1,
  },
  wyvern_scale: {
    id: 'wyvern_scale', name: '飛龍鱗甲', kind: 'armor',
    atk: 0, def: 2, hpBonus: 5,
    unitTypes: ['flier'], requiredLevel: 5,
  },
  storm_armor: {
    id: 'storm_armor', name: '風暴之翼', kind: 'armor',
    atk: 0, def: 3, hpBonus: 7,
    unitTypes: ['flier'], requiredLevel: 10,
  },
};

/**
 * 取得某兵種＋等級可用的所有裝備（依 kind 過濾）。
 * 用於 HubScene 的裝備選單只顯示「我能用的」。
 */
export function getEquippableFor(
  unitType: string,
  level: number,
  kind: 'weapon' | 'armor'
): EquipmentDef[] {
  return Object.values(EQUIPMENT).filter((e) => {
    if (e.kind !== kind) return false;
    if (e.unitTypes && !e.unitTypes.includes(unitType as never)) return false;
    if ((e.requiredLevel ?? 0) > level) return false;
    return true;
  });
}
