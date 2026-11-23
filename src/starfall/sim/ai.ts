// 敵方 AI（也拿來當自動對戰的「玩家機器人」，檢查關卡打不打得過）。
// 每個單位：列出這回合走得到的每一格 × 在那格能做的每個動作，挑分數最高的。
import { TERRAIN } from './terrain';
import { DIR_VEC } from './types';
import type { Battle } from './Battle';
import type { BattleEvent, Pos, SkillDef, Unit } from './types';

/** 守備型單位在敵人靠近到這個距離以內、或被打到之後才會開始行動 */
export const AGGRO_RANGE = 6;

interface Option {
  score: number;
  at: Pos;
  act: 'attack' | 'skill';
  target: Pos;
  skill?: SkillDef;
}

const dist = (a: Pos, b: Pos): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function foes(b: Battle, u: Unit): Unit[] {
  return b.units.filter((t) => t.alive && t.side !== u.side);
}

/**
 * 每一格下回合可能挨多少打：會動的敵人「走得到又打得到」的格子，加上它的武器傷害。
 * 只有我方機器人會看這個（模擬玩家不會讓一台機體單獨衝進敵陣）；機群不怕死。
 */
function dangerMap(b: Battle, u: Unit, enemies: Unit[]): Map<number, number> {
  const out = new Map<number, number>();
  if (u.side !== 'player') return out;
  for (const e of enemies) {
    if (e.def.structure || e.stun > 0) continue;
    // 還沒被驚動的守備單位只算它原地的射程
    const tiles = e.ai === 'aggressive' ? b.threat(e) : new Set(b.weaponTiles(e).map((t) => b.key(t.x, t.y)));
    for (const k of tiles) out.set(k, (out.get(k) ?? 0) + e.def.weapon.dmg);
  }
  return out;
}

/** 站在這格的好處：掩體、高度；曲射單位不想被貼身 */
function tileScore(b: Battle, u: Unit, p: Pos, enemies: Unit[], danger: Map<number, number>): number {
  let s = TERRAIN[b.terrainAt(p.x, p.y)].cover * 4;
  const d = danger.get(b.key(p.x, p.y)) ?? 0;
  // 越脆的機體越怕被圍（支援機 60 血：權重約 0.5；重裝 140 血：約 0.2）
  if (d) s -= (d * 30) / u.maxHp + (d >= u.hp ? 40 : 0);
  if (u.def.weapon.kind !== 'melee') s += b.heightAt(p.x, p.y) * 2;
  if (u.def.weapon.min >= 2) for (const e of enemies) if (!e.def.structure && dist(e, p) < u.def.weapon.min) s -= 12;
  return s;
}

function targetBonus(u: Unit, t: Unit): number {
  let s = 0;
  if (u.prey && t.tag === u.prey) s += 10;
  if (t.def.id === 'kai') s += 3;
  return s;
}

function options(b: Battle, u: Unit, reach: Pos[], enemies: Unit[], danger: Map<number, number>): Option[] {
  const out: Option[] = [];
  for (const p of reach) {
    const base = tileScore(b, u, p, enemies, danger);
    for (const t of b.targets(u, p)) {
      const f = b.forecast(u, t, p);
      let score = f.dmg + (f.kills ? 30 : 0) + targetBonus(u, t) + base;
      if (f.counter) score -= f.counter.dmg * 0.5 + (f.counter.kills ? 60 : 0);
      // 我方機器人：打不死對方、反擊又比自己打的還痛，這種交換不划算（支援機尤其如此）
      if (u.side === 'player' && f.counter && !f.kills && f.counter.dmg >= f.dmg) score -= 14;
      if (u.def.weapon.splash) for (const o of enemies) if (o !== t && dist(o, t) === 1) score += u.def.weapon.dmg * u.def.weapon.splash * 0.8;
      out.push({ score, at: p, act: 'attack', target: { x: t.x, y: t.y } });
    }
    for (const s of u.def.skills) {
      if (!b.skillReady(u, s)) continue;
      const e = s.effect;
      for (const tp of b.skillTargets(u, s, p)) {
        let score = base;
        const t = b.unitAt(tp.x, tp.y);
        if (e.type === 'line') {
          let n = 0;
          for (const lp of b.lineTiles(p, tp, s)) {
            const o = b.unitAt(lp.x, lp.y);
            if (!o || o.side === u.side) continue;
            const f = b.forecast(u, o, p, s);
            score += f.dmg + (f.kills ? 30 : 0);
            n++;
          }
          // 只打到一個人不如留著：普通攻擊就夠了
          if (n < 2) continue;
        } else if (!t) {
          continue;
        } else if (e.type === 'shot') {
          const f = b.forecast(u, t, p, s);
          // 沒有反擊風險、傷害又高：值得用，但別浪費在一槍就能解決的目標上
          score += f.dmg + (f.kills ? 30 : 0) + targetBonus(u, t) + 4;
          if (b.canHit(u, p, t.x, t.y) && b.forecast(u, t, p).kills) score -= 20;
        } else if (e.type === 'push') {
          const f = b.forecast(u, t, p, s);
          score += f.dmg + (f.kills ? 30 : 0) + 4;
          const [dx, dy] = DIR_VEC[Math.abs(t.x - p.x) >= Math.abs(t.y - p.y) ? (t.x >= p.x ? 0 : 2) : t.y >= p.y ? 1 : 3];
          const nx = t.x + dx;
          const ny = t.y + dy;
          if (!t.def.boss && b.inMap(nx, ny) && b.terrainAt(nx, ny) === 'chasm' && !t.def.hover) score += 50;
        } else if (e.type === 'heal') {
          const healed = Math.min(e.amount, t.maxHp - t.hp);
          if (healed < 20) continue;
          score += healed * 0.8 + (t.hp / t.maxHp < 0.4 ? 20 : 0);
        } else if (e.type === 'stun') {
          // 癱瘓還沒動、火力高的敵人最划算
          score += t.def.weapon.dmg * 0.9 + (t.def.weapon.kind === 'indirect' ? 6 : 0);
        }
        out.push({ score, at: p, act: 'skill', target: tp, skill: s });
      }
    }
  }
  return out;
}

/** 這回合打不到任何人：往最近能開火的位置前進 */
function advance(b: Battle, u: Unit, reach: Pos[], enemies: Unit[], danger: Map<number, number>): Pos | null {
  const far = b.moveRange(u, Infinity, true);
  let goal = -1;
  let best = Infinity;
  for (const [k, r] of far) {
    const p = b.pos(k);
    if (b.terrainAt(p.x, p.y) === 'chasm') continue;
    for (const t of enemies) {
      if (!b.canHit(u, p, t.x, t.y)) continue;
      // 偏好的目標當作近 4 步
      const c = r.cost - (u.prey && t.tag === u.prey ? 4 : 0);
      if (c < best) {
        best = c;
        goal = k;
      }
    }
  }
  if (goal === -1) return null;
  const g = b.pos(goal);
  const path = b.pathTo(far, g.x, g.y);
  const ok = new Set(reach.map((p) => b.key(p.x, p.y)));
  // 沿著路徑能走多遠就走多遠；我方機器人會在「再往前就要單獨挨打」的地方停下來等隊友
  let pick: Pos | null = null;
  let top = -Infinity;
  for (let i = 1; i < path.length; i++) {
    const k = b.key(path[i].x, path[i].y);
    if (!ok.has(k)) continue;
    const score = i * 3 - ((danger.get(k) ?? 0) * 30) / u.maxHp;
    if (score >= top) {
      top = score;
      pick = path[i];
    }
  }
  return pick;
}

export function aiTakeTurn(b: Battle, u: Unit): BattleEvent[] {
  const ev: BattleEvent[] = [];
  if (!b.canAct(u)) return ev;
  const enemies = foes(b, u);
  if (u.ai === 'guard') {
    const near = enemies.some((e) => !e.def.structure && dist(e, u) <= AGGRO_RANGE);
    if (near || u.hp < u.maxHp) u.ai = 'aggressive';
    else return b.canOverwatch(u) ? b.setOverwatch(u) : b.wait(u);
  }
  const reach = u.ai === 'hold' ? [{ x: u.x, y: u.y }] : b.reachable(u);
  const danger = dangerMap(b, u, enemies);
  const opts = options(b, u, reach, enemies, danger);
  if (opts.length) {
    // 分數一樣時少走幾步（不要無謂地繞路）
    opts.sort((a, c) => c.score - a.score || dist(a.at, u) - dist(c.at, u));
    const o = opts[0];
    if (o.at.x !== u.x || o.at.y !== u.y) ev.push(...b.move(u, o.at.x, o.at.y));
    if (!u.alive || b.result) return ev;
    // 路上被警戒射擊打斷沒走到：改成原地重新評估
    if (u.x !== o.at.x || u.y !== o.at.y) return ev.concat(finish(b, u));
    const t = b.unitAt(o.target.x, o.target.y);
    if (o.act === 'attack' && t) ev.push(...b.attack(u, t));
    else if (o.skill) ev.push(...b.useSkill(u, o.skill.id, o.target));
    if (b.canAct(u)) ev.push(...finish(b, u));
    return ev;
  }
  if (u.ai !== 'hold') {
    const to = advance(b, u, reach, enemies, danger);
    if (to && (to.x !== u.x || to.y !== u.y)) ev.push(...b.move(u, to.x, to.y));
    if (!u.alive || b.result) return ev;
  }
  return ev.concat(finish(b, u));
}

/** 沒事可做：敵人夠近就警戒，不然待機 */
function finish(b: Battle, u: Unit): BattleEvent[] {
  if (!b.canAct(u)) return [];
  const t = b.targets(u, u)[0];
  if (t) return b.attack(u, t);
  const close = foes(b, u).some((e) => !e.def.structure && dist(e, u) <= u.def.weapon.max + 4);
  return close && b.canOverwatch(u) ? b.setOverwatch(u) : b.wait(u);
}

/** 自動打完整場（測試與平衡用）：雙方都交給 AI。回傳結果與回合數 */
export function autoPlay(b: Battle, maxTurns = 40, log: (ev: BattleEvent[]) => void = () => undefined): { result: 'win' | 'lose' | 'timeout'; turns: number; lost: number; stars: number } {
  log(b.start());
  while (!b.result && b.turn <= maxTurns) {
    // 我方：支援機最後動（先看誰受傷），其他照原本的順序
    const order = b
      .alive('player')
      .filter((u) => !u.def.structure)
      .sort((a, c) => Number(a.def.id === 'echo') - Number(c.def.id === 'echo'));
    for (const u of order) {
      if (b.result) break;
      if (u.alive) log(aiTakeTurn(b, u));
    }
    if (b.result) break;
    log(b.endPlayerPhase());
    for (let ev = b.stepEnemy(aiTakeTurn); ev !== null; ev = b.stepEnemy(aiTakeTurn)) log(ev);
    log(b.beginPlayerPhase());
  }
  return { result: b.result ?? 'timeout', turns: b.turn, lost: b.lost, stars: b.stars() };
}
