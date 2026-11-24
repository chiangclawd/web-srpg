// 手把：把按鈕翻成鍵盤事件送出去。鍵盤能做的事（選單的焦點移動、戰場的游標、快捷鍵）手把就都能做，
// 以後鍵盤多了什麼操作，只要在下面的對照表補一行。
// 用的是瀏覽器的標準配置（Xbox / PlayStation / Switch Pro 手把接上去都是這個順序）。
import type Phaser from 'phaser';
import { isTouchDevice } from './config';

interface KeyDef {
  key: string;
  code: string;
  keyCode: number;
}
const K = (key: string, code: string, keyCode: number): KeyDef => ({ key, code, keyCode });
const UP = K('ArrowUp', 'ArrowUp', 38);
const DOWN = K('ArrowDown', 'ArrowDown', 40);
const LEFT = K('ArrowLeft', 'ArrowLeft', 37);
const RIGHT = K('ArrowRight', 'ArrowRight', 39);
const ZOOM_IN = K('+', 'Equal', 187);
const ZOOM_OUT = K('-', 'Minus', 189);

/** 按鈕編號 → 鍵盤的哪個鍵。hold：按住會連發（方向） */
const BUTTONS: Record<number, { k: KeyDef; hold?: boolean }> = {
  0: { k: K('Enter', 'Enter', 13) }, // A / ✕：選取、確定
  1: { k: K('Escape', 'Escape', 27) }, // B / ○：取消、選單
  2: { k: K('a', 'KeyA', 65) }, // X / □：攻擊
  3: { k: K('w', 'KeyW', 87) }, // Y / △：待機
  4: { k: K('1', 'Digit1', 49) }, // LB：技能一
  5: { k: K('2', 'Digit2', 50) }, // RB：技能二
  6: { k: K('z', 'KeyZ', 90) }, // LT：退回
  7: { k: K('o', 'KeyO', 79) }, // RT：警戒
  8: { k: K('Tab', 'Tab', 9) }, // Back / Select：下一台
  9: { k: K('e', 'KeyE', 69) }, // Start：結束回合
  12: { k: UP, hold: true },
  13: { k: DOWN, hold: true },
  14: { k: LEFT, hold: true },
  15: { k: RIGHT, hold: true },
};

/** 鍵盤的按鍵提示（按鈕角落的小字）換成手把上的哪一顆 */
const PAD_LABEL: Record<string, string> = { Enter: 'A', Esc: 'B', A: 'X', W: 'Y', '1': 'LB', '2': 'RB', Z: 'LT', O: 'RT', E: 'START', Tab: 'BACK' };

export type HintMode = 'none' | 'keys' | 'pad';

const STICK = 0.55;
const FIRST_REPEAT = 320;
const NEXT_REPEAT = 110;

/** 現在按著的東西（按鈕編號，或搖桿的方向）→ 下一次連發的時間 */
const held = new Map<string, number>();
let lastPad = false;
const listeners = new Set<() => void>();

/** 按鍵提示現在要顯示哪一種：最近用的是手把就顯示手把的；不然有實體鍵盤的裝置顯示鍵盤的；觸控裝置不顯示 */
export function hintMode(): HintMode {
  return lastPad ? 'pad' : isTouchDevice() ? 'none' : 'keys';
}

/** 按鈕角落的提示字：手把模式換成手把上的按鈕名稱，沒有對應的就不顯示 */
export function hintLabel(key: string): string | null {
  const mode = hintMode();
  if (mode === 'none') return null;
  return mode === 'pad' ? (PAD_LABEL[key] ?? null) : key;
}

/** 提示要換一種了（從鍵盤換成手把，或換回來）：畫面上的提示字要重畫 */
export function onHintMode(cb: () => void): void {
  listeners.add(cb);
}

function setPad(on: boolean): void {
  if (lastPad === on) return;
  lastPad = on;
  for (const cb of [...listeners]) cb();
}

function send(type: 'keydown' | 'keyup', k: KeyDef, repeat = false): void {
  const ev = new KeyboardEvent(type, { key: k.key, code: k.code, bubbles: true, cancelable: true, repeat });
  // Phaser 用 keyCode 認鍵（keydown-ENTER 這類事件），自己做的事件預設是 0，要補上
  Object.defineProperty(ev, 'keyCode', { get: () => k.keyCode });
  Object.defineProperty(ev, 'which', { get: () => k.keyCode });
  window.dispatchEvent(ev);
}

function track(id: string, down: boolean, k: KeyDef, hold: boolean, now: number): void {
  const next = held.get(id);
  if (down && next === undefined) {
    held.set(id, now + FIRST_REPEAT);
    setPad(true);
    send('keydown', k);
  } else if (down && hold && next !== undefined && now >= next) {
    held.set(id, now + NEXT_REPEAT);
    send('keydown', k, true);
  } else if (!down && next !== undefined) {
    held.delete(id);
    send('keyup', k);
  }
}

function poll(now: number): void {
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  // 接了好幾支：用第一支標準配置的；都不是標準配置就用第一支按鈕夠多的
  const usable = [...pads].filter((p): p is Gamepad => !!p && p.connected && p.buttons.length >= 10);
  const pad = usable.find((p) => p.mapping === 'standard') ?? usable[0];
  if (!pad) {
    for (const id of [...held.keys()]) held.delete(id);
    return;
  }
  for (const [i, b] of Object.entries(BUTTONS)) {
    const btn = pad.buttons[Number(i)];
    if (btn) track(`b${i}`, btn.pressed || btn.value > 0.5, b.k, !!b.hold, now);
  }
  // 左搖桿 = 方向鍵（只算比較偏的那一軸，斜推不會一次走兩格）
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  const horiz = Math.abs(x) >= Math.abs(y);
  track('ls-left', horiz && x < -STICK, LEFT, true, now);
  track('ls-right', horiz && x > STICK, RIGHT, true, now);
  track('ls-up', !horiz && y < -STICK, UP, true, now);
  track('ls-down', !horiz && y > STICK, DOWN, true, now);
  // 右搖桿上下 = 縮放
  const zy = pad.axes[3] ?? 0;
  track('rs-in', zy < -STICK, ZOOM_IN, true, now);
  track('rs-out', zy > STICK, ZOOM_OUT, true, now);
}

/** 開遊戲時呼叫一次 */
export function initGamepad(game: Phaser.Game): void {
  if (typeof navigator === 'undefined') return;
  game.events.on('step', (time: number) => poll(time));
  // 真的按了鍵盤或動了滑鼠 / 觸控：提示換回鍵盤的（自己送出去的事件 isTrusted 是 false，不算）
  window.addEventListener('keydown', (ev) => ev.isTrusted && setPad(false), true);
  window.addEventListener('pointerdown', (ev) => ev.isTrusted && setPad(false), true);
}
