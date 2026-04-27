import Phaser from 'phaser';
import { ACHIEVEMENTS } from '../data/achievements';
import { unlockAchievement } from '../data/save';
import { audio } from './audio';

/**
 * 嘗試解鎖一個成就。若是新解鎖：
 *   - 寫進存檔
 *   - 在當前場景頂部顯示 toast 通知（飄浮 + 淡出）
 *   - 播勝利音效當作獲得提示
 *
 * 回傳是否為「新」解鎖。
 */
export function tryUnlockAchievement(scene: Phaser.Scene, id: string): boolean {
  const newly = unlockAchievement(id);
  if (!newly) return false;
  showToast(scene, id);
  audio.playLevelUp();
  return true;
}

function showToast(scene: Phaser.Scene, id: string): void {
  const ach = ACHIEVEMENTS[id];
  if (!ach) return;
  const w = scene.scale.width;
  const text = scene.add.text(w / 2, 80, `★ 達成成就　${ach.name}`, {
    fontSize: '18px',
    color: '#ffd700',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 5,
    backgroundColor: '#000000c8',
    padding: { left: 14, right: 14, top: 8, bottom: 8 },
  });
  text.setOrigin(0.5, 0);
  text.setDepth(300);
  scene.tweens.add({
    targets: text,
    y: 40,
    alpha: { from: 1, to: 0 },
    duration: 3500,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });
}
