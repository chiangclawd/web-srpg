import type { Faction, UnitTypeId } from '../types';
import { getCounter } from './CounterSystem';
import { SKILL_EFFECTS } from '../data/skillEffects';

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
  defenderHpRatio?: number;
  /** 難度倍率（敵方攻擊額外乘）：休閒 0.7、普通 1.0、困難 1.3 */
  enemyAttackMul?: number;
}

export interface DamageResult {
  damage: number;
  counterMultiplier: number;
  counterLabel: '優勢' | '劣勢' | '普通';
  /** 哪些特技參與了計算（用於 tooltip 顯示） */
  appliedSkills: string[];
}

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

  let dmg = raw - totalDef;

  // 防守方承受特技（乘在扣完防後）
  const dSkill = ctx.defenderSkillId ? SKILL_EFFECTS[ctx.defenderSkillId] : undefined;
  if (dSkill?.incomingMul) {
    const mul = dSkill.incomingMul(ctx);
    if (mul !== 1.0) {
      dmg *= mul;
      appliedSkills.push(`守方特技 ×${mul.toFixed(2)}`);
    }
  }

  dmg = Math.max(1, Math.floor(dmg));
  return {
    damage: dmg,
    counterMultiplier: counter.multiplier,
    counterLabel: counter.label,
    appliedSkills,
  };
}
