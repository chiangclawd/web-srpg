// Firebase 版的雲端後端：Google 登入（彈出視窗）+ Firestore 裡每個帳號一份文件（starfall/{uid}）。
// 這個檔案只會被 sync.ts 動態載入：沒登入過的玩家不會下載 Firebase 的程式。
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, deleteUser, getAuth, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore/lite';
import { FIREBASE_CONFIG } from './firebase-config';
import type { CloudBackend } from './sync';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
// 每次都讓玩家選帳號（家人共用的裝置上不會默默登入上一個人）
provider.setCustomParameters({ prompt: 'select_account' });

export const backend: CloudBackend = {
  onUser(cb) {
    onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, name: u.displayName || u.email || 'Google' } : null));
  },
  async signIn() {
    await signInWithPopup(auth, provider);
  },
  async signOut() {
    await signOut(auth);
  },
  async load(uid) {
    const snap = await getDoc(doc(db, 'starfall', uid));
    return snap.exists() ? snap.data() : null;
  },
  async store(uid, data) {
    await setDoc(doc(db, 'starfall', uid), data);
  },
  // 刪除雲端資料用的三步。Firebase 規定刪帳號前要最近登入過，所以先請玩家再選一次帳號；選了別的帳號會丟錯
  async reauth() {
    if (!auth.currentUser) throw new Error('signed out');
    await reauthenticateWithPopup(auth.currentUser, provider);
  },
  async remove(uid) {
    await deleteDoc(doc(db, 'starfall', uid));
  },
  async removeUser() {
    if (auth.currentUser) await deleteUser(auth.currentUser);
  },
};
