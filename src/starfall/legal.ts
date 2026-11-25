// 製作名單上的名字，和兩份放在遊戲外面的說明頁（public/legal/）。
// 那兩頁刻意放在離線快取管的範圍（./starfall 開頭的網址）外面：裝成 App 之後從遊戲開它們，會開在瀏覽器裡，
// 有網址列也有返回鍵；放在範圍裡面的話會開在全螢幕的 App 視窗裡，沒有地方可以關。沒有網路時這兩頁打不開，
// 遊戲裡的那一頁有摘要。
import { getLang } from './i18n';

/** 製作名單「企劃・程式・製作」那一行的名字。要換成別的名字改這裡 */
export const MAKER = 'chiangclawd';

export const LEGAL = {
  /** 隱私權說明全文（商店上架時要填的隱私權政策網址也是這一頁） */
  privacy: 'legal/starfall-privacy.html',
  /** 製作名單和第三方授權全文（scripts/starfall-legal.mjs 產生的） */
  licenses: 'legal/starfall-licenses.html',
} as const;

/** 在新分頁開說明頁；英文介面跳到英文的那一段 */
export function openLegal(page: keyof typeof LEGAL): void {
  window.open(`${LEGAL[page]}${getLang() === 'en' ? '#en' : ''}`, '_blank', 'noopener');
}
