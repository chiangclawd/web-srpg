// 雲端同步的合併規則（純函式，不碰瀏覽器，tests/starfall/cloud.test.ts 直接測）。
// 同步的是「進度」：每關的星數、看過的教學、機庫的改造，以及打到一半的那場戰鬥。
// 音量、文字大小、語言這些是每台裝置自己的設定，不同步。
import { FRAMES, frameUpgrades, partsEarned, partsSpent } from '../data/upgrades';
import type { Loadout } from '../data/upgrades';

export interface Progress {
  stars: Record<string, number>;
  tips: string[];
  upgrades: Loadout;
  /** 這份進度最後一次改動的時間（毫秒）。只用來決定機庫的改造聽誰的 */
  at: number;
}

/** 打到一半的戰鬥：json 是 suspend.ts 存的那串字；null = 沒有（打完了或重新出擊了）。at = 最後一次存或清掉的時間 */
export interface SuspendRaw {
  json: string | null;
  at: number;
}

/** 雲端上每個帳號一份的文件 */
export interface CloudDoc extends Progress {
  v: 1;
  battle: string | null;
  battleAt: number;
}

const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** 把來路不明的資料（雲端文件、舊存檔）整理成可信的進度 */
export function cleanProgress(raw: unknown): Progress {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const stars: Record<string, number> = {};
  if (r.stars && typeof r.stars === 'object' && !Array.isArray(r.stars)) {
    for (const [k, v] of Object.entries(r.stars as Record<string, unknown>)) {
      const n = Math.max(0, Math.min(3, Math.floor(num(v))));
      if (n > 0 && k.length <= 24) stars[k] = n;
    }
  }
  const tips = Array.isArray(r.tips) ? [...new Set(r.tips.filter((t): t is string => typeof t === 'string' && t.length <= 40))].slice(0, 200) : [];
  const upgrades: Loadout = {};
  const up = r.upgrades && typeof r.upgrades === 'object' && !Array.isArray(r.upgrades) ? (r.upgrades as Loadout) : {};
  for (const f of FRAMES) {
    const u = frameUpgrades(up, f);
    if (u.plating || u.firepower || u.mods.length) upgrades[f] = u;
  }
  return { stars, tips, upgrades, at: Math.max(0, num(r.at)) };
}

/** 內容一樣就回傳一樣的字串（鍵排過序），用來比較兩份進度有沒有差 */
export function progressKey(p: Progress): string {
  const stars = Object.keys(p.stars)
    .sort()
    .map((k) => `${k}:${p.stars[k]}`);
  const ups = FRAMES.map((f) => {
    const u = frameUpgrades(p.upgrades, f);
    return `${u.plating}${u.firepower}${[...u.mods].sort().join('+')}`;
  });
  return JSON.stringify([stars, [...p.tips].sort(), ups]);
}

/**
 * 兩台裝置的進度合起來：
 * - 星數：每關取比較多的（拿過的星不會不見）
 * - 教學提示：看過的聯集
 * - 機庫的改造：整套用比較晚改動的那一邊（改造可以退還重配，逐項合併會把退掉的又加回來）。
 *   星數只會變多，所以任一邊原本買得起的，合併後一定還買得起；萬一對不上就用另一邊，再不行就清空（零件全數退還）。
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const stars: Record<string, number> = { ...a.stars };
  for (const [k, v] of Object.entries(b.stars)) stars[k] = Math.max(stars[k] ?? 0, v);
  const tips = [...new Set([...a.tips, ...b.tips])];
  const [newer, older] = a.at >= b.at ? [a, b] : [b, a];
  const budget = partsEarned(stars);
  const fits = (l: Loadout): boolean => partsSpent(l) <= budget;
  const upgrades = fits(newer.upgrades) ? newer.upgrades : fits(older.upgrades) ? older.upgrades : {};
  return { stars, tips, upgrades: JSON.parse(JSON.stringify(upgrades)) as Loadout, at: Math.max(a.at, b.at) };
}

/** 打到一半的戰鬥：比較晚存（或比較晚清掉）的那一邊算數 */
export function mergeSuspend(a: SuspendRaw, b: SuspendRaw): SuspendRaw {
  return b.at > a.at ? b : a;
}

export function cleanDoc(raw: unknown): CloudDoc {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const battle = typeof r.battle === 'string' && r.battle.length <= 200_000 ? r.battle : null;
  return { v: 1, ...cleanProgress(r), battle, battleAt: Math.max(0, num(r.battleAt)) };
}
