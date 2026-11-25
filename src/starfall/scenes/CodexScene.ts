// 圖鑑・成就：從標題畫面進來。兩個分頁，版面一樣 —— 左邊一格一格的方塊，右邊是選中那一個的說明。
// 圖鑑：每種機體與設施一格，遇過的才看得到內容（沒遇過的是黑色剪影）。成就：每個一格，達成的亮起來。
// 哪些遇過、哪些達成，規則在 records.ts；這裡只管畫。跟機庫一樣整個畫面排在一個容器裡再照 uiZoom 放大。
import Phaser from 'phaser';
import { COL, TEX, VIEW_H, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { music, sfx } from '../audio';
import { L, T } from '../i18n';
import type { StrKey } from '../i18n';
import { save } from '../save';
import { FEATS } from '../data/achievements';
import type { FeatDef } from '../data/achievements';
import { CODEX } from '../data/codex';
import type { CodexEntry, Faction } from '../data/codex';
import { MISSIONS } from '../data/missions';
import { SPEAKERS } from '../data/story';
import type { Speaker } from '../data/story';
import { UNITS } from '../data/units';
import { earnedFeats, featProgress, firstMission, seenUnits } from '../records';
import type { UnitDef } from '../sim/types';
import { SHEETS, frameName } from '../view/sheets';
import { Button, KeyNav, drawPanel, registerNav, unregisterNav } from '../view/ui';
import type { NavItem } from '../view/ui';

const PAD = 14;
const TOP = 60;
const GAP = 6;
const GOLD = 0xffd75a;
/** 圖鑑用的機體圖集（scripts/art/starfall-codex.mjs）：每種機體一格，進這個畫面才載入 */
const ATLAS = 'sf_codex';
/** 方塊的邊框顏色：照陣營分。不跟著色盲配色換，所以敵方兩個陣營用紅和淡金，亮度差得夠多 */
const FACTION_COL: Record<Faction, number> = { squad: 0x3fd6ff, swarm: 0xff7a6a, directorate: 0xf0d27a, site: 0x9fb4c8 };
/** 有人坐在裡面的機體才寫駕駛員（艾可和領唱者自己就是那台機器） */
const HUMAN = ['kai', 'bruno', 'vey', 'sparrow', 'hale', 'varga'];
/** 畫面上最高的機體大約這麼高（邏輯像素）：圖鑑裡的大小照這個比例收斂，小無人機不會跟首領一樣大，也不會小到看不清楚 */
const TALLEST = 130;

type Tab = 'codex' | 'feats';

export class CodexScene extends Phaser.Scene {
  // 記在場景物件上：旋轉手機或縮放視窗會重開場景，不該跳回第一格
  private tab: Tab = 'codex';
  private unit = CODEX[0].id;
  private feat = FEATS[0].id;
  private root!: Phaser.GameObjects.Container;
  private W = 1280;
  private H = 720;

  constructor() {
    super('SfCodex');
  }

  preload(): void {
    if (this.textures.exists(ATLAS)) return;
    this.load.atlas(ATLAS, 'assets/starfall/codex.webp', 'assets/starfall/codex.json');
    const t = addText(this, this.scale.width / 2, this.scale.height / 2, T('loading'), { size: 22 * (this.scale.height / VIEW_H), raw: true, color: '#8fb0c8' }).setOrigin(0.5);
    this.load.once('complete', () => t.destroy());
  }

  create(): void {
    setupCamera(this);
    music('title');
    const w = viewW(this);
    const z = uiZoom();
    this.W = w / z;
    this.H = VIEW_H / z;
    const bg = this.add.image(w / 2, VIEW_H / 2, 'bg_hull');
    bg.setScale(Math.max(w / bg.width, VIEW_H / bg.height));
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x040a14, 0.74);
    this.root = this.add.container(0, 0).setScale(z);
    this.draw();
    new KeyNav(this, { onBack: () => this.scene.start('SfTitle') });
  }

  private put<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.root.add(o);
    return o;
  }

  private text(x: number, y: number, s: string, size: number, color: string = COL.text, bold = true, wrap?: number): Phaser.GameObjects.Text {
    return this.put(addText(this, x, y, s, { size, raw: true, strokeW: 0, color, bold, wrap, lineSpacing: 3 }));
  }

  private draw(): void {
    this.root.removeAll(true);
    const sv = save();
    const seen = seenUnits(sv);
    const earned = earnedFeats(sv);
    const { W, H } = this;
    // 上方：返回、標題、兩個分頁（上面寫進度）
    this.put(new Button(this, PAD + 62, 32, 124, 44, T('back'), () => this.scene.start('SfTitle'), { color: 0x8fb0c8 }));
    const title = this.text(PAD + 140, 32, T('records'), 26).setOrigin(0, 0.5);
    const tabW = Math.min(210, (W - PAD - (title.x + title.width + 16) - 8) / 2);
    const tabs: [Tab, string][] = [
      ['codex', T('codexTab', seen.size, CODEX.length)],
      ['feats', T('featsTab', earned.size, FEATS.length)],
    ];
    tabs.forEach(([id, label], i) => {
      const on = id === this.tab;
      const b = new Button(
        this,
        W - PAD - tabW / 2 - (tabs.length - 1 - i) * (tabW + 8),
        32,
        tabW,
        44,
        label,
        () => {
          if (on) return;
          this.tab = id;
          this.draw();
        },
        { color: on ? COL.line : 0x8fb0c8, primary: on, size: 17 },
      );
      this.put(b);
    });
    // 左邊的方塊、右邊的說明
    const DW = Phaser.Math.Clamp(W * 0.4, 330, 470);
    const gw = W - PAD * 2 - DW - 10;
    const gh = H - TOP - PAD;
    const dx = PAD + gw + 10;
    if (this.tab === 'codex') {
      this.grid(CODEX.length, 7, gw, gh, (i, x, y, w, h) => this.unitTile(CODEX[i], seen.has(CODEX[i].id), x, y, w, h));
      const e = CODEX.find((c) => c.id === this.unit) ?? CODEX[0];
      this.unitDetail(e, seen.has(e.id), dx, TOP, DW, gh);
    } else {
      this.grid(FEATS.length, 5, gw, gh, (i, x, y, w, h) => this.featTile(FEATS[i], earned.has(FEATS[i].id), x, y, w, h));
      const f = FEATS.find((c) => c.id === this.feat) ?? FEATS[0];
      this.featDetail(f, earned.has(f.id), dx, TOP, DW, gh);
    }
  }

  /** 把 n 個方塊排成 cols 欄，剛好填滿 (gw, gh) */
  private grid(n: number, cols: number, gw: number, gh: number, cell: (i: number, x: number, y: number, w: number, h: number) => void): void {
    const rows = Math.ceil(n / cols);
    const w = (gw - GAP * (cols - 1)) / cols;
    const h = (gh - GAP * (rows - 1)) / rows;
    for (let i = 0; i < n; i++) cell(i, PAD + (i % cols) * (w + GAP), TOP + Math.floor(i / cols) * (h + GAP), w, h);
  }

  /** 方塊的底、點擊和鍵盤焦點。回傳之後內容畫在上面 */
  private tile(x: number, y: number, w: number, h: number, on: boolean, line: number, pick: () => void): void {
    const g = this.put(this.add.graphics());
    drawPanel(g, x, y, w, h, { fill: on ? 0x123a52 : COL.panel, alpha: on ? 0.96 : 0.84, line, cut: 8 });
    const hit = this.put(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0).setInteractive({ useHandCursor: true }));
    const click = (): void => {
      if (on) return;
      sfx('click');
      pick();
      this.draw();
    };
    hit.on('pointerup', click);
    const ring = this.put(this.add.graphics()).setVisible(false);
    ring.lineStyle(2.5, 0xffffff, 0.95).strokeRect(x - 3, y - 3, w + 6, h + 6);
    const item: NavItem = {
      navActive: () => hit.active,
      navPos: () => {
        const m = hit.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
      },
      setFocus: (v) => void (ring.active && ring.setVisible(v)),
      click,
      within: (c) => c === this.root,
    };
    registerNav(this, item);
    hit.once('destroy', () => unregisterNav(this, item));
  }

  // ───────── 圖鑑 ─────────

  /**
   * 機體的圖：圖集裡的那一格。圖集沒載到的話，已經載入的機體圖表（我方六台開機就有）拿第一格頂著；
   * 程序繪圖的發電機用它自己的紋理；都沒有就不畫。縮到 (bw, bh) 放得下，再照機體的實際大小收斂一點。
   */
  private unitImage(def: UnitDef, x: number, y: number, bw: number, bh: number, known: boolean): Phaser.GameObjects.Image | null {
    const sheet = `sf_${def.sprite}`;
    const im =
      this.textures.exists(ATLAS) && this.textures.get(ATLAS).has(def.sprite)
        ? this.add.image(x, y, ATLAS, def.sprite)
        : SHEETS[def.sprite] && this.textures.exists(sheet)
          ? this.add.image(x, y, sheet, frameName(SHEETS[def.sprite], 'idle', false, 0))
          : this.textures.exists(def.sprite)
            ? this.add.image(x, y, def.sprite)
            : null;
    if (!im) return null;
    // 圖表的格子四周裁掉了透明邊：以實際有圖的範圍置中（圖集和程序繪圖的沒有裁，算出來就是正中間）
    const fr = im.frame;
    im.setOrigin((fr.x + fr.width / 2) / fr.realWidth, (fr.y + fr.height / 2) / fr.realHeight);
    const tall = ((SHEETS[def.sprite]?.h ?? 92) * (def.scale ?? 1)) / TALLEST;
    im.setScale(Math.min(bw / fr.width, bh / fr.height) * (0.58 + 0.42 * Math.min(1, tall)));
    // 沒遇過：只看得到輪廓（比底色亮一點點，不然整格是黑的）
    if (!known) im.setTint(0x1d2b3b);
    else if (def.tint) im.setTint(def.tint);
    return this.put(im);
  }

  private unitTile(e: CodexEntry, known: boolean, x: number, y: number, w: number, h: number): void {
    const on = e.id === this.unit;
    const def = UNITS[e.id];
    const col = FACTION_COL[e.faction];
    this.tile(x, y, w, h, on, known ? col : 0x2c3a4c, () => (this.unit = e.id));
    // 名字貼著底邊；長的（英文的設施名）折成兩行，還是太高才縮小。圖放在剩下的空間中間
    const name = this.text(x + w / 2, y + h - 4, known ? L(def.name) : '？？？', 14, known ? (on ? COL.text : '#c4d6e6') : '#6a7c90', true, w - 6).setOrigin(0.5, 1).setAlign('center');
    if (name.height > 38) name.setScale(38 / name.height);
    const nh = name.displayHeight + 6;
    this.unitImage(def, x + w / 2, y + (h - nh) / 2 + 2, w - 10, h - nh - 8, known);
  }

  private unitDetail(e: CodexEntry, known: boolean, x: number, y: number, w: number, h: number): void {
    const def = UNITS[e.id];
    const col = FACTION_COL[e.faction];
    const hex = `#${col.toString(16).padStart(6, '0')}`;
    const g = this.put(this.add.graphics());
    drawPanel(g, x, y, w, h, { alpha: 0.92, cut: 16, line: known ? col : COL.lineDim });
    if (!known) {
      this.unitImage(def, x + w / 2, y + h * 0.36, w * 0.5, h * 0.4, false);
      this.text(x + w / 2, y + h * 0.64, '？？？', 26, '#6a7c90').setOrigin(0.5);
      this.text(x + w / 2, y + h * 0.64 + 34, T('codexLocked'), 17, COL.dim).setOrigin(0.5);
      this.text(x + w / 2, y + h * 0.64 + 60, T('codexLockedHint'), 14, '#6a7c90', false, w - 40).setOrigin(0.5, 0).setAlign('center');
      return;
    }
    // 標頭：圖、名稱、機型、陣營
    const hh = 104;
    const glow = this.put(this.add.image(x + 58, y + hh / 2 + 22, 'glow').setTint(col).setAlpha(0.22));
    glow.setScale(1.3, 0.5);
    this.unitImage(def, x + 58, y + hh / 2 + 2, 96, hh - 10, true);
    const tx = x + 116;
    const tw = w - 116 - 14;
    fitText(this.text(tx, y + 12, L(def.name), 24), tw);
    fitText(this.text(tx, y + 44, L(def.cls), 15, COL.dim, false), tw);
    const pilot = def.pilot && HUMAN.includes(def.pilot) ? SPEAKERS[def.pilot as Speaker] : undefined;
    const tags = [T(`faction_${e.faction}` as StrKey), ...(def.boss ? [T('codexBoss')] : []), ...(pilot ? [T('codexPilot', L(pilot.name))] : [])];
    fitText(this.text(tx, y + 68, tags.join('　'), 15, hex), tw);
    // 數值：照實際寬度往右排，放不下就整列縮小
    const row = (ry: number, parts: [string, string][]): void => {
      const c = this.put(this.add.container(x + 16, ry));
      let sx = 0;
      for (const [k, v] of parts) {
        const kt = addText(this, sx, 0, k, { size: 14, raw: true, strokeW: 0, color: COL.dim, bold: false }).setOrigin(0, 0.5);
        c.add(kt);
        if (kt.width) sx += kt.width + 6;
        const vt = addText(this, sx, 0, v, { size: 17, raw: true, strokeW: 0 }).setOrigin(0, 0.5);
        c.add(vt);
        sx += vt.width + 18;
      }
      c.setScale(Math.min(1, (w - 32) / Math.max(1, sx - 18)));
    };
    let fy = y + hh + 20;
    row(fy, [
      [T('statHp'), String(def.hp)],
      [T('statArmor'), String(def.armor)],
      [T('statMove'), String(def.move)],
    ]);
    fy += 26;
    const wp = def.weapon;
    if (wp.dmg > 0) {
      row(fy, [
        ['', L(wp.name)],
        [T('statDmg'), String(wp.dmg)],
        [T('statRange'), wp.min === wp.max ? String(wp.max) : `${wp.min}–${wp.max}`],
        ['', T(`weapon_${wp.kind}` as StrKey)],
      ]);
      fy += 26;
    }
    const sepLine = this.put(this.add.graphics());
    sepLine.lineStyle(1, COL.lineDim, 0.9).lineBetween(x + 14, fy - 6, x + w - 14, fy - 6);
    // 技能、被動、介紹、第一次出現的任務：一段一段往下排；放不下（小螢幕、英文）就整塊縮小
    const flow = this.put(this.add.container(x + 16, fy + 4));
    const fw = w - 32;
    let ty = 0;
    const para = (s: string, size: number, color: string, bold = false): void => {
      const t = addText(this, 0, ty, s, { size, raw: true, strokeW: 0, color, bold, wrap: fw, lineSpacing: 3 });
      flow.add(t);
      ty += t.height + 8;
    };
    const sep = L({ zh: '：', en: ': ' });
    for (const s of def.skills) para(`${L(s.name)}${sep}${L(s.desc)}`, 15, COL.cyan);
    if (def.passive) para(`${L(def.passive.name)}${sep}${L(def.passive.desc)}`, 15, COL.yellow);
    para(L(e.note), 15, COL.text);
    const first = firstMission(e.id);
    if (first >= 0) para(T('codexFirst', first + 1, L(MISSIONS[first].name)), 14, COL.dim);
    const room = y + h - 10 - (fy + 4);
    if (ty - 8 > room) flow.setScale(Math.max(0.6, room / (ty - 8)));
    // 下面還有空（桌機、平板）：放駕駛員的立繪，貼著面板的底
    const pt = def.pilot ? SPEAKERS[def.pilot as Speaker]?.portrait : undefined;
    const free = room - ty;
    if (pt && free >= 170) {
      const im = this.put(this.add.image(x + w / 2, y + h - 2, pt).setOrigin(0.5, 1));
      im.setScale(Math.min(free - 6, 330) / im.height);
    }
  }

  // ───────── 成就 ─────────

  private featTile(f: FeatDef, done: boolean, x: number, y: number, w: number, h: number): void {
    const on = f.id === this.feat;
    this.tile(x, y, w, h, on, done ? 0x8a7a3a : 0x2c3a4c, () => (this.feat = f.id));
    // 獎章和名字當成一組，放在方塊的正中間
    const ih = Math.min(56, h * 0.36);
    const t = this.text(x + w / 2, 0, L(f.name), 14, done ? COL.text : '#7c8ea2', true, w - 8).setOrigin(0.5, 0).setAlign('center');
    const room = h - ih - 18;
    if (t.height > room) t.setScale(Math.max(0.6, room / t.height));
    const top = y + (h - (ih + 6 + t.displayHeight)) / 2;
    t.setY(top + ih + 6);
    this.put(
      this.add
        .image(x + w / 2, top + ih / 2, 'ic_medal')
        .setScale(ih / 64 / TEX)
        .setTint(done ? GOLD : 0x3a4a5c),
    );
  }

  private featDetail(f: FeatDef, done: boolean, x: number, y: number, w: number, h: number): void {
    const g = this.put(this.add.graphics());
    drawPanel(g, x, y, w, h, { alpha: 0.92, cut: 16, line: done ? 0x8a7a3a : COL.lineDim });
    const cx = x + w / 2;
    const top = y + Math.max(30, h * 0.12);
    if (done) this.put(this.add.image(cx, top + 44, 'glow').setTint(GOLD).setAlpha(0.3).setScale(1.5));
    this.put(
      this.add
        .image(cx, top + 44, 'ic_medal')
        .setScale(88 / 64 / TEX)
        .setTint(done ? GOLD : 0x3a4a5c),
    );
    const name = this.text(cx, top + 108, L(f.name), 24, done ? COL.text : '#9fb4c8', true, w - 40).setOrigin(0.5, 0).setAlign('center');
    let ty = name.y + name.height + 8;
    ty += this.text(cx, ty, T(done ? 'featDone' : 'featTodo'), 16, done ? COL.yellow : '#6a7c90').setOrigin(0.5, 0).height + 16;
    ty += this.text(cx, ty, L(f.desc), 17, COL.text, false, w - 48).setOrigin(0.5, 0).setAlign('center').height + 20;
    // 有進度的（星數、圖鑑、改造、章節）畫一條進度條
    const p = featProgress(f.id, save());
    if (!p || ty + 40 > y + h) return;
    const bw = Math.min(260, w - 60);
    const bar = this.put(this.add.graphics());
    bar.fillStyle(0x06101c, 1).fillRect(cx - bw / 2, ty, bw, 12);
    bar.fillStyle(done ? GOLD : COL.line, 1).fillRect(cx - bw / 2 + 1, ty + 1, (bw - 2) * Phaser.Math.Clamp(p[0] / Math.max(1, p[1]), 0, 1), 10);
    bar.lineStyle(1.5, COL.lineDim, 1).strokeRect(cx - bw / 2, ty, bw, 12);
    this.text(cx, ty + 20, `${p[0]} / ${p[1]}`, 16, COL.dim).setOrigin(0.5, 0);
  }
}
