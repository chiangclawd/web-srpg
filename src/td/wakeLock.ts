/**
 * 戰鬥中讓螢幕保持亮著（Screen Wake Lock）：等下一波、看塔開火時手機不會自動變暗鎖屏。
 * 頁面切到背景時瀏覽器會自動放掉，回來再重新要；不支援或被拒絕（省電模式）就照常玩。
 */
interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', fn: () => void): void;
}

let want = false;
let lock: Sentinel | null = null;
let pending = false;

async function acquire(): Promise<void> {
  if (!want || lock || pending || document.hidden) return;
  const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }).wakeLock;
  if (!wl) return;
  pending = true;
  try {
    const s = await wl.request('screen');
    s.addEventListener('release', () => {
      if (lock === s) lock = null;
    });
    // 等待期間已經不需要了（暫停、離開戰鬥）
    if (want) lock = s;
    else await s.release();
  } catch {
    // 不支援或被拒絕：螢幕照系統設定變暗
  } finally {
    pending = false;
  }
}

/** 戰鬥進行中呼叫 true；暫停、結算、離開時呼叫 false */
export function keepScreenOn(on: boolean): void {
  want = on;
  if (on) {
    void acquire();
  } else if (lock) {
    const s = lock;
    lock = null;
    s.release().catch(() => {});
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void acquire();
  });
}
