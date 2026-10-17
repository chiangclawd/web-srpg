import type { Bgm } from '../audio';
import type { L10n } from '../sim/defs';
import { LEVELS } from './levels';
import { ENEMIES } from './enemies';

/** 第一個有首領的關卡（首領戰配樂在這裡第一次響起） */
const FIRST_BOSS_LEVEL = LEVELS.find((l) => l.waves.some((w) => w.groups.some((g) => ENEMIES[g.enemy]?.boss)))?.id;

/**
 * 音樂室曲目（圖鑑的「音樂」分頁）：reach 是要到過的關卡，沒寫就一開始就能聽
 */
export const MUSIC_TRACKS: { id: Bgm; name: L10n; where: L10n; reach?: string }[] = [
  { id: 'title', name: { zh: '王國防線（主題曲）', en: 'Kingdom Bastion' }, where: { zh: '標題畫面', en: 'Title screen' } },
  { id: 'map', name: { zh: '遠征之路', en: 'The Road Ahead' }, where: { zh: '世界地圖', en: 'World map' } },
  { id: 'grass', name: { zh: '草原攻防', en: 'Meadow Skirmish' }, where: { zh: '草原、秋林', en: 'Meadows and autumn woods' }, reach: 'l1' },
  { id: 'forest', name: { zh: '暗影森林', en: 'Shadowwood' }, where: { zh: '森林', en: 'Forest' }, reach: 'l3' },
  { id: 'snow', name: { zh: '霜雪山口', en: 'Frozen Pass' }, where: { zh: '雪山', en: 'Snowy mountains' }, reach: 'l4' },
  { id: 'waste', name: { zh: '荒原進軍', en: 'March of the Wastes' }, where: { zh: '荒原', en: 'Wastelands' }, reach: 'l8' },
  { id: 'desert', name: { zh: '沙海烈陽', en: 'Sun over the Dunes' }, where: { zh: '沙漠', en: 'Desert' }, reach: 'l13' },
  { id: 'volcano', name: { zh: '熔岩火口', en: 'Ember Crater' }, where: { zh: '火山', en: 'Volcano' }, reach: 'l16' },
  { id: 'coast', name: { zh: '黑潮海灣', en: 'Blacktide Cove' }, where: { zh: '海灣', en: 'Coast' }, reach: 'l17' },
  { id: 'boss', name: { zh: '首領來襲', en: 'The Boss Arrives' }, where: { zh: '首領登場', en: 'Boss battles' }, reach: FIRST_BOSS_LEVEL },
  { id: 'finale', name: { zh: '最終決戰', en: 'The Last Stand' }, where: { zh: '最終關', en: 'The final battle' }, reach: 'l12' },
];
