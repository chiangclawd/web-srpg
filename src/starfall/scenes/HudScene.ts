// 戰鬥介面：任務目標、單位資訊卡、行動按鈕、預估面板、回合提示、結算與選單。
// 四個角各一個容器，手機上整組放大（uiZoom），文字跟著容器一起放大。
import Phaser from 'phaser';
import { COL, TEX, VIEW_H, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { sfx } from '../audio';
import { L, T } from '../i18n';
import type { StrKey } from '../i18n';
import { persist, save } from '../save';
import { missionById } from '../data/missions';
import { SPEAKERS } from '../data/story';
import type { Speaker } from '../data/story';
import type { Mod, Side, Unit } from '../sim/types';
import { SHEETS, frameName } from '../view/sheets';
import { TH, TW, isoX, isoY } from '../view/iso';
import { Button, KeyNav, drawPanel } from '../view/ui';
import type { BattleScene } from './BattleScene';

type Box = Phaser.GameObjects.Container;

const BTN_W = 208;
const BTN_H = 50;
const GAP = 8;
/** 小地圖（大地圖才有）：面板大小與內距 */
const MINI_W = 176;
const MINI_H = 92;
const MINI_PAD = 8;

export class HudScene extends Phaser.Scene {
  private battle!: BattleScene;
  private tl!: Box;
  private tr!: Box;
  private bl!: Box;
  private br!: Box;
  private tc!: Box;
  private tipBox!: Box;
  /** 小地圖：左上任務面板下面。miniS 是世界座標 → 小地圖的縮放，miniO 是位移 */
  private ml!: Box;
  private miniDyn: Phaser.GameObjects.Graphics | null = null;
  private miniBtn: Button | null = null;
  private miniS = 0;
  private miniO = new Phaser.Math.Vector2();
  private modal: Box | null = null;
  private w = 1280;
  private z = 1;
  private tipKey: StrKey | null = null;
  /** 快捷鍵 → 目前畫面上的行動按鈕（每次重畫都重新登記） */
  private actions = new Map<string, Button>();
  /** 開著的是選單（Esc 可以關掉）；結算畫面不行 */
  private menuOpen = false;
  /** 對話框打開時鍵盤焦點先停在哪一顆 */
  private modalFirst: Button | null = null;

  constructor() {
    super('SfHud');
  }

  init(data: { battle: BattleScene }): void {
    this.battle = data.battle;
    this.modal = null;
    this.tipKey = null;
    this.miniDyn = null;
    this.miniBtn = null;
    this.actions = new Map();
    this.menuOpen = false;
    this.modalFirst = null;
  }

  create(): void {
    setupCamera(this);
    this.w = viewW(this);
    // 手機上整組放大，但留多一點畫面給地圖（最多 1.4 倍；預估面板 1.25 倍）
    this.z = Math.min(uiZoom(), 1.4);
    const z = this.z;
    this.tl = this.add.container(12, 10).setScale(z);
    this.tr = this.add.container(this.w - 12, 10).setScale(z);
    this.bl = this.add.container(12, VIEW_H - 10).setScale(z);
    this.br = this.add.container(this.w - 12, VIEW_H - 10).setScale(z);
    this.tc = this.add.container(this.w / 2, 10).setScale(Math.min(z, 1.25));
    this.tipBox = this.add.container(this.w / 2, VIEW_H - 14).setScale(z).setDepth(40);
    this.ml = this.add.container(12, 10 + 118 * z).setScale(Math.min(z, 1.15));
    if (this.battle.big) this.buildMini();
    this.tr.add(new Button(this, -28, 28, 56, 56, '', () => this.openMenu(), { icon: 'ic_menu', key: 'Esc' }));
    // 鍵盤：對話框（選單、結算）開著的時候，方向鍵在裡面的按鈕之間移動；沒開的時候由戰場自己處理按鍵
    new KeyNav(this, {
      scope: () => this.modal,
      enabled: () => !!this.modal && !this.scene.isActive('SfSettings'),
      onBack: () => {
        if (this.menuOpen) this.closeModal();
      },
      first: () => this.modalFirst,
    });
    void this.battle.hudReady(this);
  }

  setVisible(v: boolean): void {
    for (const c of [this.tl, this.tr, this.bl, this.br, this.tc, this.tipBox, this.ml]) c.setVisible(v);
  }

  // ───────── 每次狀態改變重畫 ─────────

  refresh(): void {
    if (!this.tl) return;
    this.drawTop();
    this.drawCard();
    this.drawActions();
    this.drawForecast();
    this.drawMiniButton();
  }

  // ───────── 小地圖（大地圖才有）─────────

  /** 底圖只畫一次：每格一個小菱形，高的格子比較亮，不能走的比較暗 */
  private buildMini(): void {
    const bs = this.battle;
    const b = bs.battle;
    const r = bs.mapBounds;
    const s = Math.min((MINI_W - MINI_PAD * 2) / r.width, (MINI_H - MINI_PAD * 2) / r.height);
    this.miniS = s;
    this.miniO.set((MINI_W - r.width * s) / 2 - r.left * s, (MINI_H - r.height * s) / 2 - r.top * s);
    const g = this.add.graphics();
    drawPanel(g, 0, 0, MINI_W, MINI_H, { alpha: 0.82, cut: 8 });
    const hw = (TW / 2) * s;
    const hh = (TH / 2) * s;
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const id = b.terrainAt(x, y);
        if (id === 'chasm') continue;
        const h = b.heightAt(x, y);
        const cx = this.miniO.x + isoX(x, y) * s;
        const cy = this.miniO.y + isoY(x, y, h) * s;
        g.fillStyle(id === 'wall' || id === 'machine' ? 0x1a2634 : h >= 2 ? 0x7088a0 : h === 1 ? 0x586c82 : 0x425468, 1);
        g.fillPoints([new Phaser.Math.Vector2(cx, cy - hh), new Phaser.Math.Vector2(cx + hw, cy), new Phaser.Math.Vector2(cx, cy + hh), new Phaser.Math.Vector2(cx - hw, cy)], true);
      }
    }
    this.miniDyn = this.add.graphics();
    // 點或拖小地圖：鏡頭移到那個位置
    const zone = this.add.rectangle(0, 0, MINI_W, MINI_H, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    const jump = (lx: number, ly: number): void => bs.lookAt((lx - this.miniO.x) / s, (ly - this.miniO.y) / s);
    zone.on('pointerdown', (_p: Phaser.Input.Pointer, lx: number, ly: number) => jump(lx, ly));
    zone.on('pointermove', (p: Phaser.Input.Pointer, lx: number, ly: number) => {
      if (p.isDown) jump(lx, ly);
    });
    this.ml.add([g, this.miniDyn, zone]);
  }

  /** 小地圖上會動的東西每格重畫：單位的點、目前畫面的框 */
  override update(): void {
    const d = this.miniDyn;
    if (!d || !this.ml.visible) return;
    const bs = this.battle;
    const b = bs.battle;
    const s = this.miniS;
    d.clear();
    const win = b.mission.win;
    const goals = win.type === 'killAll' ? win.tags : win.type === 'kill' ? [win.tag] : [];
    for (const u of b.units) {
      if (!u.alive) continue;
      const cx = this.miniO.x + isoX(u.x, u.y) * s;
      const cy = this.miniO.y + isoY(u.x, u.y, b.heightAt(u.x, u.y)) * s - 1;
      const mine = u.side === 'player';
      // 已經行動完的我方機體變淡，一眼看得出還有誰沒動
      d.fillStyle(mine ? COL.player : COL.enemy, mine && !u.def.structure && b.phase === 'player' && !b.canAct(u) ? 0.4 : 1);
      d.fillCircle(cx, cy, u.def.structure ? 2 : 2.7);
      if (u.tag && goals.includes(u.tag)) d.lineStyle(1.2, 0xffd75a, 1).strokeCircle(cx, cy, 4.4);
      if (bs.sel === u) d.lineStyle(1.2, 0xffffff, 1).strokeCircle(cx, cy, 4.4);
    }
    const v = bs.cameras.main.worldView;
    const x0 = Phaser.Math.Clamp(this.miniO.x + v.x * s, 1, MINI_W - 1);
    const y0 = Phaser.Math.Clamp(this.miniO.y + v.y * s, 1, MINI_H - 1);
    const x1 = Phaser.Math.Clamp(this.miniO.x + v.right * s, 1, MINI_W - 1);
    const y1 = Phaser.Math.Clamp(this.miniO.y + v.bottom * s, 1, MINI_H - 1);
    d.lineStyle(1.2, 0xffffff, 0.85).strokeRect(x0, y0, x1 - x0, y1 - y0);
  }

  /** 小地圖下面的「下一台」：跳到還沒行動的我方機體 */
  private drawMiniButton(): void {
    if (!this.battle.big) return;
    this.miniBtn?.destroy();
    const bs = this.battle;
    const b = bs.battle;
    const n = bs.readyCount();
    const off = n === 0 || bs.mode === 'busy' || bs.mode === 'target' || b.phase !== 'player' || !!b.result;
    this.miniBtn = new Button(this, MINI_W / 2, MINI_H + 8 + 19, MINI_W, 38, T('nextUnit', n), () => bs.nextUnit(), { size: 16, disabled: off, color: 0x8fb0c8 });
    this.ml.add(this.miniBtn);
  }

  private drawTop(): void {
    const b = this.battle.battle;
    const m = this.battle.mission;
    this.tl.removeAll(true);
    const g = this.add.graphics();
    const name = addText(this, 16, 10, L(m.name), { size: 20, raw: true, strokeW: 0 });
    const turn =
      m.win.type === 'survive'
        ? T('turnOf', b.turn, m.win.turns)
        : m.win.type === 'hold'
          ? `${T('turn', b.turn)}　${T('holdProgress', b.held, m.win.turns)}`
          : m.win.type === 'killAll'
            ? `${T('turn', b.turn)}　${T('killProgress', b.killed(), m.win.tags.length)}`
            : T('turn', b.turn);
    const obj = addText(this, 16, 38, `${T('objective')}：${L(m.objective)}`, { size: 15, raw: true, strokeW: 0, color: COL.cyan });
    // 失敗條件：隊長機、保護目標
    // 「毀掉幾個才失敗」的關卡，條件已經寫在目標那一行，這裡只提隊長機
    const guard = (m.protectLose ?? 1) > 1 ? undefined : (m.protect ?? []).map((t) => b.byTag(t)).find((x) => x);
    const fail = addText(this, 16, 60, guard ? T('failProtect', L(guard.def.name)) : T('failLeader'), { size: 13, raw: true, strokeW: 0, color: '#ff8a7a', bold: false });
    const tt = addText(this, 16, 82, b.easy ? `${turn}　${T('easyTag')}` : turn, { size: 15, raw: true, strokeW: 0, color: COL.yellow });
    const w = Math.max(250, name.width + 32, obj.width + 32, fail.width + 32);
    drawPanel(g, 0, 0, w, 110, { alpha: 0.82 });
    this.tl.add([g, name, obj, fail, tt]);
  }

  /** 左下：選取中單位的資訊卡 */
  private drawCard(): void {
    this.bl.removeAll(true);
    const u = this.battle.sel;
    if (!u || !u.alive) return;
    const W = 400;
    const H = 150;
    const enemy = u.side === 'enemy';
    const g = this.add.graphics();
    drawPanel(g, 0, -H, W, H, { line: enemy ? COL.enemy : COL.line, alpha: 0.9 });
    // 擋住點擊，免得點資訊卡變成點到後面的地圖
    const block = this.add.rectangle(W / 2, -H / 2, W, H, 0, 0).setInteractive();
    this.bl.add([g, block]);
    const d = u.def;
    let x = 14;
    const pt = d.pilot ? SPEAKERS[d.pilot as Speaker]?.portrait : undefined;
    if (pt && !enemy) {
      const im = this.add.image(8, 0, pt).setOrigin(0, 1);
      im.setScale(176 / im.height);
      this.bl.add(im);
      x = 8 + im.displayWidth + 6;
    } else if (SHEETS[d.sprite]) {
      // 圖表的格子四周有透明邊：以實際有圖的範圍置中、縮到卡片左側放得下
      const im = this.add.image(60, -H / 2, `sf_${d.sprite}`, frameName(SHEETS[d.sprite], 'idle', false, 0));
      const fr = im.frame;
      im.setOrigin((fr.x + fr.width / 2) / fr.realWidth, (fr.y + fr.height / 2) / fr.realHeight);
      im.setScale(Math.min(100 / fr.width, (H - 20) / fr.height));
      if (d.tint) im.setTint(d.tint);
      this.bl.add(im);
      x = 118;
    } else {
      const im = this.add.image(58, -16, d.sprite).setOrigin(0.5, 104 / 124).setScale(0.9 / TEX);
      this.bl.add(im);
      x = 118;
    }
    const tw = W - x - 12;
    const name = addText(this, x, -H + 10, L(d.name), { size: 21, raw: true, strokeW: 0, color: enemy ? COL.red : COL.text });
    const cls = addText(this, x + name.width + 10, -H + 16, `${L(d.cls)}${u.stun > 0 ? `　${T('stunned')}` : ''}`, { size: 13, raw: true, strokeW: 0, color: COL.dim });
    fitText(cls, tw - name.width - 10);
    // 耐久條
    const bw = tw - 76;
    const k = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);
    const bar = this.add.graphics();
    bar.fillStyle(0x06101c, 1).fillRect(x, -H + 42, bw, 12);
    bar.fillStyle(enemy ? COL.enemy : k > 0.35 ? COL.player : 0xffb03a, 1).fillRect(x + 1, -H + 43, (bw - 2) * k, 10);
    const hp = addText(this, x + bw + 8, -H + 39, `${u.hp}/${u.maxHp}`, { size: 15, raw: true, strokeW: 0 });
    const wpn = d.weapon;
    const stats = d.structure
      ? `${T('armor')} ${d.armor}`
      : `${T('move')} ${d.move}　${T('armor')} ${d.armor}　${L(wpn.name)} ${wpn.dmg}　${T('range')} ${wpn.min === wpn.max ? wpn.max : `${wpn.min}–${wpn.max}`}`;
    const st = fitText(addText(this, x, -H + 62, stats, { size: 14, raw: true, strokeW: 0, color: COL.yellow }), tw);
    this.bl.add([name, cls, bar, hp, st]);
    let y = -H + 84;
    if (d.passive) {
      const p = addText(this, x, y, `${L(d.passive.name)}：${L(d.passive.desc)}`, { size: 13, raw: true, strokeW: 0, color: COL.text, wrap: tw, bold: false, lineSpacing: 2 });
      this.bl.add(p);
      y += p.height + 3;
    }
    if (!d.structure && y < -22) this.bl.add(fitText(addText(this, x, y, this.battle.tileNote(u), { size: 13, raw: true, strokeW: 0, color: COL.dim, bold: false }), tw));
  }

  /** 右下：行動按鈕（由下往上疊） */
  private drawActions(): void {
    this.br.removeAll(true);
    this.actions.clear();
    const bs = this.battle;
    const b = bs.battle;
    if (bs.mode === 'busy' || b.result || b.phase !== 'player') return;
    const list: Button[] = [];
    const x = -BTN_W / 2;
    // key：快捷鍵（小寫）。戰場收到按鍵會來這裡找對應的按鈕按下去，所以按鈕不能按的時候快捷鍵也沒有作用
    const add = (label: string, fn: () => void, o: ConstructorParameters<typeof Button>[7] = {}, key?: string): void => {
      const btn = new Button(this, x, 0, BTN_W, BTN_H, label, fn, { key: key === 'enter' ? 'Enter' : key?.toUpperCase(), ...o });
      if (key) this.actions.set(key, btn);
      list.push(btn);
    };
    const u = bs.sel;
    if (bs.mode === 'target') {
      add(T('confirm'), () => void bs.confirm(), { icon: 'ic_attack', color: 0xffe45a, disabled: !bs.aim, primary: true }, 'enter');
      add(T('cancel'), () => bs.cancelTarget(), { icon: 'ic_undo', color: 0x8fb0c8, key: 'Esc' });
    } else {
      if (u && u.side === 'player' && b.canAct(u)) {
        add(T('attack'), () => bs.beginTarget({ kind: 'attack' }), { icon: 'ic_attack', color: 0xff6a5a, disabled: !b.targets(u).length }, 'a');
        for (const [i, s] of u.def.skills.entries()) {
          const cd = u.cds[s.id] ?? 0;
          const ok = b.skillReady(u, s) && b.skillTargets(u, s).length > 0;
          // 變灰的原因寫在按鈕上：冷卻中，或是躍進這種「走過就不能用」的技能
          const note = cd > 0 ? T('cooldown', cd) : s.effect.type === 'leap' && u.moved ? T('afterMove') : undefined;
          add(L(s.name), () => bs.beginTarget({ kind: 'skill', skill: s }), { icon: s.icon, color: 0xffe45a, disabled: !ok, note }, String(i + 1));
        }
        if (u.def.weapon.kind !== 'indirect') add(T('overwatch'), () => void bs.doOverwatch(), { icon: 'ic_overwatch' }, 'o');
        add(T('wait'), () => void bs.doWait(), { icon: 'ic_wait', color: 0x8fb0c8 }, 'w');
        if (u.undo) add(T('undo'), () => bs.undoMove(), { icon: 'ic_undo', color: 0x8fb0c8 }, 'z');
      }
      add(T('endTurn'), () => void bs.endTurn(), { icon: 'ic_end', color: 0xff9a3c }, 'e');
    }
    // 最後一顆在最下面
    list.reverse().forEach((btn, i) => {
      btn.y = -BTN_H / 2 - i * (BTN_H + GAP);
      this.br.add(btn);
    });
  }

  private modText(m: Mod): string {
    if (m.kind === 'armor') return `${T('mod_armor')} ${m.value}`;
    if (m.kind === 'collide') return `${T('mod_collide')} +${m.value}`;
    const name = m.kind === 'flank' ? (m.rear ? T('mod_flank_back') : T('mod_flank_side')) : T(`mod_${m.kind}` as StrKey);
    return `${name} ${m.value > 0 ? '+' : ''}${m.value}%`;
  }

  /** 上方中央：選目標時的預估 */
  private drawForecast(): void {
    this.tc.removeAll(true);
    const bs = this.battle;
    if (bs.mode !== 'target') return;
    const info = bs.aimInfo();
    if (!info) return;
    const W = 470;
    const f = info.forecast;
    const g = this.add.graphics();
    this.tc.add(g);
    const title = info.target ? `${info.title}  →  ${L(info.target.def.name)}` : info.title;
    this.tc.add(fitText(addText(this, 0, 10, title, { size: 17, raw: true, strokeW: 0, color: COL.yellow }).setOrigin(0.5, 0), W - 30));
    if (!f || !info.target) {
      const note = addText(this, 0, 40, info.note, { size: 15, raw: true, strokeW: 0, wrap: W - 36, align: 'center', bold: false, lineSpacing: 5 }).setOrigin(0.5, 0);
      this.tc.add(note);
      drawPanel(g, -W / 2, 0, W, Math.max(84, note.height + 56), { line: 0xffe45a, alpha: 0.92 });
      return;
    }
    drawPanel(g, -W / 2, 0, W, 128, { line: 0xffe45a, alpha: 0.92 });
    const t = info.target;
    const left = addText(this, -W / 2 + 22, 38, `${T('dmg')} ${f.dmg}`, { size: 26, raw: true, strokeW: 0, color: f.kills ? COL.green : COL.text });
    const hpLine = f.kills ? T('kill') : `${T('hp')} ${t.hp} → ${t.hp - f.dmg}`;
    const hp = addText(this, left.x + left.width + 16, 46, hpLine, { size: 17, raw: true, strokeW: 0, color: f.kills ? COL.green : COL.dim });
    const cTxt = f.counter ? `${T('counter')} ${f.counter.dmg}` : T('noCounter');
    const counter = addText(this, W / 2 - 22, 44, cTxt, { size: 19, raw: true, strokeW: 0, color: f.counter ? (f.counter.kills ? COL.red : COL.orange) : COL.dim }).setOrigin(1, 0);
    const mods = f.mods.map((m) => this.modText(m)).join(' · ');
    const ml = fitText(addText(this, 0, 82, mods || '—', { size: 14, raw: true, strokeW: 0, color: COL.cyan, bold: false }).setOrigin(0.5, 0), W - 30);
    const hint = addText(this, 0, 104, T('pickTarget') === info.note ? info.note : '', { size: 13, raw: true, strokeW: 0, color: COL.dim }).setOrigin(0.5, 0);
    this.tc.add([left, hp, counter, ml, hint]);
  }

  // ───────── 提示 ─────────

  /** 「我方回合 / 機群行動」橫幅 */
  banner(side: Side): Promise<void> {
    const text = side === 'player' ? T('playerPhase') : T('enemyPhase');
    const color = side === 'player' ? COL.player : COL.enemy;
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(0x040a14, 0.78).fillRect(0, VIEW_H / 2 - 44, this.w, 88);
    g.fillStyle(color, 1).fillRect(0, VIEW_H / 2 - 46, this.w, 3);
    g.fillStyle(color, 1).fillRect(0, VIEW_H / 2 + 43, this.w, 3);
    const t = addText(this, this.w / 2, VIEW_H / 2, text, { size: 44, raw: true, color: side === 'player' ? COL.cyan : COL.red, strokeW: 6 })
      .setOrigin(0.5)
      .setDepth(31);
    if (side === 'enemy') sfx('alert');
    const fast = save().fast ? 0.5 : 1;
    g.setAlpha(0);
    t.setAlpha(0).setX(this.w / 2 - 80);
    return new Promise((ok) => {
      this.tweens.add({ targets: g, alpha: 1, duration: 160 * fast });
      this.tweens.add({ targets: t, alpha: 1, x: this.w / 2, duration: 220 * fast, ease: 'Quad.easeOut' });
      this.tweens.add({
        targets: [g, t],
        alpha: 0,
        duration: 220 * fast,
        delay: 760 * fast,
        onComplete: () => {
          g.destroy();
          t.destroy();
          ok();
        },
      });
    });
  }

  /** 畫面上方短暫出現的訊息 */
  /**
   * 技能特寫：一條略斜的橫帶劃過畫面，駕駛員的頭像從一邊滑進來，另一邊是技能名稱。
   * 沒有頭像的機體（無人機）只有名稱。演完自己收掉。
   */
  cutIn(u: Unit, name: string): Promise<void> {
    const mine = u.side === 'player';
    const color = mine ? COL.player : COL.enemy;
    const fast = save().fast ? 0.5 : 1;
    const w = this.w;
    const cy = VIEW_H * 0.37;
    const bh = 150;
    const tilt = -0.045;
    const side = mine ? -1 : 1;
    const box = this.add.container(w / 2, cy).setDepth(32).setRotation(tilt);
    box.add(this.add.rectangle(0, 0, w + 260, bh, 0x040a14, 0.88));
    box.add(this.add.rectangle(0, -bh / 2, w + 260, 3, color));
    box.add(this.add.rectangle(0, bh / 2, w + 260, 3, color));
    // 速度線：往頭像的反方向掃過去
    for (let i = 0; i < 9; i++) {
      const line = this.add.rectangle(Phaser.Math.Between(-w / 2, w / 2), Phaser.Math.Between(-bh / 2 + 10, bh / 2 - 10), Phaser.Math.Between(120, 380), 2, 0xffffff, Phaser.Math.FloatBetween(0.06, 0.2));
      box.add(line);
      this.tweens.add({ targets: line, x: line.x - side * Phaser.Math.Between(260, 520), duration: 900 * fast });
    }
    const pilot = u.def.pilot ? SPEAKERS[u.def.pilot as Speaker] : undefined;
    const slide: { o: Phaser.GameObjects.Image | Phaser.GameObjects.Text; x: number; from: number }[] = [];
    let mask: Phaser.GameObjects.Graphics | null = null;
    if (pilot?.portrait) {
      // 頭像比橫帶高：用跟橫帶一樣的範圍當遮罩，只露出臉那一段
      const im = this.add.image(side * w * 0.29, 0, pilot.portrait).setOrigin(0.5, 0.25).setFlipX(!mine);
      im.setScale(360 / im.height);
      mask = this.make.graphics({}, false);
      mask.setPosition(w / 2, cy).setRotation(tilt);
      mask.fillStyle(0xffffff).fillRect(-w / 2 - 130, -bh / 2 + 3, w + 260, bh - 6);
      im.setMask(mask.createGeometryMask());
      box.add(im);
      slide.push({ o: im, x: im.x, from: im.x + side * 180 });
    }
    const tx = pilot?.portrait ? -side * w * 0.08 : 0;
    const who = addText(this, tx, -40, pilot?.portrait ? `${L(pilot.name)}　${L(u.def.name)}` : L(u.def.name), { size: 22, raw: true, color: COL.dim, strokeW: 4 }).setOrigin(0.5);
    const title = fitText(addText(this, tx, 12, name, { size: 54, raw: true, color: mine ? COL.cyan : COL.red, strokeW: 7 }).setOrigin(0.5), w * 0.5);
    box.add([who, title]);
    slide.push({ o: who, x: tx, from: tx - side * 140 }, { o: title, x: tx, from: tx - side * 140 });
    sfx('select');
    box.setAlpha(0).setScale(1, 0.1);
    for (const p of slide) p.o.x = p.from;
    return new Promise((ok) => {
      this.tweens.add({ targets: box, alpha: 1, scaleY: 1, duration: 120 * fast, ease: 'Quad.easeOut' });
      for (const p of slide) this.tweens.add({ targets: p.o, x: p.x, duration: 240 * fast, ease: 'Cubic.easeOut' });
      this.tweens.add({
        targets: box,
        alpha: 0,
        scaleY: 0.3,
        duration: 150 * fast,
        delay: 700 * fast,
        ease: 'Quad.easeIn',
        onComplete: () => {
          box.destroy(true);
          mask?.destroy();
          ok();
        },
      });
    });
  }

  toast(text: string): void {
    const t = addText(this, this.w / 2, 150, text, { size: 22, color: COL.yellow, strokeW: 5, align: 'center' })
      .setOrigin(0.5)
      .setDepth(32);
    this.tweens.add({ targets: t, y: 136, alpha: 0, duration: 500, delay: 1700, onComplete: () => t.destroy() });
  }

  /** 教學提示（每則只出現一次），點任何地方或下一個動作後收起 */
  showTip(key: StrKey): void {
    const sv = save();
    if (sv.tips.includes(key) || this.modal) return;
    sv.tips.push(key);
    persist();
    this.hideTip();
    this.tipKey = key;
    // 放在左下資訊卡和右下按鈕之間，不要蓋到兩邊
    const left = 12 + 412 * this.z;
    const right = this.w - 12 - (BTN_W + 14) * this.z;
    this.tipBox.setX((left + right) / 2);
    const room = Math.max(260, (right - left) / this.z - 50);
    const txt = addText(this, 0, -16, T(key), { size: 16, raw: true, strokeW: 0, wrap: Math.min(520, room), align: 'center', bold: false }).setOrigin(0.5, 1);
    const W = Math.max(280, txt.width + 44);
    const H = txt.height + 28;
    const g = this.add.graphics();
    drawPanel(g, -W / 2, -H - 2, W, H, { line: 0x6dff9a, alpha: 0.94 });
    this.tipBox.add([g, txt]);
    this.tipBox.setAlpha(0);
    this.tweens.add({ targets: this.tipBox, alpha: 1, duration: 200 });
  }

  hideTip(): void {
    if (!this.tipKey) return;
    this.tipKey = null;
    this.tweens.killTweensOf(this.tipBox);
    this.tipBox.removeAll(true);
  }

  // ───────── 結算 / 選單 ─────────

  private openModal(W: number, H: number, line: number): Box {
    this.closeModal();
    this.hideTip();
    const c = this.add.container(this.w / 2, VIEW_H / 2).setDepth(60);
    const dim = this.add.rectangle(0, 0, this.w * 2, VIEW_H * 2, 0x02060c, 0.72).setInteractive();
    const g = this.add.graphics();
    const z = Math.min(this.z, (VIEW_H - 30) / H);
    const inner = this.add.container(0, 0).setScale(z);
    drawPanel(g, -W / 2, -H / 2, W, H, { line, alpha: 0.96, cut: 18 });
    inner.add(g);
    c.add([dim, inner]);
    this.modal = c;
    return inner;
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
    this.menuOpen = false;
    this.modalFirst = null;
  }

  /** parts：這次新拿到的零件（重打已經拿過的星就是 0） */
  showResult(result: 'win' | 'lose', reason: string, parts = 0): void {
    const bs = this.battle;
    const b = bs.battle;
    const win = result === 'win';
    const W = 580;
    const H = win ? 450 : 360;
    const box = this.openModal(W, H, win ? 0x6dff9a : COL.enemy);
    box.add(addText(this, 0, -H / 2 + 44, win ? T('victory') : T('defeat'), { size: 40, raw: true, color: win ? COL.green : COL.red, strokeW: 6 }).setOrigin(0.5));
    box.add(addText(this, 0, -H / 2 + 86, L(bs.mission.name), { size: 18, raw: true, strokeW: 0, color: COL.dim }).setOrigin(0.5));
    const by = H / 2 - 48;
    if (!win) {
      box.add(addText(this, 0, -H / 2 + 130, T(`lose_${reason}` as StrKey), { size: 20, raw: true, strokeW: 0 }).setOrigin(0.5));
      this.modalFirst = new Button(this, -135, by, 250, 56, T('retry'), () => bs.restart(), { primary: true });
      box.add(this.modalFirst);
      box.add(new Button(this, 135, by, 250, 56, T('toMissions'), () => bs.leave('missions'), { color: 0x8fb0c8 }));
      // 打不過的兩條出路：去機庫改造機體，或改用輕鬆難度
      box.add(new Button(this, b.easy ? 0 : -135, by - 66, b.easy ? 300 : 250, 48, T('hangar'), () => bs.leave('hangar'), { color: 0xffd75a, size: 17, icon: 'ic_parts' }));
      if (!b.easy) {
        box.add(
          new Button(
            this,
            135,
            by - 66,
            250,
            48,
            T('retryEasy'),
            () => {
              save().easy = true;
              persist();
              bs.restart();
            },
            { color: 0x6dff9a, size: 17 },
          ),
        );
      }
      return;
    }
    const got = [true, b.lost === 0, b.thirdStar()];
    const kind = bs.mission.win.type;
    const labels = [T('star1'), T('star2'), kind === 'survive' ? T('star3hp') : kind === 'hold' ? T('star3hold', bs.mission.par) : T('star3par', bs.mission.par)];
    got.forEach((ok, i) => {
      const x = (i - 1) * 86;
      const star = this.add
        .image(x, -H / 2 + 150, 'ic_star')
        .setScale(0)
        .setTint(ok ? 0xffd75a : 0x3a4a5c);
      box.add(star);
      this.tweens.add({ targets: star, scale: 70 / 64 / TEX, duration: 260, delay: 200 + i * 220, ease: 'Back.easeOut', onStart: () => ok && sfx('select') });
      const y = -H / 2 + 212 + i * 28;
      box.add(addText(this, -150, y, ok ? '★' : '☆', { size: 18, raw: true, strokeW: 0, color: ok ? COL.yellow : '#4a5a6c' }).setOrigin(0.5));
      box.add(addText(this, -130, y, labels[i], { size: 17, raw: true, strokeW: 0, color: ok ? COL.text : '#6a7c90', bold: false }).setOrigin(0, 0.5));
    });
    // 零件：這次新拿到的星才有
    const py = -H / 2 + 318;
    if (parts > 0) {
      const t = addText(this, 14, py, T('partsGain', parts), { size: 22, raw: true, strokeW: 0, color: COL.yellow }).setOrigin(0.5);
      const ic = this.add
        .image(t.x - t.width / 2 - 20, py, 'ic_parts')
        .setScale(26 / 64 / TEX)
        .setTint(0xffd75a);
      box.add([t, ic]);
      t.setAlpha(0);
      ic.setAlpha(0);
      this.tweens.add({ targets: [t, ic], alpha: 1, duration: 300, delay: 900, onStart: () => sfx('select') });
    } else {
      box.add(fitText(addText(this, 0, py, T('partsNone'), { size: 15, raw: true, strokeW: 0, color: COL.dim, bold: false }).setOrigin(0.5), W - 40));
    }
    const next = bs.nextMission();
    const hangar = (x: number, w: number): Button => new Button(this, x, by, w, 56, T('hangar'), () => bs.leave('hangar'), { color: 0xffd75a, icon: 'ic_parts' });
    // 主線最後一關（下一關是後日談）和全部的最後一關，多一行完結的話
    const storyEnd = !!next && (bs.mission.chapter ?? 1) === 3 && (missionById(next).chapter ?? 1) > 3;
    const endNote = storyEnd ? T('chapterEnd') : next ? '' : T('epilogueEnd');
    if (endNote) box.add(fitText(addText(this, 0, by - 50, endNote, { size: 15, raw: true, strokeW: 0, color: COL.cyan }).setOrigin(0.5), W - 40));
    if (next) {
      this.modalFirst = new Button(this, -188, by, 180, 56, T('next'), () => bs.leave('next'), { primary: true, color: 0x6dff9a });
      box.add(this.modalFirst);
      box.add(hangar(0, 180));
      box.add(new Button(this, 188, by, 180, 56, T('toMissions'), () => bs.leave('missions'), { color: 0x8fb0c8 }));
    } else {
      box.add(hangar(-135, 250));
      this.modalFirst = new Button(this, 135, by, 250, 56, T('toMissions'), () => bs.leave('missions'), { primary: true });
      box.add(this.modalFirst);
    }
  }

  /** 現在有沒有對話框蓋在上面（選單、結算）：有的話戰場不處理按鍵 */
  get modalOpen(): boolean {
    return !!this.modal;
  }

  /** 鍵盤快捷鍵：按下對應的行動按鈕。沒有這顆就回傳 false */
  hotkey(key: string): boolean {
    const btn = this.actions.get(key);
    if (!btn?.active) return false;
    btn.click();
    return true;
  }

  openMenu(): void {
    if (this.modal) return;
    const bs = this.battle;
    const W = 380;
    const H = 436;
    const box = this.openModal(W, H, COL.line);
    this.menuOpen = true;
    box.add(addText(this, 0, -H / 2 + 36, T('menu'), { size: 26, raw: true, strokeW: 0 }).setOrigin(0.5));
    const rows: [string, () => void, number?][] = [
      [T('resume'), () => this.closeModal()],
      [
        T('settings'),
        () => {
          this.closeModal();
          // 設定頁關掉之後重畫一次：語言、難度的標示可能變了
          this.scene.launch('SfSettings', { onClose: () => this.refresh() });
        },
      ],
      [T('restart'), () => bs.restart(), 0xff9a3c],
      [T('quit'), () => bs.leave('missions'), 0xff6a5a],
    ];
    rows.forEach(([label, fn, color], n) => {
      const btn = new Button(this, 0, -H / 2 + 100 + n * 62, 300, 52, label, fn, { color });
      if (n === 0) this.modalFirst = btn;
      box.add(btn);
    });
    box.add(addText(this, 0, H / 2 - 22, T('menuSaveNote'), { size: 13, raw: true, strokeW: 0, color: COL.dim, bold: false, wrap: W - 50, align: 'center' }).setOrigin(0.5, 1));
  }
}
