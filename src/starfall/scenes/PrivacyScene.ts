// 隱私權說明：這個遊戲存了什麼、存在哪裡。登入的玩家可以在這一頁刪除雲端資料（雲端存檔，連同登入紀錄）。
// 從設定頁開，疊在它上面；關掉回到設定頁。完整的說明在遊戲外面的那一頁（legal.ts）。
//
// 刪除分兩步：先按「刪除雲端資料」看清楚會刪什麼，再按「確定刪除」。第二下要直接呼叫 cloudErase()，
// 因為它一開始會開 Google 的視窗再確認一次帳號，不是在點擊的當下開會被瀏覽器擋掉。
import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { T } from '../i18n';
import type { StrKey } from '../i18n';
import { Button, KeyNav, drawPanel } from '../view/ui';
import { cloudAvailable, cloudErase, cloudState } from '../cloud/sync';
import type { EraseResult } from '../cloud/sync';
import { openLegal } from '../legal';

export interface PrivacyData {
  onClose?: () => void;
  /** ask = 正在問要不要刪；其餘是刪除的結果 */
  step?: 'ask' | EraseResult;
}

const W = 980;
const RESULT: Record<EraseResult, StrKey> = { done: 'cloudEraseDone', cancelled: 'cloudEraseCancelled', failed: 'cloudEraseFailed', partial: 'cloudErasePartial' };
/** 正在刪（Google 的確認視窗開著）：這段時間畫面重排也還是顯示「處理中」，不能再按一次 */
let pending: Promise<EraseResult> | null = null;

export class PrivacyScene extends Phaser.Scene {
  private onClose: () => void = () => undefined;
  private step: PrivacyData['step'];

  constructor() {
    super('SfPrivacy');
  }

  init(data: PrivacyData): void {
    this.onClose = data.onClose ?? (() => undefined);
    this.step = data.step;
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    const w = viewW(this);
    const user = cloudState().user;
    const asking = this.step === 'ask' && !!user;
    const body = this.add.container(0, 0);
    let y = 0;
    const para = (s: string, o: { color?: string; size?: number; gap?: number } = {}): void => {
      const t = addText(this, -W / 2 + 50, y, s, { size: o.size ?? 16, raw: true, strokeW: 0, bold: false, color: o.color ?? COL.text, wrap: W - 100, lineSpacing: 5 });
      body.add(t);
      y += t.height + (o.gap ?? 12);
    };
    let erase: Button | null = null;
    if (asking) {
      para(T('cloudEraseWho', user.name), { color: COL.cyan });
      para(T('cloudEraseAsk'), { gap: 0 });
    } else {
      para(T('privacyIntro'), { color: COL.dim, size: 15 });
      for (const k of ['privacyLocal', 'privacyCloud', 'privacyReport', 'privacyHost'] as const) para(`・${T(k)}`);
      if (cloudAvailable()) {
        // 雲端資料那一塊：左邊是現在的狀態（或上一次刪除的結果），右邊是刪除的按鈕
        y += 4;
        const line = this.add.graphics();
        line.lineStyle(1, COL.lineDim, 0.6).lineBetween(-W / 2 + 50, y, W / 2 - 50, y);
        body.add(line);
        y += 16;
        const result = this.step && this.step !== 'ask' ? this.step : null;
        const msg = pending ? T('cloudEraseBusy') : result ? T(RESULT[result]) : user ? T('cloudEraseWho', user.name) : T('cloudEraseNeedSignIn');
        const color = pending ? COL.cyan : result ? (result === 'done' ? COL.green : COL.orange) : COL.dim;
        const t = addText(this, -W / 2 + 50, y, msg, { size: 15, raw: true, strokeW: 0, bold: false, color, wrap: user ? W - 100 - 250 : W - 100, lineSpacing: 5 });
        body.add(t);
        if (user && !pending) {
          erase = new Button(this, W / 2 - 50 - 115, y + Math.max(t.height, 44) / 2, 230, 44, T('cloudErase'), () => this.redraw('ask'), { size: 16, color: 0xff8a7a });
          body.add(erase);
        }
        y += Math.max(t.height, user ? 44 : 0);
      } else y -= 12;
    }

    const H = 92 + y + 100;
    const z = Math.min(uiZoom(), (VIEW_H - 16) / H, (w - 16) / W);
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x02060c, 0.82).setInteractive();
    const box = this.add.container(w / 2, VIEW_H / 2).setScale(z);
    const g = this.add.graphics();
    drawPanel(g, -W / 2, -H / 2, W, H, { alpha: 0.98, cut: 18 });
    box.add(g);
    box.add(addText(this, 0, -H / 2 + 40, T(asking ? 'cloudErase' : 'privacyTitle'), { size: 26, raw: true, strokeW: 0, color: asking ? COL.orange : COL.text }).setOrigin(0.5));
    body.setPosition(0, -H / 2 + 92);
    box.add(body);

    const by = H / 2 - 44;
    if (asking) {
      const cancel = new Button(this, 130, by, 220, 52, T('cancel'), () => this.redraw(), { size: 18, primary: true });
      const go: Button = new Button(
        this,
        -130,
        by,
        220,
        52,
        T('cloudEraseConfirm'),
        () => {
          if (pending) return;
          // 就在這一下點擊裡開始：第一步是 Google 的確認視窗
          pending = cloudErase();
          go.setLabel(T('cloudEraseBusy'));
          void pending.then((r) => {
            pending = null;
            if (this.scene.isActive()) this.redraw(r);
          });
        },
        { size: 18, color: 0xff8a7a },
      );
      box.add([go, cancel]);
      // 預設停在「取消」：按鍵操作時不會一按就刪
      new KeyNav(this, { onBack: () => this.redraw(), first: () => cancel });
    } else {
      const full = new Button(this, -130, by, 240, 52, T('privacyFull'), () => openLegal('privacy'), { size: 18, primary: true });
      box.add(full);
      box.add(new Button(this, 130, by, 200, 52, T('close'), () => this.close(), { size: 18, color: 0x8fb0c8 }));
      new KeyNav(this, { onBack: () => this.close(), first: () => full });
    }
    // 刪除還在進行的時候畫面被重排了（轉了手機）：結果出來時照樣要顯示
    if (pending && !asking) void pending.then((r) => this.scene.isActive() && this.redraw(r));
  }

  private redraw(step?: PrivacyData['step']): void {
    this.scene.restart({ onClose: this.onClose, step });
  }

  private close(): void {
    const done = this.onClose;
    this.scene.stop();
    done();
  }
}
