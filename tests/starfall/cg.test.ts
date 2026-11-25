// 全螢幕插圖和各章的配樂：
// - 劇本上標的插圖都有圖、大小一致，跟生成用的清單（scripts/art/prompts/starfall/cg.json）對得上；
// - 只在幾句話之間出現的插圖會收掉（立繪才回得來）；按「跳過」只在結局圖停下來；
// - 每一關播哪一首戰鬥曲、曲子的檔案都在。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { SHIP } from '../../scripts/art/starfall-cg.mjs';
import { TRACKS } from '../../scripts/art/starfall-music.mjs';
import { CG_FOCUS, STORY, cgAt, cgKeys, closingCg } from '../../src/starfall/data/story';
import type { Line } from '../../src/starfall/data/story';
import { MISSIONS, battleTrack } from '../../src/starfall/data/missions';

const ASSETS = 'public/assets/starfall';
const say = (cg?: string): Line => ({ who: 'sys', zh: '。', en: '.', ...(cg === undefined ? {} : { cg }) });
const used = [...new Set(Object.values(STORY).flatMap((lines) => cgKeys(lines)))];

test('插圖：cgAt 看最近一次標的那一句，空字串是收掉', () => {
  const lines = [say(), say('a'), say(), say(''), say(), say('b')];
  assert.deepEqual(
    lines.map((_, i) => cgAt(lines, i)),
    ['', 'a', 'a', '', '', 'b'],
  );
  assert.equal(cgAt(lines, 99), 'b');
  assert.equal(cgAt([], 0), '');
  assert.deepEqual(cgKeys(lines), ['a', 'b']);
});

test('插圖：按「跳過」只在留到最後的插圖停下來', () => {
  // 中途出現、後來收掉的不用停
  assert.equal(closingCg([say(), say('a'), say(''), say()], 0), -1);
  // 留到最後的：還沒播到就跳到那一句，播過了就直接結束
  const end = [say(), say('a'), say(''), say('b'), say()];
  assert.equal(closingCg(end, 0), 3);
  assert.equal(closingCg(end, 2), 3);
  assert.equal(closingCg(end, 3), -1);
  assert.equal(closingCg(end, 4), -1);
  assert.equal(closingCg([], 0), -1);
});

test('插圖：整份劇本只有結局會讓「跳過」停下來，其餘的插圖都有收掉', () => {
  for (const [id, lines] of Object.entries(STORY)) {
    const stop = closingCg(lines, -1);
    if (id === 'm9_outro') assert.equal(lines[stop].cg, 'cg_ending');
    else assert.equal(stop, -1, `${id} 的插圖沒有收掉，會一路蓋到這段對話結束`);
    // 空字串只能出現在有插圖的時候
    lines.forEach((l, i) => {
      if (l.cg === '') assert.ok(i > 0 && cgAt(lines, i - 1), `${id} 第 ${i + 1} 句收掉插圖，但那時候畫面上沒有插圖`);
    });
  }
});

test('插圖：劇本用到的跟生成清單一致，每一張只用在一個地方', () => {
  const spec = Object.keys(JSON.parse(fs.readFileSync('scripts/art/prompts/starfall/cg.json', 'utf8'))).map((n) => `cg_${n}`);
  assert.deepEqual([...used].sort(), [...spec, 'cg_ending'].sort());
  for (const key of used) {
    const where = Object.entries(STORY).filter(([, lines]) => lines.some((l) => l.cg === key));
    assert.equal(where.length, 1, `${key} 用在 ${where.map(([id]) => id).join('、')}`);
    assert.ok(fs.existsSync(`scripts/art/prompts/starfall/${key}.txt`), `${key} 沒有提示詞`);
  }
});

test('插圖：寬螢幕上要留哪一段，寫的都是用得到的圖', () => {
  for (const [key, focus] of Object.entries(CG_FOCUS)) {
    assert.ok(used.includes(key), `${key} 不是劇本用到的插圖`);
    assert.ok(focus >= 0 && focus <= 1, `${key} 的值要在 0 到 1 之間`);
  }
});

test('插圖：圖都在，大小跟主視覺一樣', async () => {
  assert.equal(used.length, 9);
  for (const key of used) {
    const file = `${ASSETS}/${key}.webp`;
    assert.ok(fs.existsSync(file), `缺 ${file}`);
    const meta = await sharp(file).metadata();
    assert.deepEqual([meta.width, meta.height], [SHIP.w, SHIP.h], `${key} 的大小`);
    assert.ok(fs.statSync(file).size < 400 * 1024, `${key} 超過 400 KB`);
  }
});

test('配樂：每一關平常播哪一首', () => {
  const by = Object.fromEntries(MISSIONS.map((m) => [m.id, battleTrack(m)]));
  assert.deepEqual(by, {
    m1: 'battle',
    m2: 'battle',
    m3: 'battle',
    m4: 'ch2',
    m5: 'ch2',
    m6: 'ch2',
    m7: 'ch3',
    m8: 'ch3',
    m9: 'rollcall',
    m10: 'ch4',
    m11: 'ch4',
    m12: 'ch4',
  });
  // 沒寫章節的任務（測試用的地圖）退回第一章的那一首
  assert.equal(battleTrack({}), 'battle');
});

test('配樂：曲子的檔案都在，生成清單裡的每一首都有用到', () => {
  const played = new Set<string>([...MISSIONS.map((m) => battleTrack(m)), 'title', 'boss', 'ending']);
  for (const t of played) assert.ok(fs.existsSync(`${ASSETS}/music/${t}.mp3`), `缺 music/${t}.mp3`);
  for (const t of TRACKS) assert.ok(played.has(t), `${t} 沒有任何一關用到`);
  const files = fs.readdirSync(`${ASSETS}/music`).map((f) => f.replace(/\.mp3$/, ''));
  for (const f of files) assert.ok(played.has(f), `music/${f}.mp3 沒有用到，只是白佔下載量`);
});
