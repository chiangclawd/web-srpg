/**
 * 用 Gemini Lyria 產生配樂（Interactions API 背景模式，輪詢到完成為止）。
 *   NODE_USE_ENV_PROXY=1 node scripts/art/gemini-music.mjs <out.mp3> <prompt-file>
 * 環境變數：GEMINI_MUSIC_MODEL（預設 lyria-3.5，約 3 分鐘；lyria-3-clip-preview 為 30 秒）、
 *           ART_LEDGER（花費紀錄）。
 * 長時間生成走背景模式，避免一般請求在等待中被中途切斷。
 * 金鑰由執行環境提供，不寫進程式或儲存庫。
 */
import fs from 'node:fs';
import path from 'node:path';

const [out, promptFile] = process.argv.slice(2);
if (!out || !promptFile) {
  console.error('usage: gemini-music.mjs <out.mp3> <prompt-file>');
  process.exit(2);
}
const model = process.env.GEMINI_MUSIC_MODEL ?? 'lyria-3.5';
const prompt = fs.readFileSync(promptFile, 'utf8');
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';

async function call(url, init) {
  const res = await fetch(url, init);
  const raw = await res.text();
  try {
    return { res, body: JSON.parse(raw) };
  } catch {
    return { res, body: { error: raw.slice(0, 300) } };
  }
}

const start = await call(API, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model, input: prompt, background: true, response_modalities: ['audio'] }),
});
if (!start.res.ok || !start.body.id) {
  console.error('HTTP', start.res.status, JSON.stringify(start.body.error ?? start.body).slice(0, 600));
  process.exit(1);
}
const id = start.body.id;
let done = null;
for (let i = 0; i < 60 && !done; i++) {
  await new Promise((r) => setTimeout(r, 6000));
  const { res, body } = await call(`${API}/${id}`);
  if (res.ok && body.status && body.status !== 'in_progress') done = body;
}
if (!done) {
  console.error('timed out waiting for', id);
  process.exit(1);
}
if (done.status !== 'completed') {
  console.error(done.status, JSON.stringify(done.errors ?? done).slice(0, 600));
  process.exit(1);
}
const audio = (done.steps ?? []).flatMap((s) => s.content ?? []).find((c) => c.type === 'audio' && c.data);
if (!audio) {
  console.error('no audio in response', JSON.stringify(done).slice(0, 600));
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(audio.data, 'base64'));
const u = done.usage ?? {};
const line = { t: new Date().toISOString(), model, out: path.basename(out), mime: audio.mime_type, input: u.total_input_tokens, output: u.total_output_tokens };
if (process.env.ART_LEDGER) fs.appendFileSync(process.env.ART_LEDGER, JSON.stringify(line) + '\n');
console.log(JSON.stringify(line));
