/**
 * 程序化合成音效（無需資產檔案，直接用 Web Audio API）
 * 第一次播放會初始化 AudioContext。瀏覽器需要 user gesture 才允許播放——
 * 因為遊戲一定要先點按鈕才開始，所以實務上沒問題。
 *
 * BGM 升級：若 public/assets/audio/bgm_<mood>.mp3 存在，優先播放檔案版
 * （HTMLAudioElement, loop=true）；缺檔時 fallback 到下方既有 synth 音層。
 * 兩者切換無痛，使用者陸續上傳音樂檔即可逐 mood 升級。
 */

import { getSettings } from './settings';

export type BgmMood = 'peaceful' | 'tense' | 'dark' | 'epic' | 'finale';

/** 各 mood 對應的音樂檔路徑（HTMLAudioElement loop 播放）*/
const BGM_FILES: Record<BgmMood, string> = {
  peaceful: 'assets/audio/bgm_peaceful.mp3',
  tense: 'assets/audio/bgm_tense.mp3',
  dark: 'assets/audio/bgm_dark.mp3',
  epic: 'assets/audio/bgm_epic.mp3',
  finale: 'assets/audio/bgm_finale.mp3',
};

/** BGM 預設音量（HTMLAudio 0..1）*/
const BGM_FILE_VOLUME = 0.45;

class AudioSynth {
  private ctx: AudioContext | null = null;
  // BGM 狀態（synth 版）
  private bgmOscs: OscillatorNode[] = [];
  private bgmLfos: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private bgmActive: BgmMood | null = null;
  private bgmMelodyTimer: ReturnType<typeof setInterval> | null = null;
  private bgmPercussionTimer: ReturnType<typeof setInterval> | null = null;
  // BGM 狀態（檔案版）
  private bgmAudioEl: HTMLAudioElement | null = null;
  private bgmAudioMood: BgmMood | null = null;
  /** 已載入過、確認檔案存在的 mood — 之後直接重用 */
  private bgmFileCache = new Map<BgmMood, HTMLAudioElement>();
  /** 載入失敗的 mood — 不再重試（用 synth fallback）*/
  private bgmFileMissing = new Set<BgmMood>();

  private getCtx(): AudioContext | null {
    if (getSettings().muted) return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  /** 短促上升音 — 點擊 / 選單 */
  playClick(): void {
    this.beep({ freq: 800, type: 'square', duration: 0.04, volume: 0.04 });
  }

  /** 劍揮 — 短促降頻 */
  playSwordSwing(): void {
    this.sweep({ from: 600, to: 200, type: 'sawtooth', duration: 0.12, volume: 0.06 });
  }

  /** 槍刺 / 騎兵衝撞 — 較沉的降頻 */
  playLanceThrust(): void {
    this.sweep({ from: 400, to: 120, type: 'sawtooth', duration: 0.15, volume: 0.07 });
  }

  /** 弓箭咻 — 高頻向下滑 */
  playArrowShot(): void {
    this.sweep({ from: 1400, to: 700, type: 'triangle', duration: 0.18, volume: 0.05 });
  }

  /** 法術發射 — 雙振盪 */
  playMagicCast(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.osc(440, 'sine', t, 0.2, 0.04);
    this.osc(660, 'sine', t + 0.02, 0.2, 0.03);
  }

  /** 命中 — 短促衝擊 */
  playHit(): void {
    this.beep({ freq: 180, type: 'square', duration: 0.06, volume: 0.06 });
  }

  /** 武將撤退 — 下降長音 */
  playUnitDown(): void {
    this.sweep({ from: 500, to: 100, type: 'sine', duration: 0.45, volume: 0.06 });
  }

  /** 升級 — 三音上升 */
  playLevelUp(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.osc(523, 'triangle', t, 0.1, 0.05);
    this.osc(659, 'triangle', t + 0.1, 0.1, 0.05);
    this.osc(784, 'triangle', t + 0.2, 0.18, 0.05);
  }

  /** 勝利 — 簡短和弦 */
  playVictory(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.osc(523, 'triangle', t, 0.18, 0.05);
    this.osc(659, 'triangle', t, 0.18, 0.04);
    this.osc(784, 'triangle', t, 0.18, 0.04);
    this.osc(1047, 'triangle', t + 0.2, 0.3, 0.05);
  }

  /** 戰敗 — 下降低音 */
  playDefeat(): void {
    this.sweep({ from: 300, to: 80, type: 'sawtooth', duration: 0.6, volume: 0.07 });
  }

  // ===== BGM =====
  /**
   * 啟動指定 mood 的 BGM。優先順序：
   *   1. public/assets/audio/bgm_<mood>.mp3（HTMLAudioElement loop）— 若有檔
   *   2. 程序化合成版（既有 synth 音層）— fallback
   *
   * 同 mood 重複呼叫不重啟；切換 mood 會把舊的（檔案 / synth）淡出。
   */
  startBgm(mood: BgmMood): void {
    if (this.bgmAudioMood === mood || this.bgmActive === mood) return;
    if (getSettings().muted) return;

    // 切換 mood：先把舊的關掉
    this.stopBgmInternal(false);

    // 優先嘗試檔案版（如果之前沒被標 missing）
    if (!this.bgmFileMissing.has(mood)) {
      this.tryStartBgmFile(mood);
      if (this.bgmAudioMood === mood) return; // 檔案版啟動成功
    }

    // 走 synth fallback
    const ctx = this.getCtx();
    if (!ctx) return;

    // 不同 mood 的和弦頻率（Hz，A4=440 為基準的相對位置）
    const moodChords: Record<BgmMood, number[]> = {
      peaceful: [110, 165, 220, 277], // A2 + E3 + A3 + C#4（A 大調主和弦上行）
      tense: [98, 117, 156, 196], // G2 + A#2 + D#3 + G3（G 增三和弦感）
      dark: [82, 98, 130, 165], // E2 + G2 + C3 + E3（E 小調陰沉）
      epic: [110, 138, 165, 220, 330], // A2 + C#3 + E3 + A3 + E4（疊加層）
      finale: [73, 87, 116, 175, 233], // D2 + F2 + A2 + F3 + A#3（複合不協和）
    };

    const freqs = moodChords[mood];

    this.bgmGain = ctx.createGain();
    // 整體很安靜（不蓋過 SFX）
    this.bgmGain.gain.value = 0;
    this.bgmGain.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 1.2);
    this.bgmGain.connect(ctx.destination);

    // 為每個和弦音建立振盪器 + 細微 detune（像「呼吸」）
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // detune LFO（極慢的微振動，產生 evolving 感）
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + Math.random() * 0.15; // 0.08 – 0.23 Hz
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1.5; // ±1.5 cents
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);

      osc.connect(this.bgmGain);
      osc.start();
      lfo.start();

      this.bgmOscs.push(osc);
      this.bgmLfos.push(lfo);
    }

    this.bgmActive = mood;

    // 啟動旋律層（每 ~1.1 秒一個音）
    const melodies: Record<BgmMood, number[]> = {
      peaceful: [440, 523, 659, 880, 659, 523, 440, 392],
      tense: [392, 466, 523, 622, 523, 466, 392, 349],
      dark: [330, 392, 440, 523, 440, 392, 330, 294],
      epic: [523, 659, 784, 880, 1047, 880, 784, 659],
      finale: [466, 587, 622, 698, 622, 466, 349, 233],
    };
    const notes = melodies[mood];
    let idx = 0;
    if (this.bgmMelodyTimer) clearInterval(this.bgmMelodyTimer);
    this.bgmMelodyTimer = setInterval(() => {
      if (this.bgmActive !== mood) {
        if (this.bgmMelodyTimer) {
          clearInterval(this.bgmMelodyTimer);
          this.bgmMelodyTimer = null;
        }
        return;
      }
      const note = notes[idx];
      if (note !== undefined) this.playMelodyNote(note);
      idx = (idx + 1) % notes.length;
    }, 1100);

    // 打擊樂層：epic / finale 加入低頻心跳
    if (this.bgmPercussionTimer) clearInterval(this.bgmPercussionTimer);
    if (mood === 'epic' || mood === 'finale' || mood === 'dark') {
      const interval = mood === 'finale' ? 1300 : 1500;
      const baseFreq = mood === 'finale' ? 70 : 85;
      this.bgmPercussionTimer = setInterval(() => {
        if (this.bgmActive !== mood) {
          if (this.bgmPercussionTimer) {
            clearInterval(this.bgmPercussionTimer);
            this.bgmPercussionTimer = null;
          }
          return;
        }
        this.playPercussionThud(baseFreq);
      }, interval);
    }
  }

  private playPercussionThud(freq: number): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private playMelodyNote(freq: number): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.022, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  /** 淡出後停止 BGM */
  stopBgm(): void {
    this.stopBgmInternal(true);
  }

  /**
   * 嘗試播放檔案版 BGM。檔案不存在或 decode 失敗 → 標 missing 留給 synth 補位。
   * Browser autoplay 限制：第一次玩家手勢前 audio 會 reject；fallback 到 synth
   * 由它的 AudioContext 走過用戶手勢解鎖。
   */
  private tryStartBgmFile(mood: BgmMood): void {
    let el = this.bgmFileCache.get(mood);
    if (!el) {
      el = new Audio(BGM_FILES[mood]);
      el.loop = true;
      el.volume = BGM_FILE_VOLUME;
      el.preload = 'auto';
      el.addEventListener('error', () => {
        this.bgmFileMissing.add(mood);
        this.bgmFileCache.delete(mood);
        if (this.bgmAudioMood === mood) {
          this.bgmAudioEl = null;
          this.bgmAudioMood = null;
        }
      });
      this.bgmFileCache.set(mood, el);
    }
    // 從頭播
    el.currentTime = 0;
    const playPromise = el.play();
    // 確認 play() 成功才正式登記為當前 BGM；失敗（autoplay block 或 decode error）
    // 等下一次 user gesture 觸發或被視為 missing。
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        // 不標 missing — 多半是 autoplay policy；下次 startBgm 會重試。
      });
    }
    this.bgmAudioEl = el;
    this.bgmAudioMood = mood;
  }

  private stopBgmInternal(fade: boolean): void {
    // 1) 停檔案版
    if (this.bgmAudioEl) {
      const el = this.bgmAudioEl;
      this.bgmAudioEl = null;
      this.bgmAudioMood = null;
      if (fade) {
        // 200ms 線性 fade out
        const startVol = el.volume;
        const t0 = performance.now();
        const tick = () => {
          const dt = (performance.now() - t0) / 200;
          if (dt >= 1) {
            el.pause();
            el.volume = startVol;
            return;
          }
          el.volume = startVol * (1 - dt);
          requestAnimationFrame(tick);
        };
        tick();
      } else {
        el.pause();
      }
    }

    // 2) 停 synth 版
    if (this.bgmMelodyTimer) {
      clearInterval(this.bgmMelodyTimer);
      this.bgmMelodyTimer = null;
    }
    if (this.bgmPercussionTimer) {
      clearInterval(this.bgmPercussionTimer);
      this.bgmPercussionTimer = null;
    }
    if (!this.bgmActive) return;
    const ctx = this.ctx;
    if (!ctx) {
      this.bgmActive = null;
      return;
    }
    const stopTime = fade ? ctx.currentTime + 0.6 : ctx.currentTime + 0.05;
    if (this.bgmGain) {
      this.bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, ctx.currentTime);
      this.bgmGain.gain.linearRampToValueAtTime(0.0001, stopTime);
    }
    const oscs = [...this.bgmOscs, ...this.bgmLfos];
    this.bgmOscs = [];
    this.bgmLfos = [];
    this.bgmGain = null;
    this.bgmActive = null;
    setTimeout(
      () => {
        for (const osc of oscs) {
          try {
            osc.stop();
          } catch {
            /* already stopped */
          }
        }
      },
      fade ? 700 : 100
    );
  }

  // ===== 內部工具 =====
  private beep(opts: { freq: number; type: OscillatorType; duration: number; volume: number }): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.osc(opts.freq, opts.type, ctx.currentTime, opts.duration, opts.volume);
  }

  private sweep(opts: {
    from: number;
    to: number;
    type: OscillatorType;
    duration: number;
    volume: number;
  }): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + opts.duration);
    gain.gain.setValueAtTime(opts.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + opts.duration + 0.02);
  }

  private osc(
    freq: number,
    type: OscillatorType,
    startAt: number,
    duration: number,
    volume: number
  ): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }
}

export const audio = new AudioSynth();
