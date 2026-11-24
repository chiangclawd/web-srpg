import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { music, unlockAudio } from '../audio';
import { L, T, getLang, setLang } from '../i18n';
import { MISSIONS } from '../data/missions';
import { suspendInfo } from '../suspend';
import { Button, KeyNav } from '../view/ui';
import { cloudAvailable, cloudSignIn, cloudState, onCloud, prepareCloud } from '../cloud/sync';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('SfTitle');
  }

  create(): void {
    setupCamera(this);
    // 瀏覽器要等第一次點擊才肯出聲：先登記想播的曲子，點了任何地方就開始
    music('title');
    this.input.once('pointerdown', () => unlockAudio());
    const w = viewW(this);
    const z = uiZoom();
    const bg = this.add.image(w / 2, VIEW_H / 2, 'title');
    bg.setScale(Math.max(w / bg.width, VIEW_H / bg.height));
    // 左側壓暗，讓標題和按鈕清楚
    const g = this.add.graphics();
    g.fillGradientStyle(0x040a14, 0x040a14, 0x040a14, 0x040a14, 0.88, 0, 0.88, 0);
    g.fillRect(0, 0, w * 0.62, VIEW_H);
    const x = 70;
    addText(this, x, 150, T('earlyBuild'), { size: 16, strokeW: 0, color: COL.orange });
    const title = addText(this, x, 176, T('title'), { size: 84, color: '#ffffff', stroke: '#0b2a44', strokeW: 10 });
    addText(this, x + 4, 182 + title.height, 'STARFALL ECHO', { size: 26, strokeW: 0, color: COL.cyan }).setLetterSpacing(10);
    addText(this, x + 4, 236 + title.height, T('tagline'), { size: 18, strokeW: 0, color: COL.dim, bold: false, wrap: 520 });
    const by = VIEW_H - 70 - 60 * z;
    // 有打到一半的戰鬥：最上面多一顆「接續戰鬥」
    const sus = suspendInfo();
    const susMission = sus ? MISSIONS.find((m) => m.id === sus.mission) : undefined;
    const resume =
      sus && susMission
        ? new Button(
            this,
            x + 130 * z,
            by - 70 * z,
            260,
            52,
            `${T('continueBattle')}　${L(susMission.name)}`,
            () => {
              unlockAudio();
              this.scene.start('SfBattle', { missionId: sus.mission, resume: true });
            },
            { primary: true, size: 18, color: 0x6dff9a },
          ).setScale(z)
        : null;
    const start = new Button(
      this,
      x + 130 * z,
      by,
      260,
      64,
      T('start'),
      () => {
        unlockAudio();
        // 要傳一個物件：Phaser 沒收到資料時會沿用上次的，任務列表就會停在上次看的那一章
        this.scene.start('SfMissions', {});
      },
      { primary: true, size: 24 },
    ).setScale(z);
    // 下面一排兩顆半寬的：切換語言、設定
    new Button(
      this,
      x + 62 * z,
      by + 76 * z,
      124,
      48,
      T('language'),
      () => {
        setLang(getLang() === 'zh' ? 'en' : 'zh');
        this.scene.restart();
      },
      { color: 0x8fb0c8, size: 17 },
    ).setScale(z);
    new Button(this, x + 198 * z, by + 76 * z, 124, 48, T('settings'), () => this.scene.launch('SfSettings', { onClose: () => this.scene.restart() }), { color: 0x8fb0c8, size: 17 }).setScale(z);
    // 右上角：帳號。還沒登入是一顆「用 Google 登入」，登入後顯示名字和同步狀態（點了開設定頁，那裡可以立即同步、登出）
    if (cloudAvailable()) {
      // 先把登入要用的程式載好，按下去才能馬上開 Google 的視窗
      void prepareCloud();
      const cs = cloudState();
      const settings = (): void => void this.scene.launch('SfSettings', { onClose: () => this.scene.restart() });
      const bw = 300;
      const bx = w - 20 - (bw / 2) * z;
      const by0 = 20 + 26 * z;
      if (cs.user) {
        const st = T(cs.status === 'synced' ? 'cloudSynced' : cs.status === 'error' ? 'cloudErrorShort' : 'cloudSyncing');
        new Button(this, bx, by0, bw, 52, `${cs.user.name}　${st}`, settings, { size: 17, color: cs.status === 'error' ? 0xffa53a : 0x6dff9a }).setScale(z);
      } else {
        new Button(this, bx, by0, bw, 52, T('cloudSignIn'), () => cloudSignIn(), { size: 18, primary: true }).setScale(z);
        addText(this, w - 20, by0 + 34 * z, T(cs.signInFailed ? 'cloudPopup' : 'cloudHint'), { size: 13, strokeW: 3, color: cs.signInFailed ? COL.orange : '#c4d8e8', bold: false }).setOrigin(1, 0);
      }
      // 登入、同步的狀態變了：重畫（設定頁開著的時候由它自己重畫，關掉時這裡也會重畫）
      const off = onCloud(() => this.scene.isActive() && !this.scene.isActive('SfSettings') && this.scene.restart());
      this.events.once('shutdown', off);
    }
    new KeyNav(this, { enabled: () => !this.scene.isActive('SfSettings'), first: () => resume ?? start });
    addText(this, w - 14, VIEW_H - 10, `v${__APP_VERSION__} · ${__GIT_SHA__}`, { size: 12, strokeW: 0, color: '#5a7088', bold: false }).setOrigin(1, 1);
  }
}
