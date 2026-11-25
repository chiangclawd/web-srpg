// 離線遊玩和「安裝到主畫面」。
// 快取的本體是 service worker：樣板在 offline/sw.js，建置時加上整個遊戲的檔案清單變成 starfall-sw.js（scripts/starfall-offline.mjs）。
// 這裡只做三件事：註冊它、把它回報的進度交給標題畫面顯示、接住瀏覽器的安裝邀請。
import type Phaser from 'phaser';

export interface OfflineState {
  /** off：這個環境沒有（開發模式、瀏覽器不支援、App 版）；loading：第一次，正在把遊戲存進裝置；ready：斷網也能玩 */
  status: 'off' | 'loading' | 'ready';
  done: number;
  total: number;
}

let state: OfflineState = { status: 'off', done: 0, total: 0 };
const subs = new Set<() => void>();
const notify = (): void => subs.forEach((fn) => fn());
const set = (s: OfflineState): void => {
  state = s;
  notify();
};

export const offlineState = (): OfflineState => state;

/** 進度變了、或能不能安裝變了的時候通知；回傳取消訂閱的函式 */
export function onOffline(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Chrome（Android、電腦）在網站可以安裝時給的事件；留著，玩家按「安裝」才用。iOS 沒有這個，要用 Safari 的「加入主畫面」 */
interface InstallEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let installEvt: InstallEvent | null = null;

export const canInstall = (): boolean => !!installEvt;

export async function promptInstall(): Promise<void> {
  const e = installEvt;
  if (!e) return;
  // 同一個事件只能用一次；玩家按了取消的話，瀏覽器之後會再給一個新的
  installEvt = null;
  notify();
  await e.prompt();
}

const RELOADED = 'starfall_sw_reloaded';

export function initOffline(game: Phaser.Game): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 不讓瀏覽器自己跳橫幅，改由標題畫面的按鈕叫出來
    e.preventDefault();
    installEvt = e as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installEvt = null;
    notify();
  });
  // App 版的檔案本來就在手機裡，不需要快取
  const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  if (!import.meta.env.PROD || native || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // 這次開頁面時已經有裝好的版本在管：整個遊戲在裝置裡了
  const had = !!sw.controller;
  if (had) set({ status: 'ready', done: 0, total: 0 });
  sw.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { sf?: string; ready?: boolean; done?: number; total?: number } | null;
    if (!d || d.sf !== 'offline') return;
    if (d.ready) set({ status: 'ready', done: 0, total: 0 });
    // 已經能離線玩的時候，背景在抓新版不用特別顯示
    else if (state.status !== 'ready') set({ status: 'loading', done: d.done ?? 0, total: d.total ?? 0 });
  });
  sw.addEventListener('controllerchange', () => {
    if (!had) {
      set({ status: 'ready', done: 0, total: 0 });
      return;
    }
    // 新版接手了：這個頁面已經載入的圖是舊版快取給的，可能跟新的程式對不上。
    // 人還停在標題畫面就重新載入一次；已經在玩了就不打斷，下次開遊戲自然是新的
    const active = game.scene.getScenes(true).map((s) => s.scene.key);
    if (active.length !== 1 || active[0] !== 'SfTitle' || sessionStorage.getItem(RELOADED)) return;
    sessionStorage.setItem(RELOADED, '1');
    location.reload();
  });
  const register = (): void => {
    // 範圍只有 starfall 開頭的頁面，同一個網站上的另外兩款遊戲不受影響
    sw.register('starfall-sw.js', { scope: './starfall' }).catch(() => {
      // 不支援或被瀏覽器擋下：照常連線玩
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
