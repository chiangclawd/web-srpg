// 經驗 / 等級曲線常數已移至單一調參來源 data/balance.ts。
// 此處重新匯出以維持既有 import 路徑（Unit.ts / BattleScene.ts 仍 import 自此檔）。
import { LEVEL_DIFF } from '../data/balance';
export {
  EXP_PER_LEVEL,
  EXP_PER_DAMAGE,
  EXP_PER_KILL,
  MAX_LEVEL,
} from '../data/balance';

/**
 * 等級差異縮放：殺手等級 vs 被殺者等級。
 *   差越大（殺手過高）→ 經驗縮減（防止過度練功）
 *   差越小或負（殺手低）→ 經驗增加（生存獎勵，幫助低等武將追上）
 *
 * 公式：1 + (victim - killer) × SLOPE，clamp 在 [MIN, MAX]（參數見 balance.ts）
 *   lv 5 殺 lv 5: 1.0 ／ lv 10 殺 lv 5: 0.5 ／ lv 5 殺 lv 10: 1.5 ／ lv 5 殺 lv 20: 2.0(cap)
 */
export function scaleByLevelDiff(killerLv: number, victimLv: number): number {
  const diff = victimLv - killerLv;
  return Math.max(LEVEL_DIFF.MIN, Math.min(LEVEL_DIFF.MAX, 1 + diff * LEVEL_DIFF.SLOPE));
}

export interface LevelUpDelta {
  fromLevel: number;
  toLevel: number;
  hpGain: number;
  attackGain: number;
  defenseGain: number;
}
