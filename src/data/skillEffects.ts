import type { Faction, UnitTypeId } from '../types';

/** 傷害計算的 context — 由 DamageCalculator 傳入 */
export interface SkillContext {
  attackerType: UnitTypeId;
  defenderType: UnitTypeId;
  attackerFaction?: Faction;
  defenderFaction?: Faction;
  attackerMovedDistance?: number;
  defenderHpRatio?: number;
}

export interface SkillEffect {
  /** 自身為攻擊方時，乘到輸出傷害的倍數 */
  outgoingMul?(ctx: SkillContext): number;
  /** 自身為防守方時，乘到承受傷害的倍數 */
  incomingMul?(ctx: SkillContext): number;
}

export const SKILL_EFFECTS: Record<string, SkillEffect> = {
  // === 玩家 ===
  // 王者意志：HP < 50% 時，受到傷害 -30%
  kings_will: {
    incomingMul: (ctx) => ((ctx.defenderHpRatio ?? 1) < 0.5 ? 0.7 : 1.0),
  },
  // 神射：攻擊 +25%
  sharp_shooter: {
    outgoingMul: () => 1.25,
  },
  // 不動如山：受到傷害 -10%
  unmoving: {
    incomingMul: () => 0.9,
  },
  // 法米爾秘術：攻擊 +30%
  fameel_arcana: {
    outgoingMul: () => 1.3,
  },
  // 騎士榮耀：移動 ≥ 3 格 攻擊 +50%
  knight_charge: {
    outgoingMul: (ctx) => ((ctx.attackerMovedDistance ?? 0) >= 3 ? 1.5 : 1.0),
  },

  // === 第 1 章敵 ===
  // 突擊：移動 ≥ 3 格 攻擊 +30%
  cavalry_charge: {
    outgoingMul: (ctx) => ((ctx.attackerMovedDistance ?? 0) >= 3 ? 1.3 : 1.0),
  },
  // 冰錐：攻擊 +15%
  ice_cone: {
    outgoingMul: () => 1.15,
  },

  // === 第 2 章敵 ===
  // 槍陣：對騎兵 +30%
  spear_formation: {
    outgoingMul: (ctx) => (ctx.defenderType === 'cavalry' ? 1.3 : 1.0),
  },
  // 冷箭：攻擊 +20%
  cold_arrow: {
    outgoingMul: () => 1.2,
  },

  // === 第 3 章 BOSS ===
  // 王國終結者：對玩家 +20%
  king_terminator: {
    outgoingMul: (ctx) => (ctx.defenderFaction === 'player' ? 1.2 : 1.0),
  },

  // === 第 5 章 BOSS ===
  // 城牆破壞者：攻擊 +15%
  wall_breaker: {
    outgoingMul: () => 1.15,
  },

  // === 第 6 章 BOSS ===
  // 無聲一刀：攻擊 +40%
  silent_blade: {
    outgoingMul: () => 1.4,
  },

  // === 第 7 章 BOSS ===
  // 邪神禱詞：攻擊 +30%
  dark_prayer: {
    outgoingMul: () => 1.3,
  },

  // === 第 8 章最終 BOSS ===
  // 虛空斬：攻擊 +50%
  void_slash: {
    outgoingMul: () => 1.5,
  },

  // === 飛兵 ===
  // 高空優勢：暫無實效（保留位置）
};
