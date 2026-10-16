import type { Vec } from './math';

/**
 * 敵人行走路徑：控制點 → Catmull-Rom 平滑曲線 → 以固定步長重新取樣。
 * 等距取樣讓 `posAt(d)` 只要 O(1) 查表，數百個敵人每幀查詢也很便宜。
 */
export class Path {
  static readonly STEP = 4;
  readonly pts: Vec[] = [];
  /** 每個取樣點的單位切線 */
  readonly tan: Vec[] = [];
  readonly length: number;

  constructor(readonly control: Vec[]) {
    const dense = catmullRom(control, 20);
    // 依弧長重新取樣
    const step = Path.STEP;
    let acc = 0;
    let carry = 0;
    this.pts.push({ ...dense[0] });
    for (let i = 1; i < dense.length; i++) {
      const a = dense[i - 1];
      const b = dense[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen === 0) continue;
      let t = step - carry;
      while (t <= segLen) {
        const k = t / segLen;
        this.pts.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        t += step;
      }
      carry = segLen - (t - step);
      acc += segLen;
    }
    const last = dense[dense.length - 1];
    this.pts.push({ ...last });
    this.length = (this.pts.length - 2) * step + carry;
    for (let i = 0; i < this.pts.length; i++) {
      const a = this.pts[Math.max(0, i - 2)];
      const b = this.pts[Math.min(this.pts.length - 1, i + 2)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      this.tan.push({ x: (b.x - a.x) / l, y: (b.y - a.y) / l });
    }
    void acc;
  }

  /** 路徑上距離 d 的位置；lane 為沿法線的側向偏移（像素） */
  posAt(d: number, lane = 0, out: Vec = { x: 0, y: 0 }): Vec {
    const f = Math.max(0, Math.min(d, this.length)) / Path.STEP;
    const i = Math.min(Math.floor(f), this.pts.length - 2);
    const k = f - i;
    const a = this.pts[i];
    const b = this.pts[i + 1];
    const t = this.tan[i];
    out.x = a.x + (b.x - a.x) * k - t.y * lane;
    out.y = a.y + (b.y - a.y) * k + t.x * lane;
    return out;
  }

  tangentAt(d: number): Vec {
    const i = Math.max(0, Math.min(this.tan.length - 1, Math.round(d / Path.STEP)));
    return this.tan[i];
  }

  /** 點到路徑的最近距離與其弧長參數 */
  nearest(p: Vec): { dist: number; d: number } {
    let best = Infinity;
    let bestI = 0;
    for (let i = 0; i < this.pts.length; i += 2) {
      const q = this.pts[i];
      const dd = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
      if (dd < best) {
        best = dd;
        bestI = i;
      }
    }
    return { dist: Math.sqrt(best), d: bestI * Path.STEP };
  }
}

/** 均勻 Catmull-Rom；端點複製一次讓曲線穿過首尾控制點 */
export function catmullRom(ctrl: Vec[], samples: number): Vec[] {
  if (ctrl.length < 2) return ctrl.map((p) => ({ ...p }));
  const p = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out: Vec[] = [];
  for (let i = 0; i < p.length - 3; i++) {
    const p0 = p[i];
    const p1 = p[i + 1];
    const p2 = p[i + 2];
    const p3 = p[i + 3];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push({ ...ctrl[ctrl.length - 1] });
  return out;
}
