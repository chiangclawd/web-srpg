/**
 * 無頭兵種平衡模擬器（Wave 2 / G2）。
 *
 * 用「真實」傷害公式（直接 import src/battle 的 computeDamage / rollAttack）跑
 * 每個兵種 vs 每個兵種的 1v1 對決，輸出勝率矩陣與整體公平度，對照 balance.ts
 * 的 BALANCE_TARGETS。改完平衡數值後跑：
 *
 *     npm run balance
 *
 * 模型與caveat（務必理解結果意義）：
 *   - 條件：同等級「基礎數值」、無技能 / 無裝備 / 無地形 / 無難度倍率。
 *   - 1v1 相鄰、雙方互相反擊；每回合輪流先手（消除固定先手偏差）。
 *   - **不模擬**射程風箏與移動差（弓/法/飛的結構性優勢被低估）—— 這隔離出
 *     「數值 + 相剋矩陣」本身的平衡，定位/移動屬另一層（Wave 3/4）。
 *   - 因此這是「相剋矩陣 + 基礎數值」的體檢，不是完整戰場勝率。
 */
import { computeDamage, rollAttack, doublesAttack } from '../src/battle/DamageCalculator';
import { UNIT_TYPES } from '../src/data/unitTypes';
import { BALANCE_TARGETS } from '../src/data/balance';
import type { UnitTypeId } from '../src/types';

const TYPES = Object.keys(UNIT_TYPES) as UnitTypeId[];
const TRIALS = 4000;
const MAX_ROUNDS = 200;

interface SimUnit {
  type: UnitTypeId;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

function mk(type: UnitTypeId): SimUnit {
  const b = UNIT_TYPES[type].baseStats;
  return { type, hp: b.hp, maxHp: b.hp, attack: b.attack, defense: b.defense, speed: b.speed };
}

/** 一次揮擊：用當前 HP 比例算預判再擲骰，命中則扣血。 */
function swing(atk: SimUnit, def: SimUnit): void {
  const preview = computeDamage({
    attackerType: atk.type,
    defenderType: def.type,
    attackerAttack: atk.attack,
    defenderDefense: def.defense,
    attackerHpRatio: atk.hp / atk.maxHp,
    defenderHpRatio: def.hp / def.maxHp,
  });
  const r = rollAttack(preview);
  if (r.hit) def.hp -= r.damage;
}

/** 攻方一次行動：揮擊 + 速度達門檻時追擊一次。 */
function act(atk: SimUnit, def: SimUnit): void {
  swing(atk, def);
  if (def.hp > 0 && doublesAttack(atk.speed, def.speed)) swing(atk, def);
}

/** 一場對決：輪流先手，先手行動後對方若存活則反擊（含各自追擊）。回傳 'A' | 'B' | 'draw'。 */
function duel(aType: UnitTypeId, bType: UnitTypeId): 'A' | 'B' | 'draw' {
  const A = mk(aType);
  const B = mk(bType);
  let aFirst = true;
  for (let round = 0; round < MAX_ROUNDS && A.hp > 0 && B.hp > 0; round++) {
    const [first, second] = aFirst ? [A, B] : [B, A];
    act(first, second);
    if (second.hp > 0) act(second, first);
    aFirst = !aFirst;
  }
  if (A.hp <= 0 && B.hp <= 0) return 'draw';
  if (B.hp <= 0) return 'A';
  if (A.hp <= 0) return 'B';
  return 'draw';
}

/** row 對 col 的勝率（draw 計 0.5）。 */
function winRate(row: UnitTypeId, col: UnitTypeId): number {
  if (row === col) return 0.5;
  let score = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = duel(row, col);
    if (r === 'A') score += 1;
    else if (r === 'draw') score += 0.5;
  }
  return score / TRIALS;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(4);
const label = (t: string) => t.padEnd(8);

console.log(`\n兵種平衡模擬（每對位 ${TRIALS} 場，基礎數值、無技能/裝備/地形）`);
console.log('讀法：每列 = 攻方對「各欄」的勝率。\n');

// 表頭
console.log('         ' + TYPES.map((t) => label(t)).join(''));
const matrix: Record<string, Record<string, number>> = {};
for (const row of TYPES) {
  matrix[row] = {};
  let line = label(row);
  for (const col of TYPES) {
    const wr = winRate(row, col);
    matrix[row][col] = wr;
    line += label(pct(wr));
  }
  console.log(line);
}

// 整體公平度：每兵種對「其他所有兵種」的平均勝率
console.log('\n整體強度（對全體平均勝率，理想接近 50%）：');
const issues: string[] = [];
for (const t of TYPES) {
  const others = TYPES.filter((o) => o !== t);
  const mean = others.reduce((s, o) => s + matrix[t][o], 0) / others.length;
  let flag = '';
  if (mean > BALANCE_TARGETS.TYPE_MEAN_MAX) {
    flag = ' ⚠ 偏強（壓制整體）';
    issues.push(`${t} 平均勝率 ${pct(mean).trim()} > ${pct(BALANCE_TARGETS.TYPE_MEAN_MAX).trim()}`);
  } else if (mean < BALANCE_TARGETS.TYPE_MEAN_MIN) {
    flag = ' ⚠ 偏弱（被整體壓制）';
    issues.push(`${t} 平均勝率 ${pct(mean).trim()} < ${pct(BALANCE_TARGETS.TYPE_MEAN_MIN).trim()}`);
  }
  console.log(`  ${label(t)} ${pct(mean)}${flag}`);
}

// 一邊倒對位（供人工檢視，不一定是壞事——相剋本就製造強弱）
console.log(`\n一邊倒對位（勝率 ≥ ${pct(BALANCE_TARGETS.SWING_FLAG).trim()}，相剋預期內，留意是否過頭）：`);
const swings: string[] = [];
for (const row of TYPES) {
  for (const col of TYPES) {
    if (row !== col && matrix[row][col] >= BALANCE_TARGETS.SWING_FLAG) {
      swings.push(`  ${row} → ${col}: ${pct(matrix[row][col]).trim()}`);
    }
  }
}
console.log(swings.length ? swings.join('\n') : '  （無）');

console.log('\n結論：');
if (issues.length === 0) {
  console.log('  ✅ 每兵種整體勝率都落在目標區間，沒有壓制全體或被壓制的兵種。');
} else {
  console.log('  ⚠ 需注意：');
  for (const i of issues) console.log(`     - ${i}`);
}
console.log('');
