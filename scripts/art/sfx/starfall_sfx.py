# 《星墜殘響》的戰鬥音效與環境音：離線合成成檔案（遊戲裡原本是用 Web Audio 兩三個振盪器即時湊的）。
#   py scripts/art/sfx/starfall_sfx.py public/assets/starfall/sfx      （需要 numpy 和 PATH 上的 ffmpeg）
# 做法：每個聲音由幾層疊起來（掃頻的音、濾過的雜訊、不成倍數的金屬泛音、低頻的衝擊），最後加一點殘響。
# 亂數固定種子，重跑會得到一樣的檔案。音效存 .m4a；環境音要無縫循環，AAC 頭尾會多出空白，所以存 .wav。
import os, subprocess, sys, wave
import numpy as np

OUT = sys.argv[1]
SR = 44100
rng = np.random.default_rng(7)
os.makedirs(OUT, exist_ok=True)


def t(d):
    return np.arange(int(SR * d)) / SR


def env(d, a=0.004, k=6.0):
    """很快起音、指數衰減"""
    x = t(d)
    return np.minimum(1, x / a) * np.exp(-k * x / d)


def sweep(f0, f1, d, shape='sine', curve=1.0):
    """從 f0 掃到 f1 的音"""
    x = t(d) / d
    f = f0 * (f1 / f0) ** (x ** curve)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph)
    if shape == 'saw':
        s = 2 * ((ph / (2 * np.pi)) % 1) - 1
    if shape == 'square':
        s = np.sign(s)
    return s


def noise(d, lo=0.0, hi=20000.0):
    """帶通過的白雜訊（直接在頻譜上挖）"""
    n = int(SR * d)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= 1 / (1 + (lo / np.maximum(f, 1)) ** 6) / (1 + (f / hi) ** 6)
    s = np.fft.irfft(spec, n)
    return s / (np.abs(s).max() + 1e-9)


def metal(freqs, d, k=7.0):
    """金屬聲：幾個不成倍數的泛音，高的衰減得快"""
    x = t(d)
    return sum(np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) * np.exp(-k * (1 + i * 0.6) * x / d) / (1 + i * 0.5) for i, f in enumerate(freqs))


def mix(*layers):
    """layers: (訊號, 音量, 起始秒)"""
    n = max(int(SR * at) + len(s) for s, _, at in layers)
    out = np.zeros(n)
    for s, g, at in layers:
        i = int(SR * at)
        out[i:i + len(s)] += s * g
    return out


def reverb(s, d=0.5, wet=0.22):
    ir = rng.standard_normal(int(SR * d)) * np.exp(-6 * t(d) / d)
    tail = np.convolve(s, ir)
    tail /= np.abs(tail).max() + 1e-9
    dry = np.concatenate([s, np.zeros(len(tail) - len(s))])
    return dry + tail * wet * np.abs(s).max()


def finish(s, peak=0.85):
    s = np.tanh(s * 1.4)                       # 輕微的飽和，聽起來比較紮實
    s = s / (np.abs(s).max() + 1e-9) * peak
    n = int(SR * 0.012)
    s[-n:] *= np.linspace(1, 0, n)             # 結尾收乾淨，不要有爆音
    return s


def save(name, s, loop=False):
    pcm = (np.clip(s, -1, 1) * 32767).astype('<i2')
    path = os.path.join(OUT, f'{name}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR if not loop else 22050)
        w.writeframes((pcm[::2] if loop else pcm).tobytes())
    if loop:
        return
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-c:a', 'aac', '-b:a', '96k', os.path.join(OUT, f'{name}.m4a')], check=True)
    os.remove(path)


SFX = {
    # 脈衝步槍：往下掃的一聲，前面一點點爆裂
    'laser': lambda: reverb(mix((sweep(2100, 320, 0.17, 'saw') * env(0.17, k=5), 0.6, 0), (sweep(1200, 200, 0.14) * env(0.14, k=4), 0.5, 0.005), (noise(0.04, 2500) * env(0.04, k=8), 0.35, 0)), 0.25, 0.14),
    # 加農砲：低頻的一拳 + 悶的爆風
    'cannon': lambda: reverb(mix((sweep(120, 36, 0.5) * env(0.5, k=5), 1.0, 0), (noise(0.45, 30, 900) * env(0.45, k=6), 0.8, 0), (noise(0.05, 1500, 7000) * env(0.05, k=7), 0.5, 0)), 0.7, 0.3),
    # 磁軌砲：尖銳的爆裂 + 很快掃下來的電音，尾巴長
    'rail': lambda: reverb(mix((noise(0.07, 3000) * env(0.07, k=6), 0.8, 0), (sweep(3200, 140, 0.38, 'square', 0.6) * env(0.38, k=5), 0.35, 0.004), (sweep(800, 60, 0.4) * env(0.4, k=4), 0.6, 0)), 0.9, 0.34),
    # 爪擊：兩下金屬刮擦
    'claw': lambda: reverb(mix((noise(0.11, 1800, 6500) * env(0.11, a=0.01, k=4), 0.8, 0), (noise(0.12, 2400, 8000) * env(0.12, a=0.01, k=4), 0.7, 0.09), (metal([940, 2110, 3370], 0.25), 0.25, 0.02)), 0.3, 0.16),
    # 迫擊砲：落下來的哨音，然後悶爆
    'mortar': lambda: reverb(mix((sweep(1500, 420, 0.42, curve=1.6) * np.linspace(0.2, 1, int(SR * 0.42)), 0.35, 0), (sweep(100, 34, 0.45) * env(0.45, k=5), 1.0, 0.42), (noise(0.4, 30, 1100) * env(0.4, k=6), 0.8, 0.42)), 0.7, 0.3),
    # 命中裝甲：金屬的鏗一聲
    'hit': lambda: reverb(mix((metal([520, 1130, 1870, 2630, 3410], 0.22, 8), 0.6, 0), (noise(0.03, 1500) * env(0.03, k=7), 0.6, 0), (sweep(180, 70, 0.1) * env(0.1, k=6), 0.5, 0)), 0.3, 0.18),
    # 機體爆炸：長的低頻轟鳴、碎片的劈啪聲
    'boom': lambda: reverb(mix((noise(1.3, 20, 700) * env(1.3, a=0.006, k=5), 1.0, 0), (sweep(70, 26, 0.9) * env(0.9, k=4), 0.9, 0), (noise(0.09, 1200, 9000) * env(0.09, k=6), 0.6, 0), (noise(0.9, 2500, 9000) * env(0.9, k=7) * (rng.random(int(SR * 0.9)) > 0.985), 1.6, 0.08)), 1.1, 0.36),
    # 機甲的腳步：伺服機的嘶一聲 + 落地
    'step': lambda: mix((sweep(95, 55, 0.09) * env(0.09, k=6), 1.0, 0.03), (noise(0.06, 1500, 5000) * env(0.06, a=0.02, k=5), 0.25, 0), (noise(0.05, 60, 500) * env(0.05, k=7), 0.6, 0.03)),
    # 修復：三個往上的音，帶一點閃爍
    'heal': lambda: reverb(mix(*[(np.sin(2 * np.pi * f * t(0.32)) * env(0.32, a=0.02, k=4) * (1 + 0.3 * np.sin(2 * np.pi * 9 * t(0.32))), 0.45, i * 0.09) for i, f in enumerate([523, 659, 784, 1047])]), 0.6, 0.3),
    # 超載駭入：一陣斷斷續續的電流聲
    'stun': lambda: reverb(mix((noise(0.42, 900, 7000) * (np.sign(np.sin(2 * np.pi * 47 * t(0.42))) > 0) * env(0.42, k=3), 0.7, 0), (sweep(220, 90, 0.42, 'square') * env(0.42, k=3), 0.25, 0)), 0.3, 0.2),
    # 敵方回合 / 增援：兩聲警報
    'alert': lambda: reverb(mix(*[(sweep(620, 880, 0.2, 'saw') * env(0.2, a=0.02, k=2.5), 0.4, i * 0.26) for i in range(2)]), 0.4, 0.2),
}

for name, make in SFX.items():
    save(name, finish(make()))
    print('sfx', name)


def loop(make, d=8.0):
    """無縫循環：多做一秒，把尾巴疊回開頭交叉淡化"""
    s = make(d + 1.0)
    n = int(SR * 1.0)
    head = s[:n] * np.linspace(0, 1, n) + s[-n:] * np.linspace(1, 0, n)
    s = np.concatenate([head, s[n:-n]])
    return s / (np.abs(s).max() + 1e-9) * 0.7


# 冰原的風：低沉的呼嘯，強弱慢慢起伏
save('amb_wind', loop(lambda d: noise(d, 80, 700) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t(d)) * np.sin(2 * np.pi * 0.047 * t(d) + 1)) + noise(d, 900, 2600) * 0.12 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.19 * t(d)))), loop=True)
# 船艙：反應爐和管線的低頻嗡鳴
save('amb_hum', loop(lambda d: 0.6 * np.sin(2 * np.pi * 55 * t(d)) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.3 * t(d))) + 0.3 * np.sin(2 * np.pi * 110.4 * t(d)) + 0.12 * np.sin(2 * np.pi * 165.7 * t(d)) + noise(d, 100, 500) * 0.2), loop=True)
print('ambience amb_wind amb_hum')
