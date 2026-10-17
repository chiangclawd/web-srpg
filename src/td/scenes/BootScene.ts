import Phaser from 'phaser';
import { TEX, VIEW_H, addText, setupCamera, viewW } from '../config';
import { BARREL_ORIGIN, TOWER_ART, TW_BASE, TW_W, paintTowers, PAINTED_BARRELS, PAINTED_TOWER_ART, usePaintedBarrel, usePaintedTower } from '../art/towers';
import { paintMonsters } from '../art/units';
import { paintFx } from '../art/fx';
import { paintUi, towerBadge } from '../art/ui';
import { mkCanvas } from '../art/paint';
import { HEROES } from '../data/heroes';
import { STORY_PORTRAITS } from '../data/story';
import { LOADING_TIPS } from '../data/tips';
import { L, getLang } from '../i18n';

const SPRITES = [
  'aria', 'arthur', 'baron', 'carl', 'cult_leader', 'elena', 'enemy_archer', 'enemy_cavalry', 'enemy_flier', 'enemy_lance',
  'enemy_mage', 'enemy_sword', 'eo', 'gary', 'high_priest', 'lila', 'morden', 'player_archer', 'player_cavalry', 'player_lancer',
  'player_mage', 'player_sword', 'rain', 'rosa', 'selene', 'shadow', 'sharon', 'sub_priest', 'viktor', 'vlad', 'zerin',
];

/** 單位紋理統一高度（像素）：顯示時再依各單位身高縮放 */
const UNIT_TEX_H = 168;
/**
 * 手繪魔物（AI 生成後去背，見 scripts/art/）：載入成功就取代同名的程序繪圖紋理 mon_*，
 * 失敗則保留程序繪圖。圖都朝右，與原本的 facesRight 一致。
 */
const PAINTED_MONSTERS = ['goblin', 'wolf', 'troll', 'bat', 'skeleton', 'scorpion', 'demon', 'wyrm', 'sheep', 'golem', 'yeti', 'frost_sprite', 'frost_giant', 'magma_imp', 'lava_golem', 'fire_lord', 'reef_crab', 'drowned', 'leviathan', 'wraith', 'werewolf'];
/** 只有手繪圖、沒有程序版本的魔物：載入失敗時借用相近的程序圖 */
const MONSTER_FALLBACK: Record<string, string> = { yeti: 'troll', frost_sprite: 'bat', frost_giant: 'troll', magma_imp: 'goblin', lava_golem: 'troll', fire_lord: 'demon', reef_crab: 'scorpion', drowned: 'skeleton', leviathan: 'wyrm', wraith: 'bat', werewolf: 'wolf' };
const MONSTER_TEX_H = 200;

export class BootScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Rectangle;
  private label!: Phaser.GameObjects.Text;

  constructor() {
    super('Boot');
  }

  preload(): void {
    setupCamera(this);
    const w = viewW(this);
    this.cameras.main.setBackgroundColor('#120d08');
    // 有主視覺就當背景（PreloadScene 先載好），壓暗讓字清楚
    const art = this.textures.exists('keyart');
    if (art) {
      const img = this.add.image(w / 2, VIEW_H / 2, 'keyart');
      img.setScale(Math.max(w / img.width, VIEW_H / img.height) * 1.01);
      this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x120804, 0.3);
      // 下方漸層壓暗：小技巧與進度條要清楚
      const g = this.add.graphics();
      g.fillGradientStyle(0x120804, 0x120804, 0x120804, 0x120804, 0, 0, 0.78, 0.78);
      g.fillRect(0, VIEW_H - 360, w, 140);
      g.fillStyle(0x120804, 0.78);
      g.fillRect(0, VIEW_H - 220, w, 220);
    }
    const ty = art ? 150 : VIEW_H / 2 - 60;
    const zh = getLang() === 'zh';
    addText(this, w / 2, ty, zh ? '王國防線' : 'KINGDOM BASTION', { size: zh ? 72 : 64, display: true, color: '#ffd36b', strokeW: 10, stroke: '#3a1a04' }).setOrigin(0.5);
    addText(this, w / 2, ty + 58, zh ? 'KINGDOM BASTION' : '王國防線', { size: 24, display: true, color: '#f4e2b8', strokeW: 5 }).setOrigin(0.5);
    const by = art ? VIEW_H - 120 : VIEW_H / 2 + 40;
    this.add.rectangle(w / 2, by, 404, 20, 0x2a1a0c, 0.9).setStrokeStyle(2, 0xc89a50);
    this.bar = this.add.rectangle(w / 2 - 200, by, 2, 14, 0xffc84a).setOrigin(0, 0.5);
    this.label = addText(this, w / 2, by + 34, 'Loading…', { size: 16, color: '#f4e2b8' }).setOrigin(0.5);
    // 載入小技巧
    const tip = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
    const tipText = addText(this, w / 2, by - 52, zh ? `小技巧：${L(tip)}` : `Tip: ${L(tip)}`, { size: 18, color: '#fff2d0', wrap: Math.min(860, w - 80), align: 'center' }).setOrigin(0.5, 1);
    tipText.setAlpha(art ? 1 : 0.85);
    this.load.on('progress', (p: number) => {
      this.bar.width = 400 * p * 0.85;
    });
    // WebP 版（scripts/art/td_webp.py 產生；PNG 原檔留給 SRPG 用）
    for (const s of SPRITES) this.load.image(`raw_${s}`, `assets/sprites/${s}.webp`);
    for (const m of PAINTED_MONSTERS) this.load.image(`rawmon_${m}`, `assets/sprites/mon/${m}.webp`);
    for (const k of [...Object.keys(PAINTED_TOWER_ART), ...Object.keys(PAINTED_BARRELS)]) this.load.image(`rawtw_${k}`, `assets/sprites/tw/${k}.webp`);
    if (!this.textures.exists('keyart')) this.load.image('keyart', 'assets/keyart.webp');
    this.load.image('worldmap', 'assets/worldmap.webp');
    for (const h of Object.values(HEROES)) this.load.image(`rawpt_${h.id}`, `assets/portraits/${h.id}.webp`);
    for (const id of STORY_PORTRAITS) this.load.image(`rawpt_${id}`, `assets/portraits/${id}.webp`);
  }

  create(): void {
    const fontReady = (document as Document & { fonts?: FontFaceSet }).fonts
      ? Promise.race([
          Promise.all([document.fonts.load('40px "Luckiest Guy"'), document.fonts.load('bold 20px "Luckiest Guy"')]),
          new Promise((r) => setTimeout(r, 2500)),
        ])
      : Promise.resolve();
    this.label.setText('Painting the kingdom…');
    // 讓 loading 畫面先畫出來再做重活
    this.time.delayedCall(30, () => {
      this.generate();
      this.bar.width = 400;
      fontReady.then(() => this.scene.start('Menu'));
    });
  }

  private addCanvases(map: Record<string, HTMLCanvasElement>): void {
    for (const [k, cv] of Object.entries(map)) {
      if (this.textures.exists(k)) this.textures.remove(k);
      this.textures.addCanvas(k, cv);
    }
  }

  private generate(): void {
    const towers = paintTowers(TEX);
    // 手繪塔與砲管：圖檔尺寸與程式畫的畫布相同，直接畫進去取代（徽章也會跟著換）
    for (const k of [...Object.keys(PAINTED_TOWER_ART), ...Object.keys(PAINTED_BARRELS)]) {
      const key = `rawtw_${k}`;
      if (!this.textures.exists(key) || !towers[k]) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const cv = towers[k];
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
      usePaintedTower(k);
      usePaintedBarrel(k);
      this.textures.remove(key);
    }
    this.addCanvases(towers);
    const procMonsters = paintMonsters(TEX);
    this.addCanvases(procMonsters);
    for (const [m, from] of Object.entries(MONSTER_FALLBACK)) {
      const srcCv = procMonsters[`mon_${from}`];
      if (this.textures.exists(`mon_${m}`) || !srcCv) continue;
      // 複製一份畫布（同一個畫布不能同時給兩個紋理用）
      const [cv, ctx] = mkCanvas(srcCv.width, srcCv.height);
      ctx.drawImage(srcCv, 0, 0);
      this.addCanvases({ [`mon_${m}`]: cv });
    }
    for (const m of PAINTED_MONSTERS) {
      const key = `rawmon_${m}`;
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      this.addCanvases({ [`mon_${m}`]: cropAndScale(src, MONSTER_TEX_H) });
      this.textures.remove(key);
    }
    this.addCanvases(paintFx(TEX));
    this.addCanvases(paintUi(TEX));
    // 塔圖示徽章
    const badges: Record<string, HTMLCanvasElement> = {
      icb_archer: towerBadge(towers.tw_archer_1, TEX, '#3a5a2a'),
      icb_barracks: towerBadge(towers.tw_barracks_1, TEX, '#2a4a7a'),
      icb_mage: towerBadge(towers.tw_mage_1, TEX, '#4a2a6a'),
      icb_artillery: towerBadge(withBarrel(towers, 'tw_art_1'), TEX, '#6a3a1a'),
      icb_ranger: towerBadge(towers.tw_archer_ranger, TEX, '#2a5a2a'),
      icb_marksman: towerBadge(towers.tw_archer_marksman, TEX, '#5a3a1a'),
      icb_paladin: towerBadge(towers.tw_barracks_paladin, TEX, '#2a4a7a'),
      icb_barbarian: towerBadge(towers.tw_barracks_barbarian, TEX, '#5a2a1a'),
      icb_arcane: towerBadge(towers.tw_mage_arcane, TEX, '#4a2a6a'),
      icb_elemental: towerBadge(towers.tw_mage_elemental, TEX, '#6a3a1a'),
      icb_tesla: towerBadge(towers.tw_art_tesla, TEX, '#1a3a6a'),
      icb_bertha: towerBadge(withBarrel(towers, 'tw_art_bertha'), TEX, '#4a3a2a'),
    };
    this.addCanvases(badges);
    // 單位 sprite：裁掉透明邊並縮成統一高度
    for (const s of SPRITES) {
      const key = `raw_${s}`;
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const cv = cropAndScale(src, UNIT_TEX_H);
      this.addCanvases({ [`sp_${s}`]: cv });
      this.textures.remove(key);
    }
    // 劇情立繪
    for (const id of STORY_PORTRAITS) {
      const key = `rawpt_${id}`;
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      this.addCanvases({ [`pt_${id}`]: scaleImage(src, 320) });
      this.textures.remove(key);
    }
    // 英雄頭像（圓形裁切）
    for (const h of Object.values(HEROES)) {
      const key = `rawpt_${h.id}`;
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      this.addCanvases({ [`ptc_${h.id}`]: circlePortrait(src, 128), [`pt_${h.id}`]: scaleImage(src, 320) });
      this.textures.remove(key);
    }
  }
}

function alphaBBox(img: HTMLImageElement): { x: number; y: number; w: number; h: number } {
  const [cv, ctx] = mkCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  let x0 = img.width;
  let y0 = img.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (d[(y * img.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  void cv;
  if (x1 < x0) return { x: 0, y: 0, w: img.width, h: img.height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** 砲塔圖示要連砲管一起畫（砲管是獨立紋理） */
function withBarrel(towers: Record<string, HTMLCanvasElement>, art: string): HTMLCanvasElement {
  const src = towers[art];
  const info = TOWER_ART[art];
  const bar = info?.barrel ? towers[info.barrel] : undefined;
  if (!bar) return src;
  const [cv, ctx] = mkCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const k = info.barrelScale ?? 1;
  const bw = bar.width * k;
  const bh = bar.height * k;
  const x = (TW_W / 2) * TEX - bw * BARREL_ORIGIN.x;
  const y = (TW_BASE - (info.barrelY ?? 30)) * TEX - bh * BARREL_ORIGIN.y;
  ctx.drawImage(bar, x, y, bw, bh);
  return cv;
}

function cropAndScale(img: HTMLImageElement, targetH: number): HTMLCanvasElement {
  const bb = alphaBBox(img);
  const k = Math.min(1, targetH / bb.h);
  const [cv, ctx] = mkCanvas(bb.w * k + 2, bb.h * k + 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, bb.x, bb.y, bb.w, bb.h, 1, 1, bb.w * k, bb.h * k);
  return cv;
}

function scaleImage(img: HTMLImageElement, maxH: number): HTMLCanvasElement {
  const k = Math.min(1, maxH / img.height);
  const [cv, ctx] = mkCanvas(img.width * k, img.height * k);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, img.width * k, img.height * k);
  return cv;
}

function circlePortrait(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const [cv, ctx] = mkCanvas(size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  // 臉在肖像上方約 1/3 處
  const r = img.width * 0.3;
  const cx = img.width * 0.5;
  const cy = img.height * 0.28;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2, 0, 0, size, size);
  ctx.restore();
  return cv;
}
