import Phaser from 'phaser';
import { CHAPTERS, FIRST_CHAPTER_ID } from '../data/chapters';
import { hasSave, loadSave, clearSave, getUnlockedAchievements } from '../data/save';
import { t, toggleLang } from '../utils/i18n';
import { audio } from '../utils/audio';
import { ACHIEVEMENTS } from '../data/achievements';
import { addHitRect } from '../utils/uiHit';
import { getThemeColors } from '../utils/settings';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // 標題畫面 BGM（peaceful drone）
    audio.startBgm('peaceful');

    const theme = getThemeColors();
    this.add.rectangle(0, 0, width, height, theme.bg).setOrigin(0);

    // 若有 cg_title 大圖則用作背景，並蓋一層半透明黑讓文字可讀
    const hasTitleCg = this.textures.exists('cg_title');
    if (hasTitleCg) {
      const bg = this.add.image(width / 2, height / 2, 'cg_title');
      // cover：縮到完全填滿畫布
      const scale = Math.max(width / bg.width, height / bg.height);
      bg.setScale(scale);
      // 半透明黑罩讓文字保持可讀
      this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0);
    } else {
      // 沒大圖時，用裝飾線條補空
      const topLine = this.add.graphics();
      topLine.lineStyle(3, 0x4a90e2, 0.8);
      topLine.lineBetween(width * 0.2, height * 0.22, width * 0.8, height * 0.22);
      const botLine = this.add.graphics();
      botLine.lineStyle(3, 0x4a90e2, 0.8);
      botLine.lineBetween(width * 0.2, height * 0.78, width * 0.8, height * 0.78);
    }

    this.add
      .text(width / 2, height / 2 - 110, '西方戰術 SRPG', {
        fontSize: '54px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 50, t('title.subtitle'), {
        fontSize: '16px',
        color: '#bbbbbb',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const hasExisting = hasSave();
    const save = hasExisting ? loadSave() : null;

    let y = height / 2 + 0;

    this.makeMenuButton(width / 2, y, t('title.newGame'), () => this.startNewGame());
    y += 56;

    if (hasExisting && save) {
      const ch = CHAPTERS[save.nextChapterId];
      const label = ch
        ? t('title.continue', { n: ch.number, title: ch.title })
        : t('title.continueShort');
      this.makeMenuButton(width / 2, y, label, () => this.continueGame(), '#ffd700');
      y += 56;

      this.makeMenuButton(
        width / 2,
        y,
        t('title.clearSave'),
        () => {
          clearSave();
          this.scene.restart();
        },
        '#aa6666'
      );
      y += 56;
    }

    // 語言切換
    this.makeMenuButton(width / 2, y, t('title.lang'), () => {
      toggleLang();
      this.scene.restart();
    }, '#88aaff');
    y += 56;

    // 成就查看
    const unlocked = getUnlockedAchievements();
    const totalAch = Object.keys(ACHIEVEMENTS).length;
    this.makeMenuButton(
      width / 2,
      y,
      `★ 成就（${unlocked.size} / ${totalAch}）`,
      () => this.openAchievementsOverlay(),
      '#ffd700'
    );
    y += 56;

    // 隱藏章節：完成 TRUE END 後解鎖修羅戰場
    if (unlocked.has('true_end')) {
      this.makeMenuButton(
        width / 2,
        y,
        '☠ 修羅戰場（隱藏）',
        () => this.startChallengeChapter(),
        '#ff6688'
      );
    }

    this.add
      .text(
        width / 2,
        height - 36,
        hasExisting ? t('title.hintHasSave') : t('title.hintNoSave'),
        {
          fontSize: '15px',
          color: '#888888',
        }
      )
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown', () => {
      if (hasExisting) this.continueGame();
      else this.startNewGame();
    });
  }

  private makeMenuButton(
    cx: number,
    cy: number,
    label: string,
    onClick: () => void,
    color: string = '#7ed1ff'
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(cx, cy, label, {
        fontSize: '24px',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    // 透明 Rectangle 接管輸入（避開 Text setInteractive 的 origin 0.5 偏移）
    const w = Math.max(btn.width + 30, 140);
    const h = btn.height + 14;
    addHitRect(
      this,
      cx,
      cy,
      w,
      h,
      onClick,
      () => btn.setColor('#ffffff'),
      () => btn.setColor(color)
    );
    return btn;
  }

  private startNewGame(): void {
    const ch = CHAPTERS[FIRST_CHAPTER_ID]!;
    this.scene.start('CutsceneScene', {
      cutsceneId: ch.prologueCutsceneId,
      next: {
        scene: 'HubScene',
        data: { chapterId: ch.id },
      },
    });
  }

  private openAchievementsOverlay(): void {
    const { width, height } = this.scale;
    const items: Phaser.GameObjects.GameObject[] = [];
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92);
    bg.setInteractive();
    items.push(bg);

    const title = this.add
      .text(width / 2, 50, '— 成就一覽 —', {
        fontSize: '24px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    items.push(title);

    const unlocked = getUnlockedAchievements();
    let y = 100;
    for (const ach of Object.values(ACHIEVEMENTS)) {
      const isUnlocked = unlocked.has(ach.id);
      const showHidden = ach.hidden && !isUnlocked;
      const name = showHidden ? '???' : ach.name;
      const desc = showHidden ? '???（達成後揭曉）' : ach.desc;
      const color = isUnlocked ? '#ffd700' : '#666666';
      const icon = isUnlocked ? '★' : '☆';
      const line = `${icon} ${name}　—　${desc}`;
      const txt = this.add.text(60, y, line, {
        fontSize: '14px',
        color,
        fontStyle: isUnlocked ? 'bold' : 'normal',
      });
      items.push(txt);
      y += 26;
    }

    const closeBtn = this.add
      .text(width / 2, height - 40, '✕ 關閉', {
        fontSize: '18px',
        color: '#cc7777',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    items.push(closeBtn);
    const closeHit = this.add.rectangle(width / 2, height - 40, 100, 32, 0x000000, 0);
    closeHit.setInteractive({ useHandCursor: true });
    closeHit.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeHit.on('pointerout', () => closeBtn.setColor('#cc7777'));
    items.push(closeHit);

    const overlay = this.add.container(0, 0, items);
    overlay.setDepth(200);
    closeHit.on('pointerdown', () => overlay.destroy());
  }

  private startChallengeChapter(): void {
    const ch = CHAPTERS['chapter11'];
    if (!ch) return;
    this.scene.start('CutsceneScene', {
      cutsceneId: ch.prologueCutsceneId,
      next: {
        scene: 'HubScene',
        data: { chapterId: ch.id },
      },
    });
  }

  private continueGame(): void {
    const save = loadSave();
    if (!save) {
      this.startNewGame();
      return;
    }
    const ch = CHAPTERS[save.nextChapterId];
    if (!ch) {
      this.startNewGame();
      return;
    }
    this.scene.start('CutsceneScene', {
      cutsceneId: ch.prologueCutsceneId,
      next: {
        scene: 'HubScene',
        data: { chapterId: ch.id },
      },
    });
  }
}
