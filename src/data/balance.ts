// 集中戰鬥調參（Wave 2 / G2）。
// 這裡是所有「平衡數值」的單一來源 —— 調這個檔＝調整全域戰鬥手感。
// 改完用 `npm run balance` 跑無頭模擬器，對照 BALANCE_TARGETS 驗收對位是否失衡。
//
// 為什麼集中：原本 crit / DEF 曲線散在 DamageCalculator、相剋矩陣在 CounterSystem、
// 經驗曲線在 Leveling，調平衡要翻三個檔。集中後一目了然、也能被模擬器直接 import。
import type { UnitTypeId } from '../types';

// ===== 傷害公式 =====
/** 爆擊傷害倍率。爆擊率本身偏低（5–12%），故 2.0 倍不會讓運氣主導戰局。 */
export const CRIT_MULTIPLIER = 2.0;
/** 每點 DEF 抵免的傷害比例（乘法減傷）。 */
export const DEF_REDUCTION_PER_POINT = 0.05;
/** DEF 減傷上限（避免高 DEF BOSS 完全無敵）。 */
export const DEF_REDUCTION_CAP = 0.7;

// ===== 兵種相剋 =====
/** 四檔相剋倍率（收斂自 2026-04 audit Wave 4：強剋/小優勢/普通/劣勢）。 */
export const COUNTER_TIERS = {
  STRONG: 1.5, // 強剋（通常對稱：A→B 1.5 則 B→A 0.7）
  EDGE: 1.3, // 小優勢（可不對稱，留 nuance）
  NEUTRAL: 1.0,
  WEAK: 0.7, // 劣勢
} as const;

type CounterRow = Partial<Record<UnitTypeId, number>>;
const S = COUNTER_TIERS.STRONG;
const E = COUNTER_TIERS.EDGE;
const W = COUNTER_TIERS.WEAK;

// 相剋矩陣：COUNTER_MATRIX[attacker][defender] = 傷害倍率（缺項 = 1.0 普通）。
// 結構性身分（射程/移動不在矩陣內）：
//   sword 貼身爆發剋 mage、被 lance/flier 壓
//   lance 反騎兵+反劍的盾牆，怕 mage/flier/archer
//   cavalry 高速突擊屠射手與法師，怕 lance
//   archer 狙飛兵、能戳 lance，怕 cavalry
//   mage 破甲+制空，怕劍士貼身
//   flier 俯衝劍士，怕弓兵
export const COUNTER_MATRIX: Record<UnitTypeId, CounterRow> = {
  sword: { lance: W, mage: E, flier: W },
  lance: { sword: E, cavalry: S, archer: W, mage: W, flier: W },
  cavalry: { lance: W, archer: S, mage: E },
  archer: { lance: E, cavalry: W, flier: S },
  mage: { sword: W, lance: S, flier: E },
  flier: { sword: E, archer: W },
};

// ===== 經驗 / 等級 =====
export const EXP_PER_LEVEL = 50;
export const EXP_PER_DAMAGE = 1;
export const EXP_PER_KILL = 5;
export const MAX_LEVEL = 20;
/** 等級差經驗縮放：1 + (victim - killer) * SLOPE，clamp 在 [MIN, MAX]。 */
export const LEVEL_DIFF = { SLOPE: 0.1, MIN: 0.3, MAX: 2.0 } as const;

// ===== 平衡目標指標（模擬器驗收基準）=====
// 註：相剋設計「故意」製造強弱對位，所以單一對位高勝率是預期的；
// 真正要守的是「整體公平」——沒有兵種壓制全體、也沒有被全體壓制。
export const BALANCE_TARGETS = {
  /** 每兵種對全體的平均勝率下限（低於＝被整體壓制，太弱）。 */
  TYPE_MEAN_MIN: 0.4,
  /** 每兵種對全體的平均勝率上限（高於＝壓制整體，太強）。 */
  TYPE_MEAN_MAX: 0.6,
  /** 單一對位勝率超過此值 → 標記「可能過於一邊倒」供人工檢視。 */
  SWING_FLAG: 0.9,
} as const;
