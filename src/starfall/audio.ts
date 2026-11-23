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
