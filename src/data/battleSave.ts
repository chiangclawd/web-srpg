/**
 * 戰鬥中存檔（mid-battle save slots）— 跟章節間的 saveProgress 完全分離。
 *
 * 三個固定欄位（slot 0 / 1 / 2）。每個 slot 紀錄足以重建戰局的 snapshot：
 * 章節 id、玩家回合數、地上所有單位的位置 / HP / 等級 / 裝備 / 技能狀態 +
 * 藥草庫存。讀取時 BattleScene 重新跑 deployUnits 把骨架建好，再把 save
 * 蓋上去（mutate already-spawned units），不在 save 裡的單位 = 已陣亡 → 移除。
 *
 * 限制：scenarios 假設 static — 不支援中途增援部隊（reinforcement）的恢復。
 * 目前所有章節都是固定部署，這假設成立。
 */

import type { Coord } from '../types';

const STORAGE_KEY = 'web-srpg-battle-saves-v1';
export const SAVE_SLOT_COUNT = 3;

export interface BattleSaveUnit {
  commanderId: string;
  position: Coord;
  hp: number;
  level: number;
  exp: number;
  weaponId: string | null;
  armorId: string | null;
  hasActed: boolean;
  activeUsesLeft: number;
  pendingEmpowerId: string | null;
  stanceMods: { incomingMul: number; turnsLeft: number } | null;
}

export interface BattleSave {
  chapterId: string;
  scenarioIdOverride: string | null;
  playerTurnNumber: number;
  potionCount: number;
  units: BattleSaveUnit[];
  /** Date.now() */
  savedAt: number;
  /** UI 列表用：章節編號 + 標題快取（避免讀檔時還要查 CHAPTERS） */
  chapterNumber: number;
  chapterTitle: string;
}

function readAll(): (BattleSave | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Array(SAVE_SLOT_COUNT).fill(null);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Array(SAVE_SLOT_COUNT).fill(null);
    const out: (BattleSave | null)[] = new Array(SAVE_SLOT_COUNT).fill(null);
    for (let i = 0; i < SAVE_SLOT_COUNT; i += 1) {
      out[i] = (parsed[i] as BattleSave | null) ?? null;
    }
    return out;
  } catch {
    return new Array(SAVE_SLOT_COUNT).fill(null);
  }
}

function writeAll(slots: (BattleSave | null)[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch (e) {
    console.warn('writeAll battle saves failed', e);
  }
}

export function getSlots(): (BattleSave | null)[] {
  return readAll();
}

export function loadSlot(idx: number): BattleSave | null {
  const slots = readAll();
  return slots[idx] ?? null;
}

export function saveToSlot(idx: number, save: BattleSave): void {
  if (idx < 0 || idx >= SAVE_SLOT_COUNT) return;
  const slots = readAll();
  slots[idx] = save;
  writeAll(slots);
}

export function clearSlot(idx: number): void {
  if (idx < 0 || idx >= SAVE_SLOT_COUNT) return;
  const slots = readAll();
  slots[idx] = null;
  writeAll(slots);
}

export function hasAnySave(): boolean {
  return readAll().some((s) => s !== null);
}

/** 把 ms 時間戳格式化成「MM/DD HH:mm」短字串給 UI 顯示 */
export function formatSaveTime(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}
