// 各章的地塊圖集：那個主題的關卡用到的地形，圖集裡都要有，而且花樣數跟共用的那一套一樣。
// 少了的話遊戲會退回共用的圖，同一張地圖上兩套混在一起。改了關卡的地形或主題之後這裡會先發現。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MISSIONS } from '../../src/starfall/data/missions';
import { TERRAIN_CHARS } from '../../src/starfall/sim/terrain';

const frames = (file: string): Set<string> => new Set(Object.keys((JSON.parse(readFileSync(`public/assets/starfall/${file}.json`, 'utf8')) as { frames: Record<string, unknown> }).frames));
const count = (set: Set<string>, id: string): number => [...set].filter((k) => k.startsWith(`tile_${id}_`)).length;
const base = frames('tiles');

test('各章的地塊圖集收齊了那個主題的關卡用到的地形', () => {
  for (const theme of ['bay', 'reactor', 'field']) {
    const own = frames(`tiles_${theme}`);
    const used = new Set<string>();
    for (const m of MISSIONS) if (m.theme === theme) for (const row of m.tiles) for (const ch of row) used.add(TERRAIN_CHARS[ch]);
    used.delete('chasm');
    assert.ok(used.size > 0, `${theme} 沒有關卡在用`);
    for (const id of used) assert.equal(count(own, id), count(base, id), `${theme} 的圖集裡 ${id} 的花樣數不對`);
  }
});

test('冰面上的殘骸跟一般的殘骸花樣數一樣', () => {
  const field = frames('tiles_field');
  assert.equal(count(field, 'rubbleice'), count(field, 'rubble'));
});
