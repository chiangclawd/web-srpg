/**
 * 簡單 i18n：t(key, params?) → 依當前語言查表替換。
 * 預設 zh，可在設定中切換 en。未翻譯字串 fallback 到 zh，再 fallback 到 key。
 */

export type Lang = 'zh' | 'en';

const STRINGS: Record<Lang, Record<string, string>> = {
  zh: {
    // 標題
    'title.subtitle': '西方奇幻戰術 RPG',
    'title.newGame': '▶ 新遊戲',
    'title.continue': '⏵ 繼續（第 {n} 章 {title}）',
    'title.continueShort': '⏵ 繼續遊戲',
    'title.clearSave': '× 清除存檔',
    'title.hintNoSave': '（按開始按鈕或任意鍵開始）',
    'title.hintHasSave': '（已偵測到存檔，可選擇繼續或重新開始）',
    'title.lang': '語言：繁中',

    // 暫停
    'pause.title': '— 暫停 —',
    'pause.hint': '按 ESC 繼續，或選擇下方項目',
    'pause.resume': '繼續遊戲',
    'pause.animSpeed': '動畫速度：{x}x',
    'pause.audioOn': '音效：開',
    'pause.audioOff': '音效：關',
    'pause.toTitle': '回標題',
    'pause.toggleLang': '語言：繁中',

    // Hub
    'hub.outDeploy': '▶ 出陣',
    'hub.toTitle': '◀ 回標題',
    'hub.commanderInfo': '武將資訊',
    'hub.subtitle': '出陣前確認 · 點擊武將檢視詳細資訊',
    'hub.chapterTitle': '第 {n} 章 — {title}',

    // 戰鬥
    'battle.yourTurn': '你的回合',
    'battle.enemyTurn': '敵方回合',
    'battle.endTurn': '結束我方回合',
    'battle.wait': '原地待命',
    'battle.cancel': '取消選擇',
    'battle.victory': '勝利！',
    'battle.defeat': '戰敗',
    'battle.hintIdle': '點我方單位（藍）行動，\n或按「結束回合」。',
    'battle.enemyActing': '敵方行動中…',
  },
  en: {
    // Title
    'title.subtitle': 'A Western Fantasy Tactical RPG',
    'title.newGame': '▶ New Game',
    'title.continue': '⏵ Continue (Ch {n}: {title})',
    'title.continueShort': '⏵ Continue',
    'title.clearSave': '× Clear Save',
    'title.hintNoSave': '(Click button or press any key to start)',
    'title.hintHasSave': '(Save detected — continue or start over)',
    'title.lang': 'Language: EN',

    // Pause
    'pause.title': '— Paused —',
    'pause.hint': 'Press ESC to resume, or select below',
    'pause.resume': 'Resume',
    'pause.animSpeed': 'Animation Speed: {x}x',
    'pause.audioOn': 'Audio: On',
    'pause.audioOff': 'Audio: Off',
    'pause.toTitle': 'Quit to Title',
    'pause.toggleLang': 'Language: EN',

    // Hub
    'hub.outDeploy': '▶ Deploy',
    'hub.toTitle': '◀ Title',
    'hub.commanderInfo': 'Commander Info',
    'hub.subtitle': 'Pre-deployment · Click a commander for details',
    'hub.chapterTitle': 'Chapter {n} — {title}',

    // Battle
    'battle.yourTurn': 'Your Turn',
    'battle.enemyTurn': 'Enemy Turn',
    'battle.endTurn': 'End Turn',
    'battle.wait': 'Wait',
    'battle.cancel': 'Cancel',
    'battle.victory': 'Victory!',
    'battle.defeat': 'Defeat',
    'battle.hintIdle': 'Click your unit (blue) to act,\nor press End Turn.',
    'battle.enemyActing': 'Enemy acting…',

    // 武將名（en）
    'commander.arthur.name': 'Arthur',
    'commander.rosa.name': 'Rosa',
    'commander.gary.name': 'Gary',
    'commander.sharon.name': 'Sharon',
    'commander.rain.name': 'Rain',
    'commander.morden.name': 'Morden',
    'commander.selene.name': 'Selene',
    'commander.greg.name': 'Greg',
    'commander.scout_archer.name': 'Scout Archer',
    'commander.vlad.name': 'Vlad',
    'commander.caleb.name': 'Caleb',
    'commander.baron.name': 'Gen. Bron',
    'commander.hirsch.name': 'Hirsch',
    'commander.mara.name': 'Mara',
    'commander.cult_assassin.name': 'Cult Assassin',
    'commander.carl.name': 'Gen. Carl',
    'commander.shadow.name': 'Shadow Blade',
    'commander.eo.name': 'Marquis Eo',
    'commander.high_priest.name': 'Dark Priest',
    'commander.griffon_rider.name': 'Griffon Rider',
    'commander.cult_leader.name': 'Cult Lord — An',
    'commander.cultist_1.name': 'Cultist A',
    'commander.cultist_2.name': 'Cultist B',
    'commander.cultist_3.name': 'Cultist C',
    'commander.sub_priest.name': 'Sub-Priest Lin',
    'commander.zealot_1.name': 'Zealot A',
    'commander.zealot_2.name': 'Zealot B',
    'commander.dark_god_shard.name': 'Void Shard',
    'commander.void_wraith.name': 'Void Wraith',

    // 章節標題（en）
    'chapter.chapter1.title': 'Border Outpost',
    'chapter.chapter2.title': 'Black Pine Ambush',
    'chapter.chapter3.title': 'Oski Canyon',
    'chapter.chapter4.title': 'Etra River Ford',
    'chapter.chapter5.title': 'Siege of Ascret',
    'chapter.chapter6.title': "Eo's Chamber",
    'chapter.chapter7.title': 'Dark Mount Ruins',
    'chapter.chapter8.title': 'Void Throne',
    'chapter.chapter9.title': 'Remnants Hunt',
    'chapter.chapter10.title': 'Void Rift',
    'chapter.chapter11.title': 'Gauntlet of Dreams',

    // 兵種名（en）
    'unitType.sword': 'Sword',
    'unitType.lance': 'Lance',
    'unitType.cavalry': 'Cavalry',
    'unitType.archer': 'Archer',
    'unitType.mage': 'Mage',
    'unitType.flier': 'Flier',
  },
};

/**
 * 給特定資料 key 找翻譯，若是 zh 或翻譯不存在，回傳 fallback（中文原文）
 */
export function tn(key: string, fallback: string): string {
  if (_lang === 'zh') return fallback;
  const en = STRINGS.en[key];
  return en ?? fallback;
}

const STORAGE_KEY = 'web-srpg-lang-v1';
let _lang: Lang = 'zh';

export function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') _lang = saved;
  } catch {
    /* no-op */
  }
  return _lang;
}

export function setLang(lang: Lang): void {
  _lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* no-op */
  }
}

export function getLang(): Lang {
  return _lang;
}

export function toggleLang(): Lang {
  setLang(_lang === 'zh' ? 'en' : 'zh');
  return _lang;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let str = STRINGS[_lang][key] ?? STRINGS.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
