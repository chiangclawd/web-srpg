import { Path } from './Path';
import { Rng, clamp, dist, dist2, ellipseDist, inEllipse, type Vec } from './math';
import type { DamageKind, EnemyDef, HeroDef, LevelDef, Range2, TowerLevelDef, TowerType } from './defs';
import {
  Enemy,
  Projectile,
  Soldier,
  Tower,
  newId,
  type DamageSourceKind,
  type ProjKind,
  type Zone,
} from './entities';
import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import { heroLevelForXp, HERO_MAX_LEVEL } from '../data/heroes';
import { baseMods, type Mods } from '../data/upgrades';

export const PLAY_W = 1280;
export const PLAY_H = 720;

export const METEOR_BASE_CD = 70;
export const REINF_BASE_CD = 12;
export const HERO_RESPAWN = 15;
export const SELL_RATIO = 0.6;
export const DEFAULT_WAVE_GAP = 20;
export const BUILD_TIME = 0.6;

export type Difficulty = 'casual' | 'normal' | 'veteran';
const DIFF_HP: Record<Difficulty, number> = { casual: 0.7, normal: 1, veteran: 1.25 };
/** 首領在休閒難度額外削弱（漏掉首領＝直接失敗，休閒玩家需要更多容錯） */
const DIFF_BOSS_HP: Record<Difficulty, number> = { casual: 0.55, normal: 1, veteran: 1.2 };
const DIFF_GOLD: Record<Difficulty, number> = { casual: 1.2, normal: 1, veteran: 0.9 };

export type SimEvent =
  | { type: 'enemySpawn'; e: Enemy }
  | { type: 'enemyDie'; e: Enemy }
  | { type: 'enemyLeak'; e: Enemy }
  | { type: 'gold'; x: number; y: number; amount: number }
  | { type: 'projSpawn'; p: Projectile }
  | { type: 'projHit'; p: Projectile; hit: boolean }
  | { type: 'explosion'; x: number; y: number; r: number; kind: 'bomb' | 'bomblet' | 'meteor' | 'missile' | 'nova' | 'holy' | 'shock' }
  | { type: 'towerShoot'; t: Tower; tx: number; ty: number }
  | { type: 'lightning'; pts: Vec[] }
  | { type: 'beam'; x1: number; y1: number; x2: number; y2: number; kind: 'disintegrate' | 'ice' | 'charge' }
  | { type: 'melee'; x: number; y: number; heavy: boolean }
  | { type: 'soldierSpawn'; s: Soldier }
  | { type: 'soldierDie'; s: Soldier }
  | { type: 'heal'; x: number; y: number; big?: boolean }
  | { type: 'heroLevel'; level: number }
  | { type: 'heroSkill'; skill: string; x: number; y: number }
  | { type: 'waveStart'; index: number; boss: boolean }
  | { type: 'waveBonus'; gold: number; x: number; y: number }
  | { type: 'status'; e: Enemy; kind: 'stun' | 'root' | 'poison' | 'sheep' | 'teleport' | 'dodge' | 'enrage' | 'slow' }
  | { type: 'summon'; x: number; y: number }
  | { type: 'enemyHeal'; x: number; y: number }
  | { type: 'build'; t: Tower }
  | { type: 'upgrade'; t: Tower }
  | { type: 'sell'; t: Tower; refund: number }
  | { type: 'skillBuy'; t: Tower; skill: string }
  | { type: 'spell'; kind: 'meteor' | 'reinforce'; x: number; y: number }
  | { type: 'zone'; z: Zone }
  | { type: 'lifeLost'; amount: number; x: number; y: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface BuildSpot {
  x: number;
  y: number;
  tower: Tower | null;
}

export interface WorldOptions {
  level: LevelDef;
  mods?: Mods;
  hero?: { def: HeroDef; xp: number } | null;
  difficulty?: Difficulty;
  seed?: number;
}

interface SpawnEntry {
  at: number;
  enemy: string;
  path: number;
}

export class World {
  readonly level: LevelDef;
  readonly paths: Path[];
  readonly mods: Mods;
  readonly rng: Rng;
  readonly difficulty: Difficulty;
  time = 0;
  gold: number;
  lives: number;
  readonly maxLives: number;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  soldiers: Soldier[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  hero: Soldier | null = null;
  spots: BuildSpot[];
  events: SimEvent[] = [];

  waveIndex = -1;
  readonly waveCount: number;
  waveState: 'waiting' | 'spawning' | 'gap' | 'done' = 'waiting';
  nextWaveAt = 0;
  gapTotal = 0;
  private spawnQueue: SpawnEntry[] = [];

  meteorCd = 0;
  readonly meteorCdMax: number;
  reinfCd = 0;
  readonly reinfCdMax: number;

  result: 'victory' | 'defeat' | null = null;
  stats = { kills: 0, leaks: 0, goldEarned: 0, towersBuilt: 0, meteorKills: 0 };

  constructor(opts: WorldOptions) {
    this.level = opts.level;
    this.mods = opts.mods ?? baseMods();
    this.rng = new Rng(opts.seed ?? opts.level.seed);
    this.difficulty = opts.difficulty ?? 'normal';
    this.paths = opts.level.paths.map((p) => new Path(p));
    this.gold = Math.round(opts.level.startGold * DIFF_GOLD[this.difficulty]);
    this.lives = this.maxLives = opts.level.lives;
    this.waveCount = opts.level.waves.length;
    this.spots = opts.level.spots.map((s) => ({ x: s.x, y: s.y, tower: null }));
    this.meteorCdMax = METEOR_BASE_CD * this.mods.meteorCd;
    this.reinfCdMax = REINF_BASE_CD * this.mods.reinfCd;
    this.meteorCd = this.meteorCdMax * 0.5;
    this.reinfCd = 0;
    if (opts.hero) this.spawnHero(opts.hero.def, opts.hero.xp);
  }

  private emit(e: SimEvent): void {
    this.events.push(e);
  }

  drainEvents(): SimEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  // ═════════════════════════ 經濟 / 建造 ═════════════════════════

  private costMul(type: TowerType): number {
    const m = this.mods;
    return type === 'archer' ? m.archerCost : type === 'barracks' ? m.barracksCost : type === 'mage' ? m.mageCost : m.artCost;
  }

  buildCost(type: TowerType): number {
    return Math.round(TOWERS[type].levels[0].cost * this.costMul(type));
  }

  upgradeCost(t: Tower): number | null {
    if (t.level >= 3) return null;
    return Math.round(TOWERS[t.type].levels[t.level].cost * this.costMul(t.type));
  }

  branchCost(t: Tower, idx: number): number | null {
    if (t.level !== 3) return null;
    const b = TOWERS[t.type].branches[idx];
    return b ? Math.round(b.cost * this.costMul(t.type)) : null;
  }

  skillCost(t: Tower, skillId: string): number | null {
    const s = t.def.skills?.find((k) => k.id === skillId);
    if (!s) return null;
    const lv = t.skills[skillId] ?? 0;
    return lv < s.costs.length ? s.costs[lv] : null;
  }

  sellValue(t: Tower): number {
    return Math.round(t.invested * SELL_RATIO);
  }

  build(spotIndex: number, type: TowerType): Tower | null {
    const spot = this.spots[spotIndex];
    if (!spot || spot.tower) return null;
    const cost = this.buildCost(type);
    if (this.gold < cost) return null;
    this.gold -= cost;
    const t = new Tower(type, TOWERS[type].levels[0], spotIndex, spot.x, spot.y);
    t.invested = cost;
    t.buildUntil = this.time + BUILD_TIME;
    t.cd = BUILD_TIME + 0.2;
    spot.tower = t;
    this.towers.push(t);
    this.stats.towersBuilt++;
    if (type === 'barracks') {
      const r = this.defaultRally(t);
      t.rallyX = r.x;
      t.rallyY = r.y;
      this.syncBarracks(t, true);
    }
    this.emit({ type: 'build', t });
    return t;
  }

  upgrade(t: Tower): boolean {
    const cost = this.upgradeCost(t);
    if (cost === null || this.gold < cost) return false;
    this.gold -= cost;
    t.invested += cost;
    t.def = TOWERS[t.type].levels[t.level];
    t.level++;
    t.buildUntil = this.time + BUILD_TIME;
    if (t.type === 'barracks') this.syncBarracks(t, false);
    this.emit({ type: 'upgrade', t });
    return true;
  }

  chooseBranch(t: Tower, idx: number): boolean {
    const cost = this.branchCost(t, idx);
    if (cost === null || this.gold < cost) return false;
    this.gold -= cost;
    t.invested += cost;
    t.def = TOWERS[t.type].branches[idx];
    t.branch = t.def.branchId ?? null;
    t.level = 4;
    t.buildUntil = this.time + BUILD_TIME;
    for (const s of t.def.skills ?? []) {
      t.skills[s.id] = 0;
      t.skillCd[s.id] = 2;
    }
    if (t.type === 'barracks') this.syncBarracks(t, false);
    this.emit({ type: 'upgrade', t });
    return true;
  }

  buySkill(t: Tower, skillId: string): boolean {
    const cost = this.skillCost(t, skillId);
    if (cost === null || this.gold < cost) return false;
    this.gold -= cost;
    t.invested += cost;
    t.skills[skillId] = (t.skills[skillId] ?? 0) + 1;
    t.skillCd[skillId] = Math.min(t.skillCd[skillId] ?? 0, 1);
    this.emit({ type: 'skillBuy', t, skill: skillId });
    return true;
  }

  sell(t: Tower): void {
    const refund = this.sellValue(t);
    this.gold += refund;
    for (const s of t.soldiers) if (s && s.alive) this.removeSoldier(s, false);
    if (t.golem && t.golem.alive) this.removeSoldier(t.golem, false);
    this.spots[t.spot].tower = null;
    this.towers = this.towers.filter((x) => x !== t);
    this.emit({ type: 'sell', t, refund });
  }

  /** 兵營預設集結點：塔附近最近的路面 */
  private defaultRally(t: Tower): Vec {
    let best: Vec = { x: t.x, y: t.y + 60 };
    let bestD = Infinity;
    for (const p of this.paths) {
      for (let i = 0; i < p.pts.length; i += 3) {
        const q = p.pts[i];
        if (q.x < 10 || q.x > PLAY_W - 10 || q.y < 10 || q.y > PLAY_H - 10) continue;
        const dd = dist(q.x, q.y, t.x, t.y);
        if (dd < bestD && inEllipse(t.x, t.y, q.x, q.y, t.def.range * 0.9)) {
          bestD = dd;
          best = { x: q.x, y: q.y };
        }
      }
    }
    return best;
  }

  setRally(t: Tower, x: number, y: number): boolean {
    if (t.type !== 'barracks') return false;
    if (!inEllipse(t.x, t.y, x, y, t.def.range)) return false;
    t.rallyX = x;
    t.rallyY = y;
    t.soldiers.forEach((s, i) => {
      if (!s || !s.alive) return;
      const o = FORMATION[i % FORMATION.length];
      s.homeX = x + o.x;
      s.homeY = y + o.y;
      this.releaseTarget(s);
      s.retargetIn = 0.6;
    });
    return true;
  }

  private soldierStats(t: Tower) {
    const st = t.def.soldier!;
    const m = this.mods;
    return {
      hp: Math.round(st.hp * m.barracksHp),
      armor: Math.min(0.9, st.armor + m.barracksArmor),
      dmg: [st.dmg[0] * m.barracksDmg, st.dmg[1] * m.barracksDmg] as Range2,
      cd: st.cd,
      regen: st.regen,
      sprite: st.sprite,
      count: st.count,
      respawn: st.respawn * m.barracksRespawn,
    };
  }

  /** 建造/升級兵營時同步士兵數量與數值 */
  private syncBarracks(t: Tower, fresh: boolean): void {
    const st = this.soldierStats(t);
    for (let i = 0; i < st.count; i++) {
      const s = t.soldiers[i];
      if (s && s.alive) {
        s.maxHp = st.hp;
        s.hp = st.hp;
        s.armor = st.armor;
        s.dmg = st.dmg;
        s.cd = st.cd;
        s.regen = st.regen;
        s.sprite = st.sprite;
        this.applyBarracksSkillStats(t, s);
      } else {
        t.soldiers[i] = null;
        t.respawnAt[i] = this.time + (fresh ? BUILD_TIME + 0.1 * i : 0.2 + 0.3 * i);
      }
    }
  }

  private applyBarracksSkillStats(t: Tower, s: Soldier): void {
    if (t.branch === 'barbarian') {
      const lv = t.skills.axes ?? 0;
      s.ranged = lv > 0 ? { range: 130, dmg: [10 + 10 * lv, 18 + 14 * lv], cd: 2.2, kind: 'axe', dmgKind: 'physical' } : undefined;
    }
  }

  private spawnBarracksSoldier(t: Tower, i: number): void {
    const st = this.soldierStats(t);
    const s = new Soldier('barracks', st.sprite, 44, t.x, t.y + 8, st.hp, st.armor, st.dmg, st.cd, st.regen);
    const o = FORMATION[i % FORMATION.length];
    s.homeX = t.rallyX + o.x;
    s.homeY = t.rallyY + o.y;
    s.tower = t;
    s.slot = i;
    s.engageR = 72;
    s.speed = 80;
    this.applyBarracksSkillStats(t, s);
    t.soldiers[i] = s;
    this.soldiers.push(s);
    this.emit({ type: 'soldierSpawn', s });
  }

  // ═════════════════════════ 英雄 ═════════════════════════

  private spawnHero(def: HeroDef, xp: number): void {
    const lv = heroLevelForXp(xp);
    const st = heroStats(def, lv);
    const p = this.level.heroStart;
    const s = new Soldier('hero', def.sprite, def.height, p.x, p.y, st.hp, def.armor, st.dmg, def.cd, def.regen);
    s.speed = def.speed;
    s.engageR = def.ranged ? def.ranged.range : 95;
    if (def.ranged) {
      s.ranged = { range: def.ranged.range, dmg: st.dmg, cd: def.cd, kind: def.ranged.kind === 'magic' ? 'magic' : 'arrow', dmgKind: def.ranged.dmgKind };
    }
    s.hero = { def, level: lv, xp, startXp: xp, skillCd: {}, moveTo: null, respawnAt: 0 };
    for (const sk of def.skills) s.hero.skillCd[sk.id] = 2;
    this.hero = s;
    this.soldiers.push(s);
    this.emit({ type: 'soldierSpawn', s });
  }

  moveHero(x: number, y: number): boolean {
    const h = this.hero;
    if (!h || !h.alive || !h.hero) return false;
    x = clamp(x, 20, PLAY_W - 20);
    y = clamp(y, 40, PLAY_H - 20);
    h.hero.moveTo = { x, y };
    h.homeX = x;
    h.homeY = y;
    this.releaseTarget(h);
    return true;
  }

  private gainHeroXp(amount: number): void {
    const h = this.hero;
    if (!h || !h.hero) return;
    const hr = h.hero;
    if (hr.level >= HERO_MAX_LEVEL) return;
    hr.xp += amount;
    const lv = heroLevelForXp(hr.xp);
    if (lv > hr.level) {
      hr.level = lv;
      const st = heroStats(hr.def, lv);
      const ratio = h.hp / h.maxHp;
      h.maxHp = st.hp;
      h.hp = Math.min(st.hp, st.hp * ratio + st.hp * 0.3);
      h.dmg = st.dmg;
      if (h.ranged) h.ranged.dmg = st.dmg;
      this.emit({ type: 'heroLevel', level: lv });
    }
  }

  // ═════════════════════════ 法術 ═════════════════════════

  castMeteor(x: number, y: number): boolean {
    if (this.meteorCd > 0) return false;
    this.meteorCd = this.meteorCdMax;
    const n = this.mods.meteorCount;
    for (let i = 0; i < n; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = i === 0 ? 0 : this.rng.range(15, 55);
      const tx = x + Math.cos(a) * r;
      const ty = y + Math.sin(a) * r * 0.7;
      const dmg = this.rng.range(40, 70) * this.mods.meteorDmg;
      const p = new Projectile('meteor', tx + 160, ty - 620, tx, ty, 0.85 + i * 0.16, 0, null, dmg, 'true', 'spell', null);
      p.splash = 58 * this.mods.meteorRadius;
      p.hitsAir = false;
      this.addProjectile(p);
    }
    this.emit({ type: 'spell', kind: 'meteor', x, y });
    return true;
  }

  castReinforce(x: number, y: number): boolean {
    if (this.reinfCd > 0) return false;
    this.reinfCd = this.reinfCdMax;
    const m = this.mods;
    const n = m.reinfCount;
    for (let i = 0; i < n; i++) {
      const o = FORMATION[i % FORMATION.length];
      const s = new Soldier(
        'militia',
        m.reinfSprite,
        42,
        x + o.x,
        y + o.y,
        Math.round(45 * m.reinfHp),
        Math.min(0.8, m.reinfArmor),
        [2 * m.reinfDmg, 4 * m.reinfDmg],
        1,
        3,
      );
      s.expireAt = this.time + 22;
      s.engageR = 80;
      this.soldiers.push(s);
      this.emit({ type: 'soldierSpawn', s });
    }
    this.emit({ type: 'spell', kind: 'reinforce', x, y });
    return true;
  }

  // ═════════════════════════ 波次 ═════════════════════════

  /** 下一波會從哪些路徑出現（給 UI 放骷髏按鈕） */
  nextWavePaths(): number[] {
    const w = this.level.waves[this.waveIndex + 1];
    if (!w) return [];
    return [...new Set(w.groups.map((g) => g.path))];
  }

  nextWaveEnemies(): { enemy: string; count: number }[] {
    const w = this.level.waves[this.waveIndex + 1];
    if (!w) return [];
    const m = new Map<string, number>();
    for (const g of w.groups) m.set(g.enemy, (m.get(g.enemy) ?? 0) + g.count);
    return [...m.entries()].map(([enemy, count]) => ({ enemy, count }));
  }

  canCallWave(): boolean {
    return (this.waveState === 'waiting' || this.waveState === 'gap') && this.waveIndex + 1 < this.waveCount && !this.result;
  }

  /** 提前呼叫下一波：依剩餘秒數給獎金並縮短法術冷卻 */
  callNextWave(): number {
    if (!this.canCallWave()) return 0;
    let bonus = 0;
    if (this.waveState === 'gap') {
      const remain = Math.max(0, this.nextWaveAt - this.time);
      bonus = Math.round(remain * 1.4);
      if (bonus > 0) {
        this.gold += bonus;
        this.stats.goldEarned += bonus;
        const p0 = this.paths[this.nextWavePaths()[0] ?? 0].posAt(30);
        this.emit({ type: 'waveBonus', gold: bonus, x: p0.x, y: p0.y });
      }
      this.meteorCd = Math.max(0, this.meteorCd - remain);
      this.reinfCd = Math.max(0, this.reinfCd - remain);
    }
    this.startWave();
    return bonus;
  }

  private startWave(): void {
    this.waveIndex++;
    const w = this.level.waves[this.waveIndex];
    let boss = false;
    for (const g of w.groups) {
      if (ENEMIES[g.enemy]?.boss) boss = true;
      for (let i = 0; i < g.count; i++) {
        this.spawnQueue.push({ at: this.time + (g.delay ?? 0) + i * g.interval, enemy: g.enemy, path: g.path });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.waveState = 'spawning';
    this.emit({ type: 'waveStart', index: this.waveIndex, boss });
  }

  private updateWaves(): void {
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
      const s = this.spawnQueue.shift()!;
      this.spawnEnemy(s.enemy, s.path, 0);
    }
    if (this.waveState === 'spawning' && this.spawnQueue.length === 0) {
      if (this.waveIndex + 1 < this.waveCount) {
        this.waveState = 'gap';
        this.gapTotal = this.level.waves[this.waveIndex].gap ?? DEFAULT_WAVE_GAP;
        this.nextWaveAt = this.time + this.gapTotal;
      } else {
        this.waveState = 'done';
      }
    }
    if (this.waveState === 'gap' && this.time >= this.nextWaveAt) this.startWave();
  }

  spawnEnemy(id: string, pathIndex: number, d: number, lane?: number): Enemy {
    const def = ENEMIES[id];
    const path = this.paths[pathIndex];
    const ln = lane ?? this.rng.range(-1, 1) * (def.flying ? 22 : 13);
    const e = new Enemy(def, path, pathIndex, ln, def.boss ? DIFF_BOSS_HP[this.difficulty] : DIFF_HP[this.difficulty], this.time);
    e.d = d;
    path.posAt(e.d, e.lane, e);
    this.enemies.push(e);
    this.emit({ type: 'enemySpawn', e });
    return e;
  }

  // ═════════════════════════ 主迴圈 ═════════════════════════

  step(dt: number): void {
    if (this.result) return;
    this.time += dt;
    if (this.meteorCd > 0) this.meteorCd = Math.max(0, this.meteorCd - dt);
    if (this.reinfCd > 0) this.reinfCd = Math.max(0, this.reinfCd - dt);
    this.updateWaves();
    for (const e of this.enemies) this.updateEnemy(e, dt);
    for (const t of this.towers) this.updateTower(t, dt);
    for (const s of this.soldiers) this.updateSoldier(s, dt);
    for (const p of this.projectiles) this.updateProjectile(p, dt);
    this.updateZones(dt);
    this.updateHeroRespawn();
    // 清理
    if (this.enemies.some((e) => !e.alive || e.leaked)) this.enemies = this.enemies.filter((e) => e.alive && !e.leaked);
    if (this.soldiers.some((s) => !s.alive && s.kind !== 'hero')) this.soldiers = this.soldiers.filter((s) => s.alive || s.kind === 'hero');
    if (this.projectiles.some((p) => p.done)) this.projectiles = this.projectiles.filter((p) => !p.done);
    // 勝負
    if (this.lives <= 0) {
      this.lives = 0;
      this.result = 'defeat';
      this.emit({ type: 'defeat' });
    } else if (this.waveState === 'done' && this.enemies.length === 0 && this.spawnQueue.length === 0) {
      this.result = 'victory';
      this.emit({ type: 'victory' });
    }
  }

  stars(): number {
    if (this.result !== 'victory') return 0;
    if (this.lives >= this.maxLives - 2) return 3;
    if (this.lives >= Math.ceil(this.maxLives * 0.3)) return 2;
    return 1;
  }

  // ═════════════════════════ 敵人 ═════════════════════════

  private updateEnemy(e: Enemy, dt: number): void {
    if (!e.alive) return;
    const now = this.time;
    // 持續傷害
    if (e.dots.length) {
      for (const d of e.dots) {
        if (now < d.until) this.damageEnemy(e, d.dps * dt, 'true', 'tower', 0, true);
      }
      e.dots = e.dots.filter((d) => now < d.until);
      if (!e.alive) return;
    }
    if (now >= e.slowUntil) e.slowMul = 1;
    this.updateEnemyAbilities(e, dt);
    if (!e.alive) return;

    if (now < e.stunUntil) {
      e.moving = false;
      return;
    }
    // 擋路檢查
    const b = e.blocker;
    if (b && (!b.alive || b.target !== e || dist2(b.x, b.y, e.x, e.y) > 46 * 46)) e.blocker = null;

    if (e.blocker && !e.flying) {
      e.moving = false;
      const bl = e.blocker;
      e.facing = bl.x >= e.x ? 1 : -1;
      e.atkCd -= dt;
      if (e.atkCd <= 0 && !e.sheep) {
        e.atkCd = e.def.melee.cd;
        e.lastAttackAt = now;
        const dmg = this.rng.range(e.def.melee.dmg[0], e.def.melee.dmg[1]);
        const aoe = e.def.abilities?.find((a) => a.kind === 'aoeMelee');
        if (aoe && aoe.kind === 'aoeMelee') {
          for (const s of this.soldiers) {
            if (s.alive && !s.hero?.def.flying && dist2(s.x, s.y, bl.x, bl.y) <= aoe.radius * aoe.radius) this.damageSoldier(s, dmg, 'physical');
          }
          this.emit({ type: 'melee', x: bl.x, y: bl.y, heavy: true });
        } else {
          this.damageSoldier(bl, dmg, 'physical');
          this.emit({ type: 'melee', x: (bl.x + e.x) / 2, y: (bl.y + e.y) / 2 - 12, heavy: false });
        }
      }
      return;
    }

    // 遠程敵人：停下射擊附近的士兵
    const rg = e.def.ranged;
    if (rg && !e.sheep) {
      e.rangedCd -= dt;
      const tgt = this.nearestSoldier(e.x, e.y, rg.range);
      if (tgt) {
        const stop = e.stopBudget > 0;
        if (stop) {
          e.stopBudget -= dt;
          e.moving = false;
          e.facing = tgt.x >= e.x ? 1 : -1;
        }
        if (e.rangedCd <= 0) {
          e.rangedCd = rg.cd;
          e.lastAttackAt = now;
          const dmg = this.rng.range(rg.dmg[0], rg.dmg[1]);
          const kind: ProjKind = rg.kind === 'arrow' ? 'enemyArrow' : 'enemyBolt';
          const dd = dist(e.x, e.y, tgt.x, tgt.y);
          const p = new Projectile(kind, e.x, e.y - e.def.height * 0.55, tgt.x, tgt.y - 18, 0.25 + dd / 520, rg.kind === 'arrow' ? 26 : 6, tgt, dmg, rg.kind === 'arrow' ? 'physical' : 'magic', 'enemy', null);
          this.addProjectile(p);
        }
        if (stop) return;
      }
    }

    if (now < e.rootUntil) {
      e.moving = false;
      return;
    }
    // 行走
    let sp = e.speed * e.slowMul;
    if (e.enraged) {
      const en = e.def.abilities?.find((a) => a.kind === 'enrage');
      if (en && en.kind === 'enrage') sp *= en.speedMul;
    }
    if (e.sheep) sp = Math.min(sp, 24);
    e.d += sp * dt;
    e.moving = true;
    if (e.d >= e.path.length) {
      e.leaked = true;
      e.alive = false;
      const lost = e.sheep ? 1 : e.def.boss && this.difficulty === 'casual' ? Math.ceil(e.def.lives / 2) : e.def.lives;
      this.lives -= lost;
      this.stats.leaks++;
      this.releaseEngagers(e);
      this.emit({ type: 'enemyLeak', e });
      this.emit({ type: 'lifeLost', amount: lost, x: e.x, y: e.y });
      return;
    }
    const px = e.x;
    e.path.posAt(e.d, e.lane, e);
    if (Math.abs(e.x - px) > 0.01) e.facing = e.x > px ? 1 : -1;
  }

  private updateEnemyAbilities(e: Enemy, dt: number): void {
    const abs = e.def.abilities;
    if (!abs || e.sheep) return;
    for (let i = 0; i < abs.length; i++) {
      const a = abs[i];
      switch (a.kind) {
        case 'regen':
          if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + a.perSec * dt);
          break;
        case 'enrage':
          if (!e.enraged && e.hp < e.maxHp * a.belowHp) {
            e.enraged = true;
            this.emit({ type: 'status', e, kind: 'enrage' });
          }
          break;
        case 'heal': {
          e.abilityCd[i] -= dt;
          if (e.abilityCd[i] > 0) break;
          const hurt = this.enemies
            .filter((o) => o.alive && o.hp < o.maxHp && dist2(o.x, o.y, e.x, e.y) <= a.radius * a.radius)
            .slice(0, 4);
          if (!hurt.length) break;
          e.abilityCd[i] = a.cd;
          for (const o of hurt) {
            o.hp = Math.min(o.maxHp, o.hp + a.amount);
            this.emit({ type: 'enemyHeal', x: o.x, y: o.y });
          }
          e.lastAttackAt = this.time;
          break;
        }
        case 'shield': {
          e.abilityCd[i] -= dt;
          if (e.abilityCd[i] > 0) break;
          e.abilityCd[i] = a.cd;
          for (const o of this.enemies) {
            if (o.alive && dist2(o.x, o.y, e.x, e.y) <= a.radius * a.radius) o.shield = Math.max(o.shield, a.amount);
          }
          break;
        }
        case 'summon': {
          e.abilityCd[i] -= dt;
          if (e.abilityCd[i] > 0) break;
          e.abilityCd[i] = a.cd;
          for (let k = 0; k < a.count; k++) {
            this.spawnEnemy(a.enemy, e.pathIndex, Math.max(0, e.d - 20 - k * 18), this.rng.range(-14, 14));
          }
          e.lastAttackAt = this.time;
          this.emit({ type: 'summon', x: e.x, y: e.y });
          break;
        }
        case 'blink': {
          e.abilityCd[i] -= dt;
          if (e.abilityCd[i] > 0) break;
          if (e.remaining < a.distance + 120) break;
          e.abilityCd[i] = a.cd;
          this.releaseEngagers(e);
          e.d += a.distance;
          e.path.posAt(e.d, e.lane, e);
          this.emit({ type: 'status', e, kind: 'teleport' });
          break;
        }
        case 'stunTowers': {
          e.abilityCd[i] -= dt;
          if (e.abilityCd[i] > 0) break;
          const hit = this.towers.filter((t) => dist(t.x, t.y, e.x, e.y) <= a.radius);
          if (!hit.length) break;
          e.abilityCd[i] = a.cd;
          for (const t of hit) t.stunUntil = this.time + a.duration;
          this.emit({ type: 'explosion', x: e.x, y: e.y, r: a.radius, kind: 'shock' });
          break;
        }
        default:
          break;
      }
    }
  }

  private nearestSoldier(x: number, y: number, range: number): Soldier | null {
    let best: Soldier | null = null;
    let bd = Infinity;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = ellipseDist(x, y, s.x, s.y);
      if (d <= range && d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  /** 對敵人造成傷害；回傳實際傷害 */
  damageEnemy(e: Enemy, amount: number, kind: DamageKind, src: DamageSourceKind, pierce = 0, silent = false): number {
    if (!e.alive || amount <= 0) return 0;
    let a = amount;
    if (kind === 'physical') a *= 1 - clamp(e.armor - e.armorShred - pierce, 0, 0.95);
    else if (kind === 'magic') a *= 1 - clamp(e.magicResist, 0, 0.95);
    if (e.shield > 0) {
      const absorb = Math.min(e.shield, a);
      e.shield -= absorb;
      a -= absorb;
    }
    e.hp -= a;
    if (!silent) e.lastHitAt = this.time;
    if (src === 'hero') this.gainHeroXp(a * 0.07);
    if (e.hp <= 0) this.killEnemy(e, src);
    return a;
  }

  private killEnemy(e: Enemy, src: DamageSourceKind): void {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    this.releaseEngagers(e);
    const g = e.def.gold;
    this.gold += g;
    this.stats.goldEarned += g;
    this.stats.kills++;
    if (src === 'hero') this.gainHeroXp(g * 1.2);
    else this.gainHeroXp(g * 0.25);
    this.emit({ type: 'enemyDie', e });
    this.emit({ type: 'gold', x: e.x, y: e.y - e.def.height, amount: g });
    const sod = e.def.abilities?.find((a) => a.kind === 'spawnOnDeath');
    if (sod && sod.kind === 'spawnOnDeath' && !e.sheep) {
      for (let k = 0; k < sod.count; k++) this.spawnEnemy(sod.enemy, e.pathIndex, Math.max(0, e.d - k * 10), this.rng.range(-14, 14));
    }
  }

  private releaseEngagers(e: Enemy): void {
    for (const s of this.soldiers) if (s.target === e) this.releaseTarget(s);
    e.blocker = null;
  }

  applySlow(e: Enemy, mul: number, dur: number): void {
    if (e.def.boss) dur *= 0.5;
    if (mul < e.slowMul || this.time >= e.slowUntil) e.slowMul = Math.min(e.slowMul, mul);
    e.slowUntil = Math.max(e.slowUntil, this.time + dur);
  }

  applyStun(e: Enemy, dur: number): void {
    if (e.def.boss) dur *= 0.3;
    e.stunUntil = Math.max(e.stunUntil, this.time + dur);
    this.emit({ type: 'status', e, kind: 'stun' });
  }

  // ═════════════════════════ 士兵 / 英雄 ═════════════════════════

  private releaseTarget(s: Soldier): void {
    const t = s.target;
    if (t) {
      t.engagers = Math.max(0, t.engagers - 1);
      if (t.blocker === s) t.blocker = null;
    }
    s.target = null;
  }

  damageSoldier(s: Soldier, amount: number, kind: DamageKind): void {
    if (!s.alive) return;
    let a = amount;
    if (kind === 'physical') a *= 1 - clamp(s.effArmor, 0, 0.9);
    s.hp -= a;
    s.lastHitAt = this.time;
    if (s.hp <= 0) this.removeSoldier(s, true);
  }

  private removeSoldier(s: Soldier, died: boolean): void {
    if (!s.alive) return;
    s.alive = false;
    s.hp = 0;
    this.releaseTarget(s);
    for (const e of this.enemies) if (e.blocker === s) e.blocker = null;
    if (s.tower) {
      const t = s.tower;
      if (s.kind === 'golem') {
        t.golem = null;
        t.golemRespawnAt = this.time + 14;
      } else if (t.soldiers[s.slot] === s) {
        t.soldiers[s.slot] = null;
        t.respawnAt[s.slot] = this.time + this.soldierStats(t).respawn;
      }
    }
    if (s.hero) s.hero.respawnAt = this.time + HERO_RESPAWN;
    if (died || s.kind === 'militia') this.emit({ type: 'soldierDie', s });
  }

  private updateHeroRespawn(): void {
    const h = this.hero;
    if (!h || h.alive || !h.hero) return;
    if (this.time >= h.hero.respawnAt) {
      h.alive = true;
      h.hp = h.maxHp;
      h.x = h.homeX;
      h.y = h.homeY;
      h.hero.moveTo = null;
      this.emit({ type: 'soldierSpawn', s: h });
    }
  }

  private findSoldierTarget(s: Soldier): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    const r = s.engageR;
    const rangedMode = this.isRangedMode(s);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flying && !rangedMode) continue;
      const anchorX = rangedMode ? s.x : s.homeX;
      const anchorY = rangedMode ? s.y : s.homeY;
      if (!inEllipse(anchorX, anchorY, e.x, e.y, r)) continue;
      let score: number;
      if (rangedMode) {
        score = -e.remaining;
      } else if (e.blocker === s) {
        score = 1e7;
      } else if (e.engagers === 0 && !e.blocker) {
        score = 1e6 - e.remaining;
      } else {
        score = 1e5 - e.engagers * 1e4 - e.remaining;
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private updateSoldier(s: Soldier, dt: number): void {
    if (!s.alive) {
      return;
    }
    const now = this.time;
    if (now >= s.expireAt) {
      this.removeSoldier(s, false);
      return;
    }
    if (now >= s.armorBuffUntil) s.armorBuff = 0;
    s.atkCd -= dt;
    s.rangedCd -= dt;
    s.skillCd -= dt;
    s.moving = false;

    // 英雄：移動指令優先
    const hr = s.hero;
    if (hr) {
      for (const k in hr.skillCd) hr.skillCd[k] -= dt;
      if (hr.moveTo) {
        const arrived = this.moveToward(s, hr.moveTo.x, hr.moveTo.y, dt, s.speed * 1.15);
        if (arrived) hr.moveTo = null;
        s.hp = Math.min(s.maxHp, s.hp + s.regen * 0.5 * dt);
        return;
      }
    }

    // 目標驗證
    const tg = s.target;
    const rangedMode = this.isRangedMode(s);
    if (tg) {
      const anchorX = rangedMode ? s.x : s.homeX;
      const anchorY = rangedMode ? s.y : s.homeY;
      const lost = !tg.alive || (tg.flying && !rangedMode) || !inEllipse(anchorX, anchorY, tg.x, tg.y, s.engageR + (rangedMode ? 0 : 40));
      if (lost) this.releaseTarget(s);
    }
    s.retargetIn -= dt;
    if (s.retargetIn <= 0) {
      s.retargetIn = 0.25;
      const cand = this.findSoldierTarget(s);
      if (cand && cand !== s.target) {
        // 已在交戰中只有在目標未被擋住時才換
        const cur = s.target;
        const keep = cur && cur.alive && (cur.blocker === s || rangedMode);
        if (!keep || !cur) {
          if (cur) this.releaseTarget(s);
          s.target = cand;
          s.engageSlot = cand.engagers;
          cand.engagers++;
        }
      }
    }

    if (hr) this.heroSkills(s, dt);
    if (s.tower && s.tower.branch) this.barracksSkills(s);

    const t = s.target;
    if (this.isRangedMode(s)) {
      // 遠程英雄：站在原地射擊
      if (t && t.alive) {
        s.facing = t.x >= s.x ? 1 : -1;
        if (s.rangedCd <= 0) {
          s.rangedCd = s.ranged!.cd;
          s.lastAttackAt = now;
          this.soldierShoot(s, t, this.rng.range(s.ranged!.dmg[0], s.ranged!.dmg[1]), s.ranged!.dmgKind);
        }
      } else if (this.moveToward(s, s.homeX, s.homeY, dt, s.speed)) {
        this.regenIdle(s, dt);
      }
      return;
    }

    if (t && t.alive) {
      this.meleeLogic(s, t, dt);
    } else {
      const home = this.moveToward(s, s.homeX, s.homeY, dt, s.speed);
      if (home) this.regenIdle(s, dt);
    }
    // 次要遠程（北境傭兵飛斧）：沒有在近戰時對遠處敵人擲斧
    if (s.ranged && s.rangedCd <= 0) {
      const inMelee = t && t.alive && dist2(s.x, s.y, t.x, t.y) < 45 * 45;
      if (!inMelee) {
        let best: Enemy | null = null;
        let br = Infinity;
        for (const e of this.enemies) {
          if (!e.alive || !inEllipse(s.x, s.y, e.x, e.y, s.ranged.range)) continue;
          if (e.remaining < br) {
            br = e.remaining;
            best = e;
          }
        }
        if (best) {
          s.rangedCd = s.ranged.cd;
          s.lastAttackAt = now;
          s.facing = best.x >= s.x ? 1 : -1;
          this.soldierShoot(s, best, this.rng.range(s.ranged.dmg[0], s.ranged.dmg[1]), s.ranged.dmgKind);
        }
      }
    }
  }

  private isRangedMode(s: Soldier): boolean {
    return !!s.ranged && s.kind === 'hero';
  }

  private regenIdle(s: Soldier, dt: number): void {
    if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.regen * dt);
  }

  private meleeLogic(s: Soldier, t: Enemy, dt: number): void {
    const tan = t.path.tangentAt(t.d);
    const nx = -tan.y;
    const ny = tan.x;
    const reach = t.def.radius + 12;
    const slot = s.engageSlot % 4;
    let ox = tan.x * reach;
    let oy = tan.y * reach;
    if (slot === 1) {
      ox += nx * 15;
      oy += ny * 15;
    } else if (slot === 2) {
      ox -= nx * 15;
      oy -= ny * 15;
    } else if (slot === 3) {
      ox = -ox;
      oy = -oy;
    }
    const px = t.x + ox;
    const py = t.y + oy;
    const arrived = this.moveToward(s, px, py, dt, s.speed);
    const inMelee = arrived || dist2(s.x, s.y, t.x, t.y) <= (reach + 8) * (reach + 8);
    if (!inMelee) return;
    if (!t.blocker && !t.flying) t.blocker = s;
    s.facing = t.x >= s.x ? 1 : -1;
    if (s.atkCd <= 0) {
      s.atkCd = s.cd;
      s.lastAttackAt = this.time;
      const dmg = this.rng.range(s.dmg[0], s.dmg[1]);
      const src: DamageSourceKind = s.hero ? 'hero' : 'soldier';
      this.damageEnemy(t, dmg, 'physical', src);
      if (s.tower) this.onSoldierHitBonus(s, t);
      if (this.rng.chance(0.35)) this.emit({ type: 'melee', x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 - 14, heavy: false });
    }
  }

  /** 移動到目標點；回傳是否已抵達 */
  private moveToward(s: Soldier, x: number, y: number, dt: number, speed: number): boolean {
    const dx = x - s.x;
    const dy = y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 2) {
      s.x = x;
      s.y = y;
      return true;
    }
    const step = speed * dt;
    if (step >= d) {
      s.x = x;
      s.y = y;
    } else {
      s.x += (dx / d) * step;
      s.y += (dy / d) * step;
    }
    s.moving = true;
    if (Math.abs(dx) > 1) s.facing = dx > 0 ? 1 : -1;
    return step >= d;
  }

  private soldierShoot(s: Soldier, t: Enemy, dmg: number, kind: DamageKind): void {
    const r = s.ranged!;
    const d = dist(s.x, s.y, t.x, t.y);
    const pk: ProjKind = r.kind === 'axe' ? 'axe' : r.kind === 'magic' ? 'heroBolt' : 'heroArrow';
    const p = new Projectile(pk, s.x, s.y - s.height * 0.6, t.x, t.y - t.def.height * 0.45, 0.2 + d / 650, r.kind === 'magic' ? 8 : 30, t, dmg, kind, s.hero ? 'hero' : 'soldier', s);
    if (s.hero?.def.id === 'lila') p.effects.slow = { mul: 0.7, dur: 1.5 };
    this.addProjectile(p);
  }

  // ───────── 英雄技能 ─────────
  private heroSkills(h: Soldier, _dt: number): void {
    const hr = h.hero!;
    const lv = hr.level;
    const ready = (id: string) => {
      const sk = hr.def.skills.find((k) => k.id === id);
      return !!sk && lv >= sk.unlockLevel && hr.skillCd[id] <= 0;
    };
    const use = (id: string) => {
      const sk = hr.def.skills.find((k) => k.id === id)!;
      hr.skillCd[id] = sk.cd;
      h.lastAttackAt = this.time;
      this.emit({ type: 'heroSkill', skill: id, x: h.x, y: h.y });
    };
    const t = h.target;
    switch (hr.def.id) {
      case 'arthur': {
        if (ready('bash') && t && t.alive && dist(h.x, h.y, t.x, t.y) < 50) {
          use('bash');
          this.damageEnemy(t, 20 + 7 * lv, 'true', 'hero');
          if (t.alive) this.applyStun(t, 1.6);
          this.emit({ type: 'melee', x: t.x, y: t.y - 16, heavy: true });
        }
        if (ready('rally')) {
          const allies = this.soldiers.filter((o) => o.alive && dist(o.x, o.y, h.x, h.y) < 150);
          if (allies.some((o) => o.hp < o.maxHp * 0.6)) {
            use('rally');
            for (const o of allies) {
              o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.35);
              o.armorBuff = 0.25;
              o.armorBuffUntil = this.time + 6;
              this.emit({ type: 'heal', x: o.x, y: o.y });
            }
          }
        }
        if (ready('holyblade')) {
          const near = this.enemies.filter((e) => e.alive && !e.flying && dist(e.x, e.y, h.x, h.y) < 75);
          if (near.length >= 2 || (near.length && near[0].def.boss)) {
            use('holyblade');
            for (const e of near) this.damageEnemy(e, 55 + 12 * lv, 'magic', 'hero');
            this.emit({ type: 'explosion', x: h.x, y: h.y, r: 75, kind: 'holy' });
          }
        }
        break;
      }
      case 'elena': {
        const inRange = this.enemies.filter((e) => e.alive && inEllipse(h.x, h.y, e.x, e.y, h.ranged!.range));
        if (ready('multishot') && inRange.length >= 2) {
          use('multishot');
          const n = 3 + (lv >= 5 ? 1 : 0) + (lv >= 9 ? 1 : 0);
          inRange.sort((a, b) => a.remaining - b.remaining);
          for (let i = 0; i < n; i++) {
            const e = inRange[i % inRange.length];
            this.soldierShoot(h, e, this.rng.range(h.dmg[0], h.dmg[1]) * 1.2, 'physical');
          }
        }
        if (ready('pierce') && inRange.length) {
          const e = inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
          if (e.hp > 80) {
            use('pierce');
            const d = dist(h.x, h.y, e.x, e.y);
            const p = new Projectile('snipe', h.x, h.y - 30, e.x, e.y - 20, 0.12 + d / 1400, 0, e, 80 + 16 * lv, 'true', 'hero', h);
            this.addProjectile(p);
          }
        }
        if (ready('hail') && inRange.length >= 3) {
          use('hail');
          const c = this.densest(inRange, 60) ?? inRange[0];
          for (let i = 0; i < 10; i++) {
            const tx = c.x + this.rng.range(-55, 55);
            const ty = c.y + this.rng.range(-38, 38);
            const p = new Projectile('heroArrow', tx - 40, ty - 420, tx, ty, 0.5 + i * 0.07, 0, null, 18 + 4 * lv, 'physical', 'hero', h);
            p.splash = 22;
            p.hitsAir = false;
            this.addProjectile(p);
          }
        }
        break;
      }
      case 'lila': {
        const near = this.enemies.filter((e) => e.alive && dist(e.x, e.y, h.x, h.y) < 95);
        if (ready('frostnova') && near.length >= 1 && (near.length >= 2 || near[0].hp > 150)) {
          use('frostnova');
          for (const e of near) {
            this.damageEnemy(e, 22 + 6 * lv, 'magic', 'hero');
            if (e.alive) this.applySlow(e, 0.4, 3);
          }
          this.emit({ type: 'explosion', x: h.x, y: h.y, r: 95, kind: 'nova' });
        }
        const inRange = this.enemies.filter((e) => e.alive && inEllipse(h.x, h.y, e.x, e.y, h.ranged!.range));
        if (ready('icelance') && inRange.length) {
          const tgt = this.densest(inRange, 50) ?? inRange[0];
          use('icelance');
          const dx = tgt.x - h.x;
          const dy = tgt.y - h.y;
          const l = Math.hypot(dx, dy) || 1;
          const ux = dx / l;
          const uy = dy / l;
          const len = 240;
          for (const e of this.enemies) {
            if (!e.alive) continue;
            const px = e.x - h.x;
            const py = e.y - h.y;
            const along = px * ux + py * uy;
            if (along < 0 || along > len) continue;
            const perp = Math.abs(px * uy - py * ux);
            if (perp < 26) this.damageEnemy(e, 70 + 14 * lv, 'magic', 'hero');
          }
          this.emit({ type: 'beam', x1: h.x, y1: h.y - 30, x2: h.x + ux * len, y2: h.y - 20 + uy * len, kind: 'ice' });
        }
        if (ready('blizzard') && inRange.length >= 3) {
          const c = this.densest(inRange, 70) ?? inRange[0];
          use('blizzard');
          this.addZone({ kind: 'blizzard', x: c.x, y: c.y, r: 80, dps: 22 + 5 * lv, slow: 0.35, until: this.time + 5, source: 'hero' });
        }
        break;
      }
      case 'rain': {
        if (ready('charge') && t && t.alive && !t.flying) {
          const d = dist(h.x, h.y, t.x, t.y);
          if (d > 40 && d < 170) {
            use('charge');
            const sx = h.x;
            const sy = h.y;
            const ux = (t.x - sx) / d;
            const uy = (t.y - sy) / d;
            for (const e of this.enemies) {
              if (!e.alive || e.flying) continue;
              const px = e.x - sx;
              const py = e.y - sy;
              const along = px * ux + py * uy;
              if (along < -10 || along > d + 20) continue;
              if (Math.abs(px * uy - py * ux) < 30) {
                this.damageEnemy(e, 30 + 9 * lv, 'physical', 'hero');
                if (e.alive) this.applyStun(e, 0.8);
              }
            }
            h.x = t.x - ux * (t.def.radius + 12);
            h.y = t.y - uy * (t.def.radius + 12);
            this.emit({ type: 'beam', x1: sx, y1: sy - 20, x2: h.x, y2: h.y - 20, kind: 'charge' });
          }
        }
        if (ready('trample')) {
          const near = this.enemies.filter((e) => e.alive && !e.flying && dist(e.x, e.y, h.x, h.y) < 70);
          if (near.length >= 2) {
            use('trample');
            for (const e of near) {
              this.damageEnemy(e, 40 + 9 * lv, 'physical', 'hero');
              if (e.alive) this.applyStun(e, 1.3);
            }
            this.emit({ type: 'explosion', x: h.x, y: h.y, r: 70, kind: 'bomblet' });
          }
        }
        if (ready('lance') && t && t.alive && t.hp > 200 && dist(h.x, h.y, t.x, t.y) < 60) {
          use('lance');
          this.damageEnemy(t, 150 + 28 * lv, 'true', 'hero');
          this.emit({ type: 'melee', x: t.x, y: t.y - 20, heavy: true });
        }
        break;
      }
      case 'aria': {
        const inRange = this.enemies.filter((e) => e.alive && inEllipse(h.x, h.y, e.x, e.y, h.ranged!.range));
        if (ready('dive') && t && t.alive && inRange.includes(t)) {
          use('dive');
          this.damageEnemy(t, 60 + 13 * lv, 'physical', 'hero');
          if (t.alive) this.applyStun(t, 1.2);
          this.emit({ type: 'beam', x1: h.x, y1: h.y - 60, x2: t.x, y2: t.y - 20, kind: 'charge' });
          this.emit({ type: 'explosion', x: t.x, y: t.y, r: 40, kind: 'holy' });
        }
        if (ready('gale') && inRange.length >= 3) {
          use('gale');
          const c = this.densest(inRange, 70) ?? inRange[0];
          const group = inRange.filter((e) => !e.def.boss && dist(e.x, e.y, c.x, c.y) < 90).slice(0, 6);
          for (const e of group) {
            this.releaseEngagers(e);
            e.d = Math.max(0, e.d - 85);
            e.path.posAt(e.d, e.lane, e);
            this.damageEnemy(e, 20 + 4 * lv, 'physical', 'hero');
            this.emit({ type: 'status', e, kind: 'teleport' });
          }
        }
        if (ready('storm') && inRange.length >= 2) {
          use('storm');
          for (let k = 0; k < 6; k++) {
            const e = inRange[Math.floor(this.rng.next() * inRange.length)];
            if (!e.alive) continue;
            this.damageEnemy(e, 40 + 9 * lv, 'magic', 'hero');
            this.emit({ type: 'lightning', pts: [{ x: e.x + this.rng.range(-20, 20), y: e.y - 260 }, { x: e.x, y: e.y - e.def.height * 0.5 }] });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private densest(list: Enemy[], r: number): Enemy | null {
    let best: Enemy | null = null;
    let bn = -1;
    for (const e of list) {
      let n = 0;
      for (const o of list) if (dist2(o.x, o.y, e.x, e.y) <= r * r) n++;
      if (n > bn) {
        bn = n;
        best = e;
      }
    }
    return best;
  }

  // ───────── 兵營特化技能 ─────────
  private barracksSkills(s: Soldier): void {
    const t = s.tower!;
    if (t.branch === 'paladin') {
      const lv = t.skills.healing ?? 0;
      if (lv > 0 && s.skillCd <= 0 && s.hp < s.maxHp * 0.5) {
        s.skillCd = 10;
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * (0.2 + 0.15 * lv));
        this.emit({ type: 'heal', x: s.x, y: s.y, big: true });
      }
    }
  }

  private onSoldierHitBonus(s: Soldier, target: Enemy): void {
    const t = s.tower;
    if (!t || !t.branch) return;
    if (t.branch === 'paladin') {
      const lv = t.skills.holystrike ?? 0;
      if (lv > 0 && this.rng.chance(0.2)) {
        for (const e of this.enemies) {
          if (e.alive && !e.flying && dist(e.x, e.y, target.x, target.y) < 55) this.damageEnemy(e, 15 + 20 * lv, 'magic', 'soldier');
        }
        this.emit({ type: 'explosion', x: target.x, y: target.y, r: 55, kind: 'holy' });
      }
    } else if (t.branch === 'barbarian') {
      const lv = t.skills.whirlwind ?? 0;
      if (lv > 0 && this.rng.chance(0.3)) {
        for (const e of this.enemies) {
          if (e.alive && !e.flying && e !== target && dist(e.x, e.y, s.x, s.y) < 50) this.damageEnemy(e, 12 + 12 * lv, 'physical', 'soldier');
        }
        this.emit({ type: 'heroSkill', skill: 'whirlwind', x: s.x, y: s.y });
      }
    }
  }

  // ═════════════════════════ 塔 ═════════════════════════

  towerRange(t: Tower): number {
    const m = this.mods;
    const mul = t.type === 'archer' ? m.archerRange : t.type === 'mage' ? m.mageRange : t.type === 'artillery' ? m.artRange : 1;
    return t.def.range * mul;
  }

  private towerDmgMul(t: Tower): number {
    const m = this.mods;
    return t.type === 'archer' ? m.archerDmg : t.type === 'mage' ? m.mageDmg : t.type === 'artillery' ? m.artDmg : 1;
  }

  /** 塔的射擊原點（塔頂） */
  muzzle(t: Tower): Vec {
    const h = t.type === 'mage' ? 70 : t.type === 'archer' ? 64 : 40;
    return { x: t.x, y: t.y - h };
  }

  private pickTarget(t: Tower, range: number, air: boolean): Enemy | null {
    let best: Enemy | null = null;
    let br = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flying && !air) continue;
      if (!inEllipse(t.x, t.y, e.x, e.y, range)) continue;
      if (e.remaining < br) {
        br = e.remaining;
        best = e;
      }
    }
    return best;
  }

  private enemiesInRange(t: Tower, range: number, air: boolean): Enemy[] {
    return this.enemies.filter((e) => e.alive && (air || !e.flying) && inEllipse(t.x, t.y, e.x, e.y, range));
  }

  private updateTower(t: Tower, dt: number): void {
    const now = this.time;
    if (t.type === 'barracks') {
      for (let i = 0; i < t.respawnAt.length; i++) {
        if (!t.soldiers[i] && now >= t.respawnAt[i] && now >= t.buildUntil) this.spawnBarracksSoldier(t, i);
      }
      return;
    }
    if (now < t.buildUntil || now < t.stunUntil) return;
    for (const k in t.skillCd) t.skillCd[k] -= dt;
    this.towerSkills(t);
    t.cd -= dt;
    if (t.cd > 0) return;
    const range = this.towerRange(t);
    const target = this.pickTarget(t, range, t.def.hitsAir);
    if (!target) {
      t.cd = 0.1;
      return;
    }
    t.cd = t.def.cooldown;
    t.lastShotAt = now;
    t.aimX = target.x;
    t.aimY = target.y;
    const dmgMul = this.towerDmgMul(t);
    const roll = () => this.rng.range(t.def.damage[0], t.def.damage[1]) * dmgMul;
    const m = this.muzzle(t);
    this.emit({ type: 'towerShoot', t, tx: target.x, ty: target.y });
    switch (t.def.attack) {
      case 'arrow': {
        const shooters = t.def.shooters ?? 1;
        t.shooterTurn = (t.shooterTurn + 1) % Math.max(1, shooters);
        const ox = shooters > 1 ? (t.shooterTurn === 0 ? -9 : 9) : 0;
        const d = dist(m.x, m.y, target.x, target.y);
        const heavy = t.branch === 'marksman';
        const p = new Projectile(heavy ? 'snipe' : 'arrow', m.x + ox, m.y, target.x, target.y - target.def.height * 0.45, heavy ? 0.12 + d / 1300 : 0.22 + d / 700, heavy ? 6 : 34, target, roll(), 'physical', 'tower', t);
        p.effects.pierce = this.mods.archerPierce;
        if (this.mods.archerCrit > 0 && this.rng.chance(this.mods.archerCrit)) p.effects.crit = 2;
        const poison = t.skills.poison ?? 0;
        if (poison > 0) p.effects.poison = { dps: 4 + 5 * poison, dur: 3 };
        this.addProjectile(p);
        break;
      }
      case 'bolt': {
        const d = dist(m.x, m.y, target.x, target.y);
        const p = new Projectile('bolt', m.x, m.y, target.x, target.y - target.def.height * 0.45, 0.18 + d / 900, 10, target, roll(), 'magic', 'tower', t);
        if (this.mods.mageShred > 0) p.effects.shred = this.mods.mageShred;
        if (this.mods.mageSlow > 0) p.effects.slow = { mul: 1 - this.mods.mageSlow, dur: 1.5 };
        this.addProjectile(p);
        break;
      }
      case 'bomb': {
        const flight = 0.9 + dist(t.x, t.y, target.x, target.y) / 600;
        let tx = target.x;
        let ty = target.y;
        if (!target.blocker && !(now < target.stunUntil) && !(now < target.rootUntil)) {
          const pp = target.path.posAt(target.d + target.speed * target.slowMul * flight * 0.9, target.lane);
          tx = pp.x;
          ty = pp.y;
        }
        const p = new Projectile('bomb', m.x, m.y, tx, ty, flight, 130, null, roll(), 'physical', 'tower', t);
        p.splash = (t.def.splash ?? 55) * this.mods.artSplash;
        p.hitsAir = false;
        this.addProjectile(p);
        break;
      }
      case 'tesla': {
        const sup = t.skills.supercharge ?? 0;
        const jumps = 3 + sup * 2;
        const hit = new Set<Enemy>();
        const pts: Vec[] = [{ x: m.x, y: m.y - 8 }];
        let cur: Enemy | null = target;
        let dmg = roll();
        for (let i = 0; i <= jumps && cur; i++) {
          hit.add(cur);
          pts.push({ x: cur.x, y: cur.y - cur.def.height * 0.5 });
          this.damageEnemy(cur, dmg, 'magic', 'tower');
          dmg *= 0.82;
          let next: Enemy | null = null;
          let nd = 85 * 85;
          for (const e of this.enemies) {
            if (!e.alive || hit.has(e)) continue;
            const dd = dist2(e.x, e.y, cur.x, cur.y);
            if (dd < nd) {
              nd = dd;
              next = e;
            }
          }
          cur = next;
        }
        this.emit({ type: 'lightning', pts });
        const oc = t.skills.overcharge ?? 0;
        if (oc > 0) {
          for (const e of this.enemies) {
            if (e.alive && !e.flying && inEllipse(t.x, t.y, e.x, e.y, 80)) this.damageEnemy(e, 8 + 10 * oc, 'magic', 'tower');
          }
          this.emit({ type: 'explosion', x: t.x, y: t.y, r: 80, kind: 'shock' });
        }
        break;
      }
      default:
        break;
    }
  }

  private towerSkills(t: Tower): void {
    if (!t.branch) return;
    const range = this.towerRange(t);
    const cdReady = (id: string) => (t.skills[id] ?? 0) > 0 && (t.skillCd[id] ?? 0) <= 0;
    const m = this.muzzle(t);
    switch (t.branch) {
      case 'ranger': {
        if (cdReady('thorns')) {
          const lv = t.skills.thorns;
          const list = this.enemiesInRange(t, range, false).filter((e) => !e.def.boss).slice(0, 2 + lv);
          if (list.length) {
            t.skillCd.thorns = 11;
            for (const e of list) {
              e.rootUntil = this.time + 1 + lv * 0.7;
              this.damageEnemy(e, 10 * lv, 'true', 'tower');
              this.emit({ type: 'status', e, kind: 'root' });
            }
          }
        }
        break;
      }
      case 'marksman': {
        if (cdReady('snipe')) {
          const lv = t.skills.snipe;
          const list = this.enemiesInRange(t, range, true);
          if (list.length) {
            const e = list.reduce((a, b) => (b.hp > a.hp ? b : a));
            t.skillCd.snipe = 16 - lv * 2;
            const kill = !e.def.boss && this.rng.chance(0.1 + 0.08 * lv);
            const d = dist(m.x, m.y, e.x, e.y);
            const p = new Projectile('snipe', m.x, m.y, e.x, e.y - e.def.height * 0.5, 0.1 + d / 1600, 0, e, kill ? 99999 : 150 + 110 * lv, 'true', 'tower', t);
            this.addProjectile(p);
            this.emit({ type: 'towerShoot', t, tx: e.x, ty: e.y });
          }
        }
        if (cdReady('scatter')) {
          const lv = t.skills.scatter;
          const list = this.enemiesInRange(t, range, true);
          if (list.length >= 2) {
            t.skillCd.scatter = 9;
            const n = 3 + 2 * lv;
            for (let i = 0; i < n; i++) {
              const e = list[i % list.length];
              const d = dist(m.x, m.y, e.x, e.y);
              this.addProjectile(new Projectile('arrow', m.x, m.y, e.x, e.y - 20, 0.2 + d / 800 + i * 0.03, 20, e, this.rng.range(16, 28), 'physical', 'tower', t));
            }
          }
        }
        break;
      }
      case 'arcane': {
        if (cdReady('disintegrate')) {
          const lv = t.skills.disintegrate;
          const list = this.enemiesInRange(t, range, true).filter((e) => !e.def.boss);
          if (list.length) {
            const e = list.reduce((a, b) => (b.maxHp > a.maxHp ? b : a));
            if (e.maxHp >= 100) {
              t.skillCd.disintegrate = 24 - 4 * lv;
              this.emit({ type: 'beam', x1: m.x, y1: m.y, x2: e.x, y2: e.y - e.def.height * 0.5, kind: 'disintegrate' });
              this.damageEnemy(e, 999999, 'true', 'tower');
            }
          }
        }
        if (cdReady('teleport')) {
          const lv = t.skills.teleport;
          const list = this.enemiesInRange(t, range, false).filter((e) => !e.def.boss);
          if (list.length >= 2) {
            t.skillCd.teleport = 15 - lv;
            const c = this.densest(list, 55)!;
            const group = list.filter((e) => dist(e.x, e.y, c.x, c.y) < 60).slice(0, 3 + lv);
            for (const e of group) {
              this.releaseEngagers(e);
              e.d = Math.max(0, e.d - (70 + 35 * lv));
              e.path.posAt(e.d, e.lane, e);
              this.emit({ type: 'status', e, kind: 'teleport' });
            }
          }
        }
        break;
      }
      case 'elemental': {
        const glv = t.skills.golem ?? 0;
        if (glv > 0 && !t.golem && this.time >= t.golemRespawnAt) this.spawnGolem(t, glv);
        if (t.golem && t.golem.alive && t.golem.maxHp < 250 + 150 * glv) {
          t.golem.maxHp = 250 + 150 * glv;
          t.golem.dmg = [8 + 8 * glv, 16 + 10 * glv];
        }
        if (cdReady('polymorph')) {
          const lv = t.skills.polymorph;
          const list = this.enemiesInRange(t, range, true).filter((e) => !e.def.boss && !e.sheep);
          if (list.length) {
            const e = list.reduce((a, b) => (b.hp > a.hp ? b : a));
            if (e.hp >= 60) {
              t.skillCd.polymorph = 20 - 3 * lv;
              this.releaseEngagers(e);
              e.sheep = true;
              e.maxHp = 30;
              e.hp = Math.min(e.hp, 30);
              e.armor = 0;
              e.magicResist = 0;
              this.emit({ type: 'status', e, kind: 'sheep' });
            }
          }
        }
        break;
      }
      case 'bertha': {
        if (cdReady('cluster')) {
          const lv = t.skills.cluster;
          const target = this.pickTarget(t, range, false);
          if (target) {
            t.skillCd.cluster = 12;
            const n = 3 + 2 * lv;
            for (let i = 0; i < n; i++) {
              const tx = target.x + this.rng.range(-55, 55);
              const ty = target.y + this.rng.range(-38, 38);
              const p = new Projectile('bomblet', m.x, m.y, tx, ty, 1 + i * 0.06, 150, null, this.rng.range(30, 50), 'physical', 'tower', t);
              p.splash = 38;
              p.hitsAir = false;
              this.addProjectile(p);
            }
          }
        }
        if (cdReady('missile')) {
          const lv = t.skills.missile;
          const list = this.enemiesInRange(t, range * 1.2, true);
          if (list.length) {
            const e = list.reduce((a, b) => (b.hp > a.hp ? b : a));
            t.skillCd.missile = 11 - lv;
            const d = dist(m.x, m.y, e.x, e.y);
            const p = new Projectile('missile', m.x, m.y, e.x, e.y - e.def.height * 0.5, 0.6 + d / 700, 90, e, 120 + 100 * lv, 'physical', 'tower', t);
            p.splash = 30;
            this.addProjectile(p);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private spawnGolem(t: Tower, lv: number): void {
    // 土元素站在塔附近最近的路上
    let best: Vec = { x: t.x, y: t.y + 50 };
    let bd = Infinity;
    for (const p of this.paths) {
      for (let i = 0; i < p.pts.length; i += 3) {
        const q = p.pts[i];
        const dd = dist(q.x, q.y, t.x, t.y);
        if (dd < bd && dd > 40) {
          bd = dd;
          best = q;
        }
      }
    }
    const s = new Soldier('golem', 'mon_golem', 58, t.x, t.y + 10, 250 + 150 * lv, 0.3, [8 + 8 * lv, 16 + 10 * lv], 1.4, 10);
    s.homeX = best.x;
    s.homeY = best.y;
    s.tower = t;
    s.engageR = 80;
    s.speed = 55;
    t.golem = s;
    this.soldiers.push(s);
    this.emit({ type: 'soldierSpawn', s });
  }

  // ═════════════════════════ 投射物 / 區域 ═════════════════════════

  private addProjectile(p: Projectile): void {
    this.projectiles.push(p);
    this.emit({ type: 'projSpawn', p });
  }

  private updateProjectile(p: Projectile, dt: number): void {
    if (p.done) return;
    p.t += dt;
    const tg = p.target;
    if (tg && tg.alive) {
      if (tg instanceof Enemy) {
        p.tx = tg.x;
        p.ty = tg.y - tg.def.height * 0.45;
      } else {
        p.tx = tg.x;
        p.ty = tg.y - 18;
      }
    }
    const k = Math.min(1, p.t / p.dur);
    const px = p.x;
    const py = p.y;
    p.x = p.sx + (p.tx - p.sx) * k;
    p.y = p.sy + (p.ty - p.sy) * k - p.arc * 4 * k * (1 - k);
    if (p.x !== px || p.y !== py) p.rot = Math.atan2(p.y - py, p.x - px);
    if (k >= 1) this.impact(p);
  }

  private impact(p: Projectile): void {
    p.done = true;
    const src = p.source;
    if (p.splash > 0) {
      this.splashDamage(p);
      return;
    }
    const tg = p.target;
    if (!tg || !tg.alive) {
      this.emit({ type: 'projHit', p, hit: false });
      return;
    }
    if (tg instanceof Soldier) {
      this.damageSoldier(tg, p.dmg, p.dmgKind);
      this.emit({ type: 'projHit', p, hit: true });
      return;
    }
    const e = tg;
    // 閃避（只對箭類物理投射物）
    if ((p.kind === 'arrow' || p.kind === 'heroArrow') && e.def.abilities) {
      const dg = e.def.abilities.find((a) => a.kind === 'dodge');
      if (dg && dg.kind === 'dodge' && this.rng.chance(dg.chance)) {
        this.emit({ type: 'status', e, kind: 'dodge' });
        this.emit({ type: 'projHit', p, hit: false });
        return;
      }
    }
    const fx = p.effects;
    let dmg = p.dmg * (fx.crit ?? 1);
    if (dmg > 50000) dmg = e.hp + 1e6; // 秒殺
    this.damageEnemy(e, dmg, p.dmgKind, src, fx.pierce ?? 0);
    if (e.alive) {
      if (fx.slow) this.applySlow(e, fx.slow.mul, fx.slow.dur);
      if (fx.poison) {
        e.dots.push({ dps: fx.poison.dps, until: this.time + fx.poison.dur });
        this.emit({ type: 'status', e, kind: 'poison' });
      }
      if (fx.shred) e.armorShred = Math.min(0.5, e.armorShred + fx.shred);
      if (fx.stun) this.applyStun(e, fx.stun);
    }
    if (p.owner instanceof Soldier && p.owner.tower) this.onSoldierHitBonus(p.owner, e);
    this.emit({ type: 'projHit', p, hit: true });
  }

  private splashDamage(p: Projectile): void {
    const r = p.splash;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flying && !p.hitsAir) continue;
      const d = ellipseDist(p.tx, p.ty, e.x, e.y);
      if (d > r) continue;
      const fall = 1 - 0.45 * (d / r);
      const before = e.alive;
      this.damageEnemy(e, p.dmg * fall, p.dmgKind, p.source);
      if (before && !e.alive && p.kind === 'meteor') this.stats.meteorKills++;
      if (e.alive && p.kind === 'bomb' && this.mods.artConcuss > 0) this.applySlow(e, 1 - this.mods.artConcuss, 2);
    }
    const kind = p.kind === 'meteor' ? 'meteor' : p.kind === 'bomblet' ? 'bomblet' : p.kind === 'missile' ? 'missile' : 'bomb';
    if (p.kind === 'heroArrow') {
      this.emit({ type: 'projHit', p, hit: true });
      return;
    }
    this.emit({ type: 'explosion', x: p.tx, y: p.ty, r, kind });
    this.emit({ type: 'projHit', p, hit: true });
    if (p.kind === 'meteor' && this.mods.meteorBurn) {
      this.addZone({ kind: 'fire', x: p.tx, y: p.ty, r: r * 0.8, dps: 12, slow: 1, until: this.time + 4, source: 'spell' });
    }
  }

  private addZone(z: Omit<Zone, 'id'>): void {
    const zone: Zone = { ...z, id: newId() };
    this.zones.push(zone);
    this.emit({ type: 'zone', z: zone });
  }

  private updateZones(dt: number): void {
    if (!this.zones.length) return;
    for (const z of this.zones) {
      for (const e of this.enemies) {
        if (!e.alive || e.flying) continue;
        if (!inEllipse(z.x, z.y, e.x, e.y, z.r)) continue;
        this.damageEnemy(e, z.dps * dt, z.kind === 'fire' ? 'true' : 'magic', z.source, 0, true);
        if (e.alive && z.slow < 1) this.applySlow(e, z.slow, 0.5);
      }
    }
    this.zones = this.zones.filter((z) => this.time < z.until);
  }
}

/** 兵營 / 援軍的站位陣型 */
export const FORMATION: Vec[] = [
  { x: 0, y: -14 },
  { x: -18, y: 9 },
  { x: 18, y: 9 },
  { x: 0, y: 22 },
];

export function heroStats(def: HeroDef, lv: number): { hp: number; dmg: Range2 } {
  return {
    hp: Math.round(def.hp + def.hpPerLevel * (lv - 1)),
    dmg: [def.dmg[0] + def.dmgPerLevel * (lv - 1), def.dmg[1] + def.dmgPerLevel * (lv - 1)],
  };
}

export function towerLevelDef(type: TowerType, level: number, branch: string | null): TowerLevelDef {
  const d = TOWERS[type];
  if (level <= 3) return d.levels[level - 1];
  return d.branches.find((b) => b.branchId === branch) ?? d.branches[0];
}

export function enemyDef(id: string): EnemyDef {
  return ENEMIES[id];
}
