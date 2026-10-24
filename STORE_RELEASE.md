# 《王國防線》上架準備清單

方向沿用 `COMMERCIALIZATION.md` 的決定：做到商業品質，**免費上架、不放廣告、不做內購、不收集資料**。
App 版用 Capacitor 把網頁版包成 iOS / Android App（`capacitor.config.json`、`android/`）。

## 已完成

| 項目 | 說明 |
|---|---|
| 隱私權政策 | `public/td-privacy.html`，網址 `https://chiangclawd.github.io/web-srpg/td-privacy.html`；主選單左下角有連結 |
| 製作群 / AI 揭露 | 製作群名單列出 Gemini、Meshy、three.js、Phaser、字型授權，並註明美術、音樂、語音以 AI 輔助製作 |
| App 打包 | `npm run build:app` 只打包塔防到 `dist-app/`（拿掉 SRPG 素材，約 54 MB）；`npx cap sync android` 複製進 Android 專案 |
| 存檔保險 | App 版每次存檔也寫一份到原生儲存，iOS 清掉 WebView 資料時開遊戲會自動搬回來 |
| App 圖示 / 啟動畫面 | 原圖在 `resources/`，用 `npx @capacitor/assets generate` 產生各尺寸；網頁版也加了主畫面圖示 |
| Android 測試版 | GitHub Actions `android.yml`：main 每次更新自動建 APK，放在 Releases 的 `android-test`；固定的測試金鑰讓新版能覆蓋安裝 |
| 橫向、全螢幕 | Android 鎖橫向、藏起狀態列與導覽列；iOS 只允許橫向、藏起狀態列、iPad 要求全螢幕 |
| iOS 專案 | `ios/`（Capacitor + Swift Package Manager）；GitHub Actions `ios.yml` 在 macOS 上編譯模擬器版確認能建置；出口合規已在 Info.plist 宣告不使用非豁免加密 |
| 商店頁文案 | `STORE_LISTING.md`：繁中、簡中、英文的名稱、短說明、完整說明、關鍵字，還有分類、分級、隱私欄位的建議 |
| 商店截圖 | `node scripts/store-shots.cjs`（說明在檔頭）自動擺好 7 個畫面，輸出 App Store 6.5 吋（2778×1284）與 Google Play（1920×1080），中英文各一套 |
| 簡體中文 | 遊戲內可切換 繁體 → 简体 → EN；簡體中文環境的裝置第一次開啟自動用簡體 |
| 介紹頁 | `https://chiangclawd.github.io/web-srpg/kingdom-bastion.html`：可當商店的行銷網址，也方便分享給朋友 |
| Android 返回鍵 | 戰鬥中先暫停、劇情對話直接略過、其他畫面回上一頁，主選單才把 App 縮到背景（Google Play 審核常看這點） |
| 瀏海、螢幕常亮 | iPhone 橫拿時畫面讓出瀏海 / 動態島；戰鬥中螢幕不會自動變暗鎖屏 |
| Google Play AAB | `android.yml` 在設定好上傳金鑰後，main 每次更新也會建簽好名的 AAB（見下面第 2 點） |

## 需要你決定或操作的事

1. **App ID**：目前是 `com.chiangclawd.kingdombastion`。第一次上架後就不能改，要換的話趁現在。
2. **Google Play**：註冊開發者帳號（一次 25 美元）。上架用的上傳金鑰要自己產生、自己保管，不要用 repo 裡的測試金鑰：
   1. 在自己的電腦上產生金鑰（密碼自己記好，金鑰檔不要放進 repo）：
      `keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`
   2. 轉成一行文字：macOS `base64 -i upload.keystore | pbcopy`，Linux `base64 -w0 upload.keystore`
   3. 到 GitHub 專案的 Settings → Secrets and variables → Actions，新增四個 Repository secrets：
      `KB_UPLOAD_KEYSTORE_B64`（上一步的文字）、`KB_KEYSTORE_PASSWORD`、`KB_KEY_ALIAS`（上例是 `upload`）、`KB_KEY_PASSWORD`
   4. 到 Actions → Android APK → Run workflow（或等下一次 main 更新），跑完在那次執行的 Artifacts 下載 `KingdomBastion-play-aab`，上傳到 Play Console。
   版本號用 GitHub Actions 的執行編號，每次都會變大，符合 Play 的要求。金鑰與密碼只放在 GitHub Secrets，不要貼到任何對話或 issue 裡。
3. **App Store（iPhone）**：需要 Apple Developer Program（每年 99 美元）。iOS 專案已經在 `ios/`：
   在 Mac 上 `npm ci && npm run build:app && npx cap sync ios`，用 Xcode 開 `ios/App/App.xcodeproj`，
   在 Signing & Capabilities 選你的開發者團隊，Product → Archive 就能上傳 TestFlight。
   （之後也可以把簽章憑證放進 GitHub Secrets，讓 CI 直接上傳。）
4. **素材權利確認**：AI 生成的圖、音樂、語音與 3D 模型，請確認你使用的方案允許商業或公開發佈（Gemini API 條款、Meshy 付費方案的授權），並保留紀錄。
5. **商店後台問卷**：文案與截圖已經備好（`STORE_LISTING.md`、`scripts/store-shots.cjs`），剩下要在後台填年齡分級問卷（奇幻暴力，大約 9+ / 12+），資料安全 / 隱私標籤勾「不收集資料」。

## 建議的下一步

- 用 Android 測試版在幾支不同手機上試玩，看效能、存檔、全螢幕、返回鍵。
- 有 Google Play 帳號後：設定上傳金鑰（上面第 2 點），先上「內部測試」軌道。
- 有 Apple 開發者帳號後：Xcode 簽章、TestFlight 內測。
- 上架前把 `STORE_LISTING.md` 的簡體中文再校對一次（由繁體自動轉換）。
