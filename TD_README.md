# 🏰 王國防線 Kingdom Bastion — 塔防新作

> 與《西方戰術 SRPG》共用世界觀的商業級塔防遊戲（玩法參考 Kingdom Rush 系列）。
> 線上版：部署後位於 `https://chiangclawd.github.io/web-srpg/td.html`

## 🎮 遊戲內容

| 系統 | 內容 |
|---|---|
| **防禦塔** | 弓箭塔 / 兵營 / 法師塔 / 砲塔，各 3 級 + 每種 2 條第 4 級特化（共 8 種特化、16 個可學技能） |
| **敵人** | 哥布林、蠻族掠奪者、雪原狼（閃避）、蠻族獵手（遠程）、鐵甲槍兵（重甲）、教派術士（抗魔＋治療）、蠻族騎兵、獅鷲騎手（飛行）、山嶺巨魔（再生＋範圍）、BOSS 莫登（召喚＋狂暴） |
| **英雄** | 亞瑟（騎士・盾擊/王者號令/聖劍斬）、艾蓮娜（遊俠・連珠箭/穿雲箭/箭雨）、莉拉（冰法・冰霜新星/寒冰長槍/暴風雪），10 級成長、經驗跨關保存 |
| **法術** | 流星火雨（範圍轟炸）、王國援軍（召喚民兵擋路） |
| **關卡** | 5 關戰役：邊境村莊 → 灰石渡口 → 暗影森林 → 北境雪原 → 楓紅隘口（BOSS） |
| **養成** | 每關 1~3 星；星數用於 6 欄 × 5 階的升級樹 |
| **其他** | 世界地圖、難度（休閒/普通/老兵）、圖鑑、新敵人介紹卡、提前呼叫波次獎金、1x/2x 速度、暫停、雙語（繁中 / English）、存檔 |

## 🕹 操作

- **點建造點** → 環形選單選塔 → **再點一次確認**
- **點塔** → 升級 / 特化 / 學技能 / 出售；兵營可設**集結點**
- **點英雄（或左下頭像）→ 點地面** 移動英雄
- **左下法術** → 點地面施放（援軍需放在路上）
- **骷髏按鈕** → 提前呼叫下一波（剩餘秒數換金幣）
- 鍵盤：`Space` 暫停、`Esc` 取消、`1` 流星、`2` 援軍

## 🛠 開發

```bash
npm run dev            # http://localhost:5173/td.html
npm run build          # 兩個入口（index.html = SRPG、td.html = 塔防）一起打包
npm run td:sim         # headless 平衡模擬：AI 打完所有關卡，輸出勝負/星數/漏怪
npm run td:levels      # 關卡幾何檢查（建造點是否壓路、重疊、被 HUD 蓋住）
npx tsx scripts/td-level-tool.ts suggest l3 11   # 自動建議建造點
```

## 🧱 架構

```
src/td/
├── main.ts              # Phaser 入口（2x 高 DPI 渲染、動態寬度 1280~1560）
├── config.ts            # 解析度、字型、文字樣式
├── sim/                 # 純邏輯模擬（不依賴 Phaser，可在 Node 跑平衡測試）
│   ├── World.ts         #   主迴圈：波次、敵人移動/擋路、塔攻擊、士兵/英雄 AI、技能、法術
│   ├── entities.ts      #   Enemy / Soldier / Tower / Projectile
│   ├── Path.ts          #   Catmull-Rom 平滑路徑 + 等距取樣
│   └── defs.ts          #   所有資料型別
├── data/                # 敵人、塔、英雄、關卡、升級樹
├── art/                 # 程序化美術（Canvas 2D）：地形、塔、魔物、特效、UI、世界地圖
├── view/                # 模擬 → 畫面：單位精靈、塔、環形選單、粒子特效
├── scenes/              # Boot / Menu / Map / Level / LevelUI / Upgrade / Hero / Encyclopedia
├── audio.ts             # BGM（沿用 SRPG mp3）+ SFX（解碼 m4a + Web Audio 合成）
├── save.ts / i18n.ts
```

- **模擬與畫面分離**：`World.step(1/60)` 固定步長；畫面每幀讀取實體狀態 + 消化事件佇列（`drainEvents()`）播特效/音效。
- **美術**：塔、地形、魔物、特效、圖示全部程序繪製（2 倍解析度）；人物沿用 SRPG 的 chibi sprite 與立繪。
