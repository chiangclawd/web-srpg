import type { UnitTypeId } from '../types';
import { COUNTER_MATRIX } from '../data/balance';

// 相剋矩陣已移至單一調參來源 `data/balance.ts`（見 COUNTER_MATRIX / COUNTER_TIERS）。
// 此檔只保留查詢邏輯；要調平衡請改 balance.ts。

export interface CounterInfo {
  multiplier: number;
  label: '優勢' | '劣勢' | '普通';
}

export function getCounter(attacker: UnitTypeId, defender: UnitTypeId): CounterInfo {
  const mult = COUNTER_MATRIX[attacker][defender] ?? 1.0;
  let label: CounterInfo['label'] = '普通';
  if (mult > 1.05) label = '優勢';
  else if (mult < 0.95) label = '劣勢';
  return { multiplier: mult, label };
}
