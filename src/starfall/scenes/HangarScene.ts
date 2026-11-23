// 機庫：用過關拿到的零件改造機體。左邊選機體，右邊是數值和四項改造（兩條強化線 + 兩個專屬改造）。
// 整個畫面排在一個容器裡再照 uiZoom 放大，手機上按鈕和字才夠大；排版用的是放大前的座標（W × H）。
import Phaser from 'phaser';
import { COL, TEX, VIEW_H, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { music, sfx } from '../audio';
import { L, T } from '../i18n';
import { persist, save } from '../save';
import { UNITS } from '../data/units';
import {
  FRAMES,
  MOD_COST,
  TRACKS,
  TRACK_DESC,
  TRACK_MAX,
  TRACK_NAME,
  applyUpgrades,
  buyMod,
  buyTrack,
  frameSpent,
  frameUnlocked,
  frameUpgrades,
  modsOf,
  partsLeft,
  resetFrame,
  trackCost,
} from '../data/upgrades';
import type { FrameId } from '../data/upgrades';
import type { UnitDef } from '../sim/types';
import { SHEETS, animKey, frameName } from '../view/sheets';
import { Button, drawPanel } from '../view/ui';

const PAD = 14;
const TOP = 60;
const GOLD = 0xffd75a;

export class HangarScene extends Phaser.Scene {
  private frame: FrameId = 'kai';
  private chapter?: number;
  private root!: Phaser.GameObjects.Container;
  private W = 1280;
  private H = 720;

  constructor() {
    super('SfHangar');
  }

  init(data: { chapter?: number }): void {
    this.chapter = data.chapter;
    // 選中的機體記在場景物件上：旋轉手機或縮放視窗會重開場景，不該跳回第一台
    if (!frameUnlocked(this.frame, save().stars)) this.frame = 'kai';
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
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x040a14, 0.72);
    this.root = this.add.container(0, 0).setScale(z);
    this.draw();
  }

  /** 把物件收進根容器（跟著整個畫面一起放大） */
  private put<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.root.add(o);
    return o;
  }

  private text(x: number, y: number, s: string, size: number, color: string = COL.text, bold = true): Phaser.GameObjects.Text {
    return this.put(addText(this, x, y, s, { size, raw: true, strokeW: 0, color, bold }));
  }

  private draw(): void {
    this.root.removeAll(true);
    const sv = save();
    const left = partsLeft(sv.stars, sv.upgrades);
    const { W, H } = this;
    // 上方：返回、標題、零件
    this.put(new Button(this, PAD + 62, 32, 124, 44, T('back'), () => this.scene.start('SfMissions', { chapter: this.chapter }), { color: 0x8fb0c8 }));
    this.text(PAD + 140, 32, T('hangar'), 26).setOrigin(0, 0.5);
    const num = this.text(W - PAD, 32, String(left), 26, COL.yellow).setOrigin(1, 0.5);
    const label = this.text(num.x - num.width - 10, 33, T('parts'), 16, COL.dim).setOrigin(1, 0.5);
    this.put(
      this.add
        .image(label.x - label.width - 20, 32, 'ic_parts')
        .setScale(30 / 64 / TEX)
        .setTint(GOLD),
    );
    // 左邊：機體列表
    const LW = Phaser.Math.Clamp(W * 0.24, 200, 260);
    const gap = 6;
    const rh = (H - TOP - PAD - gap * (FRAMES.length - 1)) / FRAMES.length;
    FRAMES.forEach((f, i) => this.drawTab(f, PAD, TOP + i * (rh + gap), LW, rh));
    // 右邊：選中的機體
    const dx = PAD + LW + 10;
    this.drawDetail(dx, TOP, W - dx - PAD, H - TOP - PAD, left);
  }

  /** 單位圖：以實際有圖的範圍置中，縮到 (bw, bh) 放得下 */
  private sprite(def: UnitDef, x: number, y: number, bw: number, bh: number, animate: boolean): Phaser.GameObjects.Sprite {
    const sheet = SHEETS[def.sprite];
    const im = this.add.sprite(x, y, `sf_${def.sprite}`, frameName(sheet, 'idle', false, 0));
    const fr = im.frame;
    im.setOrigin((fr.x + fr.width / 2) / fr.realWidth, (fr.y + fr.height / 2) / fr.realHeight);
    im.setScale(Math.min(bw / fr.width, bh / fr.height));
    if (animate && (sheet.frames.idle ?? 1) > 1) im.play(animKey(def.sprite, 'idle', false));
    return this.put(im);
  }

  private drawTab(f: FrameId, x: number, y: number, w: number, h: number): void {
    const sv = save();
    const open = frameUnlocked(f, sv.stars);
    const on = f === this.frame;
    const def = UNITS[f];
    const g = this.put(this.add.graphics());
    drawPanel(g, x, y, w, h, { fill: on ? 0x123a52 : COL.panel, alpha: on ? 0.96 : 0.86, line: on ? COL.line : open ? COL.lineDim : 0x2c3a4c, cut: 10 });
    const im = this.sprite(def, x + 34, y + h / 2, 52, h - 10, false);
    const tx = x + 68;
    const tw = w - 68 - 10;
    if (!open) {
      im.setTint(0x101820);
      fitText(this.text(tx, y + h / 2 - 11, '？？？', 17, '#6a7c90').setOrigin(0, 0.5), tw);
      fitText(this.text(tx, y + h / 2 + 11, T('upLocked'), 14, '#6a7c90', false).setOrigin(0, 0.5), tw);
      return;
    }
    const up = frameUpgrades(sv.upgrades, f);
    fitText(this.text(tx, y + h / 2 - 11, L(def.name), 18, on ? COL.text : '#c4d6e6').setOrigin(0, 0.5), tw);
    // 改造進度：八格（兩條強化線各三級 + 兩個專屬改造）
    const done = up.plating + up.firepower + up.mods.length;
    const total = TRACK_MAX * TRACKS.length + modsOf(f).length;
    const pg = this.put(this.add.graphics());
    for (let i = 0; i < total; i++) {
      pg.fillStyle(i < done ? GOLD : 0x2c3a4c, 1);
      pg.fillRect(tx + i * 11, y + h / 2 + 6, 8, 8);
    }
    const hit = this.put(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0).setInteractive({ useHandCursor: true }));
    hit.on('pointerup', () => {
      if (on) return;
      sfx('click');
      this.frame = f;
      this.draw();
    });
  }

  private drawDetail(x: number, y: number, w: number, h: number, left: number): void {
    const sv = save();
    const f = this.frame;
    const base = UNITS[f];
    const up = frameUpgrades(sv.upgrades, f);
    const def = applyUpgrades(base, up);
    const g = this.put(this.add.graphics());
    drawPanel(g, x, y, w, h, { alpha: 0.9, cut: 16 });
    // 標頭：圖、名稱、數值（改造後有變的數值標成金色，後面附原本的值）
    const hh = Math.min(104, Math.max(84, h * 0.2));
    this.sprite(def, x + 56, y + hh / 2 + 4, 84, hh - 8, true);
    const tx = x + 112;
    const name = this.text(tx, y + 14, L(def.name), 24);
    this.text(name.x + name.width + 12, y + 22, L(def.cls), 15, COL.dim, false);
    const range = (d: UnitDef): string => (d.weapon.min === d.weapon.max ? String(d.weapon.max) : `${d.weapon.min}–${d.weapon.max}`);
    const stats: [string, string, string][] = [
      [T('statHp'), String(def.hp), String(base.hp)],
      [T('statArmor'), String(def.armor), String(base.armor)],
      [T('statMove'), String(def.move), String(base.move)],
      [T('statDmg'), String(def.weapon.dmg), String(base.weapon.dmg)],
      [T('statRange'), range(def), range(base)],
    ];
    // 照實際寬度往右排；窄螢幕放不下就整列縮小
    const row = this.put(this.add.container(tx, y + hh - 22));
    const st = (sx: number, s: string, size: number, color: string, bold: boolean): Phaser.GameObjects.Text => {
      const t = addText(this, sx, 0, s, { size, raw: true, strokeW: 0, color, bold }).setOrigin(0, 0.5);
      row.add(t);
      return t;
    };
    let sx = 0;
    for (const [k, v, was] of stats) {
      const kt = st(sx, k, 15, COL.dim, false);
      const vt = st(sx + kt.width + 6, v, 19, v === was ? COL.text : COL.yellow, true);
      sx = vt.x + vt.width;
      if (v !== was) sx += 4 + st(sx + 4, `(${was})`, 13, COL.dim, false).width;
      sx += 24;
    }
    row.setScale(Math.min(1, (w - 112 - 14) / (sx - 24)));
    // 四項改造
    const footer = 54;
    const rows = TRACKS.length + modsOf(f).length;
    const gap = 6;
    const top = y + hh + 6;
    const rh = Math.min(96, (h - hh - 6 - footer - gap * (rows - 1)) / rows);
    let i = 0;
    for (const t of TRACKS) {
      const lv = up[t];
      const cost = trackCost(up, t);
      this.drawRow(x + 10, top + i * (rh + gap), w - 20, rh, {
        icon: t === 'plating' ? 'ic_plating' : 'ic_firepower',
        name: L(TRACK_NAME[t]),
        desc: L(TRACK_DESC[t]),
        pips: [lv, TRACK_MAX],
        cost,
        done: cost === null ? T('upMax') : '',
        left,
        buy: () => buyTrack(sv.stars, sv.upgrades, f, t),
      });
      i++;
    }
    for (const m of modsOf(f)) {
      const owned = up.mods.includes(m.id);
      this.drawRow(x + 10, top + i * (rh + gap), w - 20, rh, {
        icon: 'ic_mod',
        name: L(m.name),
        desc: L(m.desc),
        cost: owned ? null : MOD_COST,
        done: owned ? T('upOwned') : '',
        left,
        buy: () => buyMod(sv.stars, sv.upgrades, f, m.id),
      });
      i++;
    }
    // 畫面夠高（桌機、平板）：改造下面列出技能和被動的說明，用的是改造後的文字
    const iy = top + rows * (rh + gap) + 6;
    const free = y + h - footer - iy;
    if (free >= 44) {
      const sep = L({ zh: '：', en: ': ' });
      const lines = [...def.skills.map((s) => `${L(s.name)}${sep}${L(s.desc)}`), ...(def.passive ? [`${L(def.passive.name)}${sep}${L(def.passive.desc)}`] : [])];
      let ty = iy;
      for (const s of lines) {
        const t = this.text(x + 18, ty, s, 15, COL.dim, false);
        t.setWordWrapWidth(w - 36, true);
        if (ty + t.height > y + h - footer) {
          t.destroy();
          break;
        }
        ty += t.height + 6;
      }
    }
    // 底部：拆除（全額退還）與說明
    const fy = y + h - 27;
    const spent = frameSpent(up);
    const bw = 250;
    this.put(
      new Button(
        this,
        x + 14 + bw / 2,
        fy,
        bw,
        40,
        T('upReset', spent),
        () => {
          resetFrame(sv.upgrades, f);
          persist();
          this.draw();
        },
        { color: 0xff8a7a, size: 16, disabled: spent === 0 },
      ),
    );
    const hint = this.text(x + w - 14, fy, T('partsHint'), 14, COL.dim, false).setOrigin(1, 0.5);
    hint.setWordWrapWidth(w - bw - 48, true).setAlign('right');
    // 最多兩行的高度；英文在窄螢幕會折成三行，整段縮小
    if (hint.height > 40) hint.setScale(40 / hint.height);
  }

  private drawRow(
    x: number,
    y: number,
    w: number,
    h: number,
    o: { icon: string; name: string; desc: string; pips?: [number, number]; cost: number | null; done: string; left: number; buy: () => boolean },
  ): void {
    const owned = o.cost === null;
    const g = this.put(this.add.graphics());
    g.fillStyle(owned ? 0x10283a : 0x0a1626, 0.9);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, owned ? 0x8a7a3a : COL.lineDim, 0.9);
    g.strokeRect(x, y, w, h);
    const cy = y + h / 2;
    this.put(
      this.add
        .image(x + 28, cy, o.icon)
        .setScale(34 / 64 / TEX)
        .setTint(owned ? GOLD : COL.line),
    );
    const bw = 132;
    const tx = x + 56;
    const tw = w - 56 - bw - 20 - (o.pips ? 62 : 0);
    const name = fitText(this.text(tx, cy - 13, o.name, 18).setOrigin(0, 0.5), tw);
    const desc = this.text(tx, cy + 4, o.desc, 15, COL.dim, false);
    desc.setWordWrapWidth(tw, true).setLineSpacing(1);
    // 說明太長（兩行以上）就整塊往上挪，不要壓到下一列
    if (desc.height > 22) {
      name.y = cy - 22;
      desc.y = cy - 8;
      if (desc.height > h / 2 + 6) desc.setScale(Math.max(0.8, (h / 2 + 6) / desc.height));
    }
    if (o.pips) {
      const [lv, max] = o.pips;
      const pg = this.put(this.add.graphics());
      const px = x + w - bw - 20 - 54;
      for (let k = 0; k < max; k++) {
        pg.fillStyle(k < lv ? GOLD : 0x2c3a4c, 1);
        pg.fillRect(px + k * 18, cy - 7, 14, 14);
      }
    }
    const bx = x + w - bw / 2 - 10;
    if (o.cost === null) {
      this.text(bx, cy, `✓ ${o.done}`, 17, COL.yellow).setOrigin(0.5);
      return;
    }
    const can = o.cost <= o.left;
    const btn = this.put(
      new Button(
        this,
        bx,
        cy,
        bw,
        Math.min(48, h - 12),
        String(o.cost),
        () => {
          if (!o.buy()) return;
          persist();
          sfx('select');
          this.draw();
        },
        { icon: 'ic_parts', color: GOLD, disabled: !can, primary: can, size: 19 },
      ),
    );
    btn.setName('buy');
  }
}
