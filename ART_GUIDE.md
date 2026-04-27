# 美術替換指引 — AI 生圖工作流

> 從色塊版 → 真正立繪的逐步指引。
> 已完成的程式基礎：`assets/portraits/` + `BootScene` + `assetManifest.ts`，產圖後直接放檔即可生效。

---

## 🎯 優先級（先做最有效的部分）

```
最高 ────────────────────────────────────────────── 最低
頭像（5 玩家）→ BOSS 立繪（5 個）→ Cutscene CG → 戰場 sprite → UI 框架
```

**理由**：
- **頭像**已在 HubScene 卡片預留位置 → 1 張圖立刻看見效果
- **BOSS 立繪**用於 Cutscene 對話時切到大圖
- **戰場 sprite** 改 Unit body 比較複雜（六種兵種 + 雙陣營 + 左右翻轉），先不做
- **UI 框架**屬於精緻化階段，最後

---

## 🧰 推薦 AI 工具（依預算 + 品質排序）

### 免費 / 低門檻
| 工具 | 連結 | 適合 | 限制 |
|---|---|---|---|
| **Bing Image Creator** | bing.com/create | 立繪入門、DALL-E 3 引擎 | 每天 15 boost、無 API |
| **Leonardo.AI** | leonardo.ai | 遊戲美術預設、有「Anime」「RPG」風格 | 每天 150 token |
| **Krea.ai** | krea.ai | 即時生圖、改圖功能 | 免費版有浮水印 |

### 付費（建議認真做的選擇）
| 工具 | 月費 | 適合 |
|---|---|---|
| **Midjourney** | $10–30/月 | **頂級品質**，stylize 自然，這個專案最推薦 |
| **NovelAI Image** | $25/月 | 動漫/RPG 風格極強，適合天使帝國風 |
| **Civitai + ComfyUI** | 自架免費，需 GPU | 完全本地、可訓練自己的 LoRA |
| **Scenario.gg** | $20/月 | **遊戲美術專用**，可訓練「我的遊戲風格」 |

### 我推薦的組合
**第一輪試水**：用 **Bing Image Creator** 免費試出每個角色一兩張可用圖（驗證程式整合 OK）
**正式做**：訂 **Midjourney $10/月**（Basic Plan，200 張/月）做立繪。畫風一致性最好。

---

## 🎨 風格決策（重要 — 一次定下不要中途換）

根據你說的「天使帝國 II 美術靈感」，建議：

```
動漫 JRPG 奇幻風（anime fantasy JRPG）
├── 線稿乾淨、上色平塗 + 軟陰影
├── 飽和度中等（不要太鮮豔，不要太黯淡）
├── 統一光源（左前方上方 45 度）
├── 視角：胸部以上（bust shot），微側面
└── 背景：去背 / 純色 / 簡單漸層
```

**Style 關鍵字 (英文 prompt 用)**：
```
anime fantasy art, JRPG character portrait,
soft cel shading, clean line art, painterly, semi-realistic,
inspired by Tales of series, inspired by Fire Emblem, inspired by Saga Frontier,
masterpiece, high detail, 4K
```

**Negative prompt（一律加上）**：
```
low quality, blurry, deformed, bad anatomy, extra limbs,
multiple people, watermark, text, signature, logo,
photo, realistic, 3D render, plastic
```

---

## 📐 規格要求

### 玩家武將頭像（HubScene 卡片用）
- **尺寸**：512×512 PNG
- **構圖**：bust shot（胸部以上）
- **背景**：去背或純色（程式會 cover 88×88 顯示，背景複雜會被裁掉）
- **檔名**：`<commanderId>.png`（例：`arthur.png`、`rosa.png`）
- **路徑**：放在 `public/assets/portraits/`

### BOSS 立繪（Cutscene 用，下一階段）
- **尺寸**：768×1024 PNG（直式 3:4）
- **構圖**：half-body（半身）
- **背景**：去背或暗色背景

### Cutscene CG（劇情大圖，最後）
- **尺寸**：1024×768 PNG（橫式 4:3）
- **構圖**：場景描繪
- **背景**：完整場景

---

## ✍️ 角色 Prompt 範本（我已寫好）

每個角色都附 **設定檔** + **Midjourney 風格 prompt** + **DALL-E 風格 prompt**。

> Midjourney 用 `/imagine` 指令。DALL-E (Bing/ChatGPT) 用對話。

### 🌟 玩家陣營

#### 1. 亞瑟（Arthur）— 王國年輕騎士、20 歲、劍士、主角
**設定**：金髮、藍眼、銀色胸甲外搭藍色內衫、佩短劍。表情堅毅但溫柔。父親是上一任元帥（已故）。

```
Midjourney:
/imagine prompt: anime fantasy bust portrait, young knight Arthur, 20 years old male,
short blond hair, blue eyes, silver chestplate over royal blue tunic, white cape,
holding short sword at side, determined gentle expression,
JRPG character portrait, Tales of series art style, Fire Emblem style,
soft cel shading, clean line art, painterly, masterpiece, high detail,
white background, character art --ar 1:1 --niji 6 --stylize 250

DALL-E / Bing:
描繪一位 20 歲的年輕王國騎士「亞瑟」的胸部以上立繪。短金髮，藍眼，
表情堅毅但溫柔。穿著銀色胸甲外搭皇家藍內衫，肩披白色斗篷。
動畫風格 JRPG 立繪，類似於 Tales of 系列、Fire Emblem 火紋的風格，
柔和賽璐珞著色，乾淨線稿。白色背景。1:1 正方形構圖。
```

#### 2. 蘿莎（Rosa）— 弓兵、銳利、戰術腦
**設定**：紅褐色長馬尾、綠眼、皮甲、配長弓與箭袋。冷靜觀察型。喜歡躲在後排射箭。

```
Midjourney:
/imagine prompt: anime fantasy bust portrait, female archer Rosa,
long auburn ponytail, green eyes, leather chest armor with quiver strap,
holding wooden longbow, sharp focused gaze, slight smirk,
JRPG character portrait, Tales of series art style, Saga Frontier style,
soft cel shading, clean line art, painterly, masterpiece, high detail,
white background, character art --ar 1:1 --niji 6 --stylize 250

DALL-E / Bing:
一位女性弓兵「蘿莎」的胸部以上立繪。紅褐色長馬尾，綠色雙眼，
眼神銳利且帶有自信微笑。穿著皮製胸甲，肩背箭袋的皮帶斜過胸前，
手持木製長弓。動漫 JRPG 風格，類似 Tales of 系列美術風格。
柔和賽璐珞著色。白色背景。
```

#### 3. 蓋瑞（Gary）— 槍兵、老兵、可靠的後輩
**設定**：棕色短髮、灰眼、有臉部疤痕、重型鎖子甲、長槍。坦克型，討厭政治。

```
Midjourney:
/imagine prompt: anime fantasy bust portrait, veteran lance soldier Gary,
short brown hair, grey eyes, scar across left cheek, heavy chainmail with shoulder pauldrons,
holding tall iron lance, calm experienced expression, slight squint,
JRPG character portrait, Fire Emblem art style, mature design,
soft cel shading, clean line art, painterly, masterpiece, high detail,
white background, character art --ar 1:1 --niji 6 --stylize 250

DALL-E / Bing:
一位中年男性槍兵「蓋瑞」的胸部以上立繪。棕色短髮，灰色雙眼，
左臉頰有一道刀疤。表情沉穩，眼神微眯，散發老兵氣息。
穿著重型鎖子甲，肩部有金屬護甲，手持高大鐵槍。
動漫 JRPG 風格，類似火紋的成熟設計。柔和賽璐珞著色。白色背景。
```

#### 4. 夏倫（Sharon）— 法師、學院派、為師復仇
**設定**：銀色短髮、紫眼、學院長袍（藍/銀配色）、書本配掛在腰側。智慧型，對禁書專家。

```
Midjourney:
/imagine prompt: anime fantasy bust portrait, young female mage Sharon,
short silver hair with side braid, purple eyes, blue and silver academy robe,
holding open spellbook, intelligent serene expression,
JRPG character portrait, Tales of series art style, magic academy student look,
soft cel shading, magical aura subtle, clean line art, painterly,
white background, character art --ar 1:1 --niji 6 --stylize 250

DALL-E / Bing:
一位女性法師「夏倫」的胸部以上立繪，年約 22 歲。銀色短髮（單側編成小辮），
紫色雙眼，表情聰慧寧靜。穿著藍銀配色的魔法學院長袍。
雙手捧著一本打開的法術書，書頁上有微弱的魔法光芒。
動漫 JRPG 風格，類似 Tales of 系列的學院派魔法師設計。
柔和賽璐珞著色。白色背景。
```

#### 5. 雷恩（Rain）— 騎兵、王都騎士、帥氣硬漢
**設定**：黑髮、金眼、王都騎士團制服（紅白）、披風。被刑求三天救出後加入。

```
Midjourney:
/imagine prompt: anime fantasy bust portrait, male knight cavalier Rain,
medium-length black hair, golden eyes, capital knight order uniform red and white,
red cape, holding silver sword, handsome rugged expression with subtle bandages,
JRPG character portrait, Tales of series art style, royal knight design,
soft cel shading, clean line art, painterly, masterpiece, high detail,
white background, character art --ar 1:1 --niji 6 --stylize 250

DALL-E / Bing:
一位男性騎士「雷恩」的胸部以上立繪。中長黑髮，金色雙眼，
表情帥氣硬朗，身上有微弱繃帶痕跡（暗示剛經歷刑求）。
穿著王都騎士團的紅白制服，外披紅色斗篷。手持銀劍。
動漫 JRPG 風格，類似 Tales of 系列的王國騎士設計。
柔和賽璐珞著色。白色背景。
```

### 💀 BOSS 陣營

#### 6. 伯朗將軍（Baron）— 父輩仇人、銀甲老將
```
Midjourney:
/imagine prompt: anime fantasy bust portrait, elderly enemy general Baron,
gray streaked dark hair, cold steel-grey eyes, ornate silver full plate armor,
red and black cape, holding silver longsword, intimidating cruel smile,
scarred face, war-hardened veteran,
JRPG villain portrait, Fire Emblem antagonist style, dark fantasy,
white background --ar 1:1 --niji 6 --stylize 300

DALL-E / Bing:
50 歲左右的反派男將軍「伯朗」胸部以上立繪。深色頭髮夾雜灰絲，
冷酷的鋼灰色眼睛，臉上有戰傷疤痕。穿著華麗銀色全板甲，
披紅黑配色斗篷。手持銀色長劍。表情冷酷且帶威脅性微笑。
動漫 JRPG 反派立繪風格，類似火紋反派的黑暗奇幻感。白色背景。
```

#### 7. 伊歐侯爵（Eo）— 王國貴族叛徒、契約者、亞瑟殺父仇人
```
Midjourney:
/imagine prompt: anime fantasy bust portrait, noble villain Marquis Eo,
slick back dark hair, cold violet eyes, black and gold noble robe with house crest,
holding ornate dagger, sinister composed smile, aristocratic features,
faint dark magic aura around hands,
JRPG villain portrait, mature design, dark fantasy, magical contract bearer,
white background --ar 1:1 --niji 6 --stylize 300

DALL-E / Bing:
一位 40 多歲的反派貴族「伊歐侯爵」胸部以上立繪。後梳的深色頭髮，
冰冷紫色雙眼。穿著黑金配色的貴族長袍，胸前有家徽。
手持華麗的儀式短劍。表情陰沉而從容，散發貴族氣質。
雙手周圍有淡淡的黑色魔法光芒（契約之力）。
動漫 JRPG 反派立繪風格。白色背景。
```

#### 8. 教主・黯（Cult Leader An）— 最終 BOSS、虛無主義者
```
Midjourney:
/imagine prompt: anime fantasy bust portrait, cult lord An, dark sorcerer king,
long black flowing hair, void-black eyes with no pupils, lightless robe with abyss patterns,
holding ancient silver sword, calm nihilistic smile,
ancient corrupted noble appearance, void darkness emanating,
JRPG final boss portrait, dark fantasy masterpiece, --ar 1:1 --niji 6 --stylize 350

DALL-E / Bing:
最終 BOSS「教主・黯」胸部以上立繪。長飄逸黑髮，
眼睛是純黑色（沒有瞳孔，宛若深淵）。穿著無光之黑色長袍，
袍上有抽象的虛空圖紋。手持古老的銀色長劍。
表情平靜但帶有虛無主義的微笑。身周散發黑暗虛空之氣。
動漫 JRPG 最終 BOSS 立繪風格，黑暗奇幻氛圍。白色背景。
```

#### 9. 影武者（Shadow）— 沉默的刺客
```
DALL-E / Bing:
一位沉默刺客「影武者」胸部以上立繪。蒼白的臉、銀白色短髮、
無神的紅色雙眼。穿著銀白色斗篷遮住下半臉，露出冷酷雙眼。
手持銀色長劍。動漫 JRPG 風格，神秘陰暗氛圍。白色背景。
```

#### 10. 黑暗主教（High Priest）— 邪神禱詞詠唱者
```
DALL-E / Bing:
一位黑暗主教半身立繪。年約 50，光頭，深紫色法袍，
胸前掛著虛空之主的邪教徽章，手持冰霜法杖。
表情冷漠，眼眶下有黑色印記。動漫 JRPG 邪教反派風格。白色背景。
```

---

## 🛠 工作流程（從 prompt 到 game-ready）

### Step 1：選一個工具，生圖
- 推薦先用 **Bing Image Creator**（免費）試 Arthur 一張，驗證流程通暢

### Step 2：挑選最好的一張
- 通常 4 張中挑 1 最佳（avoid 手指變形、眼歪、武器崩壞）

### Step 3：去背 / 修飾（可選）
- **去背工具**：[remove.bg](https://remove.bg)（免費）、Photoshop、Photopea（網頁版）
- 若用 Midjourney 「白色背景」prompt 通常已經接近去背
- **大小調整**：512×512 PNG

### Step 4：放入專案
```bash
# 把 arthur.png 放在這裡：
public/assets/portraits/arthur.png

# 然後在 src/data/assetManifest.ts 取消對應註解：
{ key: 'portrait_arthur', url: 'assets/portraits/arthur.png' },
```

### Step 5：重新整理瀏覽器
- BootScene 自動載入
- HubScene 卡片自動切換為立繪顯示
- 沒生成的角色仍維持藍色塊（fallback）

### Step 6：迭代
- 不滿意？回 Step 1 重新 prompt（記得記下 seed 數字以重現風格）
- 5 個玩家武將 + 5 個 BOSS = 10 張立繪 = 約 2-3 小時工作量

---

## 💡 風格一致性的關鍵秘訣

1. **同一工具**：全部用同一個 AI（不要 Midjourney 一張、DALL-E 一張，會風格分裂）
2. **同一 base prompt**：保留 `JRPG character portrait, Tales of series art style, soft cel shading, clean line art, painterly, masterpiece, white background --niji 6 --stylize 250` 這段不變，只改人物描述
3. **同一 seed**（Midjourney `--seed 12345`）讓畫風更穩定
4. **同一 stylize 值**（建議 250-300）

> 如果你想要**完美一致性**，最終解是：在 Civitai/Scenario.gg **訓練自己的 LoRA**（用其中一張你生出的好圖訓練模型），但那是進階工作。

---

## 🚀 下一步建議

1. **這週**：先做 **Arthur 一張立繪**驗證流程，把它放進專案，看到 HubScene 卡片變身
2. **下週**：完成所有 5 個玩家武將立繪
3. **下下週**：5 個 BOSS 立繪（讓 Cutscene 對話可以加入立繪切換）
4. **之後**：戰場 sprite（這個比較複雜，需要小尺寸 + 多兵種一致 + 動作幀，最後再做）

---

## ❓ 常見問題

### Q1: AI 生成的角色，可以商用嗎？
- Midjourney 付費版可商用（Basic Plan $10/月即可）
- DALL-E 3（ChatGPT Plus 或 Bing）可商用
- 各家政策可能調整，**正式商業上架前查一次最新條款**
- **Steam 自 2024 起要求揭露 AI 內容**，可商用但需在商店頁標註

### Q2: 風格不一致怎麼辦？
- 第一張當「風格基準」，後續每張帶相同的 base prompt
- 不行的話用 Photoshop 統一色調（顏色平衡 → 整體偏冷或偏暖）

### Q3: 角色臉好醜？
- 生圖 AI 對「中等程度的可愛」最強
- 太美 → 會崩；太醜 → prompt 不夠詳細
- 小 tip：加入 `pretty face, symmetrical features` 改善

### Q4: 我想要像 Pixel Art？
- 換工具：[**PixelLab.ai**](https://pixellab.ai) 或 ComfyUI + Pixel LoRA
- 或者 Midjourney 加 `pixel art, 32-bit JRPG sprite, retro` 但效果普通

### Q5: 一張要生多久？
- Bing：每張約 1 分鐘
- Midjourney：每組 4 張約 1 分鐘
- 通常 prompt 試 3-5 次才會出滿意的 → 每角色約 5-15 分鐘

---

## 📁 專案內已備好的整合機制

```
public/assets/
├── portraits/    # 武將頭像 → 你生圖後放這
├── sprites/      # 戰場小圖（後續）
└── cg/           # 劇情大圖（後續）

src/data/assetManifest.ts   # 編輯這個註冊新檔案
src/scenes/BootScene.ts     # 自動載入所有 manifest 項目
```

**載入失敗 = console warning，不會 crash 遊戲。**所以你可以先放幾張試水，逐步補齊。

---

需要我幫你做什麼？告訴我：
- ✅ 「我先試 Arthur，幫我寫詳細到可以複製貼上的 Bing prompt」
- ✅ 「我訂了 Midjourney，幫我寫 5 角色完整 prompt 套裝」
- ✅ 「我已經產出 arthur.png，下一步怎麼放？」
- ✅ 「程式怎麼改才能在 cutscene 也顯示立繪？」
- ✅ 「我想做 pixel art 風格而不是 anime 立繪，怎麼調整？」
