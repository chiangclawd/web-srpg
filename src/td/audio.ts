import { save } from './save';
import type { ThemeId } from './sim/defs';
import { getLang } from './i18n';
import { VOICE_LINES, type VoiceLine } from './data/voices';

/**
 * 塔防音效系統：
 *   - BGM：Gemini Lyria 產生的整首配樂（HTMLAudio，淡入淡出切換；曲子有完整收尾，播完停頓一下再從頭淡入）
 *   - SFX：既有 m4a 解碼成 AudioBuffer（可大量重疊播放）＋ Web Audio 即時合成
 *   - 同一音效 40ms 內只播一次，避免 20 座箭塔齊射時爆音
 */

export type Bgm = 'title' | 'map' | 'grass' | 'forest' | 'snow' | 'waste' | 'desert' | 'volcano' | 'boss' | 'finale';

/** 各地形的戰鬥配樂 */
export const THEME_BGM: Record<ThemeId, Bgm> = {
  grass: 'grass',
  autumn: 'grass',
  forest: 'forest',
  snow: 'snow',
  waste: 'waste',
  desert: 'desert',
  volcano: 'volcano',
};

/** 配樂統一做過響度標準化（-16 LUFS），比音效檔小聲一些，這裡補回來 */
const BGM_GAIN = 0.8;
/** 曲子播完到重新開始之間的停頓 */
const BGM_GAP_MS = 2000;

export type Sfx =
  | 'arrow'
  | 'magic'
  | 'hit'
  | 'sword'
  | 'victory'
  | 'defeat'
  | 'levelup'
  | 'lance'
  | 'death'
  | 'cannon'
  | 'explosion'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'coin'
  | 'horn'
  | 'click'
  | 'lifelost'
  | 'whoosh'
  | 'zap'
  | 'heal'
  | 'boss'
  | 'error'
  | 'sparkle'
  | 'freeze'
  | 'star'
  | 'thud'
  | 'rumble';

const FILES: Partial<Record<Sfx, string>> = {
  arrow: 'assets/audio/sfx_arrow.m4a',
  magic: 'assets/audio/sfx_magic.m4a',
  hit: 'assets/audio/sfx_hit.m4a',
  sword: 'assets/audio/sfx_sword.m4a',
  victory: 'assets/audio/sfx_victory.m4a',
  defeat: 'assets/audio/sfx_defeat.m4a',
  levelup: 'assets/audio/sfx_level_up.m4a',
  lance: 'assets/audio/sfx_lance.m4a',
};

const FILE_GAIN: Partial<Record<Sfx, number>> = {
  arrow: 0.35,
  magic: 0.45,
  hit: 0.35,
  sword: 0.3,
  victory: 0.8,
  defeat: 0.8,
  levelup: 0.7,
  lance: 0.4,
};

class TdAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Sfx, AudioBuffer>();
  private loading = new Set<Sfx>();
  private lastPlay = new Map<Sfx, number>();
  private noiseBuf: AudioBuffer | null = null;
  private bgmEl: HTMLAudioElement | null = null;
  private bgmName: Bgm | null = null;
  private wantBgm: Bgm | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private replayTimer: ReturnType<typeof setTimeout> | null = null;
  private voices = new Map<string, AudioBuffer | 'loading'>();
  private voiceSrc: AudioBufferSourceNode | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.ensureCtx();
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
      if (this.wantBgm && (!this.bgmEl || this.bgmEl.paused)) {
        const w = this.wantBgm;
        this.bgmName = null;
        this.playBgm(w);
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.bgmEl?.pause();
        this.ctx?.suspend().catch(() => {});
      } else {
        this.ctx?.resume().catch(() => {});
        if (this.bgmEl && this.wantBgm && save().settings.music > 0) this.bgmEl.play().catch(() => {});
      }
    });
  }

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // 輕微壓縮避免爆音
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      for (const k of Object.keys(FILES) as Sfx[]) this.load(k);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private load(k: Sfx): void {
    const url = FILES[k];
    if (!url || !this.ctx || this.loading.has(k)) return;
    this.loading.add(k);
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('404'))))
      .then((ab) => this.ctx!.decodeAudioData(ab))
      .then((buf) => this.buffers.set(k, buf))
      .catch(() => {});
  }

  get sfxVol(): number {
    return save().settings.sfx;
  }

  play(k: Sfx, vol = 1, rate = 1): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.sfxVol <= 0) return;
    const now = performance.now();
    const last = this.lastPlay.get(k) ?? 0;
    if (now - last < 45) return;
    this.lastPlay.set(k, now);
    const v = vol * this.sfxVol;
    const buf = this.buffers.get(k);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
      const g = ctx.createGain();
      g.gain.value = v * (FILE_GAIN[k] ?? 0.5);
      src.connect(g);
      g.connect(this.master);
      src.start();
      return;
    }
    this.synth(k, v);
  }

  // ───────── 英雄語音 ─────────
  private voiceKey(hero: string, line: VoiceLine): string {
    return `${hero}_${line}_${getLang()}`;
  }

  private loadVoice(key: string): void {
    if (!this.ctx || this.voices.has(key)) return;
    this.voices.set(key, 'loading');
    fetch(`assets/audio/voice/${key}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('404'))))
      .then((ab) => this.ctx!.decodeAudioData(ab))
      .then((buf) => this.voices.set(key, buf))
      .catch(() => this.voices.delete(key));
  }

  /** 預先下載某位英雄（目前語言）的全部語音，每句約 10KB */
  preloadVoice(hero: string): void {
    if (!this.ensureCtx()) return;
    for (const line of VOICE_LINES) this.loadVoice(this.voiceKey(hero, line));
  }

  /** 預先下載首領登場台詞 */
  preloadBossVoice(boss: string): void {
    if (this.ensureCtx()) this.loadVoice(`boss_${boss}_${getLang()}`);
  }

  /** 英雄說一句台詞 */
  voice(hero: string, line: VoiceLine): void {
    this.speak(this.voiceKey(hero, line));
  }

  /** 首領登場喊話 */
  bossVoice(boss: string): void {
    this.speak(`boss_${boss}_${getLang()}`);
  }

  /** 播一句語音；還沒下載好就這次不說。新的一句會打斷前一句，避免疊在一起 */
  private speak(key: string): void {
    if (save().settings.voice === false) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.sfxVol <= 0) return;
    const buf = this.voices.get(key);
    if (!buf) this.loadVoice(key);
    if (!buf || buf === 'loading') return;
    try {
      this.voiceSrc?.stop();
    } catch {
      // 已經播完
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.9 * this.sfxVol;
    src.connect(g);
    g.connect(this.master);
    src.start();
    this.voiceSrc = src;
  }

  // ───────── 合成音 ─────────
  private tone(freq: number, type: OscillatorType, t: number, dur: number, vol: number, slideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, freqTo?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private synth(k: Sfx, v: number): void {
    const t = this.ctx!.currentTime;
    switch (k) {
      case 'arrow':
        this.noise(t, 0.12, 0.25 * v, 'bandpass', 3000, 1200);
        break;
      case 'magic':
        this.tone(520, 'sine', t, 0.25, 0.12 * v, 1200);
        this.tone(780, 'triangle', t + 0.03, 0.2, 0.06 * v, 1500);
        break;
      case 'hit':
      case 'sword':
        this.noise(t, 0.08, 0.3 * v, 'highpass', 2000);
        this.tone(220, 'square', t, 0.06, 0.05 * v, 120);
        break;
      case 'death':
        this.noise(t, 0.18, 0.18 * v, 'lowpass', 1400, 300);
        this.tone(300, 'triangle', t, 0.16, 0.06 * v, 120);
        break;
      case 'cannon':
        this.tone(110, 'sine', t, 0.25, 0.35 * v, 45);
        this.noise(t, 0.15, 0.25 * v, 'lowpass', 900, 200);
        break;
      case 'explosion':
        this.noise(t, 0.55, 0.55 * v, 'lowpass', 1600, 120);
        this.tone(80, 'sine', t, 0.4, 0.4 * v, 35);
        break;
      case 'build':
        for (let i = 0; i < 3; i++) {
          this.noise(t + i * 0.11, 0.06, 0.35 * v, 'bandpass', 1400 - i * 200);
          this.tone(260 - i * 30, 'square', t + i * 0.11, 0.05, 0.05 * v);
        }
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'triangle', t + i * 0.07, 0.18, 0.12 * v));
        break;
      case 'sell':
      case 'coin':
        this.tone(1318, 'square', t, 0.07, 0.05 * v);
        this.tone(1760, 'square', t + 0.06, 0.12, 0.05 * v);
        break;
      case 'horn': {
        for (const f of [196, 247, 294]) {
          const ctx = this.ctx!;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1200;
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(f * 0.94, t);
          o.frequency.linearRampToValueAtTime(f, t + 0.15);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.12);
          g.gain.setValueAtTime(0.09 * v, t + 0.9);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
          o.connect(lp);
          lp.connect(g);
          g.connect(this.master!);
          o.start(t);
          o.stop(t + 1.4);
        }
        break;
      }
      case 'click':
        this.tone(900, 'triangle', t, 0.05, 0.08 * v, 1300);
        break;
      case 'lifelost':
        this.tone(330, 'triangle', t, 0.4, 0.18 * v, 200);
        this.tone(165, 'sine', t, 0.5, 0.15 * v);
        break;
      case 'whoosh':
        this.noise(t, 0.6, 0.25 * v, 'bandpass', 400, 2400);
        break;
      case 'zap':
        this.noise(t, 0.18, 0.3 * v, 'highpass', 3000);
        this.tone(1800, 'sawtooth', t, 0.12, 0.05 * v, 300);
        break;
      case 'heal':
        [784, 988, 1318].forEach((f, i) => this.tone(f, 'sine', t + i * 0.05, 0.3, 0.07 * v));
        break;
      case 'boss':
        this.tone(70, 'sawtooth', t, 1.2, 0.2 * v, 50);
        this.noise(t, 1, 0.2 * v, 'lowpass', 500, 120);
        break;
      case 'error':
        this.tone(150, 'square', t, 0.15, 0.08 * v);
        break;
      case 'sparkle':
        for (let i = 0; i < 5; i++) this.tone(1200 + Math.random() * 1600, 'sine', t + i * 0.04, 0.15, 0.05 * v);
        break;
      case 'freeze':
        this.noise(t, 0.4, 0.2 * v, 'highpass', 4000, 1500);
        this.tone(1400, 'sine', t, 0.4, 0.06 * v, 600);
        break;
      case 'star':
        this.tone(1046, 'triangle', t, 0.25, 0.12 * v);
        this.tone(1568, 'sine', t + 0.08, 0.35, 0.1 * v);
        break;
      case 'thud':
        this.tone(120, 'sine', t, 0.2, 0.3 * v, 60);
        break;
      case 'rumble':
        // 巨石滾動：低沉的隆隆聲＋一路蹦起的碎石
        this.noise(t, 1.9, 0.5 * v, 'lowpass', 240, 110);
        this.tone(54, 'sine', t, 1.7, 0.22 * v, 38);
        for (let i = 0; i < 7; i++) this.noise(t + i * 0.24 + Math.random() * 0.1, 0.05, 0.1 * v, 'bandpass', 800 + Math.random() * 700);
        break;
      case 'levelup':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 'square', t + i * 0.06, 0.2, 0.06 * v));
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'triangle', t + i * 0.15, 0.5, 0.12 * v));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 'triangle', t + i * 0.22, 0.5, 0.12 * v));
        break;
      case 'lance':
        this.noise(t, 0.12, 0.25 * v, 'bandpass', 1200, 400);
        break;
    }
  }

  // ───────── BGM ─────────
  playBgm(name: Bgm): void {
    this.wantBgm = name;
    const vol = save().settings.music;
    if (this.bgmName === name && this.bgmEl && !this.bgmEl.paused) return;
    const old = this.bgmEl;
    const el = new Audio(`assets/audio/td/bgm_${name}.mp3`);
    el.volume = 0;
    el.addEventListener('ended', () => this.replay(el));
    this.bgmEl = el;
    this.bgmName = name;
    if (vol > 0) {
      el.play().catch(() => {
        // 尚未有 user gesture：等 unlock 時再播
        this.bgmName = null;
      });
    }
    this.fadeTo(el, old, vol * BGM_GAIN);
  }

  /** 播完停頓一下，再從頭淡入（不硬切循環點，整首歌的收尾才聽得完整） */
  private replay(el: HTMLAudioElement): void {
    if (this.replayTimer) clearTimeout(this.replayTimer);
    this.replayTimer = setTimeout(() => {
      this.replayTimer = null;
      const vol = save().settings.music;
      if (this.bgmEl !== el || !this.wantBgm || vol <= 0 || document.hidden) return;
      el.currentTime = 0;
      el.volume = 0;
      el.play().catch(() => {});
      this.fadeTo(el, null, vol * BGM_GAIN);
    }, BGM_GAP_MS);
  }

  private fadeTo(el: HTMLAudioElement, old: HTMLAudioElement | null, target: number): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    let t = 0;
    const oldVol = old?.volume ?? 0;
    this.fadeTimer = setInterval(() => {
      t += 0.05;
      const k = Math.min(1, t / 0.8);
      el.volume = target * k;
      if (old) old.volume = oldVol * (1 - k);
      if (k >= 1) {
        if (old) {
          old.pause();
          old.src = '';
        }
        clearInterval(this.fadeTimer!);
        this.fadeTimer = null;
      }
    }, 50);
  }

  refreshVolumes(): void {
    const vol = save().settings.music;
    if (this.bgmEl) {
      this.bgmEl.volume = vol * BGM_GAIN;
      if (vol <= 0) this.bgmEl.pause();
      else if (this.bgmEl.paused && this.wantBgm) this.bgmEl.play().catch(() => {});
    }
  }
}

export const sfx = new TdAudio();
