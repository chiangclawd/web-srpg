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
import { HEX_W, HEX_H, HEX_V_SPACING, BOARD_OFFSET_X, BOARD_OFFSET_Y } from './Grid';
import { SCENARIOS, DEFAULT_SCENARIO_ID } from './data/scenarios';

const scenario = SCENARIOS[DEFAULT_SCENARIO_ID]!;
const SIDE_PANEL_WIDTH = 240;
const RIGHT_MARGIN = 30;
const BOTTOM_PANEL_HEIGHT = 110;

// 六角棋盤實際 pixel 尺寸（pointy-top, odd-r）
const boardW = HEX_W * (scenario.gridWidth + 0.5);
const boardH = HEX_V_SPACING * (scenario.gridHeight - 1) + HEX_H;

const GAME_WIDTH =
  BOARD_OFFSET_X + boardW + SIDE_PANEL_WIDTH + RIGHT_MARGIN;
const GAME_HEIGHT = BOARD_OFFSET_Y + boardH + BOTTOM_PANEL_HEIGHT;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}
