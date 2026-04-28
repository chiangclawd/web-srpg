import Phaser from 'phaser';
import { PORTRAIT_ASSETS, CG_ASSETS, SPRITE_ASSETS, TILE_ASSETS } from '../data/assetManifest';

/**
 * BootScene — 第一個跑的場景，預載所有美術素材後跳到 TitleScene。
 *
 * 設計原則：
 *   - manifest 為「opt-in」清單，未填項目不影響遊戲
 *   - 載入失敗只 console.warn，不阻擋進入遊戲（HubScene 等場景有 fallback）
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 立繪 / 頭像
    for (const asset of PORTRAIT_ASSETS) {
      this.load.image(asset.key, asset.url);
    }
    // CG 大圖（標題、章節入場）
    for (const asset of CG_ASSETS) {
      this.load.image(asset.key, asset.url);
    }
    // 戰場 sprite（單位本體）
    for (const asset of SPRITE_ASSETS) {
      this.load.image(asset.key, asset.url);
    }
    // 戰場地形 tile（hex 形 painterly anime 圖；缺檔 fallback 色塊）
    for (const asset of TILE_ASSETS) {
      this.load.image(asset.key, asset.url);
    }

    // 載入失敗提示但不中斷
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[asset] 載入失敗：${file.url}（缺檔不影響遊戲，會 fallback 到色塊版）`);
    });

    // 進度顯示（簡易）
    const { width, height } = this.scale;
    const progressTxt = this.add
      .text(width / 2, height / 2, '載入中…', {
        fontSize: '20px',
        color: '#888888',
      })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => {
      progressTxt.setText(`載入中… ${Math.floor(p * 100)}%`);
    });
    this.load.on('complete', () => progressTxt.destroy());
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
