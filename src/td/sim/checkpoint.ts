import { TOWERS } from '../data/towers';
import type { LevelMode, TowerType } from './defs';
import type { Difficulty, World } from './World';

/**
 * 戰鬥存檔點：每次開波前記下塔、金幣、生命、冷卻等狀態。
 * 手機瀏覽器切到背景常會被系統重新整理，回來時可以從最近一波繼續，
 * 不必整關重打。場上還活著的敵人不記錄（從該波重新開始）。
 */
export interface Checkpoint {
  v: 1;
  levelId: string;
  mode: LevelMode;
  difficulty: Difficulty;
  heroId: string | null;
  dailyKey?: string;
  savedAt: number;
  /** 已開始的波數（繼續時等玩家呼叫第 waveIndex + 2 波） */
  waveIndex: number;
  gold: number;
  lives: number;
  towers: {
    spot: number;
    type: TowerType;
    level: number;
    branch: number;
    skills: Record<string, number>;
    rally: [number, number] | null;
    invested: number;
    dmg: number;
    kills: number;
  }[];
  hero: { xp: number; home: [number, number] } | null;
  meteorCd: number;
  reinfCd: number;
  heroUltCd: number;
  hazards: number[];
  stats: World['stats'];
}

export function snapshot(w: World, meta: { levelId: string; mode: LevelMode; difficulty: Difficulty; dailyKey?: string }, waveIndex: number): Checkpoint {
  const hr = w.hero?.hero;
  return {
    v: 1,
    ...meta,
    heroId: hr?.def.id ?? null,
    savedAt: Date.now(),
    waveIndex,
    gold: w.gold,
    lives: w.lives,
    towers: w.towers.map((t) => ({
      spot: t.spot,
      type: t.type,
      level: t.level,
      branch: t.level >= 4 ? TOWERS[t.type].branches.indexOf(t.def) : -1,
      skills: { ...t.skills },
      rally: t.type === 'barracks' ? [t.rallyX, t.rallyY] : null,
      invested: t.invested,
      dmg: t.dmgDealt,
      kills: t.kills,
    })),
    hero: hr && w.hero ? { xp: hr.xp, home: [w.hero.homeX, w.hero.homeY] } : null,
    meteorCd: w.meteorCd,
    reinfCd: w.reinfCd,
    heroUltCd: w.heroUltCd,
    hazards: w.hazards.map((h) => h.cd),
    stats: { ...w.stats, bossesKilled: [...w.stats.bossesKilled] },
  };
}

/** 把存檔點套回剛建立的 World（英雄經驗由建立 World 時帶入） */
export function restore(w: World, cp: Checkpoint): void {
  w.gold = 1e9;
  for (const s of cp.towers) {
    const t = w.build(s.spot, s.type);
    if (!t) continue;
    for (let lv = 1; lv < Math.min(s.level, 3); lv++) w.upgrade(t);
    if (s.level >= 4 && s.branch >= 0) w.chooseBranch(t, s.branch);
    for (const [id, n] of Object.entries(s.skills)) for (let k = 0; k < n; k++) w.buySkill(t, id);
    if (s.rally) w.setRally(t, s.rally[0], s.rally[1]);
    t.buildUntil = 0;
    t.cd = 0.5;
    t.invested = s.invested;
    t.dmgDealt = s.dmg;
    t.kills = s.kills;
  }
  w.gold = cp.gold;
  w.lives = cp.lives;
  w.waveIndex = cp.waveIndex;
  w.waveState = 'waiting';
  w.meteorCd = cp.meteorCd;
  w.reinfCd = cp.reinfCd;
  w.heroUltCd = cp.heroUltCd;
  cp.hazards.forEach((cd, i) => {
    if (w.hazards[i]) w.hazards[i].cd = cd;
  });
  w.stats = { ...cp.stats, bossesKilled: [...cp.stats.bossesKilled] };
  if (cp.hero && w.hero) w.moveHero(cp.hero.home[0], cp.hero.home[1]);
}

const KEY = 'kb_td_checkpoint_v1';
/** 超過這麼久的存檔點不再提示（毫秒） */
const MAX_AGE = 3 * 24 * 3600 * 1000;

export function saveCheckpoint(cp: Checkpoint): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cp));
  } catch {
    /* 無痕模式等存不了就算了 */
  }
}

export function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cp = JSON.parse(raw) as Checkpoint;
    if (cp.v !== 1 || Date.now() - cp.savedAt > MAX_AGE) return null;
    return cp;
  } catch {
    return null;
  }
}

export function clearCheckpoint(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
