# 🔊 SFX — Gemini Pro AI 音效創作 Prompt

> 9 個戰鬥 / 系統 SFX。**程式已就緒**：把 mp3 放到 `public/assets/audio/sfx_<name>.mp3` push 即生效；缺檔自動 fallback 到既有 synth 程序版（不會炸）。
>
> UI click 留 synth（太頻繁、合成版已夠 pleasing），不開檔案層。

---

## 📋 9 個檔案對照表

| Name | 用在 | 檔名 | 觸發時機 |
|---|---|---|---|
| **sword** | 劍士攻擊 | `sfx_sword.mp3` | 劍兵 / 預設揮砍 |
| **lance** | 槍兵 / 騎兵衝撞 | `sfx_lance.mp3` | 槍 / 騎兵突刺 |
| **arrow** | 弓兵射擊 | `sfx_arrow.mp3` | 箭矢飛出 |
| **magic** | 法師施法 | `sfx_magic.mp3` | 法術發射 |
| **hit** | 命中傷害 | `sfx_hit.mp3` | 任何攻擊命中（接在 sword/lance/arrow/magic 後）|
| **unit_down** | 單位陣亡 | `sfx_unit_down.mp3` | 雙方單位 HP→0 |
| **level_up** | 升級 | `sfx_level_up.mp3` | 戰鬥結束結算經驗，符合升級條件 |
| **victory** | 戰鬥勝利 | `sfx_victory.mp3` | 章節完勝動畫 |
| **defeat** | 戰鬥失敗 | `sfx_defeat.mp3` | 我方主將陣亡 |

---

## 📐 共通規格

| | |
|---|---|
| **格式** | mp3（手機 PWA 友善）；m4a / aac 也可 |
| **長度** | **0.2-1.5 秒**（戰鬥 SFX 短，結算音 sting 1-1.5 秒）|
| **音量** | 不要爆（normalize 到 -10~-12 LUFS；比 BGM 大一點才凸出戰鬥動作）|
| **Sample rate** | 44.1kHz / 128kbps |
| **檔案大小目標** | < 100KB 一個（9 個合計 < 1MB）|
| **無 silence head/tail** | 開頭 / 結尾不要留空白；玩家會感覺到延遲 |

---

## 🎬 9 個 Prompt（Gemini Pro 音樂工具）

### 1️⃣ sword — 劍揮
```
Generate a short sword-swing whoosh sound effect for a tactical RPG.
Single quick swing, ~0.3 seconds, no impact (just air movement). Crisp
metallic edge with slight reverb tail. Inspired by classic JRPG battle
sounds (Final Fantasy Tactics, Fire Emblem). No music, no voice.

Output: 0.3-second mp3, 128kbps, normalized to -10 LUFS, no silence
at start or end.
```

### 2️⃣ lance — 槍刺 / 騎兵衝撞
```
Generate a heavy spear-thrust / lance-charge sound effect. 0.4 seconds,
deeper and weightier than a sword swing — air pressure + slight low
rumble at the tail (suggesting force / horseback). No actual impact
sound (that's a separate hit SFX). JRPG battle style.

Output: 0.4-second mp3, 128kbps, normalized to -10 LUFS, clean attack
and release.
```

### 3️⃣ arrow — 弓箭咻
```
Generate an arrow-shot sound effect: a bowstring twang followed by a
short whistling whoosh. ~0.5 seconds total. Crisp high-frequency
whistle tail (tapered, like the arrow flying away from camera). No
impact. Classic JRPG.

Output: 0.5-second mp3, 128kbps, normalized to -10 LUFS.
```

### 4️⃣ magic — 法術發射
```
Generate a magical spell-cast sound effect for a JRPG mage. ~0.6
seconds. Sparkly high-frequency shimmer + a subtle "release" surge in
the middle. Mystical, not elemental-specific (no fire/ice color — works
for any spell). Inspired by Final Fantasy Tactics generic magic SFX.

Output: 0.6-second mp3, 128kbps, normalized to -10 LUFS.
```

### 5️⃣ hit — 命中
```
Generate a melee/weapon impact sound effect. 0.2 seconds, sharp thwack
— meaty but not gory. Should layer well underneath sword/lance/arrow
swing sounds (this plays right after the weapon SFX when an attack
connects). Slight low-mid punch + crisp transient. No voice, no scream.

Output: 0.2-second mp3, 128kbps, normalized to -8 LUFS (a bit louder —
this is the satisfaction beat).
```

### 6️⃣ unit_down — 單位陣亡
```
Generate a unit-fallen sound effect for a tactical RPG: a soft descending
tone + a single low resonant thud at the end. ~0.8 seconds. Solemn,
not gory — appropriate for both player and enemy units. Inspired by
Fire Emblem unit-defeated SFX. No screaming, no death rattle.

Output: 0.8-second mp3, 128kbps, normalized to -10 LUFS, fade-out tail.
```

### 7️⃣ level_up — 升級
```
Generate a level-up jingle for a JRPG. 1.2 seconds, three rising bell-
like tones (ascending pattern, major key), followed by a gentle sparkle.
Triumphant but not overwhelming — this fires often during grinding.
Inspired by Final Fantasy / Octopath level-up flourishes.

Output: 1.2-second mp3, 128kbps, normalized to -10 LUFS.
```

### 8️⃣ victory — 勝利
```
Generate a chapter-victory sting for a tactical RPG. 1.5 seconds, brass
fanfare + bell + final low timpani hit. Triumphant, heroic, "we won
this battle" energy — but short and contained (this fires after every
chapter, not the final boss). Inspired by Fire Emblem chapter-clear
fanfares.

Output: 1.5-second mp3, 128kbps, normalized to -8 LUFS, clean fade-out.
```

### 9️⃣ defeat — 戰敗
```
Generate a defeat / game-over sting for a tactical RPG. 1.5 seconds,
descending minor-key brass + low strings + final muted bell. Tragic
and weighty — the player lost a critical unit and is restarting the
chapter. Not horror, just somber finality.

Output: 1.5-second mp3, 128kbps, normalized to -10 LUFS.
```

---

## 📋 步驟

1. 開 Gemini Pro 音樂創作工具
2. 一首一首貼 prompt（推薦順序：hit → sword → arrow → unit_down → level_up → victory → defeat → magic → lance；先做 hit 最高頻使用，立刻有感）
3. 下載 mp3，**檔名對照上表**改成 `sfx_<name>.mp3`
4. 放到 `public/assets/audio/`（GitHub Web UI 上傳，跟 BGM 同步驟）
5. push（或叫我推）

---

## 🔄 不滿意時的修曲指令

### 太大聲 / 蓋過 BGM
```
Re-render at 60% loudness / -14 LUFS. Keep timbre identical, just
quieter mix. The SFX plays over a tactical RPG soundtrack and shouldn't
duck the music.
```

### 太短聽不清楚
```
Re-render with a slightly longer release tail (+0.2 seconds), keeping
the same attack transient. The SFX will play during a 0.5-second
attack animation and the tail should match the animation end.
```

### 開頭 / 結尾有 silence（聽起來延遲）
```
Re-render with no silence at the start or end. The audio file should
begin at the attack transient (frame 0) and end exactly when the
release fades to silence. Trim any leading / trailing dead air.
```

### 太現代 / 不像 JRPG
```
Re-render in a more orchestral, "Japanese RPG of the late 90s / early
2000s" style. Less synth, more sampled real instruments (steel sword
foley, real bowstring, real horn). Reduce digital reverb, add subtle
tape-style warmth.
```

---

## 🎚️ 進階：批次處理工具

| 工具 | 用途 |
|---|---|
| **Audacity**（免費）| 剪頭尾 silence、normalize、淡入淡出 |
| **ffmpeg**（cmdline）| Batch normalize：`ffmpeg -i in.mp3 -af loudnorm=I=-10:LRA=7 out.mp3` |
| **Gemini Pro 音樂工具** | 直接重新生成版本（最快但消耗 quota）|

完成幾個就告訴我幾個，BGM / 立繪同款 pipeline：放路徑 → push → 立刻吃到。
