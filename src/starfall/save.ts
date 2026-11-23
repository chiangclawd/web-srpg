export const SAVE_KEY = 'starfall_save_v1';

export interface SaveData {
  lang?: 'zh' | 'en';
  sfx: number;
  /** 每關拿到的星數 */
  stars: Record<string, number>;
  /** 看過的教學提示 */
  tips: string[];
  /** 戰鬥演出速度 */
  fast: boolean;
}

let cache: SaveData | null = null;

export function save(): SaveData {
  if (cache) return cache;
  let raw: Partial<SaveData> = {};
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') as Partial<SaveData>;
  } catch {
    // 存檔壞掉或瀏覽器不給用：從頭開始
  }
  cache = { sfx: 0.7, stars: {}, tips: [], fast: false, ...raw };
  return cache;
}

export function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save()));
  } catch {
    // 無痕模式之類寫不進去：這次遊玩照常，只是不會留下紀錄
  }
}
