# 🗺️ 後續開發 Roadmap

> 目前優先：**戰鬥規則優化**（in progress）。
> 下方是已記下、暫不動的工作，做完戰鬥優化再回頭挑。

---

## 🟡 美術延伸（暫停）

### A1. 進階章節 CG
為這些目前純黑底的章節做入場 CG（複用 `ART_PROMPTS_REMAINING_CG.md` 的公式）：
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
// 例：Ch1 prologue 第 6 行從「邊境風景」切到「白楊崗特寫」
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
目前所有戰場 11×8 hex 都能塞進畫面，未做。等之後有更大地圖再做：
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

## ✅ 進行中／剛完成

- 戰鬥規則優化（in progress）
- 章節 CG 顯示功能（done — Ch1/2/3/6/8/10）
- 次要 BOSS 立繪（done — 5 位）
- 戰場 sprite（done — 5 player + 6 enemy generic + 5 main BOSS）
- 標題 CG（done）
- 一鍵原地攻擊 / 黃格不動（done）
