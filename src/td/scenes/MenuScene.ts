import Phaser from 'phaser';
import { PLAY_W, PLAY_X0, TEX, VIEW_H, WORLD_W, addText, bgScale, setupCamera, uiZoom, viewW, type Quality } from '../config';
import { paintLevel } from '../art/terrain';
import type { LevelDef } from '../sim/defs';
import { TW_BASE, TW_H } from '../art/towers';
import { Button, IconButton, dimmer, panel, popIn } from '../ui/widgets';
import { L, LANG_CYCLE, LANG_LABEL, T, getLang, isZh, setLang } from '../i18n';
import { CHANGELOG } from '../data/changelog';
import { consumeCrashNotice } from '../crashGuard';
import { save, persist, resetProgress, exportSave, importSave } from '../save';
import { showTextDialog } from '../ui/textDialog';
import { sfx } from '../audio';
import { Path } from '../sim/Path';
import { clearCheckpoint, loadCheckpoint, type Checkpoint } from '../sim/checkpoint';
import { getLevel } from '../data/levels';
import { isNativeApp } from '../native';

/** 標題畫面背景用的裝飾地圖 */
export const MENU_LEVEL: LevelDef = {
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

  preload(): void {
    if (!this.textures.exists('keyart')) this.load.image('keyart', 'assets/keyart.webp');
  }

  create(): void {
    setupCamera(this);
    this.walkers = [];
    // 離開戰鬥後釋放戰場背景（重玩時從快取重新載入）
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('lvbg_')) this.textures.remove(k);
    const painted = this.textures.exists('keyart');
    if (painted) this.keyArt();
    else this.proceduralBg();
    // 暗化上方讓標題突出（手繪主視覺的天空本來就亮，壓淡一點就好）
    const g = this.add.graphics().setName('shade');
    const a = painted ? 0.42 : 0.75;
    g.fillGradientStyle(0x120804, 0x120804, 0x120804, 0x120804, a, a, 0, 0);
    g.fillRect(0, 0, WORLD_W, painted ? 320 : 380);
    g.setDepth(1000);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    sfx.playBgm('title');
    this.cameras.main.fadeIn(500, 0, 0, 0);
    // 上次的戰鬥沒打完（手機切出去被重新整理）：優先問要不要繼續，更新內容下次再看
    const cp = loadCheckpoint();
    if (cp && getLevel(cp.levelId)) this.time.delayedCall(500, () => this.showResume(cp));
    else if ((CHANGELOG[0]?.id ?? 0) > (save().newsSeen ?? 0)) {
      const sv = save();
      // 第一次玩的新玩家不用看更新紀錄：直接標成已讀，之後的更新才會跳出來
      if (sv.stats.plays === 0 && Object.keys(sv.stars).length === 0) {
        sv.newsSeen = CHANGELOG[0]?.id ?? 0;
        persist();
      } else this.time.delayedCall(700, () => this.showNews());
    }
    if (consumeCrashNotice()) this.time.delayedCall(500, () => this.crashNotice());
  }

  /** 手繪標題主視覺：蓋滿最寬的畫面（1560×720），緩慢呼吸縮放＋飄落的葉子 */
  private keyArt(): void {
    const img = this.add.image(WORLD_W / 2, VIEW_H / 2, 'keyart').setName('bg');
    const k = Math.max(WORLD_W / img.width, VIEW_H / img.height) * 1.01;
    img.setScale(k);
    this.tweens.add({ targets: img, scale: k * 1.035, duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .particles(0, 0, 'fx_leaf', {
        x: { min: 0, max: WORLD_W },
        y: -10,
        lifespan: 11000,
        speedY: { min: 22, max: 45 },
        speedX: { min: -35, max: 15 },
        rotate: { start: 0, end: 360 },
        scale: { min: 0.35, max: 0.6 },
        tint: [0xd9822b, 0xc4512a, 0xe3a93a],
        frequency: 650,
      })
      .setDepth(900);
  }

  /** 沒有主視覺圖時：程序繪製的地圖＋裝飾塔＋走路的敵人 */
  private proceduralBg(): void {
    const bgS = bgScale(1.25);
    if (!this.textures.exists('bg_menu')) this.textures.addCanvas('bg_menu', paintLevel(MENU_LEVEL, WORLD_W, PLAY_X0, bgS));
    this.add.image(0, 0, 'bg_menu').setOrigin(0).setScale(1 / bgS).setName('bg');
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
  }

  /** 上次當機、已自動改用省電畫質：提示一次 */
  private crashNotice(): void {
    const msg = addText(this, 0, 0, T('crashLowQ'), { size: 17, color: '#ffe8b0', wrap: 600, align: 'center' }).setOrigin(0.5);
    const c = this.add.container(WORLD_W / 2, VIEW_H / 2 + 262).setDepth(6000);
    c.add([panel(this, 0, 0, 640, msg.height + 28, 'ui_dark', 14), msg]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 250 });
    this.tweens.add({ targets: c, alpha: 0, delay: 6500, duration: 400, onComplete: () => c.destroy() });
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
    const sub = addText(this, cx, 196, isZh() ? 'KINGDOM BASTION' : '王國防線', { size: 26, display: true, color: '#f4e2b8', strokeW: 6 }).setOrigin(0.5).setDepth(2000);
    this.tweens.add({ targets: title, y: 126, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // 主按鈕一組，手機上整組放大
    const z = uiZoom();
    const btns = this.add.container(cx, 300).setScale(z).setDepth(2000);
    const start = new Button(this, 0, 0, 280, 74, T('start'), () => this.go(), { color: 'green', text: { size: 34 } });
    this.tweens.add({ targets: start, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const set = new Button(this, -164, 86, 150, 52, T('settings'), () => this.settings(), { color: 'wood' });
    const cred = new Button(this, 0, 86, 150, 52, T('credits'), () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(310, () => this.scene.start('Ending', { epilogue: false, back: 'Menu' }));
    }, { color: 'wood' });
    btns.add([start, set, cred]);
    if (isNativeApp) {
      // App 版只有塔防：拿掉「戰術 SRPG」，兩顆按鈕置中
      set.x = -82;
      cred.x = 82;
    } else {
      btns.add(new Button(this, 164, 86, 150, 52, T('srpg'), () => (window.location.href = './'), { color: 'blue', text: { size: 18 } }));
    }
    // 語言鍵：繁 → 簡 → 英，鍵上寫下一個語言
    const nextLang = LANG_CYCLE[(LANG_CYCLE.indexOf(getLang()) + 1) % LANG_CYCLE.length];
    const lang = new Button(this, cx + w / 2 - 14 - 50 * z, 12 + 22 * z, 100, 44, LANG_LABEL[nextLang], () => {
      setLang(nextLang);
      save().settings.lang = getLang();
      persist();
      this.build();
    }, { color: 'grey' }).setBaseScale(z).setDepth(2000);
    const ver = addText(this, cx + w / 2 - 12, VIEW_H - 10, `v${__APP_VERSION__} · ${__GIT_SHA__}`, { size: 13, color: '#e8d8b8', strokeW: 3 }).setOrigin(1, 1).setDepth(2000);
    // 隱私權政策（上架必備）：左下角，跟版本號對稱
    const privacy = addText(this, cx - w / 2 + 12, VIEW_H - 10, T('privacy'), { size: 15, color: '#e8d8b8', strokeW: 3 }).setOrigin(0, 1).setDepth(2000);
    privacy.setPadding(6, 8, 6, 2).setInteractive({ useHandCursor: true }).on('pointerup', () => (window.location.href = 'td-privacy.html'));
    const news = new Button(this, cx - w / 2 + 14 + 70 * z, 12 + 22 * z, 140, 44, T('news'), () => this.showNews(), { color: 'grey', text: { size: 16 } }).setBaseScale(z).setDepth(2000);
    this.ui.push(title, sub, btns, lang, ver, privacy, news);
  }

  /** 更新內容：有新的條目時開場自動跳出一次 */
  private showResume(cp: Checkpoint): void {
    const lv = getLevel(cp.levelId)!;
    const w = viewW(this);
    const c = this.add.container(WORLD_W / 2, VIEW_H / 2).setDepth(5000);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.55).setPosition(-w, -VIEW_H));
    c.add(panel(this, 0, 0, 560, 300));
    c.add(addText(this, 0, -104, T('resumeTitle'), { size: 30, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    const name = lv.bonus ? L(lv.name) : `${lv.index + 1}. ${L(lv.name)}`;
    c.add(
      addText(this, 0, -24, T('resumeBody', name, T(cp.mode), cp.waveIndex + 2), { size: 18, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: 480, align: 'center', lineSpacing: 6 }).setOrigin(0.5),
    );
    c.add(
      new Button(this, -120, 92, 200, 56, T('resumeDrop'), () => {
        clearCheckpoint();
        c.destroy();
      }, { color: 'grey' }),
    );
    c.add(
      new Button(this, 120, 92, 200, 56, T('resumeGo'), () => {
        sfx.play('horn', 0.6);
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.time.delayedCall(360, () => this.scene.start('Level', { levelId: cp.levelId, resume: true }));
      }, { color: 'green' }),
    );
    popIn(this, c, 0, { w: 560, h: 300 }, 0.8, 200);
  }

  private showNews(): void {
    const sv = save();
    // 沒看過的更新一頁兩則往下翻（最多 10 則）；都看過了就只顯示最新兩則
    const unseen = CHANGELOG.filter((e) => e.id > (sv.newsSeen ?? 0)).slice(0, 10);
    const list = unseen.length ? unseen : CHANGELOG.slice(0, 2);
    const pages = Math.ceil(list.length / 2);
    sv.newsSeen = Math.max(sv.newsSeen ?? 0, CHANGELOG[0]?.id ?? 0);
    persist();
    const w = viewW(this);
    const c = this.add.container(WORLD_W / 2, VIEW_H / 2).setDepth(5000);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.55).setPosition(-w, -VIEW_H));
    c.add(panel(this, 0, 0, 640, 560));
    c.add(addText(this, 0, -242, T('news'), { size: 32, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    let page: Phaser.GameObjects.Container | null = null;
    const show = (p: number) => {
      page?.destroy();
      page = this.add.container(0, 0);
      c.add(page);
      // 內文放在子容器：英文或手機放大字體後太長就整塊縮小，不壓到按鈕
      const top = -200;
      const body = this.add.container(-276, top);
      let y = 0;
      for (const e of list.slice(p * 2, p * 2 + 2)) {
        body.add(addText(this, 0, y, `${L(e.title)}　${e.date}`, { size: 20, display: true, color: '#7a4a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0));
        y += 30;
        for (const it of e.items) {
          const t = addText(this, 14, y, `•\u00a0${L(it)}`, { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: 540, lineSpacing: 3 }).setOrigin(0, 0);
          body.add(t);
          y += t.height + 8;
        }
        y += 12;
      }
      const room = 236 - 26 - 14 - top;
      if (y > room) body.setScale(room / y);
      page.add(body);
      const last = p >= pages - 1;
      page.add(
        new Button(this, 0, 236, 220, 52, last ? 'OK' : `${T('nextPage')}  ${p + 1}/${pages}`, () => (last ? c.destroy() : show(p + 1)), {
          color: last ? 'green' : 'blue',
        }),
      );
    };
    show(0);
    popIn(this, c, 0, { w: 640, h: 560 }, 0.8, 200);
  }

  /** Android 返回鍵：先關掉最上面開著的視窗（設定、更新內容、繼續戰鬥提示）；都沒開才讓 App 縮到背景 */
  onBack(): boolean {
    const top = this.children.list.filter((o): o is Phaser.GameObjects.Container => o instanceof Phaser.GameObjects.Container && o.depth >= 5000).pop();
    if (!top) return false;
    top.destroy();
    return true;
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
    c.add(panel(this, 0, 0, 460, 560));
    c.add(addText(this, 0, -238, T('settings'), { size: 32, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    const sv = save();
    const label = (y: number, text: string) =>
      c.add(addText(this, -170, y, text, { size: 22, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
    // 音量：點一下循環 關 → 30% → 60% → 100%
    const LEVELS = [0, 0.3, 0.6, 1];
    const row = (y: number, text: string, key: 'music' | 'sfx') => {
      label(y, text);
      const pct = addText(this, 104, y, '', { size: 18, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(1, 0.5);
      const show = () => pct.setText(sv.settings[key] > 0 ? `${Math.round(sv.settings[key] * 100)}%` : T('off'));
      show();
      const b = new IconButton(this, 140, y, 50, sv.settings[key] > 0 ? 'ic_sound_on' : 'ic_sound_off', () => {
        const cur = sv.settings[key];
        // 舊存檔的 0.8 等非整格數值：跳到下一個更大的檔位
        const next = LEVELS.find((v) => v > cur + 0.01);
        sv.settings[key] = next ?? 0;
        persist();
        sfx.refreshVolumes();
        b.setIcon(sv.settings[key] > 0 ? 'ic_sound_on' : 'ic_sound_off');
        show();
        if (key === 'sfx' && sv.settings.sfx > 0) sfx.play('coin');
      });
      c.add([pct, b]);
    };
    row(-184, T('music'), 'music');
    row(-136, T('sound'), 'sfx');
    label(-88, T('voices'));
    const voiceBtn = new IconButton(this, 140, -88, 50, sv.settings.voice !== false ? 'ic_check' : 'ic_close', () => {
      sv.settings.voice = sv.settings.voice === false;
      persist();
      voiceBtn.setIcon(sv.settings.voice ? 'ic_check' : 'ic_close');
    });
    c.add(voiceBtn);
    label(-40, T('shake'));
    const shakeBtn = new IconButton(this, 140, -40, 50, sv.settings.shake ? 'ic_check' : 'ic_close', () => {
      sv.settings.shake = !sv.settings.shake;
      persist();
      shakeBtn.setIcon(sv.settings.shake ? 'ic_check' : 'ic_close');
      if (sv.settings.shake) this.cameras.main.shake(160, 0.004);
    });
    c.add(shakeBtn);
    // 畫質：自動 → 高 → 省電，改了要重新載入（渲染倍率在遊戲建立時決定）
    label(8, T('quality'));
    const QS: Quality[] = ['auto', 'high', 'low'];
    const qName = (q: Quality) => T(q === 'auto' ? 'qAuto' : q === 'high' ? 'qHigh' : 'qLow');
    const qBtn = new Button(this, 120, 8, 110, 44, qName(sv.settings.quality ?? 'auto'), () => {
      const cur = sv.settings.quality ?? 'auto';
      sv.settings.quality = QS[(QS.indexOf(cur) + 1) % QS.length];
      persist();
      qBtn.label.setText(qName(sv.settings.quality));
      this.toastReload();
    }, { color: 'blue', text: { size: 18 } });
    c.add(qBtn);
    // 介面大小：標準 ↔ 大（手機上彈出面板、選單和地圖按鈕再放大一些，重新整理後生效）
    label(56, T('uiSize'));
    const US = [1, 1.15];
    const uName = (k: number) => T(k >= 1.15 ? 'uiLarge' : 'uiNormal');
    const uBtn = new Button(this, 120, 56, 110, 44, uName(sv.settings.uiScale ?? 1), () => {
      const cur = sv.settings.uiScale ?? 1;
      sv.settings.uiScale = US[(US.findIndex((k) => Math.abs(k - cur) < 0.01) + 1) % US.length];
      persist();
      uBtn.label.setText(uName(sv.settings.uiScale));
      this.toastReload();
    }, { color: 'blue', text: { size: 18 } });
    c.add(uBtn);
    // 清除進度：按兩次才生效
    let armed = false;
    const wipe = new Button(this, 0, 162, 240, 46, T('resetProgress'), () => {
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
    // 存檔備份 / 還原（換裝置時用）
    c.add(new Button(this, -88, 110, 160, 46, T('backup'), () => {
      showTextDialog({ title: T('backupTitle'), hint: T('backupHint'), text: exportSave(), readOnly: true, okLabel: 'OK', copyLabel: T('copy'), copiedLabel: T('copied') });
    }, { color: 'blue', text: { size: 18 } }));
    c.add(new Button(this, 88, 110, 160, 46, T('restore'), () => {
      showTextDialog({
        title: T('restoreTitle'),
        hint: T('restoreHint'),
        readOnly: false,
        okLabel: T('restore'),
        cancelLabel: T('cancel'),
        onOk: (v) => {
          if (!importSave(v)) return T('importBad');
          window.setTimeout(() => window.location.reload(), 300);
          return null;
        },
      });
    }, { color: 'wood', text: { size: 18 } }));
    c.add(new Button(this, 0, 224, 200, 52, 'OK', () => c.destroy(), { color: 'green' }));
    popIn(this, c, 0, { w: 460, h: 560 }, 0.8, 200);
  }

  private reloadTimer: Phaser.Time.TimerEvent | null = null;

  /** 畫質變更：短暫提示後重新載入（連續切換時只算最後一次） */
  private toastReload(): void {
    this.reloadTimer?.remove();
    const t = addText(this, WORLD_W / 2, VIEW_H / 2 + 270, T('qReload'), { size: 18, color: '#ffe066' }).setOrigin(0.5).setDepth(6000);
    this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 300, onComplete: () => t.destroy() });
    this.reloadTimer = this.time.delayedCall(1600, () => window.location.reload());
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
