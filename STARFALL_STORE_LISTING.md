# 《星墜殘響 Starfall Echo》商店頁文案

上架 App Store / Google Play 時直接貼用。內容的數量以 2026-11 的版本為準（12 個任務、6 台機體、21 種敵人與設施、圖鑑 27 則、成就 23 個）；
數量改了，`tests/starfall/store.test.ts` 會失敗，提醒這份要跟著改。字數上限也是那支測試在量。

- 截圖和 Google Play 的主題圖：`node scripts/starfall-shots.cjs --store`（先 build 並開 preview，說明在檔頭），輸出到 `store-shots/starfall/`，不進版本庫。
- 預告片：`node scripts/starfall-trailer.cjs`（同上），輸出到 `store-shots/starfall/trailer/`。
- 遊戲目前只有繁體中文和英文，所以文案也只有這兩種。

## 繁體中文

**名稱**：星墜殘響 Starfall Echo

**副標題**：科幻機甲戰棋，出手前先看結果

**簡短說明**：指揮機甲小隊，在墜毀殖民船的殘骸裡打一場看得見結果的回合制戰棋。12 個任務的完整故事。

**宣傳文字**：殖民船墜毀八十年後，船還記得它的任務，把在這裡出生的人當成遺失的貨物。帶著一台只記得名字的小無人機，把人搶回來。

**完整說明**：

殖民船「曙光號」墜毀在冰衛星上，已經八十年。倖存者的後代住在殘骸裡，靠拾荒過日子。直到船上的機群醒了過來，開始把人一個一個抓回冬眠艙：對船來說任務還沒結束，離開艙位的人都是遺失的貨物。

你是拾荒隊的隊長凱。你在冰原上挖出一台小無人機，它不控制任何東西，只記得四萬個名字。帶著它，把人搶回來。

◆ 看得見結果的回合制戰術
・傷害是固定的，出手之前就看得到會打掉多少、對方會不會反擊
・高低差、側面和背後、掩體都算得出來，沒有命中率
・走錯了可以退回；可以警戒、把敵人推下裂谷、讓它癱瘓

◆ 6 台機體，各有打法
・突擊、重裝、狙擊、修復、斥候、指揮，每一台有自己的技能
・用過關拿到的零件在機庫改造，隨時可以拆掉重配
・21 種敵人與設施：曲射的織網者、正面打不動的堡壘、會修理同伴的修補者……

◆ 12 個任務的完整故事
・主線三章加後日談，有結局
・角色立繪會換表情，重要的場面有全螢幕插圖，各章有自己的配樂
・中文、英文隨時切換

◆ 打完還有
・挑戰模式：每一關用加強的敵人再打一次
・機體與敵人的圖鑑 27 則、成就 23 個
・一般、輕鬆兩種難度

◆ 為手機做的
・觸控直接點，也支援鍵盤和手把
・文字大小、色盲配色、演出速度都可以調
・三個存檔欄位，戰鬥中離開可以接著打
・免費，沒有廣告；不需要網路也能玩

**關鍵字**：戰棋,策略,機甲,機器人,科幻,回合制,戰術,單機,離線,劇情

## English

**Name**: Starfall Echo

**Subtitle**: Mech tactics with no dice

**Short description**: Lead a squad of mechs through a wrecked colony ship. Turn-based, no dice.

**Promotional text**: Eighty years after the colony ship fell, it still counts everyone born here as lost cargo. Take one small drone that remembers names, and bring your people back.

**Full description**:

The colony ship Aurelia fell on an ice moon eighty years ago. The survivors' descendants live in the wreck and salvage what they can. Then the ship's drones wake up and start taking people back to the sleep pods, one by one: as far as the ship is concerned the voyage never ended, and anyone outside a pod is lost cargo.

You are Kai, who leads a salvage crew. Out on the ice you dig up a small drone that controls nothing and remembers forty thousand names. Take it with you, and bring your people back.

◆ Turn-based tactics where you see the result first
• Damage is fixed: before you commit you see how much you will deal and whether the target can hit back
• Height, flanking, rear attacks and cover all count, and there is no hit chance
• Undo a move, set overwatch, push enemies into chasms or disable them

◆ 6 frames, each with its own job
• Assault, heavy, sniper, repair, scout and command, each with its own skills
• Upgrade them in the hangar with parts from missions, and refit whenever you like
• 21 kinds of enemies and structures: Weavers that shell over walls, Bastions you cannot crack from the front, Menders that repair their allies

◆ A complete story in 12 missions
• Three chapters and an epilogue, with an ending
• Portraits that change expression, full-screen illustrations for key scenes, and a battle theme for each chapter
• Chinese and English, switchable at any time

◆ More after the ending
• Challenge mode: replay every mission against tougher enemies
• A codex of 27 entries and 23 achievements
• Two difficulty settings

◆ Built for phones
• Tap to play, with keyboard and gamepad support
• Text size, a colour-blind palette and animation speed are adjustable
• Three save slots, and you can leave mid-battle and pick it up later
• Free, with no ads; plays without a network

**Keywords**: tactics,strategy,mech,robot,sci-fi,turn-based,srpg,offline,single player,story

## 其他欄位

- **分類**：遊戲 › 策略（次分類：角色扮演）
- **年齡分級**：機器之間的科幻戰鬥，沒有血腥；劇情提到軍方要「清除」冬眠艙。大約 9+（App Store）/ Everyone 10+（Google Play），以實際問卷為準
- **隱私權政策網址**：https://chiangclawd.github.io/web-srpg/legal/starfall-privacy.html
- **資料安全 / 隱私標籤**：看 App 的版本。第一版不含雲端同步，填「不收集資料」。之後加上登入同步時要改：收集帳號的識別碼和遊戲進度，用途是 App 的功能，玩家可以在遊戲裡刪除（設定 → 隱私權 → 刪除雲端資料）。回報問題是另外開瀏覽器到 Google 表單，由玩家自己填
- **支援網址**：https://github.com/chiangclawd/web-srpg/issues
- **行銷網址 / 介紹頁**：https://chiangclawd.github.io/web-srpg/echo/
- **AI 生成的素材**：兩家商店的後台都沒有要申報的欄位（查證的結果和日期在 [STARFALL_LICENSING.md](STARFALL_LICENSING.md)）；遊戲裡的製作名單和介紹頁都有寫明

## 字數上限

| 欄位 | 上限 | 哪一家 |
|---|---|---|
| 名稱 | 30 | 兩家 |
| 副標題 | 30 | App Store |
| 簡短說明 | 80 | Google Play |
| 宣傳文字 | 170 | App Store |
| 完整說明 | 4000 | 兩家 |
| 關鍵字 | 100（含逗號） | App Store |

## 還沒有的

- iPad 上遊戲的畫面上下有黑邊（遊戲最窄只排到 16:9），截圖照實拍，所以 iPad 那一套也有黑邊。上架 iPad 之前要決定是補 4:3 的版面，還是 App 只給 iPhone。
- 預告片還沒有人看過、聽過；App Store 的 App 預覽有自己的規格（長度 15 到 30 秒、指定的解析度），要用的時候再照規格輸出一份。
- 簡體中文和日文：遊戲本身還沒有。
