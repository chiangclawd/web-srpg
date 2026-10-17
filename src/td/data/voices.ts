import type { L10n } from '../sim/defs';
import { HERO_BARKS } from './barks';

/**
 * 英雄語音（Gemini TTS 預先產生，檔案在 assets/audio/voice/<英雄>_<台詞>_<語言>.mp3）：
 *   select — 在英雄室選定、每關第一波開戰時
 *   move0 / move1 — 移動英雄時，和對話泡泡同一句（HERO_BARKS）
 *   ult — 施放絕招
 */
export type VoiceLine = 'select' | 'move0' | 'move1' | 'ult';
export const VOICE_LINES: VoiceLine[] = ['select', 'move0', 'move1', 'ult'];

export interface HeroVoice {
  /** Gemini TTS 內建聲線 */
  voice: string;
  /** 語氣說明（英文，放在台詞前給 TTS 參考） */
  style: string;
  select: L10n;
  ult: L10n;
}

export const HERO_VOICES: Record<string, HeroVoice> = {
  arthur: {
    voice: 'Alnilam',
    style: 'Say it like a noble, confident young knight rallying his troops',
    select: { zh: '為了王國！', en: 'For the kingdom!' },
    ult: { zh: '聖騎士，隨我出陣！', en: 'Royal Guard, to my side!' },
  },
  elena: {
    voice: 'Kore',
    style: 'Say it like a calm, focused forest ranger drawing her bow',
    select: { zh: '森林與我同在。', en: 'The forest is with me.' },
    ult: { zh: '萬箭齊發！', en: 'Arrow storm!' },
  },
  lila: {
    voice: 'Despina',
    style: 'Say it like a cool, aloof frost sorceress, slightly playful',
    select: { zh: '冰雪聽我號令。', en: 'Ice answers to me.' },
    ult: { zh: '絕對零度！', en: 'Absolute zero!' },
  },
  rain: {
    voice: 'Fenrir',
    style: 'Say it like an energetic, brash young cavalry lancer',
    select: { zh: '上馬，出發！', en: 'Saddle up!' },
    ult: { zh: '鐵騎，突擊！', en: 'Cavalry, charge!' },
  },
  aria: {
    voice: 'Zephyr',
    style: 'Say it like a spirited, daring young woman who rides a griffin into battle',
    select: { zh: '準備好了，起飛！', en: 'Ready for takeoff!' },
    ult: { zh: '雷霆審判！', en: 'Thunder, judge them!' },
  },
  sharon: {
    voice: 'Sulafat',
    style: 'Say it like a gentle, warm and serene priestess',
    select: { zh: '願光明守護你們。', en: 'May the light protect you.' },
    ult: { zh: '聖典啊，降下審判！', en: 'Scripture, pass judgment!' },
  },
  viktor: {
    voice: 'Algenib',
    style: 'Say it like a gruff, battle-hardened veteran commander',
    select: { zh: '老兵維克托，前來報到。', en: 'Veteran reporting.' },
    ult: { zh: '長槍兵，結成槍陣！', en: 'Spears, form the wall!' },
  },
  shadow: {
    voice: 'Enceladus',
    style: 'Say it quietly, like a cold, whispering assassin',
    select: { zh: '我一直都在。', en: "I'm here." },
    ult: { zh: '你們已經結束了。', en: "You're already finished." },
  },
};

/** 某句台詞的文字（move 取自對話泡泡，確保聲音與泡泡一致） */
export function voiceText(hero: string, line: VoiceLine): L10n | undefined {
  const v = HERO_VOICES[hero];
  if (!v) return undefined;
  if (line === 'select') return v.select;
  if (line === 'ult') return v.ult;
  return HERO_BARKS[hero]?.[line === 'move0' ? 0 : 1];
}
