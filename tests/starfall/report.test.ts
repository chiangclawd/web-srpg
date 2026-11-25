// 回報問題：報告的內容、錯誤紀錄和表單網址（src/starfall/report.ts）。
// 畫面上的流程（設定頁進得去、複製、重新整理之後錯誤還在）由 scripts/starfall-check.cjs 的 report 那一段檢查。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { FEEDBACK } from '../../src/starfall/feedback-config';
import { MAX_ERRORS, URL_LIMIT, cleanErrors, formatReport, pushError, reportUrl } from '../../src/starfall/report';
import type { ErrorNote, Facts } from '../../src/starfall/report';

const T0 = Date.UTC(2026, 10, 25, 8, 15, 2);
const facts = (over: Partial<Facts> = {}): Facts => ({
  version: '0.1.0',
  sha: 'c5b1a34',
  built: '2026-11-25 06:12',
  now: T0,
  scene: 'SfBattle+SfHud m7 turn 3 challenge',
  lang: 'zh',
  textScale: 1.15,
  fast: true,
  cutIn: false,
  easy: false,
  colorBlind: true,
  sfx: 0.6,
  music: 0,
  view: 'window 844x390@3, canvas 1558x720, screen 390x844',
  mode: 'installed',
  ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  touch: 5,
  cores: 6,
  memory: null,
  renderer: 'webgl Apple GPU',
  maxTexture: 16384,
  fps: { now: 58, min: 31, span: 30 },
  offline: 'ready',
  cloud: 'synced',
  progress: '9/12 cleared, 24 stars, slot 1',
  errors: [],
  ...over,
});
const err = (i: number, msg = `TypeError: thing ${i} is undefined @ assets/starfall-abc.js:1:${i}`): ErrorNote => ({ t: T0 - (10 - i) * 1000, build: 'c5b1a34', msg });

test('報告：版本、畫面、設定、裝置、更新率、進度都在，一行一項', () => {
  const lines = formatReport(facts()).split('\n');
  assert.equal(lines[0], 'Starfall Echo 0.1.0 c5b1a34 (built 2026-11-25 06:12 UTC)');
  assert.equal(lines[1], 'time: 2026-11-25T08:15:02Z');
  assert.equal(lines[2], 'scene: SfBattle+SfHud m7 turn 3 challenge');
  assert.equal(lines[3], 'settings: lang zh, text 1.15, fast, cut-in off, normal, colour-blind on, sfx 0.6, music 0');
  assert.equal(lines[4], 'view: window 844x390@3, canvas 1558x720, screen 390x844, installed');
  assert.match(lines[5], /^device: Mozilla\/5\.0 \(iPhone/);
  assert.equal(lines[6], 'platform: iPhone, touch 5, cores 6, memory ? GB');
  assert.equal(lines[7], 'gpu: webgl Apple GPU, max texture 16384');
  assert.equal(lines[8], 'fps: 58 (lowest 31 in the last 30 s)');
  assert.equal(lines[9], 'offline: ready, cloud: synced');
  assert.equal(lines[10], 'progress: 9/12 cleared, 24 stars, slot 1');
  assert.equal(lines[11], 'errors: none');
  assert.equal(lines.length, 12);
});

test('報告：有錯誤時一筆一行，帶時間和當時的版本；還沒量到更新率就寫問號', () => {
  const text = formatReport(facts({ errors: [err(1), { ...err(2), build: 'oldbuild' }], fps: null }));
  assert.match(text, /\nfps: \?\n/);
  assert.match(text, /\nerrors:\n- 2026-11-25T08:14:53Z \[c5b1a34\] TypeError: thing 1 is undefined @ assets\/starfall-abc\.js:1:1\n- 2026-11-25T08:14:54Z \[oldbuild\] TypeError: thing 2/);
});

test('報告整段只有英文和數字：放進網址才不會太長，遊戲裡的字型也一定顯示得出來', () => {
  const text = formatReport(facts({ errors: [err(1)] }));
  assert.match(text, /^[\x20-\x7e\n]+$/);
});

test('報告裡沒有帳號：蒐集的程式不碰名字、信箱和帳號代碼', () => {
  const src = fs.readFileSync('src/starfall/report-env.ts', 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /user\??\.(name|email|uid|photo)/i);
  // 存檔內容也不放：只有過了幾關、幾顆星
  assert.doesNotMatch(src, /upgrades|tips\b|JSON\.stringify\(sv/);
});

test('錯誤紀錄：最多留最近五筆；同一個錯連續出現只留一筆；訊息去掉網址的前半段、壓成一行、截短', () => {
  let list: ErrorNote[] = [];
  for (let i = 1; i <= 7; i++) list = pushError(list, err(i));
  assert.equal(list.length, MAX_ERRORS);
  assert.match(list[0].msg, /thing 3 /);
  assert.match(list[4].msg, /thing 7 /);
  // 每一格畫面都丟同一個錯
  for (let i = 0; i < 50; i++) list = pushError(list, err(7));
  assert.equal(list.length, MAX_ERRORS);
  assert.match(list[0].msg, /thing 3 /, '前面的不能被洗掉');
  const one = pushError([], { t: T0, build: 'b', msg: `  Boom\n   at https://chiangclawd.github.io/web-srpg/assets/starfall-abc.js:1:99  ${'x'.repeat(400)}` });
  assert.match(one[0].msg, /^Boom at web-srpg\/assets\/starfall-abc\.js:1:99 x+$/);
  assert.equal(one[0].msg.length, 180);
  assert.deepEqual(pushError([], { t: T0, build: 'b', msg: '   ' }), []);
});

test('從裝置讀回來的錯誤紀錄：壞掉的、形狀不對的都丟掉', () => {
  assert.deepEqual(cleanErrors(null), []);
  assert.deepEqual(cleanErrors({ t: 1 }), []);
  assert.deepEqual(cleanErrors([err(1), 'x', { t: 'yesterday', build: 'b', msg: 'm' }, { t: 2, build: 'b' }, null]), [err(1)]);
  assert.equal(cleanErrors(Array.from({ length: 9 }, (_, i) => err(i))).length, MAX_ERRORS);
});

const FORM = { form: 'https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform', entry: '1234567890' };

test('表單網址：診斷資訊預先填在指定的那一題，解開來跟報告一字不差', () => {
  const f = facts({ errors: [err(1)] });
  const url = reportUrl(f, FORM);
  assert.ok(url);
  assert.ok(url.startsWith('https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform?usp=pp_url&entry.1234567890='));
  assert.equal(new URL(url).searchParams.get('entry.1234567890'), formatReport(f));
});

test('表單還沒設定、或設定的不是 Google 表單：沒有網址（遊戲裡只給複製）', () => {
  assert.equal(reportUrl(facts(), { form: '', entry: '' }), null);
  assert.equal(reportUrl(facts(), { form: FORM.form, entry: '' }), null);
  assert.equal(reportUrl(facts(), { form: FORM.form, entry: 'entry.123' }), null);
  assert.equal(reportUrl(facts(), { form: 'https://example.com/forms/d/e/x/viewform', entry: '123' }), null);
  assert.equal(reportUrl(facts(), { form: `${FORM.form}?usp=sf_link`, entry: '123' }), null, '填寫網址不要帶問號後面那一段');
});

test('表單網址不會超過上限：先從最舊的錯誤開始拿掉，並註明拿掉了幾筆', () => {
  // 瀏覽器的錯誤訊息可能是中文，中文在網址裡一個字佔九個字元
  const long = (i: number): ErrorNote => err(i, `Error ${i}: ${'錯'.repeat(170)}`);
  const f = facts({ errors: [long(1), long(2), long(3), long(4), long(5)] });
  const url = reportUrl(f, FORM);
  assert.ok(url && url.length <= URL_LIMIT);
  const text = new URL(url).searchParams.get('entry.1234567890') ?? '';
  const kept = text.split('\n').filter((l) => l.startsWith('- '));
  assert.ok(kept.length >= 1 && kept.length < 5);
  assert.match(kept[kept.length - 1], /Error 5:/, '最新的那一筆要留著');
  assert.match(text, new RegExp(`errors \\(${5 - kept.length} older left out\\):`));
  // 連裝置名稱都長到放不下：硬切，但還是合法的網址、開頭還在
  const huge = reportUrl(facts({ ua: 'x y '.repeat(3000), errors: [long(1)] }), FORM);
  assert.ok(huge && huge.length <= URL_LIMIT);
  assert.match(new URL(huge).searchParams.get('entry.1234567890') ?? '', /^Starfall Echo 0\.1\.0 c5b1a34/);
});

test('專案裡的表單設定：要嘛兩個都空著，要嘛是一組能用的', () => {
  if (!FEEDBACK.form && !FEEDBACK.entry) return;
  assert.ok(reportUrl(facts(), FEEDBACK), 'form 要是 https://docs.google.com/forms/…/viewform（不帶問號後面那一段），entry 要是純數字');
});
