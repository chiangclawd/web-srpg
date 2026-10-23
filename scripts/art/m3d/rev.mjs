// 3D 圖表的版本指紋：圖檔 + 格子座標 JSON 的內容雜湊，寫進 src/td/view/sheetRev.ts。
// 遊戲用 ?v=<指紋> 下載，重新渲染後網址就變了，離線快取不會拿舊圖配新座標
// （舊圖配新座標會切到錯的位置，角色變成一塊塊閃爍的碎片）。
// node scripts/art/m3d/rev.mjs（render.mjs 跑完會自動呼叫；測試會檢查有沒有忘了更新）
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const dir = path.join(repo, 'public/assets/m3d');

export function sheetRevs() {
  const revs = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).sort()) {
    const name = f.slice(0, -5);
    const h = createHash('sha1');
    h.update(fs.readFileSync(path.join(dir, f)));
    h.update(fs.readFileSync(path.join(dir, `${name}.json`)));
    revs[name] = h.digest('hex').slice(0, 10);
  }
  return revs;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const revs = sheetRevs();
  const body = Object.entries(revs)
    .map(([k, v]) => `  ${k}: '${v}',`)
    .join('\n');
  const out = `// 由 scripts/art/m3d/rev.mjs 產生，不要手改：圖檔 + 座標 JSON 的內容指紋（下載網址的 ?v=）\nexport const SHEET_REV: Record<string, string> = {\n${body}\n};\n`;
  fs.writeFileSync(path.join(repo, 'src/td/view/sheetRev.ts'), out);
  console.log(`sheetRev.ts: ${Object.keys(revs).length} sheets`);
}
