import { setLang, type Lang } from './i18n';
import type { Difficulty } from './sim/World';

const KEY = 'kb_td_save_v1';

export interface SaveData {
  version: 1;
  /** 每關最佳星數 */
  stars: Record<string, number>;
  /** 星數升級（每欄已購買階數） */
  upgrades: Record<string, number>;
  heroes: Record<string, { xp: number }>;
  selectedHero: string;
  seenEnemies: string[];
  /** 已播放過解鎖動畫的關卡 */
  unlockedSeen: string[];
  settings: {
    music: number;
    sfx: number;
    lang: Lang;
    difficulty: Difficulty;
    speed: number;
  };
  stats: { kills: number; plays: number; victories: number };
}

function defaults(): SaveData {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'zh-TW';
  return {
    version: 1,
    stars: {},
    upgrades: {},
    heroes: { arthur: { xp: 0 }, elena: { xp: 0 }, lila: { xp: 0 }, rain: { xp: 0 }, aria: { xp: 0 } },
    selectedHero: 'arthur',
    seenEnemies: [],
    unlockedSeen: ['l1'],
    settings: { music: 0.6, sfx: 0.8, lang: nav.startsWith('zh') ? 'zh' : 'en', difficulty: 'normal', speed: 1 },
    stats: { kills: 0, plays: 0, victories: 0 },
  };
}

let data: SaveData = defaults();

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const d = defaults();
      data = {
        ...d,
        ...parsed,
        settings: { ...d.settings, ...(parsed.settings ?? {}) },
        heroes: { ...d.heroes, ...(parsed.heroes ?? {}) },
        stats: { ...d.stats, ...(parsed.stats ?? {}) },
      };
    }
  } catch {
    data = defaults();
  }
  setLang(data.settings.lang);
  return data;
}

export function save(): SaveData {
  return data;
}

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 私密模式 / 容量不足：靜默失敗
  }
}

export function totalStars(): number {
  return Object.values(data.stars).reduce((a, b) => a + b, 0);
}

export function spentStars(costs: (col: string, n: number) => number): number {
  let s = 0;
  for (const [col, n] of Object.entries(data.upgrades)) s += costs(col, n);
  return s;
}

export function resetSave(): void {
  data = defaults();
  persist();
}
