import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CutsceneScene } from './scenes/CutsceneScene';
import { HubScene } from './scenes/HubScene';
import { BattleScene } from './BattleScene';
import { loadSettings } from './utils/settings';
import { loadLang } from './utils/i18n';

loadSettings();
loadLang();

/**
 * 依視窗 aspect ratio 動態決定 canvas 大小：
 *   - 手機橫屏（~2.17:1）→ canvas 寬一點，填滿不留黑邊
 *   - 桌機（~1.78:1）→ canvas 較方，剛好 fit
 *
 * 用較小的基準高度（720）讓文字相對放大、手機上更好讀。
 * 22×16 大地圖會超出 viewport，由 BattleScene 相機 scroll/zoom 處理。
 */
const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
const winAspect = winW / winH;
// 過寬或過高都做合理 clamp（避免極端視窗）
const aspect = Math.max(1.4, Math.min(2.4, winAspect));
const BASE_HEIGHT = 720;
const BASE_WIDTH = Math.round(BASE_HEIGHT * aspect);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  backgroundColor: '#0a0a0a',
  scene: [BootScene, TitleScene, CutsceneScene, HubScene, BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

/**
 * 嘗試鎖定橫屏（盡力而為，多數瀏覽器會 reject）：
 *   - Android Chrome PWA：可成功鎖
 *   - iOS Safari：API 存在但通常 reject；靠 manifest.json + 「請旋轉」遮罩
 *   - 桌機：API 不適用，靜默失敗
 */
function tryLockLandscape(): void {
  const so = (screen as Screen & {
    orientation?: { lock?: (o: string) => Promise<void> };
  }).orientation;
  if (so && typeof so.lock === 'function') {
    so.lock('landscape').catch(() => {
      // 靜默失敗：iOS Safari、桌機都會 reject，這是預期內的
    });
  }
}
// 啟動時嘗試一次；使用者第一次點擊時再嘗試一次（部分瀏覽器要 user gesture）
tryLockLandscape();
window.addEventListener('pointerdown', () => tryLockLandscape(), { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}
