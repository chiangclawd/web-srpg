// 羈絆對（Wave 6 / G6）。
// 定義「特定武將對」——當兩人相鄰時，攻擊獲得 BOND_ATK_MUL 加成（見 balance.ts）。
// 鼓勵把有故事關聯的角色擺在一起，呼應 DESIGN.md「留下一段故事」的情感目標。
//
// 內容延伸（後續，需寫對白）：每對可再掛「支援對話」綁進劇情（火紋風 C/B/A）。
// 本檔只負責「戰鬥羈絆」的對位定義；對白屬 cutscenes 內容工作。
export interface Bond {
  a: string; // commander id
  b: string; // commander id
  name: string; // 羈絆名（顯示在預判 / log）
}

export const BONDS: Bond[] = [
  { a: 'arthur', b: 'gary', name: '君臣之誼' },
  { a: 'arthur', b: 'rosa', name: '並肩之約' },
  { a: 'rosa', b: 'elena', name: '神射姊妹' },
  { a: 'sharon', b: 'lila', name: '法米爾師徒' },
  { a: 'rain', b: 'aria', name: '天地疾風' },
  { a: 'gary', b: 'viktor', name: '不破之盾' },
];

/** 兩個 commander id 是否互為羈絆夥伴；是則回傳該羈絆，否則 null（無序比對）。 */
export function findBond(idA: string, idB: string): Bond | null {
  for (const b of BONDS) {
    if ((b.a === idA && b.b === idB) || (b.a === idB && b.b === idA)) return b;
  }
  return null;
}
