import type { L10n } from '../sim/defs';
import { Rng } from '../sim/math';
import { jaOf } from '../i18n';

/**
 * 每日任務：每天從任務池抽 3 個（依日期決定，同一天不會變），
 * 戰鬥結束時累計進度，完成後在地圖上的任務面板領寶石。
 */

/** 一場戰鬥可累計到任務的數字 */
export interface QuestTally {
  kills: number;
  wins: number;
  threeStars: number;
  towers: number;
  meteorKills: number;
  earlyCalls: number;
  bosses: number;
  hazardKills: number;
  daily: number;
  gold: number;
  challenges: number;
}

export type QuestId = keyof QuestTally;

export interface QuestDef {
  id: QuestId;
  /** {n} 會換成目標數字 */
  text: L10n;
  /** 兩種難度的目標與獎勵（新手只抽第一種） */
  targets: number[];
  rewards: number[];
  /** 要先通關幾個戰役關卡才會抽到（首領、地圖機關、每日挑戰都要等開放） */
  minCleared?: number;
}

export const QUESTS: QuestDef[] = [
  { id: 'kills', text: { zh: '擊敗 {n} 名敵人', en: 'Defeat {n} enemies' }, targets: [150, 300], rewards: [5, 8] },
  { id: 'wins', text: { zh: '贏得 {n} 場戰鬥', en: 'Win {n} battles' }, targets: [2, 3], rewards: [6, 9] },
  { id: 'threeStars', text: { zh: '以三星通關 {n} 次', en: 'Win with 3 stars {n} times' }, targets: [1, 2], rewards: [6, 10] },
  { id: 'towers', text: { zh: '建造 {n} 座防禦塔', en: 'Build {n} towers' }, targets: [15, 25], rewards: [5, 7] },
  { id: 'meteorKills', text: { zh: '用流星火雨擊倒 {n} 名敵人', en: 'Defeat {n} enemies with Meteor Rain' }, targets: [12, 25], rewards: [5, 8] },
  { id: 'earlyCalls', text: { zh: '提前呼叫 {n} 次波次', en: 'Call {n} waves early' }, targets: [5, 10], rewards: [5, 7] },
  { id: 'bosses', text: { zh: '擊敗 {n} 名首領', en: 'Defeat {n} bosses' }, targets: [1, 2], rewards: [8, 12], minCleared: 4 },
  { id: 'hazardKills', text: { zh: '用地圖機關擊倒 {n} 名敵人', en: 'Take down {n} enemies with map traps' }, targets: [5, 10], rewards: [6, 9], minCleared: 3 },
  { id: 'daily', text: { zh: '通關今天的每日挑戰', en: "Clear today's Daily Challenge" }, targets: [1], rewards: [8], minCleared: 3 },
  { id: 'gold', text: { zh: '在戰鬥中賺取 {n} 金幣', en: 'Earn {n} gold in battle' }, targets: [1200, 2500], rewards: [5, 8] },
  { id: 'challenges', text: { zh: '通關一次英雄挑戰或鋼鐵挑戰', en: 'Clear a Heroic or Iron Challenge' }, targets: [1], rewards: [10], minCleared: 4 },
];

export interface QuestState {
  id: QuestId;
  n: number;
  reward: number;
  cur: number;
  claimed: boolean;
}

export interface QuestDay {
  day: string;
  list: QuestState[];
}

export const QUESTS_PER_DAY = 3;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 某一天的任務（cleared：已通關的戰役關卡數，決定能抽哪些任務與難度） */
export function questsFor(day: string, cleared: number): QuestState[] {
  const rng = new Rng(hash('kb-quests-' + day));
  const pool = QUESTS.filter((q) => cleared >= (q.minCleared ?? 0));
  const picked: QuestDef[] = [];
  while (picked.length < QUESTS_PER_DAY && pool.length) picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return picked.map((q) => {
    const tier = cleared >= 3 && q.targets.length > 1 && rng.next() < 0.5 ? 1 : 0;
    return { id: q.id, n: q.targets[tier], reward: q.rewards[tier], cur: 0, claimed: false };
  });
}

/** 換日就重抽（同一天沿用存檔裡的進度） */
export function ensureQuests(cur: QuestDay | undefined, day: string, cleared: number): QuestDay {
  return cur?.day === day ? cur : { day, list: questsFor(day, cleared) };
}

/** 把一場戰鬥的數字加進任務；回傳這次剛完成的任務 */
export function addQuestProgress(q: QuestDay, tally: QuestTally): QuestState[] {
  const done: QuestState[] = [];
  for (const s of q.list) {
    if (s.claimed || s.cur >= s.n) continue;
    s.cur = Math.min(s.n, s.cur + (tally[s.id] ?? 0));
    if (s.cur >= s.n) done.push(s);
  }
  return done;
}

export function questText(s: QuestState): L10n {
  const def = QUESTS.find((q) => q.id === s.id)!;
  const n = String(s.n);
  return { zh: def.text.zh.replace('{n}', n), en: def.text.en.replace('{n}', n), ja: jaOf(def.text)?.replace('{n}', n) };
}

/** 可以領獎的任務數（地圖按鈕上的紅點） */
export function claimable(q: QuestDay | undefined): number {
  return q ? q.list.filter((s) => !s.claimed && s.cur >= s.n).length : 0;
}
