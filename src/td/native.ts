import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * App 版（Capacitor 包成的 iOS / Android App）專用的小工具。網頁版什麼都不做。
 *
 * iOS 在儲存空間不足時可能清掉 WebView 的 localStorage，存檔會不見：
 * App 版每次存檔也同步寫一份到原生儲存，開遊戲時 localStorage 沒有存檔就從原生儲存搬回來。
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
