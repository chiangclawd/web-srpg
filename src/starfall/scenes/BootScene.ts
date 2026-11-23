// 載入素材（3D 單位圖表、立繪、背景）並產生程序繪圖的紋理
import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, viewW } from '../config';
import { T } from '../i18n';
import { loadSheets, makeAnims } from '../view/sheets';
import { makeTextures } from '../view/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('SfBoot');
  }

  preload(): void {
    setupCamera(this);
    const w = viewW(this);
    addText(this, w / 2, VIEW_H / 2 - 40, T('title'), { size: 44, strokeW: 0, color: COL.cyan }).setOrigin(0.5);
    const g = this.add.graphics();
    const bw = 360;
    this.load.on('progress', (k: number) => {
      g.clear();
      g.lineStyle(2, COL.lineDim, 1).strokeRect(w / 2 - bw / 2, VIEW_H / 2 + 20, bw, 12);
      g.fillStyle(COL.line, 1).fillRect(w / 2 - bw / 2 + 2, VIEW_H / 2 + 22, (bw - 4) * k, 8);
    });
    loadSheets(this);
    for (const p of ['kai', 'bruno', 'vey', 'echo', 'cantor']) this.load.image(`pt_${p}`, `assets/starfall/pt_${p}.webp`);
    for (const b of ['bg_ice', 'bg_hull', 'title']) this.load.image(b, `assets/starfall/${b}.webp`);
  }

  create(): void {
    makeTextures(this);
    makeAnims(this);
    this.scene.start('SfTitle');
  }
}
