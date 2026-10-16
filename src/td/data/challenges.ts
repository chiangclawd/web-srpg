import type { GroupDef, LevelDef, LevelMode, TowerType, WaveDef } from '../sim/defs';
import { ENEMIES } from './enemies';

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
      rules: { mode: 'heroic' },
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
