import Phaser from 'phaser';
import { VIEW_H, addText, viewW } from '../config';
import { SPEAKERS, type StoryLine } from '../data/story';
import { Button, dimmer, panel } from './widgets';
import { L, T } from '../i18n';
import { sfx } from '../audio';

/**
 * 角色對話框：立繪（我方在左、敵方在右）＋逐字顯示的台詞。
 * 點擊畫面：打字中 → 直接顯示整句；否則 → 下一句。全部播完或按「略過」呼叫 done。
 */
export function playDialog(scene: Phaser.Scene, lines: StoryLine[], done: () => void, opts: { dim?: number; depth?: number } = {}): Phaser.GameObjects.Container {
  const w = viewW(scene);
  const c = scene.add.container(0, 0).setDepth(opts.depth ?? 110);
  const dim = dimmer(scene, w, VIEW_H, opts.dim ?? 0.5);
  c.add(dim);
  const bw = Math.min(w - 80, 1100);
  const box = scene.add.container(w / 2, VIEW_H - 92);
  box.add(panel(scene, 0, 0, bw, 140, 'ui_dark', 22));
  const name = addText(scene, -bw / 2 + 30, -50, '', { size: 24, display: true, color: '#ffd36b' });
  const text = addText(scene, -bw / 2 + 30, -14, '', { size: 21, color: '#f4e8cc', wrap: bw - 60, lineSpacing: 6 });
  const hint = addText(scene, bw / 2 - 24, 52, '▼', { size: 18, color: '#ffd36b' }).setOrigin(1, 1);
  scene.tweens.add({ targets: hint, y: 46, duration: 500, yoyo: true, repeat: -1 });
  box.add([name, text, hint]);
  c.add(box);
  let portrait: Phaser.GameObjects.Image | null = null;
  let idx = -1;
  let typing: Phaser.Time.TimerEvent | null = null;
  let full = '';
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    typing?.remove();
    c.destroy();
    done();
  };
  c.add(new Button(scene, w - 90, 40, 140, 44, `${T('skip')} ▶▶`, () => finish(), { color: 'grey', text: { size: 16 } }));
  const next = () => {
    if (typing && text.text.length < full.length) {
      typing.remove();
      typing = null;
      text.setText(full);
      return;
    }
    idx++;
    if (idx >= lines.length) {
      finish();
      return;
    }
    const ln = lines[idx];
    const sp = SPEAKERS[ln.who];
    const enemy = !!sp?.enemy;
    name.setText(L(sp?.name ?? { zh: ln.who, en: ln.who }));
    name.setColor(enemy ? '#ff8a6a' : '#ffd36b');
    full = L(ln.text);
    text.setText('');
    portrait?.destroy();
    portrait = null;
    if (scene.textures.exists(`pt_${ln.who}`)) {
      const px = enemy ? w - 210 : 210;
      const p = scene.add.image(px + (enemy ? 60 : -60), VIEW_H - 150, `pt_${ln.who}`).setOrigin(0.5, 1);
      p.setScale(Math.min(400 / p.frame.height, 380 / p.frame.width));
      if (enemy) p.setFlipX(true);
      p.setAlpha(0);
      c.addAt(p, 1);
      scene.tweens.add({ targets: p, x: px, alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
      portrait = p;
    }
    let n = 0;
    typing = scene.time.addEvent({
      delay: 28,
      repeat: Math.max(0, full.length - 1),
      callback: () => {
        n++;
        text.setText(full.slice(0, n));
        if (n % 3 === 0) sfx.play('click', 0.15);
      },
    });
  };
  dim.on('pointerdown', () => next());
  next();
  return c;
}
