import Phaser from 'phaser';

/**
 * 在 (cx, cy) 加一個 w×h 的透明 Rectangle 並 setInteractive。
 * 用於修正 Phaser Container/Text 在 origin=0.5 時 setInteractive 偏移到左上角的 quirk。
 *
 * 用法：
 *   const hit = addHitRect(this, cx, cy, w, h, () => doSomething());
 *
 * 若想分別 hover/unhover：
 *   addHitRect(this, ..., onClick, () => onHover(), () => onUnhover());
 */
export function addHitRect(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  onClick: () => void,
  onHover?: () => void,
  onUnhover?: () => void
): Phaser.GameObjects.Rectangle {
  const hit = scene.add.rectangle(cx, cy, w, h, 0x000000, 0);
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerdown', onClick);
  if (onHover) hit.on('pointerover', onHover);
  if (onUnhover) hit.on('pointerout', onUnhover);
  return hit;
}
