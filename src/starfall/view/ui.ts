// 介面元件：科幻風的面板、按鈕、滑桿（全部用向量畫，不需要圖檔），以及鍵盤的焦點移動
import Phaser from 'phaser';
import { COL, TEX, addText, fitText } from '../config';
import { sfx } from '../audio';
import { hintLabel, hintMode } from '../gamepad';

export interface PanelOpts {
  fill?: number;
  alpha?: number;
  line?: number;
  /** 切角大小 */
  cut?: number;
}

/** 切角面板：深色半透明底 + 細邊框 + 角落亮線。(x, y) 是左上角 */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: PanelOpts = {}): void {
  const c = o.cut ?? 12;
  const pts = [x + c, y, x + w, y, x + w, y + h - c, x + w - c, y + h, x, y + h, x, y + c];
  g.fillStyle(o.fill ?? COL.panel, o.alpha ?? 0.9);
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.5, o.line ?? COL.lineDim, 1);
  g.strokePath();
  // 左上、右下的亮角
  g.lineStyle(2.5, o.line ?? COL.line, 1);
  g.beginPath();
  g.moveTo(x, y + c + 14);
  g.lineTo(x, y + c);
  g.lineTo(x + c, y);
  g.lineTo(x + c + 22, y);
  g.strokePath();
  g.beginPath();
  g.moveTo(x + w, y + h - c - 14);
  g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h);
  g.lineTo(x + w - c - 22, y + h);
  g.strokePath();
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: PanelOpts = {}): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, o);
  return g;
}

// ───────── 鍵盤焦點 ─────────

/** 鍵盤焦點可以停的東西：按鈕、滑桿、場景自己做的點擊區 */
export interface NavItem {
  /** 還在畫面上、可以操作 */
  navActive(): boolean;
  /** 中心的世界座標 */
  navPos(): { x: number; y: number };
  setFocus(on: boolean): void;
  click(): void;
  /** 左右鍵調整數值（滑桿）。有這個的話，左右鍵不會把焦點移走 */
  adjust?(dir: number): void;
  /** 是不是放在這個容器裡（開著對話框時，焦點只在對話框裡移動） */
  within(c: Phaser.GameObjects.Container): boolean;
}

const NAV = new WeakMap<Phaser.Scene, Set<NavItem>>();

export function registerNav(scene: Phaser.Scene, item: NavItem): void {
  let set = NAV.get(scene);
  if (!set) NAV.set(scene, (set = new Set()));
  set.add(item);
}

export function unregisterNav(scene: Phaser.Scene, item: NavItem): void {
  NAV.get(scene)?.delete(item);
}

/** 自己和外層的容器都看得到 */
function shown(o: Phaser.GameObjects.GameObject & { visible: boolean; parentContainer: Phaser.GameObjects.Container | null }): boolean {
  if (!o.active || !o.visible) return false;
  for (let p = o.parentContainer; p; p = p.parentContainer) if (!p.visible) return false;
  return true;
}

function inside(o: { parentContainer: Phaser.GameObjects.Container | null }, c: Phaser.GameObjects.Container): boolean {
  for (let p = o.parentContainer; p; p = p.parentContainer) if (p === c) return true;
  return false;
}

/**
 * 已經有人處理過的按鍵。同一次按鍵會依序送到每個開著的場景（底下的先收到）：
 * 戰場按 Esc 開了選單，選單緊接著收到同一個 Esc 就會把自己關掉。處理了就登記在這裡，後面的場景看到就跳過。
 */
export const keyUsed = new WeakSet<KeyboardEvent>();

/** 按鍵提示（按鈕角落的小字）：有實體鍵盤的裝置顯示鍵盤的，用手把的時候顯示手把的，純觸控不顯示 */
export const showKeyHints = (): boolean => hintMode() !== 'none';

export interface KeyNavOpts {
  /** 只在這個容器裡移動（開著對話框時）；回傳 null 就是整個場景 */
  scope?: () => Phaser.GameObjects.Container | null;
  /** 現在要不要處理按鍵（有別的畫面蓋在上面時不要） */
  enabled?: () => boolean;
  /** Esc / Backspace */
  onBack?: () => void;
  /** 還沒有焦點時，第一次按鍵先停在哪一個 */
  first?: () => NavItem | undefined | null;
}

/**
 * 用方向鍵在按鈕之間移動焦點，Enter / 空白鍵按下去，Esc 返回。
 * 往哪個方向就找那個方向上最近的一顆；滑鼠或觸控一點，焦點框就收起來。
 */
export class KeyNav {
  private cur: NavItem | null = null;
  private last = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly o: KeyNavOpts = {},
  ) {
    scene.input.keyboard?.on('keydown', this.onKey, this);
    scene.input.on('pointerdown', () => this.blur());
  }

  blur(): void {
    this.cur?.setFocus(false);
    this.cur = null;
  }

  private items(): NavItem[] {
    const scope = this.o.scope?.() ?? null;
    return [...(NAV.get(this.scene) ?? [])].filter((i) => i.navActive() && (!scope || i.within(scope)));
  }

  private focus(item: NavItem): void {
    if (this.cur !== item) this.cur?.setFocus(false);
    this.cur = item;
    this.last = item.navPos();
    item.setFocus(true);
  }

  /** 目前的焦點；畫面重畫過（按鈕被換掉）的話，改停在原本位置上的那一顆 */
  private current(): NavItem | null {
    const list = this.items();
    if (this.cur && list.includes(this.cur)) return this.cur;
    if (!this.cur) return null;
    this.cur = null;
    let best: NavItem | null = null;
    let bd = 48;
    for (const i of list) {
      const p = i.navPos();
      const d = Math.hypot(p.x - this.last.x, p.y - this.last.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best) this.focus(best);
    return best;
  }

  private first(): NavItem | null {
    const list = this.items();
    const want = this.o.first?.();
    if (want && list.includes(want)) return want;
    // 沒指定：最上面、再來最左邊的那一顆
    return list.sort((a, b) => a.navPos().y - b.navPos().y || a.navPos().x - b.navPos().x)[0] ?? null;
  }

  private move(dx: number, dy: number): void {
    const cur = this.current();
    if (!cur) {
      const f = this.first();
      if (f) this.focus(f);
      return;
    }
    const from = cur.navPos();
    let best: NavItem | null = null;
    let score = Infinity;
    for (const i of this.items()) {
      if (i === cur) continue;
      const p = i.navPos();
      const along = (p.x - from.x) * dx + (p.y - from.y) * dy;
      if (along <= 4) continue;
      const across = Math.abs((p.x - from.x) * dy) + Math.abs((p.y - from.y) * dx);
      const s = along + across * 2.2;
      if (s < score) {
        score = s;
        best = i;
      }
    }
    if (best) {
      sfx('select');
      this.focus(best);
    }
  }

  private onKey(ev: KeyboardEvent): void {
    if (keyUsed.has(ev) || (this.o.enabled && !this.o.enabled())) return;
    if (ev.key.startsWith('Arrow') || ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape' || ev.key === 'Backspace') keyUsed.add(ev);
    const dir =({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number] | undefined>)[ev.key];
    if (dir) {
      ev.preventDefault();
      const cur = this.current();
      if (cur?.adjust && dir[0]) cur.adjust(dir[0]);
      else this.move(dir[0], dir[1]);
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      if (ev.repeat) return;
      const cur = this.current() ?? this.first();
      if (!cur) return;
      this.focus(cur);
      cur.click();
      return;
    }
    if (ev.key === 'Escape' || ev.key === 'Backspace') {
      if (ev.repeat) return;
      this.o.onBack?.();
    }
  }
}

// ───────── 按鈕 ─────────

export interface ButtonOpts {
  icon?: string;
  /** 主色（邊框與文字） */
  color?: number;
  size?: number;
  disabled?: boolean;
  /** 右側的小字（冷卻回合數之類） */
  note?: string;
  primary?: boolean;
  /** 快捷鍵的提示（左上角的小字；觸控裝置不顯示） */
  key?: string;
}

/** 按鈕：(x, y) 是中心。按下又放開在同一顆上才算點擊 */
export class Button extends Phaser.GameObjects.Container implements NavItem {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private hit: Phaser.GameObjects.Rectangle;
  private enabled = true;
  private focused = false;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bw: number,
    private readonly bh: number,
    text: string,
    private readonly onClick: () => void,
    private readonly o: ButtonOpts = {},
  ) {
    super(scene, x, y);
    const w = bw;
    const h = bh;
    this.color = o.color ?? COL.line;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    const hasIcon = !!o.icon;
    if (o.icon) {
      const ic = scene.add
        .image(-w / 2 + h / 2 + 2, 0, o.icon)
        .setScale((h * 0.56) / 64 / TEX)
        .setTint(this.color);
      this.add(ic);
    }
    this.label = addText(scene, hasIcon ? h * 0.34 : 0, 0, text, { size: o.size ?? 18, strokeW: 0, raw: true }).setOrigin(0.5);
    fitText(this.label, w - (hasIcon ? h + 8 : 20) - (o.note ? 34 : 0));
    this.add(this.label);
    if (o.note) this.add(addText(scene, w / 2 - 10, 0, o.note, { size: 13, color: COL.dim, strokeW: 0, raw: true }).setOrigin(1, 0.5));
    const hint = o.key ? hintLabel(o.key) : null;
    if (hint) this.add(addText(scene, -w / 2 + 6, -h / 2 + 3, hint, { size: 11, color: COL.dim, strokeW: 0, raw: true }));
    this.hit = scene.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    this.add(this.hit);
    let down = false;
    this.hit.on('pointerdown', () => {
      down = true;
      this.draw(true);
    });
    this.hit.on('pointerout', () => {
      down = false;
      this.draw(false);
    });
    this.hit.on('pointerup', () => {
      if (!down) return;
      down = false;
      this.draw(false);
      this.click();
    });
    this.setEnabled(!o.disabled);
    scene.add.existing(this);
    registerNav(scene, this);
    this.once('destroy', () => unregisterNav(scene, this));
  }

  /** 按下去（滑鼠、觸控、鍵盤都走這裡）：不能按的時候只發出錯誤音 */
  click(): void {
    if (!this.enabled) {
      sfx('error');
      return;
    }
    sfx('click');
    this.onClick();
  }

  private draw(pressed: boolean): void {
    const w = this.bw;
    const h = this.bh;
    const g = this.bg;
    g.clear();
    const col = this.enabled ? this.color : 0x4a5a6c;
    drawPanel(g, -w / 2, -h / 2, w, h, { fill: pressed ? COL.panelHi : this.o.primary ? 0x123a52 : COL.panel, alpha: 0.94, line: col, cut: Math.min(10, h / 4) });
    if (this.focused) g.lineStyle(2.5, 0xffffff, 0.95).strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
    this.label.setColor(this.enabled ? '#e8f4ff' : '#6a7c90');
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.draw(false);
    return this;
  }

  setLabel(s: string): this {
    this.label.setText(s);
    fitText(this.label, this.bw - 20);
    return this;
  }

  navActive(): boolean {
    return this.enabled && shown(this);
  }

  navPos(): { x: number; y: number } {
    const m = this.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  setFocus(on: boolean): void {
    if (this.focused === on || !this.active) return;
    this.focused = on;
    this.draw(false);
  }

  within(c: Phaser.GameObjects.Container): boolean {
    return inside(this, c);
  }
}

// ───────── 滑桿 ─────────

/** 橫向滑桿（0..1）：(x, y) 是軌道的左端。拖曳、點軌道，或鍵盤左右鍵一次一成 */
export class Slider extends Phaser.GameObjects.Container implements NavItem {
  private g: Phaser.GameObjects.Graphics;
  private pct: Phaser.GameObjects.Text;
  private focused = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly sw: number,
    private value: number,
    /** done：放開了（拖曳中會一直呼叫，放開時才存檔） */
    private readonly onChange: (v: number, done: boolean) => void,
  ) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.pct = addText(scene, sw + 16, 0, '', { size: 17, strokeW: 0, raw: true }).setOrigin(0, 0.5);
    const pad = 14;
    const hit = scene.add.rectangle(-pad, -22, sw + pad * 2, 44, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    this.add([this.g, this.pct, hit]);
    let down = false;
    const at = (lx: number, done: boolean): void => this.set((lx - pad) / sw, done);
    hit.on('pointerdown', (_p: Phaser.Input.Pointer, lx: number) => {
      down = true;
      at(lx, false);
    });
    hit.on('pointermove', (p: Phaser.Input.Pointer, lx: number) => {
      if (down && p.isDown) at(lx, false);
    });
    const end = (): void => {
      if (!down) return;
      down = false;
      this.onChange(this.value, true);
    };
    hit.on('pointerup', end);
    hit.on('pointerout', end);
    this.draw();
    scene.add.existing(this);
    registerNav(scene, this);
    this.once('destroy', () => unregisterNav(scene, this));
  }

  private set(v: number, done: boolean): void {
    // 一格 5%
    this.value = Math.round(Phaser.Math.Clamp(v, 0, 1) * 20) / 20;
    this.draw();
    this.onChange(this.value, done);
  }

  private draw(): void {
    const g = this.g;
    const w = this.sw;
    g.clear();
    g.fillStyle(0x06101c, 1).fillRect(0, -5, w, 10);
    g.lineStyle(1.5, COL.lineDim, 1).strokeRect(0, -5, w, 10);
    g.fillStyle(COL.line, 1).fillRect(1, -4, (w - 2) * this.value, 8);
    const kx = w * this.value;
    g.fillStyle(0xe8f4ff, 1).fillRect(kx - 6, -13, 12, 26);
    g.lineStyle(1.5, COL.lineDim, 1).strokeRect(kx - 6, -13, 12, 26);
    if (this.focused) g.lineStyle(2.5, 0xffffff, 0.95).strokeRect(-12, -20, w + 24, 40);
    this.pct.setText(`${Math.round(this.value * 100)}%`);
  }

  navActive(): boolean {
    return shown(this);
  }

  navPos(): { x: number; y: number } {
    const m = this.getWorldTransformMatrix();
    return { x: m.tx + (this.sw / 2) * m.scaleX, y: m.ty };
  }

  setFocus(on: boolean): void {
    if (this.focused === on || !this.active) return;
    this.focused = on;
    this.draw();
  }

  click(): void {
    // 滑桿沒有「按下去」：用左右鍵調
  }

  adjust(dir: number): void {
    this.set(this.value + dir * 0.1, true);
  }

  within(c: Phaser.GameObjects.Container): boolean {
    return inside(this, c);
  }
}
