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
