/**
 * 用 Gemini TTS 產生英雄語音。
 *   NODE_USE_ENV_PROXY=1 node scripts/art/gemini-tts.mjs <out.mp3> <voice> <text> [style]
 * 回傳 24kHz PCM，交給 ffmpeg 去頭尾靜音、轉成 48 kbps 單聲道 MP3。
 * 環境變數：GEMINI_TTS_MODEL（預設 gemini-2.5-flash-preview-tts）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [out, voice, text, style] = process.argv.slice(2);
if (!out || !voice || !text) {
  console.error('usage: gemini-tts.mjs <out.mp3> <voice> <text> [style]');
  process.exit(2);
}
const model = process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts';
const prompt = style ? `${style}: ${text}` : text;

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  }),
});
const raw = await res.text();
let body;
try {
  body = JSON.parse(raw);
} catch {
  console.error('HTTP', res.status, raw.slice(0, 300));
  process.exit(1);
}
if (!res.ok) {
  console.error('HTTP', res.status, JSON.stringify(body.error ?? body).slice(0, 600));
  process.exit(1);
}
const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData ?? p.inline_data);
if (!part) {
  console.error('no audio', JSON.stringify(body).slice(0, 600));
  process.exit(1);
}
const inline = part.inlineData ?? part.inline_data;
const mime = inline.mimeType ?? inline.mime_type;
const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
// 舊模型回傳裸 PCM（audio/L16），新模型回傳 WAV（有檔頭，ffmpeg 自己讀）
const isWav = /wav/.test(mime);
const pcm = path.join(os.tmpdir(), `tts_${process.pid}.${isWav ? 'wav' : 'pcm'}`);
fs.writeFileSync(pcm, Buffer.from(inline.data, 'base64'));
const input = isWav ? ['-i', pcm] : ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', pcm];
fs.mkdirSync(path.dirname(out), { recursive: true });
// 去頭尾靜音，留 60ms 呼吸
const trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=60,apad=pad_dur=0.06,loudnorm=I=-16:TP=-1.5';
execFileSync('ffmpeg', ['-v', 'error', '-y', ...input, '-af', trim, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', out]);
fs.unlinkSync(pcm);
const u = body.usageMetadata ?? {};
console.log(JSON.stringify({ model, out: path.basename(out), mime, output: u.candidatesTokenCount }));
