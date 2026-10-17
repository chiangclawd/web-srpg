"""把 Lyria 產生的整首曲子整理成遊戲 BGM。

    python3 scripts/art/prep_music.py <raw.mp3> <out.mp3>

曲子保留完整的開頭與收尾（遊戲端播完會停頓一下再從頭淡入），不硬切循環點：
整首歌的結尾和開頭接不起來，硬接會聽得出斷點。
- 去掉結尾的靜音，最後 0.6 秒淡出
- 兩段式 loudnorm 統一響度（-16 LUFS，線性增益，不壓縮動態）
- 112 kbps 立體聲 MP3
"""
import json
import subprocess
import sys
from pathlib import Path

raw, out = sys.argv[1], sys.argv[2]
trim = 'areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05,afade=t=in:d=0.6,areverse'
res = subprocess.run(
    ['ffmpeg', '-hide_banner', '-i', raw, '-af', f'{trim},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
    capture_output=True, text=True, check=True,
)
m = json.loads(res.stderr[res.stderr.rindex('{'):])
norm = (
    f"loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
    f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}"
)
Path(out).parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', f'{trim},{norm}', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '112k', out], check=True)
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]))
print(f'{Path(out).name}: {dur:.1f}s (input {m["input_i"]} LUFS)')
