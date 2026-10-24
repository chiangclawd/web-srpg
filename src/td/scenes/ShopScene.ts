import Phaser from 'phaser';
import { VIEW_H, addText, setupCamera, viewW, uiZoom } from '../config';
import { ITEMS, ITEM_ORDER, type ItemId } from '../data/items';
import { Button, IconButton, panel } from '../ui/widgets';
import { L, T } from '../i18n';
import { persist, save } from '../save';
import { sfx } from '../audio';

/** 商店：用寶石購買戰鬥道具 */
export class ShopScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private gemTxt!: Phaser.GameObjects.Text;
  private owned: Partial<Record<ItemId, Phaser.GameObjects.Text>> = {};
  private buyBtns: Partial<Record<ItemId, Button>> = {};

  constructor() {
    super('Shop');
  }

  create(): void {
    setupCamera(this);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private build(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.owned = {};
    this.buyBtns = {};
    const add = <O extends Phaser.GameObjects.GameObject>(o: O): O => {
      this.objs.push(o);
      return o;
    };
    const w = viewW(this);
    const bg = add(this.add.graphics());
    bg.fillGradientStyle(0x2a1a34, 0x2a1a34, 0x100a14, 0x100a14, 1);
    bg.fillRect(0, 0, w, VIEW_H);
    add(addText(this, w / 2, 46, T('shop'), { size: 40, display: true, color: '#ffd36b', strokeW: 6 }).setOrigin(0.5));
    // 寶石餘額
    add(panel(this, w - 110, 44, 170, 48, 'ui_dark', 18));
    add(this.add.image(w - 170, 44, 'ic_gem').setDisplaySize(34, 34));
    this.gemTxt = add(addText(this, w - 146, 44, '0', { size: 24, display: true, color: '#e0c0ff' }).setOrigin(0, 0.5));
    add(addText(this, w / 2, 92, T('shopHint'), { size: 16, color: '#c8b8d8' }).setOrigin(0.5));

    const cw = Math.min(320, (w - 80) / ITEM_ORDER.length);
    const x0 = w / 2 - ((ITEM_ORDER.length - 1) * cw) / 2;
    ITEM_ORDER.forEach((id, i) => {
      const it = ITEMS[id];
      const x = x0 + i * cw;
      const y = 370;
      add(panel(this, x, y, cw - 16, 380));
      add(this.add.image(x, y - 120, 'ui_badge').setDisplaySize(112, 112));
      const icon = add(this.add.image(x, y - 120, it.icon).setDisplaySize(80, 80));
      this.tweens.add({ targets: icon, y: y - 126, duration: 1100 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      add(addText(this, x, y - 40, L(it.name), { size: 24, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
      const desc = add(
        addText(this, x, y - 20, L(it.desc), { size: 15, color: '#3a2412', stroke: '#000000', strokeW: 0, shadow: false, wrap: cw - 56, align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0),
      );
      // 說明到「持有」之間只有這麼高：太長（英文、手機大字）就縮小
      if (desc.height > 84) desc.setScale(84 / desc.height);
      this.owned[id] = add(addText(this, x, y + 78, '', { size: 18, display: true, color: '#2a5a8a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0.5));
      const btn = add(new Button(this, x, y + 138, Math.min(170, cw - 50), 54, String(it.price), () => this.buy(id), { color: 'green', icon: 'ic_gem', iconSize: 30, text: { size: 24 } }));
      this.buyBtns[id] = btn;
    });
    // 手機上關閉鈕放大（以左上角為錨點）
    add(new IconButton(this, 12 + 30 * uiZoom(), 10 + 30 * uiZoom(), 60, 'ic_close', () => this.back()).setBaseScale(uiZoom()));
    this.refresh();
  }

  private refresh(): void {
    const sv = save();
    this.gemTxt.setText(String(sv.gems ?? 0));
    for (const id of ITEM_ORDER) {
      this.owned[id]?.setText(T('owned', sv.items[id] ?? 0));
      this.buyBtns[id]?.bg.setTint((sv.gems ?? 0) >= ITEMS[id].price ? 0xffffff : 0x8a8a8a);
    }
  }

  private buy(id: ItemId): void {
    const sv = save();
    const price = ITEMS[id].price;
    const btn = this.buyBtns[id];
    if ((sv.gems ?? 0) < price) {
      sfx.play('error');
      if (btn) this.tweens.add({ targets: btn, x: btn.x + 6, duration: 40, yoyo: true, repeat: 3 });
      this.tweens.add({ targets: this.gemTxt, scale: 1.25, duration: 100, yoyo: true });
      return;
    }
    sv.gems -= price;
    sv.items[id] = (sv.items[id] ?? 0) + 1;
    persist();
    sfx.play('coin');
    this.refresh();
    const t = this.owned[id];
    if (t) this.tweens.add({ targets: t, scale: 1.3, duration: 120, yoyo: true });
  }

  /** Android 返回鍵：回世界地圖 */
  onBack(): boolean {
    this.back();
    return true;
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
