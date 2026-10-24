import Phaser from 'phaser';
import '@fontsource/luckiest-guy/400.css';
import { RS, VIEW_H, applyQuality, computeViewW, isTouchDevice, refreshTextScale, setUiBoost } from './config';
import { SAVE_KEY, loadSave, persist } from './save';
import { initBackButton, isNativeApp, restoreNativeSaves } from './native';
import { getLang } from './i18n';
import { toHans } from './hans';
import { crashGuard } from './crashGuard';
import { PreloadScene } from './scenes/PreloadScene';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { LevelScene } from './scenes/LevelScene';
import { LevelUIScene } from './scenes/LevelUIScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { HeroScene } from './scenes/HeroScene';
import { EncyclopediaScene } from './scenes/EncyclopediaScene';
import { AchievementScene } from './scenes/AchievementScene';
import { EndingScene } from './scenes/EndingScene';
import { ShopScene } from './scenes/ShopScene';

// App 版：localStorage 被系統清掉時，先從原生儲存搬回存檔
await restoreNativeSaves([SAVE_KEY]);

{
  const sv = loadSave();
  // 「請橫向」提示寫在 td.html 裡（遊戲還沒載入就要顯示）：跟著語言換成簡體
  if (getLang() === 'zhs') {
    for (const el of document.querySelectorAll<HTMLElement>('#rotate-prompt .title, #rotate-prompt .desc')) el.innerHTML = toHans(el.innerHTML);
  }
  setUiBoost(sv.settings.uiScale ?? 1);
  applyQuality(
    crashGuard(sv.settings.quality ?? 'auto', () => {
      sv.settings.quality = 'low';
      persist();
    }),
  );
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(computeViewW() * RS),
  height: Math.round(VIEW_H * RS),
  backgroundColor: '#120d08',
  scene: [PreloadScene, BootScene, MenuScene, MapScene, LevelScene, LevelUIScene, UpgradeScene, HeroScene, EncyclopediaScene, AchievementScene, EndingScene, ShopScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    // 多重取樣（MSAA）讓繪圖緩衝區記憶體變 4 倍；手機像素密度高，關掉幾乎看不出差別
    antialiasGL: !isTouchDevice() && RS > 1,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 2,
  },
  disableContextMenu: true,
});
initBackButton(game);

// 視窗比例改變（旋轉、縮放）→ 重新計算邏輯寬度
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth < window.innerHeight) return;
    refreshTextScale();
    const w = Math.round(computeViewW() * RS);
    if (Math.abs(w - game.scale.width) > 2) game.scale.setGameSize(w, Math.round(VIEW_H * RS));
  }, 150);
});

// 嘗試鎖橫屏（多數瀏覽器會拒絕，靜默失敗）
const so = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
window.addEventListener(
  'pointerdown',
  () => {
    so?.lock?.('landscape').catch(() => {});
  },
  { once: true },
);

// 離線遊玩：正式版註冊 service worker（範圍只限 td.html）；App 版的檔案本來就在手機裡，不需要
if (import.meta.env.PROD && !isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('td-sw.js', { scope: './td' }).catch(() => {
      // 不支援或被沙盒擋下：照常線上遊玩
    });
  });
}

// 方便除錯 / 自動化測試
(window as unknown as { __td: Phaser.Game }).__td = game;

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
