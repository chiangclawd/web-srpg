import type { HeroDef, L10n } from '../sim/defs';

// ───────── 技能加點 ─────────
// 三個技能和絕招各有 3 階。每升一級得 2 點，10 級共 20 點；全部點滿要 23 點，所以要取捨。
// 技能第 1 階要到技能原本的解鎖等級（1 / 4 / 7），第 2、3 階另外要英雄 3 級、6 級。
// 絕招一開始就是第 1 階（不用點數）。

/** 第 n 階的效果倍率（傷害、治療、持續時間）與冷卻倍率 */
export const RANK_POWER = [0, 1, 1.2, 1.4];
export const RANK_CD = [1, 1, 0.9, 0.8];
/** 升到第 n 階要花的點數 */
export const RANK_COST = [0, 1, 2, 3];
/** 升到第 n 階需要的英雄等級（技能第 1 階另看技能自己的解鎖等級） */
export const RANK_LEVEL = [0, 1, 3, 6];
export const MAX_RANK = 3;
/** 絕招在 ranks 裡的鍵 */
export const ULT = 'ult';

export function skillPoints(level: number): number {
  return level * 2;
}

/** 某個能力（技能 id 或 'ult'）目前的階數 */
export function rankOf(ranks: Record<string, number>, id: string): number {
  return id === ULT ? Math.max(1, ranks[ULT] ?? 1) : (ranks[id] ?? 0);
}

export function spentPoints(def: HeroDef, ranks: Record<string, number>): number {
  let n = 0;
  for (const id of [...def.skills.map((s) => s.id), ULT]) {
    const r = rankOf(ranks, id);
    // 絕招第 1 階免費
    for (let k = id === ULT ? 2 : 1; k <= r; k++) n += RANK_COST[k];
  }
  return n;
}

/** 升到下一階需要的英雄等級 */
export function rankLevel(def: HeroDef, id: string, rank: number): number {
  const sk = def.skills.find((s) => s.id === id);
  return Math.max(RANK_LEVEL[rank] ?? 99, rank === 1 && sk ? sk.unlockLevel : 1);
}

export type RankBlock = 'max' | 'level' | 'points' | null;

/** 能不能把 id 升一階；不能的話原因是什麼 */
export function rankUpBlock(def: HeroDef, level: number, ranks: Record<string, number>, id: string): RankBlock {
  const next = rankOf(ranks, id) + 1;
  if (next > MAX_RANK) return 'max';
  if (level < rankLevel(def, id, next)) return 'level';
  if (skillPoints(level) - spentPoints(def, ranks) < RANK_COST[next]) return 'points';
  return null;
}

/** 推薦配點：先讓每個技能有第 1 階，再升絕招，接著輪流把技能升到第 2、3 階 */
export function autoRanks(def: HeroDef, level: number): Record<string, number> {
  const ranks: Record<string, number> = {};
  const ids = def.skills.map((s) => s.id);
  const order: [string, number][] = [
    ...ids.map((id) => [id, 1] as [string, number]),
    [ULT, 2],
    ...ids.map((id) => [id, 2] as [string, number]),
    ...ids.map((id) => [id, 3] as [string, number]),
    [ULT, 3],
  ];
  for (const [id, r] of order) if (rankOf(ranks, id) === r - 1 && !rankUpBlock(def, level, ranks, id)) ranks[id] = r;
  return ranks;
}

// ───────── 專屬裝備 ─────────
// 每位英雄兩件，用寶石買，一次只能裝一件。

export interface GearMods {
  /** 生命、攻擊力、攻擊速度、射程、移動速度的倍率；護甲直接加 */
  hp?: number;
  dmg?: number;
  atkSpeed?: number;
  range?: number;
  speed?: number;
  armor?: number;
  /** 某技能（或 'ult'）的效果倍率、冷卻倍率 */
  power?: Record<string, number>;
  cd?: Record<string, number>;
}

export interface GearDef {
  id: string;
  hero: string;
  name: L10n;
  desc: L10n;
  icon: string;
  price: number;
  mods: GearMods;
}

export const GEAR_PRICES = [120, 200];

const gear = (hero: string, list: Omit<GearDef, 'hero' | 'price'>[]): GearDef[] => list.map((g, i) => ({ ...g, hero, price: GEAR_PRICES[i] }));

export const HERO_GEAR: Record<string, GearDef[]> = {
  arthur: gear('arthur', [
    { id: 'lionheart', name: { zh: '獅心盾', en: 'Lionheart Shield' }, desc: { zh: '生命 +15%、護甲 +10%', en: '+15% health, +10% armor' }, icon: 'ic_shield', mods: { hp: 1.15, armor: 0.1 } },
    { id: 'oathblade', name: { zh: '誓約聖劍', en: 'Oathblade' }, desc: { zh: '聖劍斬傷害 +40%、盾擊冷卻 -25%', en: 'Holy Blade +40% damage, Shield Bash cooldown -25%' }, icon: 'sk_holyblade', mods: { power: { holyblade: 1.4 }, cd: { bash: 0.75 } } },
  ]),
  elena: gear('elena', [
    { id: 'elvenbow', name: { zh: '精靈長弓', en: 'Elven Longbow' }, desc: { zh: '射程 +15%、攻擊力 +10%', en: '+15% range, +10% damage' }, icon: 'sk_pierce', mods: { range: 1.15, dmg: 1.1 } },
    { id: 'galequiver', name: { zh: '疾風箭袋', en: 'Gale Quiver' }, desc: { zh: '攻擊速度 +20%、連珠箭與箭雨傷害 +25%', en: '+20% attack speed, Multishot and Arrow Storm +25% damage' }, icon: 'sk_multishot', mods: { atkSpeed: 1.2, power: { multishot: 1.25, hail: 1.25 } } },
  ]),
  lila: gear('lila', [
    { id: 'crystalstaff', name: { zh: '冰晶法杖', en: 'Crystal Staff' }, desc: { zh: '寒冰長槍傷害 +35%、冰霜新星冷卻 -20%', en: 'Ice Lance +35% damage, Frost Nova cooldown -20%' }, icon: 'sk_icelance', mods: { power: { icelance: 1.35 }, cd: { frostnova: 0.8 } } },
    { id: 'frostheart', name: { zh: '霜心護符', en: 'Frostheart Amulet' }, desc: { zh: '絕對零度傷害 +25%、冷卻 -25%', en: 'Absolute Zero +25% damage, cooldown -25%' }, icon: 'ult_lila', mods: { power: { ult: 1.25 }, cd: { ult: 0.75 } } },
  ]),
  rain: gear('rain', [
    { id: 'galelance', name: { zh: '疾風長槍', en: 'Gale Lance' }, desc: { zh: '突擊衝鋒傷害 +35%、冷卻 -25%', en: 'Lance Charge +35% damage, cooldown -25%' }, icon: 'sk_charge', mods: { power: { charge: 1.35 }, cd: { charge: 0.75 } } },
    { id: 'warhorse', name: { zh: '戰馬蹄鐵', en: 'Warhorse Shoes' }, desc: { zh: '生命 +20%、移動速度 +20%、鐵蹄踐踏冷卻 -20%', en: '+20% health, +20% speed, Trample cooldown -20%' }, icon: 'sk_trample', mods: { hp: 1.2, speed: 1.2, cd: { trample: 0.8 } } },
  ]),
  aria: gear('aria', [
    { id: 'thunderplume', name: { zh: '雷鳴羽飾', en: 'Thunder Plume' }, desc: { zh: '雷霆風暴與雷霆審判傷害 +30%', en: 'Thunderstorm and Thunder Judgment +30% damage' }, icon: 'sk_storm', mods: { power: { storm: 1.3, ult: 1.3 } } },
    { id: 'griffinbarding', name: { zh: '獅鷲護甲', en: 'Griffin Barding' }, desc: { zh: '生命 +25%、護甲 +10%、俯衝穿刺冷卻 -20%', en: '+25% health, +10% armor, Dive Strike cooldown -20%' }, icon: 'ic_shield', mods: { hp: 1.25, armor: 0.1, cd: { dive: 0.8 } } },
  ]),
  sharon: gear('sharon', [
    { id: 'annotated', name: { zh: '聖典註本', en: 'Annotated Scripture' }, desc: { zh: '聖域治療 +40%、智慧加護冷卻 -20%', en: 'Sanctuary heals +40%, Aegis of Wisdom cooldown -20%' }, icon: 'ic_book', mods: { power: { sanctuary: 1.4 }, cd: { aegis: 0.8 } } },
    { id: 'judgebell', name: { zh: '審判之鈴', en: 'Bell of Judgment' }, desc: { zh: '聖光制裁傷害 +40%、絕招冷卻 -20%', en: 'Smite +40% damage, ultimate cooldown -20%' }, icon: 'sk_smite', mods: { power: { smite: 1.4 }, cd: { ult: 0.8 } } },
  ]),
  viktor: gear('viktor', [
    { id: 'bastion', name: { zh: '鐵壁塔盾', en: 'Bastion Shield' }, desc: { zh: '護甲 +15%、鐵壁方陣冷卻 -25%', en: '+15% armor, Iron Phalanx cooldown -25%' }, icon: 'ic_shield', mods: { armor: 0.15, cd: { phalanx: 0.75 } } },
    { id: 'siegebreaker', name: { zh: '破城長戟', en: 'Siegebreaker' }, desc: { zh: '長槍貫刺與破甲重擊傷害 +35%', en: 'Spear Thrust and Sunder +35% damage' }, icon: 'sk_sunder', mods: { power: { thrust: 1.35, sunder: 1.35 } } },
  ]),
  shadow: gear('shadow', [
    { id: 'shadowmark', name: { zh: '影紋短刃', en: 'Shadowmark Daggers' }, desc: { zh: '攻擊力 +20%、處決冷卻 -25%', en: '+20% damage, Execute cooldown -25%' }, icon: 'sk_execute', mods: { dmg: 1.2, cd: { execute: 0.75 } } },
    { id: 'nightcloak', name: { zh: '夜行斗篷', en: 'Nightwalk Cloak' }, desc: { zh: '移動速度 +15%、瞬影冷卻 -30%、煙霧彈冷卻 -20%', en: '+15% speed, Shadow Step cooldown -30%, Smoke Bomb cooldown -20%' }, icon: 'sk_smokebomb', mods: { speed: 1.15, cd: { shadowstep: 0.7, smokebomb: 0.8 } } },
  ]),
};

export function gearById(id: string | undefined): GearDef | undefined {
  if (!id) return undefined;
  for (const list of Object.values(HERO_GEAR)) for (const g of list) if (g.id === id) return g;
  return undefined;
}

// ───────── 戰鬥用的配置 ─────────

/** 存檔裡一位英雄的養成狀態（ranks 沒寫 = 推薦配點，跟著等級自動加） */
export interface HeroBuild {
  ranks?: Record<string, number>;
  gear?: string;
}

/** 把存檔的配點整理成戰鬥用：自動配點時依等級算，手動配點時拿掉超出等級的部分 */
export function resolveRanks(def: HeroDef, level: number, build?: HeroBuild): Record<string, number> {
  if (!build?.ranks) return autoRanks(def, level);
  const out: Record<string, number> = {};
  for (const id of [...def.skills.map((s) => s.id), ULT]) {
    const want = id === ULT ? rankOf(build.ranks, id) : (build.ranks[id] ?? 0);
    for (let r = id === ULT ? 2 : 1; r <= want; r++) {
      if (rankUpBlock(def, level, out, id)) break;
      out[id] = r;
    }
  }
  return out;
}

/** 手動配點時還能花的點數（自動配點或沒有能升的技能時回傳 0，地圖英雄鈕上的紅點用） */
export function pointsToSpend(def: HeroDef, level: number, build?: HeroBuild): number {
  if (!build?.ranks) return 0;
  const ranks = resolveRanks(def, level, build);
  const ids = [...def.skills.map((s) => s.id), ULT];
  if (!ids.some((id) => !rankUpBlock(def, level, ranks, id))) return 0;
  return skillPoints(level) - spentPoints(def, ranks);
}

/** 這件裝備能不能用在這位英雄身上 */
export function heroGear(def: HeroDef, build?: HeroBuild): GearDef | undefined {
  const g = gearById(build?.gear);
  return g && g.hero === def.id ? g : undefined;
}

export const ALL_GEAR: GearDef[] = Object.values(HERO_GEAR).flat();
