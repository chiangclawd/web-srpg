import type { L10n, LevelMode } from '../sim/defs';
import type { Difficulty } from '../sim/World';
import type { SaveData } from '../save';
import { LEVELS } from './levels';
import { HERO_MAX_LEVEL, heroLevelForXp } from './heroes';
import { EGG_GOAL } from './eggs';

export interface AchievementDef {
  id: string;
  name: L10n;
  desc: L10n;
  icon: string;
}

/** 一場關卡結束時的摘要（成就判定用） */
export interface LevelOutcome {
  levelId: string;
  mode: LevelMode;
  difficulty: Difficulty;
  victory: boolean;
  stars: number;
  lives: number;
  maxLives: number;
  towersAtEnd: number;
  maxTowerLevel: number;
  skillMaxed: boolean;
  earlyCalls: number;
  meteorKills: number;
  sheep: number;
  /** 單次地圖機關擊倒數最高 */
  bestHazard?: number;
  heroLevel: number;
  bossesKilled: string[];
  /** 到達的波數（無盡模式用） */
  wave: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', name: { zh: '初次守城', en: 'First Defense' }, desc: { zh: '贏得第一場勝利', en: 'Win your first battle' }, icon: 'ic_shield' },
  { id: 'three_stars', name: { zh: '完美防線', en: 'Flawless Line' }, desc: { zh: '任一關取得三星', en: 'Earn 3 stars on any level' }, icon: 'ic_star' },
  { id: 'campaign_clear', name: { zh: '王國救星', en: 'Savior of the Realm' }, desc: { zh: '擊敗教主・黯，完成戰役', en: 'Defeat Umbra and finish the campaign' }, icon: 'ic_crown' },
  { id: 'all_stars', name: { zh: '星光滿盈', en: 'Constellation' }, desc: { zh: '所有戰役關卡取得三星', en: '3 stars on every campaign level' }, icon: 'ic_star' },
  { id: 'perfect_veteran', name: { zh: '鐵壁老兵', en: 'Iron Veteran' }, desc: { zh: '以老兵難度無損通關一關', en: 'Win a Veteran level without losing a life' }, icon: 'ic_heart' },
  { id: 'boss_morden', name: { zh: '先鋒殞落', en: 'Vanguard Fallen' }, desc: { zh: '擊敗蠻族先鋒莫登', en: 'Defeat Morden the Vanguard' }, icon: 'ic_skull' },
  { id: 'boss_selene', name: { zh: '融冰', en: 'Thaw' }, desc: { zh: '擊敗冰霜巫女瑟琳', en: 'Defeat Selene the Frostwitch' }, icon: 'ic_skull' },
  { id: 'boss_carl', name: { zh: '叛將伏誅', en: 'Traitor’s End' }, desc: { zh: '擊敗墮落將軍卡爾', en: 'Defeat Carl the Fallen' }, icon: 'ic_skull' },
  { id: 'boss_bishop', name: { zh: '破除聖光', en: 'Lights Out' }, desc: { zh: '擊敗黑暗主教', en: 'Defeat the Dark Bishop' }, icon: 'ic_skull' },
  { id: 'boss_rin', name: { zh: '血月終結', en: 'Blood Moon Set' }, desc: { zh: '擊敗副教主凜', en: 'Defeat Rin, the Vice Hierarch' }, icon: 'ic_skull' },
  { id: 'boss_wyrm', name: { zh: '沙海平定', en: 'Sands Stilled' }, desc: { zh: '擊敗沙暴巨蟲', en: 'Defeat the Sandstorm Wyrm' }, icon: 'ic_skull' },
  { id: 'boss_giant', name: { zh: '冰河崩塌', en: 'Glacier Breaker' }, desc: { zh: '擊敗冰霜巨人・約頓', en: 'Defeat Jotun the Frost Giant' }, icon: 'ic_skull' },
  { id: 'boss_ignis', name: { zh: '撲滅烈焰', en: 'Fire Fighter' }, desc: { zh: '擊敗炎魔・伊格尼斯', en: 'Defeat Ignis the Fire Lord' }, icon: 'ic_skull' },
  { id: 'boss_leviathan', name: { zh: '平息怒海', en: 'Calm Waters' }, desc: { zh: '擊敗深淵利維坦', en: 'Defeat the Abyssal Leviathan' }, icon: 'ic_skull' },
  { id: 'side_clear', name: { zh: '外傳完結', en: 'Side Story Complete' }, desc: { zh: '通關外傳終章「熔岩火山口」', en: 'Clear the side-story finale, Ember Crater' }, icon: 'ic_crown' },
  { id: 'heroic_first', name: { zh: '英雄本色', en: 'True Hero' }, desc: { zh: '完成任一英雄挑戰', en: 'Complete any Heroic challenge' }, icon: 'ic_crown' },
  { id: 'iron_first', name: { zh: '鋼鐵意志', en: 'Iron Will' }, desc: { zh: '完成任一鋼鐵挑戰', en: 'Complete any Iron challenge' }, icon: 'ic_shield' },
  { id: 'heroic_all', name: { zh: '傳奇英雄', en: 'Legend' }, desc: { zh: '完成所有英雄挑戰', en: 'Complete every Heroic challenge' }, icon: 'ic_crown' },
  { id: 'iron_all', name: { zh: '不破之盾', en: 'Unbreakable' }, desc: { zh: '完成所有鋼鐵挑戰', en: 'Complete every Iron challenge' }, icon: 'ic_shield' },
  { id: 'kills_1000', name: { zh: '千人斬', en: 'Thousand Cuts' }, desc: { zh: '累計擊敗 1000 名敵人', en: 'Defeat 1,000 enemies in total' }, icon: 'ic_reinforce' },
  { id: 'kills_10000', name: { zh: '萬軍莫敵', en: 'Army of One' }, desc: { zh: '累計擊敗 10000 名敵人', en: 'Defeat 10,000 enemies in total' }, icon: 'ic_reinforce' },
  { id: 'builder', name: { zh: '築城大師', en: 'Master Builder' }, desc: { zh: '累計建造 100 座塔', en: 'Build 100 towers in total' }, icon: 'ic_hammer' },
  { id: 'elite_tower', name: { zh: '精銳之塔', en: 'Elite Tower' }, desc: { zh: '將一座塔特化為第 4 級', en: 'Specialize a tower to level 4' }, icon: 'ic_upgrade' },
  { id: 'skill_master', name: { zh: '登峰造極', en: 'Mastery' }, desc: { zh: '將一項塔技能升到最高級', en: 'Max out a tower skill' }, icon: 'sk_holystrike' },
  { id: 'early_bird', name: { zh: '迫不及待', en: 'Eager' }, desc: { zh: '一關內提前呼叫 5 次波次', en: 'Call 5 waves early in one level' }, icon: 'ic_fast' },
  { id: 'meteor_master', name: { zh: '天降神罰', en: 'Skyfall' }, desc: { zh: '一關內用流星火雨擊殺 15 名敵人', en: 'Kill 15 enemies with Meteor Rain in one level' }, icon: 'ic_meteor' },
  { id: 'shepherd', name: { zh: '牧羊人', en: 'Shepherd' }, desc: { zh: '一關內把 5 名敵人變成綿羊', en: 'Polymorph 5 enemies in one level' }, icon: 'sk_polymorph' },
  { id: 'minimalist', name: { zh: '以少勝多', en: 'Minimalist' }, desc: { zh: '第 3 關以後只用 6 座以內的塔通關', en: 'Win level 3 or later with 6 towers or fewer' }, icon: 'ic_check' },
  { id: 'endless_15', name: { zh: '堅守不退', en: 'Holdout' }, desc: { zh: '無盡模式撐到第 15 波', en: 'Reach wave 15 in Endless mode' }, icon: 'ic_skull' },
  { id: 'endless_30', name: { zh: '無盡守望', en: 'Eternal Watch' }, desc: { zh: '無盡模式撐到第 30 波', en: 'Reach wave 30 in Endless mode' }, icon: 'ic_crown' },
  { id: 'daily_first', name: { zh: '每日一戰', en: 'Daily Duty' }, desc: { zh: '完成一次每日挑戰', en: 'Complete a daily challenge' }, icon: 'ic_star' },
  { id: 'daily_7', name: { zh: '風雨無阻', en: 'Come Rain or Shine' }, desc: { zh: '累計完成 7 天每日挑戰', en: 'Complete 7 daily challenges' }, icon: 'ic_crown' },
  { id: 'boss_rush', name: { zh: '首領獵人', en: 'Boss Hunter' }, desc: { zh: '在任一張地圖通關首領連戰', en: 'Clear Boss Rush on any map' }, icon: 'ic_skull' },
  { id: 'landslide', name: { zh: '山崩地裂', en: 'Landslide' }, desc: { zh: '地圖機關一次擊倒 5 名敵人', en: 'Take down 5 enemies with one map trap' }, icon: 'ic_meteor' },
  { id: 'hero_max', name: { zh: '傳奇之路', en: 'Legendary' }, desc: { zh: '任一英雄達到 10 級', en: 'Raise any hero to level 10' }, icon: 'ic_crown' },
  { id: 'elite_50', name: { zh: '精英獵手', en: 'Elite Hunter' }, desc: { zh: '累計擊敗 50 名精英敵人', en: 'Defeat 50 elite enemies' }, icon: 'ic_skull' },
  { id: 'curious', name: { zh: '好奇寶寶', en: 'Curious Mind' }, desc: { zh: '點點戰場上的東西，找到 15 個彩蛋', en: 'Tap around the battlefields to find 15 eggs' }, icon: 'ic_star' },
  { id: 'login_7', name: { zh: '忠誠守衛', en: 'Loyal Guardian' }, desc: { zh: '連續 7 天領取每日登入獎勵', en: 'Claim the daily reward 7 days in a row' }, icon: 'ic_gem' },
];

const BOSS_ACH: Record<string, string> = {
  morden: 'boss_morden',
  selene: 'boss_selene',
  carl: 'boss_carl',
  high_priest: 'boss_bishop',
  sub_priest: 'boss_rin',
  wyrm: 'boss_wyrm',
  frost_giant: 'boss_giant',
  fire_lord: 'boss_ignis',
  leviathan: 'boss_leviathan',
};

/** 依本場結果與累計存檔判定新解鎖的成就（會寫入 save.achievements） */
export function evaluateAchievements(o: LevelOutcome, sv: SaveData): string[] {
  const got = new Set(sv.achievements);
  const fresh: string[] = [];
  const unlock = (id: string) => {
    if (!got.has(id)) {
      got.add(id);
      fresh.push(id);
    }
  };
  if (o.victory) {
    unlock('first_win');
    if (o.mode === 'campaign' && o.stars >= 3) unlock('three_stars');
    if (o.levelId === 'l12' && o.mode === 'campaign') unlock('campaign_clear');
    if (o.levelId === 'l16' && o.mode === 'campaign') unlock('side_clear');
    if (o.difficulty === 'veteran' && o.lives >= o.maxLives) unlock('perfect_veteran');
    if (o.mode === 'heroic') unlock('heroic_first');
    if (o.mode === 'iron') unlock('iron_first');
    const idx = LEVELS.findIndex((l) => l.id === o.levelId);
    if (o.mode === 'campaign' && idx >= 2 && o.towersAtEnd <= 6) unlock('minimalist');
  }
  if (LEVELS.every((l) => (sv.stars[l.id] ?? 0) >= 3)) unlock('all_stars');
  if (LEVELS.every((l) => sv.challenges[l.id]?.heroic)) unlock('heroic_all');
  if (LEVELS.every((l) => sv.challenges[l.id]?.iron)) unlock('iron_all');
  for (const b of o.bossesKilled) if (BOSS_ACH[b]) unlock(BOSS_ACH[b]);
  if (sv.stats.kills >= 1000) unlock('kills_1000');
  if (sv.stats.kills >= 10000) unlock('kills_10000');
  if ((sv.stats.towers ?? 0) >= 100) unlock('builder');
  if (o.maxTowerLevel >= 4) unlock('elite_tower');
  if (o.skillMaxed) unlock('skill_master');
  if (o.earlyCalls >= 5) unlock('early_bird');
  if (o.meteorKills >= 15) unlock('meteor_master');
  if (o.sheep >= 5) unlock('shepherd');
  if ((o.bestHazard ?? 0) >= 5) unlock('landslide');
  if (o.heroLevel >= 10) unlock('hero_max');
  if (o.mode === 'endless' && o.wave >= 15) unlock('endless_15');
  if (o.mode === 'daily' && o.victory) unlock('daily_first');
  if (o.mode === 'bossrush' && o.victory) unlock('boss_rush');
  if (Object.values(sv.daily ?? {}).filter((n) => n > 0).length >= 7) unlock('daily_7');
  if (o.mode === 'endless' && o.wave >= 30) unlock('endless_30');
  if ((sv.eggs?.length ?? 0) >= EGG_GOAL) unlock('curious');
  if ((sv.stats.elites ?? 0) >= 50) unlock('elite_50');
  sv.achievements = [...got];
  return fresh;
}

/** 累積型成就的目前進度（成就畫面顯示進度條；不是累積型的回傳 null） */
export function achievementProgress(id: string, sv: SaveData): { cur: number; max: number } | null {
  const bestEndless = Math.max(0, ...Object.values(sv.endless ?? {}));
  switch (id) {
    case 'kills_1000':
      return { cur: sv.stats.kills, max: 1000 };
    case 'kills_10000':
      return { cur: sv.stats.kills, max: 10000 };
    case 'builder':
      return { cur: sv.stats.towers ?? 0, max: 100 };
    case 'all_stars':
      return { cur: LEVELS.filter((l) => (sv.stars[l.id] ?? 0) >= 3).length, max: LEVELS.length };
    case 'heroic_all':
      return { cur: LEVELS.filter((l) => sv.challenges[l.id]?.heroic).length, max: LEVELS.length };
    case 'iron_all':
      return { cur: LEVELS.filter((l) => sv.challenges[l.id]?.iron).length, max: LEVELS.length };
    case 'daily_7':
      return { cur: Object.values(sv.daily ?? {}).filter((n) => n > 0).length, max: 7 };
    case 'endless_15':
      return { cur: bestEndless, max: 15 };
    case 'endless_30':
      return { cur: bestEndless, max: 30 };
    case 'login_7':
      return { cur: sv.login?.streak ?? 0, max: 7 };
    case 'curious':
      return { cur: sv.eggs?.length ?? 0, max: EGG_GOAL };
    case 'elite_50':
      return { cur: sv.stats.elites ?? 0, max: 50 };
    case 'hero_max':
      return { cur: Math.max(1, ...Object.values(sv.heroes).map((h) => heroLevelForXp(h.xp))), max: HERO_MAX_LEVEL };
    default:
      return null;
  }
}
