export const EXP_PER_LEVEL = 20;
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
