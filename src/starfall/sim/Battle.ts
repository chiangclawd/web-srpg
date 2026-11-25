// 《星墜殘響》戰鬥規則：等角方格 + 高低差的回合制戰棋。
// 全部是確定性的（沒有亂數）：出手前的預估傷害就是實際傷害。
// 不依賴 Phaser；畫面層呼叫這裡的動作函式，再照回傳的事件依序演出。
import { COVER_REDUCTION, TERRAIN, TERRAIN_CHARS } from './terrain';
import { DIR_VEC } from './types';
import type { AttackKind, BattleEvent, BattleSnap, Dir, Forecast, MissionDef, Mod, Pos, Side, SkillDef, SpawnDef, TerrainId, Unit, UnitDef, UnitSnap, WeaponDef } from './types';

/** 一步的爬升 / 下降多 1 層就多 1 點移動力 */
const CLIMB_COST = 1;
/** 反擊、警戒射擊的傷害比例 */
export const COUNTER_MUL = 0.6;
export const OVERWATCH_MUL = 0.8;
/** 被推去撞牆 / 撞到其他單位的固定傷害 */
export const COLLIDE_DMG = 12;
export const BUMP_DMG = 8;
export const FALL_DMG = 8;
/** 輕鬆難度下敵方的傷害與耐久倍率 */
export const EASY_DMG = 0.75;
export const EASY_HP = 0.85;
/** 挑戰模式的敵方傷害與耐久倍率。以改造過的小隊為基準（tests/starfall/challenge.test.ts 有對戰結果的要求） */
export const HARD_DMG = 1.2;
export const HARD_HP = 1.3;

export interface Reach {
  cost: number;
  /** 上一格的 key；起點是 -1 */
  prev: number;
}

export type AiFn = (b: Battle, u: Unit) => BattleEvent[];

const manhattan = (ax: number, ay: number, bx: number, by: number): number => Math.abs(ax - bx) + Math.abs(ay - by);

/** 從 (fx,fy) 看向 (tx,ty) 的面向（取位移較大的那一軸；一樣大時維持 x 軸） */
export function dirTo(fx: number, fy: number, tx: number, ty: number): Dir {
  const dx = tx - fx;
  const dy = ty - fy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
  return dy >= 0 ? 1 : 3;
}

export class Battle {
  readonly w: number;
  readonly h: number;
  readonly terrain: TerrainId[];
  readonly height: number[];
  units: Unit[] = [];
  turn = 1;
  phase: Side = 'player';
  result: 'win' | 'lose' | null = null;
  /** 我方被摧毀的機體數（影響星數） */
  lost = 0;
  /** 「守住區域」關卡：已經連續守住幾個回合 */
  held = 0;
  private nextUid = 1;
  private queue: number[] = [];
  private fired = new Set<number>();

  /** 輕鬆難度：敵方傷害 ×0.75、耐久 ×0.85 */
  readonly easy: boolean;
  /** 挑戰模式：敵方傷害 ×1.2、耐久 ×1.3。輕鬆難度在這裡不算數 */
  readonly hard: boolean;

  constructor(
    readonly mission: MissionDef,
    private readonly defs: Record<string, UnitDef>,
    easy = false,
    hard = false,
  ) {
    this.hard = hard;
    this.easy = easy && !hard;
    this.h = mission.tiles.length;
    this.w = mission.tiles[0].length;
    this.terrain = [];
    this.height = [];
    for (let y = 0; y < this.h; y++) {
      if (mission.tiles[y].length !== this.w || mission.heights[y]?.length !== this.w) throw new Error(`${mission.id}: row ${y} has the wrong width`);
      for (let x = 0; x < this.w; x++) {
        const t = TERRAIN_CHARS[mission.tiles[y][x]];
        if (!t) throw new Error(`${mission.id}: unknown terrain '${mission.tiles[y][x]}' at ${x},${y}`);
        this.terrain.push(t);
        this.height.push(Number(mission.heights[y][x]));
      }
    }
    for (const s of mission.units) this.spawn(s);
  }

  // ───────── 地圖 ─────────

  key(x: number, y: number): number {
    return y * this.w + x;
  }

  pos(k: number): Pos {
    return { x: k % this.w, y: Math.floor(k / this.w) };
  }

  inMap(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  terrainAt(x: number, y: number): TerrainId {
    return this.terrain[this.key(x, y)];
  }

  heightAt(x: number, y: number): number {
    return this.height[this.key(x, y)];
  }

  /** 擋火線的高度：艙壁比地面多 2 層 */
  private blockH(x: number, y: number): number {
    return this.heightAt(x, y) + (TERRAIN[this.terrainAt(x, y)].blocksFire ? 2 : 0);
  }

  unitAt(x: number, y: number): Unit | undefined {
    return this.units.find((u) => u.alive && u.x === x && u.y === y);
  }

  unit(uid: number): Unit {
    const u = this.units.find((v) => v.uid === uid);
    if (!u) throw new Error(`no unit ${uid}`);
    return u;
  }

  byTag(tag: string): Unit | undefined {
    return this.units.find((u) => u.tag === tag);
  }

  alive(side: Side): Unit[] {
    return this.units.filter((u) => u.alive && u.side === side);
  }

  spawn(s: SpawnDef): Unit {
    const def = this.defs[s.unit];
    if (!def) throw new Error(`unknown unit ${s.unit}`);
    const side = s.side ?? 'enemy';
    const foe = side === 'enemy';
    const [hpMul, power] = foe && this.hard ? [HARD_HP, HARD_DMG] : foe && this.easy ? [EASY_HP, EASY_DMG] : [1, 1];
    const hp = hpMul === 1 ? def.hp : Math.round(def.hp * hpMul);
    const u: Unit = {
      uid: this.nextUid++,
      def,
      side,
      x: s.x,
      y: s.y,
      dir: s.dir ?? 0,
      hp,
      maxHp: hp,
      power,
      moved: false,
      acted: false,
      cds: {},
      stun: 0,
      overwatch: false,
      alive: true,
      ai: s.ai ?? 'aggressive',
      tag: s.tag,
      prey: s.prey,
    };
    this.units.push(u);
    return u;
  }

  // ───────── 移動 ─────────

  /** 從 (fx,fy) 走到相鄰格 (tx,ty) 的消耗；走不過去回傳 Infinity（不看單位） */
  stepCost(u: Unit, fx: number, fy: number, tx: number, ty: number): number {
    if (!this.inMap(tx, ty)) return Infinity;
    const t = TERRAIN[this.terrainAt(tx, ty)];
    const hover = !!u.def.hover;
    if (t.cost === 0 && !(hover && t.id === 'chasm')) return Infinity;
    const dh = this.heightAt(tx, ty) - this.heightAt(fx, fy);
    const jump = u.def.jump;
    if (dh > jump || dh < -(jump + 1)) return Infinity;
    if (hover) return 1;
    return t.cost + Math.max(0, dh) * CLIMB_COST;
  }

  /** 能不能停在這格（裂谷上不能停、不能跟別人疊在一起） */
  canStop(u: Unit, x: number, y: number): boolean {
    if (this.terrainAt(x, y) === 'chasm') return false;
    const o = this.unitAt(x, y);
    return !o || o === u;
  }

  /**
   * 移動範圍（Dijkstra）。可以穿過友軍，不能穿過敵軍和設施。
   * ignoreUnits：AI 找遠處目標的路時不管擋路的單位。
   */
  moveRange(u: Unit, budget: number = u.def.move, ignoreUnits = false): Map<number, Reach> {
    const out = new Map<number, Reach>();
    const start = this.key(u.x, u.y);
    out.set(start, { cost: 0, prev: -1 });
    if (u.def.structure) return out;
    const open: number[] = [start];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (out.get(open[i])!.cost < out.get(open[bi])!.cost) bi = i;
      const cur = open.splice(bi, 1)[0];
      const c = out.get(cur)!.cost;
      const cx = cur % this.w;
      const cy = Math.floor(cur / this.w);
      for (const [dx, dy] of DIR_VEC) {
        const nx = cx + dx;
        const ny = cy + dy;
        const step = this.stepCost(u, cx, cy, nx, ny);
        if (step === Infinity) continue;
        const nc = c + step;
        if (nc > budget) continue;
        if (!ignoreUnits) {
          const o = this.unitAt(nx, ny);
          if (o && o !== u && (o.side !== u.side || o.def.structure)) continue;
        }
        const nk = this.key(nx, ny);
        const old = out.get(nk);
        if (old && old.cost <= nc) continue;
        out.set(nk, { cost: nc, prev: cur });
        if (!open.includes(nk)) open.push(nk);
      }
    }
    return out;
  }

  /** 這回合可以停的格子（含原地） */
  reachable(u: Unit): Pos[] {
    const out: Pos[] = [];
    for (const k of this.moveRange(u).keys()) {
      const p = this.pos(k);
      if (this.canStop(u, p.x, p.y)) out.push(p);
    }
    return out;
  }

  /** 從移動範圍回推走到 (x,y) 的路徑（含起點） */
  pathTo(range: Map<number, Reach>, x: number, y: number): Pos[] {
    const path: Pos[] = [];
    let k = this.key(x, y);
    while (k !== -1) {
      const r = range.get(k);
      if (!r) return [];
      path.unshift(this.pos(k));
      k = r.prev;
    }
    return path;
  }

  // ───────── 火線與射程 ─────────

  /** 直射火線：中間的格子比兩端都高（艙壁算多 2 層）就被擋住 */
  lineClear(ax: number, ay: number, bx: number, by: number): boolean {
    const top = Math.max(this.heightAt(ax, ay), this.heightAt(bx, by));
    let x = ax;
    let y = ay;
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (x === bx && y === by) return true;
      if (!(x === ax && y === ay) && this.blockH(x, y) > top) return false;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** 武器從 from 打 (tx,ty) 的最大射程（佔高處時直射武器多 1 格） */
  maxRange(att: Unit, from: Pos, tx: number, ty: number, w: WeaponDef = att.def.weapon): number {
    if (w.kind === 'melee') return w.max;
    const higher = this.heightAt(from.x, from.y) > this.heightAt(tx, ty);
    let max = w.max;
    if (higher && w.kind === 'direct' && w.max >= 2) max += 1;
    if (higher && att.def.highGround) max += att.def.highGround.range;
    return max;
  }

  /** att 站在 from 能不能用武器打到 (tx,ty) */
  canHit(att: Unit, from: Pos, tx: number, ty: number, w: WeaponDef = att.def.weapon): boolean {
    const dist = manhattan(from.x, from.y, tx, ty);
    if (w.kind === 'melee') return dist === 1 && Math.abs(this.heightAt(from.x, from.y) - this.heightAt(tx, ty)) <= 1;
    if (dist < w.min || dist > this.maxRange(att, from, tx, ty, w)) return false;
    return w.kind === 'indirect' || this.lineClear(from.x, from.y, tx, ty);
  }

  /** 站在 from 用武器能打的敵方單位 */
  targets(att: Unit, from: Pos = att): Unit[] {
    return this.units.filter((t) => t.alive && t.side !== att.side && this.canHit(att, from, t.x, t.y));
  }

  /** 站在 from 用武器打得到的所有格子（顯示攻擊範圍用） */
  weaponTiles(att: Unit, from: Pos = att): Pos[] {
    const out: Pos[] = [];
    const r = att.def.weapon.max + 2;
    for (let y = Math.max(0, from.y - r); y <= Math.min(this.h - 1, from.y + r); y++) {
      for (let x = Math.max(0, from.x - r); x <= Math.min(this.w - 1, from.x + r); x++) {
        if (TERRAIN[this.terrainAt(x, y)].cost === 0) continue;
        if (this.canHit(att, from, x, y)) out.push({ x, y });
      }
    }
    return out;
  }

  // ───────── 傷害 ─────────

  /** 攻擊者相對於目標的方位：正面 / 側面 / 背面 */
  relation(tgt: Unit, tgtPos: Pos, from: Pos): 'front' | 'side' | 'back' {
    if (tgt.def.structure) return 'front';
    const dx = from.x - tgtPos.x;
    const dy = from.y - tgtPos.y;
    const [fx, fy] = DIR_VEC[tgt.dir];
    const dot = dx * fx + dy * fy;
    const cross = Math.abs(dx * fy - dy * fx);
    if (dot > 0 && cross <= dot) return 'front';
    if (dot < 0 && cross <= -dot) return 'back';
    return 'side';
  }

  /** 傷害加成取最大的一個；受傷減免可以疊加（上限 60%） */
  private auraNear(side: Side, self: Unit, at: Pos, kind: 'dmg' | 'guard'): number {
    let best = 0;
    let sum = 0;
    for (const a of this.units) {
      if (!a.alive || a === self || a.side !== side || !a.def.aura) continue;
      if (a.def.aura.only && a.def.aura.only !== self.def.id) continue;
      const v = a.def.aura[kind] ?? 0;
      if (!v || manhattan(a.x, a.y, at.x, at.y) > a.def.aura.range) continue;
      best = Math.max(best, v);
      sum += v;
    }
    return kind === 'guard' ? Math.min(0.6, sum) : best;
  }

  /** 一次攻擊的傷害與加成明細 */
  calc(att: Unit, attPos: Pos, tgt: Unit, tgtPos: Pos, kind: AttackKind, mul = 1, w: WeaponDef = att.def.weapon): { dmg: number; mods: Mod[] } {
    const mods: Mod[] = [];
    let pct = 0;
    const add = (k: Mod['kind'], v: number): void => {
      if (!v) return;
      pct += v;
      mods.push({ kind: k, value: v });
    };
    const dh = this.heightAt(attPos.x, attPos.y) - this.heightAt(tgtPos.x, tgtPos.y);
    if (w.kind !== 'indirect') {
      let hv = dh >= 2 ? 25 : dh === 1 ? 15 : dh === -1 ? -10 : dh <= -2 ? -20 : 0;
      if (dh > 0 && att.def.highGround) hv += Math.round(att.def.highGround.dmg * 100);
      add('height', hv);
    }
    const rel = this.relation(tgt, tgtPos, attPos);
    if (kind !== 'counter' && rel !== 'front') {
      const v = Math.round((rel === 'back' ? 30 : 15) * (att.def.flankMul ?? 1));
      pct += v;
      mods.push({ kind: 'flank', value: v, rear: rel === 'back' });
    }
    if (att.def.execute && tgt.hp / tgt.maxHp < att.def.execute.below) add('execute', Math.round(att.def.execute.dmg * 100));
    add('aura', Math.round(this.auraNear(att.side, att, attPos, 'dmg') * 100));
    if (att.def.swarm && this.units.some((o) => o.alive && o !== att && o.side === att.side && o.def.id === att.def.id && manhattan(o.x, o.y, tgtPos.x, tgtPos.y) === 1)) add('swarm', Math.round(att.def.swarm * 100));
    if (mul !== 1) mods.push({ kind: 'skill', value: Math.round((mul - 1) * 100) });
    let raw = w.dmg * att.power * mul * (1 + pct / 100);
    const react = kind === 'counter' ? (att.def.counterMul ?? COUNTER_MUL) : kind === 'overwatch' ? OVERWATCH_MUL : 1;
    if (react !== 1) {
      raw *= react;
      mods.push({ kind: 'reaction', value: Math.round((react - 1) * 100) });
    }
    const cover = TERRAIN[this.terrainAt(tgtPos.x, tgtPos.y)].cover;
    if (cover && w.kind === 'direct' && manhattan(attPos.x, attPos.y, tgtPos.x, tgtPos.y) >= 2 && !tgt.def.structure) {
      raw *= 1 - COVER_REDUCTION[cover];
      mods.push({ kind: 'cover', value: -Math.round(COVER_REDUCTION[cover] * 100) });
    }
    // 塔盾：正面來的攻擊減半（反擊時對方已經轉過來面對，也算正面）
    if (tgt.def.frontShield && (rel === 'front' || kind === 'counter')) {
      raw *= 1 - tgt.def.frontShield;
      mods.push({ kind: 'shield', value: -Math.round(tgt.def.frontShield * 100) });
    }
    const guard = this.auraNear(tgt.side, tgt, tgtPos, 'guard');
    if (guard) {
      raw *= 1 - guard;
      mods.push({ kind: 'guard', value: -Math.round(guard * 100) });
    }
    if (tgt.def.armor) mods.push({ kind: 'armor', value: -tgt.def.armor });
    return { dmg: Math.max(1, Math.round(raw) - tgt.def.armor), mods };
  }

  /** 對方打得到我、沒被癱瘓、不是設施才會反擊 */
  private canCounter(tgt: Unit, tgtPos: Pos, attPos: Pos): boolean {
    return !tgt.def.structure && tgt.stun === 0 && this.canHit(tgt, tgtPos, attPos.x, attPos.y);
  }

  /** 預估：站在 from 用武器（或傷害型技能）打 tgt 的結果 */
  forecast(att: Unit, tgt: Unit, from: Pos = att, skill?: SkillDef): Forecast {
    const mul = skill && (skill.effect.type === 'shot' || skill.effect.type === 'push' || skill.effect.type === 'line') ? skill.effect.mul : 1;
    const { dmg, mods } = this.calc(att, from, tgt, tgt, skill ? 'skill' : 'weapon', mul);
    const kills = dmg >= tgt.hp;
    let counter: Forecast['counter'] = null;
    if (!skill && !kills && this.canCounter(tgt, tgt, from)) {
      const c = this.calc(tgt, tgt, att, from, 'counter').dmg;
      counter = { dmg: c, kills: c >= att.hp };
    }
    return { dmg, mods, kills, counter };
  }

  private hurt(ev: BattleEvent[], att: Unit, tgt: Unit, dmg: number, mods: Mod[], kind: AttackKind, skill?: string): void {
    tgt.hp = Math.max(0, tgt.hp - dmg);
    const killed = tgt.hp === 0;
    ev.push({ t: 'attack', uid: att.uid, target: tgt.uid, at: { x: tgt.x, y: tgt.y }, kind, skill, dmg, mods, hp: tgt.hp, killed });
    if (killed) this.kill(ev, tgt);
  }

  private kill(ev: BattleEvent[], u: Unit): void {
    u.alive = false;
    u.hp = 0;
    u.overwatch = false;
    // 「沒有機體被擊破」只算有駕駛員的機體：艾可借來的機群是消耗品，不算
    if (u.side === 'player' && !u.def.structure && u.def.pilot) this.lost++;
    ev.push({ t: 'death', uid: u.uid });
  }

  private face(ev: BattleEvent[], u: Unit, tx: number, ty: number): void {
    if (u.def.structure) return;
    const d = dirTo(u.x, u.y, tx, ty);
    if (d !== u.dir) {
      u.dir = d;
      ev.push({ t: 'face', uid: u.uid, dir: d });
    }
  }

  private spend(u: Unit): void {
    u.acted = true;
    u.moved = true;
    u.undo = undefined;
  }

  // ───────── 動作 ─────────

  /** 能不能下指令給這個單位 */
  canAct(u: Unit): boolean {
    return !this.result && u.alive && u.side === this.phase && !u.acted && !u.def.structure && u.stun === 0;
  }

  move(u: Unit, x: number, y: number): BattleEvent[] {
    const ev: BattleEvent[] = [];
    if (!this.canAct(u) || u.moved) return ev;
    const range = this.moveRange(u);
    if (!range.has(this.key(x, y)) || !this.canStop(u, x, y)) return ev;
    const path = this.pathTo(range, x, y);
    if (path.length < 2) return ev;
    u.undo = { x: u.x, y: u.y, dir: u.dir };
    u.overwatch = false;
    let seg: Pos[] = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      u.dir = dirTo(u.x, u.y, p.x, p.y);
      u.x = p.x;
      u.y = p.y;
      seg.push(p);
      // 警戒射擊：走進對方警戒中單位的射程就會挨一槍（每個警戒單位一次）
      const watchers = this.units.filter((o) => o.alive && o.side !== u.side && o.overwatch && o.stun === 0 && this.canHit(o, o, u.x, u.y));
      if (!watchers.length) continue;
      ev.push({ t: 'move', uid: u.uid, path: seg });
      seg = [p];
      u.undo = undefined;
      for (const o of watchers) {
        o.overwatch = false;
        this.face(ev, o, u.x, u.y);
        const c = this.calc(o, o, u, u, 'overwatch');
        this.hurt(ev, o, u, c.dmg, c.mods, 'overwatch');
        if (!u.alive) break;
      }
      if (!u.alive) break;
    }
    if (seg.length > 1) ev.push({ t: 'move', uid: u.uid, path: seg });
    u.moved = true;
    this.checkEnd(ev);
    return ev;
  }

  undoMove(u: Unit): boolean {
    if (!u.undo || u.acted) return false;
    u.x = u.undo.x;
    u.y = u.undo.y;
    u.dir = u.undo.dir;
    u.moved = false;
    u.undo = undefined;
    return true;
  }

  attack(u: Unit, tgt: Unit): BattleEvent[] {
    const ev: BattleEvent[] = [];
    if (!this.canAct(u) || !tgt.alive || tgt.side === u.side || !this.canHit(u, u, tgt.x, tgt.y)) return ev;
    const w = u.def.weapon;
    this.face(ev, u, tgt.x, tgt.y);
    const at = { x: tgt.x, y: tgt.y };
    const c = this.calc(u, u, tgt, tgt, 'weapon');
    // 波及的傷害在出手當下就算好（跟貫穿一樣）：主目標倒下、連同它的光環消失，不會改變旁邊的人受到的傷害
    const splash = w.splash
      ? this.units.filter((o) => o.alive && o.side !== u.side && o !== tgt && manhattan(o.x, o.y, at.x, at.y) === 1).map((o) => ({ o, s: this.calc(u, u, o, o, 'splash', w.splash) }))
      : [];
    this.hurt(ev, u, tgt, c.dmg, c.mods, 'weapon');
    for (const { o, s } of splash) this.hurt(ev, u, o, s.dmg, [{ kind: 'splash', value: Math.round(((w.splash ?? 1) - 1) * 100) }], 'splash');
    if (tgt.alive) {
      this.face(ev, tgt, u.x, u.y);
      if (this.canCounter(tgt, tgt, u)) {
        const k = this.calc(tgt, tgt, u, u, 'counter');
        this.hurt(ev, tgt, u, k.dmg, k.mods, 'counter');
      }
    }
    this.spend(u);
    u.overwatch = false;
    this.checkEnd(ev);
    return ev;
  }

  skillReady(u: Unit, s: SkillDef): boolean {
    // 躍進取代移動：這回合已經走過就不能再跳
    if (s.effect.type === 'leap' && u.moved) return false;
    return (u.cds[s.id] ?? 0) === 0;
  }

  /** 技能可以選的目標格（方向型技能回傳四個相鄰格當作方向） */
  skillTargets(u: Unit, s: SkillDef, from: Pos = u): Pos[] {
    const out: Pos[] = [];
    if (s.target === 'tile') {
      for (let y = Math.max(0, from.y - s.max); y <= Math.min(this.h - 1, from.y + s.max); y++) {
        for (let x = Math.max(0, from.x - s.max); x <= Math.min(this.w - 1, from.x + s.max); x++) {
          const d = manhattan(from.x, from.y, x, y);
          if (d < s.min || d > s.max || TERRAIN[this.terrainAt(x, y)].cost === 0 || this.unitAt(x, y)) continue;
          out.push({ x, y });
        }
      }
      return out;
    }
    if (s.target === 'dir') {
      for (const [dx, dy] of DIR_VEC) if (this.inMap(from.x + dx, from.y + dy) && this.lineTiles(from, { x: from.x + dx, y: from.y + dy }, s).length) out.push({ x: from.x + dx, y: from.y + dy });
      return out;
    }
    for (const t of this.units) {
      if (!t.alive) continue;
      const d = manhattan(from.x, from.y, t.x, t.y);
      if (d < s.min || d > s.max) continue;
      if (s.target === 'ally') {
        if (t.side !== u.side || (s.effect.type === 'heal' && t.hp >= t.maxHp)) continue;
        // 督戰：只能指定已經行動過、還能動的友軍（不能是自己或設施）
        if (s.effect.type === 'rally' && (t === u || t.def.structure || !t.acted || t.stun > 0)) continue;
      } else {
        if (t.side === u.side) continue;
        if (s.effect.type === 'stun' && (t.def.boss || t.def.structure || t.stun > 0)) continue;
        if (s.effect.type !== 'stun' && !this.lineClear(from.x, from.y, t.x, t.y)) continue;
      }
      out.push({ x: t.x, y: t.y });
    }
    return out;
  }

  /** 貫穿型技能沿著方向打到的格子（碰到艙壁或高兩層以上的地形就停） */
  lineTiles(from: Pos, toward: Pos, s: SkillDef): Pos[] {
    if (s.effect.type !== 'line') return [];
    const dx = Math.sign(toward.x - from.x);
    const dy = Math.sign(toward.y - from.y);
    const out: Pos[] = [];
    const h0 = this.heightAt(from.x, from.y);
    for (let i = 1; i <= s.effect.len; i++) {
      const x = from.x + dx * i;
      const y = from.y + dy * i;
      if (!this.inMap(x, y) || this.blockH(x, y) >= h0 + 2) break;
      out.push({ x, y });
    }
    return out;
  }

  useSkill(u: Unit, skillId: string, at: Pos): BattleEvent[] {
    const ev: BattleEvent[] = [];
    const s = u.def.skills.find((k) => k.id === skillId);
    if (!s || !this.canAct(u) || !this.skillReady(u, s)) return ev;
    if (!this.skillTargets(u, s).some((p) => p.x === at.x && p.y === at.y)) return ev;
    this.face(ev, u, at.x, at.y);
    ev.push({ t: 'skill', uid: u.uid, skill: s.id, at });
    const e = s.effect;
    const tgt = this.unitAt(at.x, at.y);
    if (e.type === 'shot' && tgt) {
      const c = this.calc(u, u, tgt, tgt, 'skill', e.mul);
      this.hurt(ev, u, tgt, c.dmg, c.mods, 'skill', s.id);
      if (tgt.alive) this.face(ev, tgt, u.x, u.y);
    } else if (e.type === 'push' && tgt) {
      const c = this.calc(u, u, tgt, tgt, 'skill', e.mul);
      this.hurt(ev, u, tgt, c.dmg, c.mods, 'skill', s.id);
      if (tgt.alive) this.push(ev, u, tgt);
    } else if (e.type === 'line') {
      // 先把整條線的傷害算好再結算：前面的目標倒下（連同它的光環）不會改變後面的人受到的傷害，預估才會等於結果
      const hits = this.lineTiles(u, at, s)
        .map((p) => this.unitAt(p.x, p.y))
        .filter((o): o is Unit => !!o && o.side !== u.side)
        .map((o) => ({ o, c: this.calc(u, u, o, o, 'skill', e.mul) }));
      for (const { o, c } of hits) this.hurt(ev, u, o, c.dmg, c.mods, 'skill', s.id);
    } else if (e.type === 'heal' && tgt) {
      const amount = Math.min(e.amount, tgt.maxHp - tgt.hp);
      tgt.hp += amount;
      ev.push({ t: 'heal', uid: u.uid, target: tgt.uid, amount, hp: tgt.hp });
    } else if (e.type === 'stun' && tgt) {
      tgt.stun = e.turns;
      tgt.overwatch = false;
      ev.push({ t: 'stun', uid: u.uid, target: tgt.uid });
    } else if (e.type === 'rally' && tgt) {
      // 目標整個回合重來：警戒也解除，不然會出現「還能行動卻掛著警戒」的狀態
      tgt.acted = false;
      tgt.moved = false;
      tgt.undo = undefined;
      tgt.overwatch = false;
      ev.push({ t: 'rally', uid: u.uid, target: tgt.uid });
    } else if (e.type === 'leap') {
      const from = { x: u.x, y: u.y };
      u.x = at.x;
      u.y = at.y;
      ev.push({ t: 'leap', uid: u.uid, from, to: { x: at.x, y: at.y } });
      // 躍進取代這回合的移動，但還能攻擊或用其他技能
      u.cds[s.id] = s.cd + 1;
      u.moved = true;
      u.undo = undefined;
      u.overwatch = false;
      this.checkEnd(ev);
      return ev;
    }
    u.cds[s.id] = s.cd + 1;
    this.spend(u);
    u.overwatch = false;
    this.checkEnd(ev);
    return ev;
  }

  /** 把 tgt 從 u 的方向推開一格：撞牆、撞到別人受額外傷害；掉進裂谷直接摧毀 */
  private push(ev: BattleEvent[], u: Unit, tgt: Unit): void {
    if (tgt.def.boss || tgt.def.heavy || tgt.def.structure) return;
    const [dx, dy] = DIR_VEC[dirTo(u.x, u.y, tgt.x, tgt.y)];
    const nx = tgt.x + dx;
    const ny = tgt.y + dy;
    const from = { x: tgt.x, y: tgt.y };
    const other = this.inMap(nx, ny) ? this.unitAt(nx, ny) : undefined;
    // 艙壁、機組這類不能站的格子都算撞牆；裂谷另外處理（掉下去）
    const solid = this.inMap(nx, ny) && TERRAIN[this.terrainAt(nx, ny)].cost === 0 && this.terrainAt(nx, ny) !== 'chasm';
    const blocked = !this.inMap(nx, ny) || solid || !!other || this.heightAt(nx, ny) - this.heightAt(tgt.x, tgt.y) >= 2;
    if (blocked) {
      this.hurt(ev, u, tgt, COLLIDE_DMG, [{ kind: 'collide', value: COLLIDE_DMG }], 'collide');
      if (other?.alive) this.hurt(ev, u, other, BUMP_DMG, [{ kind: 'collide', value: BUMP_DMG }], 'collide');
      return;
    }
    if (this.terrainAt(nx, ny) === 'chasm' && !tgt.def.hover) {
      tgt.x = nx;
      tgt.y = ny;
      ev.push({ t: 'push', target: tgt.uid, from, to: { x: nx, y: ny }, fell: true });
      this.kill(ev, tgt);
      return;
    }
    const drop = this.heightAt(tgt.x, tgt.y) - this.heightAt(nx, ny);
    tgt.x = nx;
    tgt.y = ny;
    ev.push({ t: 'push', target: tgt.uid, from, to: { x: nx, y: ny }, fell: false });
    if (drop >= 2) this.hurt(ev, u, tgt, FALL_DMG * drop, [{ kind: 'collide', value: FALL_DMG * drop }], 'collide');
  }

  /** 警戒：這回合不攻擊，敵人走進射程時自動射擊一次 */
  canOverwatch(u: Unit): boolean {
    return this.canAct(u) && u.def.weapon.kind !== 'indirect';
  }

  setOverwatch(u: Unit): BattleEvent[] {
    if (!this.canOverwatch(u)) return [];
    this.spend(u);
    u.overwatch = true;
    return [{ t: 'overwatch', uid: u.uid }];
  }

  wait(u: Unit): BattleEvent[] {
    if (!this.canAct(u)) return [];
    this.spend(u);
    return [{ t: 'wait', uid: u.uid }];
  }

  // ───────── 回合 ─────────

  /** 開戰：第 1 回合的事件（增援、對話） */
  start(): BattleEvent[] {
    const ev: BattleEvent[] = [{ t: 'phase', side: 'player', turn: 1 }];
    this.fireEvents(ev);
    return ev;
  }

  private beginPhase(side: Side): void {
    this.phase = side;
    for (const u of this.units) {
      if (!u.alive || u.side !== side) continue;
      u.moved = false;
      u.acted = false;
      u.undo = undefined;
      u.overwatch = false;
      for (const k of Object.keys(u.cds)) if (u.cds[k] > 0) u.cds[k]--;
    }
  }

  /** 階段結束：被癱瘓的單位這一輪沒辦法行動，癱瘓時間 -1 */
  private endPhase(side: Side): void {
    for (const u of this.units) if (u.alive && u.side === side && u.stun > 0) u.stun--;
  }

  endPlayerPhase(): BattleEvent[] {
    if (this.result || this.phase !== 'player') return [];
    this.endPhase('player');
    this.beginPhase('enemy');
    // 離我方近的先動，後面的才不會被自己人擋住
    const near = (u: Unit): number => Math.min(...this.alive('player').map((p) => manhattan(u.x, u.y, p.x, p.y)), 99);
    this.queue = this.alive('enemy')
      .filter((u) => !u.def.structure)
      .sort((a, b) => near(a) - near(b))
      .map((u) => u.uid);
    return [{ t: 'phase', side: 'enemy', turn: this.turn }];
  }

  /** 敵方下一個單位行動；全部動完回傳 null（接著呼叫 beginPlayerPhase） */
  stepEnemy(ai: AiFn): BattleEvent[] | null {
    while (this.queue.length && !this.result) {
      const u = this.unit(this.queue.shift()!);
      if (!u.alive) continue;
      if (u.stun > 0) return [{ t: 'wait', uid: u.uid }];
      return ai(this, u);
    }
    return null;
  }

  beginPlayerPhase(): BattleEvent[] {
    const ev: BattleEvent[] = [];
    if (this.result) return ev;
    this.endPhase('enemy');
    const win = this.mission.win;
    if (win.type === 'survive' && this.turn >= win.turns) {
      this.finish(ev, 'win', 'survive');
      return ev;
    }
    if (win.type === 'hold') {
      // 撐過一個敵方回合還站在區域裡就算一回合；離開（或被推出去）就重算
      const was = this.held;
      this.held = this.holding() ? this.held + 1 : 0;
      if (this.held !== was) ev.push({ t: 'hold', n: this.held, of: win.turns });
      if (this.held >= win.turns) {
        this.finish(ev, 'win', 'hold');
        return ev;
      }
    }
    this.turn++;
    this.beginPhase('player');
    ev.push({ t: 'phase', side: 'player', turn: this.turn });
    this.fireEvents(ev);
    this.checkEnd(ev);
    return ev;
  }

  private fireEvents(ev: BattleEvent[]): void {
    (this.mission.events ?? []).forEach((e, i) => {
      if (e.turn !== this.turn || this.fired.has(i)) return;
      this.fired.add(i);
      for (const s of e.spawn ?? []) {
        // 出生點被佔住就找旁邊最近的空格
        const spot = this.freeNear(s.x, s.y);
        if (!spot) continue;
        const u = this.spawn({ ...s, ...spot });
        ev.push({ t: 'spawn', uid: u.uid });
      }
      if (e.say) ev.push({ t: 'say', id: e.say });
    });
  }

  private freeNear(x: number, y: number): Pos | null {
    for (let r = 0; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (this.inMap(nx, ny) && TERRAIN[this.terrainAt(nx, ny)].cost > 0 && !this.unitAt(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /** 「守住區域」關卡：指定的機體現在是不是站在區域裡 */
  holding(): boolean {
    const win = this.mission.win;
    if (win.type !== 'hold') return false;
    return this.alive('player').some((u) => u.def.id === win.who && win.zone.some((p) => p.x === u.x && p.y === u.y));
  }

  /** 之後還有沒有敵方增援（全滅條件要等增援都出完） */
  private enemySpawnsPending(): boolean {
    return (this.mission.events ?? []).some((e, i) => !this.fired.has(i) && (e.spawn ?? []).some((s) => (s.side ?? 'enemy') === 'enemy'));
  }

  private finish(ev: BattleEvent[], result: 'win' | 'lose', reason: string): void {
    if (this.result) return;
    this.result = result;
    ev.push({ t: 'end', result, reason });
  }

  private checkEnd(ev: BattleEvent[]): void {
    if (this.result) return;
    const leader = this.units.find((u) => u.side === 'player' && u.def.id === 'kai');
    if (leader && !leader.alive) return this.finish(ev, 'lose', 'leader');
    const down = (this.mission.protect ?? []).filter((tag) => this.byTag(tag) && !this.byTag(tag)!.alive).length;
    if (down >= (this.mission.protectLose ?? 1)) return this.finish(ev, 'lose', 'protect');
    if (!this.alive('player').some((u) => !u.def.structure)) return this.finish(ev, 'lose', 'wiped');
    const win = this.mission.win;
    // 目標要由指定機體完成（護送 / 守住）：那台沒了就不可能過關，直接判定失敗，不靠關卡資料記得把它列進保護目標
    if ((win.type === 'reach' || win.type === 'hold') && win.who && !this.alive('player').some((u) => u.def.id === win.who)) return this.finish(ev, 'lose', 'protect');
    if (win.type === 'rout') {
      if (!this.alive('enemy').length && !this.enemySpawnsPending()) this.finish(ev, 'win', 'rout');
    } else if (win.type === 'kill') {
      const t = this.byTag(win.tag);
      if (t && !t.alive) this.finish(ev, 'win', 'kill');
    } else if (win.type === 'killAll') {
      if (this.killed() >= win.tags.length) this.finish(ev, 'win', 'kill');
    } else if (win.type === 'reach') {
      const ok = this.alive('player').some((u) => !u.def.structure && (!win.who || u.def.id === win.who) && win.zone.some((p) => p.x === u.x && p.y === u.y));
      if (ok) this.finish(ev, 'win', 'reach');
    }
  }

  /** 「全部摧毀」的目標已經摧毀了幾個（介面顯示進度用；其他目標回傳 0） */
  killed(): number {
    const win = this.mission.win;
    if (win.type !== 'killAll') return 0;
    return win.tags.filter((tag) => this.byTag(tag) && !this.byTag(tag)!.alive).length;
  }

  /** 第三顆星的條件：一般關卡是在標準回合數內過關；防守關是保護目標剩一半以上耐久 */
  thirdStar(): boolean {
    if (this.mission.win.type === 'survive') return (this.mission.protect ?? []).every((t) => (this.byTag(t)?.hp ?? 0) * 2 >= (this.byTag(t)?.maxHp ?? 1));
    return this.turn <= this.mission.par;
  }

  /** 過關星數：過關 1 顆、沒有機體被摧毀 +1、第三顆看 thirdStar */
  stars(): number {
    if (this.result !== 'win') return 0;
    return 1 + (this.lost === 0 ? 1 : 0) + (this.thirdStar() ? 1 : 0);
  }

  /** 這個單位下回合打得到的所有格子（顯示敵方威脅範圍） */
  threat(u: Unit): Set<number> {
    const out = new Set<number>();
    if (!u.alive || u.def.structure) return out;
    for (const p of this.reachable(u)) for (const t of this.weaponTiles(u, p)) out.add(this.key(t.x, t.y));
    return out;
  }

  // ───────── 戰鬥中存檔 ─────────

  /** 任務內容的指紋（地圖、開場單位、事件、勝利條件）：這些改過的話，舊的存檔接下去會對不上 */
  static signature(m: MissionDef): string {
    const s = JSON.stringify([m.tiles, m.heights, m.units, m.events ?? [], m.win, m.protect ?? []]);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /**
   * 把現在的狀態存下來。只在我方回合、戰鬥還沒結束時有東西可存（敵方行動到一半不存：
   * 規則沒有亂數，從我方回合開頭接下去，結果跟沒中斷過一樣）。
   */
  snapshot(): BattleSnap | null {
    if (this.result || this.phase !== 'player') return null;
    return {
      v: 1,
      mission: this.mission.id,
      sig: Battle.signature(this.mission),
      easy: this.easy,
      ...(this.hard ? { hard: true } : {}),
      turn: this.turn,
      lost: this.lost,
      held: this.held,
      nextUid: this.nextUid,
      fired: [...this.fired],
      units: this.units.map((u) => ({ ...u, def: u.def.id, cds: { ...u.cds }, undo: u.undo ? { ...u.undo } : undefined })),
    };
  }

  /**
   * 從存檔還原一場戰鬥。資料對不上就回傳 null（任務改過、機型不存在、內容壞掉或被亂改），
   * 呼叫的人應該把那份存檔丟掉、從頭開始這一關。
   */
  static restore(mission: MissionDef, defs: Record<string, UnitDef>, raw: unknown): Battle | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Partial<BattleSnap>;
    if (s.v !== 1 || s.mission !== mission.id || s.sig !== Battle.signature(mission)) return null;
    const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
    if (!int(s.turn, 1, 9999) || !int(s.lost, 0, 999) || !int(s.held, 0, 999) || !int(s.nextUid, 1, 99999)) return null;
    if (!Array.isArray(s.fired) || !Array.isArray(s.units) || !s.units.length) return null;
    const b = new Battle(mission, defs, !!s.easy, s.hard === true);
    const units: Unit[] = [];
    const seen = new Set<number>();
    for (const r of s.units as Partial<UnitSnap>[]) {
      if (!r || typeof r !== 'object') return null;
      const def = typeof r.def === 'string' ? defs[r.def] : undefined;
      if (!def) return null;
      if (!int(r.uid, 1, s.nextUid - 1) || seen.has(r.uid)) return null;
      seen.add(r.uid);
      if (!int(r.x, 0, b.w - 1) || !int(r.y, 0, b.h - 1) || !int(r.dir, 0, 3)) return null;
      if (r.side !== 'player' && r.side !== 'enemy') return null;
      if (typeof r.hp !== 'number' || typeof r.maxHp !== 'number' || !(r.maxHp > 0) || !(r.hp <= r.maxHp)) return null;
      if (typeof r.power !== 'number' || !(r.power > 0) || !int(r.stun, 0, 99)) return null;
      const cds: Record<string, number> = {};
      for (const [k, v] of Object.entries(r.cds ?? {})) if (def.skills.some((sk) => sk.id === k) && int(v, 0, 99)) cds[k] = v;
      const un = r.undo;
      units.push({
        uid: r.uid,
        def,
        side: r.side,
        x: r.x,
        y: r.y,
        dir: r.dir as Dir,
        hp: r.hp,
        maxHp: r.maxHp,
        power: r.power,
        moved: !!r.moved,
        acted: !!r.acted,
        cds,
        stun: r.stun,
        overwatch: !!r.overwatch,
        alive: !!r.alive && r.hp > 0,
        ai: r.ai === 'guard' || r.ai === 'hold' ? r.ai : 'aggressive',
        tag: typeof r.tag === 'string' ? r.tag : undefined,
        prey: typeof r.prey === 'string' ? r.prey : undefined,
        undo: un && int(un.x, 0, b.w - 1) && int(un.y, 0, b.h - 1) && int(un.dir, 0, 3) ? { x: un.x, y: un.y, dir: un.dir as Dir } : undefined,
      });
    }
    // 活著的單位不能疊在同一格、也不能站在裂谷或艙壁裡
    const taken = new Set<number>();
    for (const u of units) {
      if (!u.alive) continue;
      const k = b.key(u.x, u.y);
      const t = b.terrainAt(u.x, u.y);
      if (taken.has(k) || t === 'chasm' || t === 'wall') return null;
      taken.add(k);
    }
    b.units = units;
    b.turn = s.turn;
    b.lost = s.lost;
    b.held = s.held;
    b.nextUid = s.nextUid;
    b.fired = new Set(s.fired.filter((i) => int(i, 0, (mission.events ?? []).length - 1)));
    b.phase = 'player';
    b.queue = [];
    b.result = null;
    return b;
  }
}
