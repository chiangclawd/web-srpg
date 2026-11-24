import type { Loadout } from './data/upgrades';
import { cleanProgress, progressKey } from './cloud/merge';
import type { Progress } from './cloud/merge';

export const SAVE_KEY = 'starfall_save_v1';

export interface SaveData {
  lang?: 'zh' | 'en';
  sfx: number;
  /** 每關拿到的星數 */
  stars: Record<string, number>;
  /** 看過的教學提示 */
  tips: string[];
  /** 戰鬥演出速度 */
  fast: boolean;
  /** 音樂音量（0 = 關） */
  music: number;
  /** 輕鬆難度：敵方傷害與耐久降低 */
  easy: boolean;
  /** 機庫的改造（零件餘額不存，從星數和這裡算出來） */
  upgrades: Loadout;
  /** 技能特寫：用技能時劃過畫面的頭像橫帶 */
  cutIn: boolean;
  /** 文字大小的倍率（1、1.15、1.3；見 config.ts 的 TEXT_SCALES） */
  textScale: number;
  /** 色盲配色：敵方從紅色改成橘黃色，耐久數字前面多一個 ▼ */
  colorBlind: boolean;
  /** 進度（星數、教學、改造）最後一次改動的時間。雲端同步用來決定改造聽哪台裝置的 */
  at?: number;
}

let cache: SaveData | null = null;
/** 上次寫進去時的進度長什麼樣（用來判斷這次存檔是進度變了，還是只改了設定） */
let lastKey: string | null = null;
const listeners = new Set<() => void>();

export function save(): SaveData {
  if (cache) return cache;
  let raw: Partial<SaveData> = {};
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') as Partial<SaveData>;
  } catch {
    // 存檔壞掉或瀏覽器不給用：從頭開始
  }
  cache = { sfx: 0.7, stars: {}, tips: [], fast: false, music: 0.5, easy: false, upgrades: {}, cutIn: true, textScale: 1, colorBlind: false, ...raw };
  // 舊存檔或壞掉的欄位：補成空的
  if (!cache.upgrades || typeof cache.upgrades !== 'object' || Array.isArray(cache.upgrades)) cache.upgrades = {};
  if (!cache.stars || typeof cache.stars !== 'object' || Array.isArray(cache.stars)) cache.stars = {};
  lastKey = progressKey(cleanProgress(cache));
  return cache;
}

export function persist(): void {
  const sv = save();
  const key = progressKey(cleanProgress(sv));
  const moved = key !== lastKey;
  if (moved) sv.at = Date.now();
  lastKey = key;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(sv));
  } catch {
    // 無痕模式之類寫不進去：這次遊玩照常，只是不會留下紀錄
  }
  if (moved) for (const cb of [...listeners]) cb();
}

/** 進度（不含設定）有變動時通知。雲端同步用 */
export function onSaveChanged(cb: () => void): void {
  listeners.add(cb);
}

/** 這台裝置現在的進度（整理過的） */
export const localProgress = (): Progress => cleanProgress(save());

/** 把同步合併後的進度寫回本機（設定不動，時間照合併結果的，不算一次新的改動） */
export function applyProgress(p: Progress): void {
  const sv = save();
  sv.stars = p.stars;
  sv.tips = p.tips;
  sv.upgrades = p.upgrades;
  sv.at = p.at;
  lastKey = progressKey(cleanProgress(sv));
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(sv));
  } catch {
    // 寫不進去：這次遊玩先用記憶體裡的
  }
}
