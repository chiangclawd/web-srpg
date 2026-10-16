import Phaser from 'phaser';
import '@fontsource/luckiest-guy/400.css';
import { RS, VIEW_H, computeViewW } from './config';
import { loadSave } from './save';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { LevelScene } from './scenes/LevelScene';
import { LevelUIScene } from './scenes/LevelUIScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { HeroScene } from './scenes/HeroScene';
import { EncyclopediaScene } from './scenes/EncyclopediaScene';

loadSave();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: computeViewW() * RS,
  height: VIEW_H * RS,
  backgroundColor: '#120d08',
  scene: [BootScene, MenuScene, MapScene, LevelScene, LevelUIScene, UpgradeScene, HeroScene, EncyclopediaScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 2,
  },
  disableContextMenu: true,
});

// 視窗比例改變（旋轉、縮放）→ 重新計算邏輯寬度
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth < window.innerHeight) return;
    const w = computeViewW() * RS;
    if (Math.abs(w - game.scale.width) > 2) game.scale.setGameSize(w, VIEW_H * RS);
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

// 方便除錯 / 自動化測試
(window as unknown as { __td: Phaser.Game }).__td = game;

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
