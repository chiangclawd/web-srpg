import type { DamageKind, EnemyDef, HeroDef, Range2, TowerLevelDef, TowerType } from './defs';
import type { Path } from './Path';

let nextId = 1;
export function newId(): number {
  return nextId++;
}

export interface Dot {
  dps: number;
  until: number;
}

export class Enemy {
  readonly id = newId();
  d = 0;
  x = 0;
  y = 0;
  hp: number;
  maxHp: number;
  armor: number;
  magicResist: number;
  speed: number;
  alive = true;
  leaked = false;
  blocker: Soldier | null = null;
  engagers = 0;
  atkCd = 0;
  rangedCd = 0;
  /** 遠程敵人可停下射擊的剩餘秒數（避免無限僵持） */
  stopBudget = 8;
  abilityCd: number[] = [];
  slowMul = 1;
  slowUntil = 0;
  stunUntil = 0;
  rootUntil = 0;
  dots: Dot[] = [];
  shield = 0;
  armorShred = 0;
  facing = 1;
  moving = true;
  enraged = false;
  sheep = false;
  /** 最後一次受擊時間（view 用來閃白） */
  lastHitAt = -1;
  lastAttackAt = -1;
  spawnedAt: number;

  /** 波次血量倍率（召喚物沿用） */
  waveMul = 1;
  /** 冰霜水晶：冰凍到此時間（畫面顯示冰藍色） */
  frozenUntil = 0;
  /** 鑽地中：無法被選為目標、免疫傷害與控制 */
  burrowed = false;
  burrowUntil = 0;

  constructor(
    readonly def: EnemyDef,
    public path: Path,
    public pathIndex: number,
    public lane: number,
    hpMul: number,
    now: number,
  ) {
    this.hp = this.maxHp = Math.round(def.hp * hpMul);
    this.armor = def.armor;
    this.magicResist = def.magicResist;
    this.speed = def.speed;
    this.spawnedAt = now;
    this.abilityCd = (def.abilities ?? []).map((a) => ('cd' in a ? a.cd * 0.6 : 0));
  }

  get flying(): boolean {
    return !!this.def.flying && !this.sheep;
  }

  /** 剩餘路程（越小代表越接近出口） */
  get remaining(): number {
    return this.path.length - this.d;
  }
}

export interface HeroRuntime {
  def: HeroDef;
  level: number;
  xp: number;
  startXp: number;
  skillCd: Record<string, number>;
  moveTo: { x: number; y: number } | null;
  respawnAt: number;
}

export type SoldierKind = 'barracks' | 'hero' | 'militia' | 'golem';

export class Soldier {
  readonly id = newId();
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  engageR = 70;
  hp: number;
  maxHp: number;
  armor: number;
  dmg: Range2;
  cd: number;
  atkCd = 0;
  regen: number;
  speed = 75;
  ranged?: { range: number; dmg: Range2; cd: number; kind: 'arrow' | 'magic' | 'axe'; dmgKind: DamageKind };
  rangedCd = 0;
  alive = true;
  target: Enemy | null = null;
  engageSlot = 0;
  facing = 1;
  moving = false;
  lastAttackAt = -1;
  lastHitAt = -1;
  tower: Tower | null = null;
  slot = 0;
  expireAt = Infinity;
  armorBuff = 0;
  armorBuffUntil = 0;
  skillCd = 0;
  retargetIn = 0;
  hero?: HeroRuntime;

  constructor(
    readonly kind: SoldierKind,
    public sprite: string,
    public height: number,
    x: number,
    y: number,
    hp: number,
    armor: number,
    dmg: Range2,
    cd: number,
    regen: number,
  ) {
    this.x = this.homeX = x;
    this.y = this.homeY = y;
    this.hp = this.maxHp = hp;
    this.armor = armor;
    this.dmg = dmg;
    this.cd = cd;
    this.regen = regen;
  }

  get effArmor(): number {
    return this.armor + this.armorBuff;
  }
}

export class Tower {
  readonly id = newId();
  level = 1;
  branch: string | null = null;
  cd = 0.5;
  invested = 0;
  rallyX = 0;
  rallyY = 0;
  soldiers: (Soldier | null)[] = [];
  respawnAt: number[] = [];
  skills: Record<string, number> = {};
  skillCd: Record<string, number> = {};
  buildUntil = 0;
  shooterTurn = 0;
  aimX = 0;
  aimY = 0;
  lastShotAt = -10;
  stunUntil = 0;
  golem: Soldier | null = null;
  golemRespawnAt = 0;

  constructor(
    readonly type: TowerType,
    public def: TowerLevelDef,
    readonly spot: number,
    readonly x: number,
    readonly y: number,
  ) {}
}

export type ProjKind =
  | 'arrow'
  | 'bolt'
  | 'bomb'
  | 'bomblet'
  | 'missile'
  | 'meteor'
  | 'enemyArrow'
  | 'enemyBolt'
  | 'axe'
  | 'heroArrow'
  | 'heroBolt'
  | 'iceShard'
  | 'snipe';

export interface ProjEffects {
  slow?: { mul: number; dur: number };
  poison?: { dps: number; dur: number };
  shred?: number;
  stun?: number;
  pierce?: number;
  crit?: number;
}

export type DamageSourceKind = 'tower' | 'hero' | 'soldier' | 'spell' | 'enemy';

export class Projectile {
  readonly id = newId();
  t = 0;
  x: number;
  y: number;
  done = false;
  rot = 0;
  effects: ProjEffects = {};
  splash = 0;
  hitsAir = true;

  constructor(
    readonly kind: ProjKind,
    readonly sx: number,
    readonly sy: number,
    public tx: number,
    public ty: number,
    readonly dur: number,
    readonly arc: number,
    public target: Enemy | Soldier | null,
    readonly dmg: number,
    readonly dmgKind: DamageKind,
    readonly source: DamageSourceKind,
    readonly owner: Tower | Soldier | null,
  ) {
    this.x = sx;
    this.y = sy;
  }
}

/** 持續區域效果（燃燒地面、暴風雪…） */
export interface Zone {
  id: number;
  kind: 'fire' | 'blizzard';
  x: number;
  y: number;
  r: number;
  dps: number;
  slow: number;
  until: number;
  source: DamageSourceKind;
}
