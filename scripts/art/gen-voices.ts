/**
 * 依 src/td/data/voices.ts 產生全部英雄語音：
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/art/gen-voices.ts [英雄...]
 * 已存在的檔案略過（要重做就先刪掉）。輸出到 public/assets/audio/voice/。
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { HERO_VOICES, VOICE_LINES, voiceText } from '../../src/td/data/voices';

const only = process.argv.slice(2);
for (const [hero, v] of Object.entries(HERO_VOICES)) {
  if (only.length && !only.includes(hero)) continue;
  for (const line of VOICE_LINES) {
    for (const lang of ['zh', 'en'] as const) {
      const text = voiceText(hero, line)?.[lang];
      const out = `public/assets/audio/voice/${hero}_${line}_${lang}.mp3`;
      if (!text || existsSync(out)) continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          // 中文短句用喊的容易咬字不清，特別要求字正腔圓
          const style = lang === 'zh' ? `${v.style}, speaking clear Taiwanese Mandarin with crisp, careful articulation of every syllable` : v.style;
          execFileSync('node', ['scripts/art/gemini-tts.mjs', out, v.voice, text, style], { stdio: ['ignore', 'inherit', 'pipe'] });
          break;
        } catch (e) {
          const msg = String((e as { stderr?: Buffer }).stderr ?? e);
          console.error(`${out}: ${msg.split('\n').find((l) => l.includes('HTTP')) ?? msg.slice(0, 200)}`);
          // 速率限制：等一下再試
          execFileSync('sleep', [String(10 * (attempt + 1))]);
        }
      }
    }
  }
}
