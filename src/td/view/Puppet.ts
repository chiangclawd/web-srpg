import Phaser from 'phaser';

/**
 * 可變形的圖片：把貼圖切成格狀網格，每個頂點各自位移、各自明暗。
 * 單張手繪圖靠這個做出扭身、彎腰、腳步、拍翅、倒地等 2.5D 動作，不再像一張卡片整片搬動。
 *
 * 頂點座標是「貼圖像素、相對於 origin」：(0,0) 在 origin（單位腳底），往上是負 y。
 * 由擁有者每幀寫入 px/py/shade/alpha，再由 renderWebGL 直接送進 Multi pipeline（跟一般圖片同一批次）。
 */
export class Puppet extends Phaser.GameObjects.Image {
  readonly cols: number;
  readonly rows: number;
  /** 頂點位置（貼圖像素，相對 origin） */
  readonly px: Float32Array;
  readonly py: Float32Array;
  /** 每個頂點的亮度倍率（0..1），乘在 tint 上 */
  readonly shade: Float32Array;
  /** 每個頂點的透明度倍率 */
  readonly va: Float32Array;
  private tx: Float32Array;
  private ty: Float32Array;
  private vc: Uint32Array;

  constructor(scene: Phaser.Scene, x: number, y: number, tex: string, cols = 4, rows = 6) {
    super(scene, x, y, tex);
    this.cols = cols;
    this.rows = rows;
    const n = (cols + 1) * (rows + 1);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.shade = new Float32Array(n).fill(1);
    this.va = new Float32Array(n).fill(1);
    this.tx = new Float32Array(n);
    this.ty = new Float32Array(n);
    this.vc = new Uint32Array(n);
    scene.add.existing(this);
    this.resetGrid();
  }

  /** 回到未變形的格子 */
  resetGrid(): void {
    const fw = this.frame.realWidth;
    const fh = this.frame.realHeight;
    const ox = this.displayOriginX;
    const oy = this.displayOriginY;
    for (let r = 0; r <= this.rows; r++) {
      for (let c = 0; c <= this.cols; c++) {
        const i = r * (this.cols + 1) + c;
        this.px[i] = (c / this.cols) * fw - ox;
        this.py[i] = (r / this.rows) * fh - oy;
        this.shade[i] = 1;
        this.va[i] = 1;
      }
    }
  }

  renderWebGL(renderer: Phaser.Renderer.WebGL.WebGLRenderer, src: Puppet, camera: Phaser.Cameras.Scene2D.Camera, parentMatrix?: Phaser.GameObjects.Components.TransformMatrix): void {
    camera.addToRenderList(src);
    const pipeline = renderer.pipelines.set(src.pipeline, src) as Phaser.Renderer.WebGL.Pipelines.MultiPipeline;
    const calc = Phaser.GameObjects.GetCalcMatrix(src, camera, parentMatrix).calc;
    renderer.pipelines.preBatch(src);
    let unit = pipeline.setGameObject(src);
    const { a, b, c, d, e, f } = calc;
    const flip = src.flipX ? -1 : 1;
    const alpha = camera.alpha * src.alpha;
    const tint = src.tintTopLeft;
    const fill = src.tintFill;
    const tr = (tint >> 16) & 255;
    const tg = (tint >> 8) & 255;
    const tb = tint & 255;
    const getTint = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
    const n = src.px.length;
    for (let i = 0; i < n; i++) {
      const x = src.px[i] * flip;
      const y = src.py[i];
      src.tx[i] = x * a + y * c + e;
      src.ty[i] = x * b + y * d + f;
      const s = fill ? 1 : src.shade[i];
      const col = ((Math.min(255, tr * s) | 0) << 16) | ((Math.min(255, tg * s) | 0) << 8) | (Math.min(255, tb * s) | 0);
      src.vc[i] = getTint(col, alpha * src.va[i]);
    }
    const fr = src.frame;
    const u0 = fr.u0;
    const v0 = fr.v0;
    const du = (fr.u1 - fr.u0) / src.cols;
    const dv = (fr.v1 - fr.v0) / src.rows;
    const effect = fill ? 1 : 0;
    const W = src.cols + 1;
    const F32 = pipeline.vertexViewF32;
    const U32 = pipeline.vertexViewU32;
    const comp = pipeline.currentShader.vertexComponentCount;
    const tx = src.tx;
    const ty = src.ty;
    const vc = src.vc;
    for (let r = 0; r < src.rows; r++) {
      const vT = v0 + dv * r;
      const vB = vT + dv;
      for (let cc = 0; cc < src.cols; cc++) {
        if (pipeline.shouldFlush(6)) {
          pipeline.flush();
          unit = pipeline.setGameObject(src);
        }
        const iTL = r * W + cc;
        const iTR = iTL + 1;
        const iBL = iTL + W;
        const iBR = iBL + 1;
        const uL = u0 + du * cc;
        const uR = uL + du;
        // 兩個三角形：TL-BL-BR、TL-BR-TR（跟 Multi pipeline 的頂點格式一致：x y u v unit effect tint）
        let o = pipeline.vertexCount * comp - 1;
        F32[++o] = tx[iTL]; F32[++o] = ty[iTL]; F32[++o] = uL; F32[++o] = vT; F32[++o] = unit; F32[++o] = effect; U32[++o] = vc[iTL];
        F32[++o] = tx[iBL]; F32[++o] = ty[iBL]; F32[++o] = uL; F32[++o] = vB; F32[++o] = unit; F32[++o] = effect; U32[++o] = vc[iBL];
        F32[++o] = tx[iBR]; F32[++o] = ty[iBR]; F32[++o] = uR; F32[++o] = vB; F32[++o] = unit; F32[++o] = effect; U32[++o] = vc[iBR];
        F32[++o] = tx[iTL]; F32[++o] = ty[iTL]; F32[++o] = uL; F32[++o] = vT; F32[++o] = unit; F32[++o] = effect; U32[++o] = vc[iTL];
        F32[++o] = tx[iBR]; F32[++o] = ty[iBR]; F32[++o] = uR; F32[++o] = vB; F32[++o] = unit; F32[++o] = effect; U32[++o] = vc[iBR];
        F32[++o] = tx[iTR]; F32[++o] = ty[iTR]; F32[++o] = uR; F32[++o] = vT; F32[++o] = unit; F32[++o] = effect; U32[++o] = vc[iTR];
        pipeline.vertexCount += 6;
        const batch = pipeline.currentBatch;
        if (batch) batch.count = pipeline.vertexCount - batch.start;
      }
    }
    renderer.pipelines.postBatch(src);
  }
}
