import { showTextDialog } from './textDialog';
import { T } from '../i18n';

export const GAME_URL = 'https://chiangclawd.github.io/web-srpg/td.html';

/**
 * 分享成績：手機用系統分享選單；不支援就複製到剪貼簿；都不行就顯示文字讓玩家自己複製。
 * onCopied 用來在遊戲內提示「已複製」。
 */
export function shareResult(text: string, onCopied: () => void): void {
  const full = `${text}\n${GAME_URL}`;
  const manual = () =>
    showTextDialog({ title: T('share'), hint: T('shareHint'), text: full, readOnly: true, okLabel: 'OK', copyLabel: T('copy'), copiedLabel: T('copied') });
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    nav.share({ title: T('title'), text, url: GAME_URL }).catch((e: unknown) => {
      // 使用者取消分享不算錯誤；其他失敗改用手動複製
      if (!(e instanceof DOMException && e.name === 'AbortError')) manual();
    });
    return;
  }
  try {
    navigator.clipboard.writeText(full).then(onCopied, manual);
  } catch {
    manual();
  }
}
