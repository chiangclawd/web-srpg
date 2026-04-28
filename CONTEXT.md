# 🎮 西方戰術 SRPG — 開發脈絡（給接手的 Claude / 開發者）

> 此檔案放在 repo 根目錄，目的是讓任何人（或任何 AI agent）clone 專案後，
> **讀完這份 + ROADMAP.md 就能無縫接手繼續開發**。

## 專案是什麼

- **遊戲類型**：六角格回合制戰術 RPG（受三國志武將剋制 + 天使帝國美術啟發）
- **西方奇幻設定**：王國 vs 蠻族 vs 黑暗教派的三方衝突
- **完整故事**：11 章 + 1 隱藏章（修羅戰場），含 TRUE END 路線
- **技術**：TypeScript 5.4 + Phaser 3.90 + Vite 5 → Web only
- **部署**：GitHub Pages，URL https://chiangclawd.github.io/web-srpg/

## 開發者背景

- 本職 Python 後端工程師，**JS/TS/遊戲開發零基礎**
- 美術由開發者自己用 Nano Banana (Gemini 2.5 Flash Image) 產出，根目錄 `ART_PROMPTS_*.md` 是 prompt 模板
- 程式所有實作由 Claude 接手；開發者主要做：玩、回報、決定方向、生圖
- 互動語言：**繁體中文**
- 不設死線；偏好可上線的小切片，每波獨立 commit + push 觸發 GitHub Actions 自動部署

## 已完成系統一覽

| 類別 | 系統 |
|------|------|
| **核心戰鬥** | 6 兵種剋制矩陣、命中率/爆擊率、乘法 DEF 減傷、地形 +DEF、移動加成、技能 27 個 |
| **章節結構** | 11 主線 + 1 隱藏章；prologue / victory / defeat 各自 cutscene；nextChapterId 鏈 |
| **武將系統** | 22 武將（5 玩家英雄 + 5 普通兵 + 5 主要 BOSS + 5 次要 BOSS + 12 雜兵類型）|
| **裝備** | 34 件兵種專屬（劍/槍/騎/弓/法/飛 各 3-4 件武器+防具），lv1/5/10/14 漸進解鎖；CommanderProgress 自動存檔 |
| **AI** | 期望傷害評分（damage × hitRate%）、必殺優先、自殺迴避、地形偏好 |
| **勝利條件** | rout / kill_boss / survive 三種；Ch5 圍城 = survive 6 回合，Ch7 = kill_boss |
| **美術** | 15 張立繪 + 7 張章節 CG + 16 個 sprite + 標題 CG，全部去背壓縮上 GitHub |
| **相機** | 拖曳平移、雙指 pinch、滾輪、UI 按鈕縮放（0.4×–2.0×），UI 鎖位置鎖大小 |
| **行動裝置** | 動態 canvas aspect、HTML no-cache、iOS PWA meta、manifest.json 鎖橫屏、CSS portrait 提示遮罩 |
| **i18n** | zh-TW / en；切換在 TitleScene；utils/i18n.ts 的 t/tn |
| **存檔** | localStorage（CommanderProgress + achievements + deployment + theme + lang）|
| **音效** | Web Audio synth；BGM 按章節 mood 切（peaceful/dark/epic/finale）|

## 程式檔案結構

```
src/
├── main.ts                    # Phaser 入口；canvas aspect 動態 + 鎖橫屏 try
├── BattleScene.ts             # 戰鬥場景（最大檔，~1700 行：移動/攻擊/AI/相機/UI）
├── Unit.ts                    # 單位類別（hex 位置、HP、視覺、動作）
├── Grid.ts                    # 六角格數學（pointy-top, odd-r offset）
├── battle/
│   ├── DamageCalculator.ts    # 傷害公式 + rollAttack（命中/爆擊擲骰）
│   ├── CounterSystem.ts       # 兵種剋制矩陣
│   └── Leveling.ts            # 等級成長
├── data/
│   ├── commanders.ts          # 武將定義 + RECRUIT_AT_CHAPTER
│   ├── unitTypes.ts           # 兵種 + hitRate/critRate
│   ├── equipment.ts           # 裝備（per-class + level-gated）+ getEquippableFor
│   ├── skillEffects.ts        # 技能效果註冊表（27 個）
│   ├── terrainTypes.ts        # 地形定義
│   ├── scenarios.ts           # 11 個劇本（22×16 hex）
│   ├── chapters.ts            # 章節 → scenario / cutscene 連結
│   ├── cutscenes.ts           # 對話劇本（含 bgImageKey）
│   ├── achievements.ts        # 14 個成就
│   ├── assetManifest.ts       # 立繪/CG/sprite 載入清單 + getEquippableFor
│   └── save.ts                # localStorage 包裝
├── scenes/
│   ├── BootScene.ts           # 預載素材
│   ├── TitleScene.ts          # 標題畫面（CG 背景）
│   ├── CutsceneScene.ts       # 對話演出（CG + 立繪 + 對話框）
│   └── HubScene.ts            # 章節間管理（編組 + 換裝）
└── utils/
    ├── audio.ts               # Web Audio BGM/SFX
    ├── hexDrawing.ts          # tracePointyHexPath
    ├── i18n.ts                # t() + tn()
    ├── settings.ts            # 難度 + 主題
    ├── achievementToast.ts    # 成就解鎖提示
    └── uiHit.ts               # addHitRect (修正 Phaser Container hit area quirk)

public/
├── manifest.json              # PWA manifest (orientation: landscape)
└── assets/
    ├── portraits/             # 15 張 512×512 立繪
    ├── cg/                    # 7 張 1920 寬章節 CG + title.png
    └── sprites/               # 16 個 256×256 戰場 sprite

ART_PROMPTS_*.md               # Nano Banana prompt 模板
ROADMAP.md                     # 已記錄但暫停的工作
.github/workflows/deploy.yml   # 自動部署
```

## 重要的開發約定

1. **資料驅動**：新增章節 = 改 `data/scenarios.ts` + `cutscenes.ts` + `chapters.ts`，不動引擎
2. **新武將**：`data/commanders.ts` 加項；如果是玩家用的，加到 `RECRUIT_AT_CHAPTER`
3. **新兵種**：`types.ts` 加 `UnitTypeId` + `data/unitTypes.ts` + `battle/CounterSystem.ts` 補剋制
4. **新技能**：`data/skillEffects.ts` 加 SKILL_EFFECTS entry，commander.skill.id 對到
5. **新裝備**：`data/equipment.ts` 加項，記得 `unitTypes` + `requiredLevel`
6. **新 CG**：產 PNG → 放 `public/assets/cg/` → manifest 加 entry → cutscene 加 `bgImageKey`
7. **不要動已部署的素材檔名**（會破壞 cache）
8. **commit 後就 push**（觸發 GitHub Actions 自動部署，1-2 分鐘可見）

## 常見指令

```bash
npm install      # 第一次
npm run dev      # 本機開發 (Vite HMR)
npm run build    # tsc 檢查 + Vite build → dist/
git push         # 觸發 GitHub Actions 自動部署
```

## 還沒做的（看 `ROADMAP.md`）

- Ch4/5/7/9/11 章節 CG（其餘章節純黑底）
- 5 次要 BOSS 專屬 sprite（用敵方泛用代替中）
- 單行 CG 切換（cinematic transition）
- 全英化 cutscene（i18n 機制已通，只是內容沒翻）
- 新章節 Ch12+ / 新武將 / 新關卡

## 對接時的注意點

- **使用者偏好**：分波次 commit，每波獨立可玩可驗收
- **Co-Authored-By Claude Opus 4.7**（或當前模型）放在 commit 訊息底部
- **iPhone 加到主畫面**是主要 QA 路徑；改完通常會被問「手機刷新看得到嗎」
- **不要過度推估方向**：使用者會明確說「依序全部進行」或指定下一個項目；曖昧時先列選項問
- **美術不做**：所有 PNG 由使用者用 Nano Banana 產，Claude 只寫 prompt 模板
