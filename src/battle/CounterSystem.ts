import type { UnitTypeId } from '../types';

// 相剋係數矩陣：COUNTER_MATRIX[attacker][defender] = damage multiplier
//
// 設計原則（2026-04 audit Wave 4 重整）：
// 1. 收斂到四檔 0.7 / 1.0 / 1.3 / 1.5，0.85 / 0.9 / 1.2 / 1.8 全砍
// 2. 每個兵種至少 1 個攻擊面優勢 + 1 個劣勢，沒有「全進攻」或「全只能被打」
// 3. ×1.5 對稱（A→B 1.5、B→A 0.7）；×1.3 可不對稱讓 nuance 進來
// 4. lance 有 5 個 entry → 是「剋制輪的錨點」，懂得選對地方就強
//    archer 結構性遠程已是優勢，矩陣不再用 ×1.8 雙重補償
//
// 結構性身分速查（不算結構性的射程/移動只看矩陣）：
//   sword   貼近爆發 mage、被 lance/flier 剋
//   lance   反騎兵 + 反劍士的盾牆，怕 mage / flier / archer
//   cavalry 屠射手與法師的高速突擊，怕 lance
//   archer  狙擊 flier、能戳 lance，怕 cavalry
//   mage    破甲 + 制空，怕劍士貼身
//   flier   俯衝劍士，怕弓兵
type CounterRow = Partial<Record<UnitTypeId, number>>;

const COUNTER_MATRIX: Record<UnitTypeId, CounterRow> = {
  sword:   { lance: 0.7, mage: 1.3, flier: 0.7 },
  lance:   { sword: 1.3, cavalry: 1.5, archer: 0.7, mage: 0.7, flier: 0.7 },
  cavalry: { lance: 0.7, archer: 1.5, mage: 1.3 },
  archer:  { lance: 1.3, cavalry: 0.7, flier: 1.5 },
  mage:    { sword: 0.7, lance: 1.5, flier: 1.3 },
  flier:   { sword: 1.3, archer: 0.7 },
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
