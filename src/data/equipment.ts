import type { EquipmentDef } from '../types';

export const EQUIPMENT: Record<string, EquipmentDef> = {
  // === 武器 ===
  iron_sword: { id: 'iron_sword', name: '鐵劍', kind: 'weapon', atk: 2, def: 0, hpBonus: 0 },
  steel_sword: { id: 'steel_sword', name: '鋼劍', kind: 'weapon', atk: 4, def: 0, hpBonus: 0 },
  silver_sword: { id: 'silver_sword', name: '銀劍', kind: 'weapon', atk: 6, def: 0, hpBonus: 0 },

  iron_lance: { id: 'iron_lance', name: '鐵槍', kind: 'weapon', atk: 2, def: 0, hpBonus: 0 },
  knight_lance: { id: 'knight_lance', name: '騎士槍', kind: 'weapon', atk: 3, def: 1, hpBonus: 0 },

  short_bow: { id: 'short_bow', name: '短弓', kind: 'weapon', atk: 1, def: 0, hpBonus: 0 },
  long_bow: { id: 'long_bow', name: '長弓', kind: 'weapon', atk: 3, def: 0, hpBonus: 0 },

  fire_tome: { id: 'fire_tome', name: '火焰之書', kind: 'weapon', atk: 3, def: 0, hpBonus: 0 },
  ice_tome: { id: 'ice_tome', name: '冰霜之書', kind: 'weapon', atk: 4, def: 0, hpBonus: 0 },

  // === 防具 ===
  cloth: { id: 'cloth', name: '布衣', kind: 'armor', atk: 0, def: 0, hpBonus: 2 },
  leather_armor: { id: 'leather_armor', name: '皮甲', kind: 'armor', atk: 0, def: 1, hpBonus: 2 },
  chain_mail: { id: 'chain_mail', name: '鎖甲', kind: 'armor', atk: 0, def: 2, hpBonus: 4 },
  knight_armor: { id: 'knight_armor', name: '騎士鎧', kind: 'armor', atk: 0, def: 3, hpBonus: 6 },
  robe: { id: 'robe', name: '法袍', kind: 'armor', atk: 0, def: 0, hpBonus: 3 },
};
