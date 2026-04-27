import type { CommanderDef } from '../types';

/**
 * 玩家武將的「招募章節」— 從第 N 章開始可在 Hub 中見到並出陣。
 * 未列入此表者預設從第 1 章可用。
 */
export const RECRUIT_AT_CHAPTER: Record<string, number> = {
  arthur: 1,
  rosa: 1,
  gary: 1,
  sharon: 5, // ch4 救出後，ch5 起可用
  rain: 8,   // ch7 救出後，ch8 起可用
};

export const COMMANDERS: Record<string, CommanderDef> = {
  // ===== 玩家陣營（核心 3 人） =====
  arthur: {
    id: 'arthur', name: '亞瑟', faction: 'player', unitType: 'sword',
    statBonus: { hp: 6, attack: 1, defense: 1 },
    skill: { id: 'kings_will', name: '王者意志', desc: 'HP < 50% 時，受到傷害 ×0.7' },
    startingLevel: 5, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },
  rosa: {
    id: 'rosa', name: '蘿莎', faction: 'player', unitType: 'archer',
    statBonus: { hp: 2, attack: 2, defense: 0 },
    skill: { id: 'sharp_shooter', name: '神射', desc: '攻擊時傷害 ×1.25' },
    startingLevel: 5, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'short_bow', armor: 'cloth' },
  },
  gary: {
    id: 'gary', name: '蓋瑞', faction: 'player', unitType: 'lance',
    statBonus: { hp: 4, attack: 1, defense: 2 },
    skill: { id: 'unmoving', name: '不動如山', desc: '受到傷害 ×0.9' },
    startingLevel: 5, growthRates: { hp: 4, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'iron_lance', armor: 'chain_mail' },
  },

  // ===== 玩家陣營（中後期招募） =====
  sharon: {
    id: 'sharon', name: '夏倫', faction: 'player', unitType: 'mage',
    statBonus: { hp: 0, attack: 3, defense: 0 },
    skill: { id: 'fameel_arcana', name: '法米爾秘術', desc: '攻擊時傷害 ×1.3' },
    startingLevel: 7, growthRates: { hp: 2, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'fire_tome', armor: 'robe' },
  },
  rain: {
    id: 'rain', name: '雷恩', faction: 'player', unitType: 'cavalry',
    statBonus: { hp: 4, attack: 2, defense: 1 },
    skill: { id: 'knight_charge', name: '騎士榮耀', desc: '移動 ≥ 3 格時，攻擊 ×1.3' },
    startingLevel: 9, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'silver_sword', armor: 'knight_armor' },
  },

  // ===== 第 1 章敵方 =====
  morden: {
    id: 'morden', name: '莫頓', faction: 'enemy', unitType: 'cavalry',
    statBonus: { hp: 2, attack: 1, defense: 0 },
    skill: { id: 'cavalry_charge', name: '突擊', desc: '移動 ≥ 3 格時，攻擊 ×1.2' },
    startingLevel: 5, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },
  selene: {
    id: 'selene', name: '賽琳', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: -2, attack: 2, defense: 0 },
    skill: { id: 'ice_cone', name: '冰錐', desc: '攻擊 ×1.15' },
    startingLevel: 4, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'fire_tome', armor: 'robe' },
  },
  greg: {
    id: 'greg', name: '葛雷', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 0, attack: 0, defense: 0 },
    skill: { id: '', name: '亂砍', desc: '無特殊效果' },
    startingLevel: 3, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },
  // 新增：第 1 章弓兵（讓玩家學會處理遠程威脅）
  scout_archer: {
    id: 'scout_archer', name: '斥候弓手', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 0, attack: 0, defense: 0 },
    skill: { id: '', name: '冷靜瞄準', desc: '無特殊效果' },
    startingLevel: 3, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'short_bow', armor: 'cloth' },
  },

  // ===== 第 2 章敵方 =====
  vlad: {
    id: 'vlad', name: '弗拉德', faction: 'enemy', unitType: 'lance',
    statBonus: { hp: 2, attack: 1, defense: 1 },
    skill: { id: 'spear_formation', name: '槍陣', desc: '對騎兵傷害 ×1.3' },
    startingLevel: 6, growthRates: { hp: 4, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'knight_lance', armor: 'chain_mail' },
  },
  caleb: {
    id: 'caleb', name: '凱布', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 0, attack: 1, defense: 0 },
    skill: { id: 'cold_arrow', name: '冷箭', desc: '攻擊 ×1.2' },
    startingLevel: 6, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'long_bow', armor: 'cloth' },
  },

  // ===== 第 3 章 BOSS =====
  baron: {
    id: 'baron', name: '伯朗將軍', faction: 'enemy', unitType: 'cavalry',
    statBonus: { hp: 12, attack: 3, defense: 2 },
    skill: { id: 'king_terminator', name: '王國終結者', desc: '對玩家攻擊 ×1.2' },
    startingLevel: 9, growthRates: { hp: 5, attack: 2, defense: 2 },
    startingEquipment: { weapon: 'silver_sword', armor: 'knight_armor' },
  },

  // ===== 第 4 章敵方 =====
  hirsch: {
    id: 'hirsch', name: '赫許', faction: 'enemy', unitType: 'lance',
    statBonus: { hp: 4, attack: 1, defense: 1 },
    skill: { id: '', name: '河岸戍守', desc: '無實際效果' },
    startingLevel: 8, growthRates: { hp: 3, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'iron_lance', armor: 'chain_mail' },
  },
  mara: {
    id: 'mara', name: '瑪拉', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 2, attack: 1, defense: 0 },
    skill: { id: '', name: '快射', desc: '無實際效果' },
    startingLevel: 8, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'short_bow', armor: 'leather_armor' },
  },
  // ch4 黑暗教派初次正式登場：刺客
  cult_assassin: {
    id: 'cult_assassin', name: '教派刺客', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 4, attack: 3, defense: 0 },
    skill: { id: 'silent_blade', name: '暗殺一刀', desc: '攻擊 ×1.4' },
    startingLevel: 9, growthRates: { hp: 3, attack: 3, defense: 1 },
    startingEquipment: { weapon: 'steel_sword', armor: 'cloth' },
  },

  // ===== 第 5 章 BOSS =====
  carl: {
    id: 'carl', name: '卡爾將軍', faction: 'enemy', unitType: 'cavalry',
    statBonus: { hp: 14, attack: 3, defense: 3 },
    skill: { id: 'wall_breaker', name: '城牆破壞者', desc: '攻擊 ×1.15' },
    startingLevel: 11, growthRates: { hp: 5, attack: 2, defense: 2 },
    startingEquipment: { weapon: 'silver_sword', armor: 'knight_armor' },
  },

  // ===== 第 6 章 BOSS：影武者（影子）+ 伊歐侯爵（真身） =====
  shadow: {
    id: 'shadow', name: '影武者', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 10, attack: 4, defense: 1 },
    skill: { id: 'silent_blade', name: '無聲一刀', desc: '攻擊 ×1.4' },
    startingLevel: 12, growthRates: { hp: 3, attack: 3, defense: 1 },
    startingEquipment: { weapon: 'silver_sword', armor: 'cloth' },
  },
  // 伊歐侯爵 — 王國貴族叛徒，黑暗教派的中介
  eo: {
    id: 'eo', name: '伊歐侯爵', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 12, attack: 6, defense: 2 },
    skill: { id: 'dark_prayer', name: '黑暗契約', desc: '魔法攻擊 ×1.3' },
    startingLevel: 13, growthRates: { hp: 4, attack: 3, defense: 2 },
    startingEquipment: { weapon: 'ice_tome', armor: 'knight_armor' },
  },

  // ===== 第 7 章 BOSS =====
  high_priest: {
    id: 'high_priest', name: '黑暗主教', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 8, attack: 6, defense: 0 },
    skill: { id: 'dark_prayer', name: '邪神禱詞', desc: '攻擊 ×1.3' },
    startingLevel: 13, growthRates: { hp: 2, attack: 4, defense: 0 },
    startingEquipment: { weapon: 'ice_tome', armor: 'robe' },
  },

  // ===== 飛兵新增（在 ch7 出現作為機動威脅）=====
  griffon_rider: {
    id: 'griffon_rider', name: '獅鷲騎士', faction: 'enemy', unitType: 'flier',
    statBonus: { hp: 4, attack: 1, defense: 0 },
    skill: { id: '', name: '高空優勢', desc: '無實際效果（暫保留）' },
    startingLevel: 11, growthRates: { hp: 3, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },

  // ===== 第 8 章 最終 BOSS =====
  cult_leader: {
    id: 'cult_leader', name: '教主 — 黯', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 25, attack: 8, defense: 3 }, // 平衡：def 4→3
    skill: { id: 'void_slash', name: '虛空斬', desc: '攻擊 ×1.5' },
    startingLevel: 16, growthRates: { hp: 6, attack: 3, defense: 2 },
    startingEquipment: { weapon: 'silver_sword', armor: 'knight_armor' },
  },

  // ===== 第 7、8 章雜兵 =====
  cultist_1: {
    id: 'cultist_1', name: '教徒甲', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 4, attack: 2, defense: 1 },
    skill: { id: '', name: '盲信', desc: '無效果' },
    startingLevel: 11, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'steel_sword', armor: 'leather_armor' },
  },
  cultist_2: {
    id: 'cultist_2', name: '教徒乙', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 0, attack: 3, defense: 0 },
    skill: { id: '', name: '盲信', desc: '無效果' },
    startingLevel: 11, growthRates: { hp: 2, attack: 3, defense: 0 },
    startingEquipment: { weapon: 'fire_tome', armor: 'robe' },
  },
  cultist_3: {
    id: 'cultist_3', name: '教徒丙', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 2, attack: 2, defense: 0 },
    skill: { id: '', name: '盲信', desc: '無效果' },
    startingLevel: 12, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'long_bow', armor: 'cloth' },
  },

  // ===== 第 9 章 BOSS（番外）=====
  sub_priest: {
    id: 'sub_priest', name: '副教主 — 凜', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 14, attack: 7, defense: 1 },
    skill: { id: 'dark_prayer', name: '殘禱詞', desc: '魔法攻擊 ×1.3' },
    startingLevel: 17, growthRates: { hp: 3, attack: 4, defense: 1 },
    startingEquipment: { weapon: 'ice_tome', armor: 'robe' },
  },
  zealot_1: {
    id: 'zealot_1', name: '狂信者甲', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 6, attack: 3, defense: 1 },
    skill: { id: '', name: '殉道', desc: '無效果' },
    startingLevel: 15, growthRates: { hp: 4, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'silver_sword', armor: 'chain_mail' },
  },
  zealot_2: {
    id: 'zealot_2', name: '狂信者乙', faction: 'enemy', unitType: 'flier',
    statBonus: { hp: 4, attack: 2, defense: 0 },
    skill: { id: '', name: '殉道', desc: '無效果' },
    startingLevel: 15, growthRates: { hp: 3, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'steel_sword', armor: 'leather_armor' },
  },

  // ===== 第 10 章 真・最終 BOSS =====
  dark_god_shard: {
    id: 'dark_god_shard', name: '邪神碎片', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 35, attack: 11, defense: 4 }, // 平衡：HP 40→35, atk 12→11, def 5→4
    skill: { id: 'void_slash', name: '虛無之觸', desc: '攻擊 ×1.5' },
    startingLevel: 22, growthRates: { hp: 8, attack: 4, defense: 3 },
    startingEquipment: { weapon: 'ice_tome', armor: 'knight_armor' },
  },
  void_wraith: {
    id: 'void_wraith', name: '虛空魔影', faction: 'enemy', unitType: 'flier',
    statBonus: { hp: 8, attack: 4, defense: 1 },
    skill: { id: '', name: '虛空之翼', desc: '無效果' },
    startingLevel: 18, growthRates: { hp: 4, attack: 3, defense: 1 },
    startingEquipment: { weapon: 'silver_sword', armor: 'leather_armor' },
  },
};
