// 內嵌字型：思源黑體（Noto Sans TC）的子集，只有遊戲用到的字（scripts/art/fonts/）。
// 每個平台的系統字型不一樣（Windows 是微軟正黑體、蘋果是蘋方、Android 是 Noto），字寬和粗細都有差，
// 同一個畫面在不同裝置上會排得不一樣；用自己帶的字型就都一樣了。
// 字表以外的字（例如玩家 Google 帳號的名字）會退回系統字型。

/** 寫在 font-family 最前面的名字 */
export const GAME_FONT = 'Starfall Sans';
const WEIGHTS = [400, 700];
/** 等字型最多等這麼久；超過就先用系統字型開始（之後畫的字還是會用到載好的字型） */
const WAIT = 4000;

let ready: Promise<void> | null = null;

/** 開始載入字型（只會載一次）。回傳的 Promise 在字型可以用、或等太久放棄時完成，不會失敗 */
export function loadFonts(): Promise<void> {
  ready ??= (async () => {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
    const all = Promise.all(
      WEIGHTS.map(async (w) => {
        const face = new FontFace(GAME_FONT, `url(assets/starfall/fonts/starfall-sans-${w}.woff2) format("woff2")`, { weight: String(w), style: 'normal' });
        document.fonts.add(await face.load());
      }),
    );
    await Promise.race([all, new Promise((r) => setTimeout(r, WAIT))]).catch(() => undefined);
  })();
  return ready;
}
