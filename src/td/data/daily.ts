import type { L10n, LevelDef, LevelRules, TowerType } from '../sim/defs';
import { Rng } from '../sim/math';
import { LEVELS } from './levels';

/**
 * 每日挑戰：以日期為種子，所有玩家同一天拿到同一關＋同兩個修正，方便朋友之間比成績。
 * 關卡池排除最難的終章（12、14）與教學關，避免修正疊上去變成無解；
 * 玩家要先通過當天那一關才能挑戰（不劇透外傳關、也不會讓新手卡在打不過的關）。
 */
export const DAILY_POOL = ['l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l13'];

export type DailyModId = 'swift' | 'tough' | 'armored' | 'poor' | 'fragile' | 'noSpells' | 'limited' | 'pricey' | 'rich' | 'bounty';

export interface DailyMod {
  id: DailyModId;
  name: L10n;
  desc: L10n;
  /** 對玩家有利的修正（顯示成綠色） */
  good?: boolean;
}

export const DAILY_MODS: Record<DailyModId, DailyMod> = {
  swift: { id: 'swift', name: { zh: '急行軍', en: 'Forced March' }, desc: { zh: '敵人移動速度 +20%', en: 'Enemies move 20% faster' } },
  tough: { id: 'tough', name: { zh: '精銳部隊', en: 'Veterans' }, desc: { zh: '敵人血量 +25%', en: 'Enemies have 25% more HP' } },
  armored: { id: 'armored', name: { zh: '重裝上陣', en: 'Heavy Plate' }, desc: { zh: '敵人護甲 +15%', en: 'Enemies gain 15% armor' } },
  poor: { id: 'poor', name: { zh: '國庫空虛', en: 'Empty Coffers' }, desc: { zh: '起始金幣 -25%', en: 'Start with 25% less gold' } },
  fragile: { id: 'fragile', name: { zh: '最後防線', en: 'Last Stand' }, desc: { zh: '只有 5 條命', en: 'Only 5 lives' } },
  noSpells: { id: 'noSpells', name: { zh: '魔力封印', en: 'Sealed Magic' }, desc: { zh: '禁用法術與道具', en: 'No spells or items' } },
  limited: { id: 'limited', name: { zh: '補給短缺', en: 'Short Supplies' }, desc: { zh: '只能建造兩種塔：{0}', en: 'Only two tower types: {0}' } },
  pricey: { id: 'pricey', name: { zh: '物價飛漲', en: 'Price Hike' }, desc: { zh: '建塔與升級費用 +15%', en: 'Towers and upgrades cost 15% more' } },
  rich: { id: 'rich', name: { zh: '戰爭基金', en: 'War Chest' }, desc: { zh: '起始金幣 +40%', en: 'Start with 40% more gold' }, good: true },
  bounty: { id: 'bounty', name: { zh: '懸賞令', en: 'Bounty Hunt' }, desc: { zh: '擊殺賞金 +30%', en: 'Kills pay 30% more gold' }, good: true },
};

const HARSH: DailyModId[] = ['swift', 'tough', 'armored', 'poor', 'fragile', 'noSpells', 'limited', 'pricey'];
const GOOD: DailyModId[] = ['rich', 'bounty'];
const ANY: DailyModId[] = [...HARSH, ...GOOD, ...GOOD];
/** 後期關卡本身就難：第二個修正一定是有利的，避免兩個嚴苛修正疊成無解 */
const LATE = new Set(['l7', 'l8', 'l9', 'l10', 'l13']);
const TOWER_PAIRS: TowerType[][] = [
  ['archer', 'barracks'],
  ['mage', 'barracks'],
  ['archer', 'mage'],
  ['mage', 'artillery'],
];

/** 本地日期字串 YYYY-MM-DD（以玩家所在時區換日） */
export function dailyKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DailySpec {
  key: string;
  levelId: string;
  mods: DailyModId[];
  towers: TowerType[];
}

/** 某一天的挑戰內容：一個嚴苛修正＋一個任意修正（不重複；後期關卡第二個必為有利） */
export function dailySpec(key: string): DailySpec {
  const rng = new Rng(hash('kb-daily-' + key));
  const levelId = DAILY_POOL[Math.floor(rng.next() * DAILY_POOL.length)];
  const a = HARSH[Math.floor(rng.next() * HARSH.length)];
  const pool = LATE.has(levelId) ? GOOD : ANY;
  let b = pool[Math.floor(rng.next() * pool.length)];
  while (b === a) b = pool[Math.floor(rng.next() * pool.length)];
  const towers = TOWER_PAIRS[Math.floor(rng.next() * TOWER_PAIRS.length)];
  return { key, levelId, mods: [a, b], towers };
}

/** 套用修正後的關卡 */
export function dailyLevel(level: LevelDef, key: string): LevelDef {
  return applyDaily(level, dailySpec(key));
}

/** 把一組修正套到關卡上（平衡工具也用它測任意組合） */
export function applyDaily(level: LevelDef, spec: DailySpec): LevelDef {
  const rules: LevelRules = { mode: 'daily' };
  let startGold = level.startGold;
  let lives = level.lives;
  for (const m of spec.mods) {
    switch (m) {
      case 'swift':
        rules.enemySpeedMul = 1.2;
        break;
      case 'tough':
        rules.enemyHpMul = 1.25;
        break;
      case 'armored':
        rules.enemyArmorAdd = 0.15;
        break;
      case 'poor':
        startGold = Math.round(startGold * 0.75);
        break;
      case 'fragile':
        lives = 5;
        break;
      case 'noSpells':
        rules.noSpells = true;
        break;
      case 'limited':
        rules.allowed = spec.towers;
        break;
      case 'pricey':
        rules.towerCostMul = 1.15;
        break;
      case 'rich':
        startGold = Math.round(startGold * 1.4);
        break;
      case 'bounty':
        rules.bountyMul = 1.3;
        break;
    }
  }
  return { ...level, startGold, lives, intro: [], tutorial: false, rules };
}

export function dailyBaseLevel(key: string): LevelDef {
  const id = dailySpec(key).levelId;
  return LEVELS.find((l) => l.id === id)!;
}
