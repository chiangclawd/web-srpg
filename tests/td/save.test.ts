import { test } from 'node:test';
import assert from 'node:assert/strict';

// save.ts 讀寫 localStorage：測試時用記憶體版本代替
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

const KEY = 'kb_td_save_v1';
const { loadSave, save, persist, resetProgress, totalStars } = await import('../../src/td/save');

test('an old save without newer fields loads with defaults', () => {
  store.set(KEY, JSON.stringify({ version: 1, stars: { l1: 3, l2: 2 }, settings: { lang: 'en', music: 0 }, heroes: { arthur: { xp: 500 } } }));
  const d = loadSave();
  assert.deepEqual(d.stars, { l1: 3, l2: 2 });
  assert.equal(d.settings.lang, 'en');
  assert.equal(d.settings.music, 0);
  assert.equal(d.settings.shake, true);
  assert.equal(d.settings.quality, 'auto');
  assert.deepEqual(d.tipsSeen, []);
  assert.deepEqual(d.endless, {});
  assert.deepEqual(d.storySeen, []);
  assert.equal(d.heroes.arthur.xp, 500);
  assert.equal(d.heroes.aria.xp, 0, 'heroes added later get a default entry');
});

test('corrupt save data falls back to defaults', () => {
  store.set(KEY, '{not json');
  const d = loadSave();
  assert.deepEqual(d.stars, {});
});

test('total stars include challenge stars', () => {
  store.set(KEY, JSON.stringify({ stars: { l1: 3, l2: 1 }, challenges: { l1: { heroic: true, iron: true }, l2: { heroic: true } } }));
  loadSave();
  assert.equal(totalStars(), 7);
});

test('total stars include boss rush stars', () => {
  store.set(KEY, JSON.stringify({ stars: { l1: 3 }, bossrush: { l1: 3, l4: 2 } }));
  loadSave();
  assert.equal(totalStars(), 8);
});

test('reset progress keeps settings and persists', () => {
  store.set(KEY, JSON.stringify({ stars: { l1: 3 }, settings: { lang: 'en', shake: false } }));
  loadSave();
  resetProgress();
  assert.deepEqual(save().stars, {});
  assert.equal(save().settings.lang, 'en');
  assert.equal(save().settings.shake, false);
  assert.deepEqual(JSON.parse(store.get(KEY)!).stars, {});
  save().stars.l3 = 2;
  persist();
  assert.equal(JSON.parse(store.get(KEY)!).stars.l3, 2);
});

const { exportSave, importSave } = await import('../../src/td/save');

test('a backup code round-trips progress, including non-ASCII text', () => {
  store.set(KEY, JSON.stringify({ stars: { l1: 3, l5: 2 }, gems: 77, endless: { l2: 18 }, settings: { lang: 'zh' } }));
  loadSave();
  const code = exportSave();
  assert.ok(code.startsWith('KB1:'));
  store.set(KEY, JSON.stringify({ stars: {} }));
  loadSave();
  assert.deepEqual(save().stars, {});
  // 貼上時常夾帶換行或空白
  assert.equal(importSave(`  ${code.slice(0, 20)}\n${code.slice(20)} `), true);
  assert.deepEqual(save().stars, { l1: 3, l5: 2 });
  assert.equal(save().gems, 77);
  assert.equal(save().endless.l2, 18);
  assert.deepEqual(JSON.parse(store.get(KEY)!).stars, { l1: 3, l5: 2 }, 'imported data is persisted');
});

test('invalid backup codes are rejected without touching the save', () => {
  store.set(KEY, JSON.stringify({ stars: { l1: 1 } }));
  loadSave();
  for (const bad of ['', 'hello', 'KB1:', 'KB1:!!!notbase64', 'KB1:' + btoa('{"no":"stars"}'), 'KB2:' + btoa('{"stars":{}}')]) {
    assert.equal(importSave(bad), false, `rejects ${bad}`);
  }
  assert.deepEqual(save().stars, { l1: 1 });
});
