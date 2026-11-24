// 雲端同步：用 Google 帳號登入之後，進度（星數、教學、改造、打到一半的戰鬥）在同一個人的各台裝置之間同步。
// 做法很單純：把雲端那份讀下來 → 跟本機的合併（規則在 merge.ts）→ 兩邊都寫成合併後的結果。
// 什麼時候做：登入時、開啟遊戲時、切回分頁時；本機的進度一有變動，幾秒後也做一次。
// 沒網路或失敗都不影響遊玩，本機存檔照常運作，下次有機會再同步。
import { applyProgress, localProgress, onSaveChanged } from '../save';
import { applySuspendRaw, onSuspendChanged, suspendRaw } from '../suspend';
import { FIREBASE_CONFIG } from './firebase-config';
import { cleanDoc, mergeProgress, mergeSuspend, progressKey } from './merge';
import type { CloudDoc } from './merge';

export interface CloudUser {
  uid: string;
  name: string;
}

/** 後端要提供的東西。正式的是 firebase.ts；自動化測試會塞一個假的到 window.__sfCloudBackend */
export interface CloudBackend {
  onUser(cb: (u: CloudUser | null) => void): void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  load(uid: string): Promise<unknown>;
  store(uid: string, doc: CloudDoc): Promise<void>;
}

export type CloudStatus = 'signedOut' | 'syncing' | 'synced' | 'error';
export interface CloudState {
  status: CloudStatus;
  user: CloudUser | null;
  /** 登入失敗的原因（視窗被擋、被關掉）；成功登入後清掉 */
  signInFailed: boolean;
}

/** 登入過的記號：下次開遊戲時才會去載入 Firebase、恢復登入狀態 */
const FLAG_KEY = 'starfall_cloud';
/** 這台裝置的進度上次是跟哪個帳號同步的 */
const UID_KEY = 'starfall_cloud_uid';
const PUSH_DELAY = 3000;

const state: CloudState = { status: 'signedOut', user: null, signInFailed: false };
const listeners = new Set<() => void>();
/** 同步把別台裝置的進度帶進來了：畫面要重畫 */
const changed = new Set<() => void>();
let backend: CloudBackend | null = null;
let loading: Promise<CloudBackend | null> | null = null;
let busy = false;
let again = false;
let applying = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastSync = 0;

const fake = (): CloudBackend | undefined => (globalThis as { __sfCloudBackend?: CloudBackend }).__sfCloudBackend;
const native = (): boolean => !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
const ls = (k: string, v?: string | null): string | null => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // 無痕模式之類：當作沒有
  }
  return null;
};

/** 這個版本有沒有開雲端同步（沒填 Firebase 設定就沒有，設定頁不會出現那一列） */
export const cloudAvailable = (): boolean => !!fake() || (!!FIREBASE_CONFIG.apiKey && !native());
export const cloudState = (): Readonly<CloudState> => state;
export function onCloud(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function onCloudChanged(cb: () => void): () => void {
  changed.add(cb);
  return () => changed.delete(cb);
}

function set(patch: Partial<CloudState>): void {
  Object.assign(state, patch);
  for (const cb of [...listeners]) cb();
}

/** 載入後端並開始聽登入狀態。設定頁一打開就先呼叫，這樣按下登入時可以馬上開視窗（等太久瀏覽器會擋彈出視窗） */
export function prepareCloud(): Promise<CloudBackend | null> {
  if (!cloudAvailable()) return Promise.resolve(null);
  loading ??= (async () => {
    try {
      backend = fake() ?? (await import('./firebase')).backend;
    } catch {
      loading = null;
      return null;
    }
    backend.onUser((u) => {
      if (u) {
        ls(FLAG_KEY, '1');
        set({ user: u, signInFailed: false });
        void syncNow();
      } else {
        ls(FLAG_KEY, null);
        set({ user: null, status: 'signedOut' });
      }
    });
    return backend;
  })();
  return loading;
}

export function cloudSignIn(): void {
  const go = (b: CloudBackend | null): void => {
    if (!b) return set({ signInFailed: true });
    b.signIn().catch(() => set({ signInFailed: true }));
  };
  // 已經載好就直接開視窗（還在點擊的當下）；沒有的話載完再開，被擋就請玩家再按一次
  if (backend) go(backend);
  else void prepareCloud().then(go);
}

export function cloudSignOut(): void {
  // 本機的進度留著：登出只是不再同步
  void backend?.signOut().catch(() => undefined);
}

/** 讀下來、合併、寫回去。同時只跑一個；跑的時候又有人要求，跑完再來一次 */
export async function syncNow(): Promise<void> {
  const user = state.user;
  if (!backend || !user) return;
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  set({ status: 'syncing' });
  try {
    const raw = await backend.load(user.uid);
    const remote = raw ? cleanDoc(raw) : null;
    const local = localProgress();
    const localBattle = suspendRaw();
    // 這台裝置上次是跟別的帳號同步的（換人登入）：不要把上一個人的進度併進這個帳號，直接用這個帳號雲端上的
    const other = ls(UID_KEY);
    const foreign = !!other && other !== user.uid && !!remote;
    const progress = remote ? (foreign ? remote : mergeProgress(local, remote)) : local;
    const battle = remote ? (foreign ? { json: remote.battle, at: remote.battleAt } : mergeSuspend(localBattle, { json: remote.battle, at: remote.battleAt })) : localBattle;
    let touched = false;
    applying = true;
    try {
      if (progressKey(progress) !== progressKey(local)) {
        applyProgress(progress);
        touched = true;
      }
      if (battle.json !== localBattle.json) {
        applySuspendRaw(battle);
        touched = true;
      }
    } finally {
      applying = false;
    }
    ls(UID_KEY, user.uid);
    if (!remote || progressKey(progress) !== progressKey(remote) || battle.json !== remote.battle) {
      await backend.store(user.uid, { v: 1, ...progress, battle: battle.json, battleAt: battle.at });
    }
    lastSync = Date.now();
    set({ status: 'synced' });
    if (touched) for (const cb of [...changed]) cb();
  } catch {
    set({ status: 'error' });
  } finally {
    busy = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

function queuePush(): void {
  if (applying || !state.user) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void syncNow(), PUSH_DELAY);
}

/** 開遊戲時呼叫一次 */
export function initCloud(): void {
  if (!cloudAvailable()) return;
  onSaveChanged(queuePush);
  onSuspendChanged(queuePush);
  // 之前登入過（或測試塞了假後端）：馬上恢復登入、同步一次。沒登入過的人不用下載 Firebase
  if (ls(FLAG_KEY) || fake()) void prepareCloud();
  document.addEventListener('visibilitychange', () => {
    if (!state.user) return;
    // 切走：把還在等的變動送出去。切回來：別台裝置可能玩過了，拉一次
    if (document.hidden ? pushTimer : Date.now() - lastSync > 20_000) void syncNow();
  });
}
