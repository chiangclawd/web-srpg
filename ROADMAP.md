# 🗺️ 後續開發 Roadmap

> **下一步推薦：戰鬥規則優化** — ROADMAP 一直標 in-progress 但沒真正動，
> 需要先 audit 列出可調點再分波 commit。其他項目都暫不動，做完優化再回頭挑。

---

## 🟢 下一步候選 — 戰鬥規則優化

需要先 audit 列出實際可調點，再分波 commit。預計討論的軸：

- 命中率 / 爆擊率手感（miss 頻率、爆擊驚喜度）
- 兵種剋制乘數平衡（劍/槍/騎/弓/法/飛）
- AI 期望傷害權重（damage × hitRate%）、自殺迴避是否過保守
- 地形 +DEF 數值（森林、山地）
- 關卡難度曲線（哪一章太簡單、哪一章太硬）
- 等級成長率（HP/攻/防）
- 藥草設計（每場 3 個夠不夠、CD 機制？）

需要實機打通幾關回報手感才能定調。

---

## 🟡 美術延伸（暫停）

### A1. 進階章節 CG
為 Ch4/5/7/9/11（目前純黑底）做入場 CG（複用 `ART_PROMPTS_REMAINING_CG.md`）：
- Ch4 — 河岸補給線（瑪拉/赫許/教派刺客登場）
- Ch5 — 圍城戰（卡爾將軍登場）
- Ch7 — 法米爾魔法學院淪陷（黑暗主教/獅鷲騎士）
- Ch9 — 副教主・凜的祭壇（番外）
- Ch11 — 修羅戰場（隱藏挑戰章節）

整合工作：產 PNG → 開 manifest entry → 在對應 prologue 加 `bgImageKey`。

### A2. 次要 BOSS 專屬 sprite
目前這 5 位在戰場上用敵方泛用兵種 sprite，做專屬版會更有 BOSS 感：
- vlad（狼牙營營長，槍兵）
- morden（蠻族先鋒，騎兵）
- selene（蠻族冰系巫女，法師）
- carl（前王國敗將，騎兵）
- sub_priest（副教主・凜，法師）

複用 `ART_PROMPTS_MAIN_BOSS_SPRITES.md` 的「BOSS 額外風格指引」。

---

## 🟡 系統面延伸（暫停）

### B1. 單行 CG 切換（cinematic transitions）
`CutsceneScript` 加 `lineBgKey?: Record<number, string>` 讓單行切換背景：
```ts
ch1_prologue: {
  bgImageKey: 'cg_chapter1',
  lineBgKey: { 6: 'cg_chapter1_outpost' },
  lines: [...],
}
```
讓場景切換更電影感。需要美術配合做「同章節多視角」CG。

### B2. Phase 17 — 全英化
`cutscenes.ts` 219 行對話翻譯成英文，加 `t_en()` 機制讓語言切換生效。

### B3. Phase 22 — 相機跟隨 + 小地圖
等之後有更大地圖再做：
- 相機 follow 當前選擇單位
- 右下小地圖即時顯示全戰場

---

## 🟡 內容延伸（暫停）

### C1. 新章節（Ch12+）
邪神碎片打完後的後日談章節、新陣營、新敵人。

### C2. 新武將
玩家陣營目前 5 個固定，可考慮擴充第 2 隊伍（同盟陣營可選用）。

### C3. 新關卡
番外章、限時挑戰、Boss Rush 等變體玩法。

---

## ✅ 已完成

### iPhone QA / UX polish 大波次（2026-04, PR #1–15）

**佈局／字體／aspect**
- canvas aspect 鎖定 19.5:9（PR #3），iPhone 全螢幕無黑邊
- 對話框 / 出陣場景文字 2x（#2），對話框後續再壓縮高度（#4）
- 出陣場景卡片改 3-col grid 多排，避免 5 卡單排溢出（#2）
- 出陣換裝按鈕 / 出陣鍵移到右側資訊欄（#5）
- 戰鬥 HUD 重排：右下 2×2 大方塊按鈕，下方資訊條（#9）
- 主畫面右下版本戳記，金黃 32px 兩行（#8 / #11）

**按鈕互動**
- 觸控 press-down + 點擊音效 + 拖出取消（#6）
- 按鈕 hit area 偏移修正（Container scrollFactor 沒傳給子物件 → #10、#13）
- 結束回合 / 攻擊鎖定狀態下用紅色 hint 解釋為什麼按鍵被擋（#6/#7）

**Bug 修**
- 相機 zoom 後 UI 往中央縮（refreshUIScale 公式錯）— #2
- 單位回合內可重複移動（action_choice 階段沒 exhaust） — #7
- 裝備跨章節被 `saveProgress` 整筆覆寫擦掉 — #15

**Debug 工具**
- 暫時加 on-screen pointer/button log overlay 抓 hit-area 偏移（#12 → #14 移除）

### 早期累積
- 章節 CG 顯示功能（Ch1/2/3/6/8/10）
- 次要 BOSS 立繪（5 位）
- 戰場 sprite（5 player + 6 enemy generic + 5 main BOSS）
- 標題 CG
- 一鍵原地攻擊 / 黃格不動
