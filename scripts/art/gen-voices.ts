/**
 * 依 src/td/data/voices.ts 產生全部英雄語音與首領台詞：
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/art/gen-voices.ts [英雄或首領...]
 * 已存在的檔案略過（要重做就先刪掉）。輸出到 public/assets/audio/voice/。
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BOSS_VOICES, HERO_VOICES, VOICE_LINES, voiceText } from '../../src/td/data/voices';

const only = process.argv.slice(2);
interface Job {
  out: string;
  voice: string;
  style: string;
  text: string;
  lang: 'zh' | 'en';
}
const jobs: Job[] = [];
for (const [hero, v] of Object.entries(HERO_VOICES)) {
  if (only.length && !only.includes(hero)) continue;
  for (const line of VOICE_LINES) {
    for (const lang of ['zh', 'en'] as const) {
      const text = voiceText(hero, line)?.[lang];
      if (text) jobs.push({ out: `public/assets/audio/voice/${hero}_${line}_${lang}.mp3`, voice: v.voice, style: v.style, text, lang });
    }
  }
}
for (const [boss, v] of Object.entries(BOSS_VOICES)) {
  if (only.length && !only.includes(boss)) continue;
  for (const lang of ['zh', 'en'] as const) jobs.push({ out: `public/assets/audio/voice/boss_${boss}_${lang}.mp3`, voice: v.voice, style: v.style, text: v.line[lang], lang });
}
for (const { out, voice, style: baseStyle, text, lang } of jobs) {
  if (existsSync(out)) continue;
  // 中文短句用喊的容易咬字不清，特別要求字正腔圓
  const style = lang === 'zh' ? `${baseStyle}, speaking clear Taiwanese Mandarin with crisp, careful articulation of every syllable` : baseStyle;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      execFileSync('node', ['scripts/art/gemini-tts.mjs', out, voice, text, style], { stdio: ['ignore', 'inherit', 'pipe'] });
      break;
    } catch (e) {
      const msg = String((e as { stderr?: Buffer }).stderr ?? e);
      console.error(`${out}: ${msg.split('\n').find((l) => l.includes('HTTP')) ?? msg.slice(0, 200)}`);
      // 速率限制：等一下再試
      execFileSync('sleep', [String(10 * (attempt + 1))]);
    }
  }
}
