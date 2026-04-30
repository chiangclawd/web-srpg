import Phaser from 'phaser';
import { CUTSCENES } from '../data/cutscenes';
import { COMMANDERS } from '../data/commanders';
import { getPortraitKey } from '../data/assetManifest';
import { audio } from '../utils/audio';
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
  private lineBgKey: Record<number, string> | undefined;
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
  /** 目前在畫面上的 CG bg image（cross-fade 時舊圖會 fade-out 再 destroy） */
  private currentBgImage: Phaser.GameObjects.Image | null = null;
  /** 目前載入的 bg key，避免同 key 重複切換 */
  private currentBgKey: string | undefined;

  constructor() {
    super({ key: 'CutsceneScene' });
  }

  init(data: CutsceneSceneData): void {
    const cs = CUTSCENES[data.cutsceneId];
    if (!cs) {
      console.warn('Unknown cutscene id', data.cutsceneId);
      this.lines = [{ speaker: '系統', text: `（找不到劇本：${data.cutsceneId}）` }];
      this.bgImageKey = undefined;
      this.lineBgKey = undefined;
    } else {
      this.lines = cs.lines;
      this.bgImageKey = cs.bgImageKey;
      this.lineBgKey = cs.lineBgKey;
    }
    this.current = 0;
    this.next = data.next;
    this.portraitImage = null;
    this.currentSpeakerId = null;
    this.hasBgImage = false;
    this.currentBgImage = null;
    this.currentBgKey = undefined;
  }

  create(): void {
    const { width, height } = this.scale;

    // 章節對話期間維持 peaceful BGM；切到戰鬥場景時 BattleScene 會接手換 mood
    audio.startBgm('peaceful');

    // 純黑底（永遠先鋪一層，當 fallback / bg cross-fade 期間的襯底）
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0);

    // 嘗試載入 cutscene 指定的初始 bg；line 0 若有 lineBgKey 會 override
    const initialKey = this.lineBgKey?.[0] ?? this.bgImageKey;
    this.applyBg(initialKey, /*animate*/ false);

    // 35% 黑罩（鋪在 bg 上面、立繪/對話框下面），讓對話框可讀
    this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0).setDepth(5);

    // 立繪舞台中央位置（無立繪時用 ◇ 佔位；有 CG 時不顯示 ◇）
    const stageY = height * 0.32;
    this.placeholderText = this.add
      .text(width / 2, stageY, '◇', {
        fontSize: '120px',
        color: '#333333',
      })
      .setOrigin(0.5)
      .setDepth(8);
    if (this.hasBgImage) this.placeholderText.setVisible(false);

    // 對話框：壓縮高度（多數對話 1-2 行為主），把畫面留給立繪/CG
    const boxH = 160;
    const boxX = 40;
    const boxY = height - boxH - 30;
    this.dialogBoxTopY = boxY;
    const box = this.add.rectangle(boxX, boxY, width - 80, boxH, 0x000000, 0.85);
    box.setOrigin(0);
    box.setStrokeStyle(2, 0x4a90e2);
    box.setDepth(20);

    this.speakerText = this.add.text(boxX + 28, boxY + 14, '', {
      fontSize: '40px',
      color: '#7ed1ff',
      fontStyle: 'bold',
    }).setDepth(21);

    this.bodyText = this.add.text(boxX + 28, boxY + 70, '', {
      fontSize: '36px',
      color: '#ffffff',
      wordWrap: { width: width - 140 },
      lineSpacing: 8,
    }).setDepth(21);

    // 進度提示
    const prog = this.add
      .text(width - 60, height - 30, '', {
        fontSize: '26px',
        color: '#888888',
      })
      .setOrigin(1, 1)
      .setDepth(21);
    prog.setName('progressText');

    // 點擊或按鍵繼續
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown', () => this.advance());

    this.showLine();
  }

  /**
   * 套用 / 切換背景 CG。若 key 相同則 no-op；新 key 沒對應 texture 則保留當前 bg。
   * `animate=true` 時做 350ms cross-fade；create() 第一次設定用 false 直接顯示。
   */
  private applyBg(key: string | undefined, animate: boolean): void {
    if (key === this.currentBgKey) return;
    if (!key || !this.textures.exists(key)) {
      // 沒指定或 texture 不存在 → 不主動清掉現有 bg，保留視覺穩定（避免閃成黑底）
      return;
    }

    const { width, height } = this.scale;
    const next = this.add.image(width / 2, height / 2, key);
    const scale = Math.max(width / next.width, height / next.height);
    next.setScale(scale);
    next.setDepth(0);

    const oldImage = this.currentBgImage;
    if (animate && oldImage) {
      next.setAlpha(0);
      this.tweens.add({
        targets: next,
        alpha: 1,
        duration: 350,
        ease: 'Cubic.easeOut',
      });
      this.tweens.add({
        targets: oldImage,
        alpha: 0,
        duration: 350,
        ease: 'Cubic.easeIn',
        onComplete: () => oldImage.destroy(),
      });
    } else if (oldImage) {
      oldImage.destroy();
    }

    this.currentBgImage = next;
    this.currentBgKey = key;
    this.hasBgImage = true;
  }

  private showLine(): void {
    const line = this.lines[this.current];
    if (!line) return;
    // 切換背景（若該行有指定 lineBgKey）
    const bgForLine = this.lineBgKey?.[this.current];
    if (bgForLine !== undefined) {
      this.applyBg(bgForLine, /*animate*/ true);
    }
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
        img.setDepth(10); // 蓋過 bg 與 35% 黑罩（depth 5）但低於對話框（depth 20）
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
