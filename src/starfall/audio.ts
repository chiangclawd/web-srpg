// 音效：全部用 Web Audio 即時合成（科幻風的雷射、爆炸、提示音），不需要音檔
import { save } from './save';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  master!.gain.value = save().sfx;
  return ctx;
}

/** 瀏覽器要有使用者操作才能出聲：第一次點擊時呼叫 */
export function unlockAudio(): void {
  ac();
  refreshMusic();
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
  const a = ac();
  if (!a || !master || save().sfx <= 0) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, lowpass: number, delay = 0): void {
  const a = ac();
  if (!a || !master || save().sfx <= 0) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(lowpass, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, lowpass / 8), t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export type Sfx = 'click' | 'select' | 'move' | 'laser' | 'cannon' | 'rail' | 'claw' | 'mortar' | 'hit' | 'boom' | 'heal' | 'stun' | 'alert' | 'win' | 'lose' | 'error' | 'step' | 'talk';

export function sfx(name: Sfx): void {
  switch (name) {
    case 'click':
      tone('square', 880, 660, 0.06, 0.12);
      break;
    case 'select':
      tone('triangle', 520, 780, 0.09, 0.2);
      break;
    case 'move':
      tone('sine', 300, 420, 0.1, 0.15);
      break;
    case 'step':
      noise(0.07, 0.12, 500);
      break;
    case 'laser':
      tone('sawtooth', 1400, 260, 0.16, 0.16);
      tone('square', 900, 180, 0.12, 0.08, 0.03);
      break;
    case 'rail':
      tone('sawtooth', 2400, 120, 0.3, 0.2);
      noise(0.25, 0.2, 5000);
      break;
    case 'cannon':
      noise(0.35, 0.5, 1400);
      tone('sine', 160, 40, 0.3, 0.4);
      break;
    case 'mortar':
      tone('sine', 500, 1100, 0.35, 0.12);
      noise(0.4, 0.5, 900, 0.4);
      tone('sine', 120, 35, 0.35, 0.4, 0.4);
      break;
    case 'claw':
      noise(0.12, 0.35, 3000);
      tone('square', 300, 90, 0.1, 0.15);
      break;
    case 'hit':
      noise(0.1, 0.3, 2200);
      break;
    case 'boom':
      noise(0.6, 0.6, 1800);
      tone('sine', 110, 28, 0.55, 0.5);
      break;
    case 'heal':
      tone('sine', 520, 780, 0.14, 0.2);
      tone('sine', 780, 1040, 0.18, 0.2, 0.1);
      break;
    case 'stun':
      tone('sawtooth', 220, 1800, 0.08, 0.14);
      tone('sawtooth', 1800, 200, 0.2, 0.14, 0.08);
      break;
    case 'alert':
      tone('square', 660, 660, 0.12, 0.14);
      tone('square', 880, 880, 0.16, 0.14, 0.16);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.25, 0.22, i * 0.13));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.3, 0.2, i * 0.18));
      break;
    case 'error':
      tone('square', 180, 140, 0.14, 0.14);
      break;
    case 'talk':
      tone('sine', 640, 600, 0.03, 0.05);
      break;
  }
}

// ───────── 音樂 ─────────
// 用 <audio> 串流播放（每首 2 MB 多，不放進開機載入）；換曲時舊的淡出、新的淡入

export type Track = 'title' | 'battle' | 'boss' | 'ending';

let current: { name: Track; el: HTMLAudioElement } | null = null;
let wanted: Track | null = null;

function fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void): void {
  const from = el.volume;
  const t0 = performance.now();
  const step = (): void => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  step();
}

/** 播放某一首（已經在播就不動）；null = 停止。音樂關掉時只記住想播哪首 */
export function music(name: Track | null): void {
  wanted = name;
  if (typeof Audio === 'undefined') return;
  const vol = save().music;
  if (current && (current.name !== name || vol <= 0)) {
    const old = current.el;
    current = null;
    fade(old, 0, 500, () => old.pause());
  }
  if (!name || vol <= 0 || current) return;
  const el = new Audio(`assets/starfall/music/${name}.mp3`);
  el.loop = true;
  el.volume = 0;
  current = { name, el };
  // 還沒有使用者操作時瀏覽器會拒絕播放：下一次點擊（unlockAudio）再試
  el.play().then(
    () => fade(el, vol * 0.6, 900),
    () => {
      if (current?.el === el) current = null;
    },
  );
}

/** 設定改了音量、或第一次點擊之後，重新套用目前想播的曲子 */
export function refreshMusic(): void {
  if (current && save().music > 0) current.el.volume = save().music * 0.6;
  else music(wanted);
}
