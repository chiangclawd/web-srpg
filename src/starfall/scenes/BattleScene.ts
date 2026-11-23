// 戰鬥場景：畫等角地圖和單位、處理點擊操作、把模擬回傳的事件一個一個演出來。
// 介面（按鈕、資訊卡、預估面板）在 HudScene，疊在這個場景上面。
import Phaser from 'phaser';
import { RS, TEX, VIEW_H, addText, uiZoom, viewW } from '../config';
import { sfx } from '../audio';
import { L, T } from '../i18n';
import { persist, save } from '../save';
import { Battle } from '../sim/Battle';
import type { Reach } from '../sim/Battle';
import { aiTakeTurn } from '../sim/ai';
import { TERRAIN } from '../sim/terrain';
import { DIR_VEC } from '../sim/types';
import type { BattleEvent, Dir, Forecast, MissionDef, Pos, SkillDef, Unit } from '../sim/types';
import { MISSIONS, missionById } from '../data/missions';
import { STORY } from '../data/story';
import { UNITS } from '../data/units';
import { EH, TH, TOP_PAD, TW, isoX, isoY, tileDepth } from '../view/iso';
import { TILE_TEX_H, TILE_VARIANTS, tileKey } from '../view/textures';
import { UnitView } from '../view/UnitView';
import type { HudScene } from './HudScene';

type Mode = 'idle' | 'unit' | 'target' | 'busy';
type MarkKind = 'move' | 'target' | 'aim' | 'select' | 'threat' | 'zone' | 'line';

/** 準備中的動作：普通攻擊或某個技能 */
export type Pending = { kind: 'attack' } | { kind: 'skill'; skill: SkillDef };

/** 預估面板要顯示的內容 */
export interface AimInfo {
  title: string;
  target: Unit | null;
  forecast: Forecast | null;
  /** 修復量 / 癱瘓 / 貫穿打到幾個之類的補充說明 */
  note: string;
}

const FX_DEPTH = 100000;
const MARK_COLOR: Record<MarkKind, [number, number]> = {
  move: [0x1f6dff, 0.5],
  target: [0xff3a2a, 0.55],
  aim: [0xffe45a, 0.9],
  select: [0xffffff, 0.95],
  threat: [0xff5a4a, 0.3],
  zone: [0x6dff9a, 0.9],
  line: [0xffa53a, 0.55],
};

export class BattleScene extends Phaser.Scene {
  battle!: Battle;
  mission!: MissionDef;
  hud!: HudScene;
  mode: Mode = 'busy';
  sel: Unit | null = null;
  pending: Pending | null = null;
  aim: Pos | null = null;

  private views = new Map<number, UnitView>();
  private marks: Record<MarkKind, Phaser.GameObjects.Image[]> = { move: [], target: [], aim: [], select: [], threat: [], zone: [], line: [] };
  private range: Map<number, Reach> | null = null;
  private bg!: Phaser.GameObjects.Image;
  private zoom = 1;
  private minZoom = 0.6;
  private center = new Phaser.Math.Vector2();
  private bounds = new Phaser.Geom.Rectangle();
  private drag: { x: number; y: number; moved: boolean; pinch: number } | null = null;
  private endArmed = false;

  constructor() {
    super('SfBattle');
  }

  init(data: { missionId: string }): void {
    this.mission = missionById(data.missionId);
    this.battle = new Battle(this.mission, UNITS);
    this.views = new Map();
    this.marks = { move: [], target: [], aim: [], select: [], threat: [], zone: [], line: [] };
    this.mode = 'busy';
    this.sel = null;
    this.pending = null;
    this.aim = null;
    this.range = null;
    this.drag = null;
    this.endArmed = false;
  }

  // ───────── 建立 ─────────

  create(): void {
    const b = this.battle;
    this.bg = this.add
      .image(0, 0, this.mission.theme === 'ice' ? 'bg_ice' : 'bg_hull')
      .setScrollFactor(0)
      .setDepth(-1000);
    // 地塊：每格一張「柱狀」圖（頂面 + 往下延伸的側面），靠前的蓋住靠後的
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const id = b.terrainAt(x, y);
        const sx = isoX(x, y);
        const sy = isoY(x, y, b.heightAt(x, y));
        if (id !== 'chasm') {
          this.add
            .image(sx, sy, tileKey(id, (x * 7 + y * 13) % TILE_VARIANTS))
            .setOrigin(0.5, (TOP_PAD + TH / 2) / TILE_TEX_H)
            .setScale(1 / TEX)
            .setDepth(tileDepth(x, y));
        }
        minX = Math.min(minX, sx - TW / 2);
        maxX = Math.max(maxX, sx + TW / 2);
        minY = Math.min(minY, sy - TH / 2 - 100);
        maxY = Math.max(maxY, sy + TH / 2 + 40);
      }
    }
    this.bounds.setTo(minX, minY, maxX - minX, maxY - minY);
    if (this.mission.win.type === 'reach') for (const p of this.mission.win.zone) this.mark('zone', p.x, p.y);
    for (const u of b.units) this.addView(u);

    // 鏡頭：整張地圖放得進畫面（留位置給上下的介面），最多放大到 1.5 倍
    // 右邊一整排是行動按鈕：地圖放在它左邊的空間裡
    const w = viewW(this);
    const side = 236 * Math.min(uiZoom(), 1.4);
    const fit = Math.min((w - side - 60) / this.bounds.width, (VIEW_H - 130) / this.bounds.height);
    this.minZoom = Phaser.Math.Clamp(fit * 0.9, 0.45, 1);
    this.zoom = Phaser.Math.Clamp(fit, this.minZoom, 1.25);
    this.center.set(this.bounds.centerX + side / 2 / this.zoom, this.bounds.centerY + 10);
    this.applyCamera();

    this.input.addPointer(1);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1)));
    this.scale.on('resize', this.applyCamera, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyCamera, this));

    this.scene.launch('SfHud', { battle: this });
  }

  /** HudScene 建好之後呼叫：開場對話 → 第一回合 */
  async hudReady(hud: HudScene): Promise<void> {
    this.hud = hud;
    if (this.mission.intro) await this.say(this.mission.intro);
    await this.play(this.battle.start());
    this.toIdle();
  }

  private addView(u: Unit): UnitView {
    const v = new UnitView(this, u, (x, y) => this.battle.heightAt(x, y));
    this.views.set(u.uid, v);
    return v;
  }

  view(uid: number): UnitView | undefined {
    return this.views.get(uid);
  }

  override update(time: number): void {
    for (const v of this.views.values()) v.update(time);
    // 背景固定在畫面上（不跟著縮放），只跟著鏡頭輕微平移，有一點遠近感
    const cam = this.cameras.main;
    const cover = Math.max(cam.width / this.bg.width, cam.height / this.bg.height) * 1.08;
    this.bg.setScale(cover / cam.zoom);
    this.bg.setPosition(cam.width / 2 - ((this.center.x - this.bounds.centerX) * 0.04 * RS) / cam.zoom, cam.height / 2 - ((this.center.y - this.bounds.centerY) * 0.04 * RS) / cam.zoom);
  }

  // ───────── 鏡頭 ─────────

  private applyCamera(): void {
    const cam = this.cameras.main;
    this.center.x = Phaser.Math.Clamp(this.center.x, this.bounds.left, this.bounds.right + 200);
    this.center.y = Phaser.Math.Clamp(this.center.y, this.bounds.top, this.bounds.bottom);
    cam.setZoom(RS * this.zoom);
    cam.centerOn(this.center.x, this.center.y);
  }

  private setZoom(z: number): void {
    this.zoom = Phaser.Math.Clamp(z, this.minZoom, 1.8);
    this.applyCamera();
  }

  /** 讓某一格進到畫面中間的安全範圍（已經看得到就不動） */
  private focus(x: number, y: number): Promise<void> {
    const cam = this.cameras.main;
    const wx = isoX(x, y);
    const wy = isoY(x, y, this.battle.heightAt(x, y)) - 30;
    const halfW = cam.width / cam.zoom / 2;
    const halfH = cam.height / cam.zoom / 2;
    const dx = wx - this.center.x;
    const dy = wy - this.center.y;
    if (Math.abs(dx) < halfW * 0.62 && dy > -halfH * 0.55 && dy < halfH * 0.4) return Promise.resolve();
    return new Promise((ok) => {
      this.tweens.add({
        targets: this.center,
        x: wx,
        y: wy,
        duration: this.ms(260),
        ease: 'Sine.easeInOut',
        onUpdate: () => this.applyCamera(),
        onComplete: () => ok(),
      });
    });
  }

  // ───────── 輸入 ─────────

  private onDown(p: Phaser.Input.Pointer): void {
    const two = this.input.pointer1.isDown && this.input.pointer2.isDown;
    this.drag = { x: p.x, y: p.y, moved: two, pinch: two ? Phaser.Math.Distance.Between(this.input.pointer1.x, this.input.pointer1.y, this.input.pointer2.x, this.input.pointer2.y) : 0 };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.drag || !p.isDown) return;
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      // 雙指縮放
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.drag.pinch > 0) this.setZoom((this.zoom * d) / this.drag.pinch);
      this.drag.pinch = d;
      this.drag.moved = true;
      return;
    }
    const dx = p.x - this.drag.x;
    const dy = p.y - this.drag.y;
    if (!this.drag.moved && Math.hypot(dx, dy) < 12 * RS) return;
    this.drag.moved = true;
    const cam = this.cameras.main;
    this.center.x -= dx / cam.zoom;
    this.center.y -= dy / cam.zoom;
    this.drag.x = p.x;
    this.drag.y = p.y;
    this.applyCamera();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved) return;
    if (this.hud?.input.hitTestPointer(p).length) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    this.onTap(wp.x, wp.y);
  }

  /** 畫面座標 → 點到哪一格（先看單位的圖，再看地塊頂面；靠前的優先） */
  private pick(wx: number, wy: number): Pos | null {
    const b = this.battle;
    let best: Pos | null = null;
    let bestDepth = -1;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (!u.alive) continue;
      const dx = Math.abs(wx - v.root.x);
      const dy = v.root.y - wy;
      if (dx < 26 && dy > -8 && dy < v.tall + 4 && v.root.depth > bestDepth) {
        best = { x: u.x, y: u.y };
        bestDepth = v.root.depth;
      }
    }
    if (best) return best;
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const id = b.terrainAt(x, y);
        if (id === 'chasm') continue;
        const cx = isoX(x, y);
        const cy = isoY(x, y, b.heightAt(x, y) + (id === 'wall' ? 2 : 0));
        if (Math.abs(wx - cx) / (TW / 2) + Math.abs(wy - cy) / (TH / 2) <= 1 && tileDepth(x, y) > bestDepth) {
          best = { x, y };
          bestDepth = tileDepth(x, y);
        }
      }
    }
    return best;
  }

  private onTap(wx: number, wy: number): void {
    if (this.mode === 'busy' || this.battle.result) return;
    this.hud.hideTip();
    const b = this.battle;
    const t = this.pick(wx, wy);
    const u = t ? b.unitAt(t.x, t.y) : undefined;
    if (this.mode === 'target') {
      if (t && this.validTargets().some((p) => p.x === t.x && p.y === t.y)) {
        if (this.aim && this.aim.x === t.x && this.aim.y === t.y) void this.confirm();
        else this.aimAt(t);
      } else {
        this.cancelTarget();
      }
      return;
    }
    const s = this.sel;
    if (this.mode === 'unit' && s && s.side === 'player' && b.canAct(s) && t) {
      if (u && u.side !== s.side && b.canHit(s, s, u.x, u.y)) {
        this.beginTarget({ kind: 'attack' });
        this.aimAt(t);
        return;
      }
      if (!u && !s.moved && this.range?.has(b.key(t.x, t.y)) && b.canStop(s, t.x, t.y)) {
        void this.doMove(t);
        return;
      }
    }
    if (u && u !== s) this.select(u);
    else if (!u) this.toIdle();
  }

  // ───────── 範圍標示 ─────────

  private mark(kind: MarkKind, x: number, y: number): void {
    const b = this.battle;
    const [tint, alpha] = MARK_COLOR[kind];
    const tex = kind === 'select' || kind === 'aim' ? 'ov_edge' : kind === 'zone' ? 'ov_zone' : 'ov_fill';
    const h = b.heightAt(x, y) + (b.terrainAt(x, y) === 'wall' ? 2 : 0);
    const im = this.add
      .image(isoX(x, y), isoY(x, y, h), tex)
      .setScale(1 / TEX)
      .setTint(tint)
      .setAlpha(alpha)
      .setDepth(tileDepth(x, y) + (kind === 'select' || kind === 'aim' ? 3 : kind === 'threat' ? 1 : 2));
    if (kind === 'aim' || kind === 'zone') this.tweens.add({ targets: im, alpha: alpha * 0.45, duration: 520, yoyo: true, repeat: -1 });
    this.marks[kind].push(im);
  }

  private clearMarks(...kinds: MarkKind[]): void {
    for (const k of kinds.length ? kinds : (Object.keys(this.marks) as MarkKind[])) {
      if (k === 'zone' && !kinds.length) continue;
      for (const im of this.marks[k]) {
        this.tweens.killTweensOf(im);
        im.destroy();
      }
      this.marks[k] = [];
    }
  }

  // ───────── 操作流程 ─────────

  /** 回到「沒有選任何單位」 */
  toIdle(): void {
    this.sel = null;
    this.pending = null;
    this.aim = null;
    this.range = null;
    this.clearMarks();
    if (this.battle.result) return;
    this.mode = 'idle';
    this.hud.refresh();
  }

  select(u: Unit): void {
    const b = this.battle;
    this.sel = u;
    this.pending = null;
    this.aim = null;
    this.range = null;
    this.clearMarks();
    this.mark('select', u.x, u.y);
    this.mode = 'unit';
    sfx('select');
    if (u.side === 'player' && b.canAct(u)) {
      if (!u.moved) {
        this.range = b.moveRange(u);
        for (const p of b.reachable(u)) if (p.x !== u.x || p.y !== u.y) this.mark('move', p.x, p.y);
      }
      for (const t of b.targets(u)) this.mark('target', t.x, t.y);
    } else if (u.side === 'enemy') {
      // 點敵人：顯示它下回合打得到的範圍
      for (const k of b.threat(u)) {
        const p = b.pos(k);
        this.mark('threat', p.x, p.y);
      }
    }
    this.hud.refresh();
  }

  private async doMove(t: Pos): Promise<void> {
    const u = this.sel;
    if (!u) return;
    this.mode = 'busy';
    this.clearMarks();
    this.hud.refresh();
    await this.play(this.battle.move(u, t.x, t.y));
    this.afterAction(u);
  }

  /** 動作演完：單位還能下指令就繼續選著它，不然取消選取；全部動完自動結束回合 */
  private afterAction(u: Unit): void {
    if (this.battle.result) return;
    if (u.alive && this.battle.canAct(u)) {
      this.select(u);
      return;
    }
    this.toIdle();
    if (!this.battle.alive('player').some((p) => this.battle.canAct(p))) void this.endTurn(true);
  }

  undoMove(): void {
    const u = this.sel;
    if (!u || this.mode !== 'unit' || !this.battle.undoMove(u)) return;
    const v = this.views.get(u.uid);
    v?.place(u.x, u.y);
    v?.setDir(u.dir);
    this.select(u);
  }

  /** 按了「攻擊」或某個技能：進入選目標 */
  beginTarget(p: Pending): void {
    const u = this.sel;
    if (!u || !this.battle.canAct(u)) return;
    this.pending = p;
    this.aim = null;
    this.mode = 'target';
    this.clearMarks('move', 'target', 'aim', 'line');
    const list = this.validTargets();
    for (const t of list) this.mark('target', t.x, t.y);
    if (list.length === 1) this.aimAt(list[0]);
    else this.hud.refresh();
    this.hud.showTip('tip_forecast');
  }

  validTargets(): Pos[] {
    const u = this.sel;
    const p = this.pending;
    if (!u || !p) return [];
    if (p.kind === 'attack') return this.battle.targets(u).map((t) => ({ x: t.x, y: t.y }));
    return this.battle.skillTargets(u, p.skill);
  }

  private aimAt(t: Pos): void {
    this.aim = t;
    this.clearMarks('aim', 'line');
    this.mark('aim', t.x, t.y);
    const u = this.sel;
    const p = this.pending;
    if (u && p?.kind === 'skill' && p.skill.effect.type === 'line') for (const lp of this.battle.lineTiles(u, t, p.skill)) this.mark('line', lp.x, lp.y);
    if (u) this.views.get(u.uid)?.setDir(this.dirFrom(u, t));
    this.hud.refresh();
  }

  private dirFrom(u: Unit, t: Pos): Dir {
    const dx = t.x - u.x;
    const dy = t.y - u.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
    return dy >= 0 ? 1 : 3;
  }

  /** 預估面板的內容（HudScene 顯示） */
  aimInfo(): AimInfo | null {
    const u = this.sel;
    const p = this.pending;
    const a = this.aim;
    if (!u || !p) return null;
    const title = p.kind === 'attack' ? L(u.def.weapon.name) : L(p.skill.name);
    if (!a) return { title, target: null, forecast: null, note: p.kind === 'skill' && p.skill.target === 'dir' ? T('pickDir') : T('pickTarget') };
    const b = this.battle;
    const tgt = b.unitAt(a.x, a.y) ?? null;
    if (p.kind === 'attack') return { title, target: tgt, forecast: tgt ? b.forecast(u, tgt) : null, note: '' };
    const e = p.skill.effect;
    if (e.type === 'heal' && tgt) return { title, target: tgt, forecast: null, note: `${T('heal')} +${Math.min(e.amount, tgt.maxHp - tgt.hp)}` };
    if (e.type === 'stun' && tgt) return { title, target: tgt, forecast: null, note: T('stunned') };
    if (e.type === 'line') {
      const hits = b
        .lineTiles(u, a, p.skill)
        .map((lp) => b.unitAt(lp.x, lp.y))
        .filter((o): o is Unit => !!o && o.side !== u.side);
      const parts = hits.map((o) => {
        const f = b.forecast(u, o, u, p.skill);
        return `${L(o.def.name)} -${f.dmg}${f.kills ? ` (${T('kill')})` : ''}`;
      });
      return { title, target: hits[0] ?? null, forecast: null, note: parts.length ? parts.join('　') : T('noTarget') };
    }
    return { title, target: tgt, forecast: tgt ? b.forecast(u, tgt, u, p.skill) : null, note: '' };
  }

  cancelTarget(): void {
    const u = this.sel;
    if (!u) return this.toIdle();
    this.views.get(u.uid)?.setDir(u.dir);
    this.select(u);
  }

  async confirm(): Promise<void> {
    const u = this.sel;
    const p = this.pending;
    const a = this.aim;
    if (!u || !p || !a || this.mode !== 'target') return;
    const b = this.battle;
    this.mode = 'busy';
    this.clearMarks();
    this.hud.refresh();
    const tgt = b.unitAt(a.x, a.y);
    const ev = p.kind === 'attack' ? (tgt ? b.attack(u, tgt) : []) : b.useSkill(u, p.skill.id, a);
    await this.play(ev);
    this.afterAction(u);
  }

  async doOverwatch(): Promise<void> {
    const u = this.sel;
    if (!u || this.mode !== 'unit') return;
    this.mode = 'busy';
    this.clearMarks();
    await this.play(this.battle.setOverwatch(u));
    this.afterAction(u);
  }

  async doWait(): Promise<void> {
    const u = this.sel;
    if (!u || this.mode !== 'unit') return;
    this.mode = 'busy';
    this.clearMarks();
    await this.play(this.battle.wait(u));
    this.afterAction(u);
  }

  /** 還能行動的我方單位數 */
  readyCount(): number {
    return this.battle.alive('player').filter((u) => this.battle.canAct(u)).length;
  }

  /** 結束回合：還有人沒動的話要按兩次（第一次只是提醒） */
  async endTurn(force = false): Promise<void> {
    if (this.mode === 'busy' || this.battle.result || this.battle.phase !== 'player') return;
    if (!force && this.readyCount() > 0 && !this.endArmed) {
      this.endArmed = true;
      this.hud.toast(T('endTurnConfirm', this.readyCount()));
      this.time.delayedCall(2600, () => (this.endArmed = false));
      return;
    }
    this.endArmed = false;
    const b = this.battle;
    this.toIdle();
    this.mode = 'busy';
    this.hud.refresh();
    await this.play(b.endPlayerPhase());
    for (let ev = b.stepEnemy(aiTakeTurn); ev !== null; ev = b.stepEnemy(aiTakeTurn)) {
      if (ev.length) await this.play(ev);
      this.refreshViews();
    }
    await this.play(b.beginPlayerPhase());
    this.refreshViews();
    if (!b.result) {
      this.toIdle();
      this.turnTips();
    }
  }

  private turnTips(): void {
    if (this.mission.id !== 'm1') {
      if (this.mission.id === 'm2' && this.battle.turn === 1) this.hud.showTip('tip_cover');
      return;
    }
    const tip = ({ 1: 'tip_move', 2: 'tip_flank', 3: 'tip_overwatch', 4: 'tip_cover' } as const)[this.battle.turn as 1 | 2 | 3 | 4];
    if (tip) this.hud.showTip(tip);
  }

  private refreshViews(): void {
    for (const v of this.views.values()) if (v.unit.alive) v.refresh();
  }

  // ───────── 演出 ─────────

  /** 演出時間（毫秒）：快速模式減半 */
  private ms(n: number): number {
    return save().fast ? n * 0.5 : n;
  }

  private wait(n: number): Promise<void> {
    return new Promise((ok) => this.time.delayedCall(this.ms(n), () => ok()));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((ok) => this.tweens.add({ ...cfg, onComplete: () => ok() }));
  }

  private say(id: string): Promise<void> {
    const lines = STORY[id];
    if (!lines?.length) return Promise.resolve();
    return new Promise((ok) => {
      this.hud?.setVisible(false);
      this.scene.launch('SfDialogue', {
        lines,
        onDone: () => {
          this.hud?.setVisible(true);
          ok();
        },
      });
    });
  }

  async play(events: BattleEvent[]): Promise<void> {
    const prev = this.mode;
    this.mode = 'busy';
    for (const e of events) await this.playOne(e);
    if (!this.battle.result) this.mode = prev;
    this.hud?.refresh();
  }

  private async playOne(e: BattleEvent): Promise<void> {
    const b = this.battle;
    switch (e.t) {
      case 'phase': {
        this.refreshViews();
        this.hud.refresh();
        if (e.side === 'player' && e.turn === 1) this.turnTipsSoon();
        await this.hud.banner(e.side);
        break;
      }
      case 'move': {
        const v = this.views.get(e.uid);
        if (v) await this.walk(v, e.path);
        break;
      }
      case 'face':
        this.views.get(e.uid)?.setDir(e.dir);
        break;
      case 'skill': {
        const v = this.views.get(e.uid);
        const def = v?.unit.def.skills.find((s) => s.id === e.skill);
        if (!v || !def) break;
        await this.focus(v.unit.x, v.unit.y);
        this.callout(v, L(def.name), 0xffe45a);
        if (def.effect.type === 'line') {
          const tiles = b.lineTiles(v.unit, e.at, def);
          const last = tiles[tiles.length - 1] ?? e.at;
          v.play('attack');
          await this.wait(260);
          sfx('rail');
          await this.beam(v.muzzle(), new Phaser.Math.Vector2(isoX(last.x, last.y), isoY(last.x, last.y, b.heightAt(last.x, last.y)) - 36), 0xffa53a, 9);
          v.play('idle');
        } else {
          await this.wait(240);
        }
        break;
      }
      case 'attack':
        await this.playAttack(e);
        break;
      case 'heal': {
        const v = this.views.get(e.target);
        if (!v) break;
        sfx('heal');
        const c = v.center();
        for (let i = 0; i < 8; i++) {
          const s = this.add
            .image(c.x + Phaser.Math.Between(-18, 18), c.y + Phaser.Math.Between(-10, 24), 'glow')
            .setTint(0x6dff9a)
            .setScale(0.22)
            .setDepth(FX_DEPTH);
          this.tweens.add({ targets: s, y: s.y - 46, alpha: 0, duration: this.ms(620), delay: i * 30, onComplete: () => s.destroy() });
        }
        this.number(v, `+${e.amount}`, '#6dff9a');
        v.refresh(e.hp);
        await this.wait(420);
        break;
      }
      case 'stun': {
        const v = this.views.get(e.target);
        if (!v) break;
        sfx('stun');
        const from = this.views.get(e.uid);
        if (from) await this.beam(from.center(), v.center(), 0xffe45a, 3);
        this.number(v, T('stunned'), '#ffe45a');
        v.flash();
        v.refresh(v.hp);
        await this.wait(360);
        break;
      }
      case 'push': {
        const v = this.views.get(e.target);
        if (!v) break;
        const tx = isoX(e.to.x, e.to.y);
        const ty = isoY(e.to.x, e.to.y, b.heightAt(e.to.x, e.to.y));
        v.root.setDepth(Math.max(v.root.depth, tileDepth(e.to.x, e.to.y) + 5));
        await this.tween({ targets: v.root, x: tx, y: ty, duration: this.ms(170), ease: 'Quad.easeOut' });
        if (e.fell) {
          sfx('lose');
          await this.tween({ targets: v.root, y: ty + 220, alpha: 0, duration: this.ms(520), ease: 'Quad.easeIn' });
        } else {
          v.place(e.to.x, e.to.y);
        }
        break;
      }
      case 'death': {
        const v = this.views.get(e.uid);
        if (!v) break;
        this.views.delete(e.uid);
        if (v.root.alpha > 0.05) await this.explode(v);
        v.destroy();
        break;
      }
      case 'overwatch': {
        const v = this.views.get(e.uid);
        if (v) {
          sfx('select');
          this.callout(v, T('overwatch'), 0x5fe3ff);
          v.refresh();
        }
        await this.wait(200);
        break;
      }
      case 'wait':
        this.views.get(e.uid)?.refresh();
        break;
      case 'spawn': {
        const u = b.unit(e.uid);
        await this.focus(u.x, u.y);
        const v = this.addView(u);
        sfx('alert');
        this.hud.toast(u.side === 'player' ? `${L(u.def.name)}　${T('reinforce')}` : T('reinforce'));
        v.root.setAlpha(0);
        const y = v.root.y;
        v.root.y = y - 160;
        await this.tween({ targets: v.root, y, alpha: 1, duration: this.ms(320), ease: 'Quad.easeIn' });
        this.ring(v.root.x, v.root.y, u.side === 'player' ? 0x5fe3ff : 0xff5a4a);
        await this.wait(160);
        break;
      }
      case 'say':
        await this.say(e.id);
        break;
      case 'end':
        await this.finish(e.result, e.reason);
        break;
    }
  }

  private turnTipsSoon(): void {
    this.time.delayedCall(900, () => {
      if (this.mode !== 'busy') this.turnTips();
    });
  }

  private async walk(v: UnitView, path: Pos[]): Promise<void> {
    const b = this.battle;
    await this.focus(path[0].x, path[0].y);
    v.play('walk');
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const p = path[i];
      v.setDir(this.dirOf(a, p));
      const h0 = b.heightAt(a.x, a.y);
      const h1 = b.heightAt(p.x, p.y);
      // 往前（畫面下方）走：先換到前面那格的層級，才不會被那格的地塊蓋住
      v.root.setDepth(Math.max(tileDepth(a.x, a.y), tileDepth(p.x, p.y)) + 5);
      const tx = isoX(p.x, p.y);
      const ty = isoY(p.x, p.y, h1);
      if (i % 2) sfx('step');
      if (h0 !== h1) {
        // 上下坡：跳一個小弧線
        const y0 = v.root.y;
        const peak = Math.min(y0, ty) - 16;
        await new Promise<void>((ok) => {
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: this.ms(210),
            onUpdate: (tw) => {
              const k = tw.getValue() ?? 0;
              v.root.x = Phaser.Math.Linear(v.root.x, tx, k);
              v.root.y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * peak + k * k * ty;
            },
            onComplete: () => ok(),
          });
        });
      } else {
        await this.tween({ targets: v.root, x: tx, y: ty, duration: this.ms(150), ease: 'Linear' });
      }
      v.place(p.x, p.y);
    }
    v.play('idle');
  }

  private dirOf(a: Pos, p: Pos): Dir {
    const i = DIR_VEC.findIndex(([dx, dy]) => dx === Math.sign(p.x - a.x) && dy === Math.sign(p.y - a.y));
    return (i < 0 ? 0 : i) as Dir;
  }

  private async playAttack(e: Extract<BattleEvent, { t: 'attack' }>): Promise<void> {
    const A = this.views.get(e.uid);
    const Tv = this.views.get(e.target);
    if (!Tv) return;
    const anim = e.kind === 'weapon' || e.kind === 'counter' || e.kind === 'overwatch' || e.kind === 'skill';
    if (A && anim) {
      await this.focus(Tv.unit.x, Tv.unit.y);
      if (e.kind === 'counter') this.callout(A, T('counter'), 0xffa53a);
      if (e.kind === 'overwatch') this.callout(A, T('overwatch'), 0x5fe3ff);
      const w = A.unit.def.weapon;
      const pilot = A.unit.side === 'player';
      const color = pilot ? 0x7fe9ff : 0xff6a5a;
      // 貫穿射擊的光束在 skill 事件已經畫過，這裡只處理命中
      const line = e.kind === 'skill' && A.unit.def.skills.find((s) => s.id === e.skill)?.effect.type === 'line';
      if (!line) {
        A.play('attack');
        if (w.kind === 'melee') {
          const ox = A.root.x;
          const oy = A.root.y;
          await this.tween({ targets: A.root, x: Phaser.Math.Linear(ox, Tv.root.x, 0.45), y: Phaser.Math.Linear(oy, Tv.root.y, 0.45), duration: this.ms(110), ease: 'Quad.easeIn' });
          sfx('claw');
          this.slash(Tv);
          void this.tween({ targets: A.root, x: ox, y: oy, duration: this.ms(170), ease: 'Quad.easeOut' });
        } else if (w.kind === 'indirect') {
          await this.wait(120);
          sfx('mortar');
          await this.lob(A.muzzle(), Tv.center());
          this.blast(Tv.root.x, Tv.root.y - 20, 0xffa53a, 1.1);
        } else {
          await this.wait(A.frames('attack') > 1 ? 230 : 90);
          sfx(w.dmg >= 40 ? 'rail' : w.dmg >= 34 ? 'cannon' : 'laser');
          await this.beam(A.muzzle(), Tv.center(), color, w.dmg >= 36 ? 7 : 4);
        }
      }
    }
    // 命中
    sfx('hit');
    Tv.flash();
    Tv.refresh(e.hp);
    this.blast(Tv.center().x, Tv.center().y, 0xffffff, 0.45);
    this.number(Tv, `-${e.dmg}`, Tv.unit.side === 'player' ? '#ff6a5a' : '#ffe45a', e.killed);
    this.modTags(Tv, e);
    await this.wait(anim ? 380 : 220);
    if (A && anim && A.unit.alive) A.play('idle');
  }

  /** 傷害數字旁邊的小標籤：背襲、側擊、高低差 */
  private modTags(v: UnitView, e: Extract<BattleEvent, { t: 'attack' }>): void {
    const flank = e.mods.find((m) => m.kind === 'flank');
    const height = e.mods.find((m) => m.kind === 'height' && m.value > 0);
    const cover = e.mods.find((m) => m.kind === 'cover');
    const label = flank ? (flank.value >= 30 ? T('mod_flank_back') : T('mod_flank_side')) : height ? T('mod_height') : cover ? T('mod_cover') : '';
    if (!label) return;
    const c = v.center();
    const t = addText(this, c.x, c.y - v.tall * 0.5 - 44, label, { size: 15, raw: true, color: cover && !flank && !height ? '#9fb4c8' : '#ffa53a' })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH + 2);
    this.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: this.ms(900), delay: 200, onComplete: () => t.destroy() });
  }

  private number(v: UnitView, text: string, color: string, big = false): void {
    const c = v.center();
    const t = addText(this, c.x, c.y - v.tall * 0.5 - 12, text, { size: big ? 34 : 26, raw: true, color, strokeW: 5 })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH + 3)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: this.ms(820), delay: 320, onComplete: () => t.destroy() });
  }

  private callout(v: UnitView, text: string, tint: number): void {
    const c = v.center();
    const t = addText(this, c.x, c.y - v.tall * 0.5 - 30, text, { size: 18, raw: true, color: `#${tint.toString(16).padStart(6, '0')}`, strokeW: 4 })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH + 2);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: this.ms(900), delay: 380, onComplete: () => t.destroy() });
  }

  private beam(a: Phaser.Math.Vector2, c: Phaser.Math.Vector2, color: number, width: number): Promise<void> {
    const g = this.add.graphics().setDepth(FX_DEPTH);
    g.lineStyle(width + 6, color, 0.25);
    g.lineBetween(a.x, a.y, c.x, c.y);
    g.lineStyle(width, color, 0.95);
    g.lineBetween(a.x, a.y, c.x, c.y);
    g.lineStyle(Math.max(1.5, width * 0.35), 0xffffff, 1);
    g.lineBetween(a.x, a.y, c.x, c.y);
    this.blast(a.x, a.y, color, 0.35);
    return new Promise((ok) => {
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: this.ms(200),
        delay: this.ms(70),
        onComplete: () => {
          g.destroy();
          ok();
        },
      });
    });
  }

  /** 曲射：砲彈走拋物線 */
  private lob(a: Phaser.Math.Vector2, c: Phaser.Math.Vector2): Promise<void> {
    const s = this.add.image(a.x, a.y, 'glow').setTint(0xffa53a).setScale(0.3).setDepth(FX_DEPTH);
    const peak = Math.min(a.y, c.y) - 150;
    return new Promise((ok) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.ms(520),
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          s.x = Phaser.Math.Linear(a.x, c.x, k);
          s.y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * peak + k * k * c.y;
        },
        onComplete: () => {
          s.destroy();
          ok();
        },
      });
    });
  }

  private slash(v: UnitView): void {
    const c = v.center();
    const g = this.add.graphics().setDepth(FX_DEPTH);
    g.lineStyle(5, 0xffffff, 1);
    g.lineBetween(c.x - 22, c.y - 20, c.x + 22, c.y + 20);
    g.lineStyle(3, 0xff6a5a, 1);
    g.lineBetween(c.x - 14, c.y - 26, c.x + 28, c.y + 12);
    this.tweens.add({ targets: g, alpha: 0, duration: this.ms(240), onComplete: () => g.destroy() });
  }

  private blast(x: number, y: number, tint: number, size: number): void {
    const s = this.add
      .image(x, y, 'glow')
      .setTint(tint)
      .setScale(size * 0.3)
      .setDepth(FX_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: s, scale: size * 1.1, alpha: 0, duration: this.ms(260), onComplete: () => s.destroy() });
  }

  private ring(x: number, y: number, tint: number): void {
    const s = this.add.image(x, y, 'ring').setTint(tint).setScale(0.2, 0.1).setDepth(FX_DEPTH);
    this.tweens.add({ targets: s, scaleX: 1.6, scaleY: 0.8, alpha: 0, duration: this.ms(420), onComplete: () => s.destroy() });
  }

  private async explode(v: UnitView): Promise<void> {
    sfx('boom');
    const c = v.center();
    this.cameras.main.shake(this.ms(180), 0.004);
    for (let i = 0; i < 3; i++) this.time.delayedCall(this.ms(i * 70), () => this.blast(c.x + Phaser.Math.Between(-16, 16), c.y + Phaser.Math.Between(-14, 14), i === 1 ? 0xffffff : 0xffa53a, 1.3));
    this.ring(v.root.x, v.root.y, 0xffa53a);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const p = this.add
        .image(c.x, c.y, 'px')
        .setTint(i % 2 ? 0xffa53a : 0x8494aa)
        .setScale(0.6)
        .setDepth(FX_DEPTH);
      this.tweens.add({ targets: p, x: c.x + Math.cos(a) * 60, y: c.y + Math.sin(a) * 36 + 30, angle: 300, alpha: 0, duration: this.ms(520), ease: 'Quad.easeOut', onComplete: () => p.destroy() });
    }
    await this.tween({ targets: v.root, alpha: 0, duration: this.ms(260), delay: this.ms(80) });
  }

  // ───────── 結束 ─────────

  private async finish(result: 'win' | 'lose', reason: string): Promise<void> {
    this.mode = 'busy';
    this.clearMarks();
    this.hud.refresh();
    await this.wait(500);
    if (result === 'win') {
      sfx('win');
      if (this.mission.outro) await this.say(this.mission.outro);
      const stars = this.battle.stars();
      const sv = save();
      sv.stars[this.mission.id] = Math.max(sv.stars[this.mission.id] ?? 0, stars);
      persist();
    } else {
      sfx('lose');
    }
    this.hud.showResult(result, reason);
  }

  /**
   * 自動對戰：我方也交給 AI，照正常流程演出（自動化測試用；之後可以做成「自動戰鬥」按鈕）。
   * maxTurns 回合內沒結束就停下來。
   */
  async autoBattle(maxTurns = 30): Promise<string> {
    const b = this.battle;
    while (!b.result && b.turn <= maxTurns) {
      const order = b
        .alive('player')
        .filter((u) => !u.def.structure)
        .sort((a, c) => Number(a.def.id === 'echo') - Number(c.def.id === 'echo'));
      for (const u of order) {
        if (b.result) break;
        if (!u.alive || !b.canAct(u)) continue;
        this.mode = 'busy';
        await this.play(aiTakeTurn(b, u));
      }
      if (b.result) break;
      this.mode = 'idle';
      await this.endTurn(true);
    }
    return b.result ?? 'timeout';
  }

  /** 下一關的編號（沒有就回傳 null） */
  nextMission(): string | null {
    const i = MISSIONS.findIndex((m) => m.id === this.mission.id);
    return MISSIONS[i + 1]?.id ?? null;
  }

  restart(): void {
    this.scene.stop('SfHud');
    this.scene.stop('SfDialogue');
    this.scene.restart({ missionId: this.mission.id });
  }

  leave(to: 'missions' | 'next'): void {
    const next = to === 'next' ? this.nextMission() : null;
    this.scene.stop('SfHud');
    this.scene.stop('SfDialogue');
    if (next) this.scene.restart({ missionId: next });
    else this.scene.start('SfMissions');
  }

  /** 地形說明（資訊卡用）：掩體等級與高度 */
  tileNote(u: Unit): string {
    const b = this.battle;
    const t = TERRAIN[b.terrainAt(u.x, u.y)];
    const parts: string[] = [L(t.name)];
    const h = b.heightAt(u.x, u.y);
    if (h > 0) parts.push(T('height', h));
    if (t.cover === 1) parts.push(T('cover1'));
    if (t.cover === 2) parts.push(T('cover2'));
    return parts.join(' · ');
  }

  static readonly ELEV = EH;
}
