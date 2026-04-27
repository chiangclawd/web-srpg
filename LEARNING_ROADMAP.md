# Phase 0 學習路徑

> 從「Python 後端開發者 / TS+Phaser 零基礎」到「能寫出 SRPG 微型原型」的學習計畫。
> 預計總時長：**8–12 週**（每週 15 小時計算）

## 🎯 Phase 0 終點目標

完成後你能夠：
- 寫出基本的 TypeScript 程式（class、interface、泛型）
- 用 Phaser 3 載入資源、處理輸入、切換 Scene
- **獨立做出**「8×8 棋盤、能移動、能攻擊、有回合切換」的最小可玩

---

## 🔹 Phase 0.1 — TypeScript 基礎（2–3 週）

### 為什麼先學 TS 不是 JS？
你是 Python 老手，TS 的型別注解概念跟 Python type hints 一致。
直接學 TS 比先學 JS 再學 TS 快 2 倍。

### 學習資源
1. **官方教材（首選）**：[TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
   - 重點章節：Everyday Types、Narrowing、Functions、Object Types、Classes、Generics
2. **互動練習**：[TypeScript Exercises](https://typescript-exercises.github.io/)
3. **影片（可選）**：YouTube「TypeScript Tutorial for Beginners」

### 實作練習
- ✏️ 把寫過的 5 個 Python 小程式翻譯成 TS（學語法最快的方法）
- ✏️ 寫一個簡單的 TODO List CLI（用 Node.js 跑）

### 里程碑檢核
- [ ] 看得懂 `interface`、`type`、`generic` 的差別
- [ ] 會用 `class` 寫繼承、能處理 `this` 綁定
- [ ] 寫得出 `function foo<T>(x: T): T[]` 這種泛型函式

---

## 🔹 Phase 0.2 — Web 與瀏覽器基礎（1–2 週）

### 學什麼？
**只需要遊戲開發會用到的部分。** 不用學 React/Vue/Angular。

### 學習資源
- [MDN — JavaScript 入門](https://developer.mozilla.org/zh-TW/docs/Learn/JavaScript)（跳過已會的概念）
- [MDN — Canvas API](https://developer.mozilla.org/zh-TW/docs/Web/API/Canvas_API)
- [MDN — DOM 入門](https://developer.mozilla.org/zh-TW/docs/Learn/JavaScript/Client-side_web_APIs/Manipulating_documents)

### 實作練習
- ✏️ 寫一個 HTML 頁面，按鈕點擊在 canvas 上畫圖形
- ✏️ 處理鍵盤事件（按方向鍵移動方塊）

### 里程碑檢核
- [ ] 會用 `<canvas>` + JavaScript 畫圖
- [ ] 能處理 click / keyboard 事件
- [ ] 知道 `addEventListener` 的用法與生命週期

---

## 🔹 Phase 0.3 — Phaser 3 入門（2–3 週）

### 學習資源
1. **官方第一個遊戲教學**：[Making Your First Phaser 3 Game](https://phaser.io/tutorials/making-your-first-phaser-3-game)
2. **官方範例**：[Phaser 3 Examples](https://phaser.io/examples)
3. **影片頻道推薦**：YouTube 搜尋「Phaser 3 TypeScript Tutorial」
   - Ourcade
   - Photon Storm

### 重點概念
- **Scene 系統**（場景管理：開始畫面、戰鬥、據點各自一個 Scene）
- **Sprite / Image** 載入與顯示
- **Input**（鍵盤、滑鼠）
- **Tween**（動畫，例：單位移動的滑動效果）
- **Tilemap**（瓦片地圖，**SRPG 必備**）
- **Group**（單位群組管理）

### 實作練習
- ✏️ 跟著官方教學做完 platformer
- ✏️ 改造成 top-down 視角（角色用方向鍵移動，能撿物品）

### 里程碑檢核
- [ ] 能載入 sprite 並顯示
- [ ] 能切換 Scene（例：開始畫面 → 遊戲畫面）
- [ ] 能用 Tilemap 顯示一張地圖
- [ ] 能處理滑鼠點擊指定格子

---

## 🔹 Phase 0.4 — SRPG 微型原型（3–4 週）

### 任務範圍
做出**最小可玩 SRPG 戰鬥**，沒有美術，全部用色塊。

### 必須有的功能
- [ ] 8×8 棋盤（用色塊畫格子）
- [ ] 1 個自方單位、1 個敵方單位
- [ ] 點擊自方單位 → 顯示移動範圍
- [ ] 點擊範圍內格子 → 單位移動過去
- [ ] 攻擊範圍計算
- [ ] 點擊敵方 → 計算傷害、扣 HP
- [ ] 回合切換（自方 → 敵方 → 自方...）
- [ ] 簡易敵方 AI（隨機移動 + 攻擊最近自方）
- [ ] 勝利/失敗判定

### 不需要的（這階段先不做）
- ❌ 美術（全色塊）
- ❌ 兵種相剋
- ❌ 等級裝備
- ❌ 立繪劇情
- ❌ UI 美化
- ❌ 音效

### 里程碑檢核
- [ ] 這個原型可以從頭打到尾，分出勝負
- [ ] 看著程式碼大致知道每段在做什麼
- [ ] 開始有「下一步想加 X 功能」的想法

> 🎉 完成這個原型，你就正式從「學習者」進入「開發者」階段，可以開始 Phase 1。

---

## 📅 時程建議（每週 15 小時）

| 週次 | 主要任務 | 副任務 |
|---|---|---|
| 1–2 | TS 基礎 1（Everyday Types、Functions）| 翻譯 1 個 Python 小程式 |
| 3 | TS 基礎 2（Classes、Generics）| 翻譯 2 個 Python 小程式 |
| 4 | Web/Canvas/DOM | 寫 canvas 畫圖實驗 |
| 5–6 | Phaser 3 官方教學 | 跟著做完 platformer |
| 7 | Phaser 3 進階（Tilemap、Tween）| 玩 Phaser examples |
| 8–11 | SRPG 微型原型 | 自己想加的功能 |
| 12 | 收尾、整理、檢討 | 寫學習心得 |

---

## 💡 學習小建議

1. **不要追求完美**：第一份程式碼很爛是常態，能跑就好
2. **每週寫 TIL（Today I Learned）**：建立 `notes/` 資料夾記錄學到什麼
3. **卡關超過 2 小時 → 停下來問**：StackOverflow / Reddit / Claude / ChatGPT
4. **看別人的程式**：GitHub 搜「phaser srpg typescript」找開源專案閱讀
5. **每完成一個小階段慶祝一下** 🎉

---

## 🆘 卡關時的求助順序

1. **仔細讀錯誤訊息**（90% 答案在裡面）
2. **Google / 官方文件**
3. **AI 助手**（解釋概念、debug）
4. **Reddit** — r/phaser、r/typescript、r/gamedev
5. **朋友、社群**

---

## 🚀 完成 Phase 0 之後

恭喜！你會進入 **Phase 1：建立正式專案結構**：

1. `npm init` + 安裝 Phaser + Vite + TypeScript
2. Git init + 第一個 commit
3. 規劃資料結構（武將、兵種、地圖）
4. 重新實作微型原型（這次有完整架構）
5. 加入兵種相剋、武將特技等核心系統

到時候我們再開新的 roadmap 文件。
