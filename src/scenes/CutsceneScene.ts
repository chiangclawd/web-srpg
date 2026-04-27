import Phaser from 'phaser';
import { CUTSCENES } from '../data/cutscenes';
import { COMMANDERS } from '../data/commanders';
import { getPortraitKey } from '../data/assetManifest';
import type { DialogueLine } from '../types';

export interface CutsceneNext {
  scene: string;
  data?: object;
}

export interface CutsceneSceneData {
  cutsceneId: string;
  next: CutsceneNext;
}

/**
 * 從 cutscene 講話者字串對應到 commander id。
 * 使用 prefix match 處理「伊歐侯爵（影）」這類後綴變化，
 * 或「教主 — 黯」這種完整名稱。
 */
function findCommanderIdBySpeaker(speaker: string): string | null {
  for (const cmd of Object.values(COMMANDERS)) {
    if (speaker === cmd.name || speaker.startsWith(cmd.name)) return cmd.id;
  }
  return null;
}

export class CutsceneScene extends Phaser.Scene {
  private lines: DialogueLine[] = [];
  private bgImageKey: string | undefined;
  private current = 0;
  private next!: CutsceneNext;
  private speakerText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private placeholderText!: Phaser.GameObjects.Text;
  private portraitImage: Phaser.GameObjects.Image | null = null;
  private currentSpeakerId: string | null = null;
  private hasBgImage = false;
  /** 對話框上緣 y 座標（updatePortrait 用來把立繪底部貼齊）*/
  private dialogBoxTopY = 0;

  constructor() {
    super({ key: 'CutsceneScene' });
  }

  init(data: CutsceneSceneData): void {
    const cs = CUTSCENES[data.cutsceneId];
    if (!cs) {
      console.warn('Unknown cutscene id', data.cutsceneId);
      this.lines = [{ speaker: '系統', text: `（找不到劇本：${data.cutsceneId}）` }];
      this.bgImageKey = undefined;
    } else {
      this.lines = cs.lines;
      this.bgImageKey = cs.bgImageKey;
    }
    this.current = 0;
    this.next = data.next;
    this.portraitImage = null;
    this.currentSpeakerId = null;
    this.hasBgImage = false;
  }

  create(): void {
    const { width, height } = this.scale;

    // 背景：優先用 CG 大圖（若 cutscene 有指定且 texture 已載入）
    if (this.bgImageKey && this.textures.exists(this.bgImageKey)) {
      const bg = this.add.image(width / 2, height / 2, this.bgImageKey);
      // cover：縮到完全填滿畫布
      const scale = Math.max(width / bg.width, height / bg.height);
      bg.setScale(scale);
      // 全螢幕半透明黑罩，讓對話框可讀但 CG 仍清楚
      this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0);
      this.hasBgImage = true;
    } else {
      this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0);
      this.hasBgImage = false;
    }

    // 立繪舞台中央位置（無立繪時用 ◇ 佔位；有 CG 時不顯示 ◇）
    const stageY = height * 0.32;
    this.placeholderText = this.add
      .text(width / 2, stageY, '◇', {
        fontSize: '120px',
        color: '#333333',
      })
      .setOrigin(0.5);
    if (this.hasBgImage) this.placeholderText.setVisible(false);

    // 對話框
    const boxH = 180;
    const boxX = 40;
    const boxY = height - boxH - 30;
    this.dialogBoxTopY = boxY;
    const box = this.add.rectangle(boxX, boxY, width - 80, boxH, 0x000000, 0.85);
    box.setOrigin(0);
    box.setStrokeStyle(2, 0x4a90e2);

    this.speakerText = this.add.text(boxX + 24, boxY + 18, '', {
      fontSize: '20px',
      color: '#7ed1ff',
      fontStyle: 'bold',
    });

    this.bodyText = this.add.text(boxX + 24, boxY + 60, '', {
      fontSize: '18px',
      color: '#ffffff',
      wordWrap: { width: width - 130 },
      lineSpacing: 8,
    });

    // 進度提示
    const prog = this.add
      .text(width - 50, height - 18, '', {
        fontSize: '13px',
        color: '#888888',
      })
      .setOrigin(1, 1);
    prog.setName('progressText');

    // 點擊或按鍵繼續
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown', () => this.advance());

    this.showLine();
  }

  private showLine(): void {
    const line = this.lines[this.current];
    if (!line) return;
    this.speakerText.setText(line.speaker);
    this.bodyText.setText(line.text);
    this.updatePortrait(line.speaker);
    const prog = this.children.getByName('progressText') as Phaser.GameObjects.Text | null;
    if (prog) prog.setText(`${this.current + 1} / ${this.lines.length}　▶ 點擊繼續`);
  }

  private updatePortrait(speaker: string): void {
    const cmdId = findCommanderIdBySpeaker(speaker);
    if (cmdId === this.currentSpeakerId) return; // 同一個講話者，不換立繪

    // 淡出舊立繪
    if (this.portraitImage) {
      const old = this.portraitImage;
      this.portraitImage = null;
      this.tweens.add({
        targets: old,
        alpha: 0,
        duration: 220,
        ease: 'Cubic.easeOut',
        onComplete: () => old.destroy(),
      });
    }

    if (cmdId) {
      const portraitKey = getPortraitKey(cmdId);
      if (this.textures.exists(portraitKey)) {
        const { width } = this.scale;
        // 立繪底部貼齊對話框上緣（visual novel 風格，避免 CG 從中間穿出來）
        const img = this.add.image(width / 2, this.dialogBoxTopY, portraitKey);
        img.setOrigin(0.5, 1); // 底部中心錨點
        // 高度填滿對話框上方空間，留 30px 給最頂端的 CG/標題
        const maxH = Math.max(300, this.dialogBoxTopY - 30);
        const scale = maxH / img.height;
        img.setScale(scale);
        img.setAlpha(0);
        this.tweens.add({
          targets: img,
          alpha: 1,
          duration: 280,
          ease: 'Cubic.easeOut',
        });
        this.portraitImage = img;
        this.placeholderText.setVisible(false);
      } else {
        // 該武將沒立繪 → 有 CG 時讓 CG 當主視覺（不顯示 ◇），純黑底時用 ◇ 佔位
        this.placeholderText.setVisible(!this.hasBgImage);
      }
    } else {
      // 旁白 / 未知 → 有 CG 時讓 CG 當主視覺，純黑底時顯示 ◇
      this.placeholderText.setVisible(!this.hasBgImage);
    }

    this.currentSpeakerId = cmdId;
  }

  private advance(): void {
    this.current += 1;
    if (this.current >= this.lines.length) {
      this.scene.start(this.next.scene, this.next.data ?? {});
    } else {
      this.showLine();
    }
  }
}
