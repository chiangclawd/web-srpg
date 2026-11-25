# 星墜殘響：AI 生成素材的授權與商店規定

2026-11-25 查的。這是照各家公開條款讀出來的整理，**不是法律意見**；條款會改，上架前要再對一次原文。
有幾頁很長，是分段讀的，沒有逐字讀到的地方下面有標出來。

## 結論

- 沒有找到會擋住「免費發行、之後賣收費 DLC」的條文。
- 三家都**不保證**生成的內容沒有侵害別人的權利，出事是我們自己負責；也都沒有替我們擔保或賠償。
- 兩件事要確認（見最後一節）：產生模型時 Meshy 帳號是不是付費方案；之後用 Gemini 生成要走有綁帳單的付費層級。

## 各家條款

| 服務 | 用在哪裡 | 條款怎麼說 | 我們要做的 |
|---|---|---|---|
| Gemini 圖片（立繪、CG、背景、標題圖） | `public/assets/starfall/pt_*.webp`、`cg_*.webp`、`bg_*.webp`、`title.webp` | Google 不主張生成內容的所有權，也可能替別人生成一樣或相似的內容。使用上我們自己負責，要遵守適用的法律。沒有一句明寫「可以商用」，也沒有禁止。**免費層級**另外多一條：我們授權 Google 使用生成的結果。所有生成的圖都帶 SynthID 浮水印。 | 用付費層級生成；不要刻意去除浮水印；提示詞不指名現有作品或畫家 |
| Lyria 配樂 | `public/assets/starfall/music/*.mp3` | 跟上面同一份條款，沒有另外針對音樂的規定。文件說生成的音訊帶 SynthID 浮水印、指名歌手或有版權的歌詞會被擋（這兩點只讀到摘要，沒逐字核對）。 | 同上 |
| Meshy 3D 模型與動作 | 機體圖表是用模型渲染的（`public/assets/starfall/units/`）；模型原始檔在私人的 repo | **付費方案**：生成的東西歸客戶所有，沒有要求標示。**免費方案**：歸 Meshy 所有，用 CC BY 4.0 授權給我們，要標示 Meshy。API 只有付費方案能用。不能移除它加的識別標記；不能拿生成的東西去訓練跟 Meshy 競爭的模型。用 API 生成的檔案三天後會從 Meshy 那邊刪掉，要自己備份。條款沒有寫「方案降級或退訂之後，之前生成的東西算誰的」。 | 確認生成時是付費方案；原始檔留好備份 |
| 思源黑體（內嵌字型） | `public/assets/starfall/fonts/` | SIL OFL 1.1，可以商用、可以內嵌，授權文字要跟著字型一起放。 | 已經放了 `OFL.txt` |

## 各商店對「事先用 AI 做好的素材」的規定

遊戲本身不會在執行時生成任何東西，素材都是事先做好的。

| 商店 | 規定 | 我們要做的 |
|---|---|---|
| Google Play | AI 生成內容的政策管的是「會替使用者生成內容」的 App；只是放了事先做好的 AI 內容、本身不能生成的，政策寫明不在範圍內。沒有找到要在後台申報素材來源的欄位。 | 沒有額外要求 |
| Apple App Store | 審查指南沒有找到要揭露事先做好的 AI 美術或音樂的條文。5.2 要求 App 裡的內容是自己做的，或是有授權的。 | 沒有額外要求；被問到時拿得出各家的條款 |
| Steam | 內容問卷有一節要求說明開發時用了哪些 AI 服務（「事先生成」這一類）。審查標準跟一般內容一樣：不能有違法或侵權的內容。 | 之後上 Steam 的話要填 |
| itch.io | 要求在專案頁的「AI Disclosure」標示；素材包和原聲帶頁面嚴格執行，沒標可能被下架出搜尋。 | 之後上 itch.io 的話要標 |

## 風險和做法

- **侵權風險在我們身上**。提示詞都留在 `scripts/art/prompts/`，裡面沒有指名現有作品；之後也照這樣做。
- **AI 生成的內容可能不受著作權保護**（Meshy 的條款自己就這樣寫）。意思是別人拿我們的圖去用，我們不一定攔得住。不影響發行和收費。
- **製作名單**：遊戲裡還沒有。上架前在設定頁加一頁，列出用到的工具（Gemini、Lyria、Meshy）和字型授權；Meshy 如果是免費方案生成的，這一頁就是必要的標示。
- **付費 DLC** 用到的新素材照同樣的規則：付費層級生成、留提示詞、留原始檔。

## 還要確認的事

1. **產生那 26 個模型時，Meshy 帳號是哪個方案？** 這台電腦有 API 金鑰，API 只有付費方案能用，所以應該是付費的；但只有帳號的主人能確定。如果有任何一個是免費方案時生成的，要標示 Meshy。
2. **之前在雲端環境生成圖片和配樂時，Gemini 用的是不是有綁帳單的專案？** 價目頁上圖片和 Lyria 都沒有免費額度，所以應該是付費的。之後在這台電腦生成，要用綁了帳單的金鑰。
3. Google 的通用 API 條款（2021 年版）有一段「API 回傳的內容，除非內容的所有人或法律允許，不得散布」。它寫的是第三方內容，沒有說生成的結果算不算；Gemini 的附加條款則明寫 Google 不主張所有權。這一點如果要十足把握，得問懂的人。

## 讀過的頁面

- Gemini API 附加條款（2026-03-23 生效）：https://ai.google.dev/gemini-api/terms
- 生成式 AI 禁止使用政策（2024-12-17）：https://policies.google.com/terms/generative-ai/use-policy
- Google API 服務條款（2021-11-09）：https://developers.google.com/terms
- Gemini API 圖片生成、音樂生成的文件：https://ai.google.dev/gemini-api/docs/image-generation 、https://ai.google.dev/gemini-api/docs/music-generation
- Meshy 使用條款（2026-09-19）和價目頁：https://www.meshy.ai/terms-of-use 、https://www.meshy.ai/pricing
- Google Play 的 AI 生成內容政策和說明：https://support.google.com/googleplay/android-developer/answer/13985936 、https://support.google.com/googleplay/android-developer/answer/14094294
- App Store 審查指南（2026-10-16）：https://developer.apple.com/app-store/review/guidelines/
- Steam 內容問卷：https://partner.steamgames.com/doc/gettingstarted/contentsurvey
- itch.io 品質準則：https://itch.io/docs/creators/quality-guidelines
