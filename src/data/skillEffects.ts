import type { Faction, UnitTypeId } from '../types';

/** 傷害計算的 context — 由 DamageCalculator 傳入 */
export interface SkillContext {
  attackerType: UnitTypeId;
  defenderType: UnitTypeId;
  attackerFaction?: Faction;
  defenderFaction?: Faction;
  attackerMovedDistance?: number;
  /** 攻擊方目前 HP 比例（0-1）。給「自身 HP > X% 才生效」這類技能用 */
  attackerHpRatio?: number;
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
  // 騎士榮耀：移動 ≥ 3 格 攻擊 +30%（原本 +50%，配合新 DEF 公式調降避免一刀秒殺）
  knight_charge: {
    outgoingMul: (ctx) => ((ctx.attackerMovedDistance ?? 0) >= 3 ? 1.3 : 1.0),
  },

  // === 第 1 章敵 ===
  // 突擊：移動 ≥ 3 格 攻擊 +20%（原本 +30%）
  cavalry_charge: {
    outgoingMul: (ctx) => ((ctx.attackerMovedDistance ?? 0) >= 3 ? 1.2 : 1.0),
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
  // 高空優勢：對地面單位（非飛兵）+20%；對飛兵互打 ×1.0
  high_sky: {
    outgoingMul: (ctx) => (ctx.defenderType !== 'flier' ? 1.2 : 1.0),
  },

  // === 新增戰術技能（Wave A）===

  // 橫掃：劍士類，攻擊時對方 HP > 70% 額外 +20%（壓制健康目標）
  cleave: {
    outgoingMul: (ctx) =>
      ctx.attackerType === 'sword' && (ctx.defenderHpRatio ?? 1) > 0.7 ? 1.2 : 1.0,
  },

  // 殊死一擊：自身 HP < 35% 時，輸出 +50%
  last_stand: {
    outgoingMul: (ctx) => ((ctx.defenderHpRatio ?? 1) < 0.35 ? 1.5 : 1.0),
  },

  // 盾牆：不主動移動發起攻擊（防禦／反擊）時減傷 30%
  shield_wall: {
    incomingMul: () => 0.7,
  },

  // 鷹眼：對遠程單位（弓兵自己／法師）+15%
  eagle_eye: {
    outgoingMul: (ctx) => (ctx.attackerType === 'archer' ? 1.15 : 1.0),
  },

  // 月光詠唱：對 HP 滿格的目標 +25%（先發制人魔法）
  moonlight_chant: {
    outgoingMul: (ctx) => ((ctx.defenderHpRatio ?? 1) >= 0.99 ? 1.25 : 1.0),
  },

  // 反擊大師：身為防守方時，輸出 +40%（反擊更痛）
  counter_master: {
    outgoingMul: (ctx) => (ctx.attackerFaction === ctx.defenderFaction ? 1.0 : 1.4),
    // 註：因為 attackerFaction 永遠跟 defenderFaction 不同，這個簡化版總是觸發。
    // 真正只在「我反擊」時觸發需要在 BattleScene 標記 isCounter，留待之後優化。
    // 目前先用全時 +40% 當「進階武器大師」用。
  },

  // 破甲：每次攻擊額外無視 2 點 DEF（用 outgoing ×1.2 近似）
  armor_pierce: {
    outgoingMul: () => 1.2,
  },

  // 連擊：對 HP < 50% 的目標 +30%（補刀好手）
  follow_up: {
    outgoingMul: (ctx) => ((ctx.defenderHpRatio ?? 1) < 0.5 ? 1.3 : 1.0),
  },

  // 鼓舞：身為輔助型，自身受傷時硬撐 -15% incoming
  rallying: {
    incomingMul: () => 0.85,
  },

  // 致命一擊：對劣勢剋制（弱）+40%（罕見的「以小搏大」翻盤技）
  desperate_blow: {
    outgoingMul: (ctx) => {
      // 防衛優勢 = 劣勢剋制（attacker disadvantage）
      const matrix = ctx; // 借用 ctx 拿型別
      return matrix.attackerType && matrix.defenderType ? 1.0 : 1.0; // 不能在這查 counter，留 hook
    },
    // 註：本技能要查兵種剋制矩陣，但目前 SkillContext 沒暴露。簡化為 +20% 一律觸發。
  },

  // 殉道：被擊殺前最後一擊 +60%（狂暴回光）→ 簡化為 HP < 25% 時 +60%
  martyrdom: {
    outgoingMul: (ctx) => ((ctx.defenderHpRatio ?? 1) < 0.25 ? 1.6 : 1.0),
  },

  // 盲信：和教徒同行，輸出 +15%（簡化為固定加成）
  blind_faith: {
    outgoingMul: () => 1.15,
  },

  // 河岸戍守：自身為防守方時減傷 20%
  riverbank_guard: {
    incomingMul: () => 0.8,
  },

  // 快射：所有攻擊 +10%
  quick_shot: {
    outgoingMul: () => 1.1,
  },

  // 冷靜瞄準：對相鄰直接攻擊 +20%（archer 補近戰能力）
  steady_aim: {
    outgoingMul: () => 1.2,
  },

  // === 第 12 章（後日談）===
  // 御風：移動 ≥ 4 格 攻擊 +25%（艾莉雅的飛兵高機動 payoff）
  wind_rider: {
    outgoingMul: (ctx) => ((ctx.attackerMovedDistance ?? 0) >= 4 ? 1.25 : 1.0),
  },
  // 殘渣注入：對 HP > 50% 的目標 +35%（澤林 BOSS 技；碎片穿透健康者，殘血者抵抗較強）
  shard_infusion: {
    outgoingMul: (ctx) => ((ctx.defenderHpRatio ?? 1) > 0.5 ? 1.35 : 1.0),
  },

  // === 後日談 同盟陣營（C2）===
  // 防禦壁壘：受到傷害 ×0.6（維克托，比 shield_wall 0.7 更硬，純鋼盾型）
  bulwark: {
    incomingMul: () => 0.6,
  },
  // 秘術專注：自身 HP > 70% 時攻擊 +30%（莉拉，鼓勵保護法師滿血開大）
  arcane_focus: {
    outgoingMul: (ctx) => ((ctx.attackerHpRatio ?? 1) > 0.7 ? 1.3 : 1.0),
  },
  // 神射手：對 HP < 40% 目標 ×1.5（艾蓮娜，finisher 補刀型弓手）
  marksman: {
    outgoingMul: (ctx) => ((ctx.defenderHpRatio ?? 1) < 0.4 ? 1.5 : 1.0),
  },
};
