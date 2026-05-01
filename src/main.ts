import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CutsceneScene } from './scenes/CutsceneScene';
import { HubScene } from './scenes/HubScene';
import { BattleScene } from './BattleScene';
import { loadSettings, getSettings } from './utils/settings';
import { loadLang } from './utils/i18n';
import { audio } from './utils/audio';

loadSettings();
loadLang();

// 暴露給 index.html 的浮動靜音按鈕（避免在 inline script 重新建一個 audio 實例）
(window as unknown as {
  __srpgToggleMute?: () => boolean;
  __srpgIsMuted?: () => boolean;
}).__srpgToggleMute = () => audio.toggleMute();
(window as unknown as {
  __srpgToggleMute?: () => boolean;
  __srpgIsMuted?: () => boolean;
}).__srpgIsMuted = () => getSettings().muted;

/**
 * 主要 QA 平台是 iPhone X 之後的全螢幕機種（19.5:9 橫屏）→ canvas aspect
 * 固定在 19.5:9，避免動態 aspect 在「先直拿開啟、再轉橫」這種啟動順序下
 * 抓到直屏比例導致大量黑邊。其他比例的視窗（桌機 16:9、iPad 4:3）會有
 * letterbox，可接受。
 *
 * 22×16 大地圖會超出 viewport，由 BattleScene 相機 scroll/zoom 處理。
 */
const ASPECT = 19.5 / 9;
const BASE_HEIGHT = 720;
const BASE_WIDTH = Math.round(BASE_HEIGHT * ASPECT); // 1560

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
