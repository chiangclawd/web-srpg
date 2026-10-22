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
// HUD 範圍（遊戲座標）。兩種手機都要檢查：
//   16:9 手機：邏輯寬 1280，HUD 壓在玩法區上，放大 1.35 倍
//   19.5:9 手機：邏輯寬 1560，HUD 貼著螢幕邊（玩法區外各 140px 邊距），放大 1.55 倍
function hudZones(z: number, margin: number) {
  return [
    // 左上：生命 / 金幣 / 波次
    { x0: -margin, y0: 0, x1: -margin + 12 + 336 * z, y1: 10 + 50 * z },
    // 右上：暫停 / 速度
    { x0: W + margin - 8 - 120 * z, y0: 0, x1: W + margin, y1: 8 + 66 * z },
    // 左下：英雄 + 法術
    { x0: -margin, y0: H - 14 - 92 * z, x1: -margin + 8 + 303 * z, y1: H },
    // 右下道具列
    { x0: W + margin - 8 - 223 * z, y0: H - 8 - 57 * z, x1: W + margin, y1: H },
  ];
}
const HUD_ZONES = [...hudZones(1.35, 0), ...hudZones(1.55, 140)];
const MIN_PATH_DIST = 58;
/** 背景建築的大小：[半寬, 錨點往上的高度]（對照手繪背景量的） */
const BUILDING = { house: [55, 120], castle: [80, 135], camp: [70, 65], tower_ruin: [40, 100], altar: [50, 40] } as const;
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
        } else if (d.kind in BUILDING) {
          // 建築從錨點往上畫（屋頂、塔樓、旗子），用往上延伸的框檢查，建造點的石圈約 ±40 × ±22
          const [hw, up] = BUILDING[d.kind as keyof typeof BUILDING];
          const sc = 'scale' in d ? (d.scale ?? 1) : 1;
          if (s.x + 40 > d.x - hw * sc && s.x - 40 < d.x + hw * sc && s.y + 22 > d.y - up * sc && s.y - 22 < d.y + 20) issues.push(`overlaps ${d.kind}`);
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
    // 地圖機關：不能壓路、不能和建造點的點擊範圍重疊、不能在 HUD 底下，滾動區段要在路徑上
    (lv.hazards ?? []).forEach((h, i) => {
      const issues: string[] = [];
      const pd = pathDist(paths, h.x, h.y);
      if (pd < 50) issues.push(`too close to path (${pd.toFixed(0)})`);
      const near = Math.min(...lv.spots.map((s) => Math.hypot(s.x - h.x, (s.y - h.y) * 1.2)));
      if (near < 95) issues.push(`overlaps a build spot (${near.toFixed(0)})`);
      if (inHud(h.x, h.y - 30, 10)) issues.push('under HUD');
      const p = paths[h.path];
      if (!p) issues.push(`no path ${h.path}`);
      else if (Math.max(h.d0, h.d1) > p.length || Math.min(h.d0, h.d1) < 0) issues.push(`roll outside path (len ${Math.round(p.length)})`);
      const line = `  hazard ${i} ${h.kind} (${h.x},${h.y}) pathDist=${pd.toFixed(0)} spotDist=${near.toFixed(0)} roll ${h.d0}→${h.d1}`;
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
