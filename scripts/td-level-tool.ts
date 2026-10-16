/**
 * 塔防關卡幾何工具：
 *   npx tsx scripts/td-level-tool.ts check          → 檢查所有關卡的建造點是否壓到路、彼此太近、蓋到 HUD
 *   npx tsx scripts/td-level-tool.ts suggest l2 9   → 為某關自動建議 N 個建造點（貪婪覆蓋最大化）
 */
import { LEVELS } from '../src/td/data/levels';
import { Path } from '../src/td/sim/Path';
import { inEllipse } from '../src/td/sim/math';

const W = 1280;
const H = 720;
const HUD_ZONES = [
  { x0: 0, y0: 0, x1: 340, y1: 86 },
  { x0: 1110, y0: 0, x1: 1280, y1: 86 },
  { x0: 0, y0: 610, x1: 330, y1: 720 },
];
const MIN_PATH_DIST = 58;
const MIN_SPACING = 92;

function inHud(x: number, y: number, pad = 0): boolean {
  return HUD_ZONES.some((z) => x > z.x0 - pad && x < z.x1 + pad && y > z.y0 - pad && y < z.y1 + pad);
}

function pathDist(paths: Path[], x: number, y: number): number {
  return Math.min(...paths.map((p) => p.nearest({ x, y }).dist));
}

function check(): number {
  let problems = 0;
  for (const lv of LEVELS) {
    const paths = lv.paths.map((p) => new Path(p));
    const lens = paths.map((p) => Math.round(p.length));
    const enemies = lv.waves.reduce((n, w) => n + w.groups.reduce((m, g) => m + g.count, 0), 0);
    console.log(`\n[${lv.id}] ${lv.name.zh} paths=${lens.join(',')} spots=${lv.spots.length} waves=${lv.waves.length} enemies=${enemies}`);
    lv.spots.forEach((s, i) => {
      const pd = pathDist(paths, s.x, s.y);
      const issues: string[] = [];
      if (pd < MIN_PATH_DIST) issues.push(`too close to path (${pd.toFixed(0)})`);
      if (s.x < 40 || s.x > W - 40 || s.y < 70 || s.y > H - 20) issues.push('out of bounds');
      if (inHud(s.x, s.y, 30)) issues.push('under HUD');
      lv.spots.forEach((o, j) => {
        if (j > i && Math.hypot(o.x - s.x, o.y - s.y) < MIN_SPACING) issues.push(`overlaps spot ${j}`);
      });
      let cover = 0;
      for (const p of paths) for (const q of p.pts) if (inEllipse(s.x, s.y, q.x, q.y, 160)) cover++;
      const line = `  spot ${i} (${s.x},${s.y}) pathDist=${pd.toFixed(0)} cover=${cover}`;
      if (issues.length) {
        problems++;
        console.log(line + '  ⚠ ' + issues.join('; '));
      } else console.log(line);
    });
    const hs = lv.heroStart;
    console.log(`  heroStart (${hs.x},${hs.y}) pathDist=${pathDist(paths, hs.x, hs.y).toFixed(0)}`);
  }
  console.log(problems ? `\n${problems} problem(s)` : '\nAll good');
  return problems;
}

function suggest(id: string, n: number): void {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) throw new Error('no level ' + id);
  const paths = lv.paths.map((p) => new Path(p));
  const cands: { x: number; y: number; score: number }[] = [];
  for (let y = 90; y <= H - 30; y += 10) {
    for (let x = 50; x <= W - 50; x += 10) {
      if (inHud(x, y, 30)) continue;
      const pd = pathDist(paths, x, y);
      if (pd < 66 || pd > 105) continue;
      let score = 0;
      for (const p of paths) for (const q of p.pts) if (q.x > 0 && q.x < W && inEllipse(x, y, q.x, q.y, 155)) score++;
      cands.push({ x, y, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const chosen: typeof cands = [];
  // 沿路徑平均分配：每段挑一個覆蓋最高、且與已選點夠遠的位置
  const totalLen = paths.reduce((s, p) => s + p.length, 0);
  for (const [pi, p] of paths.entries()) {
    const k = Math.max(1, Math.round((n * p.length) / totalLen));
    for (let i = 0; i < k; i++) {
      const lo = (p.length * i) / k;
      const hi = (p.length * (i + 1)) / k;
      const pick = cands.find((c) => {
        const nd = p.nearest(c).d;
        if (nd < lo || nd > hi) return false;
        const q = p.posAt(nd);
        if (q.x < 30 || q.x > W - 30) return false;
        return chosen.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= 105);
      });
      if (pick) chosen.push(pick);
      void pi;
    }
  }
  console.log(chosen.map((c) => `{ x: ${c.x}, y: ${c.y} }, // ${c.score}`).join('\n'));
}

const [, , cmd, a, b] = process.argv;
if (cmd === 'suggest') suggest(a, Number(b ?? 8));
else process.exit(check() ? 1 : 0);
