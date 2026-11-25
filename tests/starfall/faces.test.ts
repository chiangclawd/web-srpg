// 立繪的表情差分：劇本裡標的表情都有圖，圖跟平常那一張一樣大、輪廓一樣（換表情時身體才不會跳），
// 遊戲這邊的清單和生成用的清單（scripts/art/prompts/starfall/faces.json）一致。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { FACES, SPEAKERS, STORY, portraitKey } from '../../src/starfall/data/story';
import type { Speaker } from '../../src/starfall/data/story';

const ASSETS = 'public/assets/starfall';
const pairs = (Object.entries(FACES) as [Speaker, readonly string[]][]).flatMap(([who, faces]) => faces.map((face) => ({ who, face })));

test('表情：劇本裡標的表情，那個角色都有', () => {
  for (const [id, lines] of Object.entries(STORY)) {
    for (const l of lines) {
      if (!l.face) continue;
      assert.ok(FACES[l.who]?.includes(l.face), `${id}：${l.who} 沒有「${l.face}」這個表情`);
      assert.equal(portraitKey(l), `${SPEAKERS[l.who].portrait}_${l.face}`);
    }
  }
});

test('表情：每個表情都有用到（沒用到的圖只是白佔下載量）', () => {
  const used = new Set(Object.values(STORY).flatMap((lines) => lines.filter((l) => l.face).map((l) => `${l.who}:${l.face}`)));
  for (const { who, face } of pairs) assert.ok(used.has(`${who}:${face}`), `${who}:${face} 沒有任何一句用到`);
});

test('表情：圖都在，跟平常那一張一樣大、輪廓一樣', async () => {
  assert.equal(pairs.length, 19);
  for (const { who, face } of pairs) {
    const base = `${ASSETS}/${SPEAKERS[who].portrait}.webp`;
    const file = `${ASSETS}/${SPEAKERS[who].portrait}_${face}.webp`;
    assert.ok(fs.existsSync(file), `缺 ${file}`);
    const [a, b] = await Promise.all([base, file].map((f) => sharp(f).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })));
    assert.deepEqual([b.info.width, b.info.height], [a.info.width, a.info.height], `${file} 的大小跟原圖不一樣`);
    assert.ok(a.data.equals(b.data), `${file} 的輪廓（透明度）跟原圖不一樣`);
    assert.ok(fs.statSync(file).size < 120_000, `${file} 太大`);
  }
});

test('表情：臉真的換了，身體沒有動', async () => {
  const spec = JSON.parse(fs.readFileSync('scripts/art/prompts/starfall/faces.json', 'utf8')) as Record<string, { face: number[] }>;
  for (const { who, face } of pairs) {
    const load = (f: string) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const [a, b] = await Promise.all([load(`${ASSETS}/pt_${who}.webp`), load(`${ASSETS}/pt_${who}_${face}.webp`)]);
    const { width: w, height: h } = a.info;
    const [x0, y0, x1, y1] = spec[who].face;
    let inFace = 0;
    let outFace = 0;
    let outCount = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (a.data[i + 3] < 250) continue;
        const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
        // 臉部範圍是 faces.json 的橢圓
        const ex = (x / w - (x0 + x1) / 2) / ((x1 - x0) / 2);
        const ey = (y / h - (y0 + y1) / 2) / ((y1 - y0) / 2);
        if (ex * ex + ey * ey <= 1) {
          if (d > 90) inFace++;
        } else {
          outCount++;
          if (d > 90) outFace++;
        }
      }
    }
    assert.ok(inFace > 150, `${who}:${face} 的臉幾乎沒變（${inFace} 個像素）`);
    // 橢圓外面只剩重新壓縮的誤差
    assert.ok(outFace / outCount < 0.002, `${who}:${face} 臉以外的地方也變了（${((outFace / outCount) * 100).toFixed(2)}%）`);
  }
});

test('表情：遊戲的清單和生成用的清單一致', () => {
  const spec = JSON.parse(fs.readFileSync('scripts/art/prompts/starfall/faces.json', 'utf8')) as Record<string, { faces: Record<string, string> }>;
  assert.deepEqual(
    Object.fromEntries(Object.entries(spec).map(([who, s]) => [who, Object.keys(s.faces)])),
    Object.fromEntries(Object.entries(FACES).map(([who, f]) => [who, [...(f ?? [])]])),
  );
});

test('表情：沒有那個表情、或沒有立繪的人，退回平常的樣子', () => {
  assert.equal(portraitKey({ who: 'kai' }), 'pt_kai');
  assert.equal(portraitKey({ who: 'kai', face: 'smile' }), 'pt_kai_smile');
  assert.equal(portraitKey({ who: 'kai', face: 'nope' }), 'pt_kai');
  assert.equal(portraitKey({ who: 'cantor', face: 'smile' }), 'pt_cantor');
  assert.equal(portraitKey({ who: 'chorus' }), 'pt_cantor');
  assert.equal(portraitKey({ who: 'sys', face: 'smile' }), undefined);
});
