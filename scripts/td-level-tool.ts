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
// HUD 範圍：以 16:9 手機（邏輯寬 1280、HUD 壓在玩法區上、放大 1.35 倍）為最壞情況
const HUD_Z = 1.35;
const HUD_ZONES = [
  // 左上：生命 / 金幣 / 波次
  { x0: 0, y0: 0, x1: 12 + 336 * HUD_Z, y1: 10 + 50 * HUD_Z },
  // 右上：暫停 / 速度
  { x0: W - 8 - 120 * HUD_Z, y0: 0, x1: W, y1: 8 + 66 * HUD_Z },
  // 左下：英雄 + 法術
  { x0: 0, y0: H - 14 - 92 * HUD_Z, x1: 8 + 303 * HUD_Z, y1: H },
  // 右下道具列
  { x0: W - 8 - 223 * HUD_Z, y0: H - 8 - 57 * HUD_Z, x1: W, y1: H },
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
      if (s.x < 64 || s.x > W - 64 || s.y < 70 || s.y > H - 20) issues.push('out of bounds');
      for (const d of lv.decor ?? []) {
        if (d.kind === 'river') {
          const rp = new Path(d.points);
          const rd = rp.nearest({ x: s.x, y: s.y }).dist;
          if (rd < d.width / 2 + 42) issues.push(`in river (${rd.toFixed(0)})`);
        } else if (d.kind === 'lake') {
          if (Math.hypot((s.x - d.x) / (d.rx + 40), (s.y - d.y) / (d.ry + 30)) < 1) issues.push('in lake');
        } else if (d.kind === 'house' || d.kind === 'castle' || d.kind === 'camp' || d.kind === 'tower_ruin' || d.kind === 'altar') {
          if (Math.hypot(s.x - d.x, (s.y - d.y) * 1.3) < 80) issues.push(`overlaps ${d.kind}`);
        }
      }
      if (inHud(s.x, s.y, 10)) issues.push('under HUD');
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
    // 路徑覆蓋率：每條路有多少比例（畫面內）落在至少一個建造點射程內
    paths.forEach((p, pi) => {
      let inView = 0;
      let covered = 0;
      let gap = 0;
      let maxGap = 0;
      for (const q of p.pts) {
        if (q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
        inView++;
        const c = lv.spots.some((s) => inEllipse(s.x, s.y, q.x, q.y, 150));
        if (c) {
          covered++;
          gap = 0;
        } else {
          gap += 4;
          maxGap = Math.max(maxGap, gap);
        }
      }
      const pct = (covered / Math.max(1, inView)) * 100;
      const msg = `  path ${pi} coverage ${pct.toFixed(0)}% maxGap ${maxGap}px`;
      if (pct < 70 || maxGap > 260) {
        problems++;
        console.log(msg + '  ⚠ poorly covered');
      } else console.log(msg);
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
