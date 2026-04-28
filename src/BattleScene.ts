import Phaser from 'phaser';
import { Unit } from './Unit';
import {
  HEX_SIZE,
  HEX_W,
  HEX_H,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  setGridSize,
  setTerrain,
  getGridWidth,
  getGridHeight,
  getTerrainAt,
  hexCenterPx,
  boardWidthPx,
  boardHeightPx,
  pixelToTile,
  manhattan,
  coordEq,
  coordKey,
  bfsReachable,
  attackTargetTiles,
} from './Grid';
import { tracePointyHexPath } from './utils/hexDrawing';
import type { Coord, GameState, ScenarioDef } from './types';
import { COMMANDERS } from './data/commanders';
import { SCENARIOS, DEFAULT_SCENARIO_ID } from './data/scenarios';
import { CHAPTERS } from './data/chapters';
import { UNIT_TYPES } from './data/unitTypes';
import { TERRAIN_TYPES, parseTerrain } from './data/terrainTypes';
import { computeDamage, rollAttack } from './battle/DamageCalculator';
import { getCounter } from './battle/CounterSystem';
import { EXP_PER_DAMAGE, EXP_PER_KILL } from './battle/Leveling';
import { getCommanderProgress, saveProgress, getExcludedCommanders } from './data/save';
import type { CommanderProgress } from './types';
import { audio, type BgmMood } from './utils/audio';
import { getSettings, cycleAnimSpeed, toggleMute, cycleDifficulty, difficultyLabel, getEnemyAttackMul, cycleTheme, getThemeColors } from './utils/settings';
import { tryUnlockAchievement } from './utils/achievementToast';
import { CHAPTER_COMPLETE_ACHIEVEMENT } from './data/achievements';
import { addHitRect } from './utils/uiHit';

const CHAPTER_MOODS: Record<string, BgmMood> = {
  chapter1: 'peaceful',
  chapter2: 'tense',
  chapter3: 'epic',
  chapter4: 'peaceful',
  chapter5: 'tense',
  chapter6: 'dark',
  chapter7: 'dark',
  chapter8: 'finale',
  chapter9: 'dark',
  chapter10: 'finale',
};

type UISelection =
  | { kind: 'idle' }
  | { kind: 'unit_selected'; unit: Unit; reachable: Coord[]; directTargets: Unit[] }
  | { kind: 'action_choice'; unit: Unit; attackTargets: Coord[] }
  | { kind: 'busy' };

export interface BattleSceneInitData {
  chapterId?: string;
  scenarioId?: string;
}

export class BattleScene extends Phaser.Scene {
  private units: Unit[] = [];
  private gameState: GameState = 'player_turn';
  private selection: UISelection = { kind: 'idle' };
  private scenario!: ScenarioDef;
  private chapterId: string = '';
  private scenarioIdOverride: string | null = null;
  /** 玩家回合計數（從 1 起算）；用於 survive 條件判定與 UI 顯示 */
  private playerTurnNumber = 1;
  /** UI 元素清單（縮放時用反比 scale + position 維持視覺大小、視覺位置不動） */
  private uiElements: Array<{
    obj: Phaser.GameObjects.GameObject;
    baseX: number;
    baseY: number;
  }> = [];
  /** 拖曳平移用：pointerdown 起點（用來判斷是否超過 click 閾值）*/
  private dragStart: { x: number; y: number } | null = null;
  /** 拖曳平移用：上一個 pointermove 位置（用來算每幀 delta，比 pointer.movementX 可靠）*/
  private prevPointerPos: { x: number; y: number } | null = null;
  /** 拖曳平移用：本次按壓中是否曾經拖曳超過閾值；click handler 用來判斷是否該抑制 */
  private didDrag = false;
  /** 雙指捏合縮放：起始兩指距離 */
  private pinchStartDist = 0;
  /** 雙指捏合縮放：起始 zoom */
  private pinchStartZoom = 1;
  /** 縮放範圍邊界 */
  private static readonly ZOOM_MIN = 0.4;
  private static readonly ZOOM_MAX = 2.0;

  private highlightGfx!: Phaser.GameObjects.Graphics;
  private turnText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private waitBtn!: Phaser.GameObjects.Container;
  private cancelBtn!: Phaser.GameObjects.Container;

  // 攻擊預判 tooltip
  private tooltip: Phaser.GameObjects.Container | null = null;

  // 暫停選單
  private isPaused = false;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;

  // 戰鬥統計（每位玩家武將）
  private battleStats: Record<
    string,
    {
      name: string;
      damageDealt: number;
      kills: number;
      expGained: number;
      levelStart: number;
      levelEnd: number;
    }
  > = {};

  // 戰場藥草（每場 3 個，共用）
  private potionCount = 3;
  private potionText!: Phaser.GameObjects.Text;
  private potionBtn!: Phaser.GameObjects.Container;
  private static readonly POTION_HEAL = 12;
  private static readonly MVP_BONUS_EXP = 5;

  // === 按鈕 debug overlay（暫時開啟以排查 iPhone 上按鈕誤觸 / 失效）===
  // 跑穩之後可把 BTN_DEBUG 切回 false 或整段移除。
  private static readonly BTN_DEBUG = true;
  private debugText: Phaser.GameObjects.Text | null = null;
  private debugLines: string[] = [];

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: BattleSceneInitData): void {
    this.chapterId = data.chapterId ?? '';
    this.scenarioIdOverride = data.scenarioId ?? null;
    // 重置場景狀態（Phaser 會 reuse 同一個 Scene 物件）
    this.units = [];
    this.gameState = 'player_turn';
    this.selection = { kind: 'idle' };
    this.logLines = [];
  }

  create(): void {
    const scenarioId = this.resolveScenarioId();
    this.scenario = SCENARIOS[scenarioId] ?? SCENARIOS[DEFAULT_SCENARIO_ID]!;
    setGridSize(this.scenario.gridWidth, this.scenario.gridHeight);
    setTerrain(
      parseTerrain(this.scenario.terrain, this.scenario.gridWidth, this.scenario.gridHeight)
    );

    // 建立粒子貼圖（白色小圓，會被 tint 染色）
    if (!this.textures.exists('hitParticle')) {
      const tg = this.make.graphics({ x: 0, y: 0 } as never, false);
      tg.fillStyle(0xffffff, 1);
      tg.fillCircle(4, 4, 4);
      tg.generateTexture('hitParticle', 8, 8);
      tg.destroy();
    }

    // 套用章節背景色（用 rectangle 覆蓋整個畫面，比 camera bg 可靠）
    const bgC = this.scenario.bgColor ?? 0x1a1a1a;
    const sceneW = this.scale.width;
    const sceneH = this.scale.height;
    const sceneBg = this.add.rectangle(sceneW / 2, sceneH / 2, sceneW, sceneH, bgC);
    sceneBg.setDepth(-100);

    // 套用動畫速度設定
    const speed = getSettings().animSpeed;
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;

    this.drawBoard();
    this.highlightGfx = this.add.graphics();
    this.highlightGfx.setDepth(5);

    this.deployUnits();
    this.createUI();
    this.bindGlobalInput();

    // 相機：邊界 = 完整棋盤 + UI 區域；初始置中於第一個我方單位
    const cam = this.cameras.main;
    const fullW = BOARD_OFFSET_X + boardWidthPx() + 400; // 留右側 UI 寬度緩衝（面板 + 按鈕）
    const fullH = BOARD_OFFSET_Y + boardHeightPx() + 130;
    cam.setBounds(0, 0, Math.max(fullW, this.scale.width), Math.max(fullH, this.scale.height));
    const firstAlly = this.units.find((u) => u.faction === 'player' && u.isAlive());
    if (firstAlly) {
      const c = firstAlly.getCenterPx();
      cam.centerOn(c.x, c.y);
    }

    this.appendLog(`【${this.scenario.name}】戰鬥開始`);
    // 非預設勝利條件 → 廣播給玩家
    const cond = this.scenario.victoryCondition;
    if (cond === 'survive' && this.scenario.surviveTurns) {
      this.appendLog(`▶ 勝利條件：撐過 ${this.scenario.surviveTurns} 個玩家回合`);
    } else if (cond === 'kill_boss' && this.scenario.bossId) {
      const boss = COMMANDERS[this.scenario.bossId];
      this.appendLog(`▶ 勝利條件：擊殺 ${boss?.name ?? this.scenario.bossId}（雜兵不需清光）`);
    }

    // 啟動章節氛圍 BGM
    const mood = CHAPTER_MOODS[this.chapterId] ?? 'peaceful';
    audio.startBgm(mood);

    // 場景關閉時停止 BGM
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopBgm());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => audio.stopBgm());

    this.startPlayerTurn();
  }

  private resolveScenarioId(): string {
    if (this.scenarioIdOverride) return this.scenarioIdOverride;
    if (this.chapterId) {
      const ch = CHAPTERS[this.chapterId];
      if (ch) return ch.scenarioId;
    }
    return DEFAULT_SCENARIO_ID;
  }

  // ===== 六角棋盤 =====
  private drawBoard(): void {
    const w = getGridWidth();
    const h = getGridHeight();
    const g = this.add.graphics();
    g.setDepth(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const center = hexCenterPx({ x, y });
        const terrain = TERRAIN_TYPES[getTerrainAt({ x, y })];
        // 棋盤交錯色（依列 + 欄）讓相鄰 hex 易於分辨
        const dark = (x + y) % 2 === 0;
        const color = this.shadeColor(terrain.color, dark ? 0.92 : 1.08);
        g.fillStyle(color, 1);
        tracePointyHexPath(g, center.x, center.y, HEX_SIZE);
        g.fillPath();

        g.lineStyle(1, 0x222222, 1);
        tracePointyHexPath(g, center.x, center.y, HEX_SIZE);
        g.strokePath();

        // 非平原 → 加小型地形標誌（hex 底部）
        if (terrain.id !== 'plain') {
          const tx = center.x + HEX_W / 2 - 14;
          const ty = center.y + HEX_H / 2 - 14;
          const t = this.add.text(tx, ty, terrain.shortName, {
            fontSize: '10px',
            color: '#000000',
            fontStyle: 'bold',
            backgroundColor: '#ffffff66',
            padding: { left: 2, right: 2, top: 0, bottom: 0 },
          });
          t.setOrigin(0.5);
          t.setDepth(1);
        }
      }
    }
  }

  private shadeColor(color: number, factor: number): number {
    const r = Math.min(255, Math.max(0, Math.floor(((color >> 16) & 0xff) * factor)));
    const g = Math.min(255, Math.max(0, Math.floor(((color >> 8) & 0xff) * factor)));
    const b = Math.min(255, Math.max(0, Math.floor((color & 0xff) * factor)));
    return (r << 16) | (g << 8) | b;
  }

  // ===== 部署 =====
  private deployUnits(): void {
    const excluded = getExcludedCommanders();
    this.battleStats = {};
    for (const dep of this.scenario.deployments) {
      const cmd = COMMANDERS[dep.commanderId];
      if (!cmd) {
        console.warn(`Unknown commander id: ${dep.commanderId}`);
        continue;
      }
      // 玩家陣營：排除被標為「候補」的武將
      if (cmd.faction === 'player' && excluded.has(cmd.id)) continue;
      // 玩家陣營從存檔載入進度（敵方總是用 starting）
      const progress =
        cmd.faction === 'player' ? getCommanderProgress(cmd.id) ?? undefined : undefined;
      const unit = new Unit(this, cmd, dep.position, progress);
      unit.on('pointerup', () => {
        if (this.didDrag) return;
        this.onUnitClicked(unit);
      });
      unit.on('pointerover', () => this.onUnitHover(unit));
      unit.on('pointerout', () => this.hideTooltip());
      this.units.push(unit);

      // 玩家武將初始化統計
      if (cmd.faction === 'player') {
        this.battleStats[cmd.id] = {
          name: cmd.name,
          damageDealt: 0,
          kills: 0,
          expGained: 0,
          levelStart: unit.level,
          levelEnd: unit.level,
        };
      }
    }
  }

  // ===== UI =====
  private createUI(): void {
    // HUD 重設計（手機優先）：
    //   - 上左：hintText（狀態 / 紅字錯誤回饋）
    //   - 上右：縮放鈕
    //   - 下方資訊條：選中單位的數據（避開右下按鈕區）
    //   - 下右：2x2 大正方形按鈕（結束 / 取消 / 待命 / 藥草），方便手指點擊
    //   - 隱藏：turnText（回合資訊）、potionText（庫存標籤）、logText —
    //     使用者要求簡化 HUD；欄位仍保留以避免 update 點全面改動
    const viewportW = this.scale.width;
    const viewportH = this.scale.height;

    // 隱藏文字：保留欄位 → 既有 setText 點不需要改
    this.turnText = this.add.text(0, 0, '', { fontSize: '1px' }).setVisible(false);
    this.potionText = this.add.text(0, 0, '', { fontSize: '1px' }).setVisible(false);
    this.logText = this.add.text(0, 0, '', { fontSize: '1px' }).setVisible(false);

    // Debug overlay（top-center，最高 depth）：即時顯示 pointer / 按鈕事件、
    // 拖曳/縮放狀態、相機 scroll/zoom，使用者截圖貼回來就能定位失效原因。
    if (BattleScene.BTN_DEBUG) {
      this.debugText = this.add
        .text(viewportW / 2, 10, '(debug)', {
          fontSize: '16px',
          fontFamily: 'Courier New, monospace',
          color: '#9fff9f',
          backgroundColor: '#000000cc',
          padding: { x: 10, y: 6 },
          align: 'left',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(500);
      this.registerUI(this.debugText);
      this.dlog(`scene ready w=${viewportW} h=${viewportH}`);
    }

    // === 上左：hintText（狀態 / 紅字錯誤）===
    this.hintText = this.registerUI(
      this.add
        .text(20, 20, '', {
          fontSize: '26px',
          color: '#bbbbbb',
          lineSpacing: 6,
          wordWrap: { width: 800 },
          fontStyle: 'bold',
        })
        .setScrollFactor(0)
    );

    // === 下方資訊條：選中武將時顯示數據；避開右下按鈕區 ===
    const BTN_SIZE = 130;
    const BTN_GAP = 16;
    const BTN_GRID_W = BTN_SIZE * 2 + BTN_GAP;
    const BTN_GRID_H = BTN_SIZE * 2 + BTN_GAP;
    const BTN_RIGHT_MARGIN = 24;
    const BTN_BOTTOM_MARGIN = 24;
    const btnGridX = viewportW - BTN_GRID_W - BTN_RIGHT_MARGIN;
    const btnGridY = viewportH - BTN_GRID_H - BTN_BOTTOM_MARGIN;

    const infoX = 20;
    const infoY = viewportH - 180;
    const infoW = btnGridX - infoX - 16; // 留 16px 邊距和按鈕區隔開
    this.infoText = this.registerUI(
      this.add
        .text(infoX, infoY, '', {
          fontSize: '22px',
          color: '#dddddd',
          lineSpacing: 6,
          wordWrap: { width: infoW },
        })
        .setScrollFactor(0)
    );

    // === 右下方 2x2 大正方形按鈕 ===
    // 佈局：[結束] [取消]
    //       [待命] [藥草]
    const btnAt = (col: number, row: number) => ({
      x: btnGridX + col * (BTN_SIZE + BTN_GAP),
      y: btnGridY + row * (BTN_SIZE + BTN_GAP),
    });

    {
      const p = btnAt(0, 0);
      this.makeSquareButton(p.x, p.y, BTN_SIZE, '結束\n回合', 0x4a90e2, () => {
        if (this.gameState !== 'player_turn') {
          this.flashHint('現在不是我方回合');
          return;
        }
        if (this.selection.kind !== 'idle') {
          this.flashHint('請先完成或取消選中的武將');
          return;
        }
        this.endPlayerTurn();
      });
    }

    {
      const p = btnAt(1, 0);
      this.cancelBtn = this.makeSquareButton(p.x, p.y, BTN_SIZE, '取消\n選擇', 0x666666, () => {
        this.deselect();
      });
      this.cancelBtn.setVisible(false);
    }

    {
      const p = btnAt(0, 1);
      this.waitBtn = this.makeSquareButton(p.x, p.y, BTN_SIZE, '原地\n待命', 0x90884a, () => {
        if (this.selection.kind === 'action_choice') {
          const u = this.selection.unit;
          u.exhaust();
          this.appendLog(`${u.name} 原地待命`);
          this.deselect();
          this.checkPlayerTurnEnd();
        }
      });
      this.waitBtn.setVisible(false);
    }

    {
      const p = btnAt(1, 1);
      this.potionBtn = this.makeSquareButton(
        p.x,
        p.y,
        BTN_SIZE,
        `藥草\n×${this.potionCount}`,
        0x66bb88,
        () => this.usePotion()
      );
      this.potionBtn.setVisible(false);
    }

    // === 縮放按鈕（畫面右上角）===
    const zoomX = viewportW - 70;
    let zoomY = 40;
    this.makeZoomButton(zoomX, zoomY, '＋', () => this.zoomBy(1.25));
    zoomY += 64;
    this.makeZoomButton(zoomX, zoomY, '⌂', () => this.applyZoom(1.0, viewportW / 2, viewportH / 2));
    zoomY += 64;
    this.makeZoomButton(zoomX, zoomY, '－', () => this.zoomBy(0.8));
  }


  /** 縮放按鈕（鎖在畫面右上角；尺寸放大方便手指點） */
  private makeZoomButton(cx: number, cy: number, label: string, onClick: () => void): void {
    const size = 56;
    const bg = this.add.rectangle(cx, cy, size, size, 0x1a2535, 0.92);
    bg.setStrokeStyle(2, 0x4a90e2);
    bg.setScrollFactor(0);
    bg.setDepth(110);
    this.registerUI(bg);
    const txt = this.add
      .text(cx, cy - 1, label, {
        fontSize: '32px',
        color: '#7ed1ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(111);
    this.registerUI(txt);
    const hit = this.add.rectangle(cx, cy, size, size, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.setScrollFactor(0);
    hit.setDepth(112);
    this.registerUI(hit);
    hit.on('pointerover', () => {
      bg.setFillStyle(0x2a4055);
      txt.setColor('#ffffff');
    });
    hit.on('pointerout', () => {
      bg.setFillStyle(0x1a2535);
      txt.setColor('#7ed1ff');
    });
    hit.on('pointerup', () => {
      if (this.didDrag) return;
      onClick();
    });
  }

  /**
   * 大正方形觸控按鈕（130x130 預設）。手機優先設計：
   * 1. press 狀態只由 pointerdown / pointerup 控制，**不**靠 pointerover/out
   *    來取消（觸控指尖微抖動會頻繁觸發 over/out 把 press 吃掉，過去手機上
   *    「按了沒反應」就是被這條 over/out 吃掉的）。
   * 2. 拖出按鈕後 pointerupoutside 才取消，符合 iOS / Android 原生按鈕觸感。
   * 3. bindGlobalInput 偵測到 pointerdown 落在 UI 元件上時會略過拖曳追蹤，
   *    避免微抖動觸發背景 pan 反向干擾。
   */
  private makeSquareButton(
    x: number,
    y: number,
    size: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, size, size, color);
    bg.setStrokeStyle(3, 0x000000);
    const txt = this.add.text(0, 0, label, {
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    });
    txt.setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, size, size, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    const c = this.add.container(x + size / 2, y + size / 2, [bg, txt, hit]);
    c.setSize(size, size);
    c.setDepth(20);
    // 重要：Container.setScrollFactor 預設不會傳給子物件，但 Phaser 的 hit
    // test 用的是子物件自己的 scrollFactor，不是 container 的。如果只設
    // container 而不設子物件，相機 scrollY != 0（戰鬥開始相機會 centerOn
    // 第一個玩家單位）時 hit area 會跟視覺差一個 scrollY，使用者得點按鈕
    // 上方才會中。第三個 true 參數讓 scrollFactor 同步套到 bg/txt/hit。
    c.setScrollFactor(0, 0, true);
    this.registerUI(c);

    let pressed = false;
    const setNormal = () => {
      bg.setFillStyle(color);
      bg.setScale(1);
      txt.setScale(1);
    };
    const setPressed = () => {
      bg.setFillStyle(this.tint(color, 0.65));
      bg.setScale(0.94);
      txt.setScale(0.94);
    };
    // 取單行純文字 label（去掉換行）給 debug 用
    const dbgLabel = label.replace(/\s+/g, '');
    hit.on('pointerover', (p: Phaser.Input.Pointer) => {
      this.dlog(`btn[${dbgLabel}] OVER pressed=${pressed} p=${p.x.toFixed(0)},${p.y.toFixed(0)}`);
      if (!pressed) bg.setFillStyle(this.tint(color, 1.2));
    });
    hit.on('pointerout', (p: Phaser.Input.Pointer) => {
      this.dlog(`btn[${dbgLabel}] OUT  pressed=${pressed} p=${p.x.toFixed(0)},${p.y.toFixed(0)}`);
      // 重要：不取消 press（觸控微抖動會頻繁觸發 over/out）。
      // 只還原 hover 顏色；press 視覺繼續維持，等 pointerup 或
      // pointerupoutside 才結束。
      if (!pressed) bg.setFillStyle(color);
    });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dlog(`btn[${dbgLabel}] DOWN p=${p.x.toFixed(0)},${p.y.toFixed(0)}`);
      pressed = true;
      setPressed();
      audio.playClick();
    });
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.dlog(`btn[${dbgLabel}] UP   pressed=${pressed} p=${p.x.toFixed(0)},${p.y.toFixed(0)} → ${pressed ? 'CLICK' : 'noop'}`);
      if (!pressed) return;
      pressed = false;
      setNormal();
      onClick();
    });
    hit.on('pointerupoutside', (p: Phaser.Input.Pointer) => {
      this.dlog(`btn[${dbgLabel}] UPOUT pressed=${pressed} p=${p.x.toFixed(0)},${p.y.toFixed(0)}`);
      if (!pressed) return;
      pressed = false;
      setNormal();
      // 不觸發 onClick（手指離開按鈕區才放）
    });
    return c;
  }

  /** Debug overlay：把訊息推到 debugText，最新在最上面，保留最近 14 行 */
  private dlog(msg: string): void {
    if (!BattleScene.BTN_DEBUG || !this.debugText) return;
    const t = (this.time.now / 1000).toFixed(2);
    this.debugLines.unshift(`${t.padStart(7)} ${msg}`);
    if (this.debugLines.length > 14) this.debugLines.length = 14;
    this.debugText.setText(this.debugLines.join('\n'));
  }

  /** 在 hintText 暫時顯示一段紅色提示（給「按了沒反應」的場合用）*/
  private flashHint(msg: string, ms = 1400): void {
    const wasText = this.hintText.text;
    this.hintText.setText(msg);
    this.hintText.setColor('#ff9090');
    this.time.delayedCall(ms, () => {
      // 還原前確認沒被其他邏輯（選單刷新等）覆寫過
      if (this.hintText.text === msg) {
        this.hintText.setText(wasText);
        this.hintText.setColor('#bbbbbb');
      }
    });
  }

  private tint(color: number, factor: number): number {
    return this.shadeColor(color, factor);
  }

  private bindGlobalInput(): void {
    // 啟用第 2 指 pointer，否則手機上 pinch 抓不到（Phaser 預設只啟用 1 個觸控指標）
    this.input.addPointer(1);

    // 全域 pointerup → tile click（沒打到任何 GameObject 時觸發）
    // 改用 pointerup + didDrag 檢查，讓拖曳平移不會誤觸點擊
    this.input.on(
      'pointerup',
      (
        pointer: Phaser.Input.Pointer,
        gameObjects: Phaser.GameObjects.GameObject[]
      ) => {
        this.dlog(`G-UP   objs=${gameObjects.length} drag=${this.didDrag} p=${pointer.x.toFixed(0)},${pointer.y.toFixed(0)}`);
        if (this.isPaused) return;
        if (this.didDrag) return;
        if (gameObjects.length > 0) return;
        if (this.gameState !== 'player_turn') return;
        // 把螢幕座標轉成世界座標（自動考量相機 scroll + zoom）
        const cam = this.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const tile = pixelToTile(world.x, world.y);
        if (!tile) {
          this.deselect();
          return;
        }
        this.onTileClicked(tile);
      }
    );

    // === 拖曳平移：超過 8px 視為 pan，不觸發 click ===
    // === 雙指捏合縮放：兩指同時按下時改成 zoom，不再 pan ===
    this.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
        this.dlog(`G-DOWN objs=${gameObjects.length} p=${p.x.toFixed(0)},${p.y.toFixed(0)} pid=${p.id}`);
        // 落點在 UI 元件（按鈕 hit area）上 → 不啟動單指拖曳。
        // 這修掉「手指微抖動觸發 pan，按鈕 pointerout 取消 press」這條
        // 在手機上常常按不到結束/待命按鈕的根因。
        if (gameObjects.length > 0) {
          this.dragStart = null;
          this.didDrag = false;
          return;
        }
        this.dragStart = { x: p.x, y: p.y };
        this.prevPointerPos = { x: p.x, y: p.y };
        this.didDrag = false;
        // 第二指落下 → 進入 pinch 模式，記錄初始距離與 zoom
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;
        if (p1.isDown && p2.isDown) {
          this.pinchStartDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
          this.pinchStartZoom = this.cameras.main.zoom;
          this.didDrag = true; // 抑制 click（pinch 期間）
          this.dlog(`pinch START dist=${this.pinchStartDist.toFixed(0)}`);
        }
      }
    );
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      // 雙指縮放優先於拖曳平移
      if (p1.isDown && p2.isDown && this.pinchStartDist > 0) {
        const cur = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const ratio = cur / this.pinchStartDist;
        const newZoom = Phaser.Math.Clamp(
          this.pinchStartZoom * ratio,
          BattleScene.ZOOM_MIN,
          BattleScene.ZOOM_MAX
        );
        // 以兩指中點為焦點縮放
        const fx = (p1.x + p2.x) / 2;
        const fy = (p1.y + p2.y) / 2;
        this.applyZoom(newZoom, fx, fy);
        this.didDrag = true;
        // 更新 prev 避免下一幀以舊 prev 計算 delta
        this.prevPointerPos = { x: p.x, y: p.y };
        return;
      }
      // 單指拖曳平移
      if (!this.dragStart || !p.isDown) return;
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      if (!this.didDrag && dx * dx + dy * dy > 64) {
        this.didDrag = true;
        this.dlog(`PAN start dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}`);
      }
      if (this.didDrag && this.prevPointerPos) {
        const cam = this.cameras.main;
        // 用「相對 prev 位置」算 delta（pointer.movementX 在 touch 上不總可靠）
        // 拖曳量除以 zoom，視覺上才會跟手指一致
        cam.scrollX -= (p.x - this.prevPointerPos.x) / cam.zoom;
        cam.scrollY -= (p.y - this.prevPointerPos.y) / cam.zoom;
      }
      this.prevPointerPos = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', () => {
      // 處理「pinch 中放開一指」→ 還有另一指在按 → 應該無縫接到單指拖曳
      // 重新把 dragStart / prevPointerPos 設成那根還在按的指頭目前位置
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      const stillDown = p1.isDown ? p1 : p2.isDown ? p2 : null;
      if (stillDown) {
        this.dragStart = { x: stillDown.x, y: stillDown.y };
        this.prevPointerPos = { x: stillDown.x, y: stillDown.y };
      } else {
        this.dragStart = null;
        this.prevPointerPos = null;
      }
      this.pinchStartDist = 0;
      // didDrag 不在這裡 reset；讓對應的 click handler 看到後再由下次 pointerdown 重置
    });

    // === 滾輪縮放（桌機） ===
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        const cam = this.cameras.main;
        // 滾輪向上 = zoom in；step 每格約 12% 變化
        const step = Math.exp(-deltaY * 0.0015);
        const newZoom = Phaser.Math.Clamp(
          cam.zoom * step,
          BattleScene.ZOOM_MIN,
          BattleScene.ZOOM_MAX
        );
        this.applyZoom(newZoom, pointer.x, pointer.y);
      }
    );

    this.input.keyboard?.on('keydown-R', () => {
      if (this.isPaused) return;
      this.scene.restart();
    });

    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
  }

  // ===== 暫停選單 =====
  private togglePause(): void {
    if (this.gameState === 'victory' || this.gameState === 'defeat') return;
    if (this.isPaused) this.unpause();
    else this.pause();
  }

  private pause(): void {
    this.isPaused = true;
    this.pauseOverlay = this.buildPauseOverlay();
  }

  private unpause(): void {
    this.isPaused = false;
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
  }

  private buildPauseOverlay(): Phaser.GameObjects.Container {
    const w = this.scale.width;
    const h = this.scale.height;
    const items: Phaser.GameObjects.GameObject[] = [];

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.78);
    bg.setInteractive();
    items.push(bg);

    const title = this.add
      .text(w / 2, h / 2 - 150, '— 暫停 —', {
        fontSize: '38px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    items.push(title);

    const subtitle = this.add
      .text(w / 2, h / 2 - 110, '按 ESC 繼續，或選擇下方項目', {
        fontSize: '13px',
        color: '#888888',
      })
      .setOrigin(0.5);
    items.push(subtitle);

    items.push(
      this.makeMenuLabel(w / 2, h / 2 - 50, '繼續遊戲', '#7ed1ff', () => this.unpause())
    );

    const speedTxt = this.makeMenuLabel(
      w / 2,
      h / 2 + 0,
      `動畫速度：${getSettings().animSpeed}x`,
      '#ffffff',
      () => {
        const ns = cycleAnimSpeed();
        this.tweens.timeScale = ns;
        this.time.timeScale = ns;
        speedTxt.setText(`動畫速度：${ns}x`);
      }
    );
    items.push(speedTxt);

    const muteTxt = this.makeMenuLabel(
      w / 2,
      h / 2 + 50,
      `音效：${getSettings().muted ? '關' : '開'}`,
      '#ffffff',
      () => {
        const m = toggleMute();
        muteTxt.setText(`音效：${m ? '關' : '開'}`);
      }
    );
    items.push(muteTxt);

    const diffTxt = this.makeMenuLabel(
      w / 2,
      h / 2 + 100,
      `難度：${difficultyLabel(getSettings().difficulty)}`,
      '#ffaa66',
      () => {
        const d = cycleDifficulty();
        diffTxt.setText(`難度：${difficultyLabel(d)}`);
      }
    );
    items.push(diffTxt);

    const themeTxt = this.makeMenuLabel(
      w / 2,
      h / 2 + 145,
      `主題：${getThemeColors().label}`,
      '#c090e0',
      () => {
        cycleTheme();
        themeTxt.setText(`主題：${getThemeColors().label}`);
      }
    );
    items.push(themeTxt);

    items.push(
      this.makeMenuLabel(w / 2, h / 2 + 200, '回標題', '#cc8888', () => {
        this.unpause();
        this.scene.start('TitleScene');
      })
    );

    const overlay = this.add.container(0, 0, items);
    overlay.setDepth(200);
    return overlay;
  }

  private makeMenuLabel(
    x: number,
    y: number,
    label: string,
    color: string,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const txt = this.add.text(x, y, label, {
      fontSize: '22px',
      color,
      fontStyle: 'bold',
    });
    txt.setOrigin(0.5);
    // 透明 Rectangle 在 text 之上接管輸入
    const w = Math.max(txt.width + 30, 140);
    const h = txt.height + 14;
    const hit = addHitRect(
      this,
      x,
      y,
      w,
      h,
      onClick,
      () => txt.setColor('#ffffff'),
      () => txt.setColor(color)
    );
    hit.setDepth(201); // above pause overlay bg
    return txt;
  }

  // ===== 玩家動作 =====
  private onUnitClicked(unit: Unit): void {
    if (this.isPaused) return;
    if (this.gameState !== 'player_turn') return;

    if (this.selection.kind === 'action_choice') {
      const attacker = this.selection.unit;
      const isValidTarget =
        unit.faction !== attacker.faction &&
        unit.isAlive() &&
        this.selection.attackTargets.some((t) => coordEq(t, unit.position));
      if (isValidTarget) {
        this.selection = { kind: 'busy' };
        this.clearHighlights();
        this.hideTooltip();
        this.waitBtn.setVisible(false);
        void this.executeAttack(attacker, unit).then(() => {
          if (attacker.isAlive()) attacker.exhaust();
          this.deselect();
          if (this.checkBattleEnd()) return;
          this.checkPlayerTurnEnd();
        });
      } else {
        // 點到不能打的單位：別默默吃掉、也別 deselect（會留下沒 exhaust 的 bug）
        this.flashHint('請選攻擊範圍內的敵人，或按「原地待命」');
      }
      return;
    }

    // 已選擇某單位 + 點到自己 → 原地不動進攻擊選擇
    if (this.selection.kind === 'unit_selected' && this.selection.unit === unit) {
      this.onTileClicked(unit.position);
      return;
    }

    // 已選擇某單位 + 點到一個「目前位置直接打得到的敵人」→ 一鍵原地攻擊
    if (this.selection.kind === 'unit_selected' && this.selection.directTargets.includes(unit)) {
      const attacker = this.selection.unit;
      const target = unit;
      this.selection = { kind: 'busy' };
      this.clearHighlights();
      this.cancelBtn.setVisible(false);
      void this.executeAttack(attacker, target).then(() => {
        if (attacker.isAlive()) attacker.exhaust();
        this.deselect();
        if (this.checkBattleEnd()) return;
        this.checkPlayerTurnEnd();
      });
      return;
    }

    if (unit.faction === 'player' && !unit.hasActed) {
      this.selectUnit(unit);
    } else {
      this.showUnitInfo(unit);
    }
  }

  private onUnitHover(unit: Unit): void {
    if (this.isPaused) return;
    // 攻擊選擇中 → 預覽 attackTargets 中的敵人
    if (this.selection.kind === 'action_choice') {
      const attacker = this.selection.unit;
      if (unit.faction === attacker.faction) return;
      if (!this.selection.attackTargets.some((t) => coordEq(t, unit.position))) return;
      this.showDamageTooltip(attacker, unit);
      return;
    }
    // 選定單位中 → 預覽紅圈直接可打的敵人（一鍵原地攻擊前先看後果）
    if (this.selection.kind === 'unit_selected') {
      const attacker = this.selection.unit;
      if (this.selection.directTargets.includes(unit)) {
        this.showDamageTooltip(attacker, unit);
      }
    }
  }

  private onTileClicked(tile: Coord): void {
    if (this.isPaused) return;
    if (this.selection.kind === 'busy') return;
    if (this.selection.kind === 'action_choice') {
      // 移動已執行，必須明確選攻擊目標 / 原地待命 / 用藥草。否則重置會
      // 讓 hasActed 沒被設、單位可以二度被選並再移動（單回合多次移動 bug）
      this.flashHint('請選攻擊目標，或按「原地待命」結束行動');
      return;
    }
    if (this.selection.kind !== 'unit_selected') {
      this.deselect();
      return;
    }
    const sel = this.selection;
    const inRange = sel.reachable.some((c) => coordEq(c, tile));
    if (!inRange) {
      this.deselect();
      return;
    }
    const occupied = this.units.some(
      (u) => u !== sel.unit && u.isAlive() && coordEq(u.position, tile)
    );
    if (occupied) return;
    const unit = sel.unit;
    this.selection = { kind: 'busy' };
    this.clearHighlights();
    this.cancelBtn.setVisible(false);
    void unit.moveTo(tile).then(() => {
      this.enterActionChoice(unit);
    });
  }

  private selectUnit(unit: Unit): void {
    // 大地圖：相機自動置中於選定單位（平滑）
    this.panCameraTo(unit);
    const blocked = this.collectBlockedTiles(unit);
    const moveTiles = bfsReachable(unit.position, unit.moveRange, blocked).filter(
      (c) => !this.units.some((u) => u !== unit && u.isAlive() && coordEq(u.position, c))
    );
    // 把單位目前格子也算進可選範圍 → 點原格 = 原地不動，直接進攻擊選擇
    const reachable: Coord[] = [{ ...unit.position }, ...moveTiles];

    // 從現在位置直接可打到的敵人 → 點下去一次完成「原地攻擊」
    const directTargetTiles = attackTargetTiles(unit.position, unit.attackRange);
    const directTargets = this.units.filter(
      (u) =>
        u.isAlive() &&
        u.faction !== unit.faction &&
        directTargetTiles.some((t) => coordEq(t, u.position))
    );

    this.selection = { kind: 'unit_selected', unit, reachable, directTargets };
    this.drawMoveHighlights(moveTiles, unit.position, directTargets.map((u) => u.position));
    this.cancelBtn.setVisible(true);
    this.waitBtn.setVisible(false);
    this.showUnitInfo(unit);
    const hintLines = ['已選擇「' + unit.name + '」'];
    if (directTargets.length > 0) hintLines.push('點紅圈敵人＝原地攻擊');
    hintLines.push('點綠格移動 / 點黃格不動，或按取消');
    this.hintText.setText(hintLines.join('\n'));
  }

  private enterActionChoice(unit: Unit): void {
    const targets = this.findAttackTargets(unit);
    this.selection = { kind: 'action_choice', unit, attackTargets: targets };
    this.drawAttackHighlights(targets, unit);
    this.waitBtn.setVisible(true);
    this.cancelBtn.setVisible(false);
    // 玩家武將且尚有藥草且未滿 HP → 顯示藥草按鈕
    if (
      unit.faction === 'player' &&
      this.potionCount > 0 &&
      unit.hp < unit.maxHp
    ) {
      this.potionBtn.setVisible(true);
    } else {
      this.potionBtn.setVisible(false);
    }
    this.showUnitInfo(unit);
    if (targets.length > 0) {
      this.hintText.setText(`「${unit.name}」可攻擊\n滑入敵人看預判`);
    } else {
      this.hintText.setText(`「${unit.name}」無敵可擊\n請按「原地待命」。`);
    }
  }

  private deselect(): void {
    this.selection = { kind: 'idle' };
    this.clearHighlights();
    this.hideTooltip();
    this.waitBtn.setVisible(false);
    this.cancelBtn.setVisible(false);
    this.potionBtn.setVisible(false);
    if (this.gameState === 'player_turn') {
      this.hintText.setText('點我方單位（藍）行動，\n或按「結束回合」。');
    }
    this.infoText.setText('');
  }

  private usePotion(): void {
    if (this.selection.kind !== 'action_choice') return;
    if (this.potionCount <= 0) return;
    const u = this.selection.unit;
    if (u.faction !== 'player' || u.hp >= u.maxHp) return;
    const heal = Math.min(BattleScene.POTION_HEAL, u.maxHp - u.hp);
    u.hp += heal;
    u.applyDamage(0); // refresh hp bar via Unit's existing logic
    u.showFloatingText(`+${heal} HP`, '#90ff90', '14px');
    audio.playLevelUp();
    this.potionCount -= 1;
    this.refreshPotionUI();
    this.appendLog(`${u.name} 使用藥草恢復 ${heal} HP`);
    u.exhaust();
    this.deselect();
    this.checkPlayerTurnEnd();
  }

  private refreshPotionUI(): void {
    // potionText 已隱藏（hud 重設計），但保留 setText 不出錯
    this.potionText.setText(`藥草庫存：${this.potionCount}`);
    const txt = this.potionBtn.list.find(
      (c): c is Phaser.GameObjects.Text => c instanceof Phaser.GameObjects.Text
    );
    if (txt) txt.setText(`藥草\n×${this.potionCount}`);
  }

  private collectBlockedTiles(self: Unit): Set<string> {
    const set = new Set<string>();
    for (const u of this.units) {
      if (u === self || !u.isAlive()) continue;
      set.add(coordKey(u.position));
    }
    return set;
  }

  private findAttackTargets(unit: Unit): Coord[] {
    const tiles = attackTargetTiles(unit.position, unit.attackRange);
    return tiles.filter((t) =>
      this.units.some(
        (u) => u.isAlive() && u.faction !== unit.faction && coordEq(u.position, t)
      )
    );
  }

  // ===== 戰鬥 =====
  private async executeAttack(attacker: Unit, defender: Unit): Promise<void> {
    const defenderTerrain = TERRAIN_TYPES[getTerrainAt(defender.position)];
    const result = computeDamage({
      attackerType: attacker.unitType,
      defenderType: defender.unitType,
      attackerAttack: attacker.attack,
      defenderDefense: defender.defense,
      terrainDefBonus: defenderTerrain.defBonus,
      attackerSkillId: attacker.skillId,
      defenderSkillId: defender.skillId,
      attackerFaction: attacker.faction,
      defenderFaction: defender.faction,
      attackerMovedDistance: attacker.lastMoveDistance,
      defenderHpRatio: defender.hp / defender.maxHp,
      enemyAttackMul: getEnemyAttackMul(),
      attackerWeaponHitBonus: attacker.weapon?.hitBonus,
      attackerWeaponCritBonus: attacker.weapon?.critBonus,
    });
    const rolled = rollAttack(result);
    this.playAttackSound(attacker.unitType);
    await attacker.showAttackAnimation(defender);
    const tCenter = defender.getCenterPx();
    if (rolled.hit) {
      audio.playHit();
      this.spawnHitParticles(
        tCenter.x,
        tCenter.y,
        this.particleColorForType(attacker.unitType)
      );
      defender.applyDamage(rolled.damage);
      defender.flashHit();
      const dmgColor = rolled.crit ? '#ffd54a' : '#ff8888';
      const dmgSize = rolled.crit ? '20px' : '16px';
      const dmgText = rolled.crit ? `-${rolled.damage} 爆！` : `-${rolled.damage}`;
      defender.showFloatingText(dmgText, dmgColor, dmgSize);
    } else {
      defender.showFloatingText('MISS', '#dddddd', '16px');
    }
    const tag =
      result.counterLabel === '優勢'
        ? '【剋】'
        : result.counterLabel === '劣勢'
        ? '【弱】'
        : '';
    if (rolled.hit) {
      const critTag = rolled.crit ? '【爆】' : '';
      this.appendLog(`${attacker.name} → ${defender.name} ${rolled.damage} 傷${tag}${critTag}`);
      if (attacker.faction === 'player' && this.battleStats[attacker.id]) {
        this.battleStats[attacker.id].damageDealt += rolled.damage;
        if (!defender.isAlive()) this.battleStats[attacker.id].kills += 1;
      }
      this.grantExp(attacker, rolled.damage, !defender.isAlive());
    } else {
      this.appendLog(`${attacker.name} → ${defender.name} MISS`);
    }
    await this.delay(220);

    if (!defender.isAlive()) {
      this.appendLog(`${defender.name} 撤退！`);
      audio.playUnitDown();
      defender.destroy();
      this.units = this.units.filter((u) => u !== defender);
      return;
    }

    const inCounterRange = attackTargetTiles(defender.position, defender.attackRange).some(
      (c) => coordEq(c, attacker.position)
    );
    if (!inCounterRange) return;

    await this.delay(80);
    const attackerTerrain = TERRAIN_TYPES[getTerrainAt(attacker.position)];
    const counter = computeDamage({
      attackerType: defender.unitType,
      defenderType: attacker.unitType,
      attackerAttack: defender.attack,
      defenderDefense: attacker.defense,
      terrainDefBonus: attackerTerrain.defBonus,
      attackerSkillId: defender.skillId,
      defenderSkillId: attacker.skillId,
      attackerFaction: defender.faction,
      defenderFaction: attacker.faction,
      attackerMovedDistance: 0, // 反擊不算移動加成
      defenderHpRatio: attacker.hp / attacker.maxHp,
      enemyAttackMul: getEnemyAttackMul(),
      attackerWeaponHitBonus: defender.weapon?.hitBonus,
      attackerWeaponCritBonus: defender.weapon?.critBonus,
    });
    const counterRolled = rollAttack(counter);
    this.playAttackSound(defender.unitType);
    await defender.showAttackAnimation(attacker);
    const aCenter = attacker.getCenterPx();
    if (counterRolled.hit) {
      audio.playHit();
      this.spawnHitParticles(
        aCenter.x,
        aCenter.y,
        this.particleColorForType(defender.unitType)
      );
      attacker.applyDamage(counterRolled.damage);
      attacker.flashHit();
      const dmgColor = counterRolled.crit ? '#ffd54a' : '#ff8888';
      const dmgSize = counterRolled.crit ? '20px' : '16px';
      const dmgText = counterRolled.crit
        ? `-${counterRolled.damage} 爆！`
        : `-${counterRolled.damage}`;
      attacker.showFloatingText(dmgText, dmgColor, dmgSize);
    } else {
      attacker.showFloatingText('MISS', '#dddddd', '16px');
    }
    const ctag =
      counter.counterLabel === '優勢'
        ? '【剋】'
        : counter.counterLabel === '劣勢'
        ? '【弱】'
        : '';
    if (counterRolled.hit) {
      const critTag = counterRolled.crit ? '【爆】' : '';
      this.appendLog(
        `${defender.name} 反擊 ${attacker.name} ${counterRolled.damage} 傷${ctag}${critTag}`
      );
      if (defender.faction === 'player' && this.battleStats[defender.id]) {
        this.battleStats[defender.id].damageDealt += counterRolled.damage;
        if (!attacker.isAlive()) this.battleStats[defender.id].kills += 1;
      }
      this.grantExp(defender, counterRolled.damage, !attacker.isAlive());
    } else {
      this.appendLog(`${defender.name} 反擊 ${attacker.name} MISS`);
    }
    await this.delay(220);

    if (!attacker.isAlive()) {
      this.appendLog(`${attacker.name} 撤退！`);
      audio.playUnitDown();
      attacker.destroy();
      this.units = this.units.filter((u) => u !== attacker);
    }
  }

  private spawnHitParticles(x: number, y: number, tint: number): void {
    const emitter = this.add.particles(x, y, 'hitParticle', {
      speed: { min: 60, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 380,
      scale: { start: 1.0, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
      emitting: false,
    });
    emitter.setDepth(60);
    emitter.explode(12);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  private particleColorForType(type: import('./types').UnitTypeId): number {
    switch (type) {
      case 'sword': return 0xffe066;
      case 'lance': return 0xa0d0a0;
      case 'cavalry': return 0xffaa44;
      case 'archer': return 0xa0c8ff;
      case 'mage': return 0xff77ff;
      case 'flier': return 0xffffff;
    }
  }

  private playAttackSound(type: import('./types').UnitTypeId): void {
    switch (type) {
      case 'sword': audio.playSwordSwing(); break;
      case 'lance': audio.playLanceThrust(); break;
      case 'cavalry': audio.playLanceThrust(); break;
      case 'archer': audio.playArrowShot(); break;
      case 'mage': audio.playMagicCast(); break;
      case 'flier': audio.playSwordSwing(); break;
    }
  }

  private grantExp(unit: Unit, damageDealt: number, killed: boolean): void {
    const expGain = damageDealt * EXP_PER_DAMAGE + (killed ? EXP_PER_KILL : 0);
    if (expGain <= 0) return;
    const beforeLv = unit.level;
    const result = unit.gainExp(expGain);
    unit.showFloatingText(`+${expGain} EXP`, '#ffe066', '12px');
    if (unit.faction === 'player' && this.battleStats[unit.id]) {
      this.battleStats[unit.id].expGained += expGain;
      this.battleStats[unit.id].levelEnd = unit.level;
    }
    if (result && result.toLevel > beforeLv) {
      unit.showFloatingText(`升級！LV ${result.toLevel}`, '#90ff90', '14px');
      this.appendLog(
        `${unit.name} 升級 → LV ${result.toLevel}（HP+${result.hpGain} 攻+${result.attackGain} 防+${result.defenseGain}）`
      );
      audio.playLevelUp();
    }
  }

  /** 平滑把相機鏡頭移到指定單位中心（不會打斷玩家當下的拖曳）*/
  private panCameraTo(unit: Unit): void {
    const c = unit.getCenterPx();
    const cam = this.cameras.main;
    // pan 期間若使用者在拖曳，pan 會被繼續的 scroll 蓋掉，沒關係
    cam.pan(c.x, c.y, 280, 'Sine.easeInOut');
  }

  /**
   * 改變 zoom 同時保持指定螢幕點（focal）對應的世界座標不變。
   * 縮放才不會讓焦點飄走。
   */
  private applyZoom(newZoom: number, focalScreenX: number, focalScreenY: number): void {
    const cam = this.cameras.main;
    // 縮放前焦點對應的世界座標
    const worldBefore = cam.getWorldPoint(focalScreenX, focalScreenY);
    cam.zoom = newZoom;
    // 縮放後重新算焦點對應的世界座標
    const worldAfter = cam.getWorldPoint(focalScreenX, focalScreenY);
    // 把鏡頭推回去，讓焦點世界座標一致
    cam.scrollX += worldBefore.x - worldAfter.x;
    cam.scrollY += worldBefore.y - worldAfter.y;
    // UI 反比縮放：讓按鈕／側欄不會跟著相機放大縮小（夾住下限避免按鈕變太小不能點）
    this.refreshUIScale();
    this.dlog(`ZOOM ${newZoom.toFixed(2)} scroll=${cam.scrollX.toFixed(0)},${cam.scrollY.toFixed(0)}`);
  }

  /**
   * 把 UI 套用反比 scale + 反比 position，讓相機縮放完全不影響 UI 視覺。
   *
   * Phaser 相機預設 origin (0.5, 0.5) → zoom 是從畫面「中心」擴張，
   * 所以 scrollFactor=0 物件在螢幕的位置是：
   *    sx = (objX - cx) * z + cx        其中 cx = canvas 中心 x
   *
   * 反推「想固定螢幕位置 = baseX」需要：
   *    objX = cx + (baseX - cx) / z
   *    objScale = 1 / z
   *
   * 之前寫成 objX = baseX / z（誤以為相機從 (0,0) 擴張），導致按 + 後
   * 所有 UI 往畫面中央縮 ~zoom 倍距離。
   */
  private refreshUIScale(): void {
    const z = this.cameras.main.zoom;
    const inv = 1 / z;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    for (const item of this.uiElements) {
      const obj = item.obj as Phaser.GameObjects.GameObject & {
        setScale?: (s: number) => unknown;
        x?: number;
        y?: number;
      };
      if (obj.setScale) obj.setScale(inv);
      if ('x' in obj) obj.x = cx + (item.baseX - cx) * inv;
      if ('y' in obj) obj.y = cy + (item.baseY - cy) * inv;
    }
  }

  /** 把一個 UI 元件登記到清單；以登記當下的 (x, y) 為「畫面基準位置」 */
  private registerUI<T extends Phaser.GameObjects.GameObject>(el: T): T {
    const o = el as T & { x?: number; y?: number };
    this.uiElements.push({
      obj: el,
      baseX: o.x ?? 0,
      baseY: o.y ?? 0,
    });
    return el;
  }

  /** 從 UI 按鈕呼叫：以視窗中心為焦點縮放 */
  private zoomBy(factor: number): void {
    const cam = this.cameras.main;
    const newZoom = Phaser.Math.Clamp(
      cam.zoom * factor,
      BattleScene.ZOOM_MIN,
      BattleScene.ZOOM_MAX
    );
    this.applyZoom(newZoom, this.scale.width / 2, this.scale.height / 2);
  }

  // ===== 高亮 =====
  private drawMoveHighlights(
    tiles: Coord[],
    stayTile?: Coord,
    directAttackTiles: Coord[] = []
  ): void {
    this.clearHighlights();
    // 一般可移動格：綠色
    this.highlightGfx.fillStyle(0x4ae26a, 0.32);
    this.highlightGfx.lineStyle(2, 0x4ae26a, 0.9);
    for (const t of tiles) {
      const center = hexCenterPx(t);
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.fillPath();
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.strokePath();
    }
    // 原地不動格：黃色（提醒玩家可以原地行動 = 直接攻擊/治療/待命）
    if (stayTile) {
      const center = hexCenterPx(stayTile);
      this.highlightGfx.fillStyle(0xffd700, 0.28);
      this.highlightGfx.lineStyle(2, 0xffd700, 0.95);
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.fillPath();
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.strokePath();
    }
    // 從目前位置直接可攻擊的敵人：紅色粗框（不填色，避免遮住敵方 sprite）
    if (directAttackTiles.length > 0) {
      this.highlightGfx.lineStyle(3, 0xff3344, 0.95);
      for (const t of directAttackTiles) {
        const center = hexCenterPx(t);
        tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 1);
        this.highlightGfx.strokePath();
      }
    }
  }

  private drawAttackHighlights(tiles: Coord[], attacker: Unit): void {
    this.clearHighlights();
    for (const t of tiles) {
      const target = this.units.find(
        (u) => u.isAlive() && u.faction !== attacker.faction && coordEq(u.position, t)
      );
      const center = hexCenterPx(t);
      let color = 0xe24a4a;
      if (target) {
        const c = getCounter(attacker.unitType, target.unitType);
        if (c.label === '優勢') color = 0xff9530;
        else if (c.label === '劣勢') color = 0x9e7ee2;
      }
      this.highlightGfx.fillStyle(color, 0.4);
      this.highlightGfx.lineStyle(3, color, 0.95);
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.fillPath();
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.strokePath();
    }
  }

  private clearHighlights(): void {
    this.highlightGfx.clear();
  }

  // ===== 攻擊預判 tooltip =====
  private showDamageTooltip(attacker: Unit, defender: Unit): void {
    this.hideTooltip();
    const defT = TERRAIN_TYPES[getTerrainAt(defender.position)];
    const atkT = TERRAIN_TYPES[getTerrainAt(attacker.position)];
    const ourHit = computeDamage({
      attackerType: attacker.unitType,
      defenderType: defender.unitType,
      attackerAttack: attacker.attack,
      defenderDefense: defender.defense,
      terrainDefBonus: defT.defBonus,
      attackerSkillId: attacker.skillId,
      defenderSkillId: defender.skillId,
      attackerFaction: attacker.faction,
      defenderFaction: defender.faction,
      attackerMovedDistance: attacker.lastMoveDistance,
      defenderHpRatio: defender.hp / defender.maxHp,
      enemyAttackMul: getEnemyAttackMul(),
      attackerWeaponHitBonus: attacker.weapon?.hitBonus,
      attackerWeaponCritBonus: attacker.weapon?.critBonus,
    });
    const counterRange = attackTargetTiles(defender.position, defender.attackRange).some(
      (c) => coordEq(c, attacker.position)
    );
    const counterHit = counterRange
      ? computeDamage({
          attackerType: defender.unitType,
          defenderType: attacker.unitType,
          attackerAttack: defender.attack,
          defenderDefense: attacker.defense,
          terrainDefBonus: atkT.defBonus,
          attackerSkillId: defender.skillId,
          defenderSkillId: attacker.skillId,
          attackerFaction: defender.faction,
          defenderFaction: attacker.faction,
          attackerMovedDistance: 0,
          defenderHpRatio: attacker.hp / attacker.maxHp,
          attackerWeaponHitBonus: defender.weapon?.hitBonus,
          attackerWeaponCritBonus: defender.weapon?.critBonus,
        })
      : null;

    const tag = (lbl: '優勢' | '劣勢' | '普通') =>
      lbl === '優勢' ? '【剋】' : lbl === '劣勢' ? '【弱】' : '';

    // 計算戰後 HP 與致命結果
    const defHpAfter = Math.max(0, defender.hp - ourHit.damage);
    const willKill = defHpAfter === 0;
    const atkHpAfter = counterHit ? Math.max(0, attacker.hp - counterHit.damage) : attacker.hp;
    const willDie = counterHit ? atkHpAfter === 0 : false;

    const killBadge = willKill ? '　★擊殺' : '';
    const deathBadge = willDie ? '　⚠致命！' : '';

    const fmtHitCrit = (r: { hitRate: number; critRate: number }) =>
      `命中 ${r.hitRate}% / 爆 ${r.critRate}%`;

    const lines = [
      `${attacker.name} → ${defender.name}`,
      `傷害 ${ourHit.damage}${tag(ourHit.counterLabel)}　(剩 ${defHpAfter}/${defender.maxHp})${killBadge}`,
      `　${fmtHitCrit(ourHit)}`,
      counterHit
        ? `反擊 ${counterHit.damage}${tag(counterHit.counterLabel)}　(剩 ${atkHpAfter}/${attacker.maxHp})${deathBadge}`
        : `對方無法反擊`,
      counterHit ? `　${fmtHitCrit(counterHit)}` : '',
    ].filter((s) => s.length > 0);

    // 主色調：致命=紅警告，擊殺=金，一般=白
    const mainColor = willDie ? '#ff6666' : willKill ? '#ffd54a' : '#ffffff';

    const text = this.add.text(0, 0, lines.join('\n'), {
      fontSize: '13px',
      color: mainColor,
      lineSpacing: 4,
      padding: { left: 8, right: 8, top: 6, bottom: 6 },
      backgroundColor: '#000000c8',
      fontStyle: willDie || willKill ? 'bold' : 'normal',
    });
    const w = text.width;
    const h = text.height;
    // 放在敵人上方
    const defCenter = hexCenterPx(defender.position);
    let tx = defCenter.x - w / 2;
    let ty = defCenter.y - HEX_H / 2 - h - 6;
    // 邊界保護
    tx = Math.max(4, Math.min(tx, BOARD_OFFSET_X + boardWidthPx() - w - 4));
    if (ty < 4) ty = defCenter.y + HEX_H / 2 + 4;
    text.setPosition(tx, ty);
    text.setDepth(50);
    this.tooltip = this.add.container(0, 0, [text]);
    this.tooltip.setDepth(50);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  // ===== 武將資訊面板 =====
  private showUnitInfo(unit: Unit): void {
    const utype = UNIT_TYPES[unit.unitType];
    const factionLabel = unit.faction === 'player' ? '我方' : '敵方';
    const terrain = TERRAIN_TYPES[getTerrainAt(unit.position)];
    const weaponLine = unit.weapon
      ? `${unit.weapon.name}（+${unit.weapon.atk} 攻）`
      : '無';
    const armorLine = unit.armor
      ? `${unit.armor.name}（+${unit.armor.def} 防 +${unit.armor.hpBonus} HP）`
      : '無';
    // 緊湊 4 行格式，配合底部資訊條（約 160px 高）的有限縱空間
    const lines = [
      `${unit.name}　LV ${unit.level}　${factionLabel}　${utype.name}　所在：${terrain.name}（防+${terrain.defBonus}）`,
      `HP ${unit.hp}/${unit.maxHp}　攻 ${unit.attack}　防 ${unit.defense}　移 ${unit.moveRange}　射 ${unit.attackRange}　EXP ${unit.exp}/20`,
      `武器：${weaponLine}　／　防具：${armorLine}`,
      `特技：${unit.skillName}　${unit.skillDesc}`,
    ];
    this.infoText.setText(lines.join('\n'));
  }

  // ===== 回合制 =====
  private startPlayerTurn(): void {
    this.gameState = 'player_turn';
    for (const u of this.units) {
      if (u.faction === 'player') u.resetTurn();
    }
    // survive 條件 → 顯示「回合 X / N」並判定是否撐到通關
    if (this.scenario.victoryCondition === 'survive' && this.scenario.surviveTurns) {
      this.turnText
        .setText(`你的回合（${this.playerTurnNumber} / ${this.scenario.surviveTurns}）`)
        .setColor('#7ed1ff');
      if (this.playerTurnNumber > this.scenario.surviveTurns) {
        this.gameOver(true);
        return;
      }
    } else {
      this.turnText.setText('你的回合').setColor('#7ed1ff');
    }
    this.deselect();
  }

  private checkPlayerTurnEnd(): void {
    const players = this.units.filter((u) => u.faction === 'player' && u.isAlive());
    if (players.length === 0) return;
    if (players.every((u) => u.hasActed)) this.endPlayerTurn();
  }

  private endPlayerTurn(): void {
    if (this.gameState !== 'player_turn') return;
    this.gameState = 'enemy_turn';
    this.playerTurnNumber += 1;
    this.turnText.setText('敵方回合').setColor('#ff8080');
    this.clearHighlights();
    this.waitBtn.setVisible(false);
    this.cancelBtn.setVisible(false);
    this.hintText.setText('敵方行動中…');
    void this.runEnemyTurn();
  }

  private async runEnemyTurn(): Promise<void> {
    const enemies = this.units.filter((u) => u.faction === 'enemy' && u.isAlive());
    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      await this.delay(360);
      await this.runEnemyAction(enemy);
      if (this.checkBattleEnd()) return;
    }
    await this.delay(280);
    this.startPlayerTurn();
  }

  private async runEnemyAction(enemy: Unit): Promise<void> {
    const players = this.units.filter((u) => u.faction === 'player' && u.isAlive());
    if (players.length === 0) return;
    // 敵方行動時相機平滑移到該敵兵，讓玩家看見 AI 在做什麼
    this.panCameraTo(enemy);

    // 預估從某格攻擊某玩家會打多少傷害（不擲骰，用期望值：dmg × hitRate%）
    const predictDamage = (
      attacker: Unit,
      defender: Unit,
      fromMovedDistance: number
    ): { expected: number; raw: number; canKill: boolean } => {
      const defTerrain = TERRAIN_TYPES[getTerrainAt(defender.position)];
      const r = computeDamage({
        attackerType: attacker.unitType,
        defenderType: defender.unitType,
        attackerAttack: attacker.attack,
        defenderDefense: defender.defense,
        terrainDefBonus: defTerrain.defBonus,
        attackerSkillId: attacker.skillId,
        defenderSkillId: defender.skillId,
        attackerFaction: attacker.faction,
        defenderFaction: defender.faction,
        attackerMovedDistance: fromMovedDistance,
        defenderHpRatio: defender.hp / defender.maxHp,
        enemyAttackMul: getEnemyAttackMul(),
        attackerWeaponHitBonus: attacker.weapon?.hitBonus,
        attackerWeaponCritBonus: attacker.weapon?.critBonus,
      });
      const expected = (r.damage * r.hitRate) / 100;
      return { expected, raw: r.damage, canKill: r.damage >= defender.hp };
    };

    // 對某玩家從目前位置（或某新位置）的反擊期望傷害
    const predictCounterIfWeAttack = (
      attacker: Unit,
      defender: Unit,
      attackerPos: Coord
    ): number => {
      const inCounterRange = attackTargetTiles(defender.position, defender.attackRange).some(
        (c) => coordEq(c, attackerPos)
      );
      if (!inCounterRange) return 0;
      const atkTerrain = TERRAIN_TYPES[getTerrainAt(attackerPos)];
      const r = computeDamage({
        attackerType: defender.unitType,
        defenderType: attacker.unitType,
        attackerAttack: defender.attack,
        defenderDefense: attacker.defense,
        terrainDefBonus: atkTerrain.defBonus,
        attackerSkillId: defender.skillId,
        defenderSkillId: attacker.skillId,
        attackerFaction: defender.faction,
        defenderFaction: attacker.faction,
        attackerMovedDistance: 0,
        defenderHpRatio: attacker.hp / attacker.maxHp,
        attackerWeaponHitBonus: defender.weapon?.hitBonus,
        attackerWeaponCritBonus: defender.weapon?.critBonus,
      });
      return (r.damage * r.hitRate) / 100;
    };

    // 第 1 步：選目標（優先剋制 + 殘血 + 接近）
    let bestTarget: Unit | null = null;
    let bestScore = -Infinity;
    for (const p of players) {
      const counter = getCounter(enemy.unitType, p.unitType);
      const dist = manhattan(enemy.position, p.position);
      const lowHpBonus = (1 - p.hp / p.maxHp) * 25; // 殘血加成提高，鼓勵集火
      // 預判從目前位置直接打他能造成多少傷害（不考慮位移加成）
      const pred = predictDamage(enemy, p, 0);
      let s = pred.expected * 4 + (counter.multiplier - 1) * 60 - dist + lowHpBonus;
      if (pred.canKill) s += 200; // 殘血可一擊必殺 → 強烈優先
      if (s > bestScore) {
        bestScore = s;
        bestTarget = p;
      }
    }
    if (!bestTarget) return;
    const target = bestTarget;

    const inRangeFrom = (from: Coord): boolean =>
      attackTargetTiles(from, enemy.attackRange).some((c) => coordEq(c, target.position));

    // 第 2 步：選位置
    const blocked = this.collectBlockedTiles(enemy);
    const reachable = bfsReachable(enemy.position, enemy.moveRange, blocked);
    const standable: Coord[] = [
      { ...enemy.position }, // 原地不動也是選項
      ...reachable.filter(
        (c) => !this.units.some((u) => u !== enemy && u.isAlive() && coordEq(u.position, c))
      ),
    ];

    let bestTile: Coord | null = null;
    let bestTileScore = -Infinity;
    for (const tile of standable) {
      const canAttack = inRangeFrom(tile);
      const moveDist = manhattan(tile, enemy.position);
      const tileTerrain = TERRAIN_TYPES[getTerrainAt(tile)];
      let score = 0;

      if (canAttack) {
        const myDmg = predictDamage(enemy, target, moveDist);
        const counterDmg = predictCounterIfWeAttack(enemy, target, tile);
        const willKill = myDmg.canKill;
        const willDie = counterDmg >= enemy.hp;

        score += myDmg.expected * 5;
        if (willKill) score += 300;
        if (willDie && !willKill) score -= 250; // 自殺式進攻嚴懲
        score += tileTerrain.defBonus * 4; // 偏好高 DEF 地形
        score += 50; // 比起逼近，能攻擊就直接攻擊
      } else {
        // 不能攻擊 → 越接近目標越好（負距離，越大越好）
        score = -manhattan(tile, target.position) * 4;
        score += tileTerrain.defBonus * 2; // 仍輕微偏好掩體
      }
      if (score > bestTileScore) {
        bestTileScore = score;
        bestTile = tile;
      }
    }

    if (bestTile && !coordEq(bestTile, enemy.position)) {
      await enemy.moveTo(bestTile);
    }

    if (enemy.isAlive() && target.isAlive() && inRangeFrom(enemy.position)) {
      await this.delay(160);
      await this.executeAttack(enemy, target);
    }
  }

  // ===== 勝負 =====
  private checkBattleEnd(): boolean {
    const playerAlive = this.units.some((u) => u.faction === 'player' && u.isAlive());
    if (!playerAlive) {
      this.gameOver(false);
      return true;
    }

    const cond = this.scenario.victoryCondition;
    if (cond === 'kill_boss') {
      // 指定 BOSS 死即勝；雜兵還在不影響
      const bossId = this.scenario.bossId;
      const bossAlive =
        bossId !== undefined &&
        this.units.some((u) => u.id === bossId && u.faction === 'enemy' && u.isAlive());
      if (!bossAlive) {
        this.gameOver(true);
        return true;
      }
      return false;
    }

    if (cond === 'survive') {
      // 全滅敵方仍視為勝（給玩家提早結束的選項）；否則靠 startPlayerTurn 的回合數判斷
      const enemyAlive = this.units.some((u) => u.faction === 'enemy' && u.isAlive());
      if (!enemyAlive) {
        this.gameOver(true);
        return true;
      }
      return false;
    }

    // 'rout' （預設）— 全滅敵方即勝
    const enemyAlive = this.units.some((u) => u.faction === 'enemy' && u.isAlive());
    if (!enemyAlive) {
      this.gameOver(true);
      return true;
    }
    return false;
  }

  private gameOver(victory: boolean): void {
    this.gameState = victory ? 'victory' : 'defeat';
    this.clearHighlights();
    this.hideTooltip();
    this.waitBtn.setVisible(false);
    this.cancelBtn.setVisible(false);

    const cx = BOARD_OFFSET_X + boardWidthPx() / 2;
    const cy = BOARD_OFFSET_Y + boardHeightPx() / 2;
    const overlay = this.add.rectangle(cx, cy, boardWidthPx(), boardHeightPx(), 0x000000, 0.65);
    overlay.setDepth(100);

    const title = this.add.text(cx, cy - 24, victory ? '勝利！' : '戰敗', {
      fontSize: '52px',
      color: victory ? '#7ed17e' : '#ff8080',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(101);

    const sub = this.add.text(cx, cy + 36, '按 R 重新開始', {
      fontSize: '18px',
      color: '#ffffff',
    });
    sub.setOrigin(0.5);
    sub.setDepth(101);

    this.appendLog(victory ? '所有敵人撤退 — 勝利！' : '我方全滅 — 戰敗。');
    this.hintText.setText(victory ? '勝利！結算中…' : '戰敗。即將回到劇情…');
    if (victory) audio.playVictory(); else audio.playDefeat();

    if (victory) {
      // 勝利 → 顯示結算 → 等玩家點擊繼續 → 進入劇情
      this.time.delayedCall(1200, () => this.showBattleResults());
    } else {
      // 戰敗 → 直接進入失敗劇情
      this.time.delayedCall(2400, () => this.transitionAfterBattle(false));
    }
  }

  private showBattleResults(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const items: Phaser.GameObjects.GameObject[] = [];

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.92);
    bg.setInteractive();
    items.push(bg);

    const title = this.add
      .text(w / 2, 60, '— 戰鬥結算 —', {
        fontSize: '32px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    items.push(title);

    // 找出 MVP（傷害最高）+ 給予 +5 EXP 獎勵
    const stats = Object.values(this.battleStats);
    let mvpId: string | null = null;
    let maxDmg = 0;
    for (const [id, s] of Object.entries(this.battleStats)) {
      if (s.damageDealt > maxDmg) {
        maxDmg = s.damageDealt;
        mvpId = id;
      }
    }
    if (mvpId) {
      const mvpUnit = this.units.find((u) => u.id === mvpId);
      const mvpStats = this.battleStats[mvpId];
      if (mvpUnit && mvpStats && mvpUnit.isAlive()) {
        mvpUnit.gainExp(BattleScene.MVP_BONUS_EXP);
        mvpStats.expGained += BattleScene.MVP_BONUS_EXP;
        mvpStats.levelEnd = mvpUnit.level;
      }
    }

    // 表頭
    const headerY = 130;
    const cols = [
      { x: 90, label: '武將', align: 'left' as const },
      { x: 250, label: '傷害', align: 'right' as const },
      { x: 360, label: '擊殺', align: 'right' as const },
      { x: 470, label: 'EXP', align: 'right' as const },
      { x: 590, label: '等級', align: 'right' as const },
    ];
    for (const col of cols) {
      const t = this.add.text(col.x, headerY, col.label, {
        fontSize: '15px',
        color: '#aaaaaa',
        fontStyle: 'bold',
      });
      if (col.align === 'right') t.setOrigin(1, 0);
      items.push(t);
    }
    const sepLine = this.add.graphics();
    sepLine.lineStyle(1, 0x666666, 0.6);
    sepLine.lineBetween(60, headerY + 24, 620, headerY + 24);
    items.push(sepLine);

    // 各武將一列
    let rowY = headerY + 36;
    for (const [id, s] of Object.entries(this.battleStats)) {
      const isMvp = id === mvpId && s.damageDealt > 0;
      const color = isMvp ? '#ffd700' : '#ffffff';
      const fontStyle = isMvp ? 'bold' : 'normal';
      const nameLabel = isMvp ? `★ ${s.name}` : `  ${s.name}`;
      const lvLabel = s.levelEnd > s.levelStart
        ? `LV ${s.levelStart} → ${s.levelEnd}`
        : `LV ${s.levelEnd}`;

      const cells = [
        { x: 90, text: nameLabel, align: 'left' as const },
        { x: 250, text: String(s.damageDealt), align: 'right' as const },
        { x: 360, text: String(s.kills), align: 'right' as const },
        { x: 470, text: `+${s.expGained}`, align: 'right' as const },
        { x: 590, text: lvLabel, align: 'right' as const },
      ];
      for (const cell of cells) {
        const t = this.add.text(cell.x, rowY, cell.text, {
          fontSize: '15px',
          color,
          fontStyle,
        });
        if (cell.align === 'right') t.setOrigin(1, 0);
        items.push(t);
      }
      rowY += 30;
    }

    // 總結文字
    const totalDmg = stats.reduce((sum, s) => sum + s.damageDealt, 0);
    const totalKills = stats.reduce((sum, s) => sum + s.kills, 0);
    const totalLvUps = stats.reduce(
      (sum, s) => sum + (s.levelEnd - s.levelStart),
      0
    );
    const summary = this.add
      .text(
        w / 2,
        rowY + 30,
        `總傷害 ${totalDmg}　·　擊殺 ${totalKills}　·　升級 ${totalLvUps} 次`,
        {
          fontSize: '15px',
          color: '#bbbbbb',
        }
      )
      .setOrigin(0.5);
    items.push(summary);

    // 繼續按鈕
    const btnY = h - 60;
    const btnTxt = this.add
      .text(w / 2, btnY, '▶ 繼續', {
        fontSize: '24px',
        color: '#7ed1ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    items.push(btnTxt);
    const btnHit = this.add.rectangle(w / 2, btnY, 200, 48, 0x000000, 0);
    btnHit.setInteractive({ useHandCursor: true });
    btnHit.on('pointerover', () => btnTxt.setColor('#ffffff'));
    btnHit.on('pointerout', () => btnTxt.setColor('#7ed1ff'));
    items.push(btnHit);

    const overlay = this.add.container(0, 0, items);
    overlay.setDepth(250);

    btnHit.on('pointerdown', () => {
      overlay.destroy();
      this.transitionAfterBattle(true);
    });
  }

  private transitionAfterBattle(victory: boolean): void {
    if (!this.chapterId) {
      this.scene.start('TitleScene');
      return;
    }
    const ch = CHAPTERS[this.chapterId];
    if (!ch) {
      this.scene.start('TitleScene');
      return;
    }
    if (victory) {
      // 存檔：紀錄章節完成 + 武將進度
      const playerProgress: Record<string, CommanderProgress> = {};
      for (const u of this.units) {
        if (u.faction === 'player') {
          playerProgress[u.id] = { level: u.level, exp: u.exp };
        }
      }
      saveProgress(ch.id, ch.nextChapterId ?? null, playerProgress);

      // 成就：章節完成
      const chAch = CHAPTER_COMPLETE_ACHIEVEMENT[ch.id];
      if (chAch) tryUnlockAchievement(this, chAch);

      // 成就：無傷通過（玩家全部 5 個都健在 — 此處檢查是否仍與部署人數相同）
      const playerInitialCount = this.scenario.deployments.filter(
        (d) => {
          const cmd = COMMANDERS[d.commanderId];
          return cmd?.faction === 'player';
        }
      ).length;
      const playerAliveCount = this.units.filter(
        (u) => u.faction === 'player' && u.isAlive()
      ).length;
      if (playerAliveCount === playerInitialCount && playerInitialCount > 0) {
        tryUnlockAchievement(this, 'no_loss_chapter');
      }

      // 成就：等級
      for (const u of this.units) {
        if (u.faction !== 'player') continue;
        if (u.level >= 15) tryUnlockAchievement(this, 'lvl_15');
        if (u.level >= 10) tryUnlockAchievement(this, 'lvl_10');
      }

      // 後續銜接：勝利過場 → 下一章序章 → Hub → 戰鬥；無下一章則回標題
      const nextChapter = ch.nextChapterId ? CHAPTERS[ch.nextChapterId] : null;
      const next = nextChapter
        ? {
            scene: 'CutsceneScene',
            data: {
              cutsceneId: nextChapter.prologueCutsceneId,
              next: { scene: 'HubScene', data: { chapterId: nextChapter.id } },
            },
          }
        : { scene: 'TitleScene' };
      this.scene.start('CutsceneScene', {
        cutsceneId: ch.victoryCutsceneId,
        next,
      });
    } else {
      const cutsceneId = ch.defeatCutsceneId;
      if (cutsceneId) {
        this.scene.start('CutsceneScene', {
          cutsceneId,
          next: { scene: 'TitleScene' },
        });
      } else {
        this.scene.start('TitleScene');
      }
    }
  }

  // ===== utils =====
  private appendLog(msg: string): void {
    this.logLines.push(msg);
    while (this.logLines.length > 5) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, () => r()));
  }
}
