// 等級曲線重新調整（2026-04 audit 第二輪）
// 舊（30 / 10）讓 1 kill ≈ 0.5 lv，11 章打完衝過 lv 20 cap。
// 新（50 / 5）讓 1 kill ≈ 0.3 lv，加上 level-diff scaling，11 章末約 lv 19。
export const EXP_PER_LEVEL = 50;
export const EXP_PER_DAMAGE = 1;
export const EXP_PER_KILL = 5;
export const MAX_LEVEL = 20;

/**
 * 等級差異縮放：殺手等級 vs 被殺者等級。
 *   差越大（殺手過高）→ 經驗縮減（防止過度練功）
 *   差越小或負（殺手低）→ 經驗增加（生存獎勵，幫助低等武將追上）
 *
 * 公式：1 + (victim - killer) × 0.1，clamp 在 [0.3, 2.0]
 *   lv 5 殺 lv 5: 1.0
 *   lv 10 殺 lv 5: 0.5（過度練功懲罰）
 *   lv 5 殺 lv 10: 1.5（追等加速）
 *   lv 5 殺 lv 20: 2.0（cap，超低等大殺四方）
 */
export function scaleByLevelDiff(killerLv: number, victimLv: number): number {
  const diff = victimLv - killerLv;
  return Math.max(0.3, Math.min(2.0, 1 + diff * 0.1));
}

export interface LevelUpDelta {
  fromLevel: number;
  toLevel: number;
  hpGain: number;
  attackGain: number;
  defenseGain: number;
}
