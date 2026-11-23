// 機庫：過關拿到的零件，以及每台機體的改造。
// 零件不另外存數字 —— 一律從「每關拿過幾顆星」算出來，再扣掉已經花在改造上的，
// 所以不會有刷關、存檔對不上的問題，舊存檔也會自動補發。改造可以隨時全額退還重配。
import type { L10n, MissionDef, SkillDef, UnitDef } from '../sim/types';
import { MISSIONS } from './missions';

/** 可以改造的我方機體（照加入順序） */
export const FRAMES = ['kai', 'bruno', 'vey', 'echo', 'sparrow', 'hale_ally'] as const;
export type FrameId = (typeof FRAMES)[number];

/** 每台都有的兩條強化線，各三級 */
export type TrackId = 'plating' | 'firepower';
export const TRACKS: readonly TrackId[] = ['plating', 'firepower'];
export const TRACK_MAX = 3;
export const TRACK_COST: Record<TrackId, readonly number[]> = { plating: [30, 50, 80], firepower: [40, 60, 90] };
/** 每級的加成：耐久上限 +10%、武器傷害 +8% */
export const TRACK_STEP: Record<TrackId, number> = { plating: 0.1, firepower: 0.08 };
export const TRACK_NAME: Record<TrackId, L10n> = {
  plating: { zh: '複合裝甲', en: 'Composite Plating' },
  firepower: { zh: '武器校準', en: 'Weapon Tuning' },
};
export const TRACK_DESC: Record<TrackId, L10n> = {
  plating: { zh: '耐久上限每級 +10%', en: '+10% max HP per level' },
  firepower: { zh: '武器傷害每級 +8%', en: '+8% weapon damage per level' },
};

/** 專屬改造：每台兩個，買了就一直生效 */
export const MOD_COST = 90;

export interface ModDef {
  id: string;
  frame: FrameId;
  name: L10n;
  desc: L10n;
  apply: (d: UnitDef) => void;
}

export interface FrameUpgrades {
  plating: number;
  firepower: number;
  mods: string[];
}
/** 存檔裡的改造紀錄：機體 id → 改造 */
export type Loadout = Record<string, FrameUpgrades | undefined>;

function skill(d: UnitDef, id: string): SkillDef {
  const s = d.skills.find((k) => k.id === id);
  if (!s) throw new Error(`${d.id} has no skill ${id}`);
  return s;
}

export const MODS: readonly ModDef[] = [
  {
    id: 'kai_link',
    frame: 'kai',
    name: { zh: '指揮鏈路', en: 'Command Link' },
    desc: { zh: '「隊長」的範圍從相鄰擴大到 2 格', en: 'Squad Leader reaches 2 tiles instead of adjacent' },
    apply: (d) => {
      if (d.aura) d.aura.range = 2;
      if (d.passive) d.passive.desc = { zh: '2 格內的友軍傷害 +10%', en: 'Allies within 2 tiles deal +10% damage' };
    },
  },
  {
    id: 'kai_burst',
    frame: 'kai',
    name: { zh: '過載彈匣', en: 'Overcharged Magazine' },
    desc: { zh: '「集火射擊」的傷害加成 +60% → +90%', en: 'Focus Fire bonus goes from +60% to +90%' },
    apply: (d) => {
      const s = skill(d, 'focus');
      s.effect = { type: 'shot', mul: 1.9 };
      s.desc = { zh: '傷害 +90% 的精準連射，對方無法反擊', en: 'A precise burst for +90% damage. Cannot be countered' };
    },
  },
  {
    id: 'bruno_reactive',
    frame: 'bruno',
    name: { zh: '反應裝甲', en: 'Reactive Armor' },
    desc: { zh: '裝甲 +2（每次受擊少 2 點傷害）', en: '+2 armor (2 less damage from every hit)' },
    apply: (d) => {
      d.armor += 2;
    },
  },
  {
    id: 'bruno_longshock',
    frame: 'bruno',
    name: { zh: '長管震盪砲', en: 'Long-Barrel Shock Cannon' },
    desc: { zh: '「震盪砲」射程 +1、冷卻 -1 回合', en: 'Shock Cannon: +1 range, cooldown 1 turn shorter' },
    apply: (d) => {
      const s = skill(d, 'shock');
      s.max += 1;
      s.cd -= 1;
    },
  },
  {
    id: 'vey_scope',
    frame: 'vey',
    name: { zh: '延伸瞄具', en: 'Extended Scope' },
    desc: { zh: '磁軌步槍射程 +1', en: '+1 railgun range' },
    apply: (d) => {
      d.weapon.max += 1;
    },
  },
  {
    id: 'vey_core',
    frame: 'vey',
    name: { zh: '鎢芯彈', en: 'Tungsten Core' },
    desc: { zh: '「貫穿射擊」傷害 +30%', en: 'Piercing Shot deals +30% damage' },
    apply: (d) => {
      const s = skill(d, 'pierce');
      s.effect = { type: 'line', mul: 1.3, len: 6 };
      s.desc = { zh: '朝一個方向開火，打穿直線上 6 格內的所有敵人，傷害 +30%', en: 'Fire in one direction, hitting every enemy within 6 tiles in a straight line for +30% damage' };
    },
  },
  {
    id: 'echo_nano',
    frame: 'echo',
    name: { zh: '奈米修復', en: 'Nanite Repair' },
    desc: { zh: '「現場修復」回復量 40 → 60、距離 +1', en: 'Field Repair restores 60 instead of 40, +1 range' },
    apply: (d) => {
      const s = skill(d, 'repair');
      s.effect = { type: 'heal', amount: 60 };
      s.max += 1;
      s.desc = { zh: '修復 3 格內的一個友軍 60 點耐久', en: 'Restore 60 HP to an ally within 3 tiles' };
    },
  },
  {
    id: 'echo_relay',
    frame: 'echo',
    name: { zh: '超載中繼', en: 'Overload Relay' },
    desc: { zh: '「超載駭入」距離 +1、冷卻 -1 回合', en: 'Overload: +1 range, cooldown 1 turn shorter' },
    apply: (d) => {
      const s = skill(d, 'overload');
      s.max += 1;
      s.cd -= 1;
      s.desc = { zh: '癱瘓 4 格內的一個敵人：它的下一回合無法行動，也不能反擊', en: 'Disable an enemy within 4 tiles: it skips its next turn and cannot counter' };
    },
  },
  {
    id: 'sparrow_thrust',
    frame: 'sparrow',
    name: { zh: '加力推進器', en: 'Afterburner' },
    desc: { zh: '「噴射躍進」距離 +1、冷卻 -1 回合', en: 'Jet Leap: +1 range, cooldown 1 turn shorter' },
    apply: (d) => {
      const s = skill(d, 'leap');
      s.max += 1;
      s.cd -= 1;
      s.desc = { zh: '跳到 6 格內的任何空格：無視地形、高低差和警戒射擊，跳完還能攻擊（取代這回合的移動）', en: "Jump to any free tile within 6: ignores terrain, height and overwatch, and you can still attack (replaces this turn's move)" };
    },
  },
  {
    id: 'sparrow_barrel',
    frame: 'sparrow',
    name: { zh: '加長槍管', en: 'Long Barrels' },
    desc: { zh: '雙管衝鋒槍射程 +1', en: '+1 Twin SMG range' },
    apply: (d) => {
      d.weapon.max += 1;
    },
  },
  {
    id: 'hale_net',
    frame: 'hale_ally',
    name: { zh: '指揮網路', en: 'Command Net' },
    desc: { zh: '「督戰令」距離 +1、冷卻 -1 回合', en: 'Rally Order: +1 range, cooldown 1 turn shorter' },
    apply: (d) => {
      const s = skill(d, 'rally');
      s.max += 1;
      s.cd -= 1;
      s.desc = { zh: '讓 4 格內一台已經行動過的友軍再行動一次（可以再移動、再攻擊）', en: 'An ally within 4 tiles that has already acted may act again (move and attack)' };
    },
  },
  {
    id: 'hale_phalanx',
    frame: 'hale_ally',
    name: { zh: '方陣', en: 'Phalanx' },
    desc: { zh: '「督戰」的減傷 20% → 30%', en: 'Overseer reduces damage by 30% instead of 20%' },
    apply: (d) => {
      if (d.aura) d.aura.guard = 0.3;
      if (d.passive) d.passive.desc = { zh: '2 格內的友軍受到的傷害 -30%', en: 'Allies within 2 tiles take 30% less damage' };
    },
  },
];

export const modById = (id: string): ModDef | undefined => MODS.find((m) => m.id === id);
export const modsOf = (frame: string): ModDef[] => MODS.filter((m) => m.frame === frame);

const level = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(TRACK_MAX, Math.floor(n))) : 0);

/** 把存檔裡的紀錄整理成可信的樣子：等級夾在 0–3，只留這台機體真的有的改造 */
export function frameUpgrades(loadout: Loadout | undefined, frame: string): FrameUpgrades {
  const raw = loadout?.[frame];
  const mods = Array.isArray(raw?.mods) ? modsOf(frame).filter((m) => raw.mods.includes(m.id)).map((m) => m.id) : [];
  return { plating: level(raw?.plating), firepower: level(raw?.firepower), mods };
}

/** 套用改造後的機體資料（不動到原本的定義） */
export function applyUpgrades(base: UnitDef, up: FrameUpgrades): UnitDef {
  // 機體資料是純資料，用 JSON 複製就好（舊版 iOS Safari 沒有 structuredClone）
  const d = JSON.parse(JSON.stringify(base)) as UnitDef;
  d.hp = Math.round(base.hp * (1 + TRACK_STEP.plating * up.plating));
  d.weapon.dmg = Math.round(base.weapon.dmg * (1 + TRACK_STEP.firepower * up.firepower));
  for (const id of up.mods) modById(id)?.apply(d);
  return d;
}

/** 開戰用的單位表：我方六台換成改造後的版本，其他照舊 */
export function loadoutDefs(defs: Record<string, UnitDef>, loadout: Loadout | undefined): Record<string, UnitDef> {
  const out = { ...defs };
  for (const f of FRAMES) if (defs[f]) out[f] = applyUpgrades(defs[f], frameUpgrades(loadout, f));
  return out;
}

// ───────── 零件 ─────────

/** 第一、二、三顆星各給多少零件（第一章的量；後面的章節照 chapterMul 放大） */
export const STAR_PARTS = [60, 30, 30] as const;
export const chapterMul = (chapter: number): number => 1 + (Math.max(1, chapter) - 1) * 0.5;

/** 這一關拿到 stars 顆星總共值多少零件 */
export function missionParts(m: Pick<MissionDef, 'chapter'>, stars: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(STAR_PARTS.length, Math.max(0, Math.floor(stars))); i++) n += STAR_PARTS[i];
  return Math.round(n * chapterMul(m.chapter ?? 1));
}

export function partsEarned(stars: Record<string, number>, missions: readonly MissionDef[] = MISSIONS): number {
  return missions.reduce((n, m) => n + missionParts(m, stars[m.id] ?? 0), 0);
}

export function frameSpent(up: FrameUpgrades): number {
  let n = up.mods.length * MOD_COST;
  for (const t of TRACKS) for (let i = 0; i < up[t]; i++) n += TRACK_COST[t][i];
  return n;
}

export function partsSpent(loadout: Loadout | undefined): number {
  return FRAMES.reduce((n, f) => n + frameSpent(frameUpgrades(loadout, f)), 0);
}

/** 手上還有多少零件。存檔被手改成「花的比賺的多」時當作 0，不顯示負數（也買不了東西） */
export function partsLeft(stars: Record<string, number>, loadout: Loadout | undefined): number {
  return Math.max(0, partsEarned(stars) - partsSpent(loadout));
}

/** 這條強化線下一級要多少零件；滿級回傳 null */
export function trackCost(up: FrameUpgrades, track: TrackId): number | null {
  return up[track] >= TRACK_MAX ? null : TRACK_COST[track][up[track]];
}

/** 買一級強化：零件不夠或已經滿級就不動，回傳有沒有買成 */
export function buyTrack(stars: Record<string, number>, loadout: Loadout, frame: FrameId, track: TrackId): boolean {
  const up = frameUpgrades(loadout, frame);
  const cost = trackCost(up, track);
  if (cost === null || cost > partsLeft(stars, loadout)) return false;
  up[track] += 1;
  loadout[frame] = up;
  return true;
}

export function buyMod(stars: Record<string, number>, loadout: Loadout, frame: FrameId, modId: string): boolean {
  const up = frameUpgrades(loadout, frame);
  if (modById(modId)?.frame !== frame || up.mods.includes(modId) || MOD_COST > partsLeft(stars, loadout)) return false;
  up.mods.push(modId);
  loadout[frame] = up;
  return true;
}

/** 這台機體的改造全部拆掉，零件全額退還 */
export function resetFrame(loadout: Loadout, frame: FrameId): void {
  delete loadout[frame];
}

/** 現有的零件買得起這台機體的任何一項嗎（任務列表上的提示用） */
export function canAffordAny(stars: Record<string, number>, loadout: Loadout | undefined, frame: FrameId): boolean {
  const left = partsLeft(stars, loadout);
  const up = frameUpgrades(loadout, frame);
  if (TRACKS.some((t) => (trackCost(up, t) ?? Infinity) <= left)) return true;
  return up.mods.length < modsOf(frame).length && MOD_COST <= left;
}

// ───────── 進度 ─────────

/** 這一關開放了沒：第一關一定開，其他要前一關拿過星 */
export function missionOpen(index: number, stars: Record<string, number>, missions: readonly MissionDef[] = MISSIONS): boolean {
  return index === 0 || (stars[missions[index - 1].id] ?? 0) > 0;
}

/** 這台機體加入了沒：已開放的關卡裡有它上場就算 */
export function frameUnlocked(frame: string, stars: Record<string, number>, missions: readonly MissionDef[] = MISSIONS): boolean {
  return missions.some((m, i) => missionOpen(i, stars, missions) && m.units.some((u) => u.unit === frame && u.side === 'player'));
}
