// 音效：戰鬥的聲音是離線合成好的檔案（scripts/art/sfx/starfall_sfx.py），介面的提示音用 Web Audio 即時合成。
// 音檔還沒載完、或載入失敗時，戰鬥的聲音也退回即時合成的版本，所以不會沒有聲音
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
  loadSamples();
  refreshMusic();
  refreshAmbience();
}

// ───────── 音檔 ─────────

const SAMPLES = ['laser', 'cannon', 'rail', 'claw', 'mortar', 'hit', 'boom', 'step', 'heal', 'stun', 'alert'] as const;
const LOOPS = ['amb_wind', 'amb_hum'] as const;
const buffers = new Map<string, AudioBuffer>();
let loading = false;

/** 第一次有使用者操作之後才抓音檔（總共不到 1 MB），不擋開機 */
function loadSamples(): void {
  const a = ac();
  if (!a || loading) return;
  loading = true;
  const files = [...SAMPLES.map((n) => [n, `${n}.m4a`]), ...LOOPS.map((n) => [n, `${n}.wav`])];
  for (const [name, file] of files) {
    fetch(`assets/starfall/sfx/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => a.decodeAudioData(data))
      .then((buf) => {
        buffers.set(name, buf);
        if (name === wantedAmb) refreshAmbience();
      })
      .catch(() => undefined); // 抓不到就繼續用即時合成的
  }
}

/** 播音檔版的音效；還沒有這個檔就回傳 false */
function sample(name: string): boolean {
  const buf = buffers.get(name);
  const a = ac();
  if (!buf || !a || !master) return false;
  if (save().sfx <= 0) return true;
  const src = a.createBufferSource();
  src.buffer = buf;
  // 同一種聲音連續出現時音高稍微不一樣，才不會像機關槍
  src.playbackRate.value = 0.94 + Math.random() * 0.12;
  src.connect(master);
  src.start();
  return true;
}

// ───────── 環境音 ─────────

export type Ambience = 'amb_wind' | 'amb_hum';
let wantedAmb: Ambience | null = null;
let amb: { name: Ambience; src: AudioBufferSourceNode; gain: GainNode } | null = null;

/** 戰場的環境音（冰原的風、船艙的嗡鳴），無縫循環；null = 停止。音量跟著音效音量走 */
export function ambience(name: Ambience | null): void {
  wantedAmb = name;
  refreshAmbience();
}

function refreshAmbience(): void {
  const a = ctx;
  const vol = save().sfx * 0.5;
  if (amb && (amb.name !== wantedAmb || vol <= 0)) {
    const old = amb;
    amb = null;
    if (a) old.gain.gain.linearRampToValueAtTime(0, a.currentTime + 0.5);
    old.src.stop(a ? a.currentTime + 0.55 : 0);
  }
  if (amb) {
    amb.gain.gain.value = vol;
    return;
  }
  const buf = wantedAmb ? buffers.get(wantedAmb) : undefined;
  if (!a || !wantedAmb || !buf || vol <= 0) return;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0, a.currentTime);
  gain.gain.linearRampToValueAtTime(vol, a.currentTime + 1.2);
  src.connect(gain).connect(a.destination);
  src.start();
  amb = { name: wantedAmb, src, gain };
}

/** 設定頁改了音效音量：環境音也跟著調 */
export function refreshSfxVolume(): void {
  refreshAmbience();
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
  if (sample(name)) return;
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

/** battle 是第一章的戰鬥曲，ch2 / ch3 / ch4 是其餘各章的，rollcall 是主線最後一關的 */
export type Track = 'title' | 'battle' | 'ch2' | 'ch3' | 'ch4' | 'rollcall' | 'boss' | 'ending';

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
  // 回到標題、任務列表、機庫（都播標題曲）就把戰場的環境音收掉
  if (name === 'title' || name === null) ambience(null);
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

// 切到別的分頁或別的 App 時音樂停下來，回來再接著播
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (ctx) void (document.hidden ? ctx.suspend() : ctx.resume());
    if (!current) return;
    if (document.hidden) current.el.pause();
    else if (save().music > 0) void current.el.play().catch(() => undefined);
  });
}
