import type { SaveData, CommanderProgress } from '../types';
import { FIRST_CHAPTER_ID } from './chapters';

const STORAGE_KEY = 'web-srpg-save-v1';
const SAVE_VERSION = 1;

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveProgress(
  completedChapterId: string,
  nextChapterId: string | null,
  commanderProgress: Record<string, CommanderProgress>
): void {
  const existing = loadSave();
  const completedSet = new Set(existing?.completedChapterIds ?? []);
  completedSet.add(completedChapterId);
  const mergedProgress = {
    ...(existing?.commanderProgress ?? {}),
    ...commanderProgress,
  };
  const data: SaveData = {
    version: SAVE_VERSION,
    completedChapterIds: Array.from(completedSet),
    nextChapterId: nextChapterId ?? FIRST_CHAPTER_ID,
    commanderProgress: mergedProgress,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Save failed', e);
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

export function hasSave(): boolean {
  return loadSave() !== null;
}

export function getCommanderProgress(commanderId: string): CommanderProgress | null {
  const save = loadSave();
  if (!save) return null;
  return save.commanderProgress[commanderId] ?? null;
}

/** 取得「候補」武將 ID 集合（這些不出陣）*/
export function getExcludedCommanders(): Set<string> {
  const save = loadSave();
  return new Set(save?.excludedCommanderIds ?? []);
}

/** 切換武將的出陣/候補狀態，回傳新狀態（true = 出陣中、false = 候補）*/
export function toggleCommanderDeploy(commanderId: string): boolean {
  const existing = loadSave();
  const data: SaveData = existing ?? {
    version: SAVE_VERSION,
    completedChapterIds: [],
    nextChapterId: FIRST_CHAPTER_ID,
    commanderProgress: {},
    excludedCommanderIds: [],
    savedAt: new Date().toISOString(),
  };
  if (!data.excludedCommanderIds) data.excludedCommanderIds = [];
  const idx = data.excludedCommanderIds.indexOf(commanderId);
  let nowDeployed: boolean;
  if (idx >= 0) {
    data.excludedCommanderIds.splice(idx, 1);
    nowDeployed = true;
  } else {
    data.excludedCommanderIds.push(commanderId);
    nowDeployed = false;
  }
  data.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('toggleCommanderDeploy failed', e);
  }
  return nowDeployed;
}

/** 解鎖成就，若是新解鎖回傳 true */
export function unlockAchievement(id: string): boolean {
  const existing = loadSave();
  const data: SaveData = existing ?? {
    version: SAVE_VERSION,
    completedChapterIds: [],
    nextChapterId: FIRST_CHAPTER_ID,
    commanderProgress: {},
    achievements: [],
    savedAt: new Date().toISOString(),
  };
  if (!data.achievements) data.achievements = [];
  if (data.achievements.includes(id)) return false;
  data.achievements.push(id);
  data.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('unlockAchievement save failed', e);
  }
  return true;
}

export function getUnlockedAchievements(): Set<string> {
  const save = loadSave();
  return new Set(save?.achievements ?? []);
}

/** 設定武將裝備（Hub 換裝），保留現有 level/exp 不變 */
export function setCommanderEquipment(
  commanderId: string,
  weaponId: string | null,
  armorId: string | null
): void {
  const existing = loadSave();
  const data: SaveData = existing ?? {
    version: SAVE_VERSION,
    completedChapterIds: [],
    nextChapterId: FIRST_CHAPTER_ID,
    commanderProgress: {},
    savedAt: new Date().toISOString(),
  };
  if (!data.commanderProgress) data.commanderProgress = {};
  const current = data.commanderProgress[commanderId] ?? { level: 1, exp: 0 };
  data.commanderProgress[commanderId] = {
    ...current,
    weaponId,
    armorId,
  };
  data.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('setCommanderEquipment failed', e);
  }
}
