// Gemini 圖片生成：讀參考圖 + 提示詞 → 存原圖。金鑰由環境的網路密鑰自動附加（x-goog-api-key），程式裡不放金鑰。
// 用法：node scripts/art/gemini-image.mjs <out.png> <prompt-file> [ref1.png ref2.png ...]
// 注意：Node 內建 fetch 預設不走 HTTPS_PROXY，要用 NODE_USE_ENV_PROXY=1 執行，金鑰才會被代理附加。
// 環境變數：GEMINI_IMAGE_MODEL（預設 gemini-2.5-flash-image）、GEMINI_ASPECT（如 16:9）、GEMINI_SIZE（1K/2K/4K，gemini-3 系列）、ART_LEDGER（花費紀錄檔）
import fs from 'node:fs';
import path from 'node:path';

const [out, promptFile, ...refs] = process.argv.slice(2);
if (!out || !promptFile) {
  console.error('usage: gemini-image.mjs <out.png> <prompt-file> [refs...]');
  process.exit(2);
}
const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
const prompt = fs.readFileSync(promptFile, 'utf8');
const parts = [{ text: prompt }];
for (const r of refs) parts.push({ inline_data: { mime_type: 'image/png', data: fs.readFileSync(r).toString('base64') } });

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: process.env.GEMINI_ASPECT ?? '1:1', ...(process.env.GEMINI_SIZE ? { imageSize: process.env.GEMINI_SIZE } : {}) },
    },
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error('HTTP', res.status, JSON.stringify(body.error ?? body).slice(0, 600));
  process.exit(1);
}
const img = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
if (!img) {
  console.error('no image in response', JSON.stringify(body).slice(0, 600));
  process.exit(1);
}
const data = (img.inlineData ?? img.inline_data).data;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(data, 'base64'));
const u = body.usageMetadata ?? {};
const line = { t: new Date().toISOString(), model, out: path.basename(out), prompt: u.promptTokenCount, output: u.candidatesTokenCount, total: u.totalTokenCount };
if (process.env.ART_LEDGER) fs.appendFileSync(process.env.ART_LEDGER, JSON.stringify(line) + '\n');
console.log(JSON.stringify(line));
