import type { Quality } from './config';

/**
 * 當機偵測：iOS Safari 記憶體不足時會直接砍掉分頁並自動重載（之後顯示「重複發生問題」）。
 * 遊戲在前景時留下記號，切到背景 / 關閉頁面時清掉；
 * 啟動時記號還在 → 上次是被砍掉的 → 自動降成省電畫質再試一次。
 */
const KEY = 'kb_td_alive';

/** 這次啟動是否因為上次當機而自動降低畫質（主選單會提示一次） */
export let crashDowngraded = false;

export function consumeCrashNotice(): boolean {
  const v = crashDowngraded;
  crashDowngraded = false;
  return v;
}

/** 回傳應使用的畫質；需要時會把設定改成 low 並呼叫 persist 存檔 */
export function crashGuard(quality: Quality, setLow: () => void): Quality {
  if (typeof window === 'undefined') return quality;
  let crashed = false;
  try {
    crashed = localStorage.getItem(KEY) === '1';
    const mark = (alive: boolean) => {
      try {
        if (alive) localStorage.setItem(KEY, '1');
        else localStorage.removeItem(KEY);
      } catch {
        // 無痕模式等：不偵測
      }
    };
    mark(true);
    document.addEventListener('visibilitychange', () => mark(!document.hidden));
    window.addEventListener('pagehide', () => mark(false));
    window.addEventListener('pageshow', () => mark(true));
  } catch {
    return quality;
  }
  if (crashed && quality !== 'low') {
    setLow();
    crashDowngraded = true;
    return 'low';
  }
  return quality;
}
