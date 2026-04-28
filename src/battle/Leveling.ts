// EXP_PER_LEVEL 20 → 30：原本 1 kill (10) + ~10 dmg ≈ 1 level，玩家武將
// 容易 4-5 場就 lv10+，跟普通兵差距越拉越大。30 讓 1 kill ≈ 0.5-0.7 level，
// 升級節奏更接近章節數而非戰鬥次數。
export const EXP_PER_LEVEL = 30;
export const EXP_PER_DAMAGE = 1;
export const EXP_PER_KILL = 10;
export const MAX_LEVEL = 20;

export interface LevelUpDelta {
  fromLevel: number;
  toLevel: number;
  hpGain: number;
  attackGain: number;
  defenseGain: number;
}
