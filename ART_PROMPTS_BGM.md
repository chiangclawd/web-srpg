# 🎵 BGM — Gemini Pro AI 音樂創作 Prompt

> 5 個 mood 對應 5 首 BGM。**程式已就緒**：把 mp3 放到 `public/assets/audio/bgm_<mood>.mp3` push 即生效；缺檔自動 fallback 到既有 synth 程序版（不會炸）。
>
> 可以一首一首補（先做 peaceful 試水溫）。

---

## 📋 5 個檔案對照表

| Mood | 用在 | 檔名 | 章節 |
|---|---|---|---|
| **peaceful** | Hub / 平日 | `bgm_peaceful.mp3` | Ch1, Ch2, Ch9（後日談前段）|
| **tense** | 中段戰鬥 | `bgm_tense.mp3` | Ch4, Ch5, Ch11 試煉 |
| **dark** | 黑暗教派 | `bgm_dark.mp3` | Ch6, Ch7, Ch12, Ch13 |
| **epic** | BOSS 戰 | `bgm_epic.mp3` | Ch3, Ch8（最終 BOSS）, Ch10, Ch14 |
| **finale** | 收尾 | `bgm_finale.mp3` | Ch10 真結局, Ch14 永生終局 |

---

## 📐 共通規格

| | |
|---|---|
| **格式** | mp3（手機 PWA 友善）；m4a / aac 也可 |
| **長度** | **60-90 秒**（loop 用；太短重複明顯，太長檔案大）|
| **Loopable** | 結尾要能無縫接回開頭（最後 1 秒淡出 → 程式 loop 會接續，不必硬切）|
| **音量** | 不要爆（normalize 到 -14 LUFS 左右；PWA 玩家可能會耳機聽）|
| **Sample rate** | 44.1kHz / 128-160kbps（手機跑 ok 不破音即可）|
| **檔案大小目標** | < 1.5 MB（5 首 ~ 7.5 MB，可接受）|

---

## 🎬 5 首 Prompt（Gemini Pro 音樂工具）

### 1️⃣ peaceful — Hub / 平日
```
Generate a calm, hopeful JRPG town theme. Mid-tempo (90 BPM), 
acoustic guitar arpeggios + soft strings + light woodwind countermelody. 
A major key, no percussion. Loopable 60 seconds. Inspired by Octopath 
Traveler town themes. Warm and slightly nostalgic — players are 
preparing for battle, not in danger yet.

Output: 60-second mp3, 128kbps, normalized to -14 LUFS.
```

### 2️⃣ tense — 中段戰鬥
```
Generate a mid-tempo orchestral battle theme for a tactical RPG. 
110 BPM, A minor, driving strings + low brass + military snare. 
Build tension without being overly aggressive — this is a "we know 
we'll win but it's a close fight" track. Inspired by Fire Emblem 
chapter battle themes. Loopable 75 seconds with a smooth seam.

Output: 75-second mp3, 128kbps, normalized to -14 LUFS.
```

### 3️⃣ dark — 黑暗教派
```
Generate a sinister, suspenseful tactical RPG theme. 80 BPM, D minor, 
low piano motif + sustained low strings + distant choir + occasional 
bell tolls. No major key resolution — keep the unease throughout. 
Inspired by Final Fantasy Tactics church / cult themes. Loopable 
70 seconds.

Output: 70-second mp3, 128kbps, normalized to -14 LUFS.
```

### 4️⃣ epic — BOSS 戰
```
Generate an EPIC orchestral boss battle theme for a tactical RPG. 
130 BPM, E minor, full orchestra: powerful brass leads + driving 
string ostinato + war drums + male choir on the chorus. Heroic and 
dramatic. Inspired by Fire Emblem "Id (Purpose)" or Octopath 
"Decisive Battle II". Loopable 90 seconds, with a clear "build → 
chorus → release → loop seam" structure.

Output: 90-second mp3, 160kbps, normalized to -14 LUFS.
```

### 5️⃣ finale — 真結局 / 終局
```
Generate a climactic, weighty final-battle theme for a tactical RPG. 
105 BPM, B minor → D major modulation halfway through. Massive 
orchestra + adult choir + low pipe organ. Mood: this is the LAST 
fight, the world is at stake. Heroic but with a tragic undertone — 
some of the heroes may not survive. Inspired by Fire Emblem "Twilight 
of the Gods" or Tales of "Vesperia main theme final variation". 
Loopable 90 seconds.

Output: 90-second mp3, 160kbps, normalized to -14 LUFS.
```

---

## 📋 步驟

1. 開 Gemini Pro 音樂創作工具
2. 一首一首貼 prompt（推薦順序：peaceful → epic → dark → tense → finale，先確認小規模音色滿意）
3. 下載 mp3，**檔名對照上表**改成 `bgm_<mood>.mp3`
4. （可選）用 ffmpeg 確保 loop 接縫平滑：
   ```
   ffmpeg -i original.mp3 -af "afade=t=out:st=89:d=1" bgm_xxx.mp3
   ```
5. 放到 `public/assets/audio/`（GitHub Web UI 上傳，跟 portrait 同步驟）
6. push（或叫我推）

---

## 🔄 不滿意時的修圖（修曲？）指令

### 太吵 / 蓋過 SFX
```
Re-render the same composition but at 70% volume / -18 LUFS. Keep 
arrangement identical, just quieter mix. The track will play under 
sound effects in a tactical RPG.
```

### Loop 接縫聽得到
```
Re-render with a clearer loop point: the last 2 seconds should fade 
to silence at the same dynamic level as the first 2 seconds, so 
playing the file on repeat creates no audible seam.
```

### 太現代 / 不像 JRPG
```
Re-render in a more orchestral, "Japanese RPG of the late 90s / early 
2000s" style. Reduce synth pads, increase live-instrument feel: real 
strings, real woodwinds, real brass. Less dance / EDM, more 
soundtrack.
```

### 太無聊 / 沒記憶點
```
Re-render with a stronger main melodic motif in the first 8 bars. 
The melody should be hummable — players should be able to whistle 
the first phrase after one listen.
```

---

## 🎚️ 進階：Loop 點 / 音量微調工具

| 工具 | 用途 |
|---|---|
| **Audacity**（免費）| 剪 loop 點、normalize、淡入淡出 |
| **ffmpeg**（cmdline）| Batch normalize、convert format |
| **Gemini Pro 音樂工具** | 直接重新生成版本（最快但消耗 quota）|

完成幾首就告訴我幾首，PNG 同款 pipeline：放路徑 → push → 立刻吃到。
