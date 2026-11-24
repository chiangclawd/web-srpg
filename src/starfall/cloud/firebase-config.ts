// Firebase 專案的網頁設定（Firebase 主控台 → 專案設定 → 你的應用程式 → SDK 設定和配置）。
// 這組值本來就會出現在每個玩家下載的網頁裡，不是密鑰；誰能讀寫哪些資料是由 firestore.rules 決定的。
// apiKey 留空 = 沒有設定雲端同步，遊戲裡不會出現登入的選項。設定步驟見 STARFALL_CLOUD.md。
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAMXm_w6l2wlG54I8cu-D7L32ZBs2o6bt8',
  authDomain: 'starfall-84dd5.firebaseapp.com',
  projectId: 'starfall-84dd5',
  appId: '1:1010453219683:web:c2e44ba2d68d7d8e616b56',
};
