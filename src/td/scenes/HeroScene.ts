import Phaser from 'phaser';
import { VIEW_H, addText, setupCamera, viewW } from '../config';
import { HEROES, HERO_ORDER, HERO_XP_TABLE, HERO_MAX_LEVEL, heroLevelForXp } from '../data/heroes';
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
    HERO_ORDER.forEach((id, i) => {
      const h = HEROES[id];
      const unlocked = heroUnlocked(id);
      const y = 140 + i * 110;
      const b = add(
        new IconButton(this, 90, y, 88, `ptc_${id}`, () => {
          this.viewing = id;
          this.build();
        }, this.viewing === id ? 'ui_badge_blue' : 'ui_badge', 0.82),
      );
      if (!unlocked) {
        b.icon.setTint(0x333333);
        add(this.add.image(90, y, 'ic_lock').setDisplaySize(34, 34));
      }
      if (sv.selectedHero === id) add(this.add.image(126, y - 30, 'ic_check').setDisplaySize(28, 28));
      const lv = heroLevelForXp(sv.heroes[id]?.xp ?? 0);
      add(addText(this, 90, y + 46, unlocked ? `${L(h.name)} LV${lv}` : '???', { size: 14, display: true }).setOrigin(0.5));
    });
    // 右側詳細
    const h = HEROES[this.viewing];
    const unlocked = heroUnlocked(h.id);
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
    // 經驗條
    const cur = HERO_XP_TABLE[lv - 1];
    const nxt = lv >= HERO_MAX_LEVEL ? cur : HERO_XP_TABLE[lv];
    const k = lv >= HERO_MAX_LEVEL ? 1 : (xp - cur) / (nxt - cur);
    add(this.add.rectangle(tx, 360, 460, 14, 0x2a1608).setOrigin(0, 0.5).setStrokeStyle(2, 0x1a0a04));
    add(this.add.rectangle(tx + 2, 360, 456 * k, 10, 0xffd84a).setOrigin(0, 0.5));
    add(addText(this, tx + 466, 360, lv >= HERO_MAX_LEVEL ? 'MAX' : `${Math.round(xp)} / ${nxt}`, { size: 13, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
    // 技能
    add(addText(this, tx, 386, T('skills'), { size: 20, display: true, color: '#7a4a1a', stroke: '#f4e2b8', strokeW: 2, shadow: false }));
    h.skills.forEach((sk, i) => {
      const sy = 438 + i * 58;
      const ok = lv >= sk.unlockLevel;
      const ib = add(this.add.image(tx + 24, sy, 'ui_badge_blue').setDisplaySize(48, 48));
      const ic = add(this.add.image(tx + 24, sy, `sk_${sk.id}`).setDisplaySize(30, 30));
      if (!ok) {
        ib.setTint(0x666666);
        ic.setTint(0x666666);
      }
      add(addText(this, tx + 58, sy - 12, `${L(sk.name)}  (LV${sk.unlockLevel})`, { size: 17, display: true, color: ok ? '#4a2a10' : '#8a7a6a', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
      add(addText(this, tx + 58, sy + 12, L(sk.desc), { size: 14, color: ok ? '#3a2412' : '#8a7a6a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5));
    });
    if (unlocked) {
      const selected = sv.selectedHero === h.id;
      add(
        new Button(this, px + 330, 600, 180, 56, selected ? T('selected') : T('select'), () => {
          sv.selectedHero = h.id;
          persist();
          sfx.play('levelup', 0.6);
          this.build();
        }, { color: selected ? 'grey' : 'green', disabled: selected }),
      );
    } else {
      const lvName = LEVELS.find((l) => l.id === h.unlockAfter);
      add(addText(this, px + 330, 600, T('unlockAfter', L(lvName?.name)), { size: 16, display: true, color: '#c0392b', stroke: '#f4e2b8', strokeW: 2, shadow: false, wrap: 220, align: 'center' }).setOrigin(0.5));
    }
    add(new IconButton(this, 44, VIEW_H - 44, 64, 'ic_close', () => this.back()));
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
