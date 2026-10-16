import type { L10n } from '../sim/defs';

/** 星數升級帶來的全域修正（World 開局時計算一次） */
export interface Mods {
  archerRange: number;
  archerDmg: number;
  archerCost: number;
  archerCrit: number;
  archerPierce: number;
  barracksHp: number;
  barracksArmor: number;
  barracksDmg: number;
  barracksRespawn: number;
  barracksCost: number;
  mageDmg: number;
  mageRange: number;
  mageShred: number;
  mageCost: number;
  mageSlow: number;
  artRange: number;
  artSplash: number;
  artDmg: number;
  artCost: number;
  artConcuss: number;
  meteorCount: number;
  meteorRadius: number;
  meteorDmg: number;
  meteorCd: number;
  meteorBurn: boolean;
  reinfHp: number;
  reinfDmg: number;
  reinfCount: number;
  reinfArmor: number;
  reinfCd: number;
  reinfSprite: string;
}

export function baseMods(): Mods {
  return {
    archerRange: 1,
    archerDmg: 1,
    archerCost: 1,
    archerCrit: 0,
    archerPierce: 0,
    barracksHp: 1,
    barracksArmor: 0,
    barracksDmg: 1,
    barracksRespawn: 1,
    barracksCost: 1,
    mageDmg: 1,
    mageRange: 1,
    mageShred: 0,
    mageCost: 1,
    mageSlow: 0,
    artRange: 1,
    artSplash: 1,
    artDmg: 1,
    artCost: 1,
    artConcuss: 0,
    meteorCount: 3,
    meteorRadius: 1,
    meteorDmg: 1,
    meteorCd: 1,
    meteorBurn: false,
    reinfHp: 1,
    reinfDmg: 1,
    reinfCount: 2,
    reinfArmor: 0,
    reinfCd: 1,
    reinfSprite: 'sp_gary',
  };
}

export interface UpgradeTier {
  name: L10n;
  desc: L10n;
  cost: number;
  apply(m: Mods): void;
}

export interface UpgradeColumn {
  id: string;
  name: L10n;
  icon: string;
  tiers: UpgradeTier[];
}

export const UPGRADE_COLUMNS: UpgradeColumn[] = [
  {
    id: 'archer',
    name: { zh: '弓箭塔', en: 'Archers' },
    icon: 'icb_archer',
    tiers: [
      { name: { zh: '鷹眼', en: 'Eagle Eye' }, desc: { zh: '弓箭塔射程 +10%', en: 'Archer range +10%' }, cost: 1, apply: (m) => (m.archerRange += 0.1) },
      { name: { zh: '精製箭頭', en: 'Barbed Heads' }, desc: { zh: '弓箭塔傷害 +10%', en: 'Archer damage +10%' }, cost: 1, apply: (m) => (m.archerDmg += 0.1) },
      { name: { zh: '穿甲箭', en: 'Bodkin Points' }, desc: { zh: '箭矢無視 20% 護甲', en: 'Arrows ignore 20% armor' }, cost: 2, apply: (m) => (m.archerPierce += 0.2) },
      { name: { zh: '工匠協會', en: 'Fletcher Guild' }, desc: { zh: '弓箭塔建造費 -10%', en: 'Archer towers cost 10% less' }, cost: 2, apply: (m) => (m.archerCost -= 0.1) },
      { name: { zh: '致命一擊', en: 'Precision' }, desc: { zh: '12% 機率造成雙倍傷害', en: '12% chance to deal double damage' }, cost: 3, apply: (m) => (m.archerCrit += 0.12) },
    ],
  },
  {
    id: 'barracks',
    name: { zh: '兵營', en: 'Barracks' },
    icon: 'icb_barracks',
    tiers: [
      { name: { zh: '強化體魄', en: 'Toughness' }, desc: { zh: '士兵生命 +10%', en: 'Soldier health +10%' }, cost: 1, apply: (m) => (m.barracksHp += 0.1) },
      { name: { zh: '鋼盔', en: 'Steel Helms' }, desc: { zh: '士兵護甲 +10%', en: 'Soldier armor +10%' }, cost: 1, apply: (m) => (m.barracksArmor += 0.1) },
      { name: { zh: '快速徵召', en: 'Swift Muster' }, desc: { zh: '士兵重生時間 -25%', en: 'Soldier respawn -25%' }, cost: 2, apply: (m) => (m.barracksRespawn -= 0.25) },
      { name: { zh: '精良武器', en: 'Fine Blades' }, desc: { zh: '士兵傷害 +15%', en: 'Soldier damage +15%' }, cost: 2, apply: (m) => (m.barracksDmg += 0.15) },
      { name: { zh: '戰爭募款', en: 'War Bonds' }, desc: { zh: '兵營建造費 -15%、生命再 +15%', en: 'Barracks cost -15%, health +15%' }, cost: 3, apply: (m) => { m.barracksCost -= 0.15; m.barracksHp += 0.15; } },
    ],
  },
  {
    id: 'mage',
    name: { zh: '法師塔', en: 'Mages' },
    icon: 'icb_mage',
    tiers: [
      { name: { zh: '奧術專注', en: 'Focus' }, desc: { zh: '法師塔傷害 +10%', en: 'Mage damage +10%' }, cost: 1, apply: (m) => (m.mageDmg += 0.1) },
      { name: { zh: '遠見水晶', en: 'Far Sight' }, desc: { zh: '法師塔射程 +10%', en: 'Mage range +10%' }, cost: 1, apply: (m) => (m.mageRange += 0.1) },
      { name: { zh: '腐蝕魔力', en: 'Corrosion' }, desc: { zh: '命中降低目標 5% 護甲（可疊加）', en: 'Hits strip 5% armor (stacks)' }, cost: 2, apply: (m) => (m.mageShred += 0.05) },
      { name: { zh: '寒霜附魔', en: 'Frost Weave' }, desc: { zh: '命中緩速 20%', en: 'Hits slow by 20%' }, cost: 2, apply: (m) => (m.mageSlow += 0.2) },
      { name: { zh: '學院補助', en: 'Academy Grant' }, desc: { zh: '法師塔建造費 -15%、傷害 +10%', en: 'Mage cost -15%, damage +10%' }, cost: 3, apply: (m) => { m.mageCost -= 0.15; m.mageDmg += 0.1; } },
    ],
  },
  {
    id: 'artillery',
    name: { zh: '砲塔', en: 'Artillery' },
    icon: 'icb_artillery',
    tiers: [
      { name: { zh: '測距儀', en: 'Rangefinder' }, desc: { zh: '砲塔射程 +10%', en: 'Artillery range +10%' }, cost: 1, apply: (m) => (m.artRange += 0.1) },
      { name: { zh: '高爆火藥', en: 'Blast Powder' }, desc: { zh: '爆炸範圍 +15%', en: 'Blast radius +15%' }, cost: 1, apply: (m) => (m.artSplash += 0.15) },
      { name: { zh: '震盪彈', en: 'Concussion' }, desc: { zh: '爆炸緩速敵人 30%', en: 'Blasts slow enemies 30%' }, cost: 2, apply: (m) => (m.artConcuss += 0.3) },
      { name: { zh: '矮人工藝', en: 'Dwarven Craft' }, desc: { zh: '砲塔建造費 -10%', en: 'Artillery cost -10%' }, cost: 2, apply: (m) => (m.artCost -= 0.1) },
      { name: { zh: '雙重裝藥', en: 'Double Charge' }, desc: { zh: '砲塔傷害 +20%', en: 'Artillery damage +20%' }, cost: 3, apply: (m) => (m.artDmg += 0.2) },
    ],
  },
  {
    id: 'meteor',
    name: { zh: '流星火雨', en: 'Meteor Rain' },
    icon: 'ic_meteor',
    tiers: [
      { name: { zh: '更多流星', en: 'More Meteors' }, desc: { zh: '流星 +2 顆', en: '+2 meteors' }, cost: 1, apply: (m) => (m.meteorCount += 2) },
      { name: { zh: '烈焰之地', en: 'Scorched Earth' }, desc: { zh: '落點留下燃燒地面', en: 'Impacts leave burning ground' }, cost: 1, apply: (m) => (m.meteorBurn = true) },
      { name: { zh: '巨型隕石', en: 'Bigger Rocks' }, desc: { zh: '範圍 +20%、傷害 +20%', en: 'Radius +20%, damage +20%' }, cost: 2, apply: (m) => { m.meteorRadius += 0.2; m.meteorDmg += 0.2; } },
      { name: { zh: '星象預言', en: 'Starcaller' }, desc: { zh: '冷卻 -20%', en: 'Cooldown -20%' }, cost: 2, apply: (m) => (m.meteorCd -= 0.2) },
      { name: { zh: '天罰', en: 'Armageddon' }, desc: { zh: '流星再 +3 顆、傷害 +30%', en: '+3 meteors, damage +30%' }, cost: 3, apply: (m) => { m.meteorCount += 3; m.meteorDmg += 0.3; } },
    ],
  },
  {
    id: 'reinforce',
    name: { zh: '王國援軍', en: 'Reinforcements' },
    icon: 'ic_reinforce',
    tiers: [
      { name: { zh: '民兵訓練', en: 'Drilled Militia' }, desc: { zh: '援軍生命 +30%', en: 'Reinforcement health +30%' }, cost: 1, apply: (m) => (m.reinfHp += 0.3) },
      { name: { zh: '鐵叉', en: 'Pitchforks' }, desc: { zh: '援軍傷害 +40%', en: 'Reinforcement damage +40%' }, cost: 1, apply: (m) => (m.reinfDmg += 0.4) },
      { name: { zh: '三人小隊', en: 'Third Man' }, desc: { zh: '每次多召喚 1 人', en: 'Call 1 extra soldier' }, cost: 2, apply: (m) => (m.reinfCount += 1) },
      { name: { zh: '皮甲', en: 'Leather Armor' }, desc: { zh: '援軍護甲 +25%、冷卻 -15%', en: 'Armor +25%, cooldown -15%' }, cost: 2, apply: (m) => { m.reinfArmor += 0.25; m.reinfCd -= 0.15; } },
      { name: { zh: '王國騎士', en: 'Royal Knights' }, desc: { zh: '援軍改為重裝騎士（大幅強化）', en: 'Reinforcements become armored knights' }, cost: 3, apply: (m) => { m.reinfHp += 1; m.reinfDmg += 1; m.reinfArmor += 0.2; m.reinfSprite = 'sp_player_sword'; } },
    ],
  },
];

export function computeMods(levels: Record<string, number>): Mods {
  const m = baseMods();
  for (const col of UPGRADE_COLUMNS) {
    const n = levels[col.id] ?? 0;
    for (let i = 0; i < n && i < col.tiers.length; i++) col.tiers[i].apply(m);
  }
  return m;
}
