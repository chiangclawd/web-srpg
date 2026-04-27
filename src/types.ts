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
  startingLevel: number;
  growthRates: GrowthRates;
  startingEquipment: {
    weapon?: string;
    armor?: string;
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
