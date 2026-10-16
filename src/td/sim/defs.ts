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
  | { kind: 'stunTowers'; radius: number; duration: number; cd: number }
  | { kind: 'aoeMelee'; radius: number }
  | { kind: 'blink'; distance: number; cd: number };

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
}

export type ThemeId = 'grass' | 'forest' | 'snow' | 'waste' | 'autumn';

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
  bgm?: 'peaceful' | 'tense' | 'dark' | 'epic' | 'finale';
  /** 挑戰模式規則 */
  rules?: LevelRules;
}

export type LevelMode = 'campaign' | 'heroic' | 'iron';

export interface LevelRules {
  mode: LevelMode;
  /** 只允許這些塔 */
  allowed?: TowerType[];
  /** 禁用法術 */
  noSpells?: boolean;
}
