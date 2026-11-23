// 《星墜殘響》戰鬥模擬的資料型別（純資料，不依賴 Phaser；測試和自動對戰腳本直接用）

export interface L10n {
  zh: string;
  en: string;
}

export type Side = 'player' | 'enemy';

/** 面向：0 = +x（畫面右下）、1 = +y（左下）、2 = -x（左上）、3 = -y（右上） */
export type Dir = 0 | 1 | 2 | 3;
export const DIR_VEC: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export interface Pos {
  x: number;
  y: number;
}

export type TerrainId = 'deck' | 'grate' | 'ice' | 'snow' | 'rubble' | 'barricade' | 'wall' | 'chasm' | 'machine';

export interface TerrainDef {
  id: TerrainId;
  name: L10n;
  /** 進入這格的移動消耗；0 = 不能進入 */
  cost: number;
  /** 掩體等級：站在上面受到直射武器的傷害 -25% / -40% */
  cover: 0 | 1 | 2;
  /** 擋住直射火線（等於多 2 層高） */
  blocksFire: boolean;
}

export type WeaponKind = 'melee' | 'direct' | 'indirect';
/** 直射武器的彈道演出（只影響畫面，見 view/shots.ts） */
export type ShotKind = 'pulse' | 'smg' | 'scatter' | 'cannon' | 'rail' | 'beam' | 'arc' | 'wave';

export interface WeaponDef {
  name: L10n;
  dmg: number;
  min: number;
  max: number;
  kind: WeaponKind;
  /** 濺射：目標四周相鄰格也受到這個比例的傷害（曲射砲） */
  splash?: number;
  /** 直射武器開火時的樣子（沒寫就是點放）。不影響傷害 */
  shot?: ShotKind;
}

export type SkillEffect =
  | { type: 'shot'; mul: number }
  | { type: 'push'; mul: number }
  | { type: 'line'; mul: number; len: number }
  | { type: 'heal'; amount: number }
  | { type: 'stun'; turns: number }
  /** 躍進：瞬間跳到目標格（不觸發警戒、不算行動，跳完還能攻擊） */
  | { type: 'leap' }
  /** 督戰：讓一個已經行動過的友軍再動一次 */
  | { type: 'rally' };

export interface SkillDef {
  id: string;
  name: L10n;
  desc: L10n;
  /** 用過之後要等幾個自己的回合 */
  cd: number;
  target: 'enemy' | 'ally' | 'dir' | 'tile';
  min: number;
  max: number;
  effect: SkillEffect;
  icon: string;
}

export interface UnitDef {
  id: string;
  name: L10n;
  /** 機型 / 兵種 */
  cls: L10n;
  /** 駕駛員（對話頭像）；無人機沒有 */
  pilot?: string;
  hp: number;
  armor: number;
  move: number;
  /** 一步最多能爬幾層 */
  jump: number;
  /** 懸浮：無視地形消耗、可越過裂谷 */
  hover?: boolean;
  weapon: WeaponDef;
  skills: SkillDef[];
  passive?: { name: L10n; desc: L10n };
  /** 光環：距離內的友軍傷害加成 / 受傷減免（only：只對這個編號的機型有效） */
  aura?: { range: number; dmg?: number; guard?: number; only?: string };
  /** 側擊 / 背襲加成的倍率（偵察機 2 倍） */
  flankMul?: number;
  /** 獵殺：目標耐久比例低於 below 時傷害加成 */
  execute?: { below: number; dmg: number };
  /** 反擊的傷害比例（預設 0.6；紀律嚴明的部隊是 1） */
  counterMul?: number;
  /** 塔盾：從正面來的傷害減免比例 */
  frontShield?: number;
  /** 佔高處時額外的射程與傷害 */
  highGround?: { range: number; dmg: number };
  /** 群聚：目標旁邊有其他同型機時的傷害加成 */
  swarm?: number;
  /** 首領：不會被推動、不會被癱瘓 */
  boss?: boolean;
  /** 重量級：不會被推動（但可以被癱瘓） */
  heavy?: boolean;
  /** 設施：不能移動、不能行動 */
  structure?: boolean;
  /** 圖像：用哪一張圖表、顯示倍率、染色 */
  sprite: string;
  scale?: number;
  tint?: number;
}

export type AiMode = 'aggressive' | 'guard' | 'hold';

export interface Unit {
  uid: number;
  def: UnitDef;
  side: Side;
  x: number;
  y: number;
  dir: Dir;
  hp: number;
  maxHp: number;
  /** 武器傷害倍率（輕鬆難度下敵方是 0.75） */
  power: number;
  moved: boolean;
  acted: boolean;
  /** 技能冷卻（剩幾回合） */
  cds: Record<string, number>;
  stun: number;
  overwatch: boolean;
  alive: boolean;
  ai: AiMode;
  /** 劇本裡用來指定這個單位的名字（勝利條件、對話） */
  tag?: string;
  /** AI 優先攻擊的目標（tag） */
  prey?: string;
  /** 這次移動前的位置（還沒行動前可以取消移動） */
  undo?: { x: number; y: number; dir: Dir };
}

export interface SpawnDef {
  unit: string;
  x: number;
  y: number;
  dir?: Dir;
  side?: Side;
  ai?: AiMode;
  tag?: string;
  prey?: string;
}

export type WinCondition =
  | { type: 'rout' }
  | { type: 'survive'; turns: number }
  | { type: 'reach'; zone: Pos[]; who?: string }
  | { type: 'kill'; tag: string }
  /** 這些 tag 的單位全部摧毀（順序不拘） */
  | { type: 'killAll'; tags: string[] }
  /** 指定的機體站在區域裡、連續撐過幾個敵方回合（離開就重算） */
  | { type: 'hold'; zone: Pos[]; who: string; turns: number };

export interface MissionEvent {
  /** 第幾回合的我方階段開始時觸發 */
  turn: number;
  spawn?: SpawnDef[];
  /** 對話編號（story.ts） */
  say?: string;
}

export interface MissionDef {
  id: string;
  name: L10n;
  brief: L10n;
  /** 地形：每列一個字串，字元對照 terrain.ts 的 TERRAIN_CHARS */
  tiles: string[];
  /** 高度：每列一個字串，每格一個數字 0–3 */
  heights: string[];
  units: SpawnDef[];
  win: WinCondition;
  /** 這些 tag 的單位被摧毀就失敗（隊長一定算） */
  protect?: string[];
  /** 保護目標被摧毀幾個才算失敗（預設 1） */
  protectLose?: number;
  /** 第幾章 */
  chapter?: number;
  objective: L10n;
  /** 幾回合內過關多一顆星 */
  par: number;
  events?: MissionEvent[];
  intro?: string;
  outro?: string;
  /** 背景色調 */
  theme?: 'ice' | 'hull' | 'bay' | 'reactor' | 'field';
  /** 場景擺設（只有外觀；要擋路的話地圖那格用 o） */
  props?: { sprite: string; x: number; y: number; scale?: number }[];
}

export type ModKind = 'height' | 'flank' | 'cover' | 'aura' | 'guard' | 'swarm' | 'skill' | 'reaction' | 'armor' | 'splash' | 'collide' | 'shield' | 'execute';

export interface Mod {
  kind: ModKind;
  /** 百分比（+15 / -25）；armor 是固定值 */
  value: number;
  /** flank 專用：true = 從背後打（背襲），不然是側擊 */
  rear?: boolean;
}

export interface Forecast {
  dmg: number;
  mods: Mod[];
  kills: boolean;
  /** 對方活著而且打得到我的話會反擊 */
  counter: { dmg: number; kills: boolean } | null;
}

export type AttackKind = 'weapon' | 'counter' | 'overwatch' | 'skill' | 'splash' | 'collide';

export type BattleEvent =
  | { t: 'move'; uid: number; path: Pos[] }
  | { t: 'face'; uid: number; dir: Dir }
  | { t: 'attack'; uid: number; target: number; at: Pos; kind: AttackKind; skill?: string; dmg: number; mods: Mod[]; hp: number; killed: boolean }
  | { t: 'skill'; uid: number; skill: string; at: Pos }
  | { t: 'heal'; uid: number; target: number; amount: number; hp: number }
  | { t: 'stun'; uid: number; target: number }
  | { t: 'push'; target: number; from: Pos; to: Pos; fell: boolean }
  | { t: 'leap'; uid: number; from: Pos; to: Pos }
  | { t: 'rally'; uid: number; target: number }
  | { t: 'hold'; n: number; of: number }
  | { t: 'death'; uid: number }
  | { t: 'overwatch'; uid: number }
  | { t: 'wait'; uid: number }
  | { t: 'spawn'; uid: number }
  | { t: 'phase'; side: Side; turn: number }
  | { t: 'say'; id: string }
  | { t: 'end'; result: 'win' | 'lose'; reason: string };
