/**
 * 疊在畫布上的 HTML 對話框：顯示或輸入一段文字（存檔備份碼）。
 * 需要真正的 <textarea> 才能讓手機長按貼上、全選複製。
 */
export interface TextDialogOpts {
  title: string;
  hint: string;
  text?: string;
  readOnly: boolean;
  okLabel: string;
  cancelLabel?: string;
  /** 顯示「複製」按鈕 */
  copyLabel?: string;
  copiedLabel?: string;
  /** 回傳錯誤訊息則保持開啟並顯示；回傳 null 則關閉 */
  onOk?: (value: string) => string | null;
}

export function showTextDialog(o: TextDialogOpts): () => void {
  const root = document.createElement('div');
  // Android 返回鍵會找這個標記把對話框關掉
  root.dataset.kbDialog = '1';
  root.style.cssText =
    'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(10,6,4,0.6);font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;padding:16px;box-sizing:border-box;';
  const box = document.createElement('div');
  box.style.cssText =
    'width:min(520px,100%);background:linear-gradient(#f4e2b8,#e2c890);border:4px solid #6a4220;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.5);padding:18px 20px;color:#3a2412;box-sizing:border-box;';
  const h = document.createElement('div');
  h.textContent = o.title;
  h.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:6px;color:#4a2a10;';
  const hint = document.createElement('div');
  hint.textContent = o.hint;
  hint.style.cssText = 'font-size:14px;margin-bottom:10px;line-height:1.5;';
  const ta = document.createElement('textarea');
  ta.value = o.text ?? '';
  ta.readOnly = o.readOnly;
  ta.spellcheck = false;
  ta.style.cssText =
    'width:100%;height:110px;box-sizing:border-box;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;word-break:break-all;border:2px solid #8a5a30;border-radius:8px;padding:8px;background:#fffaf0;color:#2a1608;resize:none;';
  const err = document.createElement('div');
  err.style.cssText = 'min-height:20px;font-size:14px;color:#b02a1a;margin-top:6px;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px;';
  const btn = (label: string, bg: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `font-size:16px;font-weight:700;padding:8px 18px;border-radius:10px;border:2px solid #2a1608;background:${bg};color:#fff;cursor:pointer;`;
    row.appendChild(b);
    return b;
  };
  box.append(h, hint, ta, err, row);
  root.appendChild(box);
  // 不讓點擊 / 按鍵穿透到遊戲
  for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'keyup']) {
    root.addEventListener(ev, (e) => e.stopPropagation());
  }
  const close = () => root.remove();
  if (o.copyLabel) {
    const cb = btn(o.copyLabel, '#3a6ad0');
    cb.addEventListener('click', () => {
      const done = () => {
        cb.textContent = o.copiedLabel ?? o.copyLabel!;
      };
      const fallback = () => {
        ta.focus();
        ta.select();
        try {
          if (document.execCommand('copy')) done();
        } catch {
          // 手動複製：文字已全選
        }
      };
      try {
        navigator.clipboard.writeText(ta.value).then(done, fallback);
      } catch {
        fallback();
      }
    });
  }
  if (o.cancelLabel) btn(o.cancelLabel, '#7a6a5a').addEventListener('click', close);
  btn(o.okLabel, '#3a8a2a').addEventListener('click', () => {
    const msg = o.onOk ? o.onOk(ta.value) : null;
    if (msg) err.textContent = msg;
    else close();
  });
  document.body.appendChild(root);
  if (o.readOnly) {
    ta.focus();
    ta.select();
  } else {
    ta.focus();
  }
  return close;
}
