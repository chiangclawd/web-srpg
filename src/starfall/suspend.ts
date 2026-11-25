// 戰鬥中存檔。每個存檔欄位一份：那個存檔最近一場還沒打完的戰鬥。
// 我方回合每做完一個動作就自動存一次，關掉分頁或離開任務之後，可以從標題畫面或任務列表接著打；
// 打完（不論輸贏）或重新出擊就清掉。
// 跟主存檔（save.ts）分開放：這份寫得很頻繁，就算壞掉也不會拖累通關進度。
import { Battle } from './sim/Battle';
import type { BattleSnap } from './sim/types';
import { loadoutDefs } from './data/upgrades';
import type { Loadout } from './data/upgrades';
import { MISSIONS } from './data/missions';
import { UNITS } from './data/units';
import type { SlotId, SuspendRaw } from './cloud/merge';
import { activeSlot } from './save';

/** 存檔 1 的戰鬥（跟只有一個存檔的舊版同一個位置）；存檔 2、3 在後面加 _2、_3 */
export const SUSPEND_KEY = 'starfall_battle_v1';
/** 最後一次存下或清掉的時間。雲端同步用：兩台裝置都有的時候，比較晚的算數（清掉也算，打完的戰鬥才不會從雲端又跑回來） */
const SUSPEND_AT_KEY = 'starfall_battle_at';
const dataKey = (n: SlotId): string => (n === 1 ? SUSPEND_KEY : `${SUSPEND_KEY}_${n}`);
const atKey = (n: SlotId): string => (n === 1 ? SUSPEND_AT_KEY : `${SUSPEND_AT_KEY}_${n}`);
const listeners = new Set<() => void>();

function stamp(n: SlotId): void {
  localStorage.setItem(atKey(n), String(Date.now()));
  for (const cb of [...listeners]) cb();
}

export function onSuspendChanged(cb: () => void): void {
  listeners.add(cb);
}

/** 存下來的那串字和時間（原封不動，給雲端同步和匯出）。沒指定就是現在用的存檔 */
export function suspendRaw(n: SlotId = activeSlot()): SuspendRaw {
  try {
    return { json: localStorage.getItem(dataKey(n)), at: Number(localStorage.getItem(atKey(n))) || 0 };
  } catch {
    return { json: null, at: 0 };
  }
}

/** 把別台裝置（或匯入的檔案）的那場戰鬥放進來，或清掉。內容對不對，接著打的時候 loadSuspend 會檢查 */
export function applySuspendRaw(s: SuspendRaw, n: SlotId = activeSlot()): void {
  try {
    if (s.json === null) localStorage.removeItem(dataKey(n));
    else localStorage.setItem(dataKey(n), s.json);
    localStorage.setItem(atKey(n), String(s.at));
  } catch {
    // 寫不進去：這台裝置就沒有這場戰鬥
  }
}

interface Suspended {
  snap: BattleSnap;
  /** 開戰時的改造。接著打要用同一套：中途去機庫改過的話，數值會跟存下來的耐久對不上 */
  upgrades: Loadout;
}

export function saveSuspend(b: Battle, upgrades: Loadout): void {
  const snap = b.snapshot();
  if (!snap) return;
  const n = activeSlot();
  try {
    localStorage.setItem(dataKey(n), JSON.stringify({ snap, upgrades } satisfies Suspended));
    stamp(n);
  } catch {
    // 無痕模式之類寫不進去：這場照常打，只是不能中途離開再回來
  }
}

export function clearSuspend(n: SlotId = activeSlot()): void {
  try {
    if (localStorage.getItem(dataKey(n)) === null) return;
    localStorage.removeItem(dataKey(n));
    stamp(n);
  } catch {
    // 沒有可以清的
  }
}

/** 把存下來的那場戰鬥還原出來。沒有存檔回傳 null；存檔對不上（任務資料改過、內容壞掉）就清掉，也回傳 null */
export function loadSuspend(n: SlotId = activeSlot()): { battle: Battle; upgrades: Loadout } | null {
  let raw: Partial<Suspended> | null = null;
  try {
    raw = JSON.parse(localStorage.getItem(dataKey(n)) ?? 'null') as Partial<Suspended> | null;
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const mission = MISSIONS.find((m) => m.id === raw?.snap?.mission);
  const upgrades: Loadout = raw.upgrades && typeof raw.upgrades === 'object' && !Array.isArray(raw.upgrades) ? raw.upgrades : {};
  const battle = mission ? Battle.restore(mission, loadoutDefs(UNITS, upgrades), raw.snap) : null;
  if (!battle) {
    clearSuspend(n);
    return null;
  }
  return { battle, upgrades };
}

/** 有沒有可以接著打的戰鬥：哪一關、打到第幾回合、是不是挑戰模式（標題畫面、任務列表、存檔畫面用） */
export function suspendInfo(n: SlotId = activeSlot()): { mission: string; turn: number; hard: boolean } | null {
  const s = loadSuspend(n);
  return s ? { mission: s.battle.mission.id, turn: s.battle.turn, hard: s.battle.hard } : null;
}
