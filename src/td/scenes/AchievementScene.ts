import Phaser from 'phaser';
import { VIEW_H, addText, fitText, setupCamera, viewW, uiZoom } from '../config';
import { ACHIEVEMENTS, achievementProgress } from '../data/achievements';
import { Button, IconButton, dimmer, panel, popIn } from '../ui/widgets';
import { L, T } from '../i18n';
import { save, totalStars } from '../save';
import { LEVELS } from '../data/levels';
import { HEROES } from '../data/heroes';
import { totalEggs } from '../data/eggs';

/** 成就一覽：已解鎖的亮起，未解鎖的灰階 */
export class AchievementScene extends Phaser.Scene {
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Achievements');
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
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.objs.push(o);
      return o;
    };
    const w = viewW(this);
    const bg = add(this.add.graphics());
    bg.fillGradientStyle(0x2a2414, 0x2a2414, 0x100c06, 0x100c06, 1);
    bg.fillRect(0, 0, w, VIEW_H);
    const got = new Set(save().achievements);
    add(addText(this, w / 2, 40, `${T('achievements')}  ${got.size} / ${ACHIEVEMENTS.length}`, { size: 34, display: true, color: '#ffd36b', strokeW: 6 }).setOrigin(0.5));
    const cols = 4;
    const cw = Math.min(360, (w - 60) / cols);
    const rows = Math.ceil(ACHIEVEMENTS.length / cols);
    // 列距隨成就數量縮放，全部放進一個畫面
    const pitch = Math.min(88, (VIEW_H - 112 - 50) / Math.max(1, rows - 1));
    const ch = pitch - 8;
    const x0 = w / 2 - (cols * cw) / 2 + cw / 2;
    ACHIEVEMENTS.forEach((a, i) => {
      const x = x0 + (i % cols) * cw;
      const y = 112 + Math.floor(i / cols) * pitch;
      const ok = got.has(a.id);
      // 已解鎖：同樣的深色底＋暖金色光框（羊皮紙面板邊框太厚，卡片矮的時候會把說明壓到框外）
      add(panel(this, x, y, cw - 10, ch, 'ui_dark', 18));
      if (ok) {
        const glow = add(this.add.graphics());
        glow.fillStyle(0xffc84a, 0.16);
        glow.fillRoundedRect(x - (cw - 10) / 2 + 5, y - ch / 2 + 5, cw - 20, ch - 10, 10);
        glow.lineStyle(2, 0xffd36b, 0.95);
        glow.strokeRoundedRect(x - (cw - 10) / 2 + 4, y - ch / 2 + 4, cw - 18, ch - 8, 11);
      }
      const badge = add(this.add.image(x - cw / 2 + 42, y, ok ? 'ui_badge_green' : 'ui_badge_grey').setDisplaySize(52, 52));
      const icon = add(this.add.image(x - cw / 2 + 42, y, a.icon).setDisplaySize(30, 30));
      if (!ok) {
        icon.setTint(0x555555);
        badge.setAlpha(0.8);
      }
      const tx = x - cw / 2 + 76;
      const title = add(
        addText(this, tx, 0, L(a.name), {
          size: 16,
          display: true,
          color: ok ? '#ffe08a' : '#9a8a70',
          stroke: '#1a1008',
          strokeW: 3,
          shadow: false,
        }),
      );
      const desc = add(
        addText(this, tx, 0, L(a.desc), {
          size: 12,
          color: ok ? '#f4e2b8' : '#8a7a62',
          stroke: '#000000',
          strokeW: 0,
          shadow: false,
          wrap: cw - 96,
        }),
      );
      // 累積型成就（未完成）：底部進度條＋右上角數字
      const prog = ok ? null : achievementProgress(a.id, save());
      if (prog) {
        const k = Math.min(1, prog.cur / prog.max);
        const bx = tx;
        const bw = x + cw / 2 - 20 - bx;
        const by = y + ch / 2 - 9;
        const bar = add(this.add.graphics());
        bar.fillStyle(0x000000, 0.5);
        bar.fillRoundedRect(bx, by, bw, 5, 2);
        if (k > 0) {
          bar.fillStyle(0xffc84a, 1);
          bar.fillRoundedRect(bx, by, Math.max(4, bw * k), 5, 2);
        }
        const num = add(addText(this, x + cw / 2 - 18, y - ch / 2 + 6, `${Math.min(prog.cur, prog.max).toLocaleString()}/${prog.max.toLocaleString()}`, { size: 11, color: '#c8b890', stroke: '#000000', strokeW: 0, shadow: false }).setOrigin(1, 0));
        fitText(num, 70);
      }
      // 標題＋說明整塊垂直置中；手機字體放大後太高就縮小說明
      fitText(title, cw - 92 - (prog ? 64 : 0));
      const room = ch - 10 - title.displayHeight - (prog ? 6 : 0);
      if (desc.height > room) desc.setScale(room / desc.height);
      const top = y - (title.displayHeight + desc.displayHeight) / 2 - (prog ? 3 : 0);
      title.setPosition(tx, top);
      desc.setPosition(tx, top + title.displayHeight);
    });
    // 手機上關閉鈕放大（以左上角為錨點）
    add(new IconButton(this, 12 + 30 * uiZoom(), 10 + 30 * uiZoom(), 60, 'ic_close', () => this.back()).setBaseScale(uiZoom()));
    // 右上角：我的戰績
    const z = uiZoom();
    add(new Button(this, w - 12 - 65 * z, 10 + 24 * z, 130, 48, T('stats'), () => this.showStats(), { color: 'blue', icon: 'ic_star', iconSize: 26, text: { size: 18 } }).setBaseScale(z));
  }

  /** 我的戰績：累計數字＋最常出戰的英雄 */
  private showStats(): void {
    const w = viewW(this);
    const sv = save();
    const st = sv.stats;
    const c = this.add.container(w / 2, VIEW_H / 2).setDepth(100);
    c.add(dimmer(this, w * 2, VIEW_H * 2, 0.6).setPosition(-w, -VIEW_H));
    const pw = 620;
    const ph = 470;
    c.add(panel(this, 0, 0, pw, ph));
    c.add(addText(this, 0, -ph / 2 + 38, T('statsTitle'), { size: 28, display: true, color: '#4a2a10', stroke: '#f4e2b8', strokeW: 3, shadow: false }).setOrigin(0.5));
    const sec = st.playSec ?? 0;
    const rows: [string, string][] = [
      [T('stPlayTime'), T('stHm', Math.floor(sec / 3600), Math.floor((sec % 3600) / 60))],
      [T('stPlays'), String(st.plays)],
      [T('stWins'), String(st.victories)],
      [T('stKills'), st.kills.toLocaleString()],
      [T('stBosses'), String(st.bosses ?? 0)],
      [T('stElites'), String(st.elites ?? 0)],
      [T('stTowers'), String(st.towers ?? 0)],
      [T('stStars'), `${totalStars()} / ${LEVELS.length * 5}`],
      [T('stEggs'), `${sv.eggs?.length ?? 0} / ${totalEggs(LEVELS)}`],
    ];
    rows.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = -pw / 2 + 40 + col * (pw / 2 - 10);
      const y = -ph / 2 + 92 + row * 50;
      c.add(addText(this, x, y, k, { size: 17, color: '#6a4a2a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5));
      c.add(addText(this, x + pw / 2 - 70, y, v, { size: 20, display: true, color: '#3a2412', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(1, 0.5));
    });
    // 最常出戰的英雄
    const fav = Object.entries(st.heroUse ?? {}).sort((a, b) => b[1] - a[1])[0];
    const hy = ph / 2 - 70;
    c.add(addText(this, -pw / 2 + 40, hy, T('stFav'), { size: 17, color: '#6a4a2a', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5));
    if (fav && HEROES[fav[0]]) {
      const h = HEROES[fav[0]];
      if (this.textures.exists(`ptc_${h.id}`)) c.add(this.add.image(40, hy, `ptc_${h.id}`).setDisplaySize(56, 56));
      c.add(addText(this, 80, hy, `${L(h.name)}  ×${fav[1]}`, { size: 20, display: true, color: '#3a2412', stroke: '#f4e2b8', strokeW: 2, shadow: false }).setOrigin(0, 0.5));
    } else {
      c.add(addText(this, 40, hy, '—', { size: 20, color: '#3a2412', stroke: '#f4e2b8', strokeW: 0, shadow: false }).setOrigin(0, 0.5));
    }
    c.add(new IconButton(this, pw / 2 - 18, -ph / 2 + 18, 40, 'ic_close', () => c.destroy()));
    popIn(this, c, 0, { w: pw, h: ph }, 0.85, 220);
  }

  private back(): void {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.time.delayedCall(210, () => this.scene.start('Map'));
  }
}
