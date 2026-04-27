import type { UnitTypeId } from '../types';

// 相剋係數矩陣：COUNTER_MATRIX[attacker][defender] = damage multiplier
type CounterRow = Partial<Record<UnitTypeId, number>>;

const COUNTER_MATRIX: Record<UnitTypeId, CounterRow> = {
  sword: { mage: 1.3, flier: 0.7 },
  lance: { cavalry: 1.5, sword: 0.9, flier: 0.7 },
  cavalry: { archer: 1.5, lance: 0.7, flier: 0.7 },
  archer: { lance: 1.3, cavalry: 0.7, mage: 1.2, flier: 1.8 },
  mage: { sword: 0.7, flier: 1.0 },
  flier: { archer: 0.6 }, // 飛兵被弓兵剋制
};

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
