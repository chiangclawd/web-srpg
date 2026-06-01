import type { ActiveSkillDef, Faction, UnitTypeId } from '../types';
import { getCounter } from './CounterSystem';
import { SKILL_EFFECTS } from '../data/skillEffects';
import { UNIT_TYPES } from '../data/unitTypes';
import {
  CRIT_MULTIPLIER,
  DEF_REDUCTION_PER_POINT,
  DEF_REDUCTION_CAP,
  DOUBLE_ATTACK_THRESHOLD,
} from '../data/balance';

// 重新匯出以維持既有 public API（部分呼叫端 import 自此檔）。
export { CRIT_MULTIPLIER } from '../data/balance';

/** 攻方速度是否快到能對守方追擊（二次攻擊）。攻守各自獨立判定。 */
export function doublesAttack(attackerSpeed: number, defenderSpeed: number): boolean {
  return attackerSpeed - defenderSpeed >= DOUBLE_ATTACK_THRESHOLD;
}

export interface DamageContext {
  attackerType: UnitTypeId;
  defenderType: UnitTypeId;
  attackerAttack: number;
  defenderDefense: number;
  /** 防守方所在地形的防禦加成（可省略） */
  terrainDefBonus?: number;
  // 特技計算用
  attackerSkillId?: string;
  defenderSkillId?: string;
  attackerFaction?: Faction;
  defenderFaction?: Faction;
  attackerMovedDistance?: number;
  /** 攻擊方目前 HP 比例（0-1）。給「自身 HP > X% 才生效」這類技能用 */
  attackerHpRatio?: number;
  defenderHpRatio?: number;
  /** 攻擊方周圍 6 格內同陣營友軍數（不含自己）。集團型攻擊技能用 */
  attackerAdjacentAllies?: number;
  /** 防守方周圍 6 格內同陣營友軍數（不含自己）。盾牆型防禦技能用 */
  defenderAdjacentAllies?: number;
  /** 攻擊方的「empower 主動特技」修正（觸發後下一次攻擊用）*/
  attackerEmpower?: ActiveSkillDef['empower'];
  /** 防守方的「stance 防禦姿態」減傷倍率（一場 1 用、持續 N 回合）*/
  defenderStanceMul?: number;
  /** 難度倍率（敵方攻擊額外乘）：休閒 0.7、普通 1.0、困難 1.3 */
  enemyAttackMul?: number;
  /** 攻擊方武器的命中率加成（百分點，可省略）*/
  attackerWeaponHitBonus?: number;
  /** 攻擊方武器的爆擊率加成（百分點，可省略）*/
  attackerWeaponCritBonus?: number;
  /** 側/背擊傷害倍率（Wave 4）：正面 1.0 / 側 1.1 / 背 1.25，由 BattleScene 依面向幾何算好傳入。 */
  flankMul?: number;
  /** 羈絆傷害倍率（Wave 6）：相鄰羈絆夥伴時 >1，由 BattleScene 算好傳入。 */
  bondMul?: number;
}

export interface DamageResult {
  /** 預覽：「打中且未爆擊」時的傷害（拿來顯示在 tooltip）*/
  damage: number;
  counterMultiplier: number;
  counterLabel: '優勢' | '劣勢' | '普通';
  /** 哪些特技參與了計算（用於 tooltip 顯示） */
  appliedSkills: string[];
  /** 該攻擊的命中率 0-100 */
  hitRate: number;
  /** 該攻擊的爆擊率 0-100（爆擊傷害 ×CRIT_MULTIPLIER，見下方常數）*/
  critRate: number;
}

/** 真正執行攻擊時擲骰，回傳實際傷害與命中／爆擊狀態 */
export interface ResolvedAttack {
  damage: number;
  hit: boolean;
  crit: boolean;
}

// 傷害公式調參（CRIT_MULTIPLIER / DEF_REDUCTION_*）已移至 data/balance.ts，見上方 import。

export function computeDamage(ctx: DamageContext): DamageResult {
  const counter = getCounter(ctx.attackerType, ctx.defenderType);
  const totalDef = ctx.defenderDefense + (ctx.terrainDefBonus ?? 0);

  let raw = ctx.attackerAttack * counter.multiplier;
  const appliedSkills: string[] = [];

  // 難度倍率：當敵方為攻擊方時套用
  if (ctx.attackerFaction === 'enemy' && ctx.enemyAttackMul && ctx.enemyAttackMul !== 1.0) {
    raw *= ctx.enemyAttackMul;
  }

  // 攻擊方輸出特技
  const aSkill = ctx.attackerSkillId ? SKILL_EFFECTS[ctx.attackerSkillId] : undefined;
  if (aSkill?.outgoingMul) {
    const mul = aSkill.outgoingMul(ctx);
    if (mul !== 1.0) {
      raw *= mul;
      appliedSkills.push(`攻方特技 ×${mul.toFixed(2)}`);
    }
  }

  // 側 / 背擊加成（Wave 4）：攻擊面倍率，乘在減傷前
  if (ctx.flankMul && ctx.flankMul !== 1.0) {
    raw *= ctx.flankMul;
    appliedSkills.push(`側背擊 ×${ctx.flankMul.toFixed(2)}`);
  }

  // 羈絆加成（Wave 6）：相鄰羈絆夥伴時的攻擊倍率
  if (ctx.bondMul && ctx.bondMul !== 1.0) {
    raw *= ctx.bondMul;
    appliedSkills.push(`羈絆 ×${ctx.bondMul.toFixed(2)}`);
  }

  // 防禦改為「乘法減傷」：每點 DEF 抵 5%，上限 70%
  // 重甲跟布甲差別變明顯、地形 DEF 加成也更有感
  // empower.ignoreDef 跳過防禦階段（破甲攻擊）
  const empower = ctx.attackerEmpower;
  const defReduction = empower?.ignoreDef
    ? 0
    : Math.min(DEF_REDUCTION_CAP, totalDef * DEF_REDUCTION_PER_POINT);
  let dmg = raw * (1 - defReduction);

  // 攻擊方 empower 倍率（如「王者一閃 ×1.5」）
  if (empower?.dmgMul && empower.dmgMul !== 1.0) {
    dmg *= empower.dmgMul;
    appliedSkills.push(`蓄力 ×${empower.dmgMul.toFixed(2)}`);
  }

  // 防守方承受特技（乘在減傷後）
  const dSkill = ctx.defenderSkillId ? SKILL_EFFECTS[ctx.defenderSkillId] : undefined;
  if (dSkill?.incomingMul) {
    const mul = dSkill.incomingMul(ctx);
    if (mul !== 1.0) {
      dmg *= mul;
      appliedSkills.push(`守方特技 ×${mul.toFixed(2)}`);
    }
  }

  // 防守方 stance 防禦姿態（一場 1 次 buff，持續 N 個我方回合）
  if (ctx.defenderStanceMul && ctx.defenderStanceMul !== 1.0) {
    dmg *= ctx.defenderStanceMul;
    appliedSkills.push(`守方姿態 ×${ctx.defenderStanceMul.toFixed(2)}`);
  }

  dmg = Math.max(1, Math.floor(dmg));

  // 命中／爆擊率：兵種基底 + 武器加成 + empower buff
  const aType = UNIT_TYPES[ctx.attackerType];
  const hitRate = Math.max(
    0,
    Math.min(
      100,
      (aType.hitRate ?? 95) + (ctx.attackerWeaponHitBonus ?? 0) + (empower?.hitBoost ?? 0)
    )
  );
  const critRate = Math.max(
    0,
    Math.min(
      100,
      (aType.critRate ?? 5) + (ctx.attackerWeaponCritBonus ?? 0) + (empower?.critBoost ?? 0)
    )
  );

  return {
    damage: dmg,
    counterMultiplier: counter.multiplier,
    counterLabel: counter.label,
    appliedSkills,
    hitRate,
    critRate,
  };
}

/**
 * 真正執行攻擊：擲骰決定命中／爆擊，回傳實際造成的傷害。
 * Miss → damage=0；Crit → damage * CRIT_MULTIPLIER（floor）。
 */
export function rollAttack(preview: DamageResult): ResolvedAttack {
  const hitRoll = Math.random() * 100;
  if (hitRoll >= preview.hitRate) {
    return { damage: 0, hit: false, crit: false };
  }
  const critRoll = Math.random() * 100;
  const crit = critRoll < preview.critRate;
  const damage = crit
    ? Math.max(1, Math.floor(preview.damage * CRIT_MULTIPLIER))
    : preview.damage;
  return { damage, hit: true, crit };
}
