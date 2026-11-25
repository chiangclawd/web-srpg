// Gemini 的金鑰從環境變數 GEMINI_API_KEY 讀，不寫進程式或儲存庫，也不會印出來。
// 雲端工作環境裡金鑰由網路代理自動附加（要用 NODE_USE_ENV_PROXY=1 執行），那時沒有這個變數，回傳空的標頭。
const key = process.env.GEMINI_API_KEY;
if (!key && !process.env.HTTPS_PROXY && !process.env.https_proxy) {
  console.error('注意：沒有設 GEMINI_API_KEY，也沒有會附加金鑰的代理，請求會被拒絕');
}
const header = key ? { 'x-goog-api-key': key } : {};

export function keyHeader() {
  return header;
}
