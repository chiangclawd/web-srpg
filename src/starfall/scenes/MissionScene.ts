// 任務列表：三張任務卡（名稱、簡介、星數），前一關過了才開下一關
import Phaser from 'phaser';
import { COL, TEX, VIEW_H, addText, fitText, setupCamera, uiZoom, viewW } from '../config';
import { L, T } from '../i18n';
import { save } from '../save';
import { MISSIONS } from '../data/missions';
import { Button, drawPanel } from '../view/ui';

export class MissionScene extends Phaser.Scene {
  constructor() {
    super('SfMissions');
  }

  create(): void {
    setupCamera(this);
    const w = viewW(this);
    const z = uiZoom();
    const bg = this.add.image(w / 2, VIEW_H / 2, 'bg_ice');
    bg.setScale(Math.max(w / bg.width, VIEW_H / bg.height));
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x040a14, 0.45);
    addText(this, w / 2, 58, T('missions'), { size: 30, strokeW: 5 }).setOrigin(0.5);
    new Button(this, 16 + 60 * z, 14 + 24 * z, 120, 48, T('back'), () => this.scene.start('SfTitle'), { color: 0x8fb0c8 }).setScale(z);
    const sv = save();
    const n = MISSIONS.length;
    const cw = Math.min(380, (w - 80 - (n - 1) * 24) / n);
    const ch = 430;
    const x0 = w / 2 - ((n - 1) * (cw + 24)) / 2;
    MISSIONS.forEach((m, i) => {
      const open = i === 0 || (sv.stars[MISSIONS[i - 1].id] ?? 0) > 0;
      const cx = x0 + i * (cw + 24);
      const top = 120;
      const g = this.add.graphics();
      drawPanel(g, cx - cw / 2, top, cw, ch, { alpha: 0.88, line: open ? COL.line : 0x3a4a5c, cut: 16 });
      addText(this, cx - cw / 2 + 22, top + 20, T('mission', i + 1), { size: 16, strokeW: 0, color: open ? COL.orange : '#5a6a7c' });
      fitText(addText(this, cx - cw / 2 + 22, top + 46, L(m.name), { size: 30, strokeW: 0, color: open ? COL.text : '#6a7c90' }), cw - 44);
      const stars = sv.stars[m.id] ?? 0;
      for (let s = 0; s < 3; s++) {
        this.add
          .image(cx - cw / 2 + 40 + s * 40, top + 112, 'ic_star')
          .setScale(34 / 64 / TEX)
          .setTint(s < stars ? 0xffd75a : 0x2c3a4c);
      }
      if (open) {
        addText(this, cx - cw / 2 + 22, top + 146, L(m.brief), { size: 16, strokeW: 0, color: COL.dim, bold: false, wrap: cw - 44, lineSpacing: 6 });
        addText(this, cx - cw / 2 + 22, top + ch - 124, `${T('objective')}：${L(m.objective)}`, { size: 15, strokeW: 0, color: COL.cyan, wrap: cw - 44 });
        new Button(this, cx, top + ch - 48, Math.min(cw - 44, 240), 56, T('sortie'), () => this.scene.start('SfBattle', { missionId: m.id }), { primary: true, size: 22 });
      } else {
        this.add
          .image(cx, top + 230, 'ic_lock')
          .setScale(60 / 64 / TEX)
          .setTint(0x3a4a5c);
        addText(this, cx, top + 300, T('locked'), { size: 15, strokeW: 0, color: '#6a7c90', wrap: cw - 50, align: 'center', bold: false }).setOrigin(0.5, 0);
      }
    });
  }
}
