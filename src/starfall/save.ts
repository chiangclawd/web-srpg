// 設定和通關進度。設定（音量、語言、文字大小…）是這台裝置的，只有一份；
// 進度（星數、教學、改造）有三個存檔欄位，一次用其中一個，在標題畫面的「存檔」切換。
// 放在 localStorage：存檔 1 跟設定放在同一筆（SAVE_KEY，跟只有一個存檔的舊版一樣），存檔 2、3 各自一筆。
import type { Loadout } from './data/upgrades';
import { SLOTS, cleanProgress, progressKey } from './cloud/merge';
import type { Progress, SlotId } from './cloud/merge';

export const SAVE_KEY = 'starfall_save_v1';
/** 現在用的是第幾個存檔 */
const SLOT_KEY = 'starfall_slot';
const slotKey = (n: SlotId): string => (n === 1 ? SAVE_KEY : `${SAVE_KEY}_${n}`);

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
  /** 這個存檔是哪一次刪除 / 匯入之後的（見 cloud/merge.ts 的 Progress.epoch） */
  epoch?: number;
}

/** 屬於存檔的欄位；其餘的都是這台裝置的設定 */
const PROGRESS_FIELDS = ['stars', 'tips', 'upgrades', 'at', 'epoch'] as const;

let cache: SaveData | null = null;
let slot: SlotId = 1;
/** 上次寫進去時的進度長什麼樣（用來判斷這次存檔是進度變了，還是只改了設定） */
let lastKey: string | null = null;
const listeners = new Set<() => void>();

function read(key: string): Record<string, unknown> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  } catch {
    // 存檔壞掉或瀏覽器不給用：當作空的
    return {};
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 無痕模式之類寫不進去：這次遊玩照常，只是不會留下紀錄
  }
}

export function save(): SaveData {
  if (cache) return cache;
  try {
    const n = Number(localStorage.getItem(SLOT_KEY));
    slot = (SLOTS as readonly number[]).includes(n) ? (n as SlotId) : 1;
  } catch {
    slot = 1;
  }
  const base = read(SAVE_KEY) as Partial<SaveData>;
  cache = { sfx: 0.7, stars: {}, tips: [], fast: false, music: 0.5, easy: false, upgrades: {}, cutIn: true, textScale: 1, colorBlind: false, ...base };
  // 用的不是存檔 1：進度換成那個存檔的
  if (slot !== 1) Object.assign(cache, cleanProgress(read(slotKey(slot))));
  // 舊存檔或壞掉的欄位：補成空的
  if (!cache.upgrades || typeof cache.upgrades !== 'object' || Array.isArray(cache.upgrades)) cache.upgrades = {};
  if (!cache.stars || typeof cache.stars !== 'object' || Array.isArray(cache.stars)) cache.stars = {};
  if (!Array.isArray(cache.tips)) cache.tips = [];
  lastKey = progressKey(cleanProgress(cache));
  return cache;
}

/** 把記憶體裡的設定和目前存檔的進度寫進 localStorage */
function flush(): void {
  const sv = save();
  if (slot === 1) return write(SAVE_KEY, sv);
  write(slotKey(slot), cleanProgress(sv));
  // 設定跟存檔 1 放在同一筆：只換掉設定的部分，存檔 1 的進度原封不動
  const keep = read(SAVE_KEY);
  const next: Record<string, unknown> = { ...sv };
  for (const f of PROGRESS_FIELDS) {
    if (f in keep) next[f] = keep[f];
    else delete next[f];
  }
  write(SAVE_KEY, next);
}

export function persist(): void {
  const sv = save();
  const key = progressKey(cleanProgress(sv));
  const moved = key !== lastKey;
  if (moved) sv.at = Date.now();
  lastKey = key;
  flush();
  if (moved) for (const cb of [...listeners]) cb();
}

/** 進度（不含設定）有變動時通知。雲端同步用 */
export function onSaveChanged(cb: () => void): void {
  listeners.add(cb);
}

export function activeSlot(): SlotId {
  save();
  return slot;
}

/** 改用另一個存檔（標題畫面的「存檔」）。設定不變，進度換成那個存檔的 */
export function setActiveSlot(n: SlotId): void {
  const sv = save();
  if (n === slot) return;
  flush();
  const p = slotProgress(n);
  slot = n;
  try {
    localStorage.setItem(SLOT_KEY, String(n));
  } catch {
    // 記不住：下次開遊戲會回到存檔 1
  }
  Object.assign(sv, p);
  lastKey = progressKey(p);
}

/** 某個存檔的進度（整理過的）。沒指定就是現在用的那個 */
export function slotProgress(n: SlotId = activeSlot()): Progress {
  return cleanProgress(n === activeSlot() ? save() : read(slotKey(n)));
}

/**
 * 把一份進度寫進某個存檔。設定不動；時間照給的，不算一次新的改動。
 * notify：是玩家自己做的（刪除、匯入），要通知雲端同步；同步合併回來的結果不用。
 */
export function writeSlotProgress(n: SlotId, p: Progress, notify = false): void {
  const sv = save();
  if (n === slot) {
    Object.assign(sv, cleanProgress(p));
    lastKey = progressKey(cleanProgress(sv));
    flush();
  } else if (n === 1) {
    write(SAVE_KEY, { ...read(SAVE_KEY), ...cleanProgress(p) });
  } else {
    write(slotKey(n), cleanProgress(p));
  }
  if (notify) for (const cb of [...listeners]) cb();
}
