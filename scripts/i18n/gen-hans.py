# 產生繁→簡字元對照表 src/td/hans.ts（簡體中文版用，執行時逐字轉換）
# 需要 OpenCC 的字典：pip install opencc-python-reimplemented
#   python3 scripts/i18n/gen-hans.py
# 只收一對一的字元（OpenCC TSCharacters 的第一個候選）；片語層級的差異在遊戲文字裡很少見。
import os
import opencc

src = os.path.join(os.path.dirname(opencc.__file__), 'dictionary', 'TSCharacters.txt')
pairs = []
for line in open(src, encoding='utf-8'):
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 2:
        continue
    t, s = parts[0], parts[1].split(' ')[0]
    if len(t) == 1 and len(s) == 1 and t != s:
        pairs.append(t + s)
# 台灣用語 → 大陸用語（先換詞、再逐字轉簡體）。只挑介面常用、不會改變遊戲文意的詞；
# OpenCC 的 TWPhrasesRev 多是電腦術語（例如「模擬」→「仿真」），不適合直接套用到遊戲文字。
PHRASES = [
    ('隱私權政策', '隱私政策'), ('製作群', '製作人員'), ('個人資料', '個人信息'), ('解析度', '分辨率'),
    ('剪貼簿', '剪貼板'), ('設定', '設置'), ('載入', '加載'), ('螢幕', '屏幕'), ('網路', '網絡'),
    ('預設', '默認'), ('儲存', '保存'), ('介面', '界面'), ('視窗', '窗口'), ('觸控', '觸摸'),
    ('裝置', '設備'), ('登入', '登錄'), ('選單', '菜單'), ('資訊', '信息'), ('訊息', '消息'),
    ('檔案', '文件'), ('程式', '程序'), ('砲', '炮'),
]
out = os.path.join(os.path.dirname(__file__), '../../src/td/hans.ts')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// 由 scripts/i18n/gen-hans.py 從 OpenCC（Apache-2.0）的 TSCharacters 產生，不要手改\n')
    f.write('// 每兩個字一組：繁體、簡體\n')
    f.write(f"const PAIRS = '{''.join(pairs)}';\n")
    f.write('// 台灣用語 → 大陸用語（繁體字形，換完再逐字轉簡體）\n')
    f.write('const PHRASES: [string, string][] = [\n')
    for a, b in PHRASES:
        f.write(f"  ['{a}', '{b}'],\n")
    f.write('];\n\n')
    f.write('let map: Map<string, string> | null = null;\n')
    f.write('// 同一段文字常被重複畫（每次重建介面），轉過的記起來\n')
    f.write('const memo = new Map<string, string>();\n\n')
    f.write('/** 繁體轉簡體：先換用語，再逐字轉換 */\n')
    f.write('export function toHans(s: string): string {\n')
    f.write('  const hit = memo.get(s);\n')
    f.write('  if (hit !== undefined) return hit;\n')
    f.write('  if (!map) {\n')
    f.write('    map = new Map();\n')
    f.write('    const cs = [...PAIRS];\n')
    f.write('    for (let i = 0; i + 1 < cs.length; i += 2) map.set(cs[i], cs[i + 1]);\n')
    f.write('  }\n')
    f.write('  let t = s;\n')
    f.write('  for (const [a, b] of PHRASES) if (t.includes(a)) t = t.split(a).join(b);\n')
    f.write("  let out = '';\n")
    f.write('  for (const c of t) out += map.get(c) ?? c;\n')
    f.write('  if (memo.size < 4000) memo.set(s, out);\n')
    f.write('  return out;\n')
    f.write('}\n')
print(len(pairs), 'pairs ->', out)
