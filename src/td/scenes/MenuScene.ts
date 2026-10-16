import Phaser from 'phaser';
import { PLAY_W, PLAY_X0, RS, TEX, VIEW_H, WORLD_W, addText, setupCamera, viewW } from '../config';
import { paintLevel } from '../art/terrain';
import type { LevelDef } from '../sim/defs';
import { TW_BASE, TW_H } from '../art/towers';
import { Button, IconButton, dimmer, panel } from '../ui/widgets';
import { T, getLang, setLang } from '../i18n';
import { save, persist, resetProgress } from '../save';
import { sfx } from '../audio';
import { Path } from '../sim/Path';

/** 標題畫面背景用的裝飾地圖 */
const MENU_LEVEL: LevelDef = {
  id: 'menu',
  index: -1,
  name: { zh: '', en: '' },
  desc: { zh: '', en: '' },
  theme: 'grass',
  seed: 7,
  paths: [
    [
      { x: 1340, y: 470 },
      { x: 1100, y: 520 },
      { x: 900, y: 610 },
      { x: 640, y: 600 },
      { x: 420, y: 520 },
      { x: 240, y: 560 },
      { x: -50, y: 600 },
    ],
  ],
  spots: [
    { x: 1010, y: 460 },
    { x: 760, y: 520 },
    { x: 330, y: 470 },
  ],
  startGold: 0,
  lives: 20,
  waves: [],
  heroStart: { x: 0, y: 0 },
  mapPos: { x: 0, y: 0 },
  decor: [
    { kind: 'castle', x: 120, y: 470 },
    { kind: 'house', x: 520, y: 680 },
    { kind: 'house', x: 1180, y: 680, scale: 0.9 },
    { kind: 'trees', x: 640, y: 400, n: 6, r: 160 },
    { kind: 'clear', x: 640, y: 230, r: 300 },
    { kind: 'lake', x: 980, y: 380, rx: 80, ry: 30 },
  ],
};

export class MenuScene extends Phaser.Scene {
  private ui: Phaser.GameObjects.GameObject[] = [];
  private walkers: { img: Phaser.GameObjects.Image; d: number; speed: number; path: Path; right: boolean }[] = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    setupCamera(this);
    const bgScale = RS >= 2 ? 1.25 : 1;
    if (!this.textures.exists('bg_menu')) this.textures.addCanvas('bg_menu', paintLevel(MENU_LEVEL, WORLD_W, PLAY_X0, bgScale));
    this.add.image(0, 0, 'bg_menu').setOrigin(0).setScale(1 / bgScale).setName('bg');
    // 幾座裝飾塔
    const arts = ['tw_archer_3', 'tw_mage_3', 'tw_barracks_3'];
    MENU_LEVEL.spots.forEach((s, i) => {
      this.add
        .image(s.x + PLAY_X0, s.y, arts[i])
        .setOrigin(0.5, TW_BASE / TW_H)
        .setScale(1 / TEX)
        .setDepth(s.y)
        .setName('tower');
    });
    // 走路的敵人（氣氛）
    const path = new Path(MENU_LEVEL.paths[0].map((p) => ({ x: p.x + PLAY_X0, y: p.y })));
    const kinds = ['sp_enemy_sword', 'mon_goblin', 'sp_enemy_lance', 'mon_wolf', 'mon_goblin', 'sp_enemy_sword'];
    kinds.forEach((k, i) => {
      const img = this.add.image(0, 0, k).setOrigin(0.5, 1);
      img.setScale((k.startsWith('mon_') ? 34 : 44) / img.frame.height);
      this.walkers.push({ img, d: i * 170, speed: 26 + (i % 3) * 6, path, right: k.startsWith('mon_') });
    });
    // 暗化上方讓標題突出
    const g = this.add.graphics().setName('shade');
    g.fillGradientStyle(0x120804, 0x120804, 0x120804, 0x120804, 0.75, 0.75, 0, 0);
    g.fillRect(0, 0, WORLD_W, 380);
    g.setDepth(1000);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    sfx.playBgm('peaceful');
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private build(): void {
    this.ui.forEach((o) => o.destroy());
    this.ui = [];
    const w = viewW(this);
    this.cameras.main.setScroll(-(w - WORLD_W) / 2, 0);
    const cx = WORLD_W / 2;
    const title = addText(this, cx, 120, T('title'), { size: 92, display: true, color: '#ffd36b', strokeW: 12, stroke: '#3a1a04' }).setOrigin(0.5).setDepth(2000);
    const grd = title.context.createLinearGradient(0, 0, 0, title.height);
    grd.addColorStop(0.2, '#fff3b0');
    grd.addColorStop(0.6, '#ffc040');
    grd.addColorStop(1, '#d07a10');
    title.setFill(grd);
    const sub = addText(this, cx, 196, getLang() === 'zh' ? 'KINGDOM BASTION' : '王國防線', { size: 26, display: true, color: '#f4e2b8', strokeW: 6 }).setOrigin(0.5).setDepth(2000);
    this.tweens.add({ targets: title, y: 126, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const start = new Button(this, cx, 300, 280, 74, T('start'), () => this.go(), { color: 'green', text: { size: 34 } }).setDepth(2000);
    this.tweens.add({ targets: start, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const set = new Button(this, cx - 82, 386, 150, 52, T('settings'), () => this.settings(), { color: 'wood' }).setDepth(2000);
    const srpg = new Button(this, cx + 82, 386, 150, 52, T('srpg'), () => (window.location.href = './'), { color: 'blue', text: { size: 18 } }).setDepth(2000);
    const lang = new Button(this, cx + w / 2 - 70, 40, 100, 44, getLang() === 'zh' ? 'EN' : '中文', () => {
      setLang(getLang() === 'zh' ? 'en' : 'zh');
      save().settings.lang = getLang();
      persist();
      this.build();
    }, { color: 'grey' }).setDepth(2000);
    const ver = addText(this, cx + w / 2 - 12, VIEW_H - 10, `v${__APP_VERSION__} · ${__GIT_SHA__}`, { size: 13, color: '#e8d8b8', strokeW: 3 }).setOrigin(1, 1).setDepth(2000);
    this.ui.push(title, sub, start, set, srpg, lang, ver);
  }

  private go(): void {
    sfx.play('horn', 0.6);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(360, () => this.scene.start('Map'));
  }

  private settings(): void {
    const w = viewW(this);
    const c = this.add.container(WORLD_W / 2, VIEW_H / 2).setDepth(5000);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.55).setPosition(-w, -VIEW_H));
    c.add(panel(this, 0, 0, 460, 440));
    c.add(addText(this, 0, -178, T('settings'), { size: 32, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    const sv = save();
    const label = (y: number, text: string) =>
      c.add(addText(this, -170, y, text, { size: 22, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
    const row = (y: number, text: string, key: 'music' | 'sfx') => {
      label(y, text);
      const b = new IconButton(this, 140, y, 50, sv.settings[key] > 0 ? 'ic_sound_on' : 'ic_sound_off', () => {
        sv.settings[key] = sv.settings[key] > 0 ? 0 : key === 'music' ? 0.6 : 0.8;
        persist();
        sfx.refreshVolumes();
        b.setIcon(sv.settings[key] > 0 ? 'ic_sound_on' : 'ic_sound_off');
      });
      c.add(b);
    };
    row(-114, T('music'), 'music');
    row(-56, T('sound'), 'sfx');
    label(2, T('shake'));
    const shakeBtn = new IconButton(this, 140, 2, 50, sv.settings.shake ? 'ic_check' : 'ic_close', () => {
      sv.settings.shake = !sv.settings.shake;
      persist();
      shakeBtn.setIcon(sv.settings.shake ? 'ic_check' : 'ic_close');
      if (sv.settings.shake) this.cameras.main.shake(160, 0.004);
    });
    c.add(shakeBtn);
    // 清除進度：按兩次才生效
    let armed = false;
    const wipe = new Button(this, 0, 80, 240, 46, T('resetProgress'), () => {
      if (!armed) {
        armed = true;
        wipe.label.setText(T('confirmWipe'));
        this.time.delayedCall(3000, () => {
          if (!wipe.active) return;
          armed = false;
          wipe.label.setText(T('resetProgress'));
        });
        return;
      }
      resetProgress();
      c.destroy();
      this.cameras.main.flash(250, 255, 255, 255);
    }, { color: 'red', text: { size: 18 } });
    c.add(wipe);
    c.add(new Button(this, 0, 160, 200, 52, 'OK', () => c.destroy(), { color: 'green' }));
    c.setScale(0.8);
    this.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
  }

  override update(_t: number, dms: number): void {
    const dt = dms / 1000;
    for (const wk of this.walkers) {
      wk.d += wk.speed * dt;
      if (wk.d > wk.path.length) wk.d = 0;
      const p = wk.path.posAt(wk.d, 0);
      const bob = Math.abs(Math.sin(wk.d * 0.25)) * 3;
      wk.img.setPosition(p.x, p.y - bob).setDepth(p.y);
      const tan = wk.path.tangentAt(wk.d);
      wk.img.setFlipX(tan.x > 0 !== wk.right);
    }
    void PLAY_W;
  }
}
