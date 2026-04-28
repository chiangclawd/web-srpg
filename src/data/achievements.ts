export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** 隱藏型成就：未解鎖時不顯示名稱與敘述 */
  hidden?: boolean;
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  first_blood: {
    id: 'first_blood',
    name: '初次勝利',
    desc: '完成第 1 章「初遇敵軍」',
  },
  forest_clear: {
    id: 'forest_clear',
    name: '森林獵手',
    desc: '完成第 2 章「森林伏擊」',
  },
  defeat_baron: {
    id: 'defeat_baron',
    name: '王國終結者的終結者',
    desc: '擊敗伯朗將軍（完成第 3 章）',
  },
  recruit_sharon: {
    id: 'recruit_sharon',
    name: '法米爾秘術師',
    desc: '救出夏倫並讓她加入隊伍',
  },
  city_defended: {
    id: 'city_defended',
    name: '艾斯瑞特守護者',
    desc: '完成第 5 章「艾斯瑞特城」',
  },
  shadow_ended: {
    id: 'shadow_ended',
    name: '光明照入暗影',
    desc: '擊敗影武者（完成第 6 章）',
  },
  recruit_rain: {
    id: 'recruit_rain',
    name: '王國騎士',
    desc: '救出雷恩並讓他加入隊伍',
  },
  main_complete: {
    id: 'main_complete',
    name: '主線完結',
    desc: '完成第 8 章「虛空大殿」',
  },
  remnants_done: {
    id: 'remnants_done',
    name: '殘黨清算',
    desc: '完成第 9 章「殘黨追擊」',
  },
  true_end: {
    id: 'true_end',
    name: 'TRUE END',
    desc: '完成第 10 章「虛空裂縫」',
    hidden: true,
  },
  no_loss_chapter: {
    id: 'no_loss_chapter',
    name: '無傷通過',
    desc: '單章戰鬥內所有我方武將都未撤退',
  },
  lvl_10: {
    id: 'lvl_10',
    name: '老兵',
    desc: '任一武將達到 LV 10',
  },
  lvl_15: {
    id: 'lvl_15',
    name: '英雄',
    desc: '任一武將達到 LV 15',
  },
  all_recruited: {
    id: 'all_recruited',
    name: '五人成軍',
    desc: '招募所有 5 位玩家武將',
  },
  mine_cleared: {
    id: 'mine_cleared',
    name: '碎片計畫一支',
    desc: '完成第 12 章「鐵礦山的虛空殘渣」',
    hidden: true,
  },
  trial_complete: {
    id: 'trial_complete',
    name: '老兵之證',
    desc: '完成「次要試煉（Boss Rush）」',
    hidden: true,
  },
  archive_cleared: {
    id: 'archive_cleared',
    name: '碎片計畫二支',
    desc: '完成第 13 章「王都的影子」',
    hidden: true,
  },
  shard_arc_complete: {
    id: 'shard_arc_complete',
    name: '碎片計畫終結',
    desc: '完成第 14 章「議院的永生」— 後日談落幕',
    hidden: true,
  },
};

/** 章節 id → 完成解鎖的成就 id */
export const CHAPTER_COMPLETE_ACHIEVEMENT: Record<string, string> = {
  chapter1: 'first_blood',
  chapter2: 'forest_clear',
  chapter3: 'defeat_baron',
  chapter4: 'recruit_sharon',
  chapter5: 'city_defended',
  chapter6: 'shadow_ended',
  chapter7: 'recruit_rain',
  chapter8: 'main_complete',
  chapter9: 'remnants_done',
  chapter10: 'true_end',
  chapter12: 'mine_cleared',
  chapter13: 'archive_cleared',
  chapter14: 'shard_arc_complete',
  chapter_trial: 'trial_complete',
};
