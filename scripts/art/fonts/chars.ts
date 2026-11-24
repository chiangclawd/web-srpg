// 《星墜殘響》會顯示在畫面上的所有字：src/starfall 底下每個字串（不含註解）和 starfall.html 的文字。
// 內嵌字型只收這些字（整套中文字型有 7 MB，收用到的幾百個字只要一兩百 KB）。
//   npm run starfall:font-chars      把字表寫到 scripts/art/fonts/starfall-chars.txt
//   py scripts/art/fonts/starfall_font.py <放 NotoSansTC_*.ttf 的資料夾>      照字表重做字型檔
// 加了新的文字、用到字表裡沒有的字時，tests/starfall/font.test.ts 會失敗並列出缺的字；照上面兩步重做就好。
// （缺字不會讓遊戲壞掉，那幾個字會退回系統字型，只是看起來跟旁邊的字不一樣。）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const CHARS_FILE = path.join(ROOT, 'scripts/art/fonts/starfall-chars.txt');

/** 程式裡沒有寫死、但畫面上可能出現的：英數標點全部，加上常用的中文標點和符號 */
const ALWAYS = '，。、；：？！「」『』（）《》〈〉【】—…‧·～％＋－×÷→←↑↓★☆▲▼●○◆■□✓“”‘’　';

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tsFiles(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** 排好序、不重複的字表 */
export function collectChars(): string {
  const set = new Set<string>(ALWAYS);
  for (let c = 0x20; c < 0x7f; c++) set.add(String.fromCharCode(c));
  const add = (s: string): void => {
    for (const c of s) if (c > ' ') set.add(c);
  };
  for (const f of tsFiles(path.join(ROOT, 'src/starfall'))) {
    const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.ES2022, true);
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) add(n.text);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  // 網頁本身的文字（標題、請把手機橫過來的提示）：去掉標籤和樣式之後剩下的
  const html = fs.readFileSync(path.join(ROOT, 'starfall.html'), 'utf8');
  add(html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' '));
  for (const m of html.matchAll(/content="([^"]*)"/g)) add(m[1]);
  return [...set].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)).join('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chars = collectChars();
  fs.writeFileSync(CHARS_FILE, chars + '\n');
  console.log(`${[...chars].length} characters -> ${path.relative(ROOT, CHARS_FILE)}`);
}
