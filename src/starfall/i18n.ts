import { persist, save } from './save';
import type { L10n } from './sim/types';

export type Lang = 'zh' | 'en';

export function getLang(): Lang {
  const sv = save();
  if (sv.lang) return sv.lang;
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'zh';
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function setLang(l: Lang): void {
  save().lang = l;
  persist();
}

export const L = (s: L10n | undefined): string => (s ? s[getLang()] : '');

const STR = {
  title: { zh: '星墜殘響', en: 'Starfall Echo' },
  subtitle: { zh: 'STARFALL ECHO', en: 'A Tactics Story' },
  start: { zh: '開始作戰', en: 'Deploy' },
  language: { zh: 'English', en: '中文' },
  tagline: { zh: '曙光號墜毀後第 80 年。船還記得它的任務。', en: 'Eighty years after the Aurelia fell, the ship still remembers its mission.' },
  earlyBuild: { zh: '搶先體驗版・全三章', en: 'Early build · All 3 chapters' },
  chapter1: { zh: '第一章　冰原上的訊號', en: 'Chapter 1 — A Signal on the Ice' },
  chapter2: { zh: '第二章　冬眠艙的歌聲', en: 'Chapter 2 — The Song in the Sleep Bay' },
  chapter3: { zh: '第三章　點名', en: 'Chapter 3 — Roll Call' },
  chapterTab: { zh: '第 {0} 章', en: 'Chapter {0}' },
  chapterLocked: { zh: '完成上一章後開放', en: 'Clear the previous chapter to unlock' },
  mission: { zh: '任務 {0}', en: 'Mission {0}' },
  locked: { zh: '完成前一個任務後開放', en: 'Clear the previous mission to unlock' },
  sortie: { zh: '出擊', en: 'Sortie' },
  back: { zh: '返回', en: 'Back' },
  objective: { zh: '目標', en: 'Objective' },
  failLeader: { zh: '隊長機「獵犬」被擊破即失敗', en: 'Fail if the leader frame Hound is destroyed' },
  failProtect: { zh: '隊長機或{0}被擊破即失敗', en: 'Fail if Hound or the {0} is destroyed' },
  turn: { zh: '回合 {0}', en: 'Turn {0}' },
  turnOf: { zh: '回合 {0} / {1}', en: 'Turn {0} / {1}' },
  playerPhase: { zh: '我方回合', en: 'Your Turn' },
  enemyPhase: { zh: '機群行動', en: 'Enemy Turn' },
  endTurn: { zh: '結束回合', en: 'End Turn' },
  endTurnConfirm: { zh: '還有 {0} 台沒行動\n再按一次結束', en: '{0} unit(s) can still act\nTap again to end' },
  attack: { zh: '攻擊', en: 'Attack' },
  overwatch: { zh: '警戒', en: 'Overwatch' },
  wait: { zh: '待機', en: 'Wait' },
  cancel: { zh: '取消', en: 'Cancel' },
  confirm: { zh: '確定', en: 'Confirm' },
  undo: { zh: '退回', en: 'Undo' },
  cooldown: { zh: '冷卻 {0}', en: 'CD {0}' },
  afterMove: { zh: '已移動', en: 'Moved' },
  noTarget: { zh: '沒有目標', en: 'No target' },
  pickTarget: { zh: '選擇目標', en: 'Choose a target' },
  pickDir: { zh: '選擇方向', en: 'Choose a direction' },
  forecast: { zh: '預估', en: 'Forecast' },
  dmg: { zh: '傷害', en: 'Damage' },
  counter: { zh: '反擊', en: 'Counter' },
  noCounter: { zh: '無法反擊', en: 'No counter' },
  kill: { zh: '擊破', en: 'Kill' },
  heal: { zh: '修復', en: 'Repair' },
  stunned: { zh: '癱瘓', en: 'Disabled' },
  hp: { zh: '耐久', en: 'HP' },
  move: { zh: '移動', en: 'Move' },
  armor: { zh: '裝甲', en: 'Armor' },
  range: { zh: '射程', en: 'Range' },
  mod_height: { zh: '高低差', en: 'Height' },
  mod_flank_side: { zh: '側擊', en: 'Flank' },
  mod_flank_back: { zh: '背襲', en: 'Rear' },
  mod_cover: { zh: '掩體', en: 'Cover' },
  mod_aura: { zh: '指揮', en: 'Command' },
  mod_guard: { zh: '壁壘', en: 'Bulwark' },
  mod_swarm: { zh: '群聚', en: 'Swarm' },
  mod_skill: { zh: '技能', en: 'Skill' },
  mod_reaction: { zh: '反應射擊', en: 'Reaction' },
  mod_armor: { zh: '裝甲', en: 'Armor' },
  mod_splash: { zh: '濺射', en: 'Splash' },
  mod_collide: { zh: '撞擊', en: 'Impact' },
  mod_shield: { zh: '塔盾', en: 'Shield' },
  mod_execute: { zh: '獵殺', en: 'Finisher' },
  holdProgress: { zh: '同步 {0} / {1}', en: 'Sync {0} / {1}' },
  holdBroken: { zh: '同步中斷 —— 艾可要回到控制台上', en: 'Sync broken. Echo must get back on the console' },
  rallyDone: { zh: '再行動', en: 'Act again' },
  star3hold: { zh: '{0} 回合內完成同步', en: 'Sync completed within {0} turns' },
  leapHere: { zh: '跳到這一格（之後還能攻擊）', en: 'Leap here (you can still attack)' },
  pickTile: { zh: '選擇落點', en: 'Choose a landing tile' },
  music: { zh: '音樂：{0}', en: 'Music: {0}' },
  difficulty: { zh: '難度：{0}', en: 'Difficulty: {0}' },
  diffNormal: { zh: '一般', en: 'Normal' },
  diffEasy: { zh: '輕鬆', en: 'Easy' },
  diffNote: { zh: '輕鬆：敵方傷害 -25%、耐久 -15%（重新開始後生效）', en: 'Easy: enemies deal 25% less damage and have 15% less HP (applies after a restart)' },
  retryEasy: { zh: '改用輕鬆難度', en: 'Retry on Easy' },
  easyTag: { zh: '輕鬆難度', en: 'Easy' },
  cover1: { zh: '掩體：直射傷害 -25%', en: 'Cover: -25% direct damage' },
  cover2: { zh: '堅固掩體：直射傷害 -40%', en: 'Heavy cover: -40% direct damage' },
  height: { zh: '高度 {0}', en: 'Height {0}' },
  victory: { zh: '任務完成', en: 'Mission Complete' },
  defeat: { zh: '任務失敗', en: 'Mission Failed' },
  lose_leader: { zh: '隊長機被擊破', en: 'The squad leader was destroyed' },
  lose_protect: { zh: '保護目標被摧毀', en: 'The protected target was destroyed' },
  lose_wiped: { zh: '全隊被擊破', en: 'The squad was wiped out' },
  star1: { zh: '完成任務', en: 'Mission cleared' },
  star2: { zh: '沒有機體被擊破', en: 'No frames lost' },
  star3par: { zh: '{0} 回合內完成', en: 'Cleared within {0} turns' },
  star3hp: { zh: '保護目標耐久一半以上', en: 'Protected target above half HP' },
  retry: { zh: '重新挑戰', en: 'Retry' },
  next: { zh: '下一個任務', en: 'Next Mission' },
  toMissions: { zh: '回任務列表', en: 'Mission List' },
  menu: { zh: '選單', en: 'Menu' },
  resume: { zh: '繼續', en: 'Resume' },
  restart: { zh: '重新開始', en: 'Restart' },
  quit: { zh: '離開任務', en: 'Leave Mission' },
  sound: { zh: '音效：{0}', en: 'Sound: {0}' },
  on: { zh: '開', en: 'On' },
  off: { zh: '關', en: 'Off' },
  speed: { zh: '演出速度：{0}', en: 'Speed: {0}' },
  normal: { zh: '一般', en: 'Normal' },
  fast: { zh: '快速', en: 'Fast' },
  skip: { zh: '跳過', en: 'Skip' },
  tapNext: { zh: '點一下繼續', en: 'Tap to continue' },
  reinforce: { zh: '增援抵達', en: 'Reinforcements' },
  threat: { zh: '威脅範圍', en: 'Threat range' },
  enemyUnit: { zh: '敵方', en: 'Enemy' },
  chapterEnd: { zh: '《星墜殘響》主線完結 —— 感謝遊玩！', en: 'Starfall Echo: the story is complete. Thank you for playing!' },
  tip_move: { zh: '點自己的機體，再點藍色格子移動。移動後可以攻擊、用技能，或按「退回」重選', en: 'Tap one of your frames, then a blue tile to move. After moving you can attack, use a skill, or tap Undo' },
  tip_flank: { zh: '從側面或背後攻擊傷害更高；站在高處射得更遠、打得更痛', en: 'Attacks from the side or rear hit harder. High ground gives more range and damage' },
  tip_cover: { zh: '站在貨櫃或殘骸堆上的單位受到的射擊傷害較低 —— 貼到它旁邊開火就能無視掩體', en: 'Units on cargo cover or wreckage take less ranged damage. Fire from an adjacent tile to ignore cover' },
  tip_overwatch: { zh: '「警戒」：這回合不攻擊，敵人走進射程時自動開火一次', en: 'Overwatch: skip your attack and automatically fire once at an enemy that enters your range' },
  tip_shield: { zh: '「堡壘」正面有塔盾，傷害減半。看它腳邊的箭頭：繞到側面或背後再打', en: 'A Bastion halves damage from the front. Check the arrow at its feet and attack from the side or rear' },
  tip_leap: { zh: '雨燕的「噴射躍進」可以跳過裂谷、高牆和敵人的警戒，落地後還能攻擊 —— 很適合繞背', en: "Swift's Jet Leap crosses chasms, walls and enemy overwatch, and she can still attack after landing. Great for getting behind things" },
  tip_mender: { zh: '「修補者」會修理附近的敵人，連首領也修。先打掉它，不然敵人的耐久會一直回來', en: 'Menders repair nearby enemies, bosses included. Kill them first, or enemy HP keeps coming back' },
  tip_hold: { zh: '讓艾可站在發綠光的控制台上。每撐過一個敵方回合算一次同步；她離開或被打下來就要重算', en: 'Put Echo on the glowing green console. Each enemy turn she survives there counts as one sync. If she leaves, the count starts over' },
  tip_rally: { zh: '海爾少校的「督戰令」可以讓一台已經行動過的友軍再動一次 —— 留給火力最強的人', en: "Major Hale's Rally Order lets an ally that has already acted act again. Save it for your hardest hitter" },
  tip_forecast: { zh: '傷害是固定的：出手前看到的預估數字就是實際結果', en: 'Damage is fixed: the forecast you see before firing is exactly what happens' },
  rotate: { zh: '請將裝置橫向使用', en: 'Please rotate your device' },
} satisfies Record<string, L10n>;

export type StrKey = keyof typeof STR;

export function T(key: StrKey, ...args: (string | number)[]): string {
  let s: string = STR[key][getLang()];
  args.forEach((a, i) => {
    s = s.replace(`{${i}}`, String(a));
  });
  return s;
}
