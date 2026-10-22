import type { Vec } from './math';

/** 雙語字串（zh-TW 為主、en 為輔） */
export interface L10n {
  zh: string;
  en: string;
}

export type DamageKind = 'physical' | 'magic' | 'true';
export type Range2 = [number, number];

// ───────────────────────── 敵人 ─────────────────────────

export type EnemyAbility =
  | { kind: 'heal'; radius: number; amount: number; cd: number }
  | { kind: 'shield'; radius: number; amount: number; cd: number }
  | { kind: 'regen'; perSec: number }
  | { kind: 'dodge'; chance: number }
  | { kind: 'summon'; enemy: string; count: number; cd: number }
  | { kind: 'spawnOnDeath'; enemy: string; count: number }
  | { kind: 'enrage'; belowHp: number; speedMul: number }
  /** 讓附近的塔暫時停擺（fx: 'fire' 為熔岩噴發，預設為冰封） */
  | { kind: 'stunTowers'; radius: number; duration: number; cd: number; fx?: 'fire' | 'wave' }
  | { kind: 'aoeMelee'; radius: number }
  | { kind: 'blink'; distance: number; cd: number }
  /** 鑽入地下：期間無法被攻擊、阻擋，移動加速 */
  | { kind: 'burrow'; cd: number; dur: number; speedMul: number }
  /** 隱身黑暗：夜戰中沒被燈火、塔光或英雄照到時，受到的傷害只剩 dmgMul */
  | { kind: 'shade'; dmgMul: number };

export interface EnemyDef {
  id: string;
  name: L10n;
  desc: L10n;
  /** 紋理 key（BootScene 會產生） */
  sprite: string;
  /** 顯示高度（像素，約略） */
  height: number;
  /** 原圖面向右？用於 flipX */
  facesRight: boolean;
  /** 染色（同一張圖做出變種） */
  tint?: number;
  hp: number;
  /** 像素 / 秒 */
  speed: number;
  /** 物理減傷 0..1 */
  armor: number;
  /** 魔法減傷 0..1 */
  magicResist: number;
  gold: number;
  lives: number;
  flying?: boolean;
  /** 近戰（被士兵擋住時使用） */
  melee: { dmg: Range2; cd: number };
  /** 遠程：會停下來射擊士兵/英雄 */
  ranged?: { dmg: Range2; cd: number; range: number; kind: 'arrow' | 'magic' };
  abilities?: EnemyAbility[];
  boss?: boolean;
  /** 碰撞半徑（站位與血條寬度） */
  radius: number;
  /** 圖鑑標籤 */
  tags?: L10n[];
}

// ───────────────────────── 塔 ─────────────────────────

export type TowerType = 'archer' | 'barracks' | 'mage' | 'artillery';

export interface SoldierStats {
  hp: number;
  armor: number;
  dmg: Range2;
  cd: number;
  regen: number;
  /** 有遠程攻擊（例如遊俠兵營丟斧） */
  ranged?: { dmg: Range2; cd: number; range: number };
  sprite: string;
  count: number;
  respawn: number;
}

export interface TowerSkillDef {
  id: string;
  name: L10n;
  desc: L10n;
  /** 每級價格 */
  costs: number[];
}

export interface TowerLevelDef {
  name: L10n;
  desc: L10n;
  cost: number;
  range: number;
  cooldown: number;
  damage: Range2;
  dmgKind: DamageKind;
  /** 弓箭塔/特化：射手數 */
  shooters?: number;
  /** 砲塔：濺射半徑 */
  splash?: number;
  soldier?: SoldierStats;
  /** 外觀紋理 key */
  art: string;
  /** 攻擊型態 */
  attack: 'arrow' | 'bolt' | 'bomb' | 'tesla' | 'rocket' | 'none';
  /** 第 4 級特化 id（branch）才有 */
  branchId?: string;
  skills?: TowerSkillDef[];
  /** 是否能打飛行 */
  hitsAir: boolean;
}

export interface TowerDef {
  type: TowerType;
  name: L10n;
  /** levels[0..2] = 1~3 級 */
  levels: TowerLevelDef[];
  /** 第 4 級兩條特化分支 */
  branches: TowerLevelDef[];
}

// ───────────────────────── 英雄 ─────────────────────────

export interface HeroSkillDef {
  id: string;
  name: L10n;
  desc: L10n;
  unlockLevel: number;
  cd: number;
}

/** 英雄絕招：玩家手動點地面施放，冷卻較長 */
export interface HeroUltDef {
  name: L10n;
  desc: L10n;
  icon: string;
  cd: number;
}

export interface HeroDef {
  id: string;
  name: L10n;
  title: L10n;
  desc: L10n;
  sprite: string;
  portrait: string;
  facesRight: boolean;
  height: number;
  hp: number;
  hpPerLevel: number;
  armor: number;
  dmg: Range2;
  dmgPerLevel: number;
  cd: number;
  speed: number;
  regen: number;
  ranged?: { range: number; kind: 'arrow' | 'magic'; dmgKind: DamageKind };
  /** 飛行英雄：不會被擋、不擋人，但能飛越地形 */
  flying?: boolean;
  skills: HeroSkillDef[];
  ult: HeroUltDef;
  /** 解鎖條件：通過哪一關（undefined = 一開始就有） */
  unlockAfter?: string;
}

// ───────────────────────── 關卡 ─────────────────────────

export interface GroupDef {
  /** 路徑索引 */
  path: number;
  enemy: string;
  count: number;
  /** 每隻間隔（秒） */
  interval: number;
  /** 相對於波次開始的延遲（秒） */
  delay?: number;
}

export interface WaveDef {
  groups: GroupDef[];
  /** 本波結束到下一波自動開始的秒數 */
  gap?: number;
  /** 本波敵人血量倍率（無盡模式逐波提升） */
  hpMul?: number;
  /** 夜戰波次（無盡模式的日夜循環：這一波開始時入夜，到下一個白天波次才天亮） */
  night?: boolean;
}

export type ThemeId = 'grass' | 'forest' | 'snow' | 'waste' | 'autumn' | 'desert' | 'volcano' | 'coast';

export type DecorItem =
  | { kind: 'house'; x: number; y: number; scale?: number }
  | { kind: 'tower_ruin'; x: number; y: number }
  | { kind: 'river'; points: Vec[]; width: number }
  | { kind: 'bridge'; x: number; y: number; angle: number; length: number }
  | { kind: 'lake'; x: number; y: number; rx: number; ry: number }
  | { kind: 'rocks'; x: number; y: number; n: number }
  | { kind: 'trees'; x: number; y: number; n: number; r: number }
  | { kind: 'castle'; x: number; y: number }
  | { kind: 'camp'; x: number; y: number }
  | { kind: 'cliff'; points: Vec[] }
  | { kind: 'clear'; x: number; y: number; r: number }
  | { kind: 'altar'; x: number; y: number };

export type HazardKind = 'boulder' | 'snowball' | 'keg';

/** 地圖機關：點擊後巨石／雪球從 (x,y) 落到路上，沿路徑 d0 → d1 滾動、砸傷沿途地面敵人 */
export interface HazardDef {
  kind: HazardKind;
  x: number;
  y: number;
  path: number;
  d0: number;
  d1: number;
  /** 覆寫預設傷害（後期關卡敵人較硬） */
  dmg?: number;
  /** 落石的外觀（沙漠砂岩、荒地玄武岩）；玩法同 boulder */
  skin?: 'sand' | 'dark';
}

export interface LevelDef {
  id: string;
  index: number;
  name: L10n;
  desc: L10n;
  theme: ThemeId;
  /** 敵人行走路徑（玩法區 1280×720 座標） */
  paths: Vec[][];
  /** 出口那一端是否要畫城門（索引對應 paths） */
  spots: Vec[];
  startGold: number;
  lives: number;
  waves: WaveDef[];
  heroStart: Vec;
  /** 世界地圖上的位置（0..1 比例） */
  mapPos: Vec;
  decor?: DecorItem[];
  /** 程序裝飾亂數種子 */
  seed: number;
  /** 地圖上的開場提示（教學） */
  tutorial?: boolean;
  /** 此關新出現的敵人（開場介紹卡） */
  intro?: string[];
  /** 指定配樂；沒寫就依地形（THEME_BGM） */
  bgm?: 'finale' | 'night';
  /** 夜晚飄在戰場上的光點顏色與大小（預設是黃綠色的螢火蟲；礦坑鬼火是大一點的幽綠鬼火） */
  wisps?: { tint: number; size: number };
  /** 挑戰模式規則 */
  rules?: LevelRules;
  /** 外傳關卡（戰役完結後解鎖，不在主線路線上） */
  bonus?: boolean;
  /** 通關後播放的尾聲（外傳終章 side、番外篇 extra、鏡淵篇 mirror；主線最終關自動是 main） */
  epilogue?: 'side' | 'extra' | 'mirror';
  /** 沿用另一關的手繪戰場圖（同一張地圖的變奏關卡） */
  art?: string;
  /** 手繪戰場圖左右鏡像（鏡淵篇：路線、建造點已經跟著翻過來） */
  mirror?: boolean;
  /** 戰場圖染色（乘色，例如鏡淵篇的淡紫） */
  grade?: number;
  /** 夜戰：畫面變暗、塔與英雄周圍有光；防禦塔射程 -15% */
  night?: boolean;
  /** 地圖上的路線改從這一關的旗子連過來（不接在外傳路線後面） */
  mapLink?: string;
  /** 可點擊的地圖機關（落石、雪崩） */
  hazards?: HazardDef[];
}

export type LevelMode = 'campaign' | 'heroic' | 'iron' | 'endless' | 'daily' | 'bossrush';

export interface LevelRules {
  mode: LevelMode;
  /** 只允許這些塔 */
  allowed?: TowerType[];
  /** 禁用法術 */
  noSpells?: boolean;
  /** 單一敵人漏失最多扣幾條命（無盡模式避免首領一擊結束） */
  leakCap?: number;
  /** 每日挑戰修正：敵人血量 / 速度倍率、護甲加值、賞金倍率、建塔費用倍率 */
  enemyHpMul?: number;
  enemySpeedMul?: number;
  enemyArmorAdd?: number;
  bountyMul?: number;
  towerCostMul?: number;
  /** 每日挑戰修正：敵人每秒回復最大生命的比例、地圖機關冷卻與傷害倍率、英雄絕招冷卻倍率 */
  enemyRegen?: number;
  hazardCdMul?: number;
  hazardDmgMul?: number;
  heroUltCdMul?: number;
  /** 防禦塔射程倍率（每日挑戰「月黑風高」） */
  towerRangeMul?: number;
  /** 夜戰畫面（每日挑戰「月黑風高」） */
  night?: boolean;
  /** 精英敵人：第 i 波（0 起算）出現機率 = min(max, base + perWave × i)；首領與召喚物不會是精英 */
  elite?: { base: number; perWave: number; max: number };
}

/** 精英詞綴 */
export type EliteAffix = 'swift' | 'tough' | 'regen' | 'shielded';
