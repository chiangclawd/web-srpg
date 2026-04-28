import type { ChapterDef } from '../types';

export const CHAPTERS: Record<string, ChapterDef> = {
  chapter1: {
    id: 'chapter1', number: 1, title: '初遇敵軍',
    prologueCutsceneId: 'ch1_prologue',
    scenarioId: 'intro',
    victoryCutsceneId: 'ch1_victory',
    defeatCutsceneId: 'ch1_defeat',
    nextChapterId: 'chapter2',
  },
  chapter2: {
    id: 'chapter2', number: 2, title: '森林伏擊',
    prologueCutsceneId: 'ch2_prologue',
    scenarioId: 'forest_pass',
    victoryCutsceneId: 'ch2_victory',
    defeatCutsceneId: 'ch2_defeat',
    nextChapterId: 'chapter3',
  },
  chapter3: {
    id: 'chapter3', number: 3, title: '邊境決戰',
    prologueCutsceneId: 'ch3_prologue',
    scenarioId: 'final_battle',
    victoryCutsceneId: 'ch3_victory',
    defeatCutsceneId: 'ch3_defeat',
    nextChapterId: 'chapter4',
  },
  chapter4: {
    id: 'chapter4', number: 4, title: '河岸渡口',
    prologueCutsceneId: 'ch4_prologue',
    scenarioId: 'river_ford',
    victoryCutsceneId: 'ch4_victory',
    defeatCutsceneId: 'ch4_defeat',
    nextChapterId: 'chapter5',
  },
  chapter5: {
    id: 'chapter5', number: 5, title: '艾斯瑞特城',
    prologueCutsceneId: 'ch5_prologue',
    scenarioId: 'city_defense',
    victoryCutsceneId: 'ch5_victory',
    defeatCutsceneId: 'ch5_defeat',
    nextChapterId: 'chapter6',
  },
  chapter6: {
    id: 'chapter6', number: 6, title: '王宮密室',
    prologueCutsceneId: 'ch6_prologue',
    scenarioId: 'palace_intrigue',
    victoryCutsceneId: 'ch6_victory',
    defeatCutsceneId: 'ch6_defeat',
    nextChapterId: 'chapter7',
  },
  chapter7: {
    id: 'chapter7', number: 7, title: '黑暗山遺跡',
    prologueCutsceneId: 'ch7_prologue',
    scenarioId: 'mountain_ruins',
    victoryCutsceneId: 'ch7_victory',
    defeatCutsceneId: 'ch7_defeat',
    nextChapterId: 'chapter8',
  },
  chapter8: {
    id: 'chapter8', number: 8, title: '虛空大殿',
    prologueCutsceneId: 'ch8_prologue',
    scenarioId: 'finale',
    victoryCutsceneId: 'ch8_victory',
    defeatCutsceneId: 'ch8_defeat',
    nextChapterId: 'chapter9',
  },
  chapter9: {
    id: 'chapter9', number: 9, title: '殘黨追擊',
    prologueCutsceneId: 'ch9_prologue',
    scenarioId: 'remnants_hunt',
    victoryCutsceneId: 'ch9_victory',
    defeatCutsceneId: 'ch9_defeat',
    nextChapterId: 'chapter10',
  },
  chapter10: {
    id: 'chapter10', number: 10, title: '虛空裂縫',
    prologueCutsceneId: 'ch10_prologue',
    scenarioId: 'true_finale',
    victoryCutsceneId: 'ch10_victory',
    defeatCutsceneId: 'ch10_defeat',
    // TRUE END — 無 next（解鎖 chapter11 為隱藏挑戰）
  },
  chapter11: {
    id: 'chapter11', number: 11, title: '修羅戰場',
    prologueCutsceneId: 'ch11_prologue',
    scenarioId: 'gauntlet',
    victoryCutsceneId: 'ch11_victory',
    defeatCutsceneId: 'ch11_defeat',
    // 隱藏終 — 無 next
  },
  // 後日談（TRUE END 後解鎖；TitleScene 從專屬入口進）
  chapter12: {
    id: 'chapter12', number: 12, title: '鐵礦山的虛空殘渣',
    prologueCutsceneId: 'ch12_prologue',
    scenarioId: 'mine_outskirts',
    victoryCutsceneId: 'ch12_victory',
    defeatCutsceneId: 'ch12_defeat',
    // 後日談首章 — 暫無 next（之後 Ch13+ 接上）
  },
  // C3 變體：次要試煉（Boss Rush）— 解 mine_cleared 後 TitleScene 顯示專屬入口
  chapter_trial: {
    id: 'chapter_trial', number: 99, title: '次要試煉（Boss Rush）',
    prologueCutsceneId: 'trial_prologue',
    scenarioId: 'hero_trial',
    victoryCutsceneId: 'trial_victory',
    defeatCutsceneId: 'trial_defeat',
    // 變體挑戰 — 無 next，可重複進入
  },
};

export const FIRST_CHAPTER_ID = 'chapter1';
