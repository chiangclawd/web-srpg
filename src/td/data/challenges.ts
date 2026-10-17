import type { GroupDef, LevelDef, LevelMode, TowerType, WaveDef } from '../sim/defs';
import { Rng } from '../sim/math';
import { ENEMIES } from './enemies';
import { LEVELS } from './levels';

/** 鋼鐵挑戰每關限定的兩種塔（依敵人組成手動指定，確保有解） */
const IRON_TOWERS: TowerType[][] = [
  ['archer', 'barracks'],
  ['archer', 'artillery'],
  ['mage', 'barracks'],
  ['archer', 'mage'],
  ['barracks', 'artillery'],
  ['archer', 'mage'],
  ['mage', 'artillery'],
  ['mage', 'barracks'],
  ['mage', 'artillery'],
  ['archer', 'barracks'],
  ['archer', 'mage'],
  ['mage', 'artillery'],
  // 外傳
  ['mage', 'barracks'],
  ['mage', 'artillery'],
];

export function ironTowers(level: LevelDef): TowerType[] {
  return IRON_TOWERS[level.index % IRON_TOWERS.length];
}

function noBoss(groups: GroupDef[]): GroupDef[] {
  return groups.filter((g) => !ENEMIES[g.enemy]?.boss);
}

function scale(g: GroupDef, k: number, delay: number): GroupDef {
  return { ...g, count: Math.max(1, Math.round(g.count * k)), delay: (g.delay ?? 0) + delay };
}

/**
 * 英雄挑戰：只有 1 條命、6 波高密度精英波次（取原關卡後半段的敵人組成，兩波合一）。
 * 鋼鐵挑戰：只有 1 條命、只能用兩種塔、不能用法術、一大波連續攻勢。
 */
export function challengeLevel(level: LevelDef, mode: LevelMode): LevelDef {
  if (mode === 'campaign') return level;
  if (mode === 'endless') return endlessLevel(level);
  if (mode === 'bossrush') return bossRushLevel(level);
  const src = level.waves;
  const n = src.length;
  if (mode === 'heroic') {
    const waves: WaveDef[] = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.min(n - 1, Math.floor(n * 0.15 + (k * n * 0.7) / 6));
      const b = Math.min(n - 1, a + 1);
      const groups = [...noBoss(src[a].groups).map((g) => scale(g, 0.75, 0)), ...noBoss(src[b].groups).map((g) => scale(g, 0.4, 8))];
      waves.push({ groups, gap: 16 });
    }
    return {
      ...level,
      lives: 3,
      startGold: Math.round(level.startGold * 1.6),
      waves,
      intro: [],
      tutorial: false,
      // 英雄挑戰：一開始就有精英，越後面越多
      rules: { mode: 'heroic', elite: { base: 0.03, perWave: 0.02, max: 0.15 } },
    };
  }
  // iron
  const last = src.slice(Math.max(0, n - 3));
  const groups: GroupDef[] = [];
  last.forEach((w, i) => groups.push(...noBoss(w.groups).map((g) => scale(g, 0.6, i * 30))));
  return {
    ...level,
    lives: 3,
    startGold: Math.round(level.startGold * 2.2),
    waves: [{ groups }],
    intro: [],
    tutorial: false,
    rules: { mode: 'iron', allowed: ironTowers(level), noSpells: true },
  };
}

// ───────────────────────── 無盡模式 ─────────────────────────

/** 依戰役順序排列的首領 */
const BOSS_CHAIN = ['morden', 'selene', 'carl', 'high_priest', 'sub_priest', 'cult_leader'];
/** 產生的波數（實際上打不完） */
export const ENDLESS_WAVES = 150;
/** 無盡模式的日夜循環：每 ENDLESS_DAY 波裡最後 ENDLESS_NIGHT 波是夜晚 */
export const ENDLESS_DAY = 20;
export const ENDLESS_NIGHT = 5;

function levelPool(l: LevelDef): string[] {
  const s = new Set<string>();
  for (const w of l.waves) for (const g of w.groups) if (!ENEMIES[g.enemy]?.boss) s.add(g.enemy);
  return [...s];
}

/** 第 k 波（從 1 起算）的敵人血量倍率 */
export function endlessHpMul(k: number): number {
  return 1 + Math.max(0, k - 10) * 0.06;
}

/** 第 k 波的敵人總血量預算（未乘倍率） */
function endlessBudget(k: number): number {
  return 200 + 110 * k + 6 * k * k;
}

/**
 * 無盡模式：20 條命、無限波次。每 5 波加入下一關的敵人種類，
 * 第 10 波後血量逐波提升，每 10 波出現首領（漏失最多扣 5 條命）；
 * 第 16–20、36–40…波入夜。
 */
export function endlessLevel(level: LevelDef): LevelDef {
  const rng = new Rng(level.seed * 7919 + 17);
  const idx = Math.max(0, LEVELS.findIndex((l) => l.id === level.id));
  const P = level.paths.length;
  const waves: WaveDef[] = [];
  for (let k = 1; k <= ENDLESS_WAVES; k++) {
    const pool = new Set<string>();
    const reach = Math.min(LEVELS.length - 1, idx + Math.floor((k - 1) / 5));
    for (let i = idx; i <= reach; i++) levelPool(LEVELS[i]).forEach((e) => pool.add(e));
    const list = [...pool].sort((a, b) => ENEMIES[a].hp - ENEMIES[b].hp);
    const boss = k % 10 === 0;
    // 日夜循環：每 20 波的最後 5 波是夜晚（首領波在夜裡），提燈怨靈趁黑出沒
    const night = (k - 1) % ENDLESS_DAY >= ENDLESS_DAY - ENDLESS_NIGHT;
    let budget = endlessBudget(k) * (boss ? 0.6 : 1);
    const groups: GroupDef[] = [];
    if (night) {
      const count = Math.min(12, 3 + Math.floor(k / 10));
      budget -= count * ENEMIES.wraith.hp;
      groups.push({ path: k % P, enemy: 'wraith', count, interval: 1.2, delay: 5 });
    }
    const G = Math.min(4, 1 + Math.floor(k / 3));
    for (let gi = 0; gi < G; gi++) {
      // 只挑預算付得起至少 2 隻的種類；第一組偏弱（雜兵），其餘偏強
      const share = budget / (G - gi);
      const ok = list.filter((e) => ENEMIES[e].hp * 2 <= share * 1.15);
      const cand = ok.length ? ok : list.slice(0, 1);
      const r = rng.next();
      const pick = gi === 0 ? Math.floor(r * Math.ceil(cand.length / 2)) : Math.floor(cand.length * (1 - r * r * 0.85));
      const id = cand[Math.min(cand.length - 1, pick)];
      const def = ENEMIES[id];
      const count = Math.max(2, Math.min(6 + 2 * k, 28, Math.round(share / def.hp)));
      budget -= count * def.hp;
      groups.push({
        path: (gi + k) % P,
        enemy: id,
        count,
        interval: def.flying ? 1 : Math.min(2.4, Math.max(0.6, 0.45 + def.hp / 380)),
        delay: gi * 3,
      });
    }
    if (boss) {
      const b = BOSS_CHAIN[Math.min(BOSS_CHAIN.length - 1, k / 10 - 1 + Math.floor(idx / 4))];
      groups.push({ path: k % P, enemy: b, count: 1, interval: 1, delay: 6 });
    }
    waves.push({ groups, gap: 20, hpMul: endlessHpMul(k), night: night || undefined });
  }
  return {
    ...level,
    lives: 20,
    waves,
    intro: [],
    tutorial: false,
    // 無盡：第 8 波起出現精英，每波多 1.2%，最多三成
    rules: { mode: 'endless', leakCap: 5, elite: { base: -0.084, perWave: 0.012, max: 0.3 } },
  };
}

/** 首領連戰的出場順序與隨行部隊（依戰役順序，最後是教主） */
export const BOSS_RUSH: { boss: string; escort: string; count: number }[] = [
  { boss: 'morden', escort: 'wolf', count: 8 },
  { boss: 'selene', escort: 'frost_sprite', count: 8 },
  { boss: 'carl', escort: 'rider', count: 5 },
  { boss: 'high_priest', escort: 'cultist', count: 8 },
  { boss: 'sub_priest', escort: 'assassin', count: 6 },
  { boss: 'wyrm', escort: 'scorpion', count: 5 },
  { boss: 'frost_giant', escort: 'yeti', count: 3 },
  { boss: 'fire_lord', escort: 'magma_imp', count: 10 },
  { boss: 'leviathan', escort: 'drowned', count: 8 },
  { boss: 'cult_leader', escort: 'demon', count: 6 },
];

/**
 * 首領連戰：在任一張地圖上依序迎戰十名首領（各帶一支隨行部隊）。
 * 起始金幣多、20 條命，首領漏失最多扣 5 條命；依剩餘生命給 1~3 星。
 */
export function bossRushLevel(level: LevelDef): LevelDef {
  const P = level.paths.length;
  const waves: WaveDef[] = BOSS_RUSH.map((b, k) => ({
    groups: [
      { path: k % P, enemy: b.escort, count: b.count, interval: ENEMIES[b.escort].flying ? 0.9 : 0.8 },
      { path: k % P, enemy: b.boss, count: 1, interval: 1, delay: 5 },
    ],
    // 首領走得慢：間隔拉長，避免三四隻首領同時在場
    gap: 40,
    hpMul: 0.9,
  }));
  return {
    ...level,
    lives: 20,
    startGold: 3200,
    waves,
    intro: [],
    tutorial: false,
    hazards: level.hazards,
    rules: { mode: 'bossrush', leakCap: 5 },
  };
}
