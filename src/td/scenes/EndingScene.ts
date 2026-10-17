import Phaser from 'phaser';
import { PLAY_X0, VIEW_H, WORLD_W, bgScale, addText, setupCamera, viewW } from '../config';
import { PAINTED_LEVELS, levelArtKey, paintLevel } from '../art/terrain';
import { EPILOGUE, SIDE_EPILOGUE } from '../data/story';
import { ACHIEVEMENTS } from '../data/achievements';
import { LEVELS } from '../data/levels';
import { Button } from '../ui/widgets';
import { playDialog } from '../ui/dialog';
import { L, T, getLang } from '../i18n';
import { save, totalStars } from '../save';
import { sfx } from '../audio';
import { MENU_LEVEL } from './MenuScene';

/** 慶功的角色（由左到右），亞瑟站中間 */
const CAST = ['gary', 'elena', 'lila', 'arthur', 'rain', 'aria', 'viktor'];
/** 名單捲動區域的下緣 */
const ROLL_BOTTOM = 500;
const FIREWORK_TINTS = [0xffd84a, 0xff6a5a, 0x6ad0ff, 0x9aff7a, 0xe08aff];

/** 結局：尾聲對話 → 慶功 + 製作群名單 */
export class EndingScene extends Phaser.Scene {
  private epilogue = false;
  /** 播哪一段尾聲：主線（終焉之門）或外傳（熔岩火山口） */
  private story: 'main' | 'side' = 'main';
  private back: 'Map' | 'Menu' = 'Map';
  private roll: Phaser.GameObjects.Container | null = null;
  private rollEnd = 0;
  private held = false;
  private finished = false;
  private bursts: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor() {
    super('Ending');
  }

  init(data: { epilogue?: boolean; story?: 'main' | 'side'; back?: 'Map' | 'Menu' }): void {
    this.epilogue = !!data.epilogue;
    this.story = data.story ?? 'main';
    this.back = data.back ?? 'Map';
    this.roll = null;
    this.held = false;
    this.finished = false;
    this.bursts = [];
  }

  preload(): void {
    // 慶功場景用手繪的邊境村莊當背景（第一關的戰場圖）
    if (PAINTED_LEVELS.has('l1') && !this.textures.exists(levelArtKey('l1'))) this.load.image(levelArtKey('l1'), 'assets/levels/l1.webp');
  }

  create(): void {
    setupCamera(this);
    const w = viewW(this);
    if (this.textures.exists(levelArtKey('l1'))) {
      const img = this.add.image((w - WORLD_W) / 2, 0, levelArtKey('l1')).setOrigin(0);
      img.setScale(WORLD_W / img.width, VIEW_H / img.height);
    } else {
      const bgS = bgScale(1.25);
      if (!this.textures.exists('bg_menu')) this.textures.addCanvas('bg_menu', paintLevel(MENU_LEVEL, WORLD_W, PLAY_X0, bgS));
      this.add.image((w - WORLD_W) / 2, 0, 'bg_menu').setOrigin(0).setScale(1 / bgS);
    }
    // 黃昏慶典：整體壓暗、上方夜空、地平線暖光，讓煙火更醒目
    const sky = this.add.graphics().setDepth(1);
    sky.fillStyle(0x1a1030, 0.38);
    sky.fillRect(0, 0, w, VIEW_H);
    sky.fillGradientStyle(0x0c1440, 0x0c1440, 0x2a1a50, 0x2a1a50, 0.85, 0.85, 0, 0);
    sky.fillRect(0, 0, w, 300);
    sky.fillGradientStyle(0xff9a4a, 0xff9a4a, 0xff9a4a, 0xff9a4a, 0, 0, 0.28, 0.28);
    sky.fillRect(0, 380, w, VIEW_H - 380);
    this.castCheer(w);
    // 煙火發射器（不同顏色各一個，重複使用）
    this.bursts = FIREWORK_TINTS.map((tint) =>
      this.add.particles(0, 0, 'fx_spark', {
        emitting: false,
        lifespan: { min: 900, max: 1500 },
        speed: { min: 90, max: 250 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 1, end: 0.2 },
        gravityY: 110,
        tint,
        blendMode: 'ADD',
      }).setDepth(900),
    );
    this.time.addEvent({ delay: 900, loop: true, callback: () => this.firework(w) });

    sfx.playBgm('title');
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.input.on('pointerdown', () => (this.held = true));
    this.input.on('pointerup', () => (this.held = false));
    if (this.epilogue) {
      this.time.delayedCall(700, () => playDialog(this, this.story === 'side' ? SIDE_EPILOGUE : EPILOGUE, () => this.credits(), { dim: 0.25, depth: 1000 }));
    } else {
      this.time.delayedCall(400, () => this.credits());
    }
  }

  private castCheer(w: number): void {
    const gap = Math.min(110, (w - 200) / CAST.length);
    CAST.forEach((id, i) => {
      const key = `sp_${id}`;
      if (!this.textures.exists(key)) return;
      const x = w / 2 + (i - (CAST.length - 1) / 2) * gap;
      const y = 606 - Math.abs(i - 3) * 6;
      this.add.image(x, y, 'fx_shadow').setScale(0.9, 0.9).setAlpha(0.8).setDepth(y - 1);
      const img = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
      img.setScale((id === 'arthur' ? 96 : id === 'aria' ? 92 : 80) / img.frame.height);
      // 面向中央
      img.setFlipX(i > 3);
      this.tweens.add({
        targets: img,
        y: y - 14,
        duration: 260,
        yoyo: true,
        repeat: -1,
        repeatDelay: 900 + ((i * 337) % 700),
        delay: i * 160,
        ease: 'Quad.easeOut',
      });
    });
  }

  private firework(w: number): void {
    const x = Phaser.Math.Between(Math.round(w * 0.12), Math.round(w * 0.88));
    const y = Phaser.Math.Between(70, 250);
    const k = Phaser.Math.Between(0, this.bursts.length - 1);
    const e = this.bursts[k];
    e.explode(48, x, y);
    const flash = this.add.image(x, y, 'fx_soft').setDepth(899).setBlendMode('ADD').setTint(FIREWORK_TINTS[k]).setScale(0.4);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    sfx.play('sparkle', 0.25);
  }

  private credits(): void {
    const w = viewW(this);
    // 名單只在上方區域捲動，下方留給慶功的角色
    const top = ROLL_BOTTOM;
    const sw = Math.min(w, 760);
    const shade = this.add.graphics().setDepth(950).setAlpha(0);
    shade.fillStyle(0x120a04, 0.62);
    shade.fillRect(w / 2 - sw / 2, 0, sw, top - 40);
    shade.fillGradientStyle(0x120a04, 0x120a04, 0x120a04, 0x120a04, 0.62, 0.62, 0, 0);
    shade.fillRect(w / 2 - sw / 2, top - 40, sw, 50);
    this.tweens.add({ targets: shade, alpha: 1, duration: 900 });
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff);
    maskG.fillRect(0, 0, w, top);
    const sv = save();
    const maxStars = LEVELS.length * 5;
    const c = this.add.container(w / 2, top + 30).setDepth(960);
    c.setMask(maskG.createGeometryMask());
    let y = 0;
    const head = (zh: string, en: string) => {
      y += 34;
      c.add(addText(this, 0, y, L({ zh, en }), { size: 22, display: true, color: '#ffd36b', strokeW: 4 }).setOrigin(0.5));
      y += 36;
    };
    const line = (s: string, size = 20) => {
      c.add(addText(this, 0, y, s, { size, color: '#f4e8cc', strokeW: 3 }).setOrigin(0.5));
      y += size + 14;
    };
    c.add(addText(this, 0, y, T('title'), { size: 64, display: true, color: '#ffd36b', strokeW: 10, stroke: '#3a1a04' }).setOrigin(0.5));
    y += 56;
    line(getLang() === 'zh' ? 'KINGDOM BASTION' : '王國防線', 22);
    y += 20;
    head('你的旅程', 'Your Journey');
    line(`${L({ zh: '星數', en: 'Stars' })}  ${totalStars()} / ${maxStars}`);
    line(`${L({ zh: '擊敗敵人', en: 'Enemies defeated' })}  ${sv.stats.kills.toLocaleString()}`);
    line(`${L({ zh: '勝利場次', en: 'Victories' })}  ${sv.stats.victories}`);
    line(`${L({ zh: '建造防禦塔', en: 'Towers built' })}  ${(sv.stats.towers ?? 0).toLocaleString()}`);
    line(`${T('achievements')}  ${sv.achievements.length} / ${ACHIEVEMENTS.length}`);
    head('企劃・程式・美術', 'Design, Code & Art');
    line('Claude Code');
    head('遊戲引擎', 'Engine');
    line('Phaser 3');
    head('角色立繪・音樂・音效', 'Character Art, Music & Sound');
    line(L({ zh: 'web-srpg 專案素材', en: 'web-srpg project assets' }));
    head('字型', 'Font');
    line('Luckiest Guy — Astigmatic (SIL OFL)');
    head('特別感謝', 'Special Thanks');
    line(L({ zh: '每一位守住防線的指揮官', en: 'Every commander who held the line' }));
    y += 90;
    const thanks = addText(this, 0, y, L({ zh: '感謝遊玩！', en: 'Thanks for playing!' }), { size: 48, display: true, color: '#ffe066', strokeW: 8 }).setOrigin(0.5);
    c.add(thanks);
    this.roll = c;
    // 最後一行停在上方區域中央
    this.rollEnd = top / 2 - 40 - y;
    const skip = new Button(this, w - 90, 40, 140, 44, `${T('skip')} ▶▶`, () => this.finishRoll(), { color: 'grey', text: { size: 16 } }).setDepth(1100);
    skip.setName('skip');
  }

  private finishRoll(): void {
    if (this.finished || !this.roll) return;
    this.finished = true;
    this.roll.y = this.rollEnd;
    (this.children.getByName('skip') as Button | null)?.destroy();
    const w = viewW(this);
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 220, () => this.firework(w));
    const btn = new Button(this, w / 2, ROLL_BOTTOM / 2 + 50, 220, 56, this.back === 'Map' ? T('toMap') : T('back'), () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(420, () => this.scene.start(this.back));
    }, { color: 'green' }).setDepth(1100);
    btn.setAlpha(0);
    this.tweens.add({ targets: btn, alpha: 1, duration: 400 });
  }

  override update(_t: number, dms: number): void {
    if (!this.roll || this.finished) return;
    this.roll.y -= (dms / 1000) * (this.held ? 240 : 48);
    if (this.roll.y <= this.rollEnd) this.finishRoll();
  }
}
