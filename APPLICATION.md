# Codex for OSS — 申請填表參考

> 本檔為申請 [OpenAI Codex for Open Source](https://openai.com/form/codex-for-oss/) 的填表參考，
> 僅供個人對照貼用，與遊戲程式本身無關，可隨時刪除（或不要 merge 進 `main`）。

---

## 一、表單欄位對照

| 欄位 | 填入 |
|---|---|
| Name | （你的名字，建議與 GitHub 一致）|
| Email | （你的 email）|
| GitHub profile | <https://github.com/chiangclawd> |
| Are you a maintainer of this project? | Yes — primary / sole maintainer |
| Project name | web-srpg |
| Public repository URL | <https://github.com/chiangclawd/web-srpg> |
| Live demo / Website | <https://chiangclawd.github.io/web-srpg/> |
| GitHub stars | 據實填（目前偏少，不必強調）|
| Monthly downloads | N/A（瀏覽器遊戲，非套件，無下載量指標）|
| License | MIT |
| Primary language | TypeScript |

---

## 二、為什麼這個程式碼庫符合申請資格？（核心欄位）

> 策略：star / 下載量目前不是賣點，因此把火力集中在「生態系價值 + 工程品質 + 活躍維護」，
> 並誠實說明這是早期專案。OpenAI 會查證 repo 控制權與維護者身分，**切勿填造假數字**。
> 審件以英文為主，建議主填英文版。

### 建議主填（English）

```text
web-srpg is a complete, MIT-licensed reference implementation of a turn-based
tactical SRPG (Fire Emblem–style) written in strict TypeScript on Phaser 3 +
Vite, with an optional Tauri desktop build. I'm applying on the basis of code
quality, reference value, and active maintenance rather than popularity: it's a
young, solo-maintained project (early on GitHub stars, and as a browser game it
has no package-download metric), but it is built and documented to be learned
from.

For indie and hobbyist game developers it's a clean, end-to-end example of
systems that are otherwise hard to find together in one readable codebase:
hex-grid pathfinding (Dijkstra), a data-driven unit-counter matrix, a fully
transparent damage calculator (terrain / facing / flanking / status-effect /
bond modifiers), a reusable status-effect framework, and heuristic enemy AI
(focus-fire, retreat, flank-seeking). Unusually, it ships a headless balance
simulator (`npm run balance`) that runs thousands of 1v1 matchups against the
real damage formulas — a genuinely reusable pattern for automated game-balance
testing. It is zero-network / zero-tracking, offline-capable, has a zh/en i18n
scaffold, and is maintained with a disciplined PR-per-"wave" workflow (latest
merged PR #61).

I would use Codex to scale solo-maintainer work I currently cannot: automated
PR review and issue triage, completing the full English localization (200+
cutscene lines), and building a regression test suite around the combat/balance
engine.

Live demo: https://chiangclawd.github.io/web-srpg/
Repository: https://github.com/chiangclawd/web-srpg
```

### 中文版（備用）

```text
web-srpg 是一個以嚴格 TypeScript + Phaser 3 + Vite 打造、MIT 授權的完整回合制
戰術 SRPG（火焰之紋章風格），並含可選的 Tauri 桌面版。我以「程式碼品質、參考
價值與活躍維護」而非人氣提出申請：這是個年輕、由我個人持續維護的專案（GitHub
star 尚少，且作為瀏覽器遊戲沒有套件下載量指標），但它從一開始就是寫來「可被學
習」的。

對獨立／業餘遊戲開發者而言，它把許多平常難以在單一可讀程式庫中一次看齊的系統做
成乾淨的端到端範例：六角格尋路（Dijkstra）、資料驅動的兵種相剋矩陣、完全透明的
傷害計算（地形／面向／背擊／狀態效果／羈絆加成）、可重用的狀態效果框架，以及啟
發式敵方 AI（集火／撤退／繞背）。少見地，它附帶無頭平衡模擬器（npm run balance），
以真實傷害公式跑數千場 1v1 對戰——對自動化遊戲平衡測試是很實用的可重用作法。專案
零網路、零追蹤、可離線執行，具中英 i18n 骨架，並以「分波次 PR」的紀律維護（最新
合併為 PR #61）。

我會用 Codex 來擴展目前個人維護做不來的工作：自動化 PR review 與 issue 分類、完成
200+ 行劇情的全英化，並為戰鬥／平衡引擎建立回歸測試。

線上試玩：https://chiangclawd.github.io/web-srpg/
原始碼：https://github.com/chiangclawd/web-srpg
```

---

## 三、若另有「你會如何使用 Codex？」欄位

```text
Automated PR review and issue triage on a solo-maintained repo; completing the
full English localization of 200+ cutscene lines; generating a regression/unit
test suite around the damage and balance engine; and CI/release automation. As
a solo maintainer, Codex would meaningfully expand the review and testing
capacity I currently lack.
```

---

## 四、投件前檢查清單

- [ ] **Merge PR #62**（MIT `LICENSE` + README demo 連結）→ repo 首頁才看得到授權與試玩連結
- [ ] 設定 repo **About → Website + Topics**（見下）
- [ ] 確認線上試玩可開啟（Settings → Pages，source 設為 **GitHub Actions**）
- [ ] GitHub profile 與 repo 皆為 **public**（已是）

### repo About 設定值

- **Website**：`https://chiangclawd.github.io/web-srpg/`
- **Topics**：`game` `srpg` `tactics` `phaser` `typescript` `vite` `fire-emblem` `gamedev`
- 或用 `gh` CLI 一行：

  ```bash
  gh repo edit chiangclawd/web-srpg \
    --homepage "https://chiangclawd.github.io/web-srpg/" \
    --add-topic game,srpg,tactics,phaser,typescript,vite,fire-emblem,gamedev
  ```

---

## 五、誠實提醒

- **不要填造假的 star / 下載數字** —— OpenAI 條款明載會查證 repo 控制權與維護者身分。
- 此計畫以「採用度 / 生態系重要性」為核心評選；本專案目前屬早期、個人作品集型，
  錄取屬搏機會。但以上是目前能提出的**最強且誠實**的版本。
- 文中提到的 `npm run balance`、200+ 行待英化、PR #61 等都對得上 repo 實況，可信度高。
