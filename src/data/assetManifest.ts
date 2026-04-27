/**
 * 美術素材清單 — 把產生的圖檔放入 public/assets/<目錄>/<檔名>.png 並取消下方對應註解。
 *
 * key 規則：
 *   portrait_<commanderId>  → Hub 卡片 + Cutscene 人物頭像
 *   sprite_<commanderId>    → 戰場單位（之後實作）
 *   cg_<chapterId>          → 章節 CG 大圖（之後實作）
 *
 * 若檔案不存在，Phaser 會 console.warn 但不中斷遊戲，HubScene 自動 fallback 到文字+色塊。
 */
export interface AssetEntry {
  key: string;
  url: string;
}

/**
 * 武將立繪／頭像（建議 512×512 PNG，正方形，去背或單色背景）。
 * 取消註解後，把同檔名 png 放到 public/assets/portraits/ 即可使用。
 */
export const PORTRAIT_ASSETS: AssetEntry[] = [
  // === 玩家陣營 ===
  { key: 'portrait_arthur', url: 'assets/portraits/arthur.png' },
  { key: 'portrait_rosa', url: 'assets/portraits/rosa.png' },
  { key: 'portrait_gary', url: 'assets/portraits/gary.png' },
  { key: 'portrait_sharon', url: 'assets/portraits/sharon.png' },
  { key: 'portrait_rain', url: 'assets/portraits/rain.png' },

  // === 主要 BOSS ===
  { key: 'portrait_baron', url: 'assets/portraits/baron.png' },
  { key: 'portrait_eo', url: 'assets/portraits/eo.png' },
  { key: 'portrait_cult_leader', url: 'assets/portraits/cult_leader.png' },
  { key: 'portrait_shadow', url: 'assets/portraits/shadow.png' },
  { key: 'portrait_high_priest', url: 'assets/portraits/high_priest.png' },

  // === 次要 BOSS（可選） ===
  // { key: 'portrait_carl',       url: 'assets/portraits/carl.png' },
  // { key: 'portrait_vlad',       url: 'assets/portraits/vlad.png' },
  // { key: 'portrait_morden',     url: 'assets/portraits/morden.png' },
  // { key: 'portrait_selene',     url: 'assets/portraits/selene.png' },
  // { key: 'portrait_sub_priest', url: 'assets/portraits/sub_priest.png' },
];

/**
 * 章節 CG / 標題大圖（建議 1920×1080 PNG，橫式構圖）。
 * 取消註解後，把同檔名 png 放到 public/assets/cg/ 即可使用。
 */
export const CG_ASSETS: AssetEntry[] = [
  // === 標題畫面背景 ===
  { key: 'cg_title', url: 'assets/cg/title.png' },

  // === 章節入場大圖（之後使用）===
  // { key: 'cg_chapter1', url: 'assets/cg/chapter1.png' },
  // { key: 'cg_chapter8', url: 'assets/cg/chapter8.png' },
];

/**
 * 取得武將對應的 portrait texture key（若有設定）。
 */
export function getPortraitKey(commanderId: string): string {
  return `portrait_${commanderId}`;
}
