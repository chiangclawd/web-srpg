import Phaser from 'phaser';
import { VIEW_H, addText, cjkWrap, fontPx, uiZoom, viewW } from '../config';
import { SPEAKERS, type StoryLine } from '../data/story';
import { Button, dimmer, panel } from './widgets';
import { L, T } from '../i18n';
import { sfx } from '../audio';
import { StoryCinema } from './cinema';

/**
 * 角色對話框：立繪（我方在左、敵方在右）＋逐字顯示的台詞。
 * 有劇情插畫（art）時改成電影模式：整張插畫蓋滿畫面並運鏡，說話者的頭像放在對話框左邊。
 * 點擊畫面：打字中 → 直接顯示整句；否則 → 下一句。全部播完或按「略過」呼叫 done。
 */
export function playDialog(
  scene: Phaser.Scene,
  lines: StoryLine[],
  done: () => void,
  opts: { dim?: number; depth?: number; art?: { key: string; id: string } } = {},
): Phaser.GameObjects.Container {
  const w = viewW(scene);
  // 地圖場景的鏡頭有捲動：對話框固定貼在畫面左上角
  const cam = scene.cameras.main;
  const c = scene.add.container(cam.scrollX, cam.scrollY).setDepth(opts.depth ?? 110);
  const cinema = opts.art ? new StoryCinema(scene, opts.art.key, opts.art.id) : null;
  if (cinema) c.add(cinema.layer);
  // 電影模式：遮罩幾乎透明，只負責接點擊
  const dim = dimmer(scene, w, VIEW_H, cinema ? 0.01 : (opts.dim ?? 0.5));
  c.add(dim);
  const bw = Math.min(w - 80, 1100);
  // 手機上整個對話框放大，底邊貼齊畫面下緣
  const z = Math.max(1, Math.min(uiZoom(), (w - 20) / bw));
  const boxY = VIEW_H - 22 - 70 * z;
  const box = scene.add.container(w / 2, boxY).setScale(z);
  box.add(panel(scene, 0, 0, bw, 140, 'ui_dark', 22));
  // 電影模式：左邊留位置給頭像
  const tx0 = cinema ? -bw / 2 + 146 : -bw / 2 + 30;
  const wrapW = cinema ? bw - 176 : bw - 60;
  const name = addText(scene, tx0, -50, '', { size: 24, display: true, color: '#ffd36b' });
  const text = addText(scene, tx0, -14, '', { size: 21, color: '#f4e8cc', wrap: wrapW, lineSpacing: 6 });
  const hint = addText(scene, bw / 2 - 24, 52, '▼', { size: 18, color: '#ffd36b' }).setOrigin(1, 1);
  scene.tweens.add({ targets: hint, y: 46, duration: 500, yoyo: true, repeat: -1 });
  box.add([name, text, hint]);
  c.add(box);
  let portrait: Phaser.GameObjects.Image | null = null;
  let avatar: Phaser.GameObjects.Image | null = null;
  const avFrame = cinema ? scene.add.rectangle(-bw / 2 + 74, 0, 112, 112, 0x000000, 0.35).setStrokeStyle(3, 0xffd36b, 0.9) : null;
  if (avFrame) box.add(avFrame);
  let idx = -1;
  let typing: Phaser.Time.TimerEvent | null = null;
  let full = '';
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    typing?.remove();
    if (cinema) {
      c.disableInteractive();
      dim.disableInteractive();
      scene.tweens.add({
        targets: c,
        alpha: 0,
        duration: 380,
        onComplete: () => {
          cinema.destroy();
          c.destroy();
          done();
        },
      });
      return;
    }
    c.destroy();
    done();
  };
  // 略過鈕放在對話框右上角，不蓋住 HUD 的暫停 / 加速鈕
  c.add(new Button(scene, w / 2 + (bw / 2 - 80) * z, boxY - 70 * z - 24, 130, 40, `${T('skip')} ▶▶`, () => finish(), { color: 'grey', text: { size: 15 } }));
  // 先排好整句的換行再逐字顯示：打字時不會跳行，中文標點也不會落在行首
  const textPx = fontPx(21);
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
    text.setWordWrapWidth(wrapW, true);
    full = cjkWrap(text, L(ln.text)).text;
    text.setWordWrapWidth(wrapW + textPx, true);
    text.setText('');
    portrait?.destroy();
    portrait = null;
    if (cinema) {
      if (idx > 0) cinema.nextShot();
      avatar?.destroy();
      avatar = null;
      avFrame?.setStrokeStyle(3, enemy ? 0xff8a6a : 0xffd36b, 0.9);
      if (scene.textures.exists(`pt_${ln.who}`)) {
        // 立繪裁出臉的部分放進對話框左側的框裡
        const a = scene.add.image(0, 0, `pt_${ln.who}`).setOrigin(0);
        const fw = a.frame.width;
        const fh = a.frame.height;
        const cw = fw * 0.46;
        const cx = fw * 0.27;
        const cy = fh * 0.03;
        a.setCrop(cx, cy, cw, cw);
        const s = 106 / cw;
        a.setScale(s).setPosition(-bw / 2 + 74 - 53 - cx * s, -53 - cy * s);
        a.setAlpha(0);
        box.add(a);
        scene.tweens.add({ targets: a, alpha: 1, duration: 200 });
        avatar = a;
      }
    } else if (scene.textures.exists(`pt_${ln.who}`)) {
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
  // 對話框被外部關掉（換場景、其他彈窗）時停掉打字計時器，免得對已銷毀的文字 setText
  c.once('destroy', () => typing?.remove());
  next();
  return c;
}
