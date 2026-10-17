import Phaser from 'phaser';
import type { LevelDef } from '../sim/defs';
import { TEX } from '../config';
import { T } from '../i18n';
import { sfx } from '../audio';
import { save, persist } from '../save';
import { EGG_LINES, levelEggs, type Egg } from '../data/eggs';
import { DEPTH, type Fx } from './Fx';
import type { Bubbles } from './Bubbles';

/** 戰場上的彩蛋：處理點擊與各種小動畫 */
export class EggLayer {
  private eggs: Egg[];
  private cool = new Map<string, number>();
  private sheep = new Map<string, { img: Phaser.GameObjects.Image; taps: number; gone: boolean }>();

  constructor(
    private scene: Phaser.Scene,
    level: LevelDef,
    private fx: Fx,
    private bubbles: Bubbles,
  ) {
    this.eggs = levelEggs(level);
    for (const e of this.eggs) if (e.kind === 'sheep') this.spawnSheep(e);
  }

  /** 點在彩蛋上就播動畫並回傳 true */
  tap(x: number, y: number): boolean {
    const e = this.eggs.find((g) => Math.hypot(g.x - x, (g.y - y) * 1.2) < g.r);
    if (!e) return false;
    const now = this.scene.time.now;
    if ((this.cool.get(e.id) ?? 0) > now) return true;
    this.cool.set(e.id, now + (e.kind === 'sheep' ? 250 : 1600));
    this.play(e);
    if (e.kind !== 'sheep') this.found(e);
    return true;
  }

  private found(e: Egg): void {
    const sv = save();
    sv.eggs ??= [];
    if (sv.eggs.includes(e.id)) return;
    sv.eggs.push(e.id);
    sv.gems += 1;
    persist();
    // 寶石字樣出現在物件下方，不蓋住頭上的對話泡泡
    this.scene.time.delayedCall(300, () => {
      this.fx.floatText(e.x, e.y + 24, `+1 ${T('gems')}`, '#d9a8ff', 18);
      sfx.play('sparkle', 0.6);
    });
  }

  private say(e: Egg, y: number): void {
    this.bubbles.say(`egg_${e.id}`, e.x, y, EGG_LINES[e.kind], 1, true);
  }

  private play(e: Egg): void {
    const s = this.scene;
    switch (e.kind) {
      case 'knock':
      case 'castle':
        sfx.play('thud', 0.5);
        s.time.delayedCall(220, () => sfx.play('thud', 0.5));
        this.fx.smokePuff(e.x, e.y + 16, 3);
        s.time.delayedCall(600, () => this.say(e, e.y - 46));
        break;
      case 'camp':
        this.fx.fireBurst(e.x, e.y + 20, 8);
        sfx.play('whoosh', 0.4);
        this.say(e, e.y - 50);
        break;
      case 'birds':
        this.birds(e);
        break;
      case 'fish':
        this.fish(e, false);
        break;
      case 'ice':
        this.fish(e, true);
        break;
      case 'peek':
      case 'troll':
        this.peek(e);
        break;
      case 'bats':
        this.bats(e);
        break;
      case 'altar':
        this.fx.ring(e.x, e.y, 70, 0xb070ff, 600);
        sfx.play('sparkle', 0.5);
        this.say(e, e.y - 50);
        break;
      case 'sheep':
        this.tapSheep(e);
        break;
    }
  }

  /** 樹叢驚起一群鳥，往外飛走 */
  private birds(e: Egg): void {
    const s = this.scene;
    sfx.play('whoosh', 0.5);
    const n = Phaser.Math.Between(4, 6);
    for (let i = 0; i < n; i++) {
      const b = s.add.image(e.x + Phaser.Math.Between(-20, 20), e.y + Phaser.Math.Between(-30, 0), 'fx_bird').setDepth(DEPTH.float - 15);
      const k = (1 + Math.random() * 0.4) / TEX;
      b.setScale(k);
      const dir = Math.random() < 0.5 ? -1 : 1;
      b.setFlipX(dir < 0);
      s.tweens.add({ targets: b, scaleY: k * 0.4, duration: 110 + i * 10, yoyo: true, repeat: -1 });
      s.tweens.add({
        targets: b,
        x: b.x + dir * Phaser.Math.Between(240, 420),
        y: b.y - Phaser.Math.Between(180, 320),
        alpha: 0,
        delay: i * 70,
        duration: 2400,
        ease: 'Sine.easeIn',
        onComplete: () => b.destroy(),
      });
    }
    this.fx.leaves(e.x, e.y - 20);
  }

  /** 魚跳出水面（結冰的湖：先敲出冰洞） */
  private fish(e: Egg, ice: boolean): void {
    const s = this.scene;
    if (ice) {
      sfx.play('freeze', 0.5);
      this.fx.ring(e.x, e.y, 34, 0xffffff, 400);
      this.fx.snowBurst(e.x, e.y, 8);
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    const f = s.add.image(e.x - dir * 24, e.y, 'fx_fish').setScale(1.2 / TEX).setDepth(DEPTH.float - 15).setFlipX(dir > 0);
    sfx.play('splash', 0.25);
    this.fx.ring(e.x - dir * 24, e.y + 4, 22, 0xbfefff, 360);
    const arc = { t: 0 };
    s.tweens.add({
      targets: arc,
      t: 1,
      duration: 760,
      onUpdate: () => {
        f.x = e.x - dir * 24 + dir * 48 * arc.t;
        f.y = e.y - Math.sin(arc.t * Math.PI) * 70;
        f.setAngle(dir * (arc.t - 0.5) * 120);
      },
      onComplete: () => {
        f.destroy();
        sfx.play('splash', 0.2);
        this.fx.ring(e.x + dir * 24, e.y + 4, 22, 0xbfefff, 360);
        this.fx.snowBurst(e.x + dir * 24, e.y, 5);
      },
    });
  }

  /** 怪物從石頭／水裡探出頭，說句話再縮回去 */
  private peek(e: Egg): void {
    const s = this.scene;
    const key = e.sprite && s.textures.exists(e.sprite) ? e.sprite : 'mon_goblin';
    const img = s.add.image(e.x + Phaser.Math.Between(-16, 16), e.y + 14, key).setOrigin(0.5, 1).setDepth(e.y + 2).setAlpha(0);
    const h = e.kind === 'troll' ? 60 : 50;
    img.setScale(h / img.frame.height);
    sfx.play('click', 0.5);
    s.tweens.add({ targets: img, alpha: 1, y: e.y - 6, duration: 260, ease: 'Back.easeOut' });
    s.tweens.add({ targets: img, angle: { from: -8, to: 8 }, duration: 180, yoyo: true, repeat: 3, delay: 260 });
    this.say(e, e.y - h - 20);
    s.tweens.add({ targets: img, alpha: 0, y: e.y + 14, duration: 300, delay: 1700, onComplete: () => img.destroy() });
  }

  /** 廢墟裡飛出一群蝙蝠 */
  private bats(e: Egg): void {
    const s = this.scene;
    sfx.play('whoosh', 0.5);
    for (let i = 0; i < 5; i++) {
      const b = s.add.image(e.x, e.y, 'mon_bat').setDepth(DEPTH.float - 15);
      b.setScale(24 / b.frame.height);
      const a = -Math.PI / 2 + (i - 2) * 0.45 + (Math.random() - 0.5) * 0.3;
      const d = Phaser.Math.Between(220, 340);
      s.tweens.add({ targets: b, scaleY: b.scaleY * 0.6, duration: 90, yoyo: true, repeat: -1 });
      s.tweens.add({
        targets: b,
        x: e.x + Math.cos(a) * d,
        y: e.y + Math.sin(a) * d,
        alpha: 0,
        delay: i * 90,
        duration: 1600,
        onComplete: () => b.destroy(),
      });
    }
  }

  private spawnSheep(e: Egg): void {
    const s = this.scene;
    const img = s.add.image(e.x, e.y, 'mon_sheep').setOrigin(0.5, 1).setDepth(e.y);
    img.setScale(34 / img.frame.height);
    const st = { img, taps: 0, gone: false };
    this.sheep.set(e.id, st);
    // 低頭吃草：偶爾轉身、跳一下
    s.time.addEvent({
      delay: 3200,
      loop: true,
      callback: () => {
        if (st.gone || Math.random() < 0.5) return;
        img.setFlipX(!img.flipX);
        s.tweens.add({ targets: img, y: e.y - 6, duration: 140, yoyo: true });
      },
    });
  }

  /** 點綿羊：咩一聲；連點五下會「砰」一聲變成一團羊毛（之後會再長回來） */
  private tapSheep(e: Egg): void {
    const st = this.sheep.get(e.id);
    if (!st || st.gone) return;
    const s = this.scene;
    st.taps++;
    if (st.taps < 5) {
      sfx.play('baa', 0.7);
      this.say(e, e.y - 48);
      s.tweens.add({ targets: st.img, y: e.y - 10, duration: 120, yoyo: true });
      s.tweens.add({ targets: st.img, scaleX: st.img.scaleX * 1.12, scaleY: st.img.scaleY * 1.12, duration: 120, yoyo: true });
      return;
    }
    st.gone = true;
    st.taps = 0;
    sfx.play('explosion', 0.4);
    this.fx.smokePuff(e.x, e.y - 14, 8);
    this.fx.snowBurst(e.x, e.y - 16, 16);
    st.img.setVisible(false);
    this.found(e);
    s.time.delayedCall(30000, () => {
      st.gone = false;
      st.img.setVisible(true).setAlpha(0);
      s.tweens.add({ targets: st.img, alpha: 1, duration: 600 });
    });
  }
}
