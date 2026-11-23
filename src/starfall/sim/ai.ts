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
    // 離得遠、還沒被驚動的守備單位只算它原地的射程；靠近到快要驚動它的距離就當作它會動
    const mobile = e.ai === 'aggressive' || (e.ai === 'guard' && dist(e, u) <= AGGRO_RANGE + u.def.move);
    const tiles = mobile ? b.threat(e) : new Set(b.weaponTiles(e).map((t) => b.key(t.x, t.y)));
    for (const k of tiles) out.set(k, (out.get(k) ?? 0) + e.def.weapon.dmg);
  }
  return out;
}

/** 走到這格會挨多少警戒射擊（只看終點：路上的算不準） */
function watchDmg(b: Battle, u: Unit, p: Pos, enemies: Unit[]): number {
  if (p.x === u.x && p.y === u.y) return 0;
  let sum = 0;
  for (const e of enemies) if (e.overwatch && e.stun === 0 && b.canHit(e, e, p.x, p.y)) sum += Math.round(e.def.weapon.dmg * 0.8);
  return sum;
}

/** 站在這格的好處：掩體、高度；曲射單位不想被貼身 */
function tileScore(b: Battle, u: Unit, p: Pos, enemies: Unit[], danger: Map<number, number>): number {
  let s = TERRAIN[b.terrainAt(p.x, p.y)].cover * 4;
  const d = danger.get(b.key(p.x, p.y)) ?? 0;
  // 越脆的機體越怕被圍；估計值沒算側擊、獵殺等加成，所以抓 1.25 倍當作「可能被打掉」
  // 隊長和任務要保護的機體被打掉就輸了，更小心
  if (d) {
    const vital = u.def.id === 'kai' || (!!u.tag && (b.mission.protect ?? []).includes(u.tag));
    s -= ((d * 40) / u.maxHp + (d * 1.25 >= u.hp ? 80 : 0)) * (vital ? 1.5 : 1);
  }
  if (u.def.weapon.kind !== 'melee') s += b.heightAt(p.x, p.y) * 2;
  if (u.def.weapon.min >= 2) for (const e of enemies) if (!e.def.structure && dist(e, p) < u.def.weapon.min) s -= 12;
  return s;
}

function targetBonus(b: Battle, u: Unit, t: Unit): number {
  let s = 0;
  // 我方機器人：正在拆保護目標的敵人優先處理（玩家看任務目標也會這樣打）
  if (u.side === 'player' && t.prey && (b.mission.protect ?? []).includes(t.prey)) s += 25;
  if (u.prey && t.tag === u.prey) s += 10;
  // 設施不會還手也不會跑：只有被指定要拆它的單位才會打，其他人去對付會動的
  else if (t.def.structure) s -= 1000;
  if (t.def.id === 'kai') s += 3;
  const win = b.mission.win;
  if (u.side === 'enemy' && (win.type === 'hold' || win.type === 'reach') && win.who === t.def.id) s += 8;
  return s;
}

function options(b: Battle, u: Unit, reach: Pos[], enemies: Unit[], danger: Map<number, number>): Option[] {
  const out: Option[] = [];
  for (const p of reach) {
    const base = tileScore(b, u, p, enemies, danger);
    for (const t of b.targets(u, p)) {
      if (u.side === 'enemy' && t.def.structure && t.tag !== u.prey) continue;
      const f = b.forecast(u, t, p);
      let score = f.dmg + (f.kills ? 30 : 0) + targetBonus(b, u, t) + base;
      if (f.counter) score -= f.counter.dmg * 0.5 + (f.counter.kills ? 60 : 0);
      // 我方機器人：打不死對方、反擊又比自己打的還痛，這種交換不划算（支援機尤其如此）
      if (u.side === 'player' && f.counter && !f.kills && f.counter.dmg >= f.dmg) score -= 14;
      // 走過去會先挨警戒射擊、打完再挨反擊：扣掉這些之後撐不撐得過敵方回合
      if (u.side === 'player') {
        const left = u.hp - (f.counter?.dmg ?? 0) - watchDmg(b, u, p, enemies);
        const d = danger.get(b.key(p.x, p.y)) ?? 0;
        if (left <= 0 || (d * 1.25 >= left && d * 1.25 < u.hp)) score -= 90;
      }
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
        } else if (!t || e.type === 'rally') {
          continue;
        } else if (e.type === 'shot') {
          const f = b.forecast(u, t, p, s);
          // 沒有反擊風險、傷害又高：值得用，但別浪費在一槍就能解決的目標上
          score += f.dmg + (f.kills ? 30 : 0) + targetBonus(b, u, t) + 4;
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

/** 撤退：挑最不會挨打、又離隊友近的格子 */
function regroup(b: Battle, u: Unit, reach: Pos[], danger: Map<number, number>, enemies: Unit[]): Pos {
  const allies = b.units.filter((a) => a.alive && a.side === u.side && a !== u && !a.def.structure);
  let best: Pos = { x: u.x, y: u.y };
  let top = -Infinity;
  for (const p of reach) {
    const d = danger.get(b.key(p.x, p.y)) ?? 0;
    const near = allies.length ? Math.min(...allies.map((a) => dist(a, p))) : 0;
    const watch = watchDmg(b, u, p, enemies);
    const score = -(d * 40) / u.maxHp - (d * 1.25 >= u.hp - watch ? 80 : 0) - watch * 2 - near + TERRAIN[b.terrainAt(p.x, p.y)].cover * 3;
    if (score > top) {
      top = score;
      best = p;
    }
  }
  return best;
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
      if (u.side === 'enemy' && t.def.structure && t.tag !== u.prey) continue;
      if (!b.canHit(u, p, t.x, t.y)) continue;
      // 偏好的目標當作近 4 步；我方機器人優先靠近正在拆保護目標的敵人
      const c = r.cost - (u.prey && t.tag === u.prey ? 4 : 0) - (u.side === 'player' && t.prey && (b.mission.protect ?? []).includes(t.prey) ? 6 : 0);
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
    const d = danger.get(k) ?? 0;
    const watch = u.side === 'player' ? watchDmg(b, u, path[i], enemies) : 0;
    const score = i * 3 - (d * 40) / u.maxHp - (d * 1.25 >= u.hp - watch ? 80 : 0) - watch * 2;
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
  let reach = u.ai === 'hold' ? [{ x: u.x, y: u.y }] : b.reachable(u);
  const danger = dangerMap(b, u, enemies);
  // 我方機器人：任務要某台機體走到（或守住）一個區域時，那台機體以區域為目標，到了就不離開
  const win = b.mission.win;
  if (u.side === 'player' && (win.type === 'hold' || win.type === 'reach') && win.who === u.def.id) {
    const onZone = (p: Pos): boolean => win.zone.some((z) => z.x === p.x && z.y === p.y);
    if (!onZone(u)) {
      const far = b.moveRange(u, Infinity, true);
      const goal = win.zone.filter((z) => far.has(b.key(z.x, z.y))).sort((a, c) => far.get(b.key(a.x, a.y))!.cost - far.get(b.key(c.x, c.y))!.cost)[0];
      if (goal) {
        const path = b.pathTo(far, goal.x, goal.y);
        const ok = new Set(reach.map((p) => b.key(p.x, p.y)));
        // 沿路往區域走，但不要跑在隊友前面（旁邊 3 格內至少要有兩台隊友）、也不要停在會被打掉的地方；
        // 只有一步就能安全站上區域時才不管隊友
        const allies = b.units.filter((a) => a.alive && a.side === u.side && a !== u && !a.def.structure);
        let to: Pos | null = null;
        for (let i = 1; i < path.length; i++) {
          const k = b.key(path[i].x, path[i].y);
          if (!ok.has(k)) continue;
          const d = danger.get(k) ?? 0;
          const safe = d * 1.4 < u.hp - watchDmg(b, u, path[i], enemies);
          const escorted = allies.filter((a) => dist(a, path[i]) <= 3).length >= Math.min(2, allies.length);
          // 完全沒有威脅的格子不用等隊友（敵人清光之後才走得到終點）
          if (safe && (escorted || d === 0 || onZone(path[i]))) to = path[i];
        }
        // 前面沒有安全的落腳處、現在站的地方又會被集火：先退回隊友身邊
        if (!to && (danger.get(b.key(u.x, u.y)) ?? 0) * 1.4 >= u.hp) to = regroup(b, u, reach, danger, enemies);
        if (to) ev.push(...b.move(u, to.x, to.y));
        if (!u.alive || b.result) return ev;
      }
    }
    reach = [{ x: u.x, y: u.y }];
  }
  const opts = options(b, u, reach, enemies, danger);
  // 分數一樣時少走幾步（不要無謂地繞路）
  opts.sort((a, c) => c.score - a.score || dist(a.at, u) - dist(c.at, u));
  // 我方機器人：每個出手的位置都太危險（分數是負的）就不硬打 ——
  // 現在站的地方會挨打就退到安全的地方跟隊友會合，不然就照「前進」的邏輯小心靠近
  const risky = u.side === 'player' && u.ai !== 'hold' && opts.length > 0 && opts[0].score < 0;
  if (risky && (danger.get(b.key(u.x, u.y)) ?? 0) > 0) {
    const to = regroup(b, u, reach, danger, enemies);
    if (to.x !== u.x || to.y !== u.y) ev.push(...b.move(u, to.x, to.y));
    return u.alive && !b.result ? ev.concat(finish(b, u)) : ev;
  }
  if (opts.length && !risky) {
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
  const t = b.targets(u, u).find((x) => !(u.side === 'enemy' && x.def.structure && x.tag !== u.prey));
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
