import Phaser from 'phaser';
import { VIEW_H, addText, setupCamera, viewW } from '../config';
import { UPGRADE_COLUMNS } from '../data/upgrades';
import { Button, IconButton, panel } from '../ui/widgets';
import { L, T } from '../i18n';
import { save, persist } from '../save';
import { sfx } from '../audio';
import { starsAvailable } from './MapScene';

/** 星數升級樹：6 欄 × 5 階，必須依序購買 */
export class UpgradeScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private sel: { col: number; tier: number } | null = null;

  constructor() {
    super('Upgrade');
  }

  create(): void {
    setupCamera(this);
    this.sel = null;
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private build(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const w = viewW(this);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.objs.push(o);
      return o;
    };
    const bg = add(this.add.graphics());
    bg.fillGradientStyle(0x3a2412, 0x3a2412, 0x1a0e06, 0x1a0e06, 1);
    bg.fillRect(0, 0, w, VIEW_H);
    add(panel(this, w / 2, 352, Math.min(w - 40, 1180), 600));
    add(addText(this, w / 2, 40, T('upgrades'), { size: 38, display: true, color: '#ffd36b', strokeW: 7 }).setOrigin(0.5));
    const avail = starsAvailable();
    add(panel(this, w - 130, 40, 200, 50, 'ui_dark', 18));
    add(this.add.image(w - 205, 40, 'ic_star').setDisplaySize(34, 34));
    add(addText(this, w - 182, 40, `${avail}`, { size: 26, display: true, color: '#ffe066' }).setOrigin(0, 0.5));
    add(addText(this, w - 140, 42, T('starsAvail'), { size: 13, color: '#e8d8b8', strokeW: 2 }).setOrigin(0, 0.5));
    const sv = save();
    const colW = Math.min(170, (w - 120) / 6);
    const x0 = w / 2 - colW * 2.5;
    UPGRADE_COLUMNS.forEach((col, ci) => {
      const x = x0 + ci * colW;
      const owned = sv.upgrades[col.id] ?? 0;
      add(this.add.image(x, 112, col.icon).setDisplaySize(64, 64));
      add(addText(this, x, 154, L(col.name), { size: 16, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0.5));
      // 連接線
      const line = add(this.add.graphics());
      line.lineStyle(6, 0x4a2a10, 0.6);
      line.lineBetween(x, 196, x, 196 + 4 * 84);
      col.tiers.forEach((tier, ti) => {
        const y = 196 + ti * 84;
        const bought = ti < owned;
        const next = ti === owned;
        const can = next && avail >= tier.cost;
        const badge = bought ? 'ui_badge_green' : next ? 'ui_badge' : 'ui_badge_grey';
        const b = add(new IconButton(this, x, y, 62, col.icon, () => this.select(ci, ti), badge, 0.78));
        if (!bought && !next) b.icon.setAlpha(0.35);
        if (bought) {
          add(this.add.image(x + 22, y + 20, 'ic_check').setDisplaySize(26, 26));
        } else {
          const pill = add(this.add.image(x, y + 34, 'ui_pill').setDisplaySize(52, 20));
          void pill;
          add(this.add.image(x - 12, y + 34, 'ic_star').setDisplaySize(16, 16));
          add(addText(this, x + 6, y + 34, String(tier.cost), { size: 13, display: true, color: can ? '#ffe066' : '#c8b090', strokeW: 3, shadow: false }).setOrigin(0.5));
        }
        if (this.sel && this.sel.col === ci && this.sel.tier === ti) {
          const ring = add(this.add.circle(x, y, 36).setStrokeStyle(4, 0xffe066));
          this.tweens.add({ targets: ring, scale: 1.1, duration: 400, yoyo: true, repeat: -1 });
        }
        if (can) this.tweens.add({ targets: b, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });
      });
    });
    // 底部資訊列
    const infoY = VIEW_H - 46;
    if (this.sel) {
      const col = UPGRADE_COLUMNS[this.sel.col];
      const tier = col.tiers[this.sel.tier];
      const owned = sv.upgrades[col.id] ?? 0;
      add(panel(this, w / 2, infoY, 640, 70, 'ui_dark', 18));
      add(addText(this, w / 2 - 300, infoY - 14, L(tier.name), { size: 20, display: true, color: '#ffe8a8' }).setOrigin(0, 0.5));
      add(addText(this, w / 2 - 300, infoY + 14, L(tier.desc), { size: 15, color: '#e8dcc0', strokeW: 2 }).setOrigin(0, 0.5));
      if (this.sel.tier === owned) {
        const can = avail >= tier.cost;
        add(
          new Button(this, w / 2 + 230, infoY, 150, 50, `${T('upgrade')} ★${tier.cost}`, () => {
            if (!can) return;
            sv.upgrades[col.id] = owned + 1;
            persist();
            sfx.play('upgrade');
            this.build();
          }, { color: can ? 'green' : 'grey', disabled: !can, text: { size: 18 } }),
        );
      } else if (this.sel.tier < owned) {
        add(addText(this, w / 2 + 230, infoY, '✔', { size: 30, color: '#9aff7a' }).setOrigin(0.5));
      } else {
        add(this.add.image(w / 2 + 230, infoY, 'ic_lock').setDisplaySize(36, 36));
      }
    }
    add(new IconButton(this, 44, VIEW_H - 44, 64, 'ic_close', () => this.back()));
    add(
      new Button(this, w - 100, VIEW_H - 44, 140, 50, T('reset'), () => {
        sv.upgrades = {};
        persist();
        sfx.play('sell');
        this.sel = null;
        this.build();
      }, { color: 'red', icon: 'ic_retry', iconSize: 30, text: { size: 18 } }),
    );
  }

  private select(col: number, tier: number): void {
    this.sel = { col, tier };
    this.build();
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
