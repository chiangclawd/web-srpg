// 存檔欄位的整份操作：讀出來、寫進去、刪除、匯出成檔案、從檔案匯入，以及存檔畫面要顯示的摘要。
// 底層分兩處放：進度在 save.ts，打到一半的戰鬥在 suspend.ts；這裡把它們當成一個存檔一起處理。
import { cleanSlot, emptySlot, isEmptySlot } from './cloud/merge';
import type { SlotData, SlotId } from './cloud/merge';
import { MISSIONS } from './data/missions';
import { partsLeft } from './data/upgrades';
import { slotProgress, writeSlotProgress } from './save';
import { applySuspendRaw, loadSuspend, suspendInfo, suspendRaw } from './suspend';

export function slotData(n: SlotId): SlotData {
  const s = suspendRaw(n);
  return { ...slotProgress(n), battle: s.json, battleAt: s.at };
}

/** notify：玩家自己做的改動（刪除、匯入）要通知雲端同步；同步合併回來的結果不用 */
export function putSlot(n: SlotId, d: SlotData, notify = false): void {
  applySuspendRaw({ json: d.battle, at: d.battleAt }, n);
  writeSlotProgress(n, d, notify);
}

/** 刪除：清成全新的存檔。epoch 記下當下的時間，雲端和其他裝置上的舊進度才不會又併回來 */
export function deleteSlot(n: SlotId): void {
  const now = Date.now();
  putSlot(n, { ...emptySlot(), at: now, epoch: now, battleAt: now }, true);
}

// ───────── 匯出 / 匯入 ─────────

const FILE_GAME = 'starfall-echo';

/** 匯出檔的內容（JSON 文字） */
export function exportText(n: SlotId): string {
  return JSON.stringify({ game: FILE_GAME, format: 1, exportedAt: new Date().toISOString(), save: slotData(n) }, null, 1);
}

/** 讀匯出檔。不是這個遊戲的存檔、或內容壞掉，回傳 null */
export function parseExport(text: string): SlotData | null {
  try {
    const raw = JSON.parse(text) as { game?: unknown; save?: unknown } | null;
    if (!raw || typeof raw !== 'object' || raw.game !== FILE_GAME || !raw.save || typeof raw.save !== 'object') return null;
    return cleanSlot(raw.save);
  } catch {
    return null;
  }
}

/** 匯入：整個存檔換成檔案裡的。跟刪除一樣記下 epoch，匯入的內容才會取代雲端上原本的，而不是跟它合併 */
export function importSlot(n: SlotId, d: SlotData): void {
  const now = Date.now();
  putSlot(n, { ...d, at: now, epoch: now, battleAt: now }, true);
  // 檔案裡那場戰鬥對不上現在的任務資料的話，這裡就會被清掉
  loadSuspend(n);
}

/** 把匯出檔交給瀏覽器下載 */
export function downloadExport(n: SlotId): void {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const url = URL.createObjectURL(new Blob([exportText(n)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `starfall-save-${n}-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 讓玩家選一個匯出檔。要在點擊的當下呼叫（瀏覽器才肯開選檔視窗）。沒選回傳 undefined，選了但讀不懂回傳 null */
export function pickExport(): Promise<SlotData | null | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(undefined);
      file
        .text()
        .then((t) => resolve(parseExport(t)))
        .catch(() => resolve(null));
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(undefined);
    });
    document.body.appendChild(input);
    input.click();
  });
}

// ───────── 摘要 ─────────

export interface SlotSummary {
  empty: boolean;
  stars: number;
  maxStars: number;
  cleared: number;
  missions: number;
  parts: number;
  /** 打到一半的戰鬥：哪一關、第幾回合 */
  battle: { mission: string; turn: number } | null;
}

export function summarize(d: SlotData, battle: { mission: string; turn: number } | null): SlotSummary {
  const got = MISSIONS.map((m) => d.stars[m.id] ?? 0);
  return {
    empty: isEmptySlot(d),
    stars: got.reduce((a, b) => a + b, 0),
    maxStars: MISSIONS.length * 3,
    cleared: got.filter((s) => s > 0).length,
    missions: MISSIONS.length,
    parts: partsLeft(d.stars, d.upgrades),
    battle,
  };
}

export const slotSummary = (n: SlotId): SlotSummary => summarize(slotData(n), suspendInfo(n));
