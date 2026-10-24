// 找出 src/td 裡所有 { zh: '…', en: '…' } 字串（TypeScript 語法樹，不靠正規表示式），
// 輸出 [{ zh, en, file }]，給翻譯表（日文等）比對有沒有漏翻。
// 帶 ${…} 的句子（執行時才組出來）查不了翻譯表，要在原處自己帶 ja：沒帶的列在 dynamic。
// node scripts/i18n/extract.cjs [輸出.json]
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../src/td');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.ts$/.test(f) && !/hans\.ts$|ja\.ts$/.test(f)) files.push(p);
  }
})(root);

const text = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null);
const out = new Map();
const dynamic = [];
for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const props = {};
      for (const p of n.properties) if (ts.isPropertyAssignment(p) && p.name && ts.isIdentifier(p.name)) props[p.name.text] = p.initializer;
      // 有 zhs 鍵的是「每種語言一個值」的對照表，不是要翻的句子
      if (props.zh && props.en && !props.zhs) {
        const zh = text(props.zh);
        const en = text(props.en);
        if (zh === '') {
          // 空字串不用翻
        } else if (zh !== null && en !== null) {
          if (!out.has(zh)) out.set(zh, { zh, en, file: path.relative(root, f) });
        } else if (!props.ja) {
          const { line } = src.getLineAndCharacterOfPosition(n.getStart());
          dynamic.push(`${path.relative(root, f)}:${line + 1}`);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}
const list = [...out.values()];
module.exports = { list, dynamic };
if (require.main === module) {
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(list, null, 1));
  console.log(`${list.length} strings${dynamic.length ? `; runtime-built without ja: ${dynamic.join(', ')}` : ''}`);
}
