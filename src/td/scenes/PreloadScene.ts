import Phaser from 'phaser';

/** 先單獨載入標題主視覺，讓真正的載入畫面（BootScene）能以它當背景 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#120d08');
    this.load.image('keyart', 'assets/keyart.webp');
  }

  create(): void {
    this.scene.start('Boot');
  }
}
