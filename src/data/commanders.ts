import type { CommanderDef } from '../types';

/**
 * 王國雜兵 commander id 集合 — 立繪只是色塊、裝備固定，沒有可調整事項。
 * Hub 出陣畫面隱藏；BattleScene 自動依 scenario.deployments 部署 + 章節 scaling 等級。
 */
export const PLAYER_GENERIC_IDS = new Set<string>([
  'knight_recruit',
  'spear_recruit',
  'horse_scout',
  'archer_recruit',
  'apprentice_mage',
]);

export function isPlayerGeneric(id: string): boolean {
  return PLAYER_GENERIC_IDS.has(id);
}

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
  aria: 12,  // ch12 後日談 — 第 12 章救援戰後加入
  // 後日談 同盟陣營（C2）— ch12 通過後王都派來/推薦的支援武將
  viktor: 12,
  lila: 12,
  elena: 12,
  // 普通兵種：第 1 章起即可調度，補陣容厚度
  knight_recruit: 1,
  spear_recruit: 1,
  horse_scout: 1,
  archer_recruit: 1,
  apprentice_mage: 1,
};

export const COMMANDERS: Record<string, CommanderDef> = {
  // ===== 玩家陣營（核心 3 人） =====
  arthur: {
    id: 'arthur', name: '亞瑟', faction: 'player', unitType: 'sword',
    statBonus: { hp: 6, attack: 1, defense: 1 },
    skill: { id: 'kings_will', name: '王者意志', desc: 'HP > 80% 攻擊 ×1.15；HP < 50% 受傷 ×0.7' },
    activeSkill: {
      id: 'royal_flash',
      name: '王者一閃',
      desc: '下一擊：傷害 ×1.5、命中 +20%、爆擊 +50%',
      type: 'empower_attack',
      empower: { dmgMul: 1.5, hitBoost: 20, critBoost: 50 },
    },
    startingLevel: 5, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },
  rosa: {
    id: 'rosa', name: '蘿莎', faction: 'player', unitType: 'archer',
    statBonus: { hp: 2, attack: 2, defense: 0 },
    skill: { id: 'sharp_shooter', name: '神射', desc: '對 flier/archer 滿血 ×1.5；其他 ×1.1' },
    activeSkill: {
      id: 'aimed_shot',
      name: '精準狙擊',
      desc: '下一擊：穿透防禦、傷害 ×1.4、命中 +30%',
      type: 'empower_attack',
      empower: { dmgMul: 1.4, hitBoost: 30, ignoreDef: true },
    },
    startingLevel: 5, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'short_bow', armor: 'cloth' },
  },
  gary: {
    id: 'gary', name: '蓋瑞', faction: 'player', unitType: 'lance',
    statBonus: { hp: 4, attack: 1, defense: 2 },
    skill: { id: 'unmoving', name: '不動如山', desc: '原地不動攻擊 ×1.5；移動後 ×0.85' },
    activeSkill: {
      id: 'last_stand_active',
      name: '死守',
      desc: '本回合 + 下回合受到傷害 ×0.5',
      type: 'defense_stance',
      stance: { incomingMul: 0.5, durationTurns: 1 },
    },
    startingLevel: 5, growthRates: { hp: 4, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'iron_lance', armor: 'chain_mail' },
  },

  // ===== 玩家陣營（中後期招募） =====
  sharon: {
    id: 'sharon', name: '夏倫', faction: 'player', unitType: 'mage',
    statBonus: { hp: 0, attack: 3, defense: 0 },
    skill: { id: 'fameel_arcana', name: '法米爾秘術', desc: '對 lance/sword ×1.4，對 archer/flier ×0.85' },
    activeSkill: {
      id: 'restoration',
      name: '癒術',
      desc: '立即恢復 25 HP',
      type: 'heal_self',
      heal: { amount: 25 },
    },
    startingLevel: 7, growthRates: { hp: 2, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'fire_tome', armor: 'robe' },
  },
  rain: {
    id: 'rain', name: '雷恩', faction: 'player', unitType: 'cavalry',
    statBonus: { hp: 4, attack: 2, defense: 1 },
    skill: { id: 'knight_charge', name: '騎士榮耀', desc: '移動 ≥ 3 格時，攻擊 ×1.3' },
    activeSkill: {
      id: 'lance_thrust',
      name: '騎兵突刺',
      desc: '下一擊：傷害 ×1.6、命中 +15%',
      type: 'empower_attack',
      empower: { dmgMul: 1.6, hitBoost: 15 },
    },
    startingLevel: 9, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'pegasus_blade', armor: 'cavalry_plate' },
  },

  // ===== 第 1 章敵方 =====
  morden: {
    id: 'morden', name: '莫頓', faction: 'enemy', unitType: 'cavalry',
    statBonus: { hp: 2, attack: 1, defense: 0 },
    skill: { id: 'cavalry_charge', name: '突擊', desc: '移動 ≥ 3 格時，攻擊 ×1.2' },
    startingLevel: 5, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'cavalry_blade', armor: 'cavalry_leather' },
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
    skill: { id: 'cleave', name: '橫掃', desc: '對 HP > 70% 的目標攻擊 ×1.2' },
    startingLevel: 3, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },
  // 新增：第 1 章弓兵（讓玩家學會處理遠程威脅）
  scout_archer: {
    id: 'scout_archer', name: '斥候弓手', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 0, attack: 0, defense: 0 },
    skill: { id: 'steady_aim', name: '冷靜瞄準', desc: '攻擊 ×1.2' },
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
    activeSkill: {
      id: 'kings_doom',
      name: '王國終結',
      desc: '下一擊：傷害 ×1.5、命中 +20%',
      type: 'empower_attack',
      empower: { dmgMul: 1.5, hitBoost: 20 },
    },
    startingLevel: 9, growthRates: { hp: 5, attack: 2, defense: 2 },
    startingEquipment: { weapon: 'pegasus_blade', armor: 'cavalry_plate' },
  },

  // ===== 第 4 章敵方 =====
  hirsch: {
    id: 'hirsch', name: '赫許', faction: 'enemy', unitType: 'lance',
    statBonus: { hp: 4, attack: 1, defense: 1 },
    skill: { id: 'riverbank_guard', name: '河岸戍守', desc: '受到傷害 ×0.8' },
    startingLevel: 8, growthRates: { hp: 3, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'iron_lance', armor: 'chain_mail' },
  },
  mara: {
    id: 'mara', name: '瑪拉', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 2, attack: 1, defense: 0 },
    skill: { id: 'quick_shot', name: '快射', desc: '攻擊 ×1.1' },
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
    startingEquipment: { weapon: 'pegasus_blade', armor: 'cavalry_plate' },
  },

  // ===== 第 6 章 BOSS：影武者（影子）+ 伊歐侯爵（真身） =====
  shadow: {
    id: 'shadow', name: '影武者', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 10, attack: 4, defense: 1 },
    skill: { id: 'silent_blade', name: '無聲一刀', desc: '攻擊 ×1.4' },
    activeSkill: {
      id: 'shadow_strike',
      name: '影斬',
      desc: '下一擊：傷害 ×1.5、爆擊 +60%',
      type: 'empower_attack',
      empower: { dmgMul: 1.5, critBoost: 60 },
    },
    startingLevel: 12, growthRates: { hp: 3, attack: 3, defense: 1 },
    startingEquipment: { weapon: 'silver_sword', armor: 'cloth' },
  },
  // 伊歐侯爵 — 王國貴族叛徒，黑暗教派的中介
  eo: {
    id: 'eo', name: '伊歐侯爵', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 12, attack: 6, defense: 2 },
    skill: { id: 'dark_prayer', name: '黑暗契約', desc: '魔法攻擊 ×1.3' },
    activeSkill: {
      id: 'soul_bind',
      name: '影縛禁咒',
      desc: '下一擊：穿透防禦、傷害 ×1.6',
      type: 'empower_attack',
      empower: { dmgMul: 1.6, ignoreDef: true },
    },
    startingLevel: 13, growthRates: { hp: 4, attack: 3, defense: 2 },
    startingEquipment: { weapon: 'ice_tome', armor: 'knight_armor' },
  },

  // ===== 第 7 章 BOSS =====
  high_priest: {
    id: 'high_priest', name: '黑暗主教', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 8, attack: 6, defense: 0 },
    skill: { id: 'dark_prayer', name: '邪神禱詞', desc: '攻擊 ×1.3' },
    activeSkill: {
      id: 'dark_judgment',
      name: '黑暗審判',
      desc: '下一擊：傷害 ×1.7、命中 +25%',
      type: 'empower_attack',
      empower: { dmgMul: 1.7, hitBoost: 25 },
    },
    startingLevel: 13, growthRates: { hp: 2, attack: 4, defense: 0 },
    startingEquipment: { weapon: 'ice_tome', armor: 'robe' },
  },

  // ===== 飛兵新增（在 ch7 出現作為機動威脅）=====
  griffon_rider: {
    id: 'griffon_rider', name: '獅鷲騎士', faction: 'enemy', unitType: 'flier',
    statBonus: { hp: 4, attack: 1, defense: 0 },
    skill: { id: 'high_sky', name: '高空優勢', desc: '對地面單位攻擊 ×1.2' },
    startingLevel: 11, growthRates: { hp: 3, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'wing_blade', armor: 'wyvern_scale' },
  },

  // ===== 第 8 章 最終 BOSS =====
  cult_leader: {
    id: 'cult_leader', name: '教主 — 黯', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 25, attack: 8, defense: 3 }, // 平衡：def 4→3
    skill: { id: 'void_slash', name: '虛空斬', desc: '攻擊 ×1.5' },
    activeSkill: {
      id: 'void_annihilation',
      name: '虛空滅絕',
      desc: '下一擊：穿透防禦、傷害 ×1.8、必中（命中 +100%）',
      type: 'empower_attack',
      empower: { dmgMul: 1.8, hitBoost: 100, ignoreDef: true },
    },
    startingLevel: 16, growthRates: { hp: 6, attack: 3, defense: 2 },
    startingEquipment: { weapon: 'silver_sword', armor: 'knight_armor' },
  },

  // ===== 第 7、8 章雜兵 =====
  cultist_1: {
    id: 'cultist_1', name: '教徒甲', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 4, attack: 2, defense: 1 },
    skill: { id: 'blind_faith', name: '盲信', desc: '攻擊 ×1.15' },
    startingLevel: 11, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'steel_sword', armor: 'leather_armor' },
  },
  cultist_2: {
    id: 'cultist_2', name: '教徒乙', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 0, attack: 3, defense: 0 },
    skill: { id: 'blind_faith', name: '盲信', desc: '攻擊 ×1.15' },
    startingLevel: 11, growthRates: { hp: 2, attack: 3, defense: 0 },
    startingEquipment: { weapon: 'fire_tome', armor: 'robe' },
  },
  cultist_3: {
    id: 'cultist_3', name: '教徒丙', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 2, attack: 2, defense: 0 },
    skill: { id: 'blind_faith', name: '盲信', desc: '攻擊 ×1.15' },
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
    skill: { id: 'martyrdom', name: '殉道', desc: 'HP < 25% 攻擊 ×1.6' },
    startingLevel: 15, growthRates: { hp: 4, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'silver_sword', armor: 'chain_mail' },
  },
  zealot_2: {
    id: 'zealot_2', name: '狂信者乙', faction: 'enemy', unitType: 'flier',
    statBonus: { hp: 4, attack: 2, defense: 0 },
    skill: { id: 'martyrdom', name: '殉道', desc: 'HP < 25% 攻擊 ×1.6' },
    startingLevel: 15, growthRates: { hp: 3, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'wing_blade', armor: 'light_mail' },
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
    skill: { id: 'high_sky', name: '虛空之翼', desc: '對地面單位攻擊 ×1.2' },
    startingLevel: 18, growthRates: { hp: 4, attack: 3, defense: 1 },
    startingEquipment: { weapon: 'sky_lance', armor: 'storm_armor' },
  },

  // ============================================
  // 玩家普通兵種（沒有特技、stat 低於英雄、陪衝主力）
  // 這 5 名從第 1 章起可用，提供陣容厚度
  // ============================================
  knight_recruit: {
    id: 'knight_recruit', name: '王國劍兵', faction: 'player', unitType: 'sword',
    statBonus: { hp: 0, attack: 0, defense: 0 },
    skill: { id: 'cleave', name: '揮砍', desc: '對 HP > 70% 的目標 ×1.2' },
    startingLevel: 3, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },
  spear_recruit: {
    id: 'spear_recruit', name: '王國槍兵', faction: 'player', unitType: 'lance',
    statBonus: { hp: 2, attack: 0, defense: 1 },
    skill: { id: 'shield_wall', name: '盾牆', desc: '受到傷害 ×0.7' },
    startingLevel: 3, growthRates: { hp: 4, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'iron_lance', armor: 'leather_armor' },
  },
  horse_scout: {
    id: 'horse_scout', name: '騎兵斥候', faction: 'player', unitType: 'cavalry',
    statBonus: { hp: 0, attack: 1, defense: 0 },
    skill: { id: 'cavalry_charge', name: '突擊', desc: '移動 ≥ 3 格時，攻擊 ×1.2' },
    startingLevel: 3, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'cavalry_blade', armor: 'cavalry_leather' },
  },
  archer_recruit: {
    id: 'archer_recruit', name: '王國弓兵', faction: 'player', unitType: 'archer',
    statBonus: { hp: 0, attack: 0, defense: 0 },
    skill: { id: 'eagle_eye', name: '鷹眼', desc: '弓兵時 ×1.15' },
    startingLevel: 3, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'short_bow', armor: 'cloth' },
  },
  apprentice_mage: {
    id: 'apprentice_mage', name: '見習法師', faction: 'player', unitType: 'mage',
    statBonus: { hp: -2, attack: 1, defense: 0 },
    skill: { id: 'moonlight_chant', name: '月光詠唱', desc: '對滿血目標 ×1.25' },
    startingLevel: 3, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'spark_tome', armor: 'robe' },
  },

  // ============================================
  // 新增敵方雜兵類型（補強各章敵方陣容多樣性）
  // ============================================
  bandit_thug: {
    id: 'bandit_thug', name: '蠻族劫匪', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 2, attack: 1, defense: 0 },
    skill: { id: 'last_stand', name: '殊死', desc: 'HP < 35% ×1.5' },
    startingLevel: 4, growthRates: { hp: 3, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },
  raider_horseman: {
    id: 'raider_horseman', name: '蠻族騎士', faction: 'enemy', unitType: 'cavalry',
    statBonus: { hp: 0, attack: 1, defense: 0 },
    skill: { id: 'frenzied_raid', name: '狂血突擊', desc: 'HP > 70% 時攻擊 ×1.25' },
    startingLevel: 5, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'cavalry_blade', armor: 'cavalry_leather' },
  },
  frost_witch: {
    id: 'frost_witch', name: '霜之巫女', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: -1, attack: 1, defense: 0 },
    skill: { id: 'ice_cone', name: '冰錐', desc: '攻擊 ×1.15' },
    startingLevel: 6, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'fire_tome', armor: 'robe' },
  },
  sniper: {
    id: 'sniper', name: '神射手', faction: 'enemy', unitType: 'archer',
    statBonus: { hp: 0, attack: 1, defense: 0 },
    skill: { id: 'eagle_eye', name: '鷹眼', desc: '弓兵時 ×1.15' },
    startingLevel: 7, growthRates: { hp: 2, attack: 2, defense: 0 },
    startingEquipment: { weapon: 'long_bow', armor: 'cloth' },
  },
  spear_militia: {
    id: 'spear_militia', name: '蠻族長槍', faction: 'enemy', unitType: 'lance',
    statBonus: { hp: 1, attack: 0, defense: 1 },
    skill: { id: 'phalanx_wall', name: '盾牆陣', desc: '相鄰友軍 ≥ 1 時受傷 ×0.8' },
    startingLevel: 5, growthRates: { hp: 4, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'iron_lance', armor: 'chain_mail' },
  },
  berserker: {
    id: 'berserker', name: '狂戰士', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 4, attack: 3, defense: -1 },
    skill: { id: 'martyrdom', name: '狂暴', desc: 'HP < 25% ×1.6' },
    startingLevel: 8, growthRates: { hp: 4, attack: 3, defense: 0 },
    startingEquipment: { weapon: 'steel_sword', armor: 'leather_armor' },
  },
  shadow_minion: {
    id: 'shadow_minion', name: '影之眷屬', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 0, attack: 2, defense: 0 },
    skill: { id: 'silent_blade', name: '無聲一刀', desc: '攻擊 ×1.4' },
    startingLevel: 10, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'steel_sword', armor: 'cloth' },
  },
  void_acolyte: {
    id: 'void_acolyte', name: '虛空使徒', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 2, attack: 3, defense: 0 },
    skill: { id: 'dark_prayer', name: '虛空禱詞', desc: '攻擊 ×1.3' },
    startingLevel: 12, growthRates: { hp: 3, attack: 3, defense: 0 },
    startingEquipment: { weapon: 'ice_tome', armor: 'robe' },
  },

  // ============================================
  // 第 12 章 後日談 — 鐵礦山的虛空殘渣
  // ============================================

  // 玩家：艾莉雅 — 獵鷲山民族出身的飛兵斥候，玩家陣營首位 flier
  aria: {
    id: 'aria', name: '艾莉雅', faction: 'player', unitType: 'flier',
    statBonus: { hp: 2, attack: 2, defense: 1 },
    skill: { id: 'wind_rider', name: '御風', desc: '移動 ≥ 4 格時，攻擊 ×1.25' },
    activeSkill: {
      id: 'dive_strike',
      name: '俯衝突擊',
      desc: '下一擊：穿透防禦、傷害 ×1.5',
      type: 'empower_attack',
      empower: { dmgMul: 1.5, ignoreDef: true },
    },
    startingLevel: 12, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'sky_lance', armor: 'storm_armor' },
  },
  // 敵方 BOSS：澤林博士 — 王立研究院禁忌學者，研究虛空殘渣再煉化
  zerin: {
    id: 'zerin', name: '澤林博士', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 8, attack: 4, defense: 2 },
    skill: { id: 'shard_infusion', name: '殘渣注入', desc: '對 HP > 50% 的目標 ×1.35' },
    activeSkill: {
      id: 'shard_overload',
      name: '殘渣注入‧極',
      desc: '下一擊：傷害 ×1.5、命中 +20%',
      type: 'empower_attack',
      empower: { dmgMul: 1.5, hitBoost: 20 },
    },
    startingLevel: 14, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'arcane_tome', armor: 'magus_robe' },
  },
  // 敵方雜兵：碎片狼獸 — 被虛空殘渣感染的山犬，亂衝亂咬
  shard_wolf: {
    id: 'shard_wolf', name: '碎片狼獸', faction: 'enemy', unitType: 'cavalry',
    statBonus: { hp: 0, attack: 1, defense: 0 },
    skill: { id: 'tainted_bite', name: '虛空毒爪', desc: '對 mage 目標 ×1.4（剋後排）' },
    startingLevel: 8, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'cavalry_blade', armor: 'cavalry_leather' },
  },
  // 敵方雜兵：感染礦工 — 虛空黑霧污染、揮舞鶴嘴鋤的礦工
  infected_miner: {
    id: 'infected_miner', name: '感染礦工', faction: 'enemy', unitType: 'sword',
    statBonus: { hp: 2, attack: 0, defense: 0 },
    skill: { id: 'last_stand', name: '殊死', desc: 'HP < 35% ×1.5' },
    startingLevel: 7, growthRates: { hp: 3, attack: 1, defense: 1 },
    startingEquipment: { weapon: 'iron_sword', armor: 'leather_armor' },
  },

  // ============================================
  // 後日談 同盟陣營（C2）— Ch12 通過後王都派來/推薦的支援武將
  // ============================================

  // 維克托 — 王都騎士團長，鋼盾型槍兵
  viktor: {
    id: 'viktor', name: '維克托', faction: 'player', unitType: 'lance',
    statBonus: { hp: 6, attack: 0, defense: 3 },
    skill: { id: 'bulwark', name: '防禦壁壘', desc: '受到傷害 ×0.6' },
    activeSkill: {
      id: 'iron_bulwark',
      name: '鋼盾屏障',
      desc: '本回合 + 下回合受到傷害 ×0.4（極致防禦）',
      type: 'defense_stance',
      stance: { incomingMul: 0.4, durationTurns: 1 },
    },
    startingLevel: 12, growthRates: { hp: 4, attack: 1, defense: 2 },
    startingEquipment: { weapon: 'holy_lance', armor: 'chain_mail' },
  },

  // 莉拉 — 法米爾魔法學院新晉教師，滿血爆發法師
  lila: {
    id: 'lila', name: '莉拉', faction: 'player', unitType: 'mage',
    statBonus: { hp: 0, attack: 3, defense: 0 },
    skill: { id: 'arcane_focus', name: '秘術專注', desc: '自身 HP > 70% 時攻擊 ×1.3' },
    activeSkill: {
      id: 'arcane_burst',
      name: '秘術爆發',
      desc: '下一擊：傷害 ×2.0（玻璃大砲）',
      type: 'empower_attack',
      empower: { dmgMul: 2.0 },
    },
    startingLevel: 12, growthRates: { hp: 2, attack: 3, defense: 0 },
    startingEquipment: { weapon: 'ice_tome', armor: 'magus_robe' },
  },

  // 艾蓮娜 — 退役元帥之女，收割型弓手
  elena: {
    id: 'elena', name: '艾蓮娜', faction: 'player', unitType: 'archer',
    statBonus: { hp: 0, attack: 3, defense: 0 },
    skill: { id: 'marksman', name: '神射手', desc: '對 HP < 40% 目標 ×1.5' },
    activeSkill: {
      id: 'mortal_arrow',
      name: '致命箭',
      desc: '下一擊：傷害 ×1.5、必爆擊（爆擊率 +100%）',
      type: 'empower_attack',
      empower: { dmgMul: 1.5, critBoost: 100 },
    },
    startingLevel: 12, growthRates: { hp: 2, attack: 3, defense: 1 },
    startingEquipment: { weapon: 'elven_bow', armor: 'ranger_cloak' },
  },

  // ============================================
  // Ch13 王都的影子 — BOSS 克勞德總管
  // ============================================
  // 王立研究院總管，碎片計畫第二支同志（澤林是第一支，克勞德是第二支）。
  // 用文書權力私下蒐集碎片殘渣，召喚虛空生物作為實驗體。
  claude_steward: {
    id: 'claude_steward', name: '克勞德總管', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 8, attack: 4, defense: 2 },
    skill: { id: 'archive_curse', name: '檔案禁咒', desc: '對法師/弓兵 ×1.4（剋後排）' },
    activeSkill: {
      id: 'forbidden_tome',
      name: '禁書詠唱',
      desc: '下一擊：穿透防禦、傷害 ×1.6',
      type: 'empower_attack',
      empower: { dmgMul: 1.6, ignoreDef: true },
    },
    startingLevel: 14, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'arcane_tome', armor: 'magus_robe' },
  },

  // ============================================
  // Ch14 議院的永生 — BOSS 席爾凡議長（碎片計畫第三支 + 真正策劃者）
  // ============================================
  // 王都議院議長，五十年來用碎片粉末延壽。表面老紳士、實則半人半虛空。
  // 他是給澤林、克勞德資金的人 — 碎片計畫的金主與策劃者。
  sylvain_speaker: {
    id: 'sylvain_speaker', name: '席爾凡議長', faction: 'enemy', unitType: 'mage',
    statBonus: { hp: 10, attack: 5, defense: 3 },
    skill: { id: 'eternal_pact', name: '永生契約', desc: 'HP < 50% 時受到傷害 ×0.5' },
    activeSkill: {
      id: 'eternal_decree',
      name: '永生律令',
      desc: '下一擊：穿透防禦、傷害 ×1.7、命中 +30%',
      type: 'empower_attack',
      empower: { dmgMul: 1.7, hitBoost: 30, ignoreDef: true },
    },
    startingLevel: 16, growthRates: { hp: 3, attack: 2, defense: 1 },
    startingEquipment: { weapon: 'arcane_tome', armor: 'magus_robe' },
  },
};
