import type { L10n, TowerType } from '../sim/defs';

/**
 * 單位台詞（Kingdom Rush 式的小對白）：蓋塔、點塔、升級、移動英雄時偶爾冒出對話泡泡。
 * 第 4 級特化有自己的台詞（以塔圖鍵值查），其餘依塔種。
 */
export const TOWER_BARKS: Record<TowerType, L10n[]> = {
  archer: [
    { zh: '弓已上弦！', en: 'Arrows ready!' },
    { zh: '百步穿楊！', en: 'Never miss!' },
    { zh: '瞄準……放！', en: 'Aim… loose!' },
  ],
  barracks: [
    { zh: '為了王國！', en: 'For the kingdom!' },
    { zh: '一個都別想過！', en: 'None shall pass!' },
    { zh: '整隊！', en: 'Fall in!' },
  ],
  mage: [
    { zh: '魔力充盈。', en: 'The arcane flows.' },
    { zh: '小心燙手。', en: 'Mind the sparks.' },
    { zh: '知識就是力量！', en: 'Knowledge is power!' },
  ],
  artillery: [
    { zh: '裝填完畢！', en: 'Loaded!' },
    { zh: '轟他個天翻地覆！', en: "Let's make some noise!" },
    { zh: '火藥管夠！', en: 'Plenty of powder!' },
  ],
};

export const BRANCH_BARKS: Record<string, L10n[]> = {
  tw_archer_ranger: [
    { zh: '森林與我同在。', en: 'The forest guides me.' },
    { zh: '藤蔓會絆住他們。', en: 'The vines will hold them.' },
  ],
  tw_archer_marksman: [
    { zh: '一發入魂。', en: 'One shot, one kill.' },
    { zh: '目標鎖定。', en: 'Target acquired.' },
  ],
  tw_barracks_paladin: [
    { zh: '聖光庇佑！', en: 'The light protects!' },
    { zh: '舉盾！', en: 'Shields up!' },
  ],
  tw_barracks_barbarian: [
    { zh: '斧頭餓了！', en: 'My axe is thirsty!' },
    { zh: '吼——！', en: 'RAAAH!' },
  ],
  tw_mage_arcane: [
    { zh: '時空皆在掌中。', en: 'Time and space obey.' },
    { zh: '消失吧。', en: 'Begone.' },
  ],
  tw_mage_elemental: [
    { zh: '元素聽我號令！', en: 'Elements, heed me!' },
    { zh: '大地，醒來吧！', en: 'Earth, awaken!' },
  ],
  tw_art_bertha: [
    { zh: '大傢伙要開火了！', en: "Big Bertha's hungry!" },
    { zh: '捂住耳朵！', en: 'Cover your ears!' },
  ],
  tw_art_tesla: [
    { zh: '電力全開！', en: 'Full power!' },
    { zh: '滋滋滋……', en: 'Bzzzt…' },
  ],
};

/** 移動英雄時的台詞 */
export const HERO_BARKS: Record<string, L10n[]> = {
  arthur: [
    { zh: '大家跟我上！', en: 'Follow me!' },
    { zh: '守住防線！', en: 'Hold the line!' },
  ],
  elena: [
    { zh: '我看到他們了。', en: 'I see them.' },
    { zh: '風向正好。', en: 'The wind is right.' },
  ],
  lila: [
    { zh: '冷靜點。', en: 'Stay cool.' },
    { zh: '全部凍起來。', en: 'Freeze them all.' },
  ],
  rain: [
    { zh: '衝鋒！', en: 'Charge!' },
    { zh: '馬蹄就是號角！', en: 'Hooves are my war horn!' },
  ],
  aria: [
    { zh: '這片天空是我的！', en: 'The sky is mine!' },
    { zh: '雷霆就要來了！', en: "Thunder's coming." },
  ],
  sharon: [
    { zh: '聖典指引我。', en: 'The scripture guides me.' },
    { zh: '我會撐住大家。', en: "I'll keep you standing." },
  ],
  viktor: [
    { zh: '一步也不准退！', en: 'Not one step back!' },
    { zh: '方陣，向前推進！', en: 'Phalanx, advance!' },
  ],
  shadow: [
    { zh: '影子不會說話。', en: "Shadows don't talk." },
    { zh: '目標，確認。', en: 'Target marked.' },
  ],
};

export function towerBark(type: TowerType, art: string): L10n[] {
  return BRANCH_BARKS[art] ?? TOWER_BARKS[type];
}
