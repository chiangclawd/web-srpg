import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, T, baseLang, getLang, isZh, setLang } from '../../src/td/i18n';
import { toHans } from '../../src/td/hans';

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
