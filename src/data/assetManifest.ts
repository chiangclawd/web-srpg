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

  // === 次要 BOSS ===
  { key: 'portrait_carl', url: 'assets/portraits/carl.png' },
  { key: 'portrait_vlad', url: 'assets/portraits/vlad.png' },
  { key: 'portrait_morden', url: 'assets/portraits/morden.png' },
  { key: 'portrait_selene', url: 'assets/portraits/selene.png' },
  { key: 'portrait_sub_priest', url: 'assets/portraits/sub_priest.png' },

  // === 後日談（Ch12+）===
  { key: 'portrait_aria', url: 'assets/portraits/aria.png' },
  { key: 'portrait_zerin', url: 'assets/portraits/zerin.png' },

  // === 後日談 同盟陣營（C2）===
  { key: 'portrait_viktor', url: 'assets/portraits/viktor.png' },
  { key: 'portrait_lila', url: 'assets/portraits/lila.png' },
  { key: 'portrait_elena', url: 'assets/portraits/elena.png' },

  // === 後日談 Ch13 BOSS ===
  { key: 'portrait_claude_steward', url: 'assets/portraits/claude_steward.png' },

  // === 後日談 Ch14 BOSS ===
  { key: 'portrait_sylvain_speaker', url: 'assets/portraits/sylvain_speaker.png' },
];

/**
 * 章節 CG / 標題大圖（建議 1920×1080 PNG，橫式構圖）。
 * 取消註解後，把同檔名 png 放到 public/assets/cg/ 即可使用。
 */
export const CG_ASSETS: AssetEntry[] = [
  // === 標題畫面背景 ===
  { key: 'cg_title', url: 'assets/cg/title.png' },

  // === 章節入場大圖 ===
  { key: 'cg_chapter1', url: 'assets/cg/chapter1.png' },
  { key: 'cg_chapter2', url: 'assets/cg/chapter2.png' },
  { key: 'cg_chapter3', url: 'assets/cg/chapter3.png' },
  { key: 'cg_chapter4', url: 'assets/cg/chapter4.png' },
  { key: 'cg_chapter5', url: 'assets/cg/chapter5.png' },
  { key: 'cg_chapter6', url: 'assets/cg/chapter6.png' },
  { key: 'cg_chapter7', url: 'assets/cg/chapter7.png' },
  { key: 'cg_chapter8', url: 'assets/cg/chapter8.png' },
  { key: 'cg_chapter9', url: 'assets/cg/chapter9.png' },
  { key: 'cg_chapter10', url: 'assets/cg/chapter10.png' },
  { key: 'cg_chapter11', url: 'assets/cg/chapter11.png' },

  // === 後日談 ===
  { key: 'cg_chapter12', url: 'assets/cg/chapter12.png' },
  { key: 'cg_chapter13', url: 'assets/cg/chapter13.png' },
  { key: 'cg_chapter14', url: 'assets/cg/chapter14.png' },
];

/**
 * 戰場單位 sprite（建議 256×256 PNG，去背、Q 版/全身像）。
 *
 * 命名規則（兩種，依優先序）：
 *   1. sprite_<commanderId>           → 個別武將專用 sprite（player 5 個主角 + 主要 BOSS）
 *   2. sprite_enemy_<unitType>        → 敵方泛用兵種 sprite（雜兵用）
 *
 * 找不到 1 也找不到 2 → 自動 fallback 到原本的色塊形狀（不影響遊戲）。
 */
export const SPRITE_ASSETS: AssetEntry[] = [
  // === 玩家陣營（5 個主角專用 sprite）===
  { key: 'sprite_arthur', url: 'assets/sprites/arthur.png' },
  { key: 'sprite_rosa', url: 'assets/sprites/rosa.png' },
  { key: 'sprite_gary', url: 'assets/sprites/gary.png' },
  { key: 'sprite_sharon', url: 'assets/sprites/sharon.png' },
  { key: 'sprite_rain', url: 'assets/sprites/rain.png' },

  // === 敵方泛用兵種 sprite（6 種 unitType）===
  { key: 'sprite_enemy_sword', url: 'assets/sprites/enemy_sword.png' },
  { key: 'sprite_enemy_lance', url: 'assets/sprites/enemy_lance.png' },
  { key: 'sprite_enemy_archer', url: 'assets/sprites/enemy_archer.png' },
  { key: 'sprite_enemy_mage', url: 'assets/sprites/enemy_mage.png' },
  { key: 'sprite_enemy_cavalry', url: 'assets/sprites/enemy_cavalry.png' },
  { key: 'sprite_enemy_flier', url: 'assets/sprites/enemy_flier.png' },

  // === 玩家泛用兵種 sprite（王國雜兵：劍/槍/騎/弓/法）===
  { key: 'sprite_player_sword', url: 'assets/sprites/player_sword.png' },
  { key: 'sprite_player_lance', url: 'assets/sprites/player_lance.png' },
  { key: 'sprite_player_cavalry', url: 'assets/sprites/player_cavalry.png' },
  { key: 'sprite_player_archer', url: 'assets/sprites/player_archer.png' },
  { key: 'sprite_player_mage', url: 'assets/sprites/player_mage.png' },

  // === 主要 BOSS 專用 sprite ===
  { key: 'sprite_baron', url: 'assets/sprites/baron.png' },
  { key: 'sprite_eo', url: 'assets/sprites/eo.png' },
  { key: 'sprite_shadow', url: 'assets/sprites/shadow.png' },
  { key: 'sprite_high_priest', url: 'assets/sprites/high_priest.png' },
  { key: 'sprite_cult_leader', url: 'assets/sprites/cult_leader.png' },

  // === 次要 BOSS 專用 sprite（沒檔案時自動 fallback 到 sprite_enemy_<unitType>） ===
  { key: 'sprite_vlad', url: 'assets/sprites/vlad.png' },
  { key: 'sprite_morden', url: 'assets/sprites/morden.png' },
  { key: 'sprite_selene', url: 'assets/sprites/selene.png' },
  { key: 'sprite_carl', url: 'assets/sprites/carl.png' },
  { key: 'sprite_sub_priest', url: 'assets/sprites/sub_priest.png' },

  // === 後日談（Ch12+）— 新角色專用 sprite ===
  { key: 'sprite_aria', url: 'assets/sprites/aria.png' },
  { key: 'sprite_zerin', url: 'assets/sprites/zerin.png' },

  // === 後日談 同盟陣營（C2）— sprite（缺檔自動 fallback 到 sprite_player_<unitType>）===
  { key: 'sprite_viktor', url: 'assets/sprites/viktor.png' },
  { key: 'sprite_lila', url: 'assets/sprites/lila.png' },
  { key: 'sprite_elena', url: 'assets/sprites/elena.png' },

  // === 後日談 Ch13 BOSS — sprite（缺檔 fallback 到 sprite_enemy_mage）===
  { key: 'sprite_claude_steward', url: 'assets/sprites/claude_steward.png' },

  // === 後日談 Ch14 BOSS — sprite（缺檔 fallback 到 sprite_enemy_mage）===
  { key: 'sprite_sylvain_speaker', url: 'assets/sprites/sylvain_speaker.png' },
];

/**
 * 取得武將對應的 portrait texture key（若有設定）。
 */
export function getPortraitKey(commanderId: string): string {
  return `portrait_${commanderId}`;
}

/**
 * 取得戰場 sprite texture key（依優先序回傳，scene 端再用 textures.exists 判斷）。
 *   1. sprite_<commanderId>           — 個別專用（主角 / BOSS）
 *   2. sprite_<faction>_<unitType>    — 該陣營該兵種的泛用 sprite（王國劍兵 / 敵方法師）
 */
export function getSpriteKeyCandidates(
  commanderId: string,
  unitType: string,
  faction: 'player' | 'enemy'
): string[] {
  return [
    `sprite_${commanderId}`,
    `sprite_${faction}_${unitType}`,
  ];
}
