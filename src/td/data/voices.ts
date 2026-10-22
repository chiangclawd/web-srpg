import type { L10n } from '../sim/defs';
import { BRANCH_BARKS, HERO_BARKS, TOWER_BARKS } from './barks';

/**
 * 英雄語音（Gemini TTS 預先產生，檔案在 assets/audio/voice/<英雄>_<台詞>_<語言>.mp3）：
 *   select — 在英雄室選定、每關第一波開戰時
 *   move0 / move1 — 移動英雄時，和對話泡泡同一句（HERO_BARKS）
 *   ult — 施放絕招
 * 首領登場時也會喊一句（BOSS_VOICES）。
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

/** 首領登場台詞（檔案 boss_<首領>_<語言>.mp3）；沙暴巨蟲是野獸，不說話 */
export const BOSS_VOICES: Record<string, { voice: string; style: string; line: L10n }> = {
  morden: { voice: 'Orus', style: 'Roar it like a brutal barbarian warlord', line: { zh: '小小王國，給我踏平！', en: 'Trample this puny kingdom!' } },
  selene: { voice: 'Autonoe', style: 'cold, elegant young woman, a frost witch, softly menacing', line: { zh: '在冰雪中沉睡吧。', en: 'Sleep forever in the snow.' } },
  carl: { voice: 'Schedar', style: 'Say it like a bitter, menacing fallen general', line: { zh: '王國早就背棄了我！', en: 'The kingdom betrayed me first!' } },
  frost_giant: { voice: 'Umbriel', style: 'Say it slowly with a deep, booming voice, like an enormous giant', line: { zh: '渺小的人類，滾開！', en: 'Out of my way, tiny humans!' } },
  fire_lord: { voice: 'Algieba', style: 'Say it like a menacing demon lord of fire', line: { zh: '一切都將化為灰燼！', en: 'Everything will burn to ash!' } },
  high_priest: { voice: 'Rasalgethi', style: 'Say it like a sinister, raspy high priest of a dark cult', line: { zh: '亡者們，起來吧！', en: 'Rise, my dead!' } },
  sub_priest: { voice: 'Erinome', style: 'Say it like a cold, calm and eerie young woman', line: { zh: '你們的塔，我收下了。', en: 'Your towers are mine now.' } },
  cult_leader: { voice: 'Charon', style: 'Say it calmly and menacingly, like a dark lord', line: { zh: '黑暗終將吞噬一切。', en: 'Darkness will swallow everything.' } },
  // 鏡淵篇的殘影重複本尊說過的話（沿用同一段錄音）
  echo_giant: { voice: 'Umbriel', style: 'Say it slowly with a deep, booming voice, like an enormous giant', line: { zh: '渺小的人類，滾開！', en: 'Out of my way, tiny humans!' } },
  echo_umbra: { voice: 'Charon', style: 'Say it calmly and menacingly, like a dark lord', line: { zh: '黑暗終將吞噬一切。', en: 'Darkness will swallow everything.' } },
};

/**
 * 防禦塔台詞配音（與對話泡泡同一句）：鍵值是塔種或第 4 級特化的塔圖，
 * 檔案 tower_<鍵值>_<第幾句>_<語言>.mp3
 */
/** 已配音的語言（中文每句都用轉寫比對過；太短或被語音模型擋下的句子改寫得長一點） */
export const TOWER_VOICE_LANGS: readonly string[] = ['en', 'zh'];

export const TOWER_VOICES: Record<string, { voice: string; style: string }> = {
  archer: { voice: 'Puck', style: 'eager young archer, upbeat' },
  barracks: { voice: 'Sadachbia', style: 'lively, loyal foot soldier' },
  mage: { voice: 'Sadaltager', style: 'wise, slightly smug wizard' },
  artillery: { voice: 'Zubenelgenubi', style: 'cheerful, gruff cannoneer' },
  tw_archer_ranger: { voice: 'Achird', style: 'calm, friendly forest ranger' },
  tw_archer_marksman: { voice: 'Iapetus', style: 'cool, focused sharpshooter' },
  tw_barracks_paladin: { voice: 'Alnilam', style: 'noble, devout holy knight' },
  tw_barracks_barbarian: { voice: 'Algenib', style: 'wild, roaring barbarian warrior' },
  tw_mage_arcane: { voice: 'Vindemiatrix', style: 'serene, mysterious sorceress' },
  tw_mage_elemental: { voice: 'Laomedeia', style: 'energetic elementalist calling on nature' },
  tw_art_bertha: { voice: 'Umbriel', style: 'deep, gleeful heavy gunner' },
  tw_art_tesla: { voice: 'Fenrir', style: 'excited, slightly mad inventor' },
};

/** 全部防禦塔配音：鍵值、第幾句、台詞 */
export function towerVoiceLines(): { key: string; i: number; text: L10n }[] {
  const out: { key: string; i: number; text: L10n }[] = [];
  for (const key of Object.keys(TOWER_VOICES)) {
    const lines = (TOWER_BARKS as Record<string, L10n[]>)[key] ?? BRANCH_BARKS[key] ?? [];
    lines.forEach((text, i) => out.push({ key, i, text }));
  }
  return out;
}

/** 某句台詞的文字（move 取自對話泡泡，確保聲音與泡泡一致） */
export function voiceText(hero: string, line: VoiceLine): L10n | undefined {
  const v = HERO_VOICES[hero];
  if (!v) return undefined;
  if (line === 'select') return v.select;
  if (line === 'ult') return v.ult;
  return HERO_BARKS[hero]?.[line === 'move0' ? 0 : 1];
}
