// CI 把瀏覽器檢查拆成幾個平行的工作（.github/workflows/phone-check.yml 的 matrix），
// 一個工作跑 scripts/starfall-check.cjs 裡 PARTS 的一份。兩邊對不上的話，會有一份檢查永遠沒人跑，而且不會有任何錯誤。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MISSIONS } from '../../src/starfall/data/missions';

const script = readFileSync('scripts/starfall-check.cjs', 'utf8');
const workflow = readFileSync('.github/workflows/phone-check.yml', 'utf8');

/** PARTS = { 名稱: [段落, …], … } */
function parts(): Record<string, string[]> {
  const body = /const PARTS = \{([\s\S]*?)\n\};/.exec(script)?.[1];
  assert.ok(body, '找不到 PARTS');
  const out: Record<string, string[]> = {};
  for (const m of body.matchAll(/^\s*'?([\w-]+)'?:\s*\[([^\]]*)\]/gm)) out[m[1]] = [...m[2].matchAll(/'([\w-]+)'/g)].map((x) => x[1]);
  return out;
}

test('CI 的每個工作對得上檢查腳本的一份，沒有哪一份沒人跑', () => {
  const matrix = /part:\s*\[([^\]]+)\]/.exec(workflow)?.[1].split(',').map((s) => s.trim());
  assert.ok(matrix, '找不到 matrix 的 part');
  assert.deepEqual([...matrix].sort(), Object.keys(parts()).sort());
  assert.match(workflow, /PART: \$\{\{ matrix\.part \}\}/);
});

test('每一個任務的自動對戰都排進了其中一份', () => {
  const all = Object.values(parts()).flat();
  for (const m of MISSIONS) assert.equal(all.filter((k) => k === m.id).length, 1, `${m.id} 要剛好出現一次`);
  assert.equal(new Set(all).size, all.length, '同一段不能排進兩份');
});
