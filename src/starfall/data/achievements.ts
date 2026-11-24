// 成就的名稱和說明。達成的條件寫在 records.ts（純函式，tests/starfall/records.test.ts 直接測）。
// 編號會存進存檔（前面加 ach_），取了就不要改；要拿掉一個成就就把它從這裡刪掉，存檔裡多出來的記號不影響任何事。
import type { L10n } from '../sim/types';

export interface FeatDef {
  id: string;
  name: L10n;
  desc: L10n;
}

export const FEATS: readonly FeatDef[] = [
  // 進度：從星數、改造、圖鑑算得出來的
  { id: 'ch1', name: { zh: '冰原上的訊號', en: 'A Signal on the Ice' }, desc: { zh: '完成第一章', en: 'Clear chapter 1' } },
  { id: 'ch2', name: { zh: '冬眠艙的歌聲', en: 'The Song in the Sleep Bay' }, desc: { zh: '完成第二章', en: 'Clear chapter 2' } },
  { id: 'ch3', name: { zh: '點名', en: 'Roll Call' }, desc: { zh: '完成第三章，看到主線的結局', en: 'Clear chapter 3 and see the ending' } },
  { id: 'ch4', name: { zh: '新岸', en: 'Haven' }, desc: { zh: '完成後日談', en: 'Clear the epilogue' } },
  { id: 'star3', name: { zh: '無可挑剔', en: 'Flawless' }, desc: { zh: '在任何一個任務拿到三顆星', en: 'Earn three stars on any mission' } },
  { id: 'stars18', name: { zh: '老練的拾荒者', en: 'Seasoned Salvager' }, desc: { zh: '累積 18 顆星', en: 'Earn 18 stars in total' } },
  { id: 'stars36', name: { zh: '滿天星', en: 'Every Star' }, desc: { zh: '每一個任務都拿到三顆星', en: 'Earn three stars on every mission' } },
  { id: 'mod', name: { zh: '改裝', en: 'Custom Job' }, desc: { zh: '在機庫安裝一個專屬改造', en: 'Install a frame mod in the hangar' } },
  { id: 'maxed', name: { zh: '全套改造', en: 'Fully Loaded' }, desc: { zh: '把一台機體的八項改造全部裝滿', en: 'Install all eight upgrades on one frame' } },
  { id: 'codex', name: { zh: '都記下來了', en: 'All on Record' }, desc: { zh: '圖鑑記錄全部的機體與設施', en: 'Record every unit and structure in the codex' } },
  // 戰術：戰鬥裡做到的當下就算，輸了或重來也留著
  { id: 'fall', name: { zh: '下去吧', en: 'Mind the Gap' }, desc: { zh: '把一個敵人轟進裂谷', en: 'Knock an enemy into a chasm' } },
  { id: 'overwatch', name: { zh: '守株待兔', en: 'Lying in Wait' }, desc: { zh: '用警戒射擊擊破一個敵人', en: 'Destroy an enemy with an overwatch shot' } },
  { id: 'counter', name: { zh: '後發先至', en: 'Return to Sender' }, desc: { zh: '用反擊擊破一個敵人', en: 'Destroy an enemy with a counterattack' } },
  { id: 'double', name: { zh: '一石二鳥', en: 'Two Birds' }, desc: { zh: '一次行動擊破兩個以上的敵人', en: 'Destroy two or more enemies with a single action' } },
  { id: 'pierce3', name: { zh: '一線穿', en: 'Threading the Needle' }, desc: { zh: '長庚的「貫穿射擊」一次打中三個敵人', en: "Hit three enemies with one of Vesper's Piercing Shots" } },
  { id: 'shield', name: { zh: '繞過塔盾', en: 'Around the Shield' }, desc: { zh: '從側面或背後擊破一台「堡壘」', en: 'Destroy a Bastion from the side or the rear' } },
  // 過關的那一刻算
  { id: 'swift', name: { zh: '速戰速決', en: 'Ahead of Schedule' }, desc: { zh: '比標準回合數早三回合以上完成任務（防守與同步任務除外）', en: 'Clear a mission at least three turns under par (defence and sync missions do not count)' } },
  { id: 'fullhp', name: { zh: '完好歸隊', en: 'All Present and Correct' }, desc: { zh: '過關時所有駕駛員的機體都還在，而且耐久全滿', en: 'Clear a mission with every piloted frame alive and at full HP' } },
  { id: 'guard', name: { zh: '滴水不漏', en: 'Airtight' }, desc: { zh: '過關時要保護的設施一點傷都沒有', en: 'Clear a mission with every protected structure undamaged' } },
  { id: 'drones', name: { zh: '有借有還', en: 'Returned in One Piece' }, desc: { zh: '過關時艾可借來的機群一台都沒少', en: 'Clear a mission without losing any of the drones Echo borrowed' } },
];

export const featById = (id: string): FeatDef | undefined => FEATS.find((f) => f.id === id);
