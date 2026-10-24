import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { L, T, baseLang, getLang, isZh, loadLang, setLang } from '../../src/td/i18n';
import { toHans } from '../../src/td/hans';
import { JA } from '../../src/td/ja';
import { skillLevelText } from '../../src/td/data/skillFx';

const require = createRequire(import.meta.url);

test('簡體中文由繁體轉換：字形與台灣用語都換掉', () => {
  assert.equal(toHans('王國防線'), '王国防线');
  assert.equal(toHans('設定'), '设置');
  assert.equal(toHans('隱私權政策'), '隐私政策');
  assert.equal(toHans('獅鷲騎手從天而降'), '狮鹫骑手从天而降');
  // 英數與標點不動
  assert.equal(toHans('Lv.3 第 2 波！'), 'Lv.3 第 2 波！');
});

test('zhs 走繁體字串轉換；語音與介面判斷當中文', () => {
  const prev = getLang();
  try {
    setLang('zhs');
    assert.equal(L({ zh: '開始遊戲', en: 'Start' }), '开始游戏');
    assert.equal(T('settings'), '设置');
    assert.equal(isZh(), true);
    assert.equal(baseLang(), 'zh');
    setLang('en');
    assert.equal(L({ zh: '開始遊戲', en: 'Start' }), 'Start');
    assert.equal(isZh(), false);
    // 舊存檔或亂填的語言值退回繁體
    setLang('xx' as never);
    assert.equal(getLang(), 'zh');
  } finally {
    setLang(prev);
  }
});

test('日文：查翻譯表，沒翻到的退回英文，執行時組的句子自己帶 ja；語音用英文', async () => {
  const prev = getLang();
  try {
    await loadLang('ja');
    setLang('ja');
    assert.equal(T('settings'), '設定');
    assert.equal(L({ zh: '開始遊戲', en: 'Play' }), JA['開始遊戲']);
    assert.equal(L({ zh: '沒有這句', en: 'Not here' }), 'Not here');
    assert.equal(L({ zh: '沒有這句', en: 'Not here', ja: 'ここ' }), 'ここ');
    assert.match(L(skillLevelText('poison', 1)), /毒ダメージ/);
    assert.equal(isZh(), false);
    assert.equal(baseLang(), 'en');
  } finally {
    setLang(prev);
  }
});

test('日文翻譯表涵蓋程式裡每一句，佔位符與換行都對得上', () => {
  const { list, dynamic } = require('../../scripts/i18n/extract.cjs') as { list: { zh: string; file: string }[]; dynamic: string[] };
  const missing = list.filter((s) => !(s.zh in JA)).map((s) => `${s.file}: ${s.zh}`);
  assert.deepEqual(missing, [], '還沒翻成日文的句子（加到 src/td/ja.ts）');
  assert.deepEqual(dynamic, [], '帶 ${…} 的句子要在原處寫 ja');
  const holes = (x: string) => (x.match(/\{\w+\}/g) ?? []).sort().join();
  for (const [zh, ja] of Object.entries(JA)) {
    assert.ok(ja.trim(), `空白翻譯：${zh}`);
    assert.equal(holes(ja), holes(zh), `佔位符不一致：${zh}`);
    assert.equal(ja.split('\n').length, zh.split('\n').length, `換行數不一致：${zh}`);
  }
  // 翻譯表裡沒有用不到的舊句子
  const used = new Set(list.map((s) => s.zh));
  assert.deepEqual(Object.keys(JA).filter((k) => !used.has(k)), [], '程式裡已經沒有的句子（從 ja.ts 刪掉）');
});
