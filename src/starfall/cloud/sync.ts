// 雲端同步：用 Google 帳號登入之後，三個存檔（星數、教學、改造、打到一半的戰鬥）在同一個人的各台裝置之間同步。
// 做法很單純：把雲端那份讀下來 → 每個存檔各自跟本機的合併（規則在 merge.ts）→ 兩邊都寫成合併後的結果。
// 什麼時候做：登入時、開啟遊戲時、切回分頁時；本機的進度一有變動，幾秒後也做一次。
// 沒網路或失敗都不影響遊玩，本機存檔照常運作，下次有機會再同步。
import { onSaveChanged } from '../save';
import { putSlot, slotData } from '../slots';
import { onSuspendChanged } from '../suspend';
import { FIREBASE_CONFIG } from './firebase-config';
import { SLOTS, mergeSlot, readDoc, sameSlot, writeDoc } from './merge';
import type { CloudDoc, SlotData, SlotId } from './merge';

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
  /** 再確認一次是本人（重新選一次帳號）。選了別的帳號、把視窗關掉或被擋住都算失敗 */
  reauth(): Promise<void>;
  /** 刪掉這個帳號的雲端存檔 */
  remove(uid: string): Promise<void>;
  /** 刪掉這個帳號在這個遊戲的登入紀錄。刪完就是登出的狀態 */
  removeUser(): Promise<void>;
}

export type CloudStatus = 'signedOut' | 'syncing' | 'synced' | 'error';
export interface CloudState {
  status: CloudStatus;
  user: CloudUser | null;
  /** 登入失敗的原因（視窗被擋、被關掉）；成功登入後清掉 */
  signInFailed: boolean;
  /** 這個帳號的雲端資料在別的裝置被刪掉了，這台因此登出；重新登入後清掉 */
  erasedElsewhere: boolean;
}

/**
 * 刪除雲端資料的結果。done = 雲端存檔和登入紀錄都刪了；cancelled = 沒有通過帳號確認，什麼都沒刪；
 * failed = 確認過了但雲端存檔沒刪成，什麼都沒刪；partial = 雲端存檔刪了，登入紀錄沒刪成（已經先登出，重新登入後可以再刪一次）
 */
export type EraseResult = 'done' | 'cancelled' | 'failed' | 'partial';

/** 登入過的記號：下次開遊戲時才會去載入 Firebase、恢復登入狀態 */
const FLAG_KEY = 'starfall_cloud';
/** 這台裝置的進度上次是跟哪個帳號同步的 */
const UID_KEY = 'starfall_cloud_uid';
const PUSH_DELAY = 3000;

const state: CloudState = { status: 'signedOut', user: null, signInFailed: false, erasedElsewhere: false };
const listeners = new Set<() => void>();
/** 同步把別台裝置的進度帶進來了：畫面要重畫 */
const changed = new Set<() => void>();
let backend: CloudBackend | null = null;
let loading: Promise<CloudBackend | null> | null = null;
let busy = false;
let again = false;
let applying = false;
/** 正在刪除雲端資料：這段時間不同步，不然剛刪掉的又被傳回去 */
let erasing = false;
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

/** 這個版本有沒有開雲端同步（沒填 Firebase 設定就沒有，登入的按鈕不會出現） */
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

/** 載入後端並開始聽登入狀態。標題畫面一出現就先呼叫，這樣按下登入時可以馬上開視窗（等太久瀏覽器會擋彈出視窗） */
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
        set({ user: u, signInFailed: false, erasedElsewhere: false });
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

/**
 * 刪除雲端資料：這個帳號的雲端存檔，連同它在這個遊戲的登入紀錄。這台裝置上的存檔不動。
 * 要在按鈕的點擊裡直接呼叫：第一步會開 Google 的視窗再確認一次帳號，等過別的事才開會被瀏覽器擋掉。
 * 先確認、再刪存檔、最後刪登入紀錄：前兩步失敗就什麼都沒刪。
 */
export async function cloudErase(): Promise<EraseResult> {
  const b = backend;
  const user = state.user;
  if (!b || !user || erasing) return 'failed';
  erasing = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  try {
    try {
      await b.reauth();
    } catch {
      return 'cancelled';
    }
    // 確認帳號的那幾秒裡如果有一次同步還在跑，等它寫完再刪
    while (busy) await new Promise((r) => setTimeout(r, 50));
    try {
      await b.remove(user.uid);
    } catch {
      return 'failed';
    }
    ls(UID_KEY, null);
    try {
      await b.removeUser();
    } catch {
      // 存檔刪了、登入紀錄還在：先登出，不然下一次同步會把這台的進度又傳上去
      await b.signOut().catch(() => undefined);
      ls(FLAG_KEY, null);
      set({ user: null, status: 'signedOut' });
      return 'partial';
    }
    ls(FLAG_KEY, null);
    set({ user: null, status: 'signedOut' });
    return 'done';
  } finally {
    erasing = false;
  }
}

/** 讀下來、合併、寫回去。同時只跑一個；跑的時候又有人要求，跑完再來一次 */
export async function syncNow(): Promise<void> {
  const user = state.user;
  if (!backend || !user || erasing) return;
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
    const remote = raw ? readDoc(raw) : null;
    // 這台跟這個帳號同步過，雲端上那一份卻不見了：是在別的裝置按了「刪除雲端資料」。
    // 不要把這台的進度再傳上去（那樣等於沒刪），登出就好；這台裝置上的存檔留著。
    if (!remote && ls(UID_KEY) === user.uid) {
      ls(UID_KEY, null);
      ls(FLAG_KEY, null);
      await backend.signOut().catch(() => undefined);
      set({ user: null, status: 'signedOut', erasedElsewhere: true });
      return;
    }
    // 這台裝置上次是跟別的帳號同步的（換人登入）：不要把上一個人的進度併進這個帳號，直接用這個帳號雲端上的
    const other = ls(UID_KEY);
    const foreign = !!other && other !== user.uid && !!remote;
    const merged = {} as Record<SlotId, SlotData>;
    let touched = false;
    let push = !remote;
    applying = true;
    try {
      for (const n of SLOTS) {
        const local = slotData(n);
        const theirs = remote?.[n];
        const m = theirs ? (foreign ? theirs : mergeSlot(local, theirs)) : local;
        merged[n] = m;
        if (!sameSlot(m, local)) {
          putSlot(n, m);
          touched = true;
        }
        if (theirs && !sameSlot(m, theirs)) push = true;
      }
    } finally {
      applying = false;
    }
    if (push && !erasing) await backend.store(user.uid, writeDoc(merged));
    // 雲端上確定有這個帳號的存檔了才記：之後那一份不見，就知道是被刪掉的，不是還沒傳上去
    ls(UID_KEY, user.uid);
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
