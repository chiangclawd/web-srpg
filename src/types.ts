export type Faction = 'player' | 'enemy';

export interface Coord {
  x: number;
  y: number;
}

export type UnitTypeId = 'sword' | 'lance' | 'cavalry' | 'archer' | 'mage' | 'flier';

export interface UnitTypeDef {
  id: UnitTypeId;
  name: string;
  shortName: string;
  color: number;
  attackRange: number;
  moveRange: number;
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
  };
  /** 命中率 0-100，預設 95 */
  hitRate?: number;
  /** 爆擊率 0-100，預設 5；爆擊傷害 ×1.5 */
  critRate?: number;
}

export type EquipmentKind = 'weapon' | 'armor';

export interface EquipmentDef {
  id: string;
  name: string;
  kind: EquipmentKind;
  atk: number;
  def: number;
  hpBonus: number;
  /** 兵種限定：哪些兵種可裝備；undefined = 通用（向下相容用，新裝備建議都填）*/
  unitTypes?: UnitTypeId[];
  /** 解鎖等級門檻；undefined / 0 = 開局即可裝備 */
  requiredLevel?: number;
  /**
   * 解鎖章節門檻（顯式覆蓋）；不填則由 requiredLevel 自動推算：
   *   lv 1 → ch 1（即遊戲開始）
   *   lv 5 → ch 4
   *   lv 10 → ch 7
   *   lv 14 → ch 10（後日談 / 試煉場全開）
   * 隱藏 / 後日談章節編號 ≥ 11，所有裝備都已解鎖。
   */
  requiredChapter?: number;
  /** 命中率加成（百分點，例：5 = +5%）*/
  hitBonus?: number;
  /** 爆擊率加成（百分點）*/
  critBonus?: number;
}

export interface CommanderSkill {
  /** 對應 SKILL_EFFECTS 註冊的效果 id；空字串 = 無效果 */
  id: string;
  name: string;
  desc: string;
}

export interface GrowthRates {
  hp: number;
  attack: number;
  defense: number;
}

export interface CommanderDef {
  id: string;
  name: string;
  faction: Faction;
  unitType: UnitTypeId;
  statBonus: {
    hp: number;
    attack: number;
    defense: number;
  };
  skill: CommanderSkill;
  /** 主動特技（每場戰鬥可用 1 次）— 配 BattleScene 「特技」按鈕觸發 */
  activeSkill?: ActiveSkillDef;
  startingLevel: number;
  growthRates: GrowthRates;
  startingEquipment: {
    weapon?: string;
    armor?: string;
  };
}

/**
 * 主動特技 — 戰鬥中由「特技」按鈕觸發，每場 1 次。
 *
 * 三個 type 對應三種戰鬥行為：
 *   - empower_attack：強化下一次普通攻擊（玩家照常選敵人；觸發後 attack 帶入修正）
 *   - defense_stance：套用一段時間的減傷 buff，當下消耗行動
 *   - heal_self：立即恢復 HP，當下消耗行動
 */
export interface ActiveSkillDef {
  id: string;
  name: string;
  desc: string;
  type: 'empower_attack' | 'defense_stance' | 'heal_self';
  /** type='empower_attack' 用 */
  empower?: {
    dmgMul?: number;     // e.g. 1.5 → 攻擊乘 1.5
    hitBoost?: number;   // 百分點，e.g. 20 → 命中 +20%（可超 100% capped 在 100）
    critBoost?: number;  // 百分點，e.g. 50
    ignoreDef?: boolean; // 視防禦為 0
  };
  /** type='defense_stance' 用 */
  stance?: {
    incomingMul: number; // e.g. 0.5 → 受傷減半
    durationTurns: number; // 持續幾個玩家回合（含當下）
  };
  /** type='heal_self' 用 */
  heal?: {
    amount: number; // 固定恢復 HP（cap 在 maxHp - hp）
  };
}

export interface DeploymentDef {
  commanderId: string;
  position: Coord;
}

export type TerrainTypeId = 'plain' | 'forest' | 'mountain' | 'water';

export interface TerrainTypeDef {
  id: TerrainTypeId;
  name: string;
  shortName: string;
  color: number;
  moveCost: number;
  defBonus: number;
  blocked: boolean;
}

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  gridWidth: number;
  gridHeight: number;
  terrain?: string[];
  deployments: DeploymentDef[];
  /**
   * 勝利條件：
   *   - 'rout'      → 全滅敵方（預設）
   *   - 'kill_boss' → 擊殺指定 bossId 的敵方武將即勝（雜兵不必清光）
   *   - 'survive'   → 撐過 surviveTurns 個玩家回合即勝（敵軍可能持續來增援）
   */
  victoryCondition: 'rout' | 'kill_boss' | 'survive';
  /** 'kill_boss' 用：要擊殺哪一個敵方 commander id（必須出現在 deployments 中） */
  bossId?: string;
  /** 'survive' 用：撐過幾個玩家回合即勝（從第 1 回合開始算，含當前回合） */
  surviveTurns?: number;
  /** 戰場背景色（章節氛圍）— 0xRRGGBB；預設 0x2a2a2a */
  bgColor?: number;
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface CutsceneScript {
  id: string;
  lines: DialogueLine[];
  /** 背景大圖 texture key（如 'cg_chapter1'）。未設定 → 純黑底。 */
  bgImageKey?: string;
  /**
   * 進到指定行號（0-indexed）時切換背景大圖（cinematic transition）。
   * 例：`{ 6: 'cg_chapter1_outpost' }` → 第 7 行起背景換成另一張 CG。
   * 切換以 cross-fade 完成；指定 key 沒對應 texture 時保留當前背景不變。
   */
  lineBgKey?: Record<number, string>;
}

export interface ChapterDef {
  id: string;
  number: number;
  title: string;
  prologueCutsceneId: string;
  scenarioId: string;
  victoryCutsceneId: string;
  defeatCutsceneId?: string;
  nextChapterId?: string;
}

export interface CommanderProgress {
  level: number;
  exp: number;
  /** 玩家換裝後的武器 id；undefined = 沿用 commander 起始裝備；null = 未裝備 */
  weaponId?: string | null;
  /** 玩家換裝後的防具 id；undefined = 沿用 commander 起始裝備；null = 未裝備 */
  armorId?: string | null;
}

export interface SaveData {
  version: number;
  completedChapterIds: string[];
  nextChapterId: string;
  commanderProgress: Record<string, CommanderProgress>;
  achievements?: string[];
  /** 玩家明確排除出陣的武將 ID（候補）。空 = 全員出陣（預設）*/
  excludedCommanderIds?: string[];
  savedAt: string;
}

export type GameState = 'player_turn' | 'enemy_turn' | 'victory' | 'defeat';
