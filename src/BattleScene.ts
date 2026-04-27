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
import { computeDamage } from './battle/DamageCalculator';
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
  | { kind: 'unit_selected'; unit: Unit; reachable: Coord[] }
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

    this.appendLog(`【${this.scenario.name}】戰鬥開始`);

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
      unit.on('pointerdown', () => this.onUnitClicked(unit));
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
    this.turnText = this.add.text(BOARD_OFFSET_X, 28, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    const sideX = BOARD_OFFSET_X + boardWidthPx() + 30;
    let y = BOARD_OFFSET_Y;

    this.hintText = this.add.text(sideX, y, '', {
      fontSize: '13px',
      color: '#bbbbbb',
      lineSpacing: 4,
      wordWrap: { width: 220 },
    });
    y += 88;

    this.makeButton(sideX, y, '結束我方回合', 0x4a90e2, () => {
      if (this.gameState === 'player_turn' && this.selection.kind === 'idle') {
        this.endPlayerTurn();
      }
    });
    y += 52;

    this.waitBtn = this.makeButton(sideX, y, '原地待命', 0x90884a, () => {
      if (this.selection.kind === 'action_choice') {
        const u = this.selection.unit;
        u.exhaust();
        this.appendLog(`${u.name} 原地待命`);
        this.deselect();
        this.checkPlayerTurnEnd();
      }
    });
    this.waitBtn.setVisible(false);
    y += 52;

    this.cancelBtn = this.makeButton(sideX, y, '取消選擇', 0x666666, () => {
      this.deselect();
    });
    this.cancelBtn.setVisible(false);
    y += 52;

    // 藥草按鈕：選中武將時可用，治療 12 HP 並結束行動
    this.potionBtn = this.makeButton(sideX, y, `藥草 ×${this.potionCount}`, 0x66bb88, () => {
      this.usePotion();
    });
    this.potionBtn.setVisible(false);
    y += 56;

    // 藥草庫存顯示（永久顯示）
    this.potionText = this.add.text(sideX, y, `藥草庫存：${this.potionCount}`, {
      fontSize: '13px',
      color: '#90c8a0',
    });
    y += 20;

    this.infoText = this.add.text(sideX, y, '', {
      fontSize: '13px',
      color: '#dddddd',
      lineSpacing: 5,
      wordWrap: { width: 220 },
    });

    this.logText = this.add.text(BOARD_OFFSET_X, BOARD_OFFSET_Y + boardHeightPx() + 14, '', {
      fontSize: '13px',
      color: '#cccccc',
      lineSpacing: 5,
    });
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const w = 220;
    const h = 40;
    const bg = this.add.rectangle(0, 0, w, h, color);
    bg.setStrokeStyle(2, 0x000000);
    const txt = this.add.text(0, 0, label, {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    txt.setOrigin(0.5);
    // 透明 hit area 子物件接管輸入（修正 Container hit area 偏移）
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    const c = this.add.container(x + w / 2, y + h / 2, [bg, txt, hit]);
    c.setSize(w, h);
    c.setDepth(20);
    hit.on('pointerover', () => bg.setFillStyle(this.tint(color, 1.2)));
    hit.on('pointerout', () => bg.setFillStyle(color));
    hit.on('pointerdown', onClick);
    return c;
  }

  private tint(color: number, factor: number): number {
    return this.shadeColor(color, factor);
  }

  private bindGlobalInput(): void {
    this.input.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        gameObjects: Phaser.GameObjects.GameObject[]
      ) => {
        if (this.isPaused) return;
        if (gameObjects.length > 0) return;
        if (this.gameState !== 'player_turn') return;
        const tile = pixelToTile(pointer.x, pointer.y);
        if (!tile) {
          this.deselect();
          return;
        }
        this.onTileClicked(tile);
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
      }
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
    if (this.selection.kind !== 'action_choice') return;
    const attacker = this.selection.unit;
    if (unit.faction === attacker.faction) return;
    if (!this.selection.attackTargets.some((t) => coordEq(t, unit.position))) return;
    this.showDamageTooltip(attacker, unit);
  }

  private onTileClicked(tile: Coord): void {
    if (this.isPaused) return;
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
    const blocked = this.collectBlockedTiles(unit);
    const reachable = bfsReachable(unit.position, unit.moveRange, blocked).filter(
      (c) => !this.units.some((u) => u !== unit && u.isAlive() && coordEq(u.position, c))
    );
    if (reachable.length === 0) {
      this.enterActionChoice(unit);
      return;
    }
    this.selection = { kind: 'unit_selected', unit, reachable };
    this.drawMoveHighlights(reachable);
    this.cancelBtn.setVisible(true);
    this.waitBtn.setVisible(false);
    this.showUnitInfo(unit);
    this.hintText.setText(`已選擇「${unit.name}」\n點綠格移動，或按取消。`);
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
    this.potionText.setText(`藥草庫存：${this.potionCount}`);
    const txt = this.potionBtn.list.find(
      (c): c is Phaser.GameObjects.Text => c instanceof Phaser.GameObjects.Text
    );
    if (txt) txt.setText(`藥草 ×${this.potionCount}`);
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
    });
    this.playAttackSound(attacker.unitType);
    await attacker.showAttackAnimation(defender);
    audio.playHit();
    const tCenter = defender.getCenterPx();
    this.spawnHitParticles(tCenter.x, tCenter.y, this.particleColorForType(attacker.unitType));
    defender.applyDamage(result.damage);
    defender.flashHit();
    defender.showFloatingText(`-${result.damage}`, '#ff8888', '16px');
    const tag =
      result.counterLabel === '優勢'
        ? '【剋】'
        : result.counterLabel === '劣勢'
        ? '【弱】'
        : '';
    this.appendLog(`${attacker.name} → ${defender.name} ${result.damage} 傷${tag}`);
    if (attacker.faction === 'player' && this.battleStats[attacker.id]) {
      this.battleStats[attacker.id].damageDealt += result.damage;
      if (!defender.isAlive()) this.battleStats[attacker.id].kills += 1;
    }
    this.grantExp(attacker, result.damage, !defender.isAlive());
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
    });
    this.playAttackSound(defender.unitType);
    await defender.showAttackAnimation(attacker);
    audio.playHit();
    const aCenter = attacker.getCenterPx();
    this.spawnHitParticles(aCenter.x, aCenter.y, this.particleColorForType(defender.unitType));
    attacker.applyDamage(counter.damage);
    attacker.flashHit();
    attacker.showFloatingText(`-${counter.damage}`, '#ff8888', '16px');
    const ctag =
      counter.counterLabel === '優勢'
        ? '【剋】'
        : counter.counterLabel === '劣勢'
        ? '【弱】'
        : '';
    this.appendLog(`${defender.name} 反擊 ${attacker.name} ${counter.damage} 傷${ctag}`);
    if (defender.faction === 'player' && this.battleStats[defender.id]) {
      this.battleStats[defender.id].damageDealt += counter.damage;
      if (!attacker.isAlive()) this.battleStats[defender.id].kills += 1;
    }
    this.grantExp(defender, counter.damage, !attacker.isAlive());
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

  // ===== 高亮 =====
  private drawMoveHighlights(tiles: Coord[]): void {
    this.clearHighlights();
    this.highlightGfx.fillStyle(0x4ae26a, 0.32);
    this.highlightGfx.lineStyle(2, 0x4ae26a, 0.9);
    for (const t of tiles) {
      const center = hexCenterPx(t);
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.fillPath();
      tracePointyHexPath(this.highlightGfx, center.x, center.y, HEX_SIZE - 2);
      this.highlightGfx.strokePath();
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
        })
      : null;

    const tag = (lbl: '優勢' | '劣勢' | '普通') =>
      lbl === '優勢' ? '【剋】' : lbl === '劣勢' ? '【弱】' : '';

    const lines = [
      `${attacker.name} → ${defender.name}`,
      `傷害 ${ourHit.damage}${tag(ourHit.counterLabel)}　(剩 ${Math.max(
        0,
        defender.hp - ourHit.damage
      )}/${defender.maxHp})`,
      counterHit
        ? `反擊 ${counterHit.damage}${tag(counterHit.counterLabel)}　(剩 ${Math.max(
            0,
            attacker.hp - counterHit.damage
          )}/${attacker.maxHp})`
        : `對方無法反擊`,
    ];

    const text = this.add.text(0, 0, lines.join('\n'), {
      fontSize: '12px',
      color: '#ffffff',
      lineSpacing: 4,
      padding: { left: 8, right: 8, top: 6, bottom: 6 },
      backgroundColor: '#000000c8',
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
      ? `武器：${unit.weapon.name}（+${unit.weapon.atk} 攻）`
      : '武器：無';
    const armorLine = unit.armor
      ? `防具：${unit.armor.name}（+${unit.armor.def} 防 +${unit.armor.hpBonus} HP）`
      : '防具：無';
    const lines = [
      `${unit.name}　LV ${unit.level}`,
      `${factionLabel}　${utype.name}`,
      `HP ${unit.hp}/${unit.maxHp}`,
      `攻 ${unit.attack}　防 ${unit.defense}`,
      `移 ${unit.moveRange}　射 ${unit.attackRange}`,
      `EXP ${unit.exp}/20`,
      `所在：${terrain.name}（防+${terrain.defBonus}）`,
      ``,
      weaponLine,
      armorLine,
      ``,
      `特技：${unit.skillName}`,
      `　${unit.skillDesc}`,
    ];
    this.infoText.setText(lines.join('\n'));
  }

  // ===== 回合制 =====
  private startPlayerTurn(): void {
    this.gameState = 'player_turn';
    for (const u of this.units) {
      if (u.faction === 'player') u.resetTurn();
    }
    this.turnText.setText('你的回合').setColor('#7ed1ff');
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

    let bestTarget: Unit | null = null;
    let bestScore = -Infinity;
    for (const p of players) {
      const counter = getCounter(enemy.unitType, p.unitType);
      const dist = manhattan(enemy.position, p.position);
      const lowHpBonus = (1 - p.hp / p.maxHp) * 8;
      const score = (counter.multiplier - 1) * 80 - dist + lowHpBonus;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = p;
      }
    }
    if (!bestTarget) return;
    const target = bestTarget;

    const inRangeFrom = (from: Coord): boolean =>
      attackTargetTiles(from, enemy.attackRange).some((c) => coordEq(c, target.position));

    if (inRangeFrom(enemy.position)) {
      await this.executeAttack(enemy, target);
      return;
    }

    const blocked = this.collectBlockedTiles(enemy);
    const reachable = bfsReachable(enemy.position, enemy.moveRange, blocked);
    const standable = reachable.filter(
      (c) => !this.units.some((u) => u !== enemy && u.isAlive() && coordEq(u.position, c))
    );

    let bestTile: Coord | null = null;
    let bestTileScore = Infinity;
    for (const tile of standable) {
      const canAttack = inRangeFrom(tile);
      const dist = manhattan(tile, target.position);
      const score = canAttack ? -10000 + dist : dist;
      if (score < bestTileScore) {
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
    const enemyAlive = this.units.some((u) => u.faction === 'enemy' && u.isAlive());
    if (!playerAlive) {
      this.gameOver(false);
      return true;
    }
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
