import type { ScenarioDef } from '../types';

export const SCENARIOS: Record<string, ScenarioDef> = {
  intro: {
    id: 'intro', name: '邊境哨站',
    description: '亞瑟一行人前往哨站途中遭遇敵方斥候，必須穿越河畔森林與山口決戰。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x1a2535,
    // 地形設計：
    //   - 中央有一條斜向河流（W），玩家必須繞過或經過淺灘
    //   - 玩家側多片森林（F）作為掩護位置
    //   - 敵方側山地（M）控制制高點
    //   - 中段右側有 1 處森林小島（讓蘿莎可以躲在後排射擊）
    terrain: [
      '..F........',
      '.FF.....M..',
      '..F..W..MM.',
      '....WW...F.',
      '...WW.F.F..',
      '..FF...FF..',
      '...........',
      '.....M..MM.',
    ],
    deployments: [
      // 玩家陣營（左下，森林周邊）
      { commanderId: 'arthur', position: { x: 1, y: 5 } },
      { commanderId: 'rosa', position: { x: 0, y: 6 } },
      { commanderId: 'gary', position: { x: 2, y: 6 } },
      // 敵方陣營（右上 4 名 — 比舊版多 1 弓兵）
      { commanderId: 'morden', position: { x: 9, y: 1 } },
      { commanderId: 'selene', position: { x: 10, y: 2 } },
      { commanderId: 'greg', position: { x: 8, y: 2 } },
      { commanderId: 'scout_archer', position: { x: 9, y: 4 } },
    ],
    victoryCondition: 'rout',
  },

  forest_pass: {
    id: 'forest_pass', name: '黑松森伏擊',
    description: '黑松森林中央僅一條曲折通路，敵軍從多個方向同時包夾。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x142a18,
    // 地形設計：
    //   - 中央是「狹窄通路」（plain），周圍全是森林
    //   - 通路本身扭曲，逼玩家不能直線推進
    //   - 兩側森林各有 1 個「埋伏點」（給敵方弓兵利用）
    //   - 玩家從西側入口進入，敵方從東、北、南三方包夾
    terrain: [
      '.FFFF.FFFF.',
      '.FF.F.F.FF.',
      '..F.FFF.F..',
      'FF...F....F',
      'F.FF...FF.F',
      '..F.FFF.F..',
      '.FF.F.F.FF.',
      '.FFFF.FFFF.',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 4 } },
      { commanderId: 'rosa', position: { x: 0, y: 5 } },
      { commanderId: 'gary', position: { x: 0, y: 3 } },
      // 敵方四方包夾（5 名 — 比舊版多 1 弓手）
      { commanderId: 'vlad', position: { x: 10, y: 3 } },
      { commanderId: 'caleb', position: { x: 10, y: 5 } },
      { commanderId: 'morden', position: { x: 8, y: 0 } }, // 北側衝鋒
      { commanderId: 'greg', position: { x: 8, y: 7 } },   // 南側包圍
      { commanderId: 'scout_archer', position: { x: 5, y: 0 } }, // 北側遠程伏擊
    ],
    victoryCondition: 'rout',
  },

  final_battle: {
    id: 'final_battle', name: '歐斯基峽谷',
    description: '伯朗將軍依山佈陣 — 兩翼山岩、中央河谷、要塞式障壁陣。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x301810,
    // 地形設計：
    //   - 兩側山地將戰場壓成走廊
    //   - 中央有一條河流（W）阻擋直線進攻
    //   - 河流上方有一條淺灘（plain）作為唯一渡口
    //   - 伯朗坐鎮中央高地，旁邊兩名副將從兩翼包夾
    terrain: [
      'MMM.....MMM',
      'MM.......MM',
      'M..F...F..M',
      '..WWW.WWW..',
      '....W.W....',
      '..F.....F..',
      'M.........M',
      'MM..MMM..MM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 3 } },
      { commanderId: 'rosa', position: { x: 0, y: 4 } },
      { commanderId: 'gary', position: { x: 0, y: 5 } },
      // 伯朗坐鎮中央高地
      { commanderId: 'baron', position: { x: 10, y: 4 } },
      // 兩翼副將
      { commanderId: 'vlad', position: { x: 9, y: 2 } },
      { commanderId: 'caleb', position: { x: 9, y: 6 } },
      // 河流渡口防守
      { commanderId: 'selene', position: { x: 7, y: 3 } },
      { commanderId: 'morden', position: { x: 8, y: 5 } },
      // 後排弓手
      { commanderId: 'scout_archer', position: { x: 10, y: 1 } },
    ],
    victoryCondition: 'rout',
  },

  river_ford: {
    id: 'river_ford', name: '伊特拉河渡口',
    description: '河中央有座島嶼困住夏倫——黑暗教派刺客已在外圍合圍。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x122a3a,
    // 地形設計：
    //   - 河流環繞中央島嶼，夏倫被困其中
    //   - 玩家從左側進入，需穿越淺灘
    //   - 教派刺客在島上（高威脅，必須優先解決）
    //   - 兩側河岸邊有森林作戰術掩護
    terrain: [
      'W.WWWWWWWW.',
      '.W..WW..WW.',
      'F.W....W..F',
      'F...F...FFW',
      'F..F....F.W',
      'F....F....F',
      'F.FF......W',
      '.WWWWW.WWW.',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 3 } },
      { commanderId: 'rosa', position: { x: 0, y: 4 } },
      { commanderId: 'gary', position: { x: 0, y: 5 } },
      // 夏倫被困在中央
      { commanderId: 'sharon', position: { x: 5, y: 4 } },
      // 圍攻夏倫的教派刺客 + 河岸守衛（共 6 名敵）
      { commanderId: 'cult_assassin', position: { x: 5, y: 3 } },
      { commanderId: 'hirsch', position: { x: 7, y: 4 } },
      { commanderId: 'mara', position: { x: 8, y: 3 } },
      { commanderId: 'caleb', position: { x: 6, y: 6 } },
      { commanderId: 'greg', position: { x: 8, y: 5 } },
      { commanderId: 'scout_archer', position: { x: 9, y: 2 } },
    ],
    victoryCondition: 'rout',
  },

  city_defense: {
    id: 'city_defense', name: '艾斯瑞特城圍城戰',
    description: '北方要衝艾斯瑞特城——城牆雖固，但敵軍從三面湧來。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x2a2618,
    // 地形設計：
    //   - 玩家方代表「城內守軍」，西側 1-2 列為城牆內側
    //   - 城牆（M）形成 L 形防線，玩家可借牆死守
    //   - 中央開闊地是攻城戰場
    //   - 攻城方有破壞工兵在外圍包圍
    terrain: [
      'MMM........',
      'M..........',
      'M.F........',
      'M.........F',
      'M..F.....F.',
      'M..........',
      'M.F........',
      'MMM........',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 1, y: 3 } },
      { commanderId: 'rosa', position: { x: 1, y: 4 } },
      { commanderId: 'gary', position: { x: 1, y: 5 } },
      { commanderId: 'sharon', position: { x: 1, y: 2 } },
      // 卡爾主力（中央）
      { commanderId: 'carl', position: { x: 10, y: 4 } },
      // 北翼壓制
      { commanderId: 'mara', position: { x: 10, y: 1 } },
      { commanderId: 'hirsch', position: { x: 9, y: 2 } },
      // 南翼壓制
      { commanderId: 'caleb', position: { x: 10, y: 6 } },
      { commanderId: 'morden', position: { x: 9, y: 5 } },
      // 工兵（教派刺客）潛入北面
      { commanderId: 'cult_assassin', position: { x: 8, y: 3 } },
    ],
    victoryCondition: 'rout',
  },

  palace_intrigue: {
    id: 'palace_intrigue', name: '王宮密室 — 伊歐的真面目',
    description: '王宮深處密室，伊歐侯爵與影武者親自設下陷阱。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x1a0a1a,
    // 地形設計：
    //   - 完全封閉的室內地圖（外圍全山岩 = 牆）
    //   - 中央 4 個立柱（M）切分成多條走廊
    //   - 伊歐坐鎮最深處，影武者在前面護衛
    //   - 立柱形成天然制高點/掩體（其實對玩家也適用）
    terrain: [
      'MMMMMMMMMMM',
      'M.........M',
      'M.M.M.M.M.M',
      'M.........M',
      'M.........M',
      'M.M.M.M.M.M',
      'M.........M',
      'MMMMMMMMMMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 1, y: 3 } },
      { commanderId: 'rosa', position: { x: 1, y: 4 } },
      { commanderId: 'gary', position: { x: 1, y: 5 } },
      { commanderId: 'sharon', position: { x: 1, y: 1 } },
      // 真正的 BOSS：伊歐侯爵（最深處）
      { commanderId: 'eo', position: { x: 9, y: 4 } },
      // 影武者（前線護衛）
      { commanderId: 'shadow', position: { x: 8, y: 3 } },
      // 護衛副將
      { commanderId: 'vlad', position: { x: 8, y: 4 } },
      { commanderId: 'selene', position: { x: 8, y: 5 } },
      // 雜兵（從南北包圍）
      { commanderId: 'cult_assassin', position: { x: 7, y: 1 } },
      { commanderId: 'cultist_1', position: { x: 7, y: 6 } },
      { commanderId: 'cult_assassin', position: { x: 9, y: 2 } },
    ],
    victoryCondition: 'rout',
  },

  mountain_ruins: {
    id: 'mountain_ruins', name: '黑暗山遺跡 — 邪神禱詞',
    description: '山中遺跡，主教施法中央，雷恩被綁在祭壇前。三方山口都有守軍。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x0e0e2a,
    // 地形設計：
    //   - 山岩環繞，僅東西兩個入口（玩家西、敵方東）
    //   - 中央祭壇區（plain）— 主教 + 雷恩在這
    //   - 北側峽口讓飛兵從上方俯衝（無山阻擋）
    //   - 森林少量點綴，給弓手伏擊位置
    terrain: [
      'MM......MMM',
      'MM......MMM',
      'M..F.......',
      '...FF.....M',
      '..FF......M',
      '...F.....FM',
      'M........FM',
      'MMM..MM.MMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 3 } },
      { commanderId: 'rosa', position: { x: 0, y: 4 } },
      { commanderId: 'gary', position: { x: 0, y: 5 } },
      { commanderId: 'sharon', position: { x: 0, y: 2 } },
      // 雷恩被綁在祭壇前（中央偏西）
      { commanderId: 'rain', position: { x: 5, y: 3 } },
      // 黑暗主教（祭壇後方，遠程詠唱）
      { commanderId: 'high_priest', position: { x: 9, y: 4 } },
      // 教徒護衛
      { commanderId: 'cultist_1', position: { x: 8, y: 2 } },
      { commanderId: 'cultist_2', position: { x: 8, y: 4 } },
      { commanderId: 'cultist_3', position: { x: 8, y: 6 } },
      // 飛兵從北側天空俯衝
      { commanderId: 'griffon_rider', position: { x: 5, y: 0 } },
      { commanderId: 'griffon_rider', position: { x: 7, y: 0 } },
    ],
    victoryCondition: 'rout',
  },

  // === 番外第 9 章：殘黨追擊 ===
  remnants_hunt: {
    id: 'remnants_hunt', name: '北域廢村 — 殘黨追擊',
    description: '教派殘黨於遺棄村落集結 — 副教主・凜試圖以血祭重啟禱詞。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x1a151a,
    // 地形：荒廢村落，斷垣殘壁的山岩遺蹟散佈
    terrain: [
      'M..F.....FM',
      '..MM.M.MM..',
      '...F...F..F',
      '.MM..F..MM.',
      'F.MM..F.MM.',
      'F..F...F...',
      '..MM.M.MM..',
      'M..F.....FM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 3 } },
      { commanderId: 'rosa', position: { x: 0, y: 4 } },
      { commanderId: 'gary', position: { x: 0, y: 5 } },
      { commanderId: 'sharon', position: { x: 0, y: 2 } },
      { commanderId: 'rain', position: { x: 0, y: 6 } },
      // 副教主・凜（祭壇中央）
      { commanderId: 'sub_priest', position: { x: 10, y: 4 } },
      // 狂信者護衛
      { commanderId: 'zealot_1', position: { x: 9, y: 3 } },
      { commanderId: 'zealot_2', position: { x: 9, y: 5 } }, // flier
      // 教徒散佈
      { commanderId: 'cultist_1', position: { x: 8, y: 2 } },
      { commanderId: 'cultist_2', position: { x: 8, y: 6 } },
      { commanderId: 'cultist_3', position: { x: 10, y: 7 } },
      { commanderId: 'cult_assassin', position: { x: 7, y: 4 } },
    ],
    victoryCondition: 'rout',
  },

  // === 番外第 10 章：真・最終決戰 ===
  true_finale: {
    id: 'true_finale', name: '虛空裂縫 — 邪神顯現',
    description: '殘黨儀式被獻祭啟動，召喚出邪神碎片本身——真正的最終戰。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x100020,
    // 地形：扭曲的時空，巨大的虛空柱+漂浮石塊
    terrain: [
      'MMM.MM.MMMM',
      'M.........M',
      '..F.M..F.M.',
      '..M..F.M...',
      '..M.F..M...',
      '..F.M..F.M.',
      'M.........M',
      'MMM.MM.MMMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 3 } },
      { commanderId: 'rosa', position: { x: 0, y: 4 } },
      { commanderId: 'gary', position: { x: 0, y: 5 } },
      { commanderId: 'sharon', position: { x: 0, y: 2 } },
      { commanderId: 'rain', position: { x: 0, y: 6 } },
      // 邪神碎片本體（中央深處）
      { commanderId: 'dark_god_shard', position: { x: 10, y: 4 } },
      // 復活的 BOSS 群（虛空之主使徒）
      { commanderId: 'cult_leader', position: { x: 9, y: 4 } },
      { commanderId: 'shadow', position: { x: 9, y: 2 } },
      { commanderId: 'high_priest', position: { x: 9, y: 6 } },
      { commanderId: 'eo', position: { x: 8, y: 4 } }, // 伊歐被虛空之主重新召喚！
      // 虛空魔影（飛兵）
      { commanderId: 'void_wraith', position: { x: 8, y: 3 } },
      { commanderId: 'void_wraith', position: { x: 8, y: 5 } },
    ],
    victoryCondition: 'rout',
  },

  // === 隱藏章節：修羅戰場（TRUE END 後解鎖）===
  gauntlet: {
    id: 'gauntlet', name: '修羅戰場 — 夢境試煉',
    description: '所有 BOSS 同時降臨——這是夢境，也是試煉，也是某種告別。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x100010,
    // 地形：超現實的浮島，混合所有過往戰場的元素（森林+山岩+流水）
    terrain: [
      'M.MM.M.MM.M',
      '.W.......W.',
      'F.M.F.F.M.F',
      '...M...M...',
      '...M...M...',
      'F.M.F.F.M.F',
      '.W.......W.',
      'M.MM.M.MM.M',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 3 } },
      { commanderId: 'rosa', position: { x: 0, y: 4 } },
      { commanderId: 'gary', position: { x: 0, y: 5 } },
      { commanderId: 'sharon', position: { x: 0, y: 2 } },
      { commanderId: 'rain', position: { x: 0, y: 6 } },
      // 全員 BOSS（含伊歐、副教主）
      { commanderId: 'cult_leader', position: { x: 10, y: 4 } },
      { commanderId: 'baron', position: { x: 10, y: 2 } },
      { commanderId: 'carl', position: { x: 10, y: 6 } },
      { commanderId: 'shadow', position: { x: 9, y: 3 } },
      { commanderId: 'high_priest', position: { x: 9, y: 5 } },
      { commanderId: 'eo', position: { x: 8, y: 4 } },
      { commanderId: 'sub_priest', position: { x: 9, y: 4 } },
    ],
    victoryCondition: 'rout',
  },

  finale: {
    id: 'finale', name: '虛空大殿 — 教主之間',
    description: '黑暗教派最深處，巨大祭壇環繞中央王座，教主・黯坐鎮其上。',
    gridWidth: 11, gridHeight: 8,
    bgColor: 0x2a040a,
    // 地形設計：
    //   - 中央王座（M）為教主・黯位置
    //   - 王座周圍 8 個祭壇柱（M）形成環陣，敵方使徒散佈其中
    //   - 玩家從西側進入，必須繞過柱陣才能接近教主
    //   - 兩側森林廢墟（F）給敵方弓手伏擊
    terrain: [
      'MMM.....MMM',
      'M.........M',
      'M..F..M.F.M',
      '....M...M..',
      '....M...M..',
      'M..F..M.F.M',
      'M.........M',
      'MMM.....MMM',
    ],
    deployments: [
      { commanderId: 'arthur', position: { x: 0, y: 3 } },
      { commanderId: 'rosa', position: { x: 0, y: 4 } },
      { commanderId: 'gary', position: { x: 0, y: 5 } },
      { commanderId: 'sharon', position: { x: 0, y: 2 } },
      { commanderId: 'rain', position: { x: 0, y: 6 } },
      // 教主・黯坐鎮中央王座東側
      { commanderId: 'cult_leader', position: { x: 10, y: 4 } },
      // 復活的影武者（伊歐留下的影子）+ 主教 + 雜兵
      { commanderId: 'shadow', position: { x: 8, y: 3 } },
      { commanderId: 'high_priest', position: { x: 8, y: 5 } },
      { commanderId: 'cultist_1', position: { x: 9, y: 2 } },
      { commanderId: 'cultist_2', position: { x: 9, y: 6 } },
      { commanderId: 'cultist_3', position: { x: 7, y: 4 } },
      { commanderId: 'cult_assassin', position: { x: 9, y: 3 } },
      { commanderId: 'cult_assassin', position: { x: 9, y: 5 } },
    ],
    victoryCondition: 'rout',
  },
};

export const DEFAULT_SCENARIO_ID = 'intro';
