import Phaser from 'phaser';
import type {
  ActiveSkillDef,
  Coord,
  CommanderDef,
  CommanderProgress,
  UnitTypeId,
  Faction,
  EquipmentDef,
  GrowthRates,
} from './types';
import { HEX_W, HEX_H, hexCenterPx, hexDistance } from './Grid';
import { UNIT_TYPES } from './data/unitTypes';
import { EQUIPMENT } from './data/equipment';
import { getSpriteKeyCandidates } from './data/assetManifest';
import {
  EXP_PER_LEVEL,
  MAX_LEVEL,
  type LevelUpDelta,
} from './battle/Leveling';

const PLAYER_COLOR = 0x4a90e2;
const ENEMY_COLOR = 0xe24a4a;
const HP_BAR_BG = 0x222222;
const HP_BAR_GOOD = 0x4ae26a;
const HP_BAR_LOW = 0xe2c64a;
const HP_BAR_CRIT = 0xe24a4a;

export class Unit {
  readonly id: string;
  readonly name: string;
  readonly faction: Faction;
  readonly unitType: UnitTypeId;
  readonly skillId: string;
  readonly skillName: string;
  readonly skillDesc: string;
  readonly moveRange: number;
  readonly attackRange: number;
  /** 速度（Wave 3）：固定取自兵種 baseStats.speed，用於追擊判定。 */
  readonly speed: number;

  position: Coord;
  hp: number;
  level: number;
  exp: number;
  weapon: EquipmentDef | null;
  armor: EquipmentDef | null;
  hasActed = false;
  lastMoveDistance = 0;

  // 主動特技狀態（Stage 2）
  /** 該場戰鬥可用次數（每場 1，battle 重置）*/
  activeUsesLeft = 1;
  /** 當前儲存的「empower 攻擊」效果，下一次 attack 消耗 */
  pendingEmpower: ActiveSkillDef | null = null;
  /** 當前 stance 減傷 buff（剩 N 個我方回合）*/
  stanceMods: { incomingMul: number; turnsLeft: number } | null = null;
  /** 該武將的主動特技定義（從 commander 帶入）*/
  readonly activeSkill: ActiveSkillDef | null;

  // base stats（含等級成長，不含裝備）
  private _baseMaxHp: number;
  private _baseAttack: number;
  private _baseDefense: number;
  private growthRates: GrowthRates;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private hitArea: Phaser.GameObjects.Rectangle;
  private body: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private levelBadge: Phaser.GameObjects.Container;
  private typeBadge: Phaser.GameObjects.Container;
  private hpBarFill: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    commander: CommanderDef,
    position: Coord,
    progressOverride?: CommanderProgress
  ) {
    this.scene = scene;
    this.id = commander.id;
    this.name = commander.name;
    this.faction = commander.faction;
    this.unitType = commander.unitType;
    this.skillId = commander.skill.id;
    this.skillName = commander.skill.name;
    this.skillDesc = commander.skill.desc;
    this.activeSkill = commander.activeSkill ?? null;
    this.position = { ...position };

    const utype = UNIT_TYPES[commander.unitType];
    this.moveRange = utype.moveRange;
    this.attackRange = utype.attackRange;
    this.speed = utype.baseStats.speed;
    this.growthRates = commander.growthRates;

    this.level = progressOverride?.level ?? commander.startingLevel;
    this.exp = progressOverride?.exp ?? 0;

    // 武器：progress 提供（含 null）→ 用 progress；否則用 starting
    if (progressOverride?.weaponId !== undefined) {
      this.weapon = progressOverride.weaponId ? EQUIPMENT[progressOverride.weaponId] ?? null : null;
    } else {
      this.weapon = commander.startingEquipment.weapon
        ? EQUIPMENT[commander.startingEquipment.weapon] ?? null
        : null;
    }
    if (progressOverride?.armorId !== undefined) {
      this.armor = progressOverride.armorId ? EQUIPMENT[progressOverride.armorId] ?? null : null;
    } else {
      this.armor = commander.startingEquipment.armor
        ? EQUIPMENT[commander.startingEquipment.armor] ?? null
        : null;
    }

    const levelBonus = this.level - 1;
    this._baseMaxHp =
      utype.baseStats.hp + commander.statBonus.hp + this.growthRates.hp * levelBonus;
    this._baseAttack =
      utype.baseStats.attack +
      commander.statBonus.attack +
      this.growthRates.attack * levelBonus;
    this._baseDefense =
      utype.baseStats.defense +
      commander.statBonus.defense +
      this.growthRates.defense * levelBonus;

    this.hp = this.maxHp;

    // === 視覺（容器置於 hex 中心，子物件以中心為原點） ===
    const center = hexCenterPx(this.position);
    const factionColor = this.faction === 'player' ? PLAYER_COLOR : ENEMY_COLOR;

    // 透明 hit area（六角內接矩形，HEX_W × HEX_H * 0.86）
    this.hitArea = scene.add.rectangle(0, 0, HEX_W * 0.92, HEX_H * 0.86, 0x000000, 0);
    this.hitArea.setInteractive({ useHandCursor: true });

    // 本體：優先用 sprite 圖；找不到就 fallback 到色塊形狀
    const bodyW = HEX_W * 0.7;
    const bodyH = HEX_H * 0.6;
    const spriteKey = this.findSpriteKey(commander.id, commander.unitType, commander.faction);
    const hasSprite = !!spriteKey;
    if (spriteKey) {
      const img = scene.add.image(0, 2, spriteKey);
      // 等比縮放到剛好填入單位框
      const targetH = bodyH * 1.15; // 稍微超出 hex 框，視覺上更立體
      const scale = Math.min(targetH / img.height, (bodyW * 1.1) / img.width);
      img.setScale(scale);
      // 敵方水平翻轉，視覺上會朝玩家陣營
      if (this.faction === 'enemy') img.setFlipX(true);
      this.body = img;
    } else {
      const g = scene.add.graphics();
      g.y = 2;
      this.drawBodyShape(g, factionColor, bodyW, bodyH);
      this.body = g;
    }

    // 武將名：sprite 模式下移到頭頂上方並加描邊；色塊模式維持中央
    const labelY = hasSprite ? -bodyH / 2 - 6 : -2;
    const labelFontSize = hasSprite ? '12px' : '17px';
    this.label = scene.add.text(0, labelY, this.name, {
      fontSize: labelFontSize,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: hasSprite ? 3 : 0,
    });
    this.label.setOrigin(0.5);

    // 等級徽章（左上）
    const lvBg = scene.add.circle(0, 0, 10, 0x2a2a2a);
    lvBg.setStrokeStyle(1, 0xffffff);
    const lvText = scene.add.text(0, -1, String(this.level), {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    lvText.setOrigin(0.5);
    lvText.setName('lvText');
    this.levelBadge = scene.add.container(-bodyW / 2 + 8, -bodyH / 2 + 6, [lvBg, lvText]);

    // 兵種徽章（右上）
    const tBg = scene.add.circle(0, 0, 10, utype.color);
    tBg.setStrokeStyle(1, 0x000000);
    const tText = scene.add.text(0, -1, utype.shortName, {
      fontSize: '12px',
      color: '#000000',
      fontStyle: 'bold',
    });
    tText.setOrigin(0.5);
    this.typeBadge = scene.add.container(bodyW / 2 - 8, -bodyH / 2 + 6, [tBg, tText]);

    // HP bar（底部）
    const barW = bodyW - 4;
    const barY = bodyH / 2 - 4;
    const hpBarBg = scene.add.rectangle(0, barY, barW, 5, HP_BAR_BG);
    hpBarBg.setStrokeStyle(1, 0x000000);
    this.hpBarFill = scene.add.rectangle(-barW / 2, barY, barW, 5, HP_BAR_GOOD);
    this.hpBarFill.setOrigin(0, 0.5);

    this.container = scene.add.container(center.x, center.y, [
      this.hitArea,
      this.body,
      this.label,
      this.levelBadge,
      this.typeBadge,
      hpBarBg,
      this.hpBarFill,
    ]);
    this.container.setDepth(10);

    this.updateHpBar();
  }

  // === Effective stats（含裝備加成）===
  get maxHp(): number {
    return this._baseMaxHp + (this.armor?.hpBonus ?? 0);
  }

  get attack(): number {
    return this._baseAttack + (this.weapon?.atk ?? 0);
  }

  get defense(): number {
    return this._baseDefense + (this.armor?.def ?? 0);
  }

  // === 等級系統 ===
  gainExp(amount: number): LevelUpDelta | null {
    if (this.level >= MAX_LEVEL) return null;
    this.exp += amount;
    if (this.exp < EXP_PER_LEVEL) return null;

    const fromLevel = this.level;
    let totalHp = 0,
      totalAtk = 0,
      totalDef = 0;
    while (this.exp >= EXP_PER_LEVEL && this.level < MAX_LEVEL) {
      this.exp -= EXP_PER_LEVEL;
      this.level += 1;
      this._baseMaxHp += this.growthRates.hp;
      this._baseAttack += this.growthRates.attack;
      this._baseDefense += this.growthRates.defense;
      this.hp += this.growthRates.hp;
      totalHp += this.growthRates.hp;
      totalAtk += this.growthRates.attack;
      totalDef += this.growthRates.defense;
    }
    this.refreshLevelBadge();
    this.updateHpBar();
    return {
      fromLevel,
      toLevel: this.level,
      hpGain: totalHp,
      attackGain: totalAtk,
      defenseGain: totalDef,
    };
  }

  // === 動作 ===
  on(event: string, fn: () => void): void {
    this.hitArea.on(event, fn);
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  resetTurn(): void {
    this.hasActed = false;
    this.lastMoveDistance = 0;
    this.body.setAlpha(1);
    this.typeBadge.setAlpha(1);
    this.levelBadge.setAlpha(1);
  }

  exhaust(): void {
    this.hasActed = true;
    this.body.setAlpha(0.45);
    this.typeBadge.setAlpha(0.45);
    this.levelBadge.setAlpha(0.45);
  }

  applyDamage(damage: number): void {
    this.hp = Math.max(0, this.hp - damage);
    this.hp = Math.min(this.hp, this.maxHp); // 防止 hp 超過上限（給藥草直接寫 hp 用）
    this.updateHpBar();
  }

  /** 直接寫死 HP 值（給戰鬥存檔載入用，跳過扣血邏輯）*/
  setHp(hp: number): void {
    this.hp = Math.max(0, Math.min(hp, this.maxHp));
    this.updateHpBar();
  }

  /** 不走動畫直接搬到 (x, y) — 給戰鬥存檔載入用 */
  setContainerPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /** 強制刷新等級徽章（外部修改 level 時呼叫，例如戰鬥存檔載入）*/
  refreshLevelDisplay(): void {
    this.refreshLevelBadge();
  }

  /**
   * 移動到目標格。傳 `path` 時逐格 tween（棋盤移動感，每格 ~110ms 線性），
   * 沒傳就退回單一直線 tween（給 revert / 兼容用途）。path 不含起點、
   * 含目的地；長度 0 視同沒傳。
   */
  moveTo(coord: Coord, path?: Coord[]): Promise<void> {
    this.lastMoveDistance = hexDistance(this.position, coord);
    this.position = { ...coord };

    if (!path || path.length === 0) {
      const center = hexCenterPx(coord);
      return new Promise((resolve) => {
        this.scene.tweens.add({
          targets: this.container,
          x: center.x,
          y: center.y,
          duration: 250,
          ease: 'Sine.easeInOut',
          onComplete: () => resolve(),
        });
      });
    }

    const STEP_MS = 110;
    return new Promise((resolve) => {
      let i = 0;
      const stepNext = (): void => {
        if (i >= path.length) {
          resolve();
          return;
        }
        const step = path[i];
        const center = hexCenterPx(step);
        i += 1;
        this.scene.tweens.add({
          targets: this.container,
          x: center.x,
          y: center.y,
          duration: STEP_MS,
          ease: 'Linear',
          onComplete: stepNext,
        });
      };
      stepNext();
    });
  }

  /**
   * 反悔：直接把單位送回到指定座標（用於「取消移動」按鈕）。
   * 跟 moveTo 不同：lastMoveDistance 重置為 0，動畫較短，視覺上代表「沒移過」。
   */
  revertTo(coord: Coord): Promise<void> {
    this.lastMoveDistance = 0;
    this.position = { ...coord };
    const center = hexCenterPx(coord);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        x: center.x,
        y: center.y,
        duration: 180,
        ease: 'Sine.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  flashHit(): void {
    this.scene.tweens.add({
      targets: this.body,
      alpha: { from: 1, to: 0.2 },
      duration: 80,
      yoyo: true,
      repeat: 2,
    });
  }

  /** 找到第一個存在的 sprite texture key，沒找到回 null */
  private findSpriteKey(
    commanderId: string,
    unitType: UnitTypeId,
    faction: Faction
  ): string | null {
    const candidates = getSpriteKeyCandidates(commanderId, unitType, faction);
    for (const k of candidates) {
      if (this.scene.textures.exists(k)) return k;
    }
    return null;
  }

  /** 依兵種繪製獨特身體形狀 */
  private drawBodyShape(
    g: Phaser.GameObjects.Graphics,
    color: number,
    w: number,
    h: number
  ): void {
    g.fillStyle(color, 1);
    g.lineStyle(2, 0x000000, 1);
    const hw = w / 2;
    const hh = h / 2;
    switch (this.unitType) {
      case 'sword': {
        // 圓角方塊
        g.fillRoundedRect(-hw, -hh, w, h, 6);
        g.strokeRoundedRect(-hw, -hh, w, h, 6);
        break;
      }
      case 'lance': {
        // 五邊形（頂部突出）
        g.beginPath();
        g.moveTo(0, -hh - 4);
        g.lineTo(hw, -hh + 8);
        g.lineTo(hw, hh);
        g.lineTo(-hw, hh);
        g.lineTo(-hw, -hh + 8);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'cavalry': {
        // 箭頭（朝右，戰場上 player 朝右、enemy 朝左會更好但簡化）
        g.beginPath();
        g.moveTo(-hw, -hh);
        g.lineTo(hw - 8, -hh);
        g.lineTo(hw + 4, 0);
        g.lineTo(hw - 8, hh);
        g.lineTo(-hw, hh);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'archer': {
        // 梯形（上窄下寬）
        g.beginPath();
        g.moveTo(-hw + 6, -hh);
        g.lineTo(hw - 6, -hh);
        g.lineTo(hw, hh);
        g.lineTo(-hw, hh);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'mage': {
        // 菱形
        g.beginPath();
        g.moveTo(0, -hh);
        g.lineTo(hw, 0);
        g.lineTo(0, hh);
        g.lineTo(-hw, 0);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'flier': {
        // 六角形
        g.beginPath();
        g.moveTo(-hw / 2, -hh);
        g.lineTo(hw / 2, -hh);
        g.lineTo(hw, 0);
        g.lineTo(hw / 2, hh);
        g.lineTo(-hw / 2, hh);
        g.lineTo(-hw, 0);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
    }
  }

  getCenterPx(): { x: number; y: number } {
    return hexCenterPx(this.position);
  }

  showAttackAnimation(target: Unit): Promise<void> {
    const myCenter = this.getCenterPx();
    const tCenter = target.getCenterPx();
    if (this.attackRange > 1) {
      return this.showRangedAttack(myCenter, tCenter);
    }
    return this.showMeleeLunge(myCenter, tCenter);
  }

  private showRangedAttack(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): Promise<void> {
    return new Promise((resolve) => {
      const isMagic = this.unitType === 'mage';
      const color = isMagic ? 0xc090ff : 0xffe066;
      const proj = this.scene.add.circle(from.x, from.y, isMagic ? 9 : 5, color);
      proj.setStrokeStyle(2, 0xffffff);
      proj.setDepth(50);
      this.scene.tweens.add({
        targets: proj,
        x: to.x,
        y: to.y,
        duration: 240,
        ease: 'Quad.easeIn',
        onComplete: () => {
          if (isMagic) {
            const burst = this.scene.add.circle(to.x, to.y, 14, 0xff77ff, 0.65);
            burst.setDepth(51);
            this.scene.tweens.add({
              targets: burst,
              scaleX: 3,
              scaleY: 3,
              alpha: 0,
              duration: 320,
              onComplete: () => burst.destroy(),
            });
          }
          proj.destroy();
          resolve();
        },
      });
    });
  }

  private showMeleeLunge(
    myCenter: { x: number; y: number },
    tCenter: { x: number; y: number }
  ): Promise<void> {
    return new Promise((resolve) => {
      const startX = this.container.x;
      const startY = this.container.y;
      const dx = (tCenter.x - myCenter.x) * 0.35;
      const dy = (tCenter.y - myCenter.y) * 0.35;
      this.scene.tweens.add({
        targets: this.container,
        x: startX + dx,
        y: startY + dy,
        duration: 130,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  showFloatingText(text: string, color: string = '#ffffff', fontSize: string = '14px'): void {
    const center = this.getCenterPx();
    const t = this.scene.add.text(center.x, center.y - HEX_H / 2, text, {
      fontSize,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    t.setOrigin(0.5, 1);
    t.setDepth(200);
    this.scene.tweens.add({
      targets: t,
      y: center.y - HEX_H / 2 - 36,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  destroy(): void {
    this.container.destroy();
  }

  // === 內部 ===
  private updateHpBar(): void {
    const ratio = this.hp / this.maxHp;
    this.hpBarFill.setScale(Math.max(0, ratio), 1);
    if (ratio > 0.5) this.hpBarFill.fillColor = HP_BAR_GOOD;
    else if (ratio > 0.25) this.hpBarFill.fillColor = HP_BAR_LOW;
    else this.hpBarFill.fillColor = HP_BAR_CRIT;
  }

  private refreshLevelBadge(): void {
    const txt = this.levelBadge.getByName('lvText') as Phaser.GameObjects.Text | null;
    if (txt) txt.setText(String(this.level));
  }
}
