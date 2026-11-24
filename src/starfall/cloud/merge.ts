// 存檔的資料形狀，和雲端同步的合併規則（純函式，不碰瀏覽器，tests/starfall/cloud.test.ts 直接測）。
// 一個存檔 = 進度（每關的星數、看過的教學、機庫的改造）+ 打到一半的那場戰鬥。
// 音量、文字大小、語言這些是每台裝置自己的設定，不屬於存檔，也不同步。
import { FRAMES, frameUpgrades, partsEarned, partsSpent } from '../data/upgrades';
import type { Loadout } from '../data/upgrades';

/** 三個存檔欄位 */
export const SLOTS = [1, 2, 3] as const;
export type SlotId = (typeof SLOTS)[number];

export interface Progress {
  stars: Record<string, number>;
  tips: string[];
  upgrades: Loadout;
  /** 這份進度最後一次改動的時間（毫秒）。只用來決定機庫的改造聽誰的 */
  at: number;
  /**
   * 這個存檔是哪一次「重來」之後的：刪除或匯入存檔時設成當下的時間。
   * 兩邊不一樣時，比較新的那一邊整份算數（不合併）—— 不然刪掉的星數會從另一台裝置又併回來。
   */
  epoch: number;
}

/** 打到一半的戰鬥：json 是 suspend.ts 存的那串字；null = 沒有（打完了或重新出擊了）。at = 最後一次存或清掉的時間 */
export interface SuspendRaw {
  json: string | null;
  at: number;
}

/** 一個完整的存檔 */
export interface SlotData extends Progress {
  battle: string | null;
  battleAt: number;
}

/**
 * 雲端上每個帳號一份的文件。存檔 1 攤平放在最上層（跟只有一個存檔的舊版一樣），存檔 2、3 放在 slots 裡。
 * epoch 是 0、存檔 2 和 3 都沒用過的時候不寫這兩個欄位，所以沒用到新功能的玩家寫出去的文件跟舊版一模一樣。
 */
export interface CloudDoc {
  v: 1;
  stars: Record<string, number>;
  tips: string[];
  upgrades: Loadout;
  at: number;
  battle: string | null;
  battleAt: number;
  epoch?: number;
  slots?: Record<string, SlotData>;
}

const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const obj = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {});

/** 把來路不明的資料（雲端文件、匯入的檔案、舊存檔）整理成可信的進度 */
export function cleanProgress(raw: unknown): Progress {
  const r = obj(raw);
  const stars: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.stars))) {
    const n = Math.max(0, Math.min(3, Math.floor(num(v))));
    if (n > 0 && k.length <= 24) stars[k] = n;
  }
  const tips = Array.isArray(r.tips) ? [...new Set(r.tips.filter((t): t is string => typeof t === 'string' && t.length <= 40))].slice(0, 200) : [];
  const upgrades: Loadout = {};
  const up = obj(r.upgrades) as Loadout;
  for (const f of FRAMES) {
    const u = frameUpgrades(up, f);
    if (u.plating || u.firepower || u.mods.length) upgrades[f] = u;
  }
  return { stars, tips, upgrades, at: Math.max(0, num(r.at)), epoch: Math.max(0, num(r.epoch)) };
}

export function cleanSlot(raw: unknown): SlotData {
  const r = obj(raw);
  const battle = typeof r.battle === 'string' && r.battle.length <= 200_000 ? r.battle : null;
  return { ...cleanProgress(r), battle, battleAt: Math.max(0, num(r.battleAt)) };
}

export const emptySlot = (): SlotData => ({ stars: {}, tips: [], upgrades: {}, at: 0, epoch: 0, battle: null, battleAt: 0 });

/** 還沒玩過：沒有星、沒有改造、沒有打到一半的戰鬥（看過的教學不算） */
export function isEmptySlot(s: SlotData): boolean {
  return Object.keys(s.stars).length === 0 && Object.keys(s.upgrades).length === 0 && s.battle === null;
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
  return JSON.stringify([stars, [...p.tips].sort(), ups, p.epoch]);
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * 兩台裝置的進度合起來：
 * - 其中一邊重來過（epoch 不一樣）：比較新的那一邊整份算數。
 * - 星數：每關取比較多的（拿過的星不會不見）
 * - 教學提示：看過的聯集
 * - 機庫的改造：整套用比較晚改動的那一邊（改造可以退還重配，逐項合併會把退掉的又加回來）。
 *   星數只會變多，所以任一邊原本買得起的，合併後一定還買得起；萬一對不上就用另一邊，再不行就清空（零件全數退還）。
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  if (a.epoch !== b.epoch) {
    const w = a.epoch > b.epoch ? a : b;
    return { stars: { ...w.stars }, tips: [...w.tips], upgrades: copy(w.upgrades), at: w.at, epoch: w.epoch };
  }
  const stars: Record<string, number> = { ...a.stars };
  for (const [k, v] of Object.entries(b.stars)) stars[k] = Math.max(stars[k] ?? 0, v);
  const tips = [...new Set([...a.tips, ...b.tips])];
  const [newer, older] = a.at >= b.at ? [a, b] : [b, a];
  const budget = partsEarned(stars);
  const fits = (l: Loadout): boolean => partsSpent(l) <= budget;
  const upgrades = fits(newer.upgrades) ? newer.upgrades : fits(older.upgrades) ? older.upgrades : {};
  return { stars, tips, upgrades: copy(upgrades), at: Math.max(a.at, b.at), epoch: a.epoch };
}

/** 打到一半的戰鬥：比較晚存（或比較晚清掉）的那一邊算數 */
export function mergeSuspend(a: SuspendRaw, b: SuspendRaw): SuspendRaw {
  return b.at > a.at ? b : a;
}

/** 一整個存檔合起來。其中一邊重來過的話，打到一半的戰鬥也跟著那一邊（舊進度的戰鬥不該留在新存檔裡） */
export function mergeSlot(a: SlotData, b: SlotData): SlotData {
  if (a.epoch !== b.epoch) return copy(a.epoch > b.epoch ? a : b);
  const s = mergeSuspend({ json: a.battle, at: a.battleAt }, { json: b.battle, at: b.battleAt });
  return { ...mergeProgress(a, b), battle: s.json, battleAt: s.at };
}

/** 兩個存檔的內容一不一樣（進度、重來的時間、打到一半的戰鬥） */
export const sameSlot = (a: SlotData, b: SlotData): boolean => progressKey(a) === progressKey(b) && a.battle === b.battle;

/** 雲端文件 → 三個存檔 */
export function readDoc(raw: unknown): Record<SlotId, SlotData> {
  const r = obj(raw);
  const more = obj(r.slots);
  return { 1: cleanSlot(r), 2: cleanSlot(more['2']), 3: cleanSlot(more['3']) };
}

/** 三個存檔 → 雲端文件 */
export function writeDoc(slots: Record<SlotId, SlotData>): CloudDoc {
  const s1 = slots[1];
  const doc: CloudDoc = { v: 1, stars: s1.stars, tips: s1.tips, upgrades: s1.upgrades, at: s1.at, battle: s1.battle, battleAt: s1.battleAt };
  if (s1.epoch > 0) doc.epoch = s1.epoch;
  const more: Record<string, SlotData> = {};
  for (const n of [2, 3] as const) if (!isEmptySlot(slots[n]) || slots[n].epoch > 0) more[String(n)] = slots[n];
  if (Object.keys(more).length) doc.slots = more;
  return doc;
}
