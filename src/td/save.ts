import { setLang, type Lang } from './i18n';
import type { Difficulty } from './sim/World';
import type { Quality } from './config';
import type { QuestDay } from './data/quests';
import { mirrorNativeSave } from './native';

/** localStorage 的存檔 key（App 版另外同步到原生儲存） */
export const SAVE_KEY = 'kb_td_save_v1';

/** 一位英雄的養成：經驗、技能配點（沒寫 = 推薦配點）、買過的專屬裝備與裝著的那件 */
export interface HeroSave {
  xp: number;
  ranks?: Record<string, number>;
  owned?: string[];
  gear?: string;
}

export interface SaveData {
  version: 1;
  /** 每關最佳星數 */
  stars: Record<string, number>;
  /** 星數升級（每欄已購買階數） */
  upgrades: Record<string, number>;
  heroes: Record<string, HeroSave>;
  selectedHero: string;
  seenEnemies: string[];
  /** 已播放過解鎖動畫的關卡 */
  unlockedSeen: string[];
  /** 已在地圖上介紹過的新英雄（舊存檔沒有這欄） */
  heroesSeen?: string[];
  /** 挑戰模式完成紀錄（各 1 星） */
  challenges: Record<string, { heroic?: boolean; iron?: boolean }>;
  achievements: string[];
  /** 無盡模式每關最佳波數 */
  endless: Record<string, number>;
  /** 每日挑戰：日期 → 最佳星數 */
  daily: Record<string, number>;
  /** 首領連戰：每張地圖的最佳星數 */
  bossrush: Record<string, number>;
  /** 商店貨幣 */
  gems: number;
  /** 道具庫存 */
  items: Record<string, number>;
  /** 已看過開場劇情的關卡 */
  storySeen: string[];
  /** 已看過的首次提示 */
  tipsSeen: string[];
  /** 已看過的最新更新內容編號 */
  newsSeen: number;
  /** 每日登入獎勵（舊存檔沒有這欄） */
  login?: { last: string; streak: number };
  /** 已發現的戰場彩蛋（關卡:序號；舊存檔沒有這欄） */
  eggs?: string[];
  /** 今天的每日任務與進度（舊存檔沒有這欄） */
  quests?: QuestDay;
  settings: {
    music: number;
    sfx: number;
    lang: Lang;
    difficulty: Difficulty;
    speed: number;
    /** 爆炸 / 首領登場時畫面震動 */
    shake: boolean;
    /** 畫質（重新整理後生效） */
    quality: Quality;
    /** 英雄／首領語音 */
    voice: boolean;
    /** 介面大小（字與彈出面板的倍率，重新整理後生效；舊存檔沒有這欄） */
    uiScale?: number;
    /** 3D 預渲染角色（預設開；舊存檔沒有這欄就補成開，玩家關掉過的維持關） */
    art3d?: boolean;
  };
  stats: { kills: number; plays: number; victories: number; towers: number; elites?: number; bosses?: number; playSec?: number; heroUse?: Record<string, number> };
}

function defaults(): SaveData {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'zh-TW';
  return {
    version: 1,
    stars: {},
    upgrades: {},
    heroes: { arthur: { xp: 0 }, elena: { xp: 0 }, lila: { xp: 0 }, rain: { xp: 0 }, aria: { xp: 0 }, sharon: { xp: 0 }, viktor: { xp: 0 }, shadow: { xp: 0 } },
    selectedHero: 'arthur',
    seenEnemies: [],
    unlockedSeen: ['l1'],
    challenges: {},
    achievements: [],
    endless: {},
    daily: {},
    bossrush: {},
    gems: 0,
    // 新玩家各送一個，讓道具列一開始就看得到
    items: { keg: 1, frost: 1, potion: 1, gold: 1 },
    storySeen: [],
    tipsSeen: [],
    newsSeen: 0,
    settings: { music: 0.6, sfx: 0.8, lang: /^zh-(cn|sg|my|hans)/i.test(nav) ? 'zhs' : nav.startsWith('zh') ? 'zh' : nav.startsWith('ja') ? 'ja' : 'en', difficulty: 'normal', speed: 1, shake: true, quality: 'auto', voice: true, art3d: true },
    stats: { kills: 0, plays: 0, victories: 0, towers: 0 },
  };
}

let data: SaveData = defaults();

/** 舊存檔缺少的欄位補上預設值 */
function migrate(parsed: Partial<SaveData>): SaveData {
  const d = defaults();
  return {
    ...d,
    ...parsed,
    settings: { ...d.settings, ...(parsed.settings ?? {}) },
    heroes: { ...d.heroes, ...(parsed.heroes ?? {}) },
    stats: { ...d.stats, ...(parsed.stats ?? {}) },
    items: { ...d.items, ...(parsed.items ?? {}) },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) data = migrate(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    data = defaults();
  }
  setLang(data.settings.lang);
  return data;
}

// ───────── 備份碼（換裝置 / 換瀏覽器時手動搬存檔） ─────────

const CODE_PREFIX = 'KB1:';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 把目前進度編成一段可複製的文字 */
export function exportSave(): string {
  return CODE_PREFIX + toBase64(JSON.stringify(data));
}

/** 讀入備份碼；格式不對回傳 false 且不動到現有存檔 */
export function importSave(code: string): boolean {
  const c = code.replace(/\s+/g, '');
  if (!c.startsWith(CODE_PREFIX)) return false;
  try {
    const parsed = JSON.parse(fromBase64(c.slice(CODE_PREFIX.length))) as Partial<SaveData>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.stars !== 'object' || parsed.stars === null) return false;
    data = migrate(parsed);
    persist();
    setLang(data.settings.lang);
    return true;
  } catch {
    return false;
  }
}

export function save(): SaveData {
  return data;
}

export function persist(): void {
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(SAVE_KEY, json);
  } catch {
    // 私密模式 / 容量不足：靜默失敗
  }
  mirrorNativeSave(SAVE_KEY, json);
}

/** 清除所有進度（保留音量 / 語言等設定） */
export function resetProgress(): void {
  const keep = data.settings;
  data = defaults();
  data.settings = keep;
  persist();
}

/** 戰役星數 + 挑戰星數（英雄 / 鋼鐵各 1 星）+ 首領連戰星數 */
export function totalStars(): number {
  const sum = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((a, b) => a + b, 0);
  let ch = 0;
  for (const c of Object.values(data.challenges ?? {})) ch += (c.heroic ? 1 : 0) + (c.iron ? 1 : 0);
  return sum(data.stars) + ch + sum(data.bossrush);
}

/** 每張地圖可拿的星數上限：戰役 3、英雄 1、鋼鐵 1、首領連戰 3 */
export const STARS_PER_LEVEL = 8;

export function spentStars(costs: (col: string, n: number) => number): number {
  let s = 0;
  for (const [col, n] of Object.entries(data.upgrades)) s += costs(col, n);
  return s;
}

export function resetSave(): void {
  data = defaults();
  persist();
}
