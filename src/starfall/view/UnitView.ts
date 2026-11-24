// 戰場上的一個單位：影子、圖像（3D 預先渲染的圖表）、耐久條、狀態圖示
import Phaser from 'phaser';
import { COL, TEX, addText, colorBlind, worldPx } from '../config';
import { EH, isoX, isoY, tileDepth } from './iso';
import { SHEETS, SHEET_FOOT, animKey, dirIndex, facing, frameName } from './sheets';
import type { Anim, SheetDef } from './sheets';
import type { Dir, Unit } from '../sim/types';

const BAR_W = 44;

export class UnitView {
  readonly root: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly base: Phaser.GameObjects.Image;
  private readonly arrow: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Image;
  private readonly sheet: SheetDef | null;
  private readonly sheetKey: string;
  private anim: Anim = 'idle';
  private dir: Dir;
  private readonly phase = Math.random() * Math.PI * 2;
  /** 圖像頂端離腳底的高度（耐久條放這上面） */
  readonly tall: number;
  private readonly hover: number;
  /** 顯示中的耐久（演出時跟著事件走，不直接讀模擬的最終值） */
  hp: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly unit: Unit,
    private readonly heightAt: (x: number, y: number) => number,
  ) {
    const def = unit.def;
    this.sheetKey = def.sprite;
    this.sheet = SHEETS[def.sprite] ?? null;
    this.dir = unit.dir;
    this.hp = unit.hp;
    this.root = scene.add.container(0, 0);
    const k = def.scale ?? 1;
    this.shadow = scene.add.image(0, 2, 'shadow').setScale(((def.structure ? 0.8 : 0.52) * Math.max(0.8, k)));
    // 腳下的陣營色環（我方青、敵方紅）和面向箭頭：從背後打傷害比較高，要看得出敵人面向哪邊
    const team = unit.side === 'player' ? COL.player : COL.enemy;
    this.base = scene.add
      .image(0, 1, 'ring')
      .setScale((def.structure ? 0.62 : 0.4) * Math.max(0.85, k), (def.structure ? 0.31 : 0.2) * Math.max(0.85, k))
      .setTint(team)
      .setAlpha(0.85);
    this.arrow = scene.add
      .image(0, 0, 'arrow')
      .setScale(0.5)
      .setTint(team)
      .setVisible(!def.structure);
    if (this.sheet) {
      this.sprite = scene.add.sprite(0, 0, `sf_${this.sheetKey}`, frameName(this.sheet, 'idle', false, 0));
      this.sprite.setOrigin(0.5, SHEET_FOOT).setScale((this.sheet.h * k) / this.sheet.unitPx);
      this.hover = (this.sheet.hover ?? 0) * k;
      this.tall = this.sheet.h * k + this.hover;
    } else {
      // 程序繪圖的設施（發電機）：腳底在圖的 104/124 處
      this.sprite = scene.add.sprite(0, 0, def.sprite).setOrigin(0.5, 104 / 124).setScale(1 / TEX);
      this.hover = 0;
      this.tall = 92;
    }
    if (def.tint) this.sprite.setTint(def.tint);
    this.bar = scene.add.graphics();
    this.hpText = addText(scene, 0, -this.tall - 15, '', { size: worldPx(12), raw: true, strokeW: 3 }).setOrigin(0.5, 1);
    this.status = scene.add
      .image(BAR_W / 2 + 12, -this.tall - 10, 'ic_overwatch')
      .setScale(18 / 64 / TEX)
      .setVisible(false);
    this.root.add([this.shadow, this.base, this.arrow, this.sprite, this.bar, this.hpText, this.status]);
    this.place(unit.x, unit.y);
    this.setDir(unit.dir);
    this.play('idle');
    this.refresh();
  }

  /** 放到某一格（瞬間） */
  place(x: number, y: number): void {
    this.root.setPosition(isoX(x, y), isoY(x, y, this.heightAt(x, y)));
    this.root.setDepth(tileDepth(x, y) + 5);
  }

  setDir(dir: Dir): void {
    this.dir = dir;
    // 箭頭放在面向那一側的格子邊上，沿著等角軸線指出去
    const sx = dir === 0 || dir === 3 ? 1 : -1;
    const sy = dir <= 1 ? 1 : -1;
    this.arrow.setPosition(sx * 27, sy * 13.5 + 1).setRotation(Math.atan2(sy, sx * 2));
    this.applyAnim();
  }

  play(anim: Anim): void {
    this.anim = anim;
    this.applyAnim();
  }

  /** 受擊：後仰一下再回到待機（沒有這個動作的模型不做） */
  hit(): void {
    if (this.frames('hit') < 2) return;
    this.play('hit');
    this.sprite.once('animationcomplete', () => {
      if (this.anim === 'hit') this.play('idle');
    });
  }

  /** 這個動作有幾格（沒有動作的靜態模型回傳 1） */
  frames(anim: Anim): number {
    return this.sheet?.frames[anim] ?? 1;
  }

  private applyAnim(): void {
    if (!this.sheet) return;
    // 四個方向各有自己的圖，不用水平翻轉
    const di = dirIndex(this.dir);
    const anim = this.frames(this.anim) > 1 ? this.anim : 'idle';
    if (this.frames(anim) > 1) {
      const key = animKey(this.sheetKey, anim, di);
      if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) this.sprite.play(key);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(frameName(this.sheet, 'idle', di, 0));
    }
  }

  /** 每格更新：懸浮單位上下飄、靜態模型輕微起伏 */
  update(time: number): void {
    const t = time / 1000;
    if (this.hover) {
      this.sprite.y = -this.hover + Math.sin(t * 2.2 + this.phase) * 3;
      this.shadow.setAlpha(0.7);
    } else if (this.sheet && this.frames('idle') < 2) {
      this.sprite.y = Math.abs(Math.sin(t * 1.6 + this.phase)) * -1.5;
    }
    if (this.status.visible) this.status.setAlpha(0.7 + Math.sin(t * 5) * 0.3);
  }

  /** 依單位狀態更新：耐久條、已行動變暗、警戒 / 癱瘓圖示 */
  refresh(hp: number = this.unit.hp): void {
    this.hp = hp;
    const u = this.unit;
    const k = Phaser.Math.Clamp(hp / u.maxHp, 0, 1);
    const y = -this.tall - 12;
    const g = this.bar;
    g.clear();
    g.fillStyle(0x06101c, 0.9);
    g.fillRect(-BAR_W / 2 - 1.5, y - 1.5, BAR_W + 3, 8);
    g.fillStyle(u.side === 'player' ? (k > 0.35 ? COL.player : COL.low) : COL.enemy, 1);
    g.fillRect(-BAR_W / 2, y, BAR_W * k, 5);
    // 色盲配色：敵方的數字前面多一個 ▼，不靠顏色也分得出敵我
    this.hpText.setText(`${u.side === 'enemy' && colorBlind() ? '▼' : ''}${Math.max(0, Math.round(hp))}`);
    // 陣營色每次重畫都重新套：設定頁可能剛換過配色
    const team = u.side === 'player' ? COL.player : COL.enemy;
    this.base.setTint(team);
    this.arrow.setTint(team);
    // 已經行動完的我方單位變暗（敵方不變暗：它們的回合不需要玩家分辨誰動過）
    const done = u.acted && u.side === 'player' && !u.def.structure;
    const base = u.def.tint ?? 0xffffff;
    this.sprite.setTint(done ? 0x7c8898 : base);
    if (u.stun > 0) this.status.setTexture('ic_stun').setTint(0xffe45a).setVisible(true);
    else if (u.overwatch) this.status.setTexture('ic_overwatch').setTint(u.side === 'player' ? COL.player : COL.enemy).setVisible(true);
    else this.status.setVisible(false);
  }

  /** 槍口位置（畫光束用）：朝面向的方向、圖像大約胸口高 */
  muzzle(): Phaser.Math.Vector2 {
    const f = facing(this.dir);
    return new Phaser.Math.Vector2(this.root.x + (f.flip ? -1 : 1) * 16, this.root.y - this.tall * 0.62 + (f.back ? -6 : 4));
  }

  /** 身體中心（被打中的位置） */
  center(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.root.x, this.root.y - this.tall * 0.5);
  }

  flash(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      this.sprite.clearTint();
      this.refresh(this.hp);
    });
    this.scene.tweens.add({ targets: this.sprite, x: { from: -4, to: 0 }, duration: 160, ease: 'Bounce.easeOut' });
  }

  destroy(): void {
    this.root.destroy();
  }

  /** 一層高度的像素（跳躍弧線用） */
  static readonly LEVEL = EH;
}
