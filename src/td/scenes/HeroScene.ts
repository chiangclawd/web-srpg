import Phaser from 'phaser';
import { VIEW_H, addText, fitText, setupCamera, viewW, uiZoom } from '../config';
import { HEROES, HERO_ORDER, HERO_XP_TABLE, HERO_MAX_LEVEL, TRAIN_PRICE, heroLevelForXp, trainXp } from '../data/heroes';
import { LEVELS } from '../data/levels';
import { heroStats } from '../sim/World';
import { Button, IconButton, panel } from '../ui/widgets';
import { L, T } from '../i18n';
import { save, persist } from '../save';
import { sfx } from '../audio';
import { armorWord } from './LevelScene';

export function heroUnlocked(id: string): boolean {
  const h = HEROES[id];
  if (!h.unlockAfter) return true;
  return (save().stars[h.unlockAfter] ?? 0) > 0;
}

export class HeroScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private viewing = 'arthur';

  constructor() {
    super('Hero');
  }

  create(): void {
    setupCamera(this);
    this.viewing = save().selectedHero;
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private build(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.objs.push(o);
      return o;
    };
    const w = viewW(this);
    const bg = add(this.add.graphics());
    bg.fillGradientStyle(0x1a2a3a, 0x1a2a3a, 0x0a1018, 0x0a1018, 1);
    bg.fillRect(0, 0, w, VIEW_H);
    add(addText(this, w / 2, 40, T('heroes'), { size: 38, display: true, color: '#ffd36b', strokeW: 7 }).setOrigin(0.5));
    const sv = save();
    // 左側英雄清單
    // 超過 6 位英雄時改成兩欄，才排得進一個畫面
    const twoCols = HERO_ORDER.length > 6;
    HERO_ORDER.forEach((id, i) => {
      const h = HEROES[id];
      const unlocked = heroUnlocked(id);
      const hx = twoCols ? 64 + (i % 2) * 102 : 90;
      const y = twoCols ? 126 + Math.floor(i / 2) * 124 : 126 + i * 98;
      const b = add(
        new IconButton(this, hx, y, 88, `ptc_${id}`, () => {
          // 點頭像換人時英雄打聲招呼
          if (unlocked && this.viewing !== id) sfx.voice(id, 'select');
          this.viewing = id;
          this.build();
        }, this.viewing === id ? 'ui_badge_blue' : 'ui_badge', 0.82),
      );
      if (!unlocked) {
        b.icon.setTint(0x333333);
        add(this.add.image(hx, y, 'ic_lock').setDisplaySize(34, 34));
      }
      if (sv.selectedHero === id) add(this.add.image(hx + 36, y - 30, 'ic_check').setDisplaySize(28, 28));
      const lv = heroLevelForXp(sv.heroes[id]?.xp ?? 0);
      add(fitText(addText(this, hx, y + 46, unlocked ? `${L(h.name)} LV${lv}` : '???', { size: 14, display: true }).setOrigin(0.5), twoCols ? 98 : 160));
    });
    // 右側詳細
    const h = HEROES[this.viewing];
    const unlocked = heroUnlocked(h.id);
    // 已解鎖英雄的語音都先載好（每句約 10KB），點頭像時才有聲音
    for (const id of HERO_ORDER) if (heroUnlocked(id)) sfx.preloadVoice(id);
    const px = Math.max(620, w / 2 + 80);
    add(panel(this, px, 370, Math.min(w - 220, 1000), 560));
    const portrait = add(this.add.image(px - 300, 610, `pt_${h.id}`).setOrigin(0.5, 1));
    portrait.setScale(470 / portrait.frame.height);
    if (!unlocked) portrait.setTint(0x222222);
    const tx = px - 110;
    add(addText(this, tx, 120, L(h.name), { size: 40, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }));
    add(addText(this, tx, 168, L(h.title), { size: 20, display: true, color: '#7a4a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }));
    add(addText(this, tx, 204, L(h.desc), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false, wrap: 480 }));
    const xp = sv.heroes[h.id]?.xp ?? 0;
    const lv = heroLevelForXp(xp);
    const st = heroStats(h, lv);
    const stats: [string, string][] = [
      [T('level'), `${lv} / ${HERO_MAX_LEVEL}`],
      [T('hp'), String(st.hp)],
      [T('damage'), `${Math.round(st.dmg[0])}-${Math.round(st.dmg[1])}`],
      [T('armor'), armorWord(h.armor)],
      [T('range'), h.ranged ? String(h.ranged.range) : T('none')],
      [T('speed'), h.speed >= 80 ? T('fast') : T('medium')],
    ];
    stats.forEach(([k, v], i) => {
      const sx = tx + (i % 2) * 240;
      const sy = 262 + Math.floor(i / 2) * 30;
      add(addText(this, sx, sy, `${k}: ${v}`, { size: 17, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }));
    });
    // 經驗條（可訓練時縮短，右邊放訓練鈕）
    const gain = trainXp(xp);
    const canTrain = unlocked && gain > 0;
    const barW = canTrain ? 330 : 460;
    const cur = HERO_XP_TABLE[lv - 1];
    const nxt = lv >= HERO_MAX_LEVEL ? cur : HERO_XP_TABLE[lv];
    const k = lv >= HERO_MAX_LEVEL ? 1 : (xp - cur) / (nxt - cur);
    add(this.add.rectangle(tx, 360, barW, 14, 0x2a1608).setOrigin(0, 0.5).setStrokeStyle(2, 0x1a0a04));
    add(this.add.rectangle(tx + 2, 360, (barW - 4) * k, 10, 0xffd84a).setOrigin(0, 0.5));
    add(fitText(addText(this, tx + barW + 6, 360, lv >= HERO_MAX_LEVEL ? 'MAX' : `${Math.round(xp)} / ${nxt}`, { size: 13, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5), 108));
    // 訓練：寶石換經驗（滿級或未解鎖不顯示）
    if (canTrain) {
      const bx = tx + 522;
      add(
        new Button(this, bx, 356, 128, 46, `${T('train')} ${TRAIN_PRICE}`, () => {
          if (sv.gems < TRAIN_PRICE) {
            sfx.play('error');
            this.flashText(bx, 318, T('notEnoughGems', sv.gems), '#c0392b');
            return;
          }
          sv.gems -= TRAIN_PRICE;
          sv.heroes[h.id] = { xp: xp + gain };
          persist();
          const up = heroLevelForXp(xp + gain) > lv;
          sfx.play(up ? 'levelup' : 'coin');
          if (up) sfx.voice(h.id, 'select');
          this.build();
          this.flashText(bx, 318, up ? T('heroLevelUp') : `+${gain} XP`, up ? '#ffe066' : '#3a8a1a');
        }, { color: 'gold', icon: 'ic_gem', iconSize: 24, text: { size: 16 } }),
      );
      add(fitText(addText(this, bx, 390, `+${gain} XP · ${T('gems')} ${sv.gems}`, { size: 12, color: '#5a3a1a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0.5), 140));
    }
    // 技能
    add(addText(this, tx, 380, T('skills'), { size: 20, display: true, color: '#7a4a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }));
    h.skills.forEach((sk, i) => {
      const sy = 432 + i * 50;
      const ok = lv >= sk.unlockLevel;
      const ib = add(this.add.image(tx + 24, sy, 'ui_badge_blue').setDisplaySize(48, 48));
      const ic = add(this.add.image(tx + 24, sy, `sk_${sk.id}`).setDisplaySize(30, 30));
      if (!ok) {
        ib.setTint(0x666666);
        ic.setTint(0x666666);
      }
      add(addText(this, tx + 58, sy - 12, `${L(sk.name)}  (LV${sk.unlockLevel})`, { size: 18, display: true, color: ok ? '#4a2a10' : '#8a7a6a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      add(fitText(addText(this, tx + 58, sy + 13, L(sk.desc), { size: 16, color: ok ? '#3a2412' : '#8a7a6a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5), px + Math.min(w - 220, 1000) / 2 - 24 - (tx + 58)));
    });
    // 絕招（手動施放）
    {
      const sy = 432 + h.skills.length * 50;
      add(this.add.image(tx + 24, sy, 'ui_badge_gold').setDisplaySize(48, 48));
      add(this.add.image(tx + 24, sy, h.ult.icon).setDisplaySize(30, 30));
      add(addText(this, tx + 58, sy - 12, `${L(h.ult.name)}  (${T('ultimate')})`, { size: 18, display: true, color: '#8a4a00', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      // 一行放不下就縮小
      const room = px + Math.min(w - 220, 1000) / 2 - 24 - (tx + 58);
      add(fitText(addText(this, tx + 58, sy + 13, L(h.ult.desc), { size: 16, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5), room));
    }
    if (unlocked) {
      const selected = sv.selectedHero === h.id;
      add(
        new Button(this, px + Math.min(w - 220, 1000) / 2 - 110, 140, 170, 52, selected ? T('selected') : T('select'), () => {
          sv.selectedHero = h.id;
          persist();
          sfx.play('levelup', 0.6);
          sfx.voice(h.id, 'select');
          this.build();
        }, { color: selected ? 'grey' : 'green', disabled: selected }),
      );
    } else {
      const lvName = LEVELS.find((l) => l.id === h.unlockAfter);
      add(addText(this, px + Math.min(w - 220, 1000) / 2 - 110, 140, T('unlockAfter', L(lvName?.name)), { size: 16, display: true, color: '#c0392b', stroke: '#f4e2b8', strokeW: 2, shadow: false, wrap: 200, align: 'center' }).setOrigin(0.5));
    }
    // 手機上關閉鈕放大（以左上角為錨點）
    add(new IconButton(this, 12 + 30 * uiZoom(), 10 + 30 * uiZoom(), 60, 'ic_close', () => this.back()).setBaseScale(uiZoom()));
  }

  /** 按鈕上方飄出一行字（訓練結果、寶石不足） */
  private flashText(x: number, y: number, msg: string, color: string): void {
    const t = addText(this, x, y, msg, { size: 18, display: true, color, strokeW: 4 }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, delay: 700, duration: 500, onComplete: () => t.destroy() });
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
