// 戰鬥介面：任務目標、單位資訊卡、行動按鈕、預估面板、回合提示、結算與選單。
// 四個角各一個容器，手機上整組放大（uiZoom），文字跟著容器一起放大。
import Phaser from 'phaser';
import { COL, TEX, VIEW_H, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { sfx } from '../audio';
import { L, T } from '../i18n';
import type { StrKey } from '../i18n';
import { persist, save } from '../save';
import { SPEAKERS } from '../data/story';
import type { Speaker } from '../data/story';
import type { Mod, Side } from '../sim/types';
import { SHEETS, frameName } from '../view/sheets';
import { Button, drawPanel } from '../view/ui';
import type { BattleScene } from './BattleScene';

type Box = Phaser.GameObjects.Container;

const BTN_W = 208;
const BTN_H = 50;
const GAP = 8;

export class HudScene extends Phaser.Scene {
  private battle!: BattleScene;
  private tl!: Box;
  private tr!: Box;
  private bl!: Box;
  private br!: Box;
  private tc!: Box;
  private tipBox!: Box;
  private modal: Box | null = null;
  private w = 1280;
  private z = 1;
  private tipKey: StrKey | null = null;

  constructor() {
    super('SfHud');
  }

  init(data: { battle: BattleScene }): void {
    this.battle = data.battle;
    this.modal = null;
    this.tipKey = null;
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
    this.tr.add(new Button(this, -28, 28, 56, 56, '', () => this.openMenu(), { icon: 'ic_menu' }));
    void this.battle.hudReady(this);
  }

  setVisible(v: boolean): void {
    for (const c of [this.tl, this.tr, this.bl, this.br, this.tc, this.tipBox]) c.setVisible(v);
  }

  // ───────── 每次狀態改變重畫 ─────────

  refresh(): void {
    if (!this.tl) return;
    this.drawTop();
    this.drawCard();
    this.drawActions();
    this.drawForecast();
  }

  private drawTop(): void {
    const b = this.battle.battle;
    const m = this.battle.mission;
    this.tl.removeAll(true);
    const g = this.add.graphics();
    const name = addText(this, 16, 10, L(m.name), { size: 20, raw: true, strokeW: 0 });
    const turn = m.win.type === 'survive' ? T('turnOf', b.turn, m.win.turns) : T('turn', b.turn);
    const obj = addText(this, 16, 38, `${T('objective')}：${L(m.objective)}`, { size: 15, raw: true, strokeW: 0, color: COL.cyan });
    // 失敗條件：隊長機、保護目標
    const guard = (m.protect ?? []).map((t) => b.byTag(t)).find((x) => x);
    const fail = addText(this, 16, 60, guard ? T('failProtect', L(guard.def.name)) : T('failLeader'), { size: 13, raw: true, strokeW: 0, color: '#ff8a7a', bold: false });
    const tt = addText(this, 16, 82, turn, { size: 15, raw: true, strokeW: 0, color: COL.yellow });
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
      const im = this.add.image(58, -18, `sf_${d.sprite}`, frameName(SHEETS[d.sprite], 'idle', false, 0)).setOrigin(0.5, 0.82);
      im.setScale(Math.min(1.1, 96 / (SHEETS[d.sprite].unitPx * 1.1)) * (d.scale && d.scale > 1 ? 1 : 1));
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
    const bs = this.battle;
    const b = bs.battle;
    if (bs.mode === 'busy' || b.result || b.phase !== 'player') return;
    const list: Button[] = [];
    const x = -BTN_W / 2;
    const add = (label: string, fn: () => void, o: ConstructorParameters<typeof Button>[7] = {}): void => {
      list.push(new Button(this, x, 0, BTN_W, BTN_H, label, fn, o));
    };
    const u = bs.sel;
    if (bs.mode === 'target') {
      add(T('confirm'), () => void bs.confirm(), { icon: 'ic_attack', color: 0xffe45a, disabled: !bs.aim, primary: true });
      add(T('cancel'), () => bs.cancelTarget(), { icon: 'ic_undo', color: 0x8fb0c8 });
    } else {
      if (u && u.side === 'player' && b.canAct(u)) {
        add(T('attack'), () => bs.beginTarget({ kind: 'attack' }), { icon: 'ic_attack', color: 0xff6a5a, disabled: !b.targets(u).length });
        for (const s of u.def.skills) {
          const cd = u.cds[s.id] ?? 0;
          const ok = cd === 0 && b.skillTargets(u, s).length > 0;
          add(L(s.name), () => bs.beginTarget({ kind: 'skill', skill: s }), { icon: s.icon, color: 0xffe45a, disabled: !ok, note: cd > 0 ? T('cooldown', cd) : undefined });
        }
        if (u.def.weapon.kind !== 'indirect') add(T('overwatch'), () => void bs.doOverwatch(), { icon: 'ic_overwatch' });
        add(T('wait'), () => void bs.doWait(), { icon: 'ic_wait', color: 0x8fb0c8 });
        if (u.undo) add(T('undo'), () => bs.undoMove(), { icon: 'ic_undo', color: 0x8fb0c8 });
      }
      add(T('endTurn'), () => void bs.endTurn(), { icon: 'ic_end', color: 0xff9a3c });
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
    const name = m.kind === 'flank' ? (m.value >= 30 ? T('mod_flank_back') : T('mod_flank_side')) : T(`mod_${m.kind}` as StrKey);
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
    const H = f ? 128 : 84;
    const g = this.add.graphics();
    drawPanel(g, -W / 2, 0, W, H, { line: 0xffe45a, alpha: 0.92 });
    this.tc.add(g);
    const title = info.target ? `${info.title}  →  ${L(info.target.def.name)}` : info.title;
    this.tc.add(fitText(addText(this, 0, 10, title, { size: 17, raw: true, strokeW: 0, color: COL.yellow }).setOrigin(0.5, 0), W - 30));
    if (!f || !info.target) {
      this.tc.add(fitText(addText(this, 0, 42, info.note, { size: 18, raw: true, strokeW: 0 }).setOrigin(0.5, 0), W - 30));
      return;
    }
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
  }

  showResult(result: 'win' | 'lose', reason: string): void {
    const bs = this.battle;
    const b = bs.battle;
    const win = result === 'win';
    const W = 560;
    const H = win ? 400 : 300;
    const box = this.openModal(W, H, win ? 0x6dff9a : COL.enemy);
    box.add(addText(this, 0, -H / 2 + 44, win ? T('victory') : T('defeat'), { size: 40, raw: true, color: win ? COL.green : COL.red, strokeW: 6 }).setOrigin(0.5));
    box.add(addText(this, 0, -H / 2 + 86, L(bs.mission.name), { size: 18, raw: true, strokeW: 0, color: COL.dim }).setOrigin(0.5));
    const by = H / 2 - 48;
    if (!win) {
      box.add(addText(this, 0, -14, T(`lose_${reason}` as StrKey), { size: 20, raw: true, strokeW: 0 }).setOrigin(0.5));
      box.add(new Button(this, -130, by, 230, 56, T('retry'), () => bs.restart(), { primary: true }));
      box.add(new Button(this, 130, by, 230, 56, T('toMissions'), () => bs.leave('missions'), { color: 0x8fb0c8 }));
      return;
    }
    const got = [true, b.lost === 0, b.thirdStar()];
    const labels = [T('star1'), T('star2'), bs.mission.win.type === 'survive' ? T('star3hp') : T('star3par', bs.mission.par)];
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
    const next = bs.nextMission();
    if (next) {
      box.add(new Button(this, -130, by, 230, 56, T('next'), () => bs.leave('next'), { primary: true, color: 0x6dff9a }));
      box.add(new Button(this, 130, by, 230, 56, T('toMissions'), () => bs.leave('missions'), { color: 0x8fb0c8 }));
    } else {
      box.add(fitText(addText(this, 0, by - 52, T('chapterEnd'), { size: 15, raw: true, strokeW: 0, color: COL.cyan }).setOrigin(0.5), W - 40));
      box.add(new Button(this, 0, by, 260, 56, T('toMissions'), () => bs.leave('missions'), { primary: true }));
    }
  }

  private openMenu(): void {
    if (this.modal) return;
    const bs = this.battle;
    const sv = save();
    const W = 380;
    const H = 420;
    const box = this.openModal(W, H, COL.line);
    box.add(addText(this, 0, -H / 2 + 36, T('menu'), { size: 26, raw: true, strokeW: 0 }).setOrigin(0.5));
    const rows: [string, () => void, number?][] = [
      [T('resume'), () => this.closeModal()],
      [
        T('sound', sv.sfx > 0 ? T('on') : T('off')),
        () => {
          sv.sfx = sv.sfx > 0 ? 0 : 0.7;
          persist();
          this.closeModal();
          this.openMenu();
        },
      ],
      [
        T('speed', sv.fast ? T('fast') : T('normal')),
        () => {
          sv.fast = !sv.fast;
          persist();
          this.closeModal();
          this.openMenu();
        },
      ],
      [T('restart'), () => bs.restart(), 0xff9a3c],
      [T('quit'), () => bs.leave('missions'), 0xff6a5a],
    ];
    rows.forEach(([label, fn, color], i) => box.add(new Button(this, 0, -H / 2 + 100 + i * 62, 300, 52, label, fn, { color })));
  }
}
