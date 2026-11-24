// 存檔：三個存檔欄位。換一個來玩、匯出成檔案、從檔案匯入、刪除。
// 疊在標題畫面上面（跟設定頁一樣）；關掉時呼叫 onClose，讓標題照現在的存檔重畫。
import Phaser from 'phaser';
import { COL, VIEW_H, addText, setupCamera, uiZoom, viewW } from '../config';
import { L, T } from '../i18n';
import { SLOTS } from '../cloud/merge';
import type { SlotData, SlotId } from '../cloud/merge';
import { cloudAvailable, cloudState } from '../cloud/sync';
import { MISSIONS } from '../data/missions';
import { activeSlot, setActiveSlot } from '../save';
import { deleteSlot, downloadExport, importSlot, pickExport, slotSummary, summarize } from '../slots';
import type { SlotSummary } from '../slots';
import { Button, KeyNav, drawPanel } from '../view/ui';

export interface SavesData {
  onClose?: () => void;
  /** 按過一次「刪除」、等第二次確認的存檔 */
  armed?: SlotId;
  /** 選好了檔案、等確認要蓋掉的存檔 */
  pending?: { slot: SlotId; data: SlotData };
  /** 面板下面的那行訊息 */
  msg?: string;
  /** 訊息是不是壞消息（用橘色） */
  bad?: boolean;
}

const W = 1080;
const H = 560;
const CARD_W = 320;
const CARD_H = 372;
const BTN_W = CARD_W - 40;

export class SavesScene extends Phaser.Scene {
  private d: SavesData = {};

  constructor() {
    super('SfSaves');
  }

  init(data: SavesData): void {
    this.d = data ?? {};
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    const w = viewW(this);
    const z = Math.min(uiZoom(), (VIEW_H - 16) / H, (w - 16) / W);
    this.add.rectangle(w / 2, VIEW_H / 2, w, VIEW_H, 0x02060c, 0.78).setInteractive();
    const box = this.add.container(w / 2, VIEW_H / 2).setScale(z);
    const g = this.add.graphics();
    drawPanel(g, -W / 2, -H / 2, W, H, { alpha: 0.97, cut: 18 });
    box.add(g);
    box.add(addText(this, 0, -H / 2 + 40, T('saves'), { size: 28, raw: true, strokeW: 0 }).setOrigin(0.5));

    const cur = activeSlot();
    const redraw = (patch: Partial<SavesData> = {}): void => void this.scene.restart({ onClose: this.d.onClose, ...patch });
    let first: Button | null = null;
    SLOTS.forEach((n, i) => {
      const s = slotSummary(n);
      const active = n === cur;
      const cx = (i - 1) * (CARD_W + 20);
      const top = -H / 2 + 76;
      const card = this.add.graphics();
      drawPanel(card, cx - CARD_W / 2, top, CARD_W, CARD_H, { fill: 0x0a1626, alpha: 1, line: active ? COL.line : COL.lineDim, cut: 12 });
      box.add(card);
      box.add(addText(this, cx - CARD_W / 2 + 20, top + 26, T('saveSlot', n), { size: 21, raw: true, strokeW: 0 }).setOrigin(0, 0.5));
      if (active) box.add(addText(this, cx + CARD_W / 2 - 20, top + 26, T('saveInUse'), { size: 14, raw: true, strokeW: 0, color: COL.cyan }).setOrigin(1, 0.5));
      // 摘要；選好了要匯入的檔案時，改顯示檔案裡的內容
      const pending = this.d.pending?.slot === n ? this.d.pending.data : null;
      const lines = pending ? [T('saveFileHas'), ...this.lines(summarize(pending, null))] : this.lines(s);
      box.add(addText(this, cx - CARD_W / 2 + 20, top + 52, lines.join('\n'), { size: 15, raw: true, strokeW: 0, bold: false, color: pending ? COL.yellow : s.empty ? COL.dim : COL.text, lineSpacing: 7, wrap: CARD_W - 40 }));

      let y = top + CARD_H - 4 * 48 + 14;
      const add = (label: string, fn: () => void, disabled = false, color?: number): Button => {
        const b = new Button(this, cx, y, BTN_W, 40, label, fn, { size: 16, disabled, color });
        box.add(b);
        y += 46;
        return b;
      };
      const use = add(active ? T('saveInUse') : T('saveUse'), () => {
        setActiveSlot(n);
        redraw();
      }, active);
      if (active) first = first ?? use;
      add(T('saveExport'), () => {
        downloadExport(n);
        redraw({ msg: T('saveExported', n) });
      }, s.empty);
      if (pending) {
        add(T('saveImportConfirm'), () => {
          importSlot(n, pending);
          redraw({ msg: T('saveImported', n) });
        }, false, 0xffd75a);
      } else {
        add(T('saveImport'), () => {
          void pickExport().then((data) => {
            if (!this.scene.isActive()) return;
            if (data === undefined) return;
            if (data === null) return redraw({ msg: T('saveImportBad'), bad: true });
            // 空的存檔直接放進去；有東西的要再按一次確認
            if (s.empty) {
              importSlot(n, data);
              redraw({ msg: T('saveImported', n) });
            } else redraw({ pending: { slot: n, data }, msg: T('saveImportAsk', n) });
          });
        });
      }
      const armed = this.d.armed === n;
      add(armed ? T('saveDeleteConfirm') : T('saveDelete'), () => {
        if (!armed) return redraw({ armed: n, msg: T('saveDeleteAsk', n), bad: true });
        deleteSlot(n);
        redraw({ msg: T('saveDeleted', n) });
      }, s.empty, 0xff7a6a);
    });

    const note = this.d.msg ?? (cloudAvailable() ? T(cloudState().user ? 'saveCloudOn' : 'saveCloudOff') : T('saveNote'));
    box.add(addText(this, 0, H / 2 - 96, note, { size: 14, raw: true, strokeW: 0, bold: false, color: this.d.msg ? (this.d.bad ? COL.orange : COL.cyan) : COL.dim, wrap: W - 80, align: 'center' }).setOrigin(0.5));
    box.add(new Button(this, 0, H / 2 - 44, 240, 52, T('close'), () => this.close(), { primary: true }));
    new KeyNav(this, { onBack: () => this.close(), first: () => first });
  }

  private lines(s: SlotSummary): string[] {
    if (s.empty) return [T('saveEmpty')];
    const out = [`★ ${s.stars} / ${s.maxStars}`, T('saveCleared', s.cleared, s.missions), T('saveParts', s.parts)];
    const m = s.battle ? MISSIONS.find((x) => x.id === s.battle?.mission) : undefined;
    if (s.battle && m) out.push(T('saveBattle', L(m.name), s.battle.turn));
    return out;
  }

  private close(): void {
    const done = this.d.onClose;
    this.scene.stop();
    done?.();
  }
}
