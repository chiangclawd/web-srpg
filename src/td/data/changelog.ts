import type { L10n } from '../sim/defs';

export interface ChangeEntry {
  /** 遞增編號：大於存檔中的 newsSeen 就自動顯示 */
  id: number;
  date: string;
  title: L10n;
  items: L10n[];
}

/** 更新內容（最新在前）。每次部署新功能就在最前面加一筆。 */
export const CHANGELOG: ChangeEntry[] = [
  {
    id: 10,
    date: '2026-10-16',
    title: { zh: '砲管換新', en: 'New cannon barrels' },
    items: [
      { zh: '四種砲塔的臼砲（木砲、鐵砲、青銅砲、巨砲貝莎）換成手繪造型', en: 'All four mortars (wood, iron, bronze and Big Bertha) are hand-painted to match the towers' },
      { zh: '修正砲口方向：現在會朝向正在攻擊的敵人', en: 'Fixed barrel direction: mortars now lean toward the enemy they are shelling' },
    ],
  },
  {
    id: 9,
    date: '2026-10-16',
    title: { zh: '全新標題畫面', en: 'New title screen' },
    items: [
      { zh: '標題畫面換成手繪主視覺：騎士與守軍迎戰巨魔、惡魔大軍，背景是遠方的王城', en: 'A hand-painted title illustration: the knight and his garrison face a horde of trolls and imps, with the royal castle in the distance' },
      { zh: '分享連結時的預覽圖也換成新主視覺', en: 'Shared links now preview the new artwork' },
    ],
  },
  {
    id: 8,
    date: '2026-10-16',
    title: { zh: '防禦塔換上手繪新造型', en: 'Hand-painted towers' },
    items: [
      { zh: '弓箭、法師、兵營、砲塔共 20 種造型（含所有分支）全部重繪，升級時外觀變化更明顯', en: 'All 20 tower looks (every level and branch) are repainted, so upgrades read at a glance' },
      { zh: '弓箭手和法師站在城垛後面，箭矢、法球、砲彈從塔頂射出', en: 'Archers and mages stand behind the battlements; arrows, bolts and shells now fly from the tower tops' },
      { zh: '建造選單的塔圖示也一起更新', en: 'Build-menu tower icons match the new art' },
    ],
  },
  {
    id: 7,
    date: '2026-10-16',
    title: { zh: '魔物換上手繪新造型', en: 'Hand-painted monsters' },
    items: [
      { zh: '哥布林、狼、巨魔、蝙蝠、骷髏、蠍子、惡魔、沙暴巨蟲，以及變羊與石像，全部換成和英雄同風格的手繪圖', en: 'Goblins, wolves, trolls, bats, skeletons, scorpions, demons, the Sandstorm Wyrm, plus the sheep and stone golem now share the heroes\' painted style' },
      { zh: '圖鑑的敵人標籤恢復底框', en: 'Enemy tags in the encyclopedia have their backgrounds again' },
    ],
  },
  {
    id: 6,
    date: '2026-10-16',
    title: { zh: '雙指縮放地圖', en: 'Pinch to zoom' },
    items: [
      { zh: '戰鬥中可雙指放大地圖（最多 2.2 倍），放大後拖曳移動；縮回就看到整張地圖。電腦可用滾輪', en: 'Pinch to zoom the battlefield (up to 2.2x) and drag to move around; pinch back out to see the whole map. Mouse wheel on desktop' },
      { zh: '拖曳地圖時不會再誤點蓋塔', en: 'Dragging the map no longer triggers accidental builds' },
    ],
  },
  {
    id: 5,
    date: '2026-10-16',
    title: { zh: '手機按鈕更好按', en: 'Bigger buttons on phones' },
    items: [
      { zh: '手機上英雄、法術、絕招、道具、暫停／加速、建塔選單、呼叫波次與地圖按鈕整體放大', en: 'On phones, hero, spell, ultimate, item, pause/speed, build menu, wave call and map buttons are all larger' },
      { zh: '微調第 5、9、10、14 關各一個建造點，避免被放大的按鈕蓋住', en: 'Nudged one build spot each in levels 5, 9, 10 and 14 so the bigger buttons do not cover them' },
    ],
  },
  {
    id: 4,
    date: '2026-10-16',
    title: { zh: '手機文字更清楚', en: 'Readable text on phones' },
    items: [
      { zh: '手機上的小字自動放大；關卡資訊、每日挑戰、結算、劇情對話等視窗整體放大', en: 'Small text is enlarged on phones; level info, daily challenge, results and story dialogs are scaled up as a whole' },
      { zh: '修正多處文字擠在一起或超出框外（成就、商店、英雄、更新內容）', en: 'Fixed overlapping or clipped text in achievements, shop, heroes and what\'s new' },
    ],
  },
  {
    id: 3,
    date: '2026-10-16',
    title: { zh: '每日挑戰與分享成績', en: 'Daily Challenge & sharing' },
    items: [
      { zh: '地圖右上新增每日挑戰：每天換一關＋兩個修正，所有人同一題（通過該關即可挑戰）', en: 'New Daily Challenge (top right of the map): one level and two modifiers per day, the same for everyone (clear that level to take it on)' },
      { zh: '每天第一次通過可得寶石，連續挑戰還有新成就', en: 'Gems for your first clear each day, plus new achievements' },
      { zh: '結算畫面可一鍵分享成績給朋友', en: 'Share your result with friends from the results screen' },
    ],
  },
  {
    id: 2,
    date: '2026-10-16',
    title: { zh: '修正 iPhone 閃退', en: 'iPhone crash fix' },
    items: [
      { zh: '大幅降低手機的記憶體用量，修正 iPhone 橫向遊玩時頁面「重複發生問題」而無法開啟', en: 'Much lower memory use on phones; fixes the page crashing ("a problem repeatedly occurred") on iPhone in landscape' },
      { zh: '萬一又意外關閉，下次開啟會自動改用「省電」畫質', en: 'If the game still closes unexpectedly, it switches to Low graphics on the next launch' },
    ],
  },
  {
    id: 1,
    date: '2026-10-16',
    title: { zh: '首次公開測試', en: 'First public test' },
    items: [
      { zh: '12 關主線戰役＋2 關沙漠外傳，6 種地形與 7 名首領', en: '12 campaign levels plus 2 desert side levels, 6 terrains and 7 bosses' },
      { zh: '6 位英雄，各有 3 個技能與 1 個手動絕招（左下金色按鈕）', en: '6 heroes, each with 3 skills and a hand-cast ultimate (gold button)' },
      { zh: '4 種防禦塔、8 種特化與 16 個技能', en: '4 towers, 8 specializations and 16 skills' },
      { zh: '英雄挑戰、鋼鐵挑戰、無盡模式與 27 項成就', en: 'Heroic, Iron and Endless modes, plus 27 achievements' },
      { zh: '寶石商店：炸藥桶、冰霜水晶、生命藥水、金幣袋', en: 'Gem shop: powder kegs, frost crystals, heart potions, gold sacks' },
      { zh: '設定可備份存檔、切換畫質；手機橫向遊玩最順手', en: 'Back up your save and change graphics in Settings; best played in landscape' },
    ],
  },
];
