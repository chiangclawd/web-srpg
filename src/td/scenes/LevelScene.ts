import Phaser from 'phaser';
import { PLAY_W, PLAY_X0, RS, TEX, VIEW_H, WORLD_W, bgScale, freeCanvasTexture, hudZoom, isTouchDevice, setupCamera, uiZoom, viewW } from '../config';
import { getLevel } from '../data/levels';
import { HEROES } from '../data/heroes';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { ENEMIES } from '../data/enemies';
import { computeMods } from '../data/upgrades';
import { World, type Difficulty, type SimEvent } from '../sim/World';
import { Enemy, Soldier, Tower, type Projectile } from '../sim/entities';
import type { LevelDef, LevelMode, TowerLevelDef, TowerType } from '../sim/defs';
import { challengeLevel } from '../data/challenges';
import { dailyKey, dailyLevel } from '../data/daily';
import { evaluateAchievements } from '../data/achievements';
import { STORY, type EpilogueId } from '../data/story';
import { GEMS_PER_ACHIEVEMENT, ITEMS, KEG, gemReward, type ItemId } from '../data/items';
import { RANGE_Y, inEllipse } from '../sim/math';
import { PAINTED_LEVELS, levelArtKey, paintLevel, paintBuildSpot } from '../art/terrain';
import { THEMES } from '../art/scenery';
import { visualMuzzleH } from '../art/towers';
import { DEPTH, Fx, camShake } from '../view/Fx';
import { TowerView, UnitView } from '../view/Units';
import { HazardLayer, hazardTextures } from '../view/Hazards';
import { Bubbles } from '../view/Bubbles';
import { clearCheckpoint, loadCheckpoint, restore, saveCheckpoint, snapshot, type Checkpoint } from '../sim/checkpoint';
import { BRANCH_BARKS, HERO_BARKS, towerBark } from '../data/barks';
import { BOSS_VOICES, towerVoiceLines, voiceText } from '../data/voices';
import { RadialMenu, type RadialOption } from '../view/RadialMenu';
import { IconButton } from '../ui/widgets';
import { THEME_BGM, sfx } from '../audio';
import { save, persist } from '../save';
import { L, T } from '../i18n';
import type { LevelUIScene, InfoData } from './LevelUIScene';

const STEP = 1 / 60;

type Mode = 'idle' | 'hero' | 'meteor' | 'reinforce' | 'rally' | 'keg' | 'ult';

export class LevelScene extends Phaser.Scene {
  world!: World;
  level!: LevelDef;
  fx!: Fx;
  ui!: LevelUIScene;
  difficulty: Difficulty = 'normal';
  /** 關卡模式（戰役 / 英雄挑戰 / 鋼鐵挑戰） */
  mode0: LevelMode = 'campaign';
  baseLevel!: LevelDef;
  paused = false;
  speed = 1;
  mode: Mode = 'idle';
  /** 本場結算獲得的寶石（結算畫面顯示） */
  gemsEarned = 0;
  dailyKey = '';

  private acc = 0;
  private enemyViews = new Map<number, UnitView>();
  private soldierViews = new Map<number, UnitView>();
  private towerViews = new Map<number, TowerView>();
  private projViews = new Map<number, Phaser.GameObjects.Image>();
  private zoneViews = new Map<number, Phaser.GameObjects.GameObject[]>();
  private spotImgs: Phaser.GameObjects.Image[] = [];
  private spotHits: Phaser.GameObjects.Ellipse[] = [];
  /** 玩家縮放（1 = 看到整張地圖；手機雙指放大，桌機滾輪） */
  private userZoom = 1;
  /** 目前這次按壓：拖曳超過門檻就不算點擊 */
  private gesture: { downTime: number; sx: number; sy: number; scrollX: number; scrollY: number; moved: boolean } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private towerHits = new Map<number, Phaser.GameObjects.Rectangle>();
  private menu: RadialMenu | null = null;
  private menuTarget: { spot?: number; tower?: Tower } | null = null;
  private rangeG!: Phaser.GameObjects.Graphics;
  private rallyFlags = new Map<number, Phaser.GameObjects.Image>();
  private waveBtns: { path: number; btn: IconButton; ring: Phaser.GameObjects.Graphics }[] = [];
  private seenIntro = new Set<string>();
  private resultShown = false;
  private lastTapTouch = false;
  private skullArmedUntil = 0;
  private tutArrow: Phaser.GameObjects.Image | null = null;
  private exitMarks: Phaser.GameObjects.Image[] = [];
  private projPool: Phaser.GameObjects.Image[] = [];
  private ambient: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private hazardLayer: HazardLayer | null = null;
  /** 首領倒下的慢動作（場景時間，毫秒） */
  private slowMoUntil = 0;
  /** 從存檔點繼續（手機被重新整理後） */
  private resumeCp: Checkpoint | null = null;
  private bubbles!: Bubbles;

  constructor() {
    super('Level');
  }

  init(data: { levelId: string; difficulty?: Difficulty; mode?: LevelMode; resume?: boolean }): void {
    const cp = data.resume ? loadCheckpoint() : null;
    this.resumeCp = cp && cp.levelId === data.levelId ? cp : null;
    this.mode0 = this.resumeCp?.mode ?? data.mode ?? 'campaign';
    this.baseLevel = getLevel(data.levelId)!;
    // 每日挑戰：開局時的日期決定修正（跨午夜也記在開局那天）
    this.dailyKey = this.resumeCp?.dailyKey ?? dailyKey();
    this.level = this.mode0 === 'daily' ? dailyLevel(this.baseLevel, this.dailyKey) : challengeLevel(this.baseLevel, this.mode0);
    this.difficulty = this.resumeCp?.difficulty ?? data.difficulty ?? save().settings.difficulty;
    this.paused = false;
    this.speed = save().settings.speed ?? 1;
    this.mode = 'idle';
    this.gemsEarned = 0;
    this.acc = 0;
    this.enemyViews = new Map();
    this.soldierViews = new Map();
    this.towerViews = new Map();
    this.projViews = new Map();
    this.zoneViews = new Map();
    this.spotImgs = [];
    this.spotHits = [];
    this.towerHits = new Map();
    this.rallyFlags = new Map();
    this.waveBtns = [];
    this.menu = null;
    this.menuTarget = null;
    this.resultShown = false;
    this.tutArrow = null;
    this.exitMarks = [];
    this.projPool = [];
    this.skullArmedUntil = 0;
    this.hazardLayer = null;
    this.slowMoUntil = 0;
    this.seenIntro = new Set(save().seenEnemies);
  }

  preload(): void {
    // 手繪戰場背景按需下載（每關約 250 KB）；失敗就退回程序繪製
    const id = this.baseLevel.id;
    if (PAINTED_LEVELS.has(id) && !this.textures.exists(levelArtKey(id))) this.load.image(levelArtKey(id), `assets/levels/${id}.webp`);
    for (const k of hazardTextures(this.level.hazards ?? [])) if (!this.textures.exists(k)) this.load.image(k, `assets/sprites/hz/${k}.webp`);
  }

  create(): void {
    const sv = save();
    const cp = this.resumeCp;
    const heroId = cp?.heroId ?? sv.selectedHero;
    const heroDef = HEROES[heroId] ?? HEROES.arthur;
    this.world = new World({
      level: this.level,
      mods: computeMods(sv.upgrades),
      hero: { def: heroDef, xp: cp?.hero?.xp ?? sv.heroes[heroDef.id]?.xp ?? 0 },
      difficulty: this.difficulty,
      seed: (Date.now() & 0xffff) + 1,
    });
    // 從存檔點繼續：重建塔與狀態；否則清掉舊的存檔點（開了別的戰鬥就不再提示）
    if (cp) restore(this.world, cp);
    else clearCheckpoint();
    sv.stats.plays++;
    persist();

    const cam = setupCamera(this);
    this.layoutCamera();
    cam.setBackgroundColor(THEMES[this.level.theme].groundDark);

    // 背景：有手繪圖就用（只留這一關的，其他關的釋放記憶體），沒有就程序繪製
    freeCanvasTexture(this, 'bg_level');
    const painted = levelArtKey(this.baseLevel.id);
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('lvbg_') && k !== painted) this.textures.remove(k);
    // 戰鬥中用不到世界地圖與標題主視覺（約 12 MB），先釋放；回地圖/主選單時再載入
    for (const k of ['worldmap', 'keyart']) if (this.textures.exists(k)) this.textures.remove(k);
    if (this.textures.exists(painted)) {
      const img = this.add.image(-PLAY_X0, 0, painted).setOrigin(0).setDepth(DEPTH.bg);
      img.setScale(WORLD_W / img.width, VIEW_H / img.height);
    } else {
      const bgS = bgScale(1.5);
      const bg = paintLevel(this.level, WORLD_W, PLAY_X0, bgS);
      this.textures.addCanvas('bg_level', bg);
      this.add.image(-PLAY_X0, 0, 'bg_level').setOrigin(0).setScale(1 / bgS).setDepth(DEPTH.bg);
    }
    freeCanvasTexture(this, 'spot_tex');
    this.textures.addCanvas('spot_tex', paintBuildSpot(TEX, THEMES[this.level.theme].snowy));

    this.fx = new Fx(this);
    this.bubbles = new Bubbles(this);
    this.rangeG = this.add.graphics().setDepth(DEPTH.rangeRing);

    // 建造點
    this.world.spots.forEach((s, i) => {
      const img = this.add.image(s.x, s.y, 'spot_tex').setScale(1 / TEX).setDepth(DEPTH.decal + 10);
      this.spotImgs.push(img);
      // 觸控裝置點擊範圍放大（手指比滑鼠粗）
      const touch = isTouchDevice();
      const hit = this.add.ellipse(s.x, s.y - 4, touch ? 96 : 84, touch ? 72 : 56, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        if (this.isTap(p)) this.onSpotTap(i);
      });
      hit.on('pointerover', () => img.setTint(0xfff0c0));
      hit.on('pointerout', () => img.clearTint());
      this.spotHits.push(hit);
    });

    // 地圖機關（落石／雪球）
    if (this.world.hazards.length) this.hazardLayer = new HazardLayer(this, this.world, this.fx, (p) => this.isTap(p));

    // 環境粒子
    this.makeAmbient();
    this.makeLife();

    // 全域點擊
    this.setupGestures();
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || !this.isTap(p)) return;
      this.onGroundTap(p.worldX, p.worldY);
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.togglePause());
    this.input.keyboard?.on('keydown-ESC', () => this.cancelAll());
    this.input.keyboard?.on('keydown-ONE', () => this.ui?.spellButton('meteor'));
    this.input.keyboard?.on('keydown-TWO', () => this.ui?.spellButton('reinforce'));
    this.input.keyboard?.on('keydown-Q', () => this.enterHeroUlt());

    this.scale.on('resize', this.onResize, this);
    const onHide = () => {
      if (document.hidden && !this.paused && !this.world.result) this.togglePause(true);
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onHide);
      this.scale.off('resize', this.onResize, this);
      this.scene.stop('LevelUI');
    });

    this.createWaveButtons();
    this.createExitMarks();
    if (this.level.tutorial) {
      this.tutArrow = this.add.image(0, 0, 'fx_arrow').setScale(1 / TEX).setDepth(DEPTH.menu + 5).setVisible(false);
    }

    // HUD
    this.scene.launch('LevelUI', { level: this });
    this.ui = this.scene.get('LevelUI') as LevelUIScene;

    sfx.playBgm(this.level.bgm ?? THEME_BGM[this.level.theme]);
    if (this.world.hero?.hero) sfx.preloadVoice(this.world.hero.hero.def.id);
    for (const b of this.bossIds()) if (BOSS_VOICES[b]) sfx.preloadBossVoice(b);
    // 塔的配音等關卡畫面載完再下載（用真實時間：開場時場景可能是暫停的）
    window.setTimeout(() => sfx.preloadTowerVoices(towerVoiceLines()), 2500);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // 觸控裝置第一次進關：提示可以雙指縮放
    if (isTouchDevice() && !save().tipsSeen.includes('zoom')) {
      this.time.delayedCall(2500, () => {
        if (!this.sys.isActive() || this.ui?.hasModal()) return;
        save().tipsSeen.push('zoom');
        persist();
        this.ui.toast(T('tipZoom'), 4000);
      });
    }

    // 開場：劇情（首次進入戰役）→ 介紹新敵人；從存檔點繼續時直接提示
    this.time.delayedCall(500, () => {
      if (cp) {
        this.ui.toast(T('resumed', cp.waveIndex + 2), 3500);
        return;
      }
      const story = STORY[this.level.id];
      const seen = save().storySeen;
      if (this.mode0 === 'campaign' && story && !seen.includes(this.level.id)) {
        seen.push(this.level.id);
        persist();
        this.ui.showStory(story, () => this.introNewEnemies(this.level.intro ?? []));
      } else this.introNewEnemies(this.level.intro ?? []);
    });
  }

  private onResize(): void {
    this.layoutCamera();
    this.positionWaveButtons();
    this.positionExitMarks();
  }

  private layoutCamera(): void {
    const w = viewW(this);
    this.userZoom = 1;
    this.cameras.main.setZoom(RS);
    this.cameras.main.setScroll(-(w - PLAY_W) / 2, 0);
  }

  // ═════════════════════════ 縮放 / 平移 ═════════════════════════

  /**
   * 手機：雙指縮放、放大後單指拖曳平移；桌機：滾輪縮放、拖曳平移。
   * 點擊一律在放開時判定（移動超過門檻就當成拖曳），避免拖地圖時誤蓋塔。
   */
  private setupGestures(): void {
    const MAX_ZOOM = 2.2;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a?.isDown && b?.isDown) {
        // 第二指放下：開始雙指縮放，這次按壓不算點擊
        this.pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.userZoom };
        if (this.gesture) this.gesture.moved = true;
        return;
      }
      const cam = this.cameras.main;
      this.gesture = { downTime: p.downTime, sx: p.x, sy: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (this.pinch && a?.isDown && b?.isDown) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, Phaser.Math.Clamp((this.pinch.zoom * d) / Math.max(1, this.pinch.dist), 1, MAX_ZOOM));
        return;
      }
      const g = this.gesture;
      if (!g || !p.isDown || p.downTime !== g.downTime) return;
      const dx = p.x - g.sx;
      const dy = p.y - g.sy;
      // 門檻 10 CSS px（換算成畫布像素）
      if (!g.moved && Math.hypot(dx, dy) > 10 * this.scale.displayScale.x) g.moved = true;
      if (g.moved && this.userZoom > 1 && !this.pinch) {
        const cam = this.cameras.main;
        cam.setScroll(g.scrollX - dx / cam.zoom, g.scrollY - dy / cam.zoom);
        this.clampScroll();
      }
    });
    this.input.on('pointerup', () => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (!a?.isDown && !b?.isDown) {
        this.pinch = null;
        // 縮回接近 1 倍就貼齊整張地圖
        if (this.userZoom < 1.08 && this.userZoom !== 1) this.zoomAt(0, 0, 1);
      } else if (this.pinch) {
        // 放開一指：剩下那指從現在位置開始拖（不要跳）
        const rest = a?.isDown ? a : b;
        const cam = this.cameras.main;
        if (rest) this.gesture = { downTime: rest.downTime, sx: rest.x, sy: rest.y, scrollX: cam.scrollX, scrollY: cam.scrollY, moved: true };
        this.pinch = null;
      }
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.zoomAt(p.x, p.y, Phaser.Math.Clamp(this.userZoom * (dy > 0 ? 0.88 : 1.14), 1, MAX_ZOOM));
    });
  }

  /** 這次放開算不算「點擊」（沒有拖曳、不是雙指） */
  private isTap(p: Phaser.Input.Pointer): boolean {
    const g = this.gesture;
    if (!g || g.downTime !== p.downTime) return !this.pinch;
    return !g.moved && !this.pinch;
  }

  /** 以畫面上某點為中心縮放（該點底下的世界座標保持不動） */
  private zoomAt(sx: number, sy: number, z: number): void {
    const cam = this.cameras.main;
    const wx = cam.scrollX + sx / cam.zoom;
    const wy = cam.scrollY + sy / cam.zoom;
    this.userZoom = z;
    cam.setZoom(RS * z);
    cam.setScroll(wx - sx / cam.zoom, wy - sy / cam.zoom);
    this.clampScroll();
  }

  /** 平移範圍限制在原本整張地圖的可見範圍內 */
  private clampScroll(): void {
    const cam = this.cameras.main;
    const w = viewW(this);
    const x0 = -(w - PLAY_W) / 2;
    const visW = w / this.userZoom;
    const visH = VIEW_H / this.userZoom;
    cam.setScroll(Phaser.Math.Clamp(cam.scrollX, x0, x0 + w - visW), Phaser.Math.Clamp(cam.scrollY, 0, VIEW_H - visH));
  }

  /** 目前畫面上看得到的世界範圍（考慮玩家縮放） */
  visibleRect(): Phaser.Geom.Rectangle {
    const cam = this.cameras.main;
    const w = viewW(this);
    return new Phaser.Geom.Rectangle(cam.scrollX, cam.scrollY, w / this.userZoom, VIEW_H / this.userZoom);
  }

  /** 世界座標可見範圍 */
  viewRect(): Phaser.Geom.Rectangle {
    const w = viewW(this);
    return new Phaser.Geom.Rectangle(-(w - PLAY_W) / 2, 0, w, VIEW_H);
  }

  /** 讓手繪戰場動起來：營火、祭壇、水面閃光，以及各主題的小生物（純裝飾，量少，手機也輕） */
  private makeLife(): void {
    const lavaTheme = this.level.theme === 'volcano';
    const twinkle = (zone: { getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => Phaser.Types.Math.Vector2Like }, every: number) =>
      this.add
        .particles(0, 0, lavaTheme ? 'fx_spark' : 'fx_star', {
          emitZone: { type: 'random', source: zone },
          lifespan: lavaTheme ? 1100 : 800,
          scale: { start: 0.22, end: 0 },
          alpha: { start: 0.9, end: 0 },
          speedY: lavaTheme ? { min: -30, max: -10 } : 0,
          tint: lavaTheme ? 0xffa040 : 0xf4fbff,
          blendMode: 'ADD',
          frequency: every,
        })
        .setDepth(DEPTH.decal + 5);
    for (const d of this.level.decor ?? []) {
      if (d.kind === 'camp') {
        // 營火位置與程序背景的畫法相同（手繪圖照著它畫）
        const fx = d.x + 2;
        const fy = d.y + 26;
        const glow = this.add.image(fx, fy - 4, 'fx_soft').setTint(0xffa040).setBlendMode('ADD').setAlpha(0.5).setScale(0.9).setDepth(DEPTH.decal + 5);
        this.tweens.add({ targets: glow, alpha: 0.28, scale: 0.75, duration: 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add
          .particles(fx, fy - 8, 'fx_smoke', {
            lifespan: 2800,
            speedY: { min: -26, max: -14 },
            speedX: { min: -4, max: 10 },
            scale: { start: 0.16, end: 0.55 },
            alpha: { start: 0.32, end: 0 },
            tint: 0x8a8070,
            frequency: 420,
          })
          .setDepth(DEPTH.float - 20);
        this.add
          .particles(fx, fy - 6, 'fx_spark', {
            lifespan: 900,
            speedY: { min: -55, max: -25 },
            speedX: { min: -14, max: 14 },
            scale: { start: 0.22, end: 0 },
            tint: 0xffb040,
            blendMode: 'ADD',
            frequency: 320,
          })
          .setDepth(DEPTH.float - 21);
      } else if (d.kind === 'altar') {
        const glow = this.add.image(d.x, d.y - 18, 'fx_soft').setTint(0xb060ff).setBlendMode('ADD').setAlpha(0.35).setScale(1.3).setDepth(DEPTH.decal + 5);
        this.tweens.add({ targets: glow, alpha: 0.6, scale: 1.6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add
          .particles(d.x, d.y - 14, 'fx_soft', {
            x: { min: -22, max: 22 },
            lifespan: 2200,
            speedY: { min: -34, max: -16 },
            scale: { start: 0.14, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: 0xc080ff,
            blendMode: 'ADD',
            frequency: 260,
          })
          .setDepth(DEPTH.float - 21);
      } else if (d.kind === 'lake') {
        const { x, y, rx, ry } = d;
        if (lavaTheme) {
          // 熔岩池：一層橘紅光暈緩緩脈動
          const glow = this.add.image(x, y, 'fx_soft').setTint(0xff6a20).setBlendMode('ADD').setAlpha(0.35).setScale((rx * 2.6) / 128, (ry * 2.6) / 128).setDepth(DEPTH.decal + 5);
          this.tweens.add({ targets: glow, alpha: 0.6, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        twinkle(
          {
            getRandomPoint: (p) => {
              const a = Math.random() * Math.PI * 2;
              const r = Math.sqrt(Math.random()) * 0.8;
              p.x = x + Math.cos(a) * rx * r;
              p.y = y + Math.sin(a) * ry * r;
              return p;
            },
          },
          Math.max(260, 60000 / (rx * ry) ** 0.9),
        );
      } else if (d.kind === 'river') {
        const pts = d.points;
        twinkle(
          {
            getRandomPoint: (p) => {
              const i = Math.floor(Math.random() * (pts.length - 1));
              const k = Math.random();
              p.x = pts[i].x + (pts[i + 1].x - pts[i].x) * k + (Math.random() - 0.5) * d.width * 0.6;
              p.y = pts[i].y + (pts[i + 1].y - pts[i].y) * k;
              return p;
            },
          },
          240,
        );
      }
    }
    const theme = this.level.theme;
    if (theme === 'grass' || theme === 'forest') {
      // 蝴蝶：在場上隨意飛（拍翅＝左右縮放）
      const tints = [0xffe070, 0xff9ad0, 0x9ad0ff, 0xffffff, 0xffb060];
      for (let i = 0; i < 5; i++) {
        const b = this.add.image(Phaser.Math.Between(80, PLAY_W - 80), Phaser.Math.Between(80, 640), 'fx_butterfly').setTint(tints[i]).setDepth(DEPTH.float - 30);
        const k = (0.75 + Math.random() * 0.3) / TEX;
        b.setScale(k);
        this.tweens.add({ targets: b, scaleX: k * 0.25, duration: 110 + i * 9, yoyo: true, repeat: -1 });
        const fly = () => {
          const tx = Phaser.Math.Clamp(b.x + Phaser.Math.Between(-260, 260), 40, PLAY_W - 40);
          const ty = Phaser.Math.Clamp(b.y + Phaser.Math.Between(-160, 160), 60, 680);
          b.setFlipX(tx < b.x);
          this.tweens.add({ targets: b, x: tx, y: ty, duration: Math.hypot(tx - b.x, ty - b.y) * 40 + 600, ease: 'Sine.easeInOut', onComplete: fly });
        };
        fly();
      }
    } else if (theme === 'waste') {
      this.add
        .particles(0, 0, 'fx_soft', {
          x: { min: 0, max: PLAY_W },
          y: { min: 60, max: 720 },
          lifespan: 4200,
          speedY: { min: -22, max: -8 },
          speedX: { min: -6, max: 6 },
          scale: { start: 0.12, end: 0 },
          alpha: { start: 0.7, end: 0 },
          tint: 0xb070ff,
          blendMode: 'ADD',
          frequency: 240,
        })
        .setDepth(DEPTH.float - 25);
    } else if (theme === 'volcano') {
      // 火山：火星從地面緩緩升起，灰燼從天上飄落
      this.add
        .particles(0, 0, 'fx_spark', {
          x: { min: -PLAY_X0, max: PLAY_W + PLAY_X0 },
          y: { min: 200, max: 740 },
          lifespan: 3600,
          speedY: { min: -40, max: -16 },
          speedX: { min: -10, max: 10 },
          scale: { start: 0.26, end: 0 },
          alpha: { start: 0.9, end: 0 },
          tint: [0xff8a30, 0xffc050, 0xff5a20],
          blendMode: 'ADD',
          frequency: 160,
        })
        .setDepth(DEPTH.float - 25);
      this.add
        .particles(0, 0, 'fx_soft', {
          x: { min: -PLAY_X0, max: PLAY_W + PLAY_X0 },
          y: -10,
          lifespan: 9000,
          speedY: { min: 18, max: 34 },
          speedX: { min: -12, max: 6 },
          scale: { min: 0.05, max: 0.09 },
          alpha: { start: 0.7, end: 0.2 },
          tint: 0x8a8480,
          frequency: 220,
        })
        .setDepth(DEPTH.float - 25);
    } else if (theme === 'coast') {
      // 海鷗在海灣上空盤旋滑翔（偶爾拍翅），地上跟著淡淡的影子
      for (let i = 0; i < 4; i++) {
        const gull = this.add.image(0, 0, 'fx_gull').setDepth(DEPTH.float - 20);
        const shadow = this.add.image(0, 0, 'fx_gull').setTint(0x000000).setAlpha(0.18).setDepth(DEPTH.decal);
        const k = (1.2 + Math.random() * 0.4) / TEX;
        gull.setScale(k);
        shadow.setScale(k * 0.9);
        const glide = () => {
          const fromLeft = Math.random() < 0.5;
          const y0 = Phaser.Math.Between(60, 560);
          const y1 = Phaser.Math.Clamp(y0 + Phaser.Math.Between(-140, 140), 40, 600);
          const x0 = fromLeft ? -PLAY_X0 - 40 : PLAY_W + PLAY_X0 + 40;
          const x1 = fromLeft ? PLAY_W + PLAY_X0 + 40 : -PLAY_X0 - 40;
          gull.setPosition(x0, y0).setFlipX(!fromLeft);
          shadow.setPosition(x0 + 30, y0 + 90);
          const dur = Phaser.Math.Between(14000, 22000);
          const delay = Phaser.Math.Between(0, 6000) + i * 1500;
          this.tweens.add({ targets: gull, x: x1, y: y1, duration: dur, ease: 'Sine.easeInOut', delay, onComplete: glide });
          this.tweens.add({ targets: shadow, x: x1 + 30, y: y1 + 90, duration: dur, ease: 'Sine.easeInOut', delay });
        };
        // 拍翅：大部分時間滑翔，每隔幾秒拍幾下
        this.tweens.add({ targets: gull, scaleY: k * 0.45, duration: 140, yoyo: true, repeat: 3, repeatDelay: 20, loop: -1, loopDelay: 2600 + i * 500 });
        glide();
      }
    } else if (theme === 'desert') {
      // 一陣陣風沙由左吹到右
      this.add
        .particles(0, 0, 'fx_soft', {
          x: { min: -PLAY_X0 - 60, max: -PLAY_X0 },
          y: { min: 30, max: 700 },
          lifespan: 13000,
          speedX: { min: 90, max: 150 },
          speedY: { min: -6, max: 6 },
          scale: { min: 0.9, max: 2 },
          alpha: { start: 0.2, end: 0 },
          tint: 0xf0d8a0,
          frequency: 380,
        })
        .setDepth(DEPTH.float - 25);
    }
  }

  private makeAmbient(): void {
    const theme = this.level.theme;
    if (theme === 'snow') {
      this.ambient = this.add.particles(0, 0, 'fx_snow', {
        x: { min: -PLAY_X0, max: PLAY_W + PLAY_X0 },
        y: -10,
        lifespan: 9000,
        speedY: { min: 25, max: 55 },
        speedX: { min: -20, max: 10 },
        scale: { min: 0.3, max: 0.7 },
        alpha: { start: 0.9, end: 0.4 },
        frequency: 70,
      });
    } else if (theme === 'autumn' || theme === 'forest') {
      this.ambient = this.add.particles(0, 0, 'fx_leaf', {
        x: { min: -PLAY_X0, max: PLAY_W + PLAY_X0 },
        y: -10,
        lifespan: 10000,
        speedY: { min: 20, max: 40 },
        speedX: { min: -30, max: 20 },
        rotate: { start: 0, end: 360 },
        scale: { min: 0.35, max: 0.6 },
        tint: theme === 'autumn' ? [0xd9822b, 0xc4512a, 0xe3a93a] : [0x7ac24a, 0x5aa03a],
        frequency: 500,
      });
    }
    this.ambient?.setDepth(DEPTH.float - 10);
  }

  // ═════════════════════════ 輸入 ═════════════════════════

  private onSpotTap(i: number): void {
    if (this.world.result) return;
    if (this.mode === 'meteor' || this.mode === 'reinforce' || this.mode === 'keg' || this.mode === 'ult') {
      const s = this.world.spots[i];
      this.onGroundTap(s.x, s.y);
      return;
    }
    const spot = this.world.spots[i];
    if (spot.tower) {
      this.openTowerMenu(spot.tower);
      return;
    }
    if (this.menuTarget?.spot === i) {
      this.closeMenu();
      return;
    }
    this.openBuildMenu(i);
  }

  private onGroundTap(x: number, y: number): void {
    if (this.world.result) return;
    const w = this.world;
    switch (this.mode) {
      case 'meteor':
        if (w.castMeteor(x, y)) {
          sfx.play('whoosh');
          this.setMode('idle');
        }
        return;
      case 'reinforce': {
        const onPath = w.paths.some((p) => p.nearest({ x, y }).dist < 42);
        if (!onPath) {
          sfx.play('error');
          this.fx.floatText(x, y - 10, '✖', '#ff6a5a', 22);
          return;
        }
        if (w.castReinforce(x, y)) {
          sfx.play('horn', 0.4);
          this.fx.smokePuff(x, y, 8);
          this.setMode('idle');
        }
        return;
      }
      case 'keg':
        if (this.consumeItem('keg', x, y)) this.setMode('idle');
        return;
      case 'ult':
        if (w.castHeroUlt(x, y)) {
          this.setMode('idle');
          this.heroShout('ult');
        }
        else sfx.play('error');
        return;
      case 'rally': {
        const t = this.menuTarget?.tower;
        if (t && w.setRally(t, x, y)) {
          sfx.play('click');
          this.showRallyFlag(t, true);
          this.fx.ring(x, y, 30, 0x6aa0ff, 300);
        } else {
          sfx.play('error');
        }
        this.setMode('idle');
        this.closeMenu();
        return;
      }
      case 'hero':
        if (w.moveHero(x, y)) {
          sfx.play('click');
          this.fx.ring(x, y, 22, 0xffd84a, 300);
          this.setMode('idle');
          const hh = w.hero;
          if (hh?.hero) {
            const i = this.bubbles.say('hero', hh.x, hh.y - hh.height - 12, HERO_BARKS[hh.hero.def.id], 0.6);
            if (i === 0 || i === 1) sfx.voice(hh.hero.def.id, i === 0 ? 'move0' : 'move1');
          }
        }
        return;
      default:
        break;
    }
    // 點英雄？
    const h = w.hero;
    if (h && h.alive && Math.hypot(h.x - x, h.y - 24 - y) < (isTouchDevice() ? 46 : 34)) {
      this.closeMenu();
      this.setMode('hero');
      return;
    }
    // 點敵人 → 顯示資訊
    let best: Enemy | null = null;
    let bd = 30;
    for (const e of w.enemies) {
      const d = Math.hypot(e.x - x, e.y - e.def.height * 0.5 + (e.flying ? -30 : 0) - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    this.closeMenu();
    if (best) this.ui.showEnemyInfo(best.def);
    else this.ui.hideInfo();
  }

  setMode(m: Mode): void {
    this.mode = m;
    const hv = this.world.hero ? this.soldierViews.get(this.world.hero.id) : undefined;
    hv?.showRing(m === 'hero');
    this.ui?.onModeChange(m);
    this.drawRange(null);
    if (m === 'hero' && this.world.hero) {
      this.ui.toast(T('heroMove'));
    } else if (m === 'meteor') {
      this.ui.toast(T('meteorDesc'));
    } else if (m === 'reinforce') {
      this.ui.toast(T('reinforceDesc'));
    } else if (m === 'keg') {
      this.ui.toast(L(ITEMS.keg.desc));
    } else if (m === 'ult' && this.world.hero?.hero) {
      this.ui.toast(L(this.world.hero.hero.def.ult.desc));
    } else if (m === 'rally') {
      const t = this.menuTarget?.tower;
      if (t) this.drawRange(t.x, t.y, t.def.range, 0x6aa0ff);
    }
  }

  cancelAll(): void {
    this.closeMenu();
    this.setMode('idle');
    this.ui?.hideInfo();
  }

  selectHero(): void {
    if (!this.world.hero?.alive) return;
    this.closeMenu();
    this.setMode(this.mode === 'hero' ? 'idle' : 'hero');
  }

  enterSpell(kind: 'meteor' | 'reinforce'): void {
    const w = this.world;
    if (!w.spellsEnabled) {
      sfx.play('error');
      this.ui.toast(T('noSpells'));
      return;
    }
    const ready = kind === 'meteor' ? w.meteorCd <= 0 : w.reinfCd <= 0;
    if (!ready) {
      sfx.play('error');
      return;
    }
    this.closeMenu();
    this.setMode(this.mode === kind ? 'idle' : kind);
  }

  /** 首次提示：每次開波最多一則，依序介紹法術 → 絕招 → 道具 */
  private maybeTip(waveIndex: number): void {
    const w = this.world;
    const seen = save().tipsSeen;
    let id: 'spells' | 'ult' | 'items' | null = null;
    if (this.baseLevel.index === 0) {
      if (waveIndex === 1 && w.spellsEnabled && !seen.includes('spells')) id = 'spells';
    } else if (waveIndex === 0) {
      if (w.hero && !seen.includes('ult')) id = 'ult';
      else if (w.spellsEnabled && !seen.includes('items') && Object.values(save().items).some((n) => n > 0)) id = 'items';
    }
    if (!id) return;
    const tip = id;
    this.time.delayedCall(1600, () => {
      if (!this.world.result) this.ui.showTip(tip);
    });
  }

  /** 英雄絕招按鈕：冷卻好了就進入選位模式 */
  enterHeroUlt(): void {
    if (!this.world.canHeroUlt()) {
      sfx.play('error');
      return;
    }
    this.closeMenu();
    this.setMode(this.mode === 'ult' ? 'idle' : 'ult');
  }

  /** 道具列按鈕：需要目標的進入選位模式，其餘立即使用 */
  useItem(id: ItemId): void {
    if (!this.world.spellsEnabled) {
      sfx.play('error');
      this.ui.toast(T('noSpells'));
      return;
    }
    if ((save().items[id] ?? 0) <= 0) {
      sfx.play('error');
      this.ui.toast(T('noItems'));
      return;
    }
    if (ITEMS[id].targeted) {
      this.closeMenu();
      this.setMode(this.mode === id ? 'idle' : (id as Mode));
      return;
    }
    this.consumeItem(id);
  }

  private consumeItem(id: ItemId, x = 0, y = 0): boolean {
    if (!this.world.useItem(id, x, y)) {
      sfx.play('error');
      if (id === 'potion') this.ui.toast(T('livesFull'));
      return false;
    }
    const sv = save();
    sv.items[id] = Math.max(0, (sv.items[id] ?? 0) - 1);
    persist();
    this.ui.refreshItems();
    return true;
  }

  togglePause(force?: boolean): void {
    this.paused = force ?? !this.paused;
    this.ui?.showPause(this.paused);
  }

  toggleSpeed(): number {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    save().settings.speed = this.speed;
    persist();
    return this.speed;
  }

  // ═════════════════════════ 選單 ═════════════════════════

  private closeMenu(): void {
    if (this.menu) {
      this.menu.close();
      this.menu = null;
    }
    if (this.menuTarget?.tower) this.showRallyFlag(this.menuTarget.tower, false);
    this.menuTarget = null;
    this.drawRange(null);
    this.ui?.hideInfo();
  }

  private drawRange(x: number | null, y = 0, r = 0, color = 0xffffff): void {
    const g = this.rangeG;
    g.clear();
    if (x === null) return;
    g.fillStyle(color, 0.12);
    g.fillEllipse(x, y, r * 2, r * 2 * RANGE_Y);
    g.lineStyle(2.5, color, 0.7);
    g.strokeEllipse(x, y, r * 2, r * 2 * RANGE_Y);
  }

  private openBuildMenu(spot: number): void {
    this.closeMenu();
    this.setMode('idle');
    const s = this.world.spots[spot];
    const angles = [-135, -45, 135, 45];
    const opts: RadialOption[] = TOWER_ORDER.map((type, i) => {
      const cost = this.world.buildCost(type);
      const def = TOWERS[type].levels[0];
      const allowed = this.world.canBuildType(type);
      return {
        id: type,
        icon: allowed ? `icb_${type}` : 'ic_lock',
        badge: allowed ? undefined : 'ui_badge_grey',
        price: allowed ? cost : null,
        enabled: allowed && this.world.gold >= cost,
        angle: angles[i],
        onPreview: () => {
          this.drawRange(s.x, s.y, this.effRange(type, def), 0xffffff);
          this.ui.showInfo(this.towerInfo(type, def, cost));
        },
        onConfirm: () => {
          const t = this.world.build(spot, type);
          if (t) {
            sfx.play('build');
            this.closeMenu();
          }
        },
      };
    });
    this.menu = this.radial(s.x, s.y - 20, opts, 64);
    this.menuTarget = { spot };
    if (this.level.tutorial && this.world.towers.length === 0) this.ui.toast(T('tutConfirm'));
  }

  private effRange(type: TowerType, def: TowerLevelDef): number {
    const m = this.world.mods;
    const mul = type === 'archer' ? m.archerRange : type === 'mage' ? m.mageRange : type === 'artillery' ? m.artRange : 1;
    return def.range * mul;
  }

  private openTowerMenu(t: Tower): void {
    this.closeMenu();
    this.setMode('idle');
    this.towerSay(t, 0.3);
    const w = this.world;
    const opts: RadialOption[] = [];
    const range = w.towerRange(t);
    this.drawRange(t.x, t.y, range, t.type === 'barracks' ? 0x6aa0ff : 0xffffff);
    this.ui.showInfo(this.towerInfo(t.type, t.def, null, t));
    if (t.type === 'barracks') this.showRallyFlag(t, true);

    if (t.level < 3) {
      const cost = w.upgradeCost(t)!;
      const next = TOWERS[t.type].levels[t.level];
      opts.push({
        id: 'up',
        icon: 'ic_upgrade',
        price: cost,
        enabled: w.gold >= cost,
        angle: -90,
        onPreview: () => {
          this.drawRange(t.x, t.y, this.effRange(t.type, next), 0x9aff7a);
          this.ui.showInfo(this.towerInfo(t.type, next, cost, undefined, t.def));
        },
        onConfirm: () => {
          if (w.upgrade(t)) {
            sfx.play('upgrade');
            this.closeMenu();
          }
        },
      });
    } else if (t.level === 3) {
      TOWERS[t.type].branches.forEach((b, i) => {
        const cost = w.branchCost(t, i)!;
        opts.push({
          id: 'br' + i,
          icon: `icb_${b.branchId}`,
          price: cost,
          enabled: w.gold >= cost,
          angle: i === 0 ? -130 : -50,
          dist: 70,
          size: 58,
          onPreview: () => {
            this.drawRange(t.x, t.y, this.effRange(t.type, b), 0x9aff7a);
            this.ui.showInfo(this.towerInfo(t.type, b, cost, undefined, t.def));
          },
          onConfirm: () => {
            if (w.chooseBranch(t, i)) {
              sfx.play('upgrade');
              this.closeMenu();
            }
          },
        });
      });
    } else {
      const skills = t.def.skills ?? [];
      const angs = skills.length === 2 ? [-130, -50] : [-150, -90, -30];
      skills.forEach((sk, i) => {
        const lv = t.skills[sk.id] ?? 0;
        const cost = w.skillCost(t, sk.id);
        opts.push({
          id: 'sk_' + sk.id,
          icon: `sk_${sk.id}`,
          badge: 'ui_badge_blue',
          price: cost,
          tag: cost === null ? 'MAX' : undefined,
          enabled: cost !== null && w.gold >= cost,
          pips: [lv, sk.costs.length],
          angle: angs[i],
          dist: 70,
          onPreview: () => {
            this.ui.showInfo({
              title: L(sk.name),
              desc: L(sk.desc),
              stats: [[T('level'), `${lv} / ${sk.costs.length}`]],
              cost: cost ?? undefined,
            });
          },
          onConfirm: () => {
            if (w.buySkill(t, sk.id)) {
              sfx.play('sparkle');
              this.closeMenu();
              this.openTowerMenu(t);
            }
          },
        });
      });
    }
    const refund = w.sellValue(t);
    opts.push({
      id: 'sell',
      icon: 'ic_sell',
      badge: 'ui_badge_red',
      price: refund,
      enabled: true,
      angle: 90,
      size: 46,
      onPreview: () => this.ui.showInfo({ title: T('sell'), desc: `+${refund}`, stats: [] }),
      onConfirm: () => {
        w.sell(t);
        sfx.play('sell');
        this.closeMenu();
      },
    });
    if (t.type === 'barracks') {
      opts.push({
        id: 'rally',
        icon: 'ic_rally',
        badge: 'ui_badge_blue',
        price: null,
        enabled: true,
        angle: 30,
        dist: 72,
        size: 46,
        confirm: false,
        onConfirm: () => {
          this.menu?.close();
          this.menu = null;
          this.setMode('rally');
          this.ui.toast(T('rally'));
        },
      });
    }
    this.menu = this.radial(t.x, t.y - 40, opts, 66);
    this.menuTarget = { tower: t };
  }

  private showRallyFlag(t: Tower, on: boolean): void {
    let f = this.rallyFlags.get(t.id);
    if (!on) {
      f?.setVisible(false);
      return;
    }
    if (!f) {
      f = this.add.image(0, 0, 'fx_rally').setOrigin(0.3, 0.95).setScale(1 / TEX).setDepth(DEPTH.float - 1);
      this.rallyFlags.set(t.id, f);
    }
    f.setPosition(t.rallyX, t.rallyY).setVisible(true);
    f.setScale(0);
    this.tweens.add({ targets: f, scale: 1 / TEX, duration: 250, ease: 'Back.easeOut' });
  }

  towerInfo(type: TowerType, def: TowerLevelDef, cost: number | null, tower?: Tower, prev?: TowerLevelDef): InfoData {
    const stats: [string, string][] = [];
    const m = this.world.mods;
    if (type === 'barracks' && def.soldier) {
      const st = def.soldier;
      stats.push([T('soldiers'), String(st.count)]);
      stats.push([T('hp'), String(Math.round(st.hp * m.barracksHp))]);
      stats.push([T('damage'), `${Math.round(st.dmg[0] * m.barracksDmg)}-${Math.round(st.dmg[1] * m.barracksDmg)}`]);
      stats.push([T('armor'), armorWord(st.armor + m.barracksArmor)]);
    } else {
      const dm = type === 'archer' ? m.archerDmg : type === 'mage' ? m.mageDmg : m.artDmg;
      stats.push([T('damage'), `${Math.round(def.damage[0] * dm)}-${Math.round(def.damage[1] * dm)}`]);
      stats.push([T('rate'), rateWord(def.cooldown)]);
      stats.push([T('range'), String(Math.round(this.effRange(type, def)))]);
      stats.push(['', def.hitsAir ? T('hitsAir') : T('groundOnly')]);
    }
    void prev;
    // 已蓋好的塔：本場戰績（傷害與擊殺）
    if (tower && def === tower.def && tower.dmgDealt > 0) stats.push([T('dealt'), T('dealtVal', Math.round(tower.dmgDealt).toLocaleString(), tower.kills)]);
    return { title: L(def.name), desc: L(def.desc), stats, cost: cost ?? undefined };
  }

  // ═════════════════════════ 波次按鈕 ═════════════════════════

  private createWaveButtons(): void {
    this.level.paths.forEach((_, i) => {
      const btn = new IconButton(this, 0, 0, 52, 'ic_skull', () => this.onSkullTap(), 'ui_badge_red', 0.7);
      btn.setBaseScale(uiZoom());
      btn.setDepth(DEPTH.menu - 10);
      btn.hit.on('pointerdown', (p: Phaser.Input.Pointer) => (this.lastTapTouch = p.wasTouch));
      const ring = this.add.graphics().setDepth(DEPTH.menu - 11).setScale(uiZoom());
      btn.setVisible(false);
      this.waveBtns.push({ path: i, btn, ring });
      btn.hit.on('pointerover', () => this.ui?.showWavePreview(this.world.nextWaveEnemies()));
      btn.hit.on('pointerout', () => this.ui?.hideInfo());
    });
    this.positionWaveButtons();
  }

  /** 出口標記（王國盾徽）：放在每條路最後一段可見處 */
  private createExitMarks(): void {
    const seen = new Set<string>();
    for (const p of this.world.paths) {
      const end = p.posAt(p.length);
      const key = `${Math.round(end.x / 40)}:${Math.round(end.y / 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const img = this.add.image(0, 0, 'ic_shield').setDisplaySize(40, 40).setDepth(DEPTH.float - 20);
      img.setData('path', p);
      this.exitMarks.push(img);
      this.tweens.add({ targets: img, scale: img.scale * 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.positionExitMarks();
  }

  /** 右下角道具列（HUD）遮住的區域：波次按鈕與出口標記要避開 */
  private underItemBar(x: number, y: number, right: number): boolean {
    const z = hudZoom();
    return x > right - 250 * z && y > VIEW_H - 90 * z;
  }

  /** 環狀選單：手機上放大，並夾在畫面內（靠邊的建造點選單不會被切掉） */
  private radial(x: number, y: number, opts: RadialOption[], radius: number): RadialMenu {
    // 地圖放大時選單也跟著放大會太大：除以玩家縮放，維持在螢幕上的大小
    const z = uiZoom() / this.userZoom;
    const v = this.visibleRect();
    const ex = (radius + 40) * z;
    const cx = Phaser.Math.Clamp(x, v.left + ex, Math.max(v.left + ex, v.right - ex));
    const cy = Phaser.Math.Clamp(y, v.top + (radius + 34) * z, Math.max(v.top + (radius + 34) * z, v.bottom - (radius + 48) * z));
    return new RadialMenu(this, cx, cy, opts, radius, z);
  }

  private positionExitMarks(): void {
    const v = this.viewRect();
    for (const img of this.exitMarks) {
      const p = img.getData('path') as import('../sim/Path').Path;
      let pos = p.posAt(p.length);
      for (let d = p.length; d > 0; d -= 8) {
        const q = p.posAt(d);
        if (q.x > v.left + 30 && q.x < v.right - 30 && q.y > 60 && q.y < VIEW_H - 30 && !this.underItemBar(q.x, q.y, v.right)) {
          pos = q;
          break;
        }
      }
      img.setPosition(pos.x, pos.y - 26);
    }
  }

  private updateTutorial(time: number): void {
    const a = this.tutArrow;
    if (!a) return;
    const w = this.world;
    let target: { x: number; y: number } | null = null;
    // 劇情 / 介紹卡等對話框開著時先不提示
    if (this.ui?.hasModal()) {
      a.setVisible(false);
      return;
    }
    if (w.towers.length === 0 && !this.menu) {
      // 推薦建造點：最靠近路徑中段的點
      const mid = w.paths[0].posAt(w.paths[0].length * 0.55);
      let best = w.spots[0];
      for (const s of w.spots) if (Math.hypot(s.x - mid.x, s.y - mid.y) < Math.hypot(best.x - mid.x, best.y - mid.y)) best = s;
      target = { x: best.x, y: best.y - 34 };
    } else if (w.towers.length > 0 && w.waveIndex < 0 && !this.menu) {
      const b = this.waveBtns.find((x) => x.btn.visible);
      if (b) target = { x: b.btn.x, y: b.btn.y - 40 * uiZoom() };
    }
    if (!target) {
      a.setVisible(false);
      if (w.waveIndex >= 0) {
        a.destroy();
        this.tutArrow = null;
      }
      return;
    }
    a.setVisible(true);
    a.setPosition(target.x, target.y - Math.abs(Math.sin(time / 220)) * 14);
  }

  private positionWaveButtons(): void {
    const v = this.viewRect();
    const z = uiZoom();
    for (const wb of this.waveBtns) {
      const p = this.world.paths[wb.path];
      let pos = p.posAt(0);
      for (let d = 0; d < p.length; d += 8) {
        const q = p.posAt(d);
        if (q.x > v.left + 40 * z && q.x < v.right - 40 * z && q.y > 70 * z && q.y < VIEW_H - 40 * z && !this.underItemBar(q.x, q.y, v.right)) {
          pos = q;
          break;
        }
      }
      wb.btn.setPosition(pos.x, pos.y - 6);
      wb.ring.setPosition(pos.x, pos.y - 6);
    }
  }

  /** 觸控：第一下顯示下一波內容，3 秒內再點一下才呼叫（滑鼠有 hover 預覽，直接呼叫） */
  private onSkullTap(): void {
    const first = this.world.waveIndex < 0;
    if (this.lastTapTouch && !first && this.time.now > this.skullArmedUntil) {
      this.skullArmedUntil = this.time.now + 3000;
      this.ui.showWavePreview(this.world.nextWaveEnemies());
      return;
    }
    this.skullArmedUntil = 0;
    this.callWave();
  }

  callWave(): void {
    const w = this.world;
    if (!w.canCallWave()) return;
    const bonus = w.callNextWave();
    sfx.play('horn');
    if (bonus > 0) sfx.play('coin');
    this.ui.hideInfo();
  }

  private updateWaveButtons(time: number): void {
    const w = this.world;
    const can = w.canCallWave();
    const paths = can ? new Set(w.nextWavePaths()) : new Set<number>();
    for (const wb of this.waveBtns) {
      const vis = paths.has(wb.path);
      wb.btn.setVisible(vis);
      wb.ring.clear();
      if (!vis) continue;
      const pulse = 1 + Math.sin(time / 180) * 0.06;
      wb.btn.setScale(pulse);
      if (w.waveState === 'gap') {
        const k = Phaser.Math.Clamp((w.nextWaveAt - w.time) / w.gapTotal, 0, 1);
        wb.ring.lineStyle(5, 0x1a0a04, 0.8);
        wb.ring.beginPath();
        wb.ring.arc(0, 0, 30, 0, Math.PI * 2);
        wb.ring.strokePath();
        wb.ring.lineStyle(3.5, 0xffd84a, 1);
        wb.ring.beginPath();
        wb.ring.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        wb.ring.strokePath();
      } else {
        wb.ring.lineStyle(3, 0xffd84a, 0.4 + Math.sin(time / 150) * 0.3);
        wb.ring.strokeCircle(0, 0, 31);
      }
    }
  }

  // ═════════════════════════ 主迴圈 ═════════════════════════

  override update(time: number, deltaMs: number): void {
    const w = this.world;
    if (!this.paused && !w.result) {
      // 首領倒下時短暫慢動作
      const slow = time < this.slowMoUntil ? 0.3 : 1;
      this.acc += (Math.min(deltaMs, 100) / 1000) * this.speed * slow;
      let n = 0;
      while (this.acc >= STEP && n < 16) {
        w.step(STEP);
        this.acc -= STEP;
        n++;
      }
    }
    this.handleEvents(w.drainEvents());
    this.sync(time);
    this.updateWaveButtons(time);
    this.updateTutorial(time);
    this.ui?.refresh();
    // 選單打開時更新可負擔狀態（金幣變動）
  }

  private handleEvents(evs: SimEvent[]): void {
    for (const ev of evs) {
      switch (ev.type) {
        case 'enemySpawn': {
          const e = ev.e;
          const v = new UnitView(this, e.def.sprite, e.def.height, e.def.facesRight, !!e.def.flying, Math.max(20, e.def.radius * 2), true, 0x5ad04a);
          if (e.def.boss) v.body.setScale(v.body.scale);
          this.enemyViews.set(e.id, v);
          if (!this.seenIntro.has(e.def.id)) {
            this.seenIntro.add(e.def.id);
            const sv = save();
            if (!sv.seenEnemies.includes(e.def.id)) {
              sv.seenEnemies.push(e.def.id);
              persist();
            }
          }
          break;
        }
        case 'enemyDie': {
          const v = this.enemyViews.get(ev.e.id);
          if (v) {
            v.die('death');
            this.enemyViews.delete(ev.e.id);
          }
          const fy = ev.e.flying ? -30 : 0;
          this.fx.smokePuff(ev.e.x, ev.e.y - 10 + fy, ev.e.def.boss ? 16 : 4);
          if (ev.e.def.boss) {
            this.fx.explosion(ev.e.x, ev.e.y, 90, 'meteor');
            this.fx.stars(ev.e.x, ev.e.y - 40, 14);
            sfx.play('explosion');
            sfx.play('star', 0.8);
            this.slowMoUntil = this.time.now + 1400;
            this.cameras.main.flash(260, 255, 240, 200);
            this.ui.bossDefeated(L(ev.e.def.name));
          }
          sfx.play('death', 0.5);
          break;
        }
        case 'enemyLeak': {
          const v = this.enemyViews.get(ev.e.id);
          if (v) {
            v.die('leak');
            this.enemyViews.delete(ev.e.id);
          }
          break;
        }
        case 'lifeLost':
          sfx.play('lifelost');
          this.cameras.main.flash(160, 160, 20, 20, false);
          this.ui.bumpLives();
          break;
        case 'gold':
          this.fx.floatText(ev.x, ev.y, `+${ev.amount}`, '#ffe066', 15);
          break;
        case 'soldierSpawn': {
          const s = ev.s;
          let v = this.soldierViews.get(s.id);
          if (v && !v.dead) {
            v.setVisible(true);
          } else {
            const isHero = s.kind === 'hero';
            const tex = s.sprite;
            v = new UnitView(this, tex, s.height, isHero ? s.hero!.def.facesRight : soldierFacesRight(tex), !!s.hero?.def.flying, isHero ? 30 : 22, isHero, isHero ? 0x4ab0ff : 0x7ad0ff);
            this.soldierViews.set(s.id, v);
          }
          if (s.kind === 'militia' || s.kind === 'golem') this.fx.smokePuff(s.x, s.y - 8, 5);
          if (s.kind === 'hero') this.fx.ring(s.x, s.y, 36, 0xffe08a, 400);
          break;
        }
        case 'soldierDie': {
          const s = ev.s;
          const v = this.soldierViews.get(s.id);
          if (v) {
            if (s.kind === 'hero') {
              v.setVisible(false);
              this.fx.smokePuff(s.x, s.y - 16, 8);
            } else {
              v.die(s.kind === 'militia' && s.hp > 0 ? 'fade' : 'death');
              this.soldierViews.delete(s.id);
            }
          }
          break;
        }
        case 'projSpawn':
          this.spawnProj(ev.p);
          break;
        case 'projHit': {
          const img = this.projViews.get(ev.p.id);
          if (img) {
            if (!ev.hit && (ev.p.kind === 'arrow' || ev.p.kind === 'heroArrow')) {
              // 沒射中：箭插在地上淡出
              img.setRotation(img.rotation + 0.3);
              this.tweens.add({ targets: img, alpha: 0, delay: 300, duration: 400, onComplete: () => this.releaseProj(img) });
            } else this.releaseProj(img);
            this.projViews.delete(ev.p.id);
          }
          if (ev.hit) this.projImpactFx(ev.p);
          break;
        }
        case 'explosion':
          this.fx.explosion(ev.x, ev.y, ev.r, ev.kind);
          if (ev.kind === 'bomb' || ev.kind === 'bomblet' || ev.kind === 'missile') sfx.play('explosion', ev.kind === 'bomblet' ? 0.5 : 0.8);
          else if (ev.kind === 'meteor') sfx.play('explosion', 1);
          else if (ev.kind === 'nova') sfx.play('freeze');
          else if (ev.kind === 'holy') sfx.play('heal');
          else if (ev.kind === 'shock') sfx.play('zap', 0.6);
          else if (ev.kind === 'wave') sfx.play('splash');
          break;
        case 'towerShoot': {
          const tp = ev.t.def.attack;
          if (tp === 'arrow') sfx.play('arrow', 0.6);
          else if (tp === 'bolt') sfx.play('magic', 0.6);
          else if (tp === 'bomb') {
            sfx.play('cannon', 0.7);
            const m = this.world.muzzle(ev.t);
            this.fx.smokePuff(m.x, m.y - 6 - this.muzzleLift(ev.t), 3);
          } else if (tp === 'tesla') sfx.play('zap', 0.8);
          break;
        }
        case 'lightning':
          if (ev.t) {
            const pts = ev.pts.slice();
            pts[0] = { x: pts[0].x, y: pts[0].y - this.muzzleLift(ev.t) };
            this.fx.lightning(pts);
          } else this.fx.lightning(ev.pts);
          break;
        case 'beam':
          if (ev.kind === 'disintegrate') {
            this.fx.beam(ev.x1, ev.y1 - (ev.t ? this.muzzleLift(ev.t) : 0), ev.x2, ev.y2, 0xb050ff, 0xffe0ff);
            sfx.play('zap');
          } else if (ev.kind === 'charge') {
            this.fx.beam(ev.x1, ev.y1, ev.x2, ev.y2, 0xffd27a, 0xffffff);
            this.fx.smokePuff(ev.x2, ev.y2 + 10, 6);
            sfx.play('lance');
          } else {
            this.fx.beam(ev.x1, ev.y1, ev.x2, ev.y2, 0x5ab0ff, 0xe0f6ff);
            sfx.play('freeze');
          }
          break;
        case 'melee':
          this.fx.meleeHit(ev.x, ev.y, ev.heavy);
          sfx.play(ev.heavy ? 'thud' : 'sword', 0.5);
          break;
        case 'heal':
          this.fx.healFx(ev.x, ev.y);
          sfx.play('heal', 0.4);
          break;
        case 'enemyHeal':
          this.fx.healFx(ev.x, ev.y);
          break;
        case 'heroLevel':
          sfx.play('levelup');
          if (this.world.hero) {
            this.fx.ring(this.world.hero.x, this.world.hero.y, 50, 0xffe08a, 600);
            this.fx.stars(this.world.hero.x, this.world.hero.y - 40, 8);
            this.fx.floatText(this.world.hero.x, this.world.hero.y - 70, `LV ${ev.level}`, '#ffe066', 22);
          }
          break;
        case 'heroSkill':
          this.heroSkillFx(ev.skill, ev.x, ev.y);
          break;
        case 'waveStart':
          // 開波前的狀態存成存檔點（手機被重新整理後可從這一波繼續）
          saveCheckpoint(snapshot(this.world, { levelId: this.baseLevel.id, mode: this.mode0, difficulty: this.difficulty, dailyKey: this.mode0 === 'daily' ? this.dailyKey : undefined }, ev.index - 1));
          this.ui.waveBanner(ev.index + 1, this.world.waveCount, ev.boss);
          // 開戰時英雄喊一聲
          if (ev.index === 0 && this.world.hero?.alive && this.world.hero.hero) this.heroShout('select');
          this.maybeTip(ev.index);
          if (this.hazardLayer && !save().tipsSeen.includes('hazard')) {
            this.time.delayedCall(4000, () => {
              if (!this.hazardLayer || this.world.result || this.ui.hasModal() || save().tipsSeen.includes('hazard')) return;
              save().tipsSeen.push('hazard');
              persist();
              this.ui.toast(T('tipHazard'), 5500);
              this.hazardLayer.pointAt(0, 6000);
            });
          }
          if (ev.boss) {
            sfx.play('boss');
            // 首領登場喊話（號角聲之後）
            const boss = this.bossIds(ev.index)[0];
            // 沙暴巨蟲、利維坦這類野獸不說話，只會吼
            if (boss) this.time.delayedCall(900, () => (BOSS_VOICES[boss] ? this.bossTaunt(boss) : sfx.play('roar')));
            sfx.playBgm(this.level.bgm ?? 'boss');
            camShake(this, 400, 0.004);
          }
          break;
        case 'hazard':
          this.hazardLayer?.onTrigger(ev.i, ev.x, ev.y, ev.tx, ev.ty);
          break;
        case 'hazardEnd':
          this.hazardLayer?.onEnd(ev.i, ev.x, ev.y, ev.kills);
          break;
        case 'waveBonus':
          this.fx.floatText(ev.x, ev.y - 30, `+${ev.gold}`, '#ffe066', 22);
          break;
        case 'status':
          this.statusFx(ev.e, ev.kind);
          break;
        case 'item':
          this.itemFx(ev.id, ev.x, ev.y);
          break;
        case 'heroUlt':
          this.heroUltFx(ev.hero, ev.x, ev.y, ev.r);
          break;
        case 'summon':
          this.fx.smokePuff(ev.x, ev.y - 10, 10);
          sfx.play('boss', 0.5);
          break;
        case 'build': {
          const v = new TowerView(this, ev.t);
          v.pop();
          this.towerViews.set(ev.t.id, v);
          this.spotImgs[ev.t.spot].setVisible(false);
          this.spotHits[ev.t.spot].disableInteractive();
          this.fx.smokePuff(ev.t.x, ev.t.y - 10, 10);
          const bt = ev.t;
          this.time.delayedCall(650, () => {
            if (this.world.towers.includes(bt)) this.towerSay(bt, 0.8);
          });
          const tw = isTouchDevice() ? 88 : 76;
          const hit = this.add.rectangle(ev.t.x, ev.t.y - 30, tw, tw + 8, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(ev.t.y);
          hit.on('pointerup', (p2: Phaser.Input.Pointer, _x: number, _y: number, e2: Phaser.Types.Input.EventData) => {
            e2?.stopPropagation?.();
            if (!this.isTap(p2)) return;
            if (this.mode === 'meteor' || this.mode === 'reinforce' || this.mode === 'hero' || this.mode === 'keg' || this.mode === 'ult') {
              this.onGroundTap(ev.t.x, ev.t.y + 10);
              return;
            }
            if (this.menuTarget?.tower === ev.t) this.closeMenu();
            else this.openTowerMenu(ev.t);
          });
          this.towerHits.set(ev.t.id, hit);
          break;
        }
        case 'upgrade': {
          const v = this.towerViews.get(ev.t.id);
          v?.setArt(ev.t.def.art);
          v?.pop();
          this.fx.stars(ev.t.x, ev.t.y - 50, 8);
          this.towerSay(ev.t, ev.t.level >= 4 ? 1 : 0.5, 100);
          this.fx.smokePuff(ev.t.x, ev.t.y - 10, 6);
          break;
        }
        case 'sell': {
          const v = this.towerViews.get(ev.t.id);
          v?.destroy();
          this.towerViews.delete(ev.t.id);
          this.towerHits.get(ev.t.id)?.destroy();
          this.towerHits.delete(ev.t.id);
          this.rallyFlags.get(ev.t.id)?.destroy();
          this.rallyFlags.delete(ev.t.id);
          this.spotImgs[ev.t.spot].setVisible(true);
          this.spotHits[ev.t.spot].setInteractive({ useHandCursor: true });
          this.fx.smokePuff(ev.t.x, ev.t.y - 20, 12);
          this.fx.floatText(ev.t.x, ev.t.y - 60, `+${ev.refund}`, '#ffe066', 20);
          break;
        }
        case 'skillBuy':
          this.fx.stars(ev.t.x, ev.t.y - 60, 6);
          break;
        case 'spell':
          if (ev.kind === 'meteor') this.ui.flashSpell('meteor');
          break;
        case 'zone':
          this.spawnZone(ev.z.id, ev.z.kind, ev.z.x, ev.z.y, ev.z.r, ev.z.until - this.world.time);
          break;
        case 'victory':
        case 'defeat':
          this.time.delayedCall(ev.type === 'victory' ? 1400 : 900, () => this.showResult());
          break;
        default:
          break;
      }
    }
  }

  private heroSkillFx(skill: string, x: number, y: number): void {
    switch (skill) {
      case 'rally':
        this.fx.ring(x, y, 140, 0xffe08a, 600);
        sfx.play('heal');
        break;
      case 'multishot':
        sfx.play('arrow');
        break;
      case 'whirlwind':
        this.fx.ring(x, y, 50, 0xffffff, 250);
        sfx.play('sword', 0.6);
        break;
      case 'hail':
        sfx.play('whoosh', 0.6);
        break;
      case 'thrust':
        sfx.play('lance', 0.7);
        break;
      case 'phalanx':
        this.fx.ring(x, y, 110, 0xc8d8ff, 600);
        sfx.play('horn', 0.4);
        break;
      case 'shadowstep':
        // 瞬身：原地留下一團煙
        this.fx.smokePuff(x, y - 16, 8);
        sfx.play('whoosh', 0.8);
        break;
      case 'smokebomb':
        this.fx.explosion(x, y, 90, 'smoke');
        sfx.play('whoosh');
        break;
      case 'execute':
        sfx.play('sword');
        camShake(this, 120, 0.004);
        break;
      default:
        break;
    }
  }

  private statusFx(e: Enemy, kind: string): void {
    const y = e.y - e.def.height * 0.6 + (e.flying ? -30 : 0);
    switch (kind) {
      case 'dodge':
        this.fx.floatText(e.x, y - 10, 'MISS', '#d0e8ff', 13);
        break;
      case 'burrow':
      case 'surface':
        this.fx.smokePuff(e.x, e.y - 4, 7);
        this.fx.ring(e.x, e.y, 26, 0xe8c888, 300);
        sfx.play('thud', 0.35);
        break;
      case 'stun':
        this.fx.stars(e.x, y - 10, 4);
        break;
      case 'root':
        this.fx.leaves(e.x, e.y);
        break;
      case 'poison':
        this.fx.poisonPuff(e.x, y);
        break;
      case 'sheep': {
        const v = this.enemyViews.get(e.id);
        v?.setTexture('mon_sheep', 30);
        this.fx.smokePuff(e.x, e.y - 10, 8);
        sfx.play('sparkle');
        break;
      }
      case 'teleport':
        this.fx.ring(e.x, e.y, 26, 0xc890ff, 300);
        this.fx.hitSpark(e.x, e.y - 10, 6);
        break;
      case 'enrage':
        this.fx.floatText(e.x, y - 20, '!!', '#ff5a4a', 26);
        sfx.play('boss', 0.7);
        break;
      default:
        break;
    }
  }

  private spawnProj(p: Projectile): void {
    const key = PROJ_TEX[p.kind] ?? 'pj_arrow';
    const img = (this.projPool.pop() ?? this.add.image(0, 0, key)).setTexture(key).setPosition(p.x, p.y - this.projLift(p));
    img.setDepth(DEPTH.proj).setScale(1 / TEX).setAlpha(1).setVisible(true).setRotation(0).setBlendMode('NORMAL');
    if (p.kind === 'bolt' || p.kind === 'heroBolt' || p.kind === 'enemyBolt' || p.kind === 'iceShard') img.setBlendMode('ADD');
    if (p.kind === 'meteor') img.setScale(1.3 / TEX);
    if (p.kind === 'bomblet') img.setScale(0.7 / TEX);
    if (p.kind === 'heroBolt' && this.world.hero?.hero?.def.id === 'lila') img.setTexture('pj_ice');
    this.projViews.set(p.id, img);
  }

  /** 手繪塔比模擬的射擊點高：差距（畫面像素） */
  private muzzleLift(t: Tower): number {
    return Math.max(0, visualMuzzleH(t.def.art) - (t.y - this.world.muzzle(t).y));
  }

  /** 塔射出的投射物從塔頂出發、飛行中逐漸回到模擬軌跡（命中點不變） */
  private projLift(p: Projectile): number {
    if (!(p.owner instanceof Tower) || p.dur <= 0) return 0;
    return this.muzzleLift(p.owner) * Math.max(0, 1 - p.t / p.dur);
  }

  private releaseProj(img: Phaser.GameObjects.Image): void {
    if (this.projPool.length > 120) {
      img.destroy();
      return;
    }
    img.setVisible(false);
    this.projPool.push(img);
  }

  private projImpactFx(p: Projectile): void {
    switch (p.kind) {
      case 'bolt':
      case 'heroBolt':
        this.fx.hitSpark(p.x, p.y, 5);
        break;
      case 'enemyBolt':
        this.fx.hitSpark(p.x, p.y, 3);
        break;
      case 'snipe':
        this.fx.hitSpark(p.x, p.y, 7);
        sfx.play('hit', 0.8);
        break;
      case 'arrow':
      case 'heroArrow':
      case 'axe':
      case 'enemyArrow':
        if (Math.random() < 0.3) sfx.play('hit', 0.35);
        break;
      default:
        break;
    }
  }

  private spawnZone(id: number, kind: string, x: number, y: number, r: number, dur: number): void {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const base = this.add.ellipse(x, y, r * 2, r * 2 * RANGE_Y, kind === 'fire' ? 0xff6a1a : 0x9ad8ff, 0.25).setDepth(DEPTH.zone);
    objs.push(base);
    const em = this.add.particles(x, y, kind === 'fire' ? 'fx_fire' : 'fx_snow', {
      x: { min: -r * 0.8, max: r * 0.8 },
      y: { min: -r * 0.5, max: r * 0.4 },
      lifespan: kind === 'fire' ? 500 : 900,
      speedY: kind === 'fire' ? { min: -60, max: -20 } : { min: 30, max: 80 },
      scale: kind === 'fire' ? { start: 0.4, end: 0 } : { start: 0.6, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      blendMode: kind === 'fire' ? 'ADD' : 'NORMAL',
      frequency: 40,
    });
    em.setDepth(DEPTH.fx);
    objs.push(em);
    this.zoneViews.set(id, objs);
    this.time.delayedCall(Math.max(100, dur * 1000), () => {
      this.tweens.add({ targets: base, alpha: 0, duration: 300, onComplete: () => base.destroy() });
      em.stop();
      this.time.delayedCall(1000, () => em.destroy());
      this.zoneViews.delete(id);
    });
  }

  private sync(time: number): void {
    const w = this.world;
    const t = w.time;
    for (const e of w.enemies) {
      const v = this.enemyViews.get(e.id);
      if (!v) continue;
      let tint: number | undefined = e.sheep ? undefined : e.def.tint;
      if (e.enraged) tint = 0xff8a7a;
      if (t < e.rootUntil) tint = 0xc0a070;
      else if (e.dots.length) tint = 0xb8ff8a;
      else if (t < e.vulnUntil) tint = 0xd8a0ff;
      else if (e.slowMul < 1 && t < e.slowUntil) tint = 0x9ad0ff;
      const frozen = t < e.frozenUntil;
      if (frozen) tint = 0xb8e4ff;
      v.update({
        x: e.x,
        y: e.y,
        facing: e.facing,
        moving: e.moving,
        t,
        hpRatio: e.hp / e.maxHp,
        lastAttackAt: e.lastAttackAt,
        lastHitAt: e.lastHitAt,
        tint,
        stunned: t < e.stunUntil && !frozen,
        frozen,
        burrowed: e.burrowed,
      });
      if (e.dots.length && Math.random() < 0.05) this.fx.poisonPuff(e.x, e.y - e.def.height * 0.6);
    }
    for (const s of w.soldiers) {
      const v = this.soldierViews.get(s.id);
      if (!v) continue;
      if (!s.alive) continue;
      v.update({
        x: s.x,
        y: s.y,
        facing: s.facing,
        moving: s.moving,
        t,
        hpRatio: s.hp / s.maxHp,
        lastAttackAt: s.lastAttackAt,
        lastHitAt: s.lastHitAt,
        tint: s.armorBuff > 0 ? 0xfff0b0 : s.tint,
      });
      if (s.expireAt !== Infinity && s.expireAt - t < 3) v.body.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(t * 8)));
    }
    for (const tw of w.towers) this.towerViews.get(tw.id)?.update(time, t);
    this.hazardLayer?.update();
    for (const p of w.projectiles) {
      const img = this.projViews.get(p.id);
      if (!img) continue;
      img.setPosition(p.x, p.y - this.projLift(p));
      if (p.kind === 'bomb' || p.kind === 'bomblet' || p.kind === 'axe') img.rotation += 0.2;
      else if (p.kind === 'meteor') {
        img.setRotation(0);
        if (Math.random() < 0.6) this.fx.fireBurst(p.x, p.y, 1);
      } else img.setRotation(p.rot);
    }
  }

  // ═════════════════════════ 開場 / 結算 ═════════════════════════

  private introNewEnemies(ids: string[]): void {
    const sv = save();
    const fresh = ids.filter((id) => ENEMIES[id] && !sv.seenEnemies.includes(id));
    if (!fresh.length) {
      if (this.level.tutorial && this.world.towers.length === 0) this.ui.toast(T('tutBuild'), 4000);
      return;
    }
    this.ui.showEnemyIntro(fresh, () => {
      if (this.level.tutorial && this.world.towers.length === 0) this.ui.toast(T('tutBuild'), 4000);
    });
  }

  /** 塔冒出一句台詞，有配音就一起說（第 4 級特化用自己的台詞） */
  private towerSay(t: Tower, chance: number, lift = 96): void {
    const key = BRANCH_BARKS[t.def.art] ? t.def.art : t.type;
    const i = this.bubbles.say(`t${t.id}`, t.x, t.y - lift, towerBark(t.type, t.def.art), chance);
    if (i >= 0) sfx.towerVoice(key, i);
  }

  /** 英雄喊話（開戰、絕招）：配音＋頭上的對話泡泡 */
  private heroShout(line: 'select' | 'ult'): void {
    const h = this.world.hero;
    const id = h?.hero?.def.id;
    if (!h || !id) return;
    sfx.voice(id, line);
    const text = voiceText(id, line);
    if (text && h.alive) this.bubbles.say('hero', h.x, h.y - h.height - 12, [text], 1, true);
  }

  /** 首領喊話：配音＋對話泡泡（首領還沒走進畫面就改用提示字） */
  private bossTaunt(boss: string): void {
    const v = BOSS_VOICES[boss];
    if (!v) return;
    sfx.bossVoice(boss);
    const e = this.world.enemies.find((x) => x.alive && x.def.id === boss && x.x > 0 && x.x < WORLD_W && x.y > 0 && x.y < VIEW_H);
    if (e) this.bubbles.say(`boss_${boss}`, e.x, e.y - e.def.radius * 2.6 - 24, [v.line], 1, true);
    else this.ui.toast(`${L(ENEMIES[boss].name)}：「${L(v.line)}」`, 3000);
  }

  /** 這關（或某一波）出場的首領 */
  private bossIds(wave?: number): string[] {
    const waves = wave === undefined ? this.level.waves : this.level.waves.slice(wave, wave + 1);
    const ids = new Set<string>();
    for (const w of waves) for (const g of w.groups) if (ENEMIES[g.enemy]?.boss) ids.add(g.enemy);
    return [...ids];
  }

  private showResult(): void {
    if (this.resultShown) return;
    this.resultShown = true;
    clearCheckpoint();
    const w = this.world;
    const sv = save();
    const victory = w.result === 'victory';
    const stars = w.stars();
    const hero = w.hero?.hero;
    if (hero) {
      // 失敗也保留一半經驗，避免挫折
      const gained = hero.xp - hero.startXp;
      sv.heroes[hero.def.id] = { xp: Math.round(hero.startXp + (victory ? gained : gained * 0.5)) };
    }
    let newStars = 0;
    const prevCampaignStars = sv.stars[this.level.id] ?? 0;
    const reached = victory ? w.waveCount : Math.max(0, w.waveIndex + 1);
    let newRecord = false;
    let dailyFirst = false;
    if (this.mode0 === 'endless') {
      const prev = sv.endless[this.level.id] ?? 0;
      if (reached > prev) {
        sv.endless[this.level.id] = reached;
        newRecord = true;
      }
    } else if (this.mode0 === 'bossrush') {
      if (victory) {
        const prev = sv.bossrush[this.level.id] ?? 0;
        dailyFirst = prev === 0;
        if (stars > prev) {
          sv.bossrush[this.level.id] = stars;
          newStars = stars - prev;
        }
      }
    } else if (this.mode0 === 'daily') {
      if (victory) {
        const prev = sv.daily[this.dailyKey] ?? 0;
        dailyFirst = prev === 0;
        if (stars > prev) {
          sv.daily[this.dailyKey] = stars;
          newStars = stars - prev;
        }
      }
    } else if (victory) {
      if (this.mode0 === 'campaign') {
        const prev = sv.stars[this.level.id] ?? 0;
        if (stars > prev) {
          newStars = stars - prev;
          sv.stars[this.level.id] = stars;
        }
      } else {
        const c = (sv.challenges[this.level.id] ??= {});
        const m = this.mode0 as 'heroic' | 'iron';
        if (!c[m]) {
          c[m] = true;
          newStars = 1;
        }
      }
    }
    if (victory) sv.stats.victories++;
    sv.stats.kills += w.stats.kills;
    sv.stats.towers = (sv.stats.towers ?? 0) + w.stats.towersBuilt;
    const fresh = evaluateAchievements(
      {
        levelId: this.level.id,
        mode: this.mode0,
        difficulty: this.difficulty,
        victory,
        stars,
        lives: w.lives,
        maxLives: w.maxLives,
        towersAtEnd: w.towers.length,
        maxTowerLevel: Math.max(0, ...w.towers.map((t) => t.level)),
        skillMaxed: w.towers.some((t) => (t.def.skills ?? []).some((k) => (t.skills[k.id] ?? 0) >= k.costs.length)),
        earlyCalls: w.stats.earlyCalls,
        meteorKills: w.stats.meteorKills,
        sheep: w.stats.sheep,
        bestHazard: w.stats.bestHazard,
        heroLevel: hero?.level ?? 0,
        bossesKilled: w.stats.bossesKilled,
        wave: reached,
      },
      sv,
    );
    // 寶石：本場獎勵＋新成就
    const firstClear = this.mode0 === 'campaign' ? victory && prevCampaignStars === 0 : this.mode0 === 'daily' || this.mode0 === 'bossrush' ? dailyFirst : newStars > 0;
    const gems = gemReward(this.mode0, victory, stars, firstClear, reached) + fresh.length * GEMS_PER_ACHIEVEMENT;
    sv.gems = (sv.gems ?? 0) + gems;
    this.gemsEarned = gems;
    persist();
    sfx.fadeOutBgm();
    sfx.play(victory || newRecord ? 'victory' : 'defeat');
    if (this.mode0 === 'endless') this.ui.showEndlessResult(reached, sv.endless[this.level.id] ?? reached, newRecord);
    else this.ui.showResult(victory, stars, newStars);
    fresh.forEach((id, i) => this.time.delayedCall(1800 + i * 2200, () => this.ui.achievementToast(id)));
  }

  private heroUltFx(hero: string, x: number, y: number, r: number): void {
    const COLORS: Record<string, number> = { arthur: 0xffe08a, elena: 0x9aff7a, lila: 0x9ae4ff, rain: 0xff9a5a, aria: 0xc8b0ff, sharon: 0xd8a0ff, viktor: 0xc8d8ff, shadow: 0xa898c8 };
    const col = COLORS[hero] ?? 0xffffff;
    this.fx.ring(x, y, r, col, 500);
    this.fx.ring(x, y, r * 0.6, col, 380);
    switch (hero) {
      case 'arthur':
        sfx.play('horn', 0.6);
        this.fx.smokePuff(x, y, 12);
        break;
      case 'elena':
        sfx.play('whoosh');
        break;
      case 'lila':
        sfx.play('freeze');
        this.cameras.main.flash(250, 150, 210, 255);
        break;
      case 'rain':
        sfx.play('lance');
        camShake(this, 220, 0.005);
        break;
      case 'aria':
        sfx.play('zap');
        this.cameras.main.flash(200, 220, 200, 255);
        break;
      case 'sharon':
        sfx.play('heal');
        this.cameras.main.flash(220, 240, 220, 255);
        break;
      case 'viktor':
        sfx.play('horn', 0.6);
        sfx.play('lance', 0.8);
        camShake(this, 260, 0.006);
        this.fx.smokePuff(x, y, 12);
        break;
      case 'shadow':
        sfx.play('whoosh');
        sfx.play('sword', 0.8);
        this.cameras.main.flash(160, 120, 100, 160);
        break;
    }
    this.ui.ultPop();
  }

  private itemFx(id: ItemId, x: number, y: number): void {
    switch (id) {
      case 'keg':
        sfx.play('explosion');
        this.fx.ring(x, y, KEG.r, 0xffa040, 420);
        break;
      case 'frost':
        sfx.play('freeze');
        this.cameras.main.flash(350, 150, 210, 255);
        for (const e of this.world.enemies) if (e.alive) this.fx.ring(e.x, e.y - 10, 26, 0x9ae4ff, 500);
        break;
      case 'potion':
        sfx.play('heal');
        break;
      case 'gold':
        sfx.play('coin');
        break;
    }
    this.ui.itemPop(id);
  }

  restart(): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(260, () => this.scene.restart({ levelId: this.level.id, difficulty: this.difficulty, mode: this.mode0 }));
  }

  exitToMap(nextLevel?: string): void {
    clearCheckpoint();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(260, () => {
      this.scene.stop('LevelUI');
      if (nextLevel) this.scene.start('Level', { levelId: nextLevel, difficulty: this.difficulty });
      else this.scene.start('Map', { focus: this.level.id });
    });
  }

  /** 最終關通關 → 尾聲與製作群 */
  exitToEnding(story: EpilogueId = 'main'): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => {
      this.scene.stop('LevelUI');
      this.scene.start('Ending', { epilogue: true, story, back: 'Map' });
    });
  }

  heroView(): UnitView | undefined {
    return this.world.hero ? this.soldierViews.get(this.world.hero.id) : undefined;
  }

  isSoldier(s: unknown): s is Soldier {
    return s instanceof Soldier;
  }

  inPlay(x: number, y: number): boolean {
    return inEllipse(PLAY_W / 2, VIEW_H / 2, x, y, PLAY_W);
  }
}

const PROJ_TEX: Record<string, string> = {
  arrow: 'pj_arrow',
  heroArrow: 'pj_arrow',
  enemyArrow: 'pj_arrow',
  bolt: 'pj_bolt',
  heroBolt: 'pj_bolt',
  enemyBolt: 'pj_enemybolt',
  iceShard: 'pj_ice',
  bomb: 'pj_bomb',
  bomblet: 'pj_bomb',
  missile: 'pj_missile',
  meteor: 'pj_meteor',
  axe: 'pj_axe',
  snipe: 'pj_snipe',
};

/** 士兵 sprite 原圖朝向 */
function soldierFacesRight(tex: string): boolean {
  return !['sp_gary', 'sp_vlad'].includes(tex);
}

function rateWord(cd: number): string {
  if (cd <= 0.5) return T('veryFast');
  if (cd <= 0.9) return T('fast');
  if (cd <= 1.7) return T('medium');
  if (cd <= 2.6) return T('slow');
  return T('verySlow');
}

export function armorWord(a: number): string {
  if (a <= 0.01) return T('none');
  if (a < 0.3) return T('low');
  if (a < 0.55) return T('medium');
  if (a < 0.8) return T('high');
  return T('veryHigh');
}
