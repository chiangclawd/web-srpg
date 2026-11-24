// 圖鑑和成就的規則（純函式，不碰瀏覽器，tests/starfall/records.test.ts 直接測）。
//
// 存在哪裡：存檔裡「看過的教學」那份清單（tips）。遇過的機體記成 seen_<機型>，達成的成就記成 ach_<編號>。
// 用既有的清單是因為它本來就會存檔、匯出、雲端同步（兩台裝置取聯集），不用改存檔和雲端文件的形狀，
// Firestore 的規則也不用重貼。清單上限 200 筆（cloud/merge.ts 的 cleanProgress），現在最多教學 13 + 機體 27 + 戰鬥中達成的成就 10。
//
// 能從進度算出來的不另外記：過關的任務裡出現的機體都算遇過，章節、星數、改造、圖鑑的成就直接看進度。
// 所以加這個功能之前就玩過的存檔，打開圖鑑就是對的；也不會因為「補記」而平白改動存檔。
import { FEATS } from './data/achievements';
import { CODEX } from './data/codex';
import { MISSIONS } from './data/missions';
import { FRAMES, TRACKS, TRACK_MAX, frameUpgrades, modsOf } from './data/upgrades';
import type { Loadout } from './data/upgrades';
import type { Battle } from './sim/Battle';
import type { BattleEvent, MissionDef } from './sim/types';

/** 圖鑑和成就要看的那部分存檔 */
export interface Records {
  stars: Record<string, number>;
  tips: string[];
  upgrades: Loadout;
}

const SEEN = 'seen_';
const FEAT = 'ach_';

// ───────── 圖鑑 ─────────

/** 這個任務會出現的機型：開場的單位和之後的增援 */
export function missionUnits(m: MissionDef): string[] {
  return [...new Set([...m.units, ...(m.events ?? []).flatMap((e) => e.spawn ?? [])].map((s) => s.unit))];
}

/** 第一次出現在第幾個任務（MISSIONS 的索引）；沒有任務用到就是 -1 */
export function firstMission(unit: string): number {
  return MISSIONS.findIndex((m) => missionUnits(m).includes(unit));
}

/** 遇過的機型：過關的任務裡出現的，加上戰鬥中記下來的（打到一半、沒打贏的也算） */
export function seenUnits(p: Records): Set<string> {
  const out = new Set<string>();
  for (const m of MISSIONS) if ((p.stars[m.id] ?? 0) > 0) for (const u of missionUnits(m)) out.add(u);
  for (const t of p.tips) if (t.startsWith(SEEN)) out.add(t.slice(SEEN.length));
  // 只算圖鑑裡有的（存檔裡多出來的舊記號不算）
  const known = new Set(CODEX.map((c) => c.id));
  for (const id of [...out]) if (!known.has(id)) out.delete(id);
  return out;
}

/** 把這些機型記成遇過。已經算遇過的不重複記；回傳清單有沒有變（有變才需要存檔） */
export function markSeen(p: Records, ids: Iterable<string>): boolean {
  const have = seenUnits(p);
  const known = new Set(CODEX.map((c) => c.id));
  let changed = false;
  for (const id of new Set(ids)) {
    if (have.has(id) || !known.has(id)) continue;
    p.tips.push(SEEN + id);
    changed = true;
  }
  return changed;
}

// ───────── 成就 ─────────

const totalStars = (p: Records): number => MISSIONS.reduce((n, m) => n + Math.min(3, p.stars[m.id] ?? 0), 0);

/** 一台機體的改造裝了幾項、總共幾項（兩條強化線各三級 + 專屬改造） */
function frameProgress(p: Records, f: string): [number, number] {
  const up = frameUpgrades(p.upgrades, f);
  const mods = modsOf(f).length;
  return [TRACKS.reduce((n, t) => n + up[t], 0) + up.mods.length, TRACKS.length * TRACK_MAX + mods];
}

/** 從進度算得出來的成就（章節、星數、改造、圖鑑） */
export function stateFeats(p: Records): string[] {
  const out: string[] = [];
  for (const c of [1, 2, 3, 4]) {
    const list = MISSIONS.filter((m) => (m.chapter ?? 1) === c);
    if (list.length && list.every((m) => (p.stars[m.id] ?? 0) > 0)) out.push(`ch${c}`);
  }
  if (MISSIONS.some((m) => (p.stars[m.id] ?? 0) >= 3)) out.push('star3');
  const stars = totalStars(p);
  if (stars >= 18) out.push('stars18');
  if (stars >= MISSIONS.length * 3) out.push('stars36');
  if (FRAMES.some((f) => frameUpgrades(p.upgrades, f).mods.length > 0)) out.push('mod');
  if (FRAMES.some((f) => frameProgress(p, f)[0] >= frameProgress(p, f)[1])) out.push('maxed');
  if (seenUnits(p).size >= CODEX.length) out.push('codex');
  return out;
}

/** 已經達成的成就：算得出來的，加上戰鬥中記下來的 */
export function earnedFeats(p: Records): Set<string> {
  const out = new Set(stateFeats(p));
  for (const t of p.tips) if (t.startsWith(FEAT)) out.add(t.slice(FEAT.length));
  const known = new Set(FEATS.map((f) => f.id));
  for (const id of [...out]) if (!known.has(id)) out.delete(id);
  return out;
}

/** 把戰鬥中達成的成就記進存檔。已經有的不重複記；回傳清單有沒有變 */
export function grantFeats(p: Records, ids: Iterable<string>): boolean {
  const have = earnedFeats(p);
  let changed = false;
  for (const id of new Set(ids)) {
    if (have.has(id) || !FEATS.some((f) => f.id === id)) continue;
    p.tips.push(FEAT + id);
    changed = true;
  }
  return changed;
}

/** 有進度可以顯示的成就：[現在, 目標]；其他回傳 null */
export function featProgress(id: string, p: Records): [number, number] | null {
  if (id === 'stars18') return [Math.min(18, totalStars(p)), 18];
  if (id === 'stars36') return [totalStars(p), MISSIONS.length * 3];
  if (id === 'codex') return [seenUnits(p).size, CODEX.length];
  if (id === 'maxed') return FRAMES.map((f) => frameProgress(p, f)).sort((a, b) => b[0] / b[1] - a[0] / a[1])[0];
  const ch = /^ch(\d)$/.exec(id);
  if (ch) {
    const list = MISSIONS.filter((m) => (m.chapter ?? 1) === Number(ch[1]));
    return [list.filter((m) => (p.stars[m.id] ?? 0) > 0).length, list.length];
  }
  return null;
}

/**
 * 一次行動（Battle 回傳的一串事件）裡，我方做到了哪些戰術成就。
 * 一串事件 = 一台機體的一個動作和它引發的反擊、警戒射擊、波及，所以「一次行動擊破兩個」就是數這一串裡倒了幾個。
 */
export function featsIn(events: readonly BattleEvent[], b: Battle): string[] {
  const out = new Set<string>();
  const ours = (uid: number): boolean => b.unit(uid).side === 'player';
  let kills = 0;
  let pierced = 0;
  for (const e of events) {
    if (e.t === 'push' && e.fell && !ours(e.target)) {
      out.add('fall');
      kills++;
    }
    if (e.t !== 'attack' || !ours(e.uid) || ours(e.target)) continue;
    if (e.kind === 'skill' && e.skill === 'pierce') pierced++;
    if (!e.killed) continue;
    kills++;
    if (e.kind === 'overwatch') out.add('overwatch');
    if (e.kind === 'counter') out.add('counter');
    if (b.unit(e.target).def.frontShield && e.mods.some((m) => m.kind === 'flank')) out.add('shield');
  }
  if (kills >= 2) out.add('double');
  if (pierced >= 3) out.add('pierce3');
  return [...out];
}

/** 過關的那一刻看場上的狀態算的成就（還沒贏就是空的） */
export function winFeats(b: Battle): string[] {
  if (b.result !== 'win') return [];
  const out: string[] = [];
  const m = b.mission;
  // 防守和同步任務的回合數是固定的，沒有「提早」可言
  if (m.win.type !== 'survive' && m.win.type !== 'hold' && b.turn <= m.par - 3) out.push('swift');
  const mine = b.units.filter((u) => u.side === 'player' && !u.def.structure);
  const pilots = mine.filter((u) => u.def.pilot);
  if (pilots.length && pilots.every((u) => u.alive && u.hp >= u.maxHp)) out.push('fullhp');
  const sites = (m.protect ?? []).map((t) => b.byTag(t)).filter((u) => !!u && !!u.def.structure);
  if (sites.length && sites.every((u) => u!.alive && u!.hp >= u!.maxHp)) out.push('guard');
  const drones = mine.filter((u) => !u.def.pilot);
  if (drones.length && drones.every((u) => u.alive)) out.push('drones');
  return out;
}
