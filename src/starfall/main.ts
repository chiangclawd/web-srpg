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

const rotate = document.querySelector<HTMLElement>('#rotate-prompt .title');
if (rotate) rotate.textContent = T('rotate');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(computeViewW() * RS),
  height: Math.round(VIEW_H * RS),
  backgroundColor: '#070d18',
  scene: [BootScene, TitleScene, MissionScene, HangarScene, BattleScene, HudScene, DialogueScene, SettingsScene],
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

// 視窗比例改變（旋轉、縮放）→ 重新計算邏輯寬度；戰鬥中不重開場景，只調整畫布
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth < window.innerHeight) return;
    const w = Math.round(computeViewW() * RS);
    if (w === game.scale.width) return;
    refreshTextScale();
    game.scale.resize(w, Math.round(VIEW_H * RS));
    for (const s of game.scene.getScenes(true)) {
      const key = s.scene.key;
      if (key === 'SfTitle' || key === 'SfMissions' || key === 'SfHangar') s.scene.restart();
    }
  }, 200);
});

// 自動化測試（scripts/starfall-check.cjs）用
(window as unknown as { __sf: Phaser.Game }).__sf = game;
