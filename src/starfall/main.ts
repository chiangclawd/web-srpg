import Phaser from 'phaser';
import { RS, VIEW_H, computeViewW, isTouchDevice, refreshTextScale } from './config';
import { T } from './i18n';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { MissionScene } from './scenes/MissionScene';
import { HangarScene } from './scenes/HangarScene';
import { BattleScene } from './scenes/BattleScene';
import { HudScene } from './scenes/HudScene';
import { DialogueScene } from './scenes/DialogueScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SavesScene } from './scenes/SavesScene';
import type { HudScene as Hud } from './scenes/HudScene';
import type { DialogueScene as Dialogue } from './scenes/DialogueScene';
import { initCloud, onCloudChanged } from './cloud/sync';
import { initGamepad, onHintMode } from './gamepad';

const rotate = document.querySelector<HTMLElement>('#rotate-prompt .title');
if (rotate) rotate.textContent = T('rotate');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(computeViewW() * RS),
  height: Math.round(VIEW_H * RS),
  backgroundColor: '#070d18',
  scene: [BootScene, TitleScene, MissionScene, HangarScene, BattleScene, HudScene, DialogueScene, SettingsScene, SavesScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    antialiasGL: !isTouchDevice() && RS > 1,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: { activePointers: 2 },
  disableContextMenu: true,
});

// 視窗比例改變（旋轉、縮放、進出全螢幕）→ 重新計算邏輯寬度，每個畫面照新的寬度重排；戰鬥不重開，只重排介面
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth < window.innerHeight) return;
    const w = Math.round(computeViewW() * RS);
    if (w === game.scale.width) return;
    refreshTextScale();
    // 要用 setGameSize：resize() 是給不縮放的模式用的，它不會更新畫布的長寬比，換了比例之後整個畫面會被拉寬
    game.scale.setGameSize(w, Math.round(VIEW_H * RS));
    for (const s of game.scene.getScenes(true)) {
      const key = s.scene.key;
      // 沒有進行中狀態的畫面直接重畫（沒給資料時 Phaser 沿用上次的，設定頁關掉之後要做的事也還在）
      if (key === 'SfTitle' || key === 'SfMissions' || key === 'SfHangar' || key === 'SfSettings' || key === 'SfSaves') s.scene.restart();
      else if (key === 'SfHud') (s as Hud).relayout();
      else if (key === 'SfDialogue') (s as Dialogue).resized();
    }
  }, 200);
});

// 手把：按鈕翻成鍵盤事件。從鍵盤換成手把（或換回來）時，按鈕角落的提示字跟著換
initGamepad(game);
onHintMode(() => {
  for (const s of game.scene.getScenes(true)) {
    if (s.scene.key === 'SfHud') (s as Hud).relayout();
    else if (s.scene.key === 'SfSettings') s.scene.restart();
  }
});

// 雲端同步把別台裝置的進度帶進來了：標題、任務列表、機庫照新的進度重畫（戰鬥中不動，打完回任務列表就是新的）
initCloud();
onCloudChanged(() => {
  for (const s of game.scene.getScenes(true)) {
    const key = s.scene.key;
    if (key === 'SfTitle' || key === 'SfMissions' || key === 'SfHangar' || key === 'SfSaves') s.scene.restart();
  }
});

// 自動化測試（scripts/starfall-check.cjs）用
(window as unknown as { __sf: Phaser.Game }).__sf = game;
