/**
 * 請 Gemini 試聽一段音訊並回報（是否有人聲、曲風、樂器、瑕疵、能否循環）。
 *   NODE_USE_ENV_PROXY=1 node scripts/art/gemini-listen.mjs <audio.mp3> [額外問題]
 * 環境變數：GEMINI_LISTEN_MODEL（預設 gemini-2.5-flash）。
 */
import fs from 'node:fs';

const [file, extra] = process.argv.slice(2);
if (!file) {
  console.error('usage: gemini-listen.mjs <audio.mp3> [question]');
  process.exit(2);
}
const model = process.env.GEMINI_LISTEN_MODEL ?? 'gemini-2.5-flash';
const ask = `You are reviewing background music for a fantasy tower defense video game. Listen to the whole file and answer in compact JSON with keys:
vocals (true if any singing, lyrics, spoken words or choir syllables are audible), vocals_detail, genre, instruments (array), mood, tempo_bpm (estimate),
energy_curve (how intensity changes over time, with timestamps), issues (array: glitches, clipping, abrupt cuts, silence gaps, out-of-tune parts, timestamps),
ending (how the last 10 seconds end), loop_friendly (true/false), fits_game_battle (1-10), summary (one sentence).${extra ? '\nAlso answer: ' + extra : ''}`;

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'audio/mpeg', data: fs.readFileSync(file).toString('base64') } }, { text: ask }] }],
    generationConfig: { responseMimeType: 'application/json' },
  }),
});
const raw = await res.text();
if (!res.ok) {
  console.error('HTTP', res.status, raw.slice(0, 400));
  process.exit(1);
}
const body = JSON.parse(raw);
console.log(body.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? raw.slice(0, 400));
