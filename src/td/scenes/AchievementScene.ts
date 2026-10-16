import Phaser from 'phaser';
import { VIEW_H, addText, setupCamera, viewW } from '../config';
import { ACHIEVEMENTS } from '../data/achievements';
import { IconButton, panel } from '../ui/widgets';
import { L, T } from '../i18n';
import { save } from '../save';

/** 成就一覽：已解鎖的亮起，未解鎖的灰階 */
export class AchievementScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Achievements');
  }

  create(): void {
    setupCamera(this);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private build(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.objs.push(o);
      return o;
    };
    const w = viewW(this);
    const bg = add(this.add.graphics());
    bg.fillGradientStyle(0x2a2414, 0x2a2414, 0x100c06, 0x100c06, 1);
    bg.fillRect(0, 0, w, VIEW_H);
    const got = new Set(save().achievements);
    add(addText(this, w / 2, 40, `${T('achievements')}  ${got.size} / ${ACHIEVEMENTS.length}`, { size: 34, display: true, color: '#ffd36b', strokeW: 6 }).setOrigin(0.5));
    const cols = 4;
    const cw = Math.min(296, (w - 60) / cols);
    const ch = 80;
    const x0 = w / 2 - (cols * cw) / 2 + cw / 2;
    ACHIEVEMENTS.forEach((a, i) => {
      const x = x0 + (i % cols) * cw;
      const y = 112 + Math.floor(i / cols) * (ch + 8);
      const ok = got.has(a.id);
      add(panel(this, x, y, cw - 10, ch, ok ? 'ui_panel' : 'ui_dark', 18));
      const badge = add(this.add.image(x - cw / 2 + 42, y, ok ? 'ui_badge_green' : 'ui_badge_grey').setDisplaySize(52, 52));
      const icon = add(this.add.image(x - cw / 2 + 42, y, a.icon).setDisplaySize(30, 30));
      if (!ok) {
        icon.setTint(0x555555);
        badge.setAlpha(0.8);
      }
      const tx = x - cw / 2 + 76;
      add(
        addText(this, tx, y - 14, L(a.name), {
          size: 16,
          display: true,
          color: ok ? '#4a2a10' : '#9a8a70',
          stroke: ok ? '#f4e2b8' : '#1a1008',
          strokeW: ok ? 2 : 3,
          shadow: false,
        }).setOrigin(0, 0.5),
      );
      add(
        addText(this, tx, y + 12, L(a.desc), {
          size: 12,
          color: ok ? '#3a2412' : '#8a7a62',
          stroke: '#000000',
          strokeW: 0,
          shadow: false,
          wrap: cw - 96,
        }).setOrigin(0, 0.5),
      );
    });
    add(new IconButton(this, 44, VIEW_H - 44, 64, 'ic_close', () => this.back()));
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
