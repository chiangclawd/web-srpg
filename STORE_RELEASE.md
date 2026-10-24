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
| 橫向、全螢幕 | Android 鎖橫向、藏起狀態列與導覽列 |

## 需要你決定或操作的事

1. **App ID**：目前是 `com.chiangclawd.kingdombastion`。第一次上架後就不能改，要換的話趁現在。
2. **Google Play**：註冊開發者帳號（一次 25 美元）。上架用的金鑰要自己產生、自己保管，不要用 repo 裡的測試金鑰；把它設成 GitHub Secrets（`KB_KEYSTORE` 等，見 `android/app/build.gradle`），再加一個建 AAB 的步驟。
3. **App Store（iPhone）**：需要 Apple Developer Program（每年 99 美元）和一台 Mac（或 macOS 的 CI）來建置、簽章、上傳 TestFlight。`npx cap add ios` 可以先產生 iOS 專案。
4. **素材權利確認**：AI 生成的圖、音樂、語音與 3D 模型，請確認你使用的方案允許商業或公開發佈（Gemini API 條款、Meshy 付費方案的授權），並保留紀錄。
5. **商店頁素材**：截圖（手機橫向）、簡短與完整說明、關鍵字、年齡分級問卷（奇幻暴力，大約 9+ / 12+）。資料安全 / 隱私標籤可以勾「不收集資料」。

## 建議的下一步

- 用 Android 測試版在幾支不同手機上試玩，看效能、存檔、全螢幕、瀏海避讓。
- iOS 專案與 macOS CI 建置（模擬器版先確認能編譯）。
- 商店截圖與宣傳文字。
