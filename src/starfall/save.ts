import type { Loadout } from './data/upgrades';

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
}

let cache: SaveData | null = null;

export function save(): SaveData {
  if (cache) return cache;
  let raw: Partial<SaveData> = {};
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') as Partial<SaveData>;
  } catch {
    // 存檔壞掉或瀏覽器不給用：從頭開始
  }
  cache = { sfx: 0.7, stars: {}, tips: [], fast: false, music: 0.5, easy: false, upgrades: {}, ...raw };
  // 舊存檔或壞掉的欄位：補成空的
  if (!cache.upgrades || typeof cache.upgrades !== 'object') cache.upgrades = {};
  if (!cache.stars || typeof cache.stars !== 'object') cache.stars = {};
  return cache;
}

export function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save()));
  } catch {
    // 無痕模式之類寫不進去：這次遊玩照常，只是不會留下紀錄
  }
}
