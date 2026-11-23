// 戰鬥中存檔。只有一份：最近一場還沒打完的戰鬥。
// 我方回合每做完一個動作就自動存一次，關掉分頁或離開任務之後，可以從標題畫面或任務列表接著打；
// 打完（不論輸贏）或重新出擊就清掉。
// 跟主存檔（save.ts）分開放：這份寫得很頻繁，就算壞掉也不會拖累通關進度。
import { Battle } from './sim/Battle';
import type { BattleSnap } from './sim/types';
import { loadoutDefs } from './data/upgrades';
import type { Loadout } from './data/upgrades';
import { MISSIONS } from './data/missions';
import { UNITS } from './data/units';

export const SUSPEND_KEY = 'starfall_battle_v1';

interface Suspended {
  snap: BattleSnap;
  /** 開戰時的改造。接著打要用同一套：中途去機庫改過的話，數值會跟存下來的耐久對不上 */
  upgrades: Loadout;
}

export function saveSuspend(b: Battle, upgrades: Loadout): void {
  const snap = b.snapshot();
  if (!snap) return;
  try {
    localStorage.setItem(SUSPEND_KEY, JSON.stringify({ snap, upgrades } satisfies Suspended));
  } catch {
    // 無痕模式之類寫不進去：這場照常打，只是不能中途離開再回來
  }
}

export function clearSuspend(): void {
  try {
    localStorage.removeItem(SUSPEND_KEY);
  } catch {
    // 沒有可以清的
  }
}

/** 把存下來的那場戰鬥還原出來。沒有存檔回傳 null；存檔對不上（任務資料改過、內容壞掉）就清掉，也回傳 null */
export function loadSuspend(): { battle: Battle; upgrades: Loadout } | null {
  let raw: Partial<Suspended> | null = null;
  try {
    raw = JSON.parse(localStorage.getItem(SUSPEND_KEY) ?? 'null') as Partial<Suspended> | null;
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const mission = MISSIONS.find((m) => m.id === raw?.snap?.mission);
  const upgrades: Loadout = raw.upgrades && typeof raw.upgrades === 'object' && !Array.isArray(raw.upgrades) ? raw.upgrades : {};
  const battle = mission ? Battle.restore(mission, loadoutDefs(UNITS, upgrades), raw.snap) : null;
  if (!battle) {
    clearSuspend();
    return null;
  }
  return { battle, upgrades };
}

/** 有沒有可以接著打的戰鬥：哪一關、打到第幾回合（標題畫面和任務列表用） */
export function suspendInfo(): { mission: string; turn: number } | null {
  const s = loadSuspend();
  return s ? { mission: s.battle.mission.id, turn: s.battle.turn } : null;
}
