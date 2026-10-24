import type Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * App 版（Capacitor 包成的 iOS / Android App）專用的小工具。網頁版什麼都不做。
 *
 * iOS 在儲存空間不足時可能清掉 WebView 的 localStorage，存檔會不見：
 * App 版每次存檔也同步寫一份到原生儲存，開遊戲時 localStorage 沒有存檔就從原生儲存搬回來。
 * Android 的返回鍵也在這裡接手（見 initBackButton）。
 */
export const isNativeApp = Capacitor.isNativePlatform();

/** 開遊戲前呼叫：localStorage 裡沒有的存檔從原生儲存還原 */
export async function restoreNativeSaves(keys: string[]): Promise<void> {
  if (!isNativeApp) return;
  for (const key of keys) {
    try {
      if (localStorage.getItem(key) != null) continue;
      const { value } = await Preferences.get({ key });
      if (value != null) localStorage.setItem(key, value);
    } catch {
      // 原生儲存讀不到：照常用 localStorage
    }
  }
}

/** 存檔時呼叫：App 版同步一份到原生儲存（非同步，不擋遊戲） */
export function mirrorNativeSave(key: string, value: string): void {
  if (!isNativeApp) return;
  Preferences.set({ key, value }).catch(() => {});
}

/** 場景可以實作 onBack：處理了（關掉彈窗、暫停、回上一頁）就回傳 true */
interface BackHandler {
  onBack?: () => boolean;
}

/**
 * Android 返回鍵：預設會直接關掉 App（戰鬥打到一半也一樣）。
 * 改成先關文字對話框，再交給最上層有 onBack 的場景；都沒處理（主選單）就把 App 縮到背景。
 */
export function initBackButton(game: Phaser.Game): void {
  if (!isNativeApp) return;
  let last = 0;
  App.addListener('backButton', () => {
    // 連按時只算一次：換場景的淡出還沒結束，不要重複切換
    const now = Date.now();
    if (now - last < 450) return;
    last = now;
    const dialog = document.querySelector('[data-kb-dialog]');
    if (dialog) {
      dialog.remove();
      return;
    }
    // getScenes(true) 由下往上排：疊在上面的（戰鬥介面）先處理
    for (const s of game.scene.getScenes(true).reverse()) {
      const h = (s as BackHandler).onBack;
      if (h && h.call(s)) return;
    }
    App.minimizeApp().catch(() => {});
  }).catch(() => {});
}
