// 刪除雲端資料：帳號確認沒過、或雲端存檔沒刪成，就什麼都不刪；刪了之後這台裝置的存檔還在；
// 別的裝置發現雲端那一份不見了，不會把自己的進度再傳上去（那樣等於沒刪）。
// 用假的後端（window.__sfCloudBackend）跑真的 sync.ts；localStorage 也是假的，要在載入遊戲的模組之前放好。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CloudBackend, CloudUser } from '../../src/starfall/cloud/sync';
import type { CloudDoc } from '../../src/starfall/cloud/merge';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

/** 假的雲端：docs 是每個帳號的那一份文件，log 記下後端被呼叫的順序 */
const cloud = {
  docs: {} as Record<string, CloudDoc>,
  user: null as CloudUser | null,
  cb: (_u: CloudUser | null): void => undefined,
  log: [] as string[],
  fail: { reauth: false, remove: false, removeUser: false },
  /** 設了的話，store 會等它解開才寫進去（模擬寫到一半） */
  hold: null as Promise<void> | null,
};
const backend: CloudBackend = {
  onUser(cb) {
    cloud.cb = cb;
  },
  async signIn() {
    cloud.user = { uid: 'u1', name: 'Tester' };
    cloud.cb(cloud.user);
  },
  async signOut() {
    cloud.log.push('signOut');
    cloud.user = null;
    cloud.cb(null);
  },
  async load(uid) {
    cloud.log.push('load');
    return cloud.docs[uid] ?? null;
  },
  async store(uid, doc) {
    cloud.log.push('store');
    if (cloud.hold) await cloud.hold;
    cloud.docs[uid] = doc;
    cloud.log.push('stored');
  },
  async reauth() {
    cloud.log.push('reauth');
    if (cloud.fail.reauth) throw new Error('popup closed');
  },
  async remove(uid) {
    if (cloud.fail.remove) throw new Error('offline');
    cloud.log.push('remove');
    delete cloud.docs[uid];
  },
  async removeUser() {
    if (cloud.fail.removeUser) throw new Error('not allowed');
    cloud.log.push('removeUser');
    cloud.user = null;
    cloud.cb(null);
  },
};
(globalThis as { __sfCloudBackend?: CloudBackend }).__sfCloudBackend = backend;

const { cloudErase, cloudSignIn, cloudState, prepareCloud, syncNow } = await import('../../src/starfall/cloud/sync');
const { putSlot, slotData } = await import('../../src/starfall/slots');
const { emptySlot } = await import('../../src/starfall/cloud/merge');

const tick = (ms = 5): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** 等同步跑完 */
async function settle(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    await tick();
    if (cloudState().status !== 'syncing') return;
  }
  throw new Error('sync did not settle');
}
async function signIn(): Promise<void> {
  cloudSignIn();
  for (let i = 0; i < 200 && !cloudState().user; i++) await tick();
  await settle();
}
const reset = (): void => {
  cloud.log.length = 0;
  cloud.fail = { reauth: false, remove: false, removeUser: false };
  cloud.hold = null;
};

test('登入後同步：這台的進度傳上去，記下跟哪個帳號同步過', async () => {
  await prepareCloud();
  putSlot(1, { ...emptySlot(), stars: { m1: 3, m2: 2 }, at: 5 });
  await signIn();
  assert.equal(cloudState().status, 'synced');
  assert.deepEqual(cloud.docs.u1?.stars, { m1: 3, m2: 2 });
  assert.equal(store.get('starfall_cloud_uid'), 'u1');
});

test('刪除雲端資料：帳號確認沒過，什麼都不刪', async () => {
  reset();
  cloud.fail.reauth = true;
  assert.equal(await cloudErase(), 'cancelled');
  assert.ok(cloud.docs.u1, '雲端存檔還在');
  assert.equal(cloudState().user?.uid, 'u1');
  assert.deepEqual(cloud.log, ['reauth']);
});

test('刪除雲端資料：雲端存檔沒刪成，登入紀錄也不刪', async () => {
  reset();
  cloud.fail.remove = true;
  assert.equal(await cloudErase(), 'failed');
  assert.ok(cloud.docs.u1);
  assert.equal(cloudState().user?.uid, 'u1');
  assert.ok(!cloud.log.includes('removeUser'));
  assert.equal(store.get('starfall_cloud_uid'), 'u1');
});

test('刪除雲端資料：先確認帳號，再刪存檔，最後刪登入紀錄；這台裝置的存檔還在', async () => {
  reset();
  assert.equal(await cloudErase(), 'done');
  assert.deepEqual(cloud.log, ['reauth', 'remove', 'removeUser']);
  assert.equal(cloud.docs.u1, undefined);
  assert.equal(cloud.user, null);
  assert.equal(cloudState().user, null);
  assert.equal(cloudState().status, 'signedOut');
  assert.deepEqual(slotData(1).stars, { m1: 3, m2: 2 });
  assert.equal(store.get('starfall_cloud_uid'), undefined);
  assert.equal(store.get('starfall_cloud'), undefined);
  // 登出之後再要求同步：不會把進度又傳上去
  await syncNow();
  await tick(20);
  assert.equal(cloud.docs.u1, undefined);
});

test('刪除雲端資料：正在同步的那一次寫完了才刪，刪完不會又被寫回去', async () => {
  reset();
  await signIn();
  assert.ok(cloud.docs.u1, '重新登入後這台的進度又同步上去了');
  cloud.log.length = 0;
  let release = (): void => undefined;
  cloud.hold = new Promise((r) => (release = r));
  putSlot(1, { ...emptySlot(), stars: { m1: 3, m2: 3 }, at: 9 });
  void syncNow();
  for (let i = 0; i < 200 && !cloud.log.includes('store'); i++) await tick();
  const erased = cloudErase();
  await tick(30);
  assert.ok(!cloud.log.includes('remove'), '同步還在寫的時候不能先刪');
  release();
  assert.equal(await erased, 'done');
  assert.ok(cloud.log.indexOf('stored') < cloud.log.indexOf('remove'));
  await tick(30);
  assert.equal(cloud.docs.u1, undefined);
  assert.equal(cloud.log.filter((l) => l === 'store').length, 1);
});

test('刪除雲端資料：登入紀錄沒刪成，先登出，存檔不會被傳回去', async () => {
  reset();
  await signIn();
  cloud.log.length = 0;
  cloud.fail.removeUser = true;
  assert.equal(await cloudErase(), 'partial');
  assert.equal(cloud.docs.u1, undefined);
  assert.equal(cloudState().user, null);
  assert.ok(cloud.log.includes('signOut'));
  await tick(30);
  assert.ok(!cloud.log.includes('store'));
});

test('雲端資料在別的裝置被刪掉：這台不再上傳，登出，存檔留著', async () => {
  reset();
  await signIn();
  assert.ok(cloud.docs.u1);
  assert.equal(store.get('starfall_cloud_uid'), 'u1');
  // 另一台裝置按了刪除：雲端那一份不見了（這台的登入憑證還能用一陣子）
  delete cloud.docs.u1;
  cloud.log.length = 0;
  await syncNow();
  await tick(20);
  assert.ok(!cloud.log.includes('store'), '不能把這台的進度再傳上去');
  assert.equal(cloud.docs.u1, undefined);
  assert.equal(cloudState().user, null);
  assert.equal(cloudState().erasedElsewhere, true);
  assert.deepEqual(slotData(1).stars, { m1: 3, m2: 3 });
  // 之後自己重新登入：照常同步，提示也清掉
  await signIn();
  assert.equal(cloudState().erasedElsewhere, false);
  assert.ok(cloud.docs.u1);
});

test('上傳失敗的裝置下次照常上傳，不會被當成「在別處刪掉了」', async () => {
  reset();
  assert.equal(await cloudErase(), 'done');
  const real = backend.store;
  backend.store = async () => {
    throw new Error('offline');
  };
  await signIn();
  assert.equal(cloudState().status, 'error');
  assert.equal(store.get('starfall_cloud_uid'), undefined);
  backend.store = real;
  await syncNow();
  await settle();
  assert.equal(cloudState().status, 'synced');
  assert.equal(cloudState().user?.uid, 'u1');
  assert.ok(cloud.docs.u1);
});
