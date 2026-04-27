import type { ScenarioDef } from '../types';

/**
 * 全 12 個劇本（22×16 hex grid）。每張地圖：
 *   - 玩家陣營西側 (col 0-3)
 *   - 中段戰場 (col 4-17) — 含關卡核心地形
 *   - 敵方陣營東側 (col 18-21)
 *
 * 地形字元：. 平原 / F 森林 / M 山地 / W 河流（不可進入）
 * 部署：舊版部署位置 + 新增 5 名玩家普通兵 + 多 50% 敵方雜兵（Wave E 補上）
 */
export const SCENARIOS: Record<string, ScenarioDef> = {
  // ============================================
  // 第 1 章：邊境哨站（intro）
  // ============================================
  intro: {
    id: 'intro', name: '邊境哨站',
    description: '亞瑟一行人前往哨站途中遭遇敵方斥候，必須穿越河畔森林與山口決戰。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x1a2535,
    // 河流斜貫中段；西側森林掩護玩家；東側山地控制制高點
    terrain: [
      '..F.................M.',
      '.FF...........MM....M.',
      '..F....W..........MMM.',
      '...F..WW.........F....',
      '....F.WW......FF......',
      '..FF...WW....F........',
      '...F....WW..F.........',
      '....F....WW.....M.....',
      '.....F....WW...MM.....',
      '......F....WW.M.......',
      '......FF....WW........',
      '..............WW...F..',
      '...F............WW.FF.',
      '..FF.....M.......WW.F.',
      '...F....MM........WW..',
      '....F..MMM.........MM.',
    ],
    deployments: [
      // 玩家陣營（西側森林邊緣）
      { commanderId: 'arthur', position: { x: 1, y: 11 } },
      { commanderId: 'rosa', position: { x: 0, y: 13 } },
      { commanderId: 'gary', position: { x: 2, y: 13 } },
      // 敵方陣營（東側山口、河對岸）
      { commanderId: 'morden', position: { x: 19, y: 2 } },
      { commanderId: 'selene', position: { x: 20, y: 4 } },
      { commanderId: 'greg', position: { x: 18, y: 5 } },
      { commanderId: 'scout_archer', position: { x: 19, y: 8 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 第 2 章：黑松森伏擊（forest_pass）
  // ============================================
  forest_pass: {
    id: 'forest_pass', name: '黑松森伏擊',
    description: '黑松森林中央僅一條曲折通路，敵軍從多個方向同時包夾。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x142a18,
    // 中央狹路扭曲穿過森林；兩側全是密林伏擊區
    terrain: [
      '.FFFF.FFFF.FFFF.FFFF..',
      '.FF.F.F.FF..FF.F.F.FF.',
      '..F.FFF.F....F.FFF.F..',
      'FF...F....FF....F....F',
      'F.FF...FF.....FF....FF',
      '..F.FFF.F....F.FFF.F..',
      '.FF.F.F.FF....F.F.FF..',
      '.FFFF.FFFF.....FFF.FF.',
      '.FFFF.FFFF.....FFF.FF.',
      '.FF.F.F.FF....F.F.FF..',
      '..F.FFF.F....F.FFF.F..',
      'F.FF...FF.....FF....FF',
      'FF...F....FF....F....F',
      '..F.FFF.F....F.FFF.F..',
      '.FF.F.F.FF..FF.F.F.FF.',
      '.FFFF.FFFF.FFFF.FFFF..',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 7 } },
      { commanderId: 'rosa', position: { x: 0, y: 8 } },
      { commanderId: 'gary', position: { x: 0, y: 6 } },
      // 敵方四方包夾（東+北+南）
      { commanderId: 'vlad', position: { x: 21, y: 7 } },
      { commanderId: 'caleb', position: { x: 21, y: 9 } },
      { commanderId: 'morden', position: { x: 17, y: 0 } },
      { commanderId: 'greg', position: { x: 17, y: 15 } },
      { commanderId: 'scout_archer', position: { x: 11, y: 0 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 第 3 章：歐斯基峽谷（final_battle）
  // ============================================
  final_battle: {
    id: 'final_battle', name: '歐斯基峽谷',
    description: '伯朗將軍依山佈陣 — 兩翼山岩、中央河谷、要塞式障壁陣。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x301810,
    // 兩側山地夾峙成走廊；中央河流被淺灘截斷；伯朗在東側高地
    terrain: [
      'MMMMM..........MMMMMMM',
      'MMM................MMM',
      'MM......WW...........M',
      'M......WWWW...........',
      '......WWWWWW.....F....',
      '....F.....WW....FF...M',
      '...FF......WW....F..MM',
      '....F.......WW......MM',
      '............WW......MM',
      '...F.......WW....F..MM',
      '..FF......WW....FF...M',
      '...F.....WW......F....',
      '......WWWWWW..........',
      'M......WWWW...........',
      'MM......WW...........M',
      'MMM................MMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 7 } },
      { commanderId: 'rosa', position: { x: 0, y: 8 } },
      { commanderId: 'gary', position: { x: 0, y: 6 } },
      // 伯朗將軍鎮守東側高地
      { commanderId: 'baron', position: { x: 20, y: 7 } },
      { commanderId: 'morden', position: { x: 19, y: 5 } },
      { commanderId: 'greg', position: { x: 19, y: 9 } },
      { commanderId: 'caleb', position: { x: 21, y: 11 } },
      { commanderId: 'selene', position: { x: 19, y: 7 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 第 4 章：伊特拉河渡口（river_ford）
  // ============================================
  river_ford: {
    id: 'river_ford', name: '伊特拉河渡口',
    description: '河中央有座島嶼困住夏倫——黑暗教派刺客已在外圍合圍。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x122a3a,
    // 大型河道分隔東西兩岸；中央島嶼有夏倫；玩家從西岸過淺灘
    terrain: [
      '..F.W..WWWWWWWWW..W..F',
      '.FF.W.W.........W.W.F.',
      'F.F..W.....F.....W..F.',
      '....W..F........F..W..',
      'F..W..FF...M....FF..W.',
      '...W...F..MMM....F..W.',
      '..W.....F.MMM.F.....WW',
      '.WW......F.M.F.......W',
      '.WW......F.M.F.......W',
      '..W.....F.MMM.F.....WW',
      '...W...F..MMM....F..W.',
      'F..W..FF...M....FF..W.',
      '....W..F........F..W..',
      'F.F..W.....F.....W..F.',
      '.FF.W.W.........W.W.F.',
      '..F.W..WWWWWWWWW..W..F',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 7 } },
      { commanderId: 'rosa', position: { x: 0, y: 8 } },
      { commanderId: 'gary', position: { x: 0, y: 6 } },
      // 夏倫被困在中央島嶼上
      { commanderId: 'sharon', position: { x: 11, y: 7 } },
      // 圍攻夏倫的教派刺客 + 河岸守衛
      { commanderId: 'cult_assassin', position: { x: 11, y: 5 } },
      { commanderId: 'hirsch', position: { x: 14, y: 7 } },
      { commanderId: 'mara', position: { x: 16, y: 5 } },
      { commanderId: 'caleb', position: { x: 13, y: 11 } },
      { commanderId: 'greg', position: { x: 17, y: 8 } },
      { commanderId: 'scout_archer', position: { x: 19, y: 4 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 第 5 章：艾斯瑞特城圍城戰（city_defense）
  // ============================================
  city_defense: {
    id: 'city_defense', name: '艾斯瑞特城圍城戰',
    description: '北方要衝艾斯瑞特城——撐過 6 個回合，援軍即至。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x2a2618,
    // 西側 L 形城牆（M）為玩家防線；中央開闊；東側敵軍湧入
    terrain: [
      'MMMM.................F',
      'MMM..................F',
      'MM..F................F',
      'M..FF...........F.....',
      'M..F............FF....',
      'M.F..............F....',
      'M.F.....F.............',
      'M........F.........F..',
      'M.......F..........F..',
      'M.F..F................',
      'M.F..............F....',
      'M..F............FF....',
      'M..FF...........F.....',
      'MM..F................F',
      'MMM..................F',
      'MMMM.................F',
    ],
    deployments: [
      // 玩家在城內（西側 col 1-3）
      { commanderId: 'arthur', position: { x: 2, y: 7 } },
      { commanderId: 'rosa', position: { x: 2, y: 8 } },
      { commanderId: 'gary', position: { x: 3, y: 6 } },
      { commanderId: 'sharon', position: { x: 3, y: 9 } },
      // 攻城方主力（東側）
      { commanderId: 'carl', position: { x: 21, y: 7 } },
      { commanderId: 'mara', position: { x: 21, y: 2 } },
      { commanderId: 'hirsch', position: { x: 19, y: 4 } },
      { commanderId: 'caleb', position: { x: 21, y: 13 } },
      { commanderId: 'morden', position: { x: 19, y: 11 } },
      { commanderId: 'cult_assassin', position: { x: 16, y: 7 } },
    ],
    victoryCondition: 'survive',
    surviveTurns: 6,
  },

  // ============================================
  // 第 6 章：王宮地下密室（palace_intrigue）
  // ============================================
  palace_intrigue: {
    id: 'palace_intrigue', name: '王宮地下密室',
    description: '伊歐侯爵的祕密法陣——哥德式石柱間的誅殺戰。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x1a1028,
    // 哥德式石柱形成迷宮般廳堂；伊歐在中央魔法陣
    terrain: [
      'MMMMMMMMMMMMMMMMMMMMMM',
      'M..F.M.....M.....M..FM',
      'M.F....M........M....M',
      'M..M....F........F.M.M',
      'M.F....F....F.........',
      'M....M.....M.....M...M',
      'M.F............M.....M',
      'M..M.....F........F..M',
      'M..M.....F........F..M',
      'M.F............M.....M',
      'M....M.....M.....M...M',
      'M.F....F....F.........',
      'M..M....F........F.M.M',
      'M.F....M........M....M',
      'M..F.M.....M.....M..FM',
      'MMMMMMMMMMMMMMMMMMMMMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 1, y: 7 } },
      { commanderId: 'rosa', position: { x: 1, y: 8 } },
      { commanderId: 'gary', position: { x: 1, y: 6 } },
      { commanderId: 'sharon', position: { x: 1, y: 9 } },
      { commanderId: 'rain', position: { x: 1, y: 5 } },
      // 伊歐侯爵 + 影武者 + 教派守衛
      { commanderId: 'eo', position: { x: 19, y: 7 } },
      { commanderId: 'shadow', position: { x: 17, y: 6 } },
      { commanderId: 'cult_assassin', position: { x: 17, y: 8 } },
      { commanderId: 'cultist_1', position: { x: 14, y: 5 } },
      { commanderId: 'cultist_2', position: { x: 14, y: 9 } },
      { commanderId: 'cultist_3', position: { x: 11, y: 7 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 第 7 章：黑暗山遺跡（mountain_ruins）
  // ============================================
  mountain_ruins: {
    id: 'mountain_ruins', name: '黑暗山遺跡 — 邪神禱詞',
    description: '主教詠唱進行中——擊殺主教即勝，無需清光教徒。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x0e0e2a,
    // 山岩環繞遺跡；只有東西二入口；中央祭壇主教詠唱中
    terrain: [
      'MMMM..........MMMMMMMM',
      'MMM............MMMMMMM',
      'M...F....F............',
      'M..FF...FF............',
      'M...F....F.....F....MM',
      '..F....F....F.FF....MM',
      '...F....F.M.F.F......M',
      '....F....M.M.F.....MMM',
      '....F....M.M.F.....MMM',
      '...F....F.M.F.F......M',
      '..F....F....F.FF....MM',
      'M...F....F.....F....MM',
      'M..FF...FF............',
      'M...F....F............',
      'MMM............MMMMMMM',
      'MMMM..........MMMMMMMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 7 } },
      { commanderId: 'rosa', position: { x: 0, y: 8 } },
      { commanderId: 'gary', position: { x: 0, y: 6 } },
      { commanderId: 'sharon', position: { x: 0, y: 9 } },
      // 雷恩被綁在中央祭壇前
      { commanderId: 'rain', position: { x: 11, y: 7 } },
      // 黑暗主教（祭壇後方）
      { commanderId: 'high_priest', position: { x: 19, y: 7 } },
      // 教徒護衛
      { commanderId: 'cultist_1', position: { x: 17, y: 5 } },
      { commanderId: 'cultist_2', position: { x: 17, y: 7 } },
      { commanderId: 'cultist_3', position: { x: 17, y: 9 } },
      // 飛兵從北側天空俯衝
      { commanderId: 'griffon_rider', position: { x: 11, y: 0 } },
      { commanderId: 'griffon_rider', position: { x: 14, y: 0 } },
    ],
    victoryCondition: 'kill_boss',
    bossId: 'high_priest',
  },

  // ============================================
  // 第 8 章：虛空大殿 — 教主之間（finale）
  // ============================================
  finale: {
    id: 'finale', name: '虛空大殿 — 教主之間',
    description: '黑暗教派最深處，巨大祭壇環繞中央王座，教主・黯坐鎮其上。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x2a040a,
    // 王座+8 祭壇柱形成環陣；周圍石柱迷宮；教主・黯在最深處
    terrain: [
      'MMMM........MMMM......',
      'M..............F.....M',
      'M...F.....M........F.M',
      'M..F.M.........M..F..M',
      '.....M.....F.....M...M',
      '.F.......M.M.......F.M',
      'M..F....M...M....F....',
      'M.....F.M...M.F.......',
      'M.....F.M...M.F.......',
      'M..F....M...M....F....',
      '.F.......M.M.......F.M',
      '.....M.....F.....M...M',
      'M..F.M.........M..F..M',
      'M...F.....M........F.M',
      'M..............F.....M',
      'MMMM........MMMM......',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 1, y: 7 } },
      { commanderId: 'rosa', position: { x: 1, y: 8 } },
      { commanderId: 'gary', position: { x: 1, y: 6 } },
      { commanderId: 'sharon', position: { x: 1, y: 9 } },
      { commanderId: 'rain', position: { x: 1, y: 5 } },
      // 教主・黯坐鎮中央王座東側
      { commanderId: 'cult_leader', position: { x: 20, y: 7 } },
      // 復活的影武者 + 主教 + 雜兵
      { commanderId: 'shadow', position: { x: 17, y: 6 } },
      { commanderId: 'high_priest', position: { x: 17, y: 8 } },
      { commanderId: 'cultist_1', position: { x: 15, y: 5 } },
      { commanderId: 'cultist_2', position: { x: 15, y: 9 } },
      { commanderId: 'cultist_3', position: { x: 13, y: 7 } },
      { commanderId: 'cult_assassin', position: { x: 14, y: 6 } },
      { commanderId: 'cult_assassin', position: { x: 14, y: 8 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 番外第 9 章：北域廢村（remnants_hunt）
  // ============================================
  remnants_hunt: {
    id: 'remnants_hunt', name: '北域廢村 — 殘黨追擊',
    description: '教派殘黨於遺棄村落集結 — 副教主・凜試圖以血祭重啟禱詞。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x1a151a,
    // 荒廢村落，散佈廢墟（M）與枯林（F）；中央血祭祭壇
    terrain: [
      'M..F........FM.....M..',
      '..MM.M.MM..MM.M.MM....',
      '...F...F..F....F...F.M',
      '.MM..F..MM.MM..F..MM..',
      'F.MM..F.MM.MM..F.MM..F',
      'F..F...F....F...F.....',
      '..MM.M.MM.MM.MM.M.MM..',
      'M..F.....FM.M.....F..M',
      'M..F.....FM.M.....F..M',
      '..MM.M.MM.MM.MM.M.MM..',
      'F..F...F....F...F.....',
      'F.MM..F.MM.MM..F.MM..F',
      '.MM..F..MM.MM..F..MM..',
      '...F...F..F....F...F.M',
      '..MM.M.MM..MM.M.MM....',
      'M..F........FM.....M..',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 7 } },
      { commanderId: 'rosa', position: { x: 0, y: 8 } },
      { commanderId: 'gary', position: { x: 0, y: 6 } },
      { commanderId: 'sharon', position: { x: 0, y: 9 } },
      { commanderId: 'rain', position: { x: 0, y: 5 } },
      // 副教主・凜（中央血祭祭壇）
      { commanderId: 'sub_priest', position: { x: 20, y: 7 } },
      // 狂信者護衛
      { commanderId: 'zealot_1', position: { x: 17, y: 6 } },
      { commanderId: 'zealot_2', position: { x: 17, y: 8 } },
      // 教徒散佈
      { commanderId: 'cultist_1', position: { x: 14, y: 5 } },
      { commanderId: 'cultist_2', position: { x: 14, y: 9 } },
      { commanderId: 'cultist_3', position: { x: 19, y: 11 } },
      { commanderId: 'cult_assassin', position: { x: 11, y: 7 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 番外第 10 章：虛空裂縫 — 邪神顯現（true_finale）
  // ============================================
  true_finale: {
    id: 'true_finale', name: '虛空裂縫 — 邪神顯現',
    description: '殘黨儀式被獻祭啟動，召喚出邪神碎片本身——真正的最終戰。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x100020,
    // 扭曲時空，浮島漂浮，虛空（W）裂縫切割戰場
    terrain: [
      'MMM.MM.MMMM..MMMMM.MMM',
      'M.......W............M',
      '..F.M..F.M.M.MM.MMF.M.',
      '..M..F.M..W..M.MMM..M.',
      '..M.F..M.....M..MMMM..',
      '..F.M..F.M.M..M.MMMM..',
      'M........W............',
      'M........WW...........',
      'M........WW...........',
      'M........W............',
      '..F.M..F.M.M..M.MMMM..',
      '..M.F..M.....M..MMMM..',
      '..M..F.M..W..M.MMM..M.',
      '..F.M..F.M.M.MM.MMF.M.',
      'M.......W............M',
      'MMM.MM.MMMM..MMMMM.MMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 7 } },
      { commanderId: 'rosa', position: { x: 0, y: 8 } },
      { commanderId: 'gary', position: { x: 0, y: 6 } },
      { commanderId: 'sharon', position: { x: 0, y: 9 } },
      { commanderId: 'rain', position: { x: 0, y: 5 } },
      // 邪神碎片本體（中央深處）
      { commanderId: 'dark_god_shard', position: { x: 20, y: 7 } },
      // 復活的 BOSS 群（虛空之主使徒）
      { commanderId: 'cult_leader', position: { x: 18, y: 7 } },
      { commanderId: 'shadow', position: { x: 18, y: 5 } },
      { commanderId: 'high_priest', position: { x: 18, y: 9 } },
      { commanderId: 'eo', position: { x: 16, y: 7 } },
      // 虛空魔影（飛兵）
      { commanderId: 'void_wraith', position: { x: 15, y: 5 } },
      { commanderId: 'void_wraith', position: { x: 15, y: 9 } },
    ],
    victoryCondition: 'rout',
  },

  // ============================================
  // 隱藏章節：修羅戰場（gauntlet）
  // ============================================
  gauntlet: {
    id: 'gauntlet', name: '修羅戰場 — 夢境試煉',
    description: '所有 BOSS 同時降臨——這是夢境，也是試煉，也是某種告別。',
    gridWidth: 22, gridHeight: 16,
    bgColor: 0x100010,
    // 超現實浮島，混合所有過往戰場元素（森林 + 山岩 + 河流 + 廢墟）
    terrain: [
      'M.MM.M.MM.M.M.MM.M.MMM',
      '.W.......W..W.......W.',
      'F.M.F.F.M.FF.M.F.F.M.F',
      '...M...M.....M...M....',
      '...M...M..F..M...M....',
      'F.M.F.F.M.FF.M.F.F.M.F',
      '.W.......W..W.......W.',
      'M.MM.M.MM.M.M.MM.M.MMM',
      'M.MM.M.MM.M.M.MM.M.MMM',
      '.W.......W..W.......W.',
      'F.M.F.F.M.FF.M.F.F.M.F',
      '...M...M..F..M...M....',
      '...M...M.....M...M....',
      'F.M.F.F.M.FF.M.F.F.M.F',
      '.W.......W..W.......W.',
      'M.MM.M.MM.M.M.MM.M.MMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 7 } },
      { commanderId: 'rosa', position: { x: 0, y: 8 } },
      { commanderId: 'gary', position: { x: 0, y: 6 } },
      { commanderId: 'sharon', position: { x: 0, y: 9 } },
      { commanderId: 'rain', position: { x: 0, y: 5 } },
      // 全員 BOSS（含伊歐、副教主）
      { commanderId: 'cult_leader', position: { x: 20, y: 7 } },
      { commanderId: 'baron', position: { x: 20, y: 4 } },
      { commanderId: 'carl', position: { x: 20, y: 10 } },
      { commanderId: 'shadow', position: { x: 18, y: 6 } },
      { commanderId: 'high_priest', position: { x: 18, y: 8 } },
      { commanderId: 'eo', position: { x: 16, y: 7 } },
      { commanderId: 'sub_priest', position: { x: 17, y: 7 } },
    ],
    victoryCondition: 'rout',
  },
};

export const DEFAULT_SCENARIO_ID = 'intro';
