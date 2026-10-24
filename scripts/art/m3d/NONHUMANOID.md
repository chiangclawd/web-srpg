# 非人形角色的 3D 綁骨架（2026-10 調查）

Meshy 的自動綁骨架 API 只支援兩足人形，動作庫 678 個動作也全是人形用的。
狼、騎兵、獅鷲、蠍子、沙蟲這類角色要另外想辦法。

## 方案比較

| 方案 | 支援的體型 | 能否自動化 | 成本 | 結論 |
|---|---|---|---|---|
| Meshy API 綁骨架 | 只有人形 | 可以 | 綁骨 5 點、動作每個 3 點 | 只適合兩足怪物（見下） |
| Meshy 網頁版「Quadruped / Smart Rig」 | 四足（狗）、其他（測試中） | 只能在網頁手動操作 | 同上 | 四足動作很少（主要只有走路），無法批次 |
| Tripo API `rig_type` | biped、quadruped、hexapod、octopod、avian、serpentine、aquatic | 可以 | 另外要 Tripo 帳號與點數 | 非人形預設動作只有 walk / march，出招、倒地還是要自己做 |
| Anything World API | 四足、飛行、昆蟲等 | 可以 | 點數制（約 5 點一個模型），價格未公開 | 動作以 idle / walk / run 為主 |
| UniRig（MIT）/ RigAnything（開源論文模型） | 任意體型，自動生成骨架與權重 | 可以 | 免費，但需要 NVIDIA GPU | 這個環境沒有 GPU；可以放到 Colab 等 GPU 環境跑 |
| **Blender 自動綁骨 + 程式動作（採用）** | 四足、坐騎 + 騎士；可擴充翅膀、多足、蛇形 | 可以 | 只花 Meshy 圖轉 3D + 減面約 35 點 | 已用在雪原狼、蠻族騎兵 |

## 採用的做法：`quadrig.py`

1. `MESHY_POSE=none node scripts/art/meshy.mjs image <dir> <圖>`，再 `remesh`、`fetch <dir> remesh`，得到不綁骨架的 GLB。
2. `quadrig.py` 從網格形狀自動找地標：貼地的四團頂點是腳掌，沿著腿往上追到肚子得到膝蓋和肩髖，背脊高度剖面是脊椎，最前端是頭，後腿後方是尾巴。
3. 建骨架：Hips、脊椎 3 節、脖子、頭、尾巴 3 節，每條腿 3 節。用 Blender 的自動權重（bone heat）算權重；先在合併接縫頂點的代理網格上算，再轉回原網格，保留 UV。
4. 用程式寫關鍵影格：idle、walk（對角小跑）、attack（撲咬）、hit、death（側倒），匯出成 GLB。
5. 交給原本的 `render.mjs` 渲染成逐格圖表，遊戲端照常加進 `src/td/view/Sheets.ts`。

坐騎 + 騎士：在設定檔用方框框出騎士（以及伸出身體外的武器），框內頂點整塊綁在 `Rider` 骨頭上，跟著馬背走，出招時往前揮。範例見 `cavalry.rig.json`。

翅膀：`wings` 給左右兩個方框，框內頂點綁在兩節翅膀骨頭上（翅根放在方框內側邊緣，拍動時接縫幾乎不動）。
每節骨頭依自己的方向算拍動軸，翅膀往旁邊或斜前方伸都能上下拍。加上 `"flyer": true`，動作改成拍翅飛行、滑翔、
高舉翅膀下拍的攻擊、收翅翻落的死亡，腿一直收著。範例見 `flier.rig.json`（敵方獅鷲騎手）。
飛行時腳不動、量不到步幅，`Sheets.ts` 裡的 cycle 要手動設（決定拍翅快慢）。

找方框的方法：先用 Blender 輸出俯視的頂點高度分布（哪裡有頭、騎士、武器、翅膀一目了然），再換算成比例座標。
Meshy 有時會把模型斜放（例如艾莉亞的獅鷲斜了 36 度），用 `rotateZ` 先轉正：從四隻腳的位置算出身體方向。

```bash
python3 -m venv .venv-bpy && .venv-bpy/bin/pip install bpy==5.2.3
.venv-bpy/bin/python -I scripts/art/m3d/quadrig.py -- <models>/remesh_model_urls_glb.glb <models>/wolf_rig.glb [scripts/art/m3d/xxx.rig.json]
node scripts/art/m3d/render.mjs scripts/art/m3d/wolf.json <models> public/assets/m3d/wolf.webp
```

設定檔可調：`rider`（騎士方框）、`wings`（左右翅膀方框）、`flyer`（飛行動作）、`flap`（拍翅幅度，預設 0.6）、`rotateZ`（先轉正的角度）、`swing`（走路擺幅，預設 1.3）、`deathRoll`（倒向哪一側）、`headLen`（頭長占全長比例）、`footFracs`（找腳掌時的高度比例）。

## 其他非人形角色的建議

- **兩足怪物**：巨魔、雪怪、狼人、魔像、熔岩魔像、霜巨人、火焰領主、熔岩小鬼、惡魔、溺屍。體型是兩足，直接走 Meshy 人形流程（`pipeline.sh`）應該就能綁，每隻約 52 點。
- **敵方獅鷲騎手**：已完成（`flier.rig.json`）。
- **艾莉亞**：已試過但沒採用。她的手繪圖是側面視角，Meshy 重建出來兩片翅膀一高一低、方向不對稱，拍起來有一片會立成直的。
  要做的話，先準備一張正面或斜前方、兩片翅膀對稱張開的參考圖（Gemini 每月額度恢復後可以重畫），再重跑一次。
- **雷恩**：手繪圖是人站在馬旁邊，不是騎在馬上。要嘛人和馬分成兩個模型分別綁骨架、渲染時放在一起，要嘛重畫成騎馬的樣子。
- **蠍子、沙灘蟹**：多足版的 `quadrig.py`（找 6～8 團腳）。
- **沙蟲、利維坦**：一條脊椎骨鏈 + 波浪動作。
- **蝙蝠、幽靈、霜精靈**：本來就是飄浮或飛行，現有的 2D 變形動畫已經夠用，優先順序低。
