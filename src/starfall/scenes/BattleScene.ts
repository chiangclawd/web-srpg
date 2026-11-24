// 戰鬥場景：畫等角地圖和單位、處理點擊操作、把模擬回傳的事件一個一個演出來。
// 介面（按鈕、資訊卡、預估面板）在 HudScene，疊在這個場景上面。
import Phaser from 'phaser';
import { COL, RS, TEX, VIEW_H, addText, cssPx, hudButton, hudZoom, viewW, worldPx } from '../config';
import { ambience, music, sfx } from '../audio';
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
import { loadoutDefs, missionParts } from '../data/upgrades';
import type { Loadout } from '../data/upgrades';
import { clearSuspend, loadSuspend, saveSuspend } from '../suspend';
import { earnedFeats, featsIn, grantFeats, markSeen, winFeats } from '../records';
import { EH, TH, TOP_PAD, TW, isoX, isoY, tileDepth } from '../view/iso';
import { TILE_ATLAS, TILE_TEX_H, loadThemeTiles, themeAtlas, tileKey, tileVariant } from '../view/textures';
import { SHEETS, SHEET_FOOT, frameName, loadSheets, makeAnims } from '../view/sheets';
import { UnitView } from '../view/UnitView';
import { keyUsed } from '../view/ui';
import { BattleFx, FX_DEPTH } from '../view/fx';
import { RECOIL, Shots } from '../view/shots';
import type { HudScene } from './HudScene';

type Mode = 'idle' | 'unit' | 'target' | 'busy';
type MarkKind = 'move' | 'target' | 'aim' | 'select' | 'threat' | 'zone' | 'line';

/** 準備中的動作：普通攻擊或某個技能 */
export type Pending = { kind: 'attack' } | { kind: 'skill'; skill: SkillDef };

/** 點擊的結果：點到哪一格，以及它是不是被前面的單位擋住、穿過去選到的 */
interface Hit {
  pos: Pos;
  through: boolean;
}

/** 被擋住的格子要點在菱形多中間才算穿過去（0 = 正中央，1 = 邊上）：太靠邊的當成是點前面那台 */
const THROUGH_ZONE = 0.62;
/** 連點兩下的間隔（毫秒）：第二下一律算點在最前面的東西上，不穿過去 */
const DOUBLE_TAP = 350;

/** 預估面板要顯示的內容 */
export interface AimInfo {
  title: string;
  target: Unit | null;
  forecast: Forecast | null;
  /** 修復量 / 癱瘓 / 貫穿打到幾個之類的補充說明 */
  note: string;
}

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
  /** 大地圖：整張放不進畫面，開場拉近到我方附近，介面多一張小地圖和「下一台」按鈕 */
  big = false;
  private center = new Phaser.Math.Vector2();
  private bounds = new Phaser.Geom.Rectangle();
  private drag: { x: number; y: number; moved: boolean; pinch: number } | null = null;
  private endArmed = false;
  /** 進行中的鏡頭移動結束時要呼叫的函式（見 stopFocus） */
  private focusDone: (() => void) | null = null;
  private fx!: BattleFx;
  /** 這場是接著上次沒打完的打（不重播開場對話、不重新開始第一回合） */
  private resumed = false;
  /** 開戰時的改造：存檔要連這個一起存，接著打才會用同一套數值 */
  private upgrades: Loadout = {};
  private shots!: Shots;
  /** 技能特寫時鏡頭往前推了一點：這裡記著原本的倍率，這一串演出播完再退回去 */
  private zoomBack: number | null = null;
  /** 鍵盤游標停在哪一格（用過方向鍵才會出現；滑鼠或觸控一點就收起來） */
  private cursor: Pos | null = null;
  private cursorMarks: Phaser.GameObjects.Image[] = [];
  /** 被前面的單位擋住的落點，點了一次：先標出來（擋住它的單位變半透明），再點一次才走過去 */
  private peek: Pos | null = null;
  private peekMarks: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
  /** 上一次點地圖的時間 */
  private lastTap = -1e9;
  /** 上一下是穿過單位選到後面的東西：馬上又點一下的話，先用這個把它收回去（見 onTap） */
  private quickUndo: (() => void) | null = null;
  /** 目前哪些格子要讓玩家看得到（算過一次就記著，狀態沒變不重算） */
  private revealKey = '';
  /** 進這場戰鬥之前就有的成就：之後多出來的才是這一場達成的 */
  private known = new Set<string>();
  /** 這一場達成的成就（結算畫面會列出來） */
  private feats: string[] = [];

  constructor() {
    super('SfBattle');
  }

  init(data: { missionId: string; resume?: boolean }): void {
    this.mission = missionById(data.missionId);
    // 接著打：存檔要對得上這一關才用；對不上、或是重新出擊，就把舊的存檔清掉、從頭開始
    const sus = data.resume ? loadSuspend() : null;
    this.resumed = !!sus && sus.battle.mission.id === this.mission.id;
    if (sus && this.resumed) {
      this.battle = sus.battle;
      this.upgrades = sus.upgrades;
    } else {
      clearSuspend();
      this.upgrades = JSON.parse(JSON.stringify(save().upgrades)) as Loadout;
      this.battle = new Battle(this.mission, loadoutDefs(UNITS, this.upgrades), save().easy);
    }
    this.views = new Map();
    this.marks = { move: [], target: [], aim: [], select: [], threat: [], zone: [], line: [] };
    this.mode = 'busy';
    this.sel = null;
    this.pending = null;
    this.aim = null;
    this.range = null;
    this.drag = null;
    this.endArmed = false;
    this.focusDone = null;
    this.zoomBack = null;
    this.cursor = null;
    this.cursorMarks = [];
    this.peek = null;
    this.peekMarks = [];
    this.lastTap = -1e9;
    this.quickUndo = null;
    this.revealKey = '';
    this.known = earnedFeats(save());
    this.feats = [];
  }

  // ───────── 建立 ─────────

  /** 這一關會出現的機體圖表（開場的單位、之後的增援、場景擺設）和這一章的地塊。只載入還沒載入過的 */
  preload(): void {
    const need = [
      ...this.battle.units.map((u) => u.def.sprite),
      ...(this.mission.events ?? []).flatMap((e) => (e.spawn ?? []).map((s) => UNITS[s.unit]?.sprite ?? '')),
      ...(this.mission.props ?? []).map((p) => p.sprite),
    ];
    const tiles = loadThemeTiles(this, this.mission.theme ?? 'hull');
    if (!loadSheets(this, need) && !tiles) return;
    // 要等一下的時候畫面中間顯示一行字
    const t = addText(this, this.scale.width / 2, this.scale.height / 2, T('loading'), { size: 22 * RS, raw: true, color: '#8fb0c8' }).setOrigin(0.5);
    this.load.once('complete', () => t.destroy());
  }

  create(): void {
    makeAnims(this);
    const b = this.battle;
    // 有首領的關卡換一首比較兇的曲子
    music(this.battle.units.some((u) => u.def.boss) ? 'boss' : 'battle');
    // 環境音：室外是風，船裡是機器的嗡鳴
    const theme = this.mission.theme ?? 'hull';
    ambience(theme === 'ice' || theme === 'field' ? 'amb_wind' : 'amb_hum');
    this.bg = this.add
      .image(0, 0, { ice: 'bg_ice', hull: 'bg_hull', bay: 'bg_bay', reactor: 'bg_reactor', field: 'bg_field' }[this.mission.theme ?? 'hull'])
      .setScrollFactor(0)
      .setDepth(-1000);
    // 地塊：每格一張「柱狀」圖（頂面 + 往下延伸的側面），靠前的蓋住靠後的
    const atlas = this.textures.exists(TILE_ATLAS);
    // 這一章自己的地塊（冷凍艙、反應爐、戰場）；那一套裡沒有的地形、或圖集沒載到，用共用的那一套
    const themed = themeAtlas(theme);
    const own = themed && this.textures.exists(themed) ? this.textures.get(themed) : null;
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
          let key = tileKey(id, tileVariant(id, x, y));
          // 殘骸堆的圖底下是鋪板；四周大多是冰雪的話，換成「冰面上的殘骸」（有這張圖的主題才換），不然冰原中間會冒出一塊鋪板
          const onIce = id === 'rubble' && key.replace('rubble', 'rubbleice');
          if (onIce && own?.has(onIce) && this.mostlyIce(x, y)) key = onIce;
          const mine = !!own && own.has(key);
          this.add
            .image(sx, sy, mine ? own.key : atlas ? TILE_ATLAS : key, mine || atlas ? key : undefined)
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
    // 氣氛：高低差的陰影、導管的光、底部的霧、環境粒子、四角壓暗
    this.fx = new BattleFx(this, (n) => this.ms(n));
    this.shots = new Shots(this, this.fx, (n) => this.ms(n));
    this.fx.ground({
      w: b.w,
      h: b.h,
      top: (x, y) => (b.terrainAt(x, y) === 'chasm' ? null : b.heightAt(x, y) + (b.terrainAt(x, y) === 'wall' ? 2 : 0)),
      glow: (x, y) => b.terrainAt(x, y) === 'grate',
      // 戰場：冰面上零星幾處焦痕（依座標固定，每次進這一關都在同樣的地方）
      scar: (x, y) => theme === 'field' && b.terrainAt(x, y) === 'ice' && (((x * 73856093) ^ (y * 19349663) ^ 0x5bd1) >>> 0) % 17 === 0,
      theme: this.mission.theme ?? 'hull',
      bounds: this.bounds,
    });
    const win = this.mission.win;
    if (win.type === 'reach' || win.type === 'hold') for (const p of win.zone) this.mark('zone', p.x, p.y);
    // 場景擺設（爐心之類）：跟單位用同一種圖表，只是不會動
    for (const p of this.mission.props ?? []) {
      const sheet = SHEETS[p.sprite];
      if (!sheet) continue;
      this.add
        .image(isoX(p.x, p.y), isoY(p.x, p.y, b.heightAt(p.x, p.y)), `sf_${p.sprite}`, frameName(sheet, 'idle', false, 0))
        .setOrigin(0.5, SHEET_FOOT)
        .setScale((sheet.h * (p.scale ?? 1)) / sheet.unitPx)
        .setDepth(tileDepth(p.x, p.y) + 4);
    }
    // 接著打的時候，已經被擊破的單位不用再擺出來
    for (const u of b.units) if (u.alive) this.addView(u);

    // 鏡頭：整張地圖放得進畫面（留位置給上下的介面），最多放大到 1.5 倍
    // 右邊一整排是行動按鈕：地圖放在它左邊的空間裡
    const w = viewW(this);
    const hz = hudZoom();
    const side = (hudButton(hz.compact).w + 28) * hz.z;
    const fit = Math.min((w - side - 60) / this.bounds.width, (VIEW_H - 130) / this.bounds.height);
    this.minZoom = Phaser.Math.Clamp(fit * 0.9, 0.45, 1);
    // 整張放進畫面會小到看不清楚的大地圖：開場拉近，鏡頭對著我方的機體；要看全局就縮小或用小地圖
    this.big = fit < 0.7;
    if (this.big) {
      this.zoom = 0.75;
      const mine = b.units.filter((u) => u.side === 'player' && !u.def.structure);
      const cx = mine.reduce((n, u) => n + isoX(u.x, u.y), 0) / Math.max(1, mine.length);
      const cy = mine.reduce((n, u) => n + isoY(u.x, u.y, b.heightAt(u.x, u.y)), 0) / Math.max(1, mine.length);
      this.center.set(cx + side / 2 / this.zoom, cy);
    } else {
      this.zoom = Phaser.Math.Clamp(fit, this.minZoom, 1.25);
      this.center.set(this.bounds.centerX + side / 2 / this.zoom, this.bounds.centerY + 10);
    }
    this.applyCamera();

    this.input.addPointer(1);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1)));
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.scale.on('resize', this.applyCamera, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyCamera, this));

    this.scene.launch('SfHud', { battle: this });
  }

  /** HudScene 建好之後呼叫：開場對話 → 第一回合 */
  async hudReady(hud: HudScene): Promise<void> {
    this.hud = hud;
    // 場上的機體記進圖鑑。最後一種也遇到了的話圖鑑的成就在這裡達成：先存起來，等開場對話和回合提示播完再跳提示
    const met = this.collect();
    if (this.resumed) {
      this.refreshViews();
      this.toIdle();
      this.hud.toast(T('resumed', this.battle.turn));
      for (const id of met) this.hud.award(id);
      return;
    }
    if (this.mission.intro) await this.say(this.mission.intro);
    await this.play(this.battle.start());
    this.toIdle();
    for (const id of met) this.hud.award(id);
  }

  /** 這一格四周（上下左右）是不是大多是冰或雪 */
  private mostlyIce(x: number, y: number): boolean {
    const b = this.battle;
    let n = 0;
    let ice = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!b.inMap(x + dx, y + dy)) continue;
      const t = b.terrainAt(x + dx, y + dy);
      if (t === 'chasm') continue;
      n++;
      if (t === 'ice' || t === 'snow') ice++;
    }
    return n > 0 && ice * 2 >= n;
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
    this.syncGhosts();
    for (const v of this.views.values()) v.update(time);
    this.fx.update(time, this.views.values());
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
    // 上一次的鏡頭移動還沒完：直接接手（先放行等它的人）
    this.stopFocus();
    return new Promise((ok) => {
      const done = (): void => {
        if (this.focusDone === done) this.focusDone = null;
        ok();
      };
      this.focusDone = done;
      this.tweens.add({
        targets: this.center,
        x: wx,
        y: wy,
        duration: this.ms(260),
        ease: 'Sine.easeInOut',
        onUpdate: () => this.applyCamera(),
        onComplete: done,
      });
    });
  }

  /**
   * 中斷進行中的鏡頭移動，並放行正在等它的演出。
   * 演出（移動、攻擊、敵方回合）都會 await focus()；只把補間動畫砍掉的話 onComplete 不會觸發，
   * 那個 Promise 永遠不會結束，整場戰鬥就卡在 busy。所以任何打斷鏡頭的地方都要走這裡。
   */
  private stopFocus(): void {
    this.tweens.killTweensOf(this.center);
    const done = this.focusDone;
    this.focusDone = null;
    done?.();
  }

  /** 地圖在世界座標裡佔的範圍（小地圖用） */
  get mapBounds(): Phaser.Geom.Rectangle {
    return this.bounds;
  }

  /** 把鏡頭移到世界座標的某一點（點小地圖） */
  lookAt(wx: number, wy: number): void {
    this.stopFocus();
    this.center.set(wx, wy);
    this.applyCamera();
  }

  /** 選下一台還沒行動的我方機體，鏡頭跟過去 */
  nextUnit(step = 1): void {
    if (this.mode === 'busy' || this.mode === 'target') return;
    const b = this.battle;
    const list = b.units.filter((u) => u.side === 'player' && b.canAct(u));
    if (!list.length) return;
    const i = this.sel ? list.findIndex((u) => u.uid === this.sel!.uid) : -1;
    const u = list[i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length];
    this.select(u);
    void this.focus(u.x, u.y);
  }

  // ───────── 輸入 ─────────

  private onDown(p: Phaser.Input.Pointer): void {
    this.hideCursor();
    // 按在介面上（按鈕、小地圖、對話框）的不算拖地圖
    if (this.hud?.input.hitTestPointer(p).length) return;
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
    this.onTap(wp.x, wp.y, p.wasTouch, p.upTime);
  }

  /** 這一點離某一格頂面的中心多遠：0 = 正中央，1 = 菱形的邊上 */
  private tileDist(x: number, y: number, wx: number, wy: number): number {
    const b = this.battle;
    const cy = isoY(x, y, b.heightAt(x, y) + (b.terrainAt(x, y) === 'wall' ? 2 : 0));
    return Math.abs(wx - isoX(x, y)) / (TW / 2) + Math.abs(wy - cy) / (TH / 2);
  }

  /** 頂面蓋到這一點的格子，靠前的排前面 */
  private tilesAt(wx: number, wy: number): Pos[] {
    const b = this.battle;
    const out: Pos[] = [];
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (b.terrainAt(x, y) === 'chasm') continue;
        // 菱形稍微內縮：墊高的格子頂角剛好落在後面那格的正中央，點後面那格的中心不該算到前面這格
        if (this.tileDist(x, y, wx, wy) <= 0.94) out.push({ x, y });
      }
    }
    return out.sort((p, q) => tileDepth(q.x, q.y) - tileDepth(p.x, p.y));
  }

  /** 圖像蓋到這一點的單位（照圖的形狀，透明的地方不算），靠前的排前面 */
  private unitsAt(wx: number, wy: number, pad: number): UnitView[] {
    const out: UnitView[] = [];
    for (const v of this.views.values()) if (v.unit.alive && v.covers(wx, wy, pad)) out.push(v);
    return out.sort((p, q) => q.root.depth - p.root.depth);
  }

  /** 這一格現在點下去有沒有用：2 = 會做事（走過去、打它、技能的目標），1 = 改選那一台，0 = 沒有作用 */
  private use(p: Pos): number {
    const b = this.battle;
    if (this.mode === 'target') return this.validTargets().some((t) => t.x === p.x && t.y === p.y) ? 2 : 0;
    const s = this.sel;
    const act = this.mode === 'unit' && !!s && s.side === 'player' && b.canAct(s);
    const u = b.unitAt(p.x, p.y);
    if (u) return u === s ? 0 : act && s && u.side !== s.side && b.canHit(s, s, u.x, u.y) ? 2 : 1;
    return act && s && !s.moved && this.range?.has(b.key(p.x, p.y)) && b.canStop(s, p.x, p.y) ? 2 : 0;
  }

  /**
   * 這一點點到哪一格。原則是「看得到什麼就點到什麼」：單位照圖的形狀，其餘是地塊的頂面，靠前的優先。
   * 例外是被單位擋住、但現在比前面那台用得上的格子（走得到的落點、打得到的敵人、技能的目標、
   * 或前面那台已經選著了）：點在那一格的中間就穿過前面的單位選到它，回傳 through。
   * 選目標的時候前面那台反正不能選，整個菱形和目標的整張圖都算。
   */
  private pickAt(wx: number, wy: number, pad: number, through: boolean): Hit | null {
    const units = this.unitsAt(wx, wy, pad);
    const tiles = this.tilesAt(wx, wy);
    const front = units[0];
    if (this.mode === 'target') {
      const vu = units.find((v) => this.use(v.unit) === 2);
      if (vu) return { pos: { x: vu.unit.x, y: vu.unit.y }, through: vu !== front };
      const vt = tiles.find((t) => this.use(t) === 2);
      if (vt) return { pos: vt, through: !!front };
    }
    const tile = tiles[0] ?? null;
    if (!front) return tile ? { pos: tile, through: false } : null;
    const own = { x: front.unit.x, y: front.unit.y };
    if (!tile || (tile.x === own.x && tile.y === own.y)) return { pos: own, through: false };
    if (through && this.use(tile) > this.use(own) && this.tileDist(tile.x, tile.y, wx, wy) <= THROUGH_ZONE) return { pos: tile, through: true };
    return { pos: own, through: false };
  }

  /**
   * 畫面座標 → 點到哪一格。沒點到用得上的東西（空地、地圖外面）時往四周找一小圈，
   * 手指點偏一點還是算到旁邊的單位或目標上；不會因此走到旁邊的格子。
   */
  private pick(wx: number, wy: number, touch: boolean, through: boolean): Hit | null {
    const b = this.battle;
    const slop = cssPx(touch ? 10 : 4) / this.zoom;
    const hit = this.pickAt(wx, wy, slop * 0.4, through);
    const target = this.mode === 'target';
    const wanted = (h: Hit): boolean => {
      const u = b.unitAt(h.pos.x, h.pos.y);
      return target ? this.use(h.pos) === 2 : !!u && u !== this.sel;
    };
    if (hit && (target ? wanted(hit) : !!b.unitAt(hit.pos.x, hit.pos.y) || this.use(hit.pos) > 0)) return hit;
    for (const k of [0.5, 1]) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const h = this.pickAt(wx + Math.cos(a) * slop * k, wy + Math.sin(a) * slop * k, 0, false);
        if (h && wanted(h)) return h;
      }
    }
    return hit;
  }

  /**
   * 點了地圖上的某一點。穿過單位選到後面的東西時多一層保險：
   * - 落點：第一次只標出來（擋住它的單位變半透明、旁邊寫「再點一次移動」），再點一次才走過去。
   * - 馬上又點一下（連點兩下）：當成「我要的是前面這台」，把剛才穿過去的結果收回，照看得到的算。
   */
  private onTap(wx: number, wy: number, touch = false, at = performance.now()): void {
    if (this.mode === 'busy' || this.battle.result) return;
    // 用點擊事件本身的時間：畫面卡的時候兩下會擠在同一格才處理，照處理的時間算會把隔很久的兩下當成連點
    const now = at;
    const quick = now - this.lastTap < DOUBLE_TAP;
    this.lastTap = now;
    if (quick) this.quickUndo?.();
    this.quickUndo = null;
    // 已經在選目標（不是剛才那一下才進來的）：連點兩下是確定同一個目標，照樣可以穿過去
    const hit = this.pick(wx, wy, touch, !quick || this.mode === 'target');
    const t = hit?.pos ?? null;
    const wasUnit = this.mode === 'unit';
    if (hit?.through && wasUnit && t && !this.battle.unitAt(t.x, t.y) && !(this.peek && this.peek.x === t.x && this.peek.y === t.y)) {
      this.hud.hideTip();
      this.setPeek(t);
      this.quickUndo = () => this.setPeek(null);
      return;
    }
    this.setPeek(null);
    this.actAt(t);
    if (hit?.through && wasUnit && this.mode === 'target') this.quickUndo = () => void (this.mode === 'target' && this.cancelTarget());
  }

  /** 標出（或收起）被擋住的落點 */
  private setPeek(t: Pos | null): void {
    for (const o of this.peekMarks) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.peekMarks = [];
    this.peek = t;
    if (!t) return;
    const x = isoX(t.x, t.y);
    const y = isoY(t.x, t.y, this.battle.heightAt(t.x, t.y));
    const edge = this.add.image(x, y, 'ov_edge').setTint(0xffffff).setDepth(tileDepth(t.x, t.y) + 3.5);
    this.tweens.add({ targets: edge, scale: { from: 1 / TEX, to: 1.16 / TEX }, alpha: { from: 1, to: 0.55 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // 字的大小照螢幕算：手機上地圖縮得小，照世界座標的字級會小到看不清楚
    const size = Math.max(worldPx(15), Math.round(cssPx(11.5) / this.zoom));
    // 寫在那一格上面（不放在格子上方：那裡是擋住它的那台的耐久條）
    const tag = addText(this, x, y - 4, T('peekMove'), { size, raw: true, strokeW: 4 })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH + 2);
    this.peekMarks = [edge, tag];
    sfx('select');
  }

  /**
   * 玩家現在需要看得到的格子：預覽的落點、瞄準的目標、鍵盤游標，還有打得到的敵人和技能可以選的單位。
   * 圖像擋住這些格子的單位變半透明（UnitView.ghost）。半透明的單位點它身上、後面那格的位置，會選到後面。
   */
  private syncGhosts(): void {
    const b = this.battle;
    const s = this.sel;
    const off = this.mode === 'busy' || !!b.result;
    const at = (p: Pos | null): string => (p ? `${p.x},${p.y}` : '-');
    const key = off
      ? ''
      : [this.mode, s ? `${s.uid}@${s.x},${s.y}:${s.moved}:${s.acted}` : '-', this.pending ? (this.pending.kind === 'skill' ? this.pending.skill.id : 'attack') : '-', at(this.aim), at(this.peek), at(this.cursor), b.units.filter((u) => u.alive).length].join('|');
    if (key === this.revealKey) return;
    this.revealKey = key;
    for (const v of this.views.values()) v.ghost = false;
    if (off) return;
    const cells: Pos[] = [];
    if (this.peek) cells.push(this.peek);
    if (this.cursor) cells.push(this.cursor);
    if (this.mode === 'target') {
      if (this.aim) cells.push(this.aim);
      for (const t of this.validTargets()) if (b.unitAt(t.x, t.y)) cells.push(t);
    } else if (this.mode === 'unit' && s && s.side === 'player' && b.canAct(s)) {
      for (const t of b.targets(s)) cells.push({ x: t.x, y: t.y });
    }
    if (!cells.length) return;
    // 每一格取幾個點：格子的中心和左右；上面有單位就再取它身上的兩點。這些點被誰的圖蓋住，誰就變半透明
    const keep = new Set<number>();
    const pts: { x: number; y: number; depth: number }[] = [];
    for (const c of cells) {
      const x = isoX(c.x, c.y);
      const y = isoY(c.x, c.y, b.heightAt(c.x, c.y));
      const depth = tileDepth(c.x, c.y);
      const u = b.unitAt(c.x, c.y);
      const v = u ? this.views.get(u.uid) : undefined;
      pts.push({ x, y, depth }, { x: x - 18, y, depth }, { x: x + 18, y, depth });
      if (!u || !v) continue;
      // 目標本身不變透明（它擋住另一個目標也一樣）
      keep.add(u.uid);
      pts.push({ x, y: y - v.tall * 0.4, depth }, { x, y: y - v.tall * 0.75, depth });
    }
    for (const v of this.views.values()) {
      if (!v.unit.alive || keep.has(v.unit.uid)) continue;
      const depth = tileDepth(v.unit.x, v.unit.y);
      v.ghost = pts.some((p) => depth > p.depth && v.covers(p.x, p.y, 2));
    }
  }

  /** 對某一格下指令：點擊和鍵盤的 Enter 都走這裡（null = 點到地圖外面） */
  private actAt(t: Pos | null): void {
    if (this.mode === 'busy' || this.battle.result) return;
    this.hud.hideTip();
    const b = this.battle;
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

  // ───────── 鍵盤 ─────────

  /**
   * 方向鍵移動游標（選目標時在可以打的目標之間切換）、Enter / 空白鍵等於點那一格、Esc 退一步（沒東西可退就開選單）、
   * Tab 跳到下一台還沒行動的機體；其餘的字母和數字是行動按鈕的快捷鍵（交給 HudScene 找按鈕）。
   * 對話、設定頁、選單或結算開著的時候不處理：那些畫面有自己的按鍵。
   */
  private onKey(ev: KeyboardEvent): void {
    if (!this.hud || this.hud.modalOpen || this.battle.result) return;
    if (this.scene.isActive('SfDialogue') || this.scene.isActive('SfSettings')) return;
    if (keyUsed.has(ev)) return;
    keyUsed.add(ev);
    this.setPeek(null);
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (k === '+' || k === '=') return this.setZoom(this.zoom * 1.1);
    if (k === '-' || k === '_') return this.setZoom(this.zoom * 0.9);
    if (this.mode === 'busy') return;
    const dir = ({ ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] } as Record<string, [number, number] | undefined>)[k];
    if (dir) {
      ev.preventDefault();
      // 選敵人或友軍：在名單裡前後切換；選落點（躍進）：游標自由移動
      const tiles = this.pending?.kind === 'skill' && this.pending.skill.target === 'tile';
      if (this.mode === 'target' && !tiles) this.cycleTarget(dir[0] + dir[1]);
      else this.moveCursor(dir[0], dir[1]);
      return;
    }
    if (k === 'Enter' || k === ' ') {
      ev.preventDefault();
      if (ev.repeat) return;
      if (this.mode === 'target') {
        const tiles = this.pending?.kind === 'skill' && this.pending.skill.target === 'tile';
        const c = this.cursor;
        const a = this.aim;
        // 選落點：游標停在另一格可以跳的地方，就先瞄準那一格；其餘情況 Enter 就是「確定」那顆按鈕。
        // 不能直接對游標那一格下指令：目標可能是自動瞄準或用滑鼠選的，游標還留在別的地方，那樣會變成取消
        if (tiles && c && !(a && a.x === c.x && a.y === c.y) && this.validTargets().some((p) => p.x === c.x && p.y === c.y)) this.aimAt(c);
        else if (a) this.hud.hotkey('enter');
        else if (!tiles) this.cycleTarget(1);
        return;
      }
      if (this.cursor) this.actAt(this.cursor);
      return;
    }
    if (k === 'Escape' || k === 'Backspace') {
      if (ev.repeat) return;
      if (this.mode === 'target') this.cancelTarget();
      else if (this.mode === 'unit') this.toIdle();
      else this.hud.openMenu();
      return;
    }
    if (k === 'Tab') {
      ev.preventDefault();
      this.nextUnit(ev.shiftKey ? -1 : 1);
      if (this.sel) this.setCursor(this.sel.x, this.sel.y);
      return;
    }
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (k === 'm') this.hud.openMenu();
    else this.hud.hotkey(k);
    // 按了攻擊或技能、只有一個目標時會自動瞄準：游標跟過去，看得出現在對著誰
    if (this.mode === 'target' && this.aim && this.cursor) this.setCursor(this.aim.x, this.aim.y);
  }

  /** 游標往格子的方向走一步：右 = x+1（畫面右下）、左 = x-1、下 = y+1（畫面左下）、上 = y-1。跨過裂谷 */
  private moveCursor(dx: number, dy: number): void {
    const b = this.battle;
    if (!this.cursor) {
      // 第一次按方向鍵：游標先出現在選取中的機體（沒有就第一台我方機體）腳下，不移動
      const u = this.sel ?? b.alive('player').find((p) => !p.def.structure);
      this.setCursor(u?.x ?? 0, u?.y ?? 0);
      return;
    }
    for (let n = 1; n < Math.max(b.w, b.h); n++) {
      const x = this.cursor.x + dx * n;
      const y = this.cursor.y + dy * n;
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
      if (b.terrainAt(x, y) === 'chasm') continue;
      this.setCursor(x, y);
      return;
    }
  }

  private setCursor(x: number, y: number): void {
    const b = this.battle;
    this.cursor = { x, y };
    if (!this.cursorMarks.length) {
      const edge = this.add.image(0, 0, 'ov_edge').setTint(0xffffff);
      const dot = this.add.image(0, 0, 'ov_dot').setTint(0xffffff).setScale(1 / TEX);
      this.tweens.add({ targets: edge, scale: { from: 1 / TEX, to: 1.16 / TEX }, alpha: { from: 1, to: 0.55 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.cursorMarks = [edge, dot];
    }
    const h = b.heightAt(x, y) + (b.terrainAt(x, y) === 'wall' ? 2 : 0);
    for (const im of this.cursorMarks)
      im.setPosition(isoX(x, y), isoY(x, y, h))
        .setDepth(tileDepth(x, y) + 3.5)
        .setVisible(true);
    void this.focus(x, y);
  }

  private hideCursor(): void {
    this.cursor = null;
    for (const im of this.cursorMarks) im.setVisible(false);
  }

  /** 選目標時用方向鍵在可以打的目標之間切換（照畫面由左到右排） */
  private cycleTarget(step: number): void {
    const list = [...this.validTargets()].sort((p, q) => isoX(p.x, p.y) - isoX(q.x, q.y) || isoY(p.x, p.y) - isoY(q.x, q.y));
    if (!list.length) return;
    const a = this.aim;
    const i = a ? list.findIndex((p) => p.x === a.x && p.y === a.y) : -1;
    const t = list[i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length];
    this.aimAt(t);
    this.setCursor(t.x, t.y);
  }

  // ───────── 範圍標示 ─────────

  private mark(kind: MarkKind, x: number, y: number): void {
    const b = this.battle;
    // 可以攻擊的格子和威脅範圍是敵方的顏色，跟著色盲配色換
    const [tint, alpha] = kind === 'target' ? [COL.target, 0.55] : kind === 'threat' ? [COL.threat, 0.3] : MARK_COLOR[kind];
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
    if (!kinds.length) this.setPeek(null);
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
    this.autosave();
  }

  /** 按了「攻擊」或某個技能：進入選目標 */
  beginTarget(p: Pending): void {
    const u = this.sel;
    if (!u || !this.battle.canAct(u)) return;
    this.pending = p;
    this.aim = null;
    this.mode = 'target';
    this.setPeek(null);
    this.clearMarks('move', 'target', 'aim', 'line');
    if (p.kind === 'skill' && p.skill.id === 'leap') this.hud.showTip('tip_leap');
    const list = this.validTargets();
    const tile = p.kind === 'skill' && p.skill.target === 'tile';
    for (const t of list) this.mark(tile ? 'move' : 'target', t.x, t.y);
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
    if (!a) {
      const how = p.kind === 'skill' && p.skill.target === 'dir' ? T('pickDir') : p.kind === 'skill' && p.skill.target === 'tile' ? T('pickTile') : T('pickTarget');
      return { title, target: null, forecast: null, note: p.kind === 'skill' ? `${L(p.skill.desc)}\n${how}` : how };
    }
    const b = this.battle;
    const tgt = b.unitAt(a.x, a.y) ?? null;
    if (p.kind === 'attack') return { title, target: tgt, forecast: tgt ? b.forecast(u, tgt) : null, note: '' };
    const e = p.skill.effect;
    if (e.type === 'leap') return { title, target: null, forecast: null, note: T('leapHere') };
    if (e.type === 'heal' && tgt) return { title, target: tgt, forecast: null, note: `${T('heal')} +${Math.min(e.amount, tgt.maxHp - tgt.hp)}` };
    if (e.type === 'stun' && tgt) return { title, target: tgt, forecast: null, note: T('stunned') };
    if (e.type === 'rally' && tgt) return { title, target: tgt, forecast: null, note: T('rallyDone') };
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
    // 只有會造成傷害的技能才有傷害預估；其他效果（或沒對到目標）不顯示數字
    const dmg = e.type === 'shot' || e.type === 'push';
    return { title, target: tgt, forecast: tgt && dmg ? b.forecast(u, tgt, u, p.skill) : null, note: '' };
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
      if (this.mission.id === 'm4' && this.battle.turn === 1) this.hud.showTip('tip_leap');
      if (this.mission.id === 'm5' && this.battle.turn === 2) this.hud.showTip('tip_shield');
      if (this.mission.id === 'm7' && this.battle.turn === 3) this.hud.showTip('tip_mender');
      if (this.mission.id === 'm8' && this.battle.turn === 1) this.hud.showTip('tip_rally');
      if (this.mission.id === 'm9' && this.battle.turn === 1) this.hud.showTip('tip_hold');
      if (this.mission.id === 'm10' && this.battle.turn === 1) this.hud.showTip('tip_drones');
      if (this.mission.id === 'm10' && this.battle.turn === 2) this.hud.showTip('tip_thunderer');
      if (this.mission.id === 'm11' && this.battle.turn === 1) this.hud.showTip('tip_projector');
      return;
    }
    const tip = ({ 1: 'tip_move', 2: 'tip_flank', 3: 'tip_overwatch', 4: 'tip_cover' } as const)[this.battle.turn as 1 | 2 | 3 | 4];
    if (tip) this.hud.showTip(tip);
  }

  /**
   * 把這場戰鬥存下來，關掉分頁或離開任務之後可以接著打。我方回合每做完一個動作、每次退回移動都存一次；
   * 敵方回合和已經結束的戰鬥不存（Battle.snapshot 會回傳 null）。
   */
  private autosave(): void {
    saveSuspend(this.battle, this.upgrades);
  }

  /**
   * 圖鑑和成就：把場上出現的機體記成遇過（增援也算），把 grant 這幾個戰術成就記進存檔。
   * 回傳這次新達成的成就 —— 包含從進度算出來的（過關拿到星之後的章節、星數成就）。
   */
  private collect(grant: string[] = []): string[] {
    const sv = save();
    const seen = markSeen(
      sv,
      this.battle.units.map((u) => u.def.id),
    );
    const got = grantFeats(sv, grant);
    if (seen || got) persist();
    const fresh = [...earnedFeats(sv)].filter((id) => !this.known.has(id));
    for (const id of fresh) this.known.add(id);
    this.feats.push(...fresh);
    return fresh;
  }

  /** 設定頁改了配色之後，把場上的單位（耐久條、腳下的陣營色）和範圍標示照新的顏色重畫 */
  restyle(): void {
    this.refreshViews();
    if (this.mode === 'unit' && this.sel) this.select(this.sel);
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
    // 這個動作做到的成就先存起來（演到一半關掉也不會漏），演完再跳提示；這一串剛好打完的話改在結算畫面列出來
    const fresh = this.collect(featsIn(events, this.battle));
    for (const e of events) await this.playOne(e);
    if (!this.battle.result) for (const id of fresh) this.hud?.award(id);
    if (this.zoomBack !== null) {
      const z = this.zoomBack;
      this.zoomBack = null;
      this.tweens.add({ targets: this, zoom: z, duration: this.ms(260), ease: 'Quad.easeInOut', onUpdate: () => this.applyCamera() });
    }
    if (!this.battle.result) this.mode = prev;
    this.hud?.refresh();
    this.autosave();
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
        // 技能特寫：我方每次都有；敵方只有首領有，免得敵方回合拖太久
        if (save().cutIn && (v.unit.side === 'player' || v.unit.def.boss)) {
          this.punchIn();
          await this.hud.cutIn(v.unit, L(def.name));
        }
        this.callout(v, L(def.name), 0xffe45a);
        if (def.effect.type === 'line') {
          const tiles = b.lineTiles(v.unit, e.at, def);
          const last = tiles[tiles.length - 1] ?? e.at;
          v.play('attack');
          await this.wait(260);
          await this.shots.fire('rail', v.muzzle(), new Phaser.Math.Vector2(isoX(last.x, last.y), isoY(last.x, last.y, b.heightAt(last.x, last.y)) - 36), { color: 0xffa53a, power: true });
          v.play('idle');
        } else if (def.effect.type !== 'leap') {
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
        const from = this.views.get(e.uid);
        if (from) await this.shots.fire('arc', from.center(), v.center(), { color: 0xffe45a, power: true });
        else sfx('stun');
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
      case 'leap': {
        const v = this.views.get(e.uid);
        if (!v) break;
        await this.focus(e.to.x, e.to.y);
        sfx('rail');
        this.ring(v.root.x, v.root.y, 0xffa53a);
        const x0 = v.root.x;
        const y0 = v.root.y;
        const tx = isoX(e.to.x, e.to.y);
        const ty = isoY(e.to.x, e.to.y, b.heightAt(e.to.x, e.to.y));
        const peak = Math.min(y0, ty) - 110;
        v.root.setDepth(FX_DEPTH - 1);
        await new Promise<void>((ok) => {
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: this.ms(420),
            ease: 'Sine.easeInOut',
            onUpdate: (tw) => {
              const k = tw.getValue() ?? 0;
              v.root.x = Phaser.Math.Linear(x0, tx, k);
              v.root.y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * peak + k * k * ty;
              if (Math.random() < 0.5) this.blast(v.root.x, v.root.y - 10, 0xffa53a, 0.3);
            },
            onComplete: () => ok(),
          });
        });
        v.place(e.to.x, e.to.y);
        v.setDir(v.unit.dir);
        this.ring(tx, ty, 0xffa53a);
        sfx('step');
        break;
      }
      case 'rally': {
        const v = this.views.get(e.target);
        if (!v) break;
        sfx('heal');
        this.ring(v.root.x, v.root.y, 0xffe45a);
        this.callout(v, T('rallyDone'), 0xffe45a);
        v.refresh();
        await this.wait(320);
        break;
      }
      case 'hold': {
        sfx(e.n > 0 ? 'heal' : 'error');
        this.hud.toast(e.n > 0 ? T('holdProgress', e.n, e.of) : T('holdBroken'));
        for (const im of this.marks.zone) this.tweens.add({ targets: im, scale: { from: 1.6 / TEX, to: 1 / TEX }, duration: 420, ease: 'Quad.easeOut' });
        await this.wait(500);
        break;
      }
      case 'death': {
        const v = this.views.get(e.uid);
        if (!v) break;
        this.views.delete(e.uid);
        if (v.root.alpha > 0.05) await this.fx.destroy(v);
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
        this.ring(v.root.x, v.root.y, u.side === 'player' ? 0x5fe3ff : COL.enemy);
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
      const color = pilot ? 0x7fe9ff : COL.enemyShot;
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
          this.fx.fire(Tv.root.x, Tv.root.y - 14, 8);
          this.fx.smoke(Tv.root.x, Tv.root.y - 14, 3);
          this.fx.ring(Tv.root.x, Tv.root.y, 0xffc46a, 0.9);
          this.cameras.main.shake(this.ms(120), 0.0026);
        } else {
          await this.wait(A.frames('attack') > 1 ? 230 : 90);
          const kind = w.shot ?? 'pulse';
          const m = A.muzzle();
          const to = Tv.center();
          // 後座力：機體往射擊的反方向頓一下
          const back = RECOIL[kind] * (to.x >= m.x ? -1 : 1);
          if (back) this.tweens.add({ targets: A.sprite, x: { from: back, to: 0 }, duration: this.ms(220), ease: 'Quad.easeOut' });
          await this.shots.fire(kind, m, to, { color, power: e.kind === 'skill' });
        }
      }
    }
    // 命中
    sfx('hit');
    Tv.flash();
    if (!e.killed) Tv.hit();
    Tv.refresh(e.hp);
    const at = Tv.center();
    this.blast(at.x, at.y, 0xffffff, 0.45);
    // 火花順著射擊方向噴出去
    const from = A?.center();
    this.fx.hit(at.x, at.y, from ? Phaser.Math.RadToDeg(Math.atan2(at.y - from.y, at.x - from.x)) : -90, e.dmg >= 30);
    this.number(Tv, `-${e.dmg}`, Tv.unit.side === 'player' ? COL.hurt : '#ffe45a', e.killed);
    this.modTags(Tv, e);
    await this.wait(anim ? 380 : 220);
    if (A && anim && A.unit.alive) A.play('idle');
  }

  /** 傷害數字旁邊的小標籤：背襲、側擊、高低差 */
  private modTags(v: UnitView, e: Extract<BattleEvent, { t: 'attack' }>): void {
    const flank = e.mods.find((m) => m.kind === 'flank');
    const height = e.mods.find((m) => m.kind === 'height' && m.value > 0);
    const cover = e.mods.find((m) => m.kind === 'cover');
    const label = flank ? (flank.rear ? T('mod_flank_back') : T('mod_flank_side')) : height ? T('mod_height') : cover ? T('mod_cover') : '';
    if (!label) return;
    const c = v.center();
    const t = addText(this, c.x, c.y - v.tall * 0.5 - 44, label, { size: worldPx(15), raw: true, color: cover && !flank && !height ? '#9fb4c8' : '#ffa53a' })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH + 2);
    this.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: this.ms(900), delay: 200, onComplete: () => t.destroy() });
  }

  private number(v: UnitView, text: string, color: string, big = false): void {
    const c = v.center();
    const t = addText(this, c.x, c.y - v.tall * 0.5 - 12, text, { size: worldPx(big ? 34 : 26), raw: true, color, strokeW: 5 })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH + 3)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: this.ms(820), delay: 320, onComplete: () => t.destroy() });
  }

  private callout(v: UnitView, text: string, tint: number): void {
    const c = v.center();
    const t = addText(this, c.x, c.y - v.tall * 0.5 - 30, text, { size: worldPx(18), raw: true, color: `#${tint.toString(16).padStart(6, '0')}`, strokeW: 4 })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH + 2);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: this.ms(900), delay: 380, onComplete: () => t.destroy() });
  }

  /** 技能特寫時鏡頭往前推一點；這一串演出播完再退回來（見 play） */
  private punchIn(): void {
    if (this.zoomBack !== null) return;
    this.zoomBack = this.zoom;
    this.tweens.add({ targets: this, zoom: Math.min(1.8, this.zoom * 1.14), duration: this.ms(200), ease: 'Quad.easeOut', onUpdate: () => this.applyCamera() });
  }

  /** 曲射：砲彈走拋物線 */
  private lob(a: Phaser.Math.Vector2, c: Phaser.Math.Vector2): Promise<void> {
    const s = this.add.image(a.x, a.y, 'glow').setTint(0xffa53a).setScale(0.3).setDepth(FX_DEPTH);
    const peak = Math.min(a.y, c.y) - 150;
    let puff = 0;
    return new Promise((ok) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.ms(520),
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          s.x = Phaser.Math.Linear(a.x, c.x, k);
          s.y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * peak + k * k * c.y;
          if (++puff % 3 === 0) this.fx.trail(s.x, s.y);
        },
        onComplete: () => {
          s.destroy();
          ok();
        },
      });
    });
  }

  /** 近戰：兩道弧形的爪痕 */
  private slash(v: UnitView): void {
    const c = v.center();
    const g = this.add.graphics().setDepth(FX_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    for (const [r, w, color, from] of [
      [30, 6, 0xffffff, -2.5],
      [21, 4, 0xff6a5a, -2.3],
    ]) {
      g.lineStyle(w, color, 1);
      g.beginPath();
      g.arc(c.x - 6, c.y + 8, r, from, from + 1.9);
      g.strokePath();
    }
    this.fx.sparks(c.x, c.y, 45, 0xffd27a, 6, 60);
    this.tweens.add({ targets: g, alpha: 0, duration: this.ms(260), onComplete: () => g.destroy() });
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

  // ───────── 結束 ─────────

  private async finish(result: 'win' | 'lose', reason: string): Promise<void> {
    this.mode = 'busy';
    // 打完了：沒有可以接著打的東西
    clearSuspend();
    this.clearMarks();
    this.hud.refresh();
    await this.wait(500);
    // 零件只發「這次新拿到的星」：重打同一關不會重複領
    let parts = 0;
    if (result === 'win') {
      sfx('win');
      if (this.mission.outro) await this.say(this.mission.outro);
      const stars = this.battle.stars();
      const sv = save();
      const before = sv.stars[this.mission.id] ?? 0;
      sv.stars[this.mission.id] = Math.max(before, stars);
      parts = missionParts(this.mission, sv.stars[this.mission.id]) - missionParts(this.mission, before);
      persist();
    } else {
      sfx('lose');
    }
    // 過關那一刻才算的成就，和拿到星之後才成立的（章節、星數）
    this.collect(winFeats(this.battle));
    this.hud.showResult(result, reason, parts, this.feats);
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

  leave(to: 'missions' | 'next' | 'hangar'): void {
    const next = to === 'next' ? this.nextMission() : null;
    this.scene.stop('SfHud');
    this.scene.stop('SfDialogue');
    if (next) this.scene.restart({ missionId: next });
    else if (to === 'hangar') this.scene.start('SfHangar', { chapter: this.mission.chapter });
    else this.scene.start('SfMissions', { chapter: this.mission.chapter });
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
