// 回報問題，讀瀏覽器和遊戲狀態的那一半：記下程式錯誤、量畫面更新率、把現在的狀況收成一份報告。
// 報告的格式和表單網址在 report.ts（純函式）。
import type Phaser from 'phaser';
import { MISSIONS } from './data/missions';
import { activeSlot, save } from './save';
import { offlineState } from './offline';
import { cloudAvailable, cloudState } from './cloud/sync';
import { FEEDBACK } from './feedback-config';
import { cleanErrors, formatReport, pushError, reportUrl } from './report';
import type { ErrorNote, Facts, FeedbackTarget } from './report';

/** 錯誤紀錄也存在裝置裡：遊戲當掉之後玩家多半會重新整理，回報時要還看得到當掉前的那一筆 */
const KEY = 'starfall_errors_v1';
/** 畫面更新率留最近幾秒的 */
const FPS_SPAN = 30;

let game: Phaser.Game | null = null;
let errors: ErrorNote[] = [];
const fps: number[] = [];

function note(msg: string): void {
  errors = pushError(errors, { t: Date.now(), build: __GIT_SHA__, msg });
  try {
    localStorage.setItem(KEY, JSON.stringify(errors));
  } catch {
    // 寫不進去（無痕模式）：這次開著的期間還是記得
  }
}

export function initReport(g: Phaser.Game): void {
  game = g;
  try {
    errors = cleanErrors(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    errors = [];
  }
  window.addEventListener('error', (e) => {
    // 圖片或音樂載不到也會到這裡，那種沒有 message，不算程式錯誤
    if (!e.message) return;
    note(e.filename ? `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}` : e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r: unknown = e.reason;
    note(`unhandled: ${r instanceof Error ? `${r.name}: ${r.message}` : String(r)}`);
  });
  // 手機記憶體吃緊時瀏覽器會把繪圖環境收走，畫面會整個黑掉：這個一定要記
  const watchCanvas = (): void => g.canvas.addEventListener('webglcontextlost', () => note('webgl context lost'));
  if (g.isBooted) watchCanvas();
  else g.events.once('boot', watchCanvas);
  setInterval(() => {
    // 切到背景時瀏覽器會把更新率壓到很低，那不是遊戲慢
    if (document.hidden) return;
    fps.push(Math.round(g.loop.actualFps));
    if (fps.length > FPS_SPAN) fps.shift();
  }, 1000);
}

/** 自動化測試可以塞一個假的表單設定到 window.__sfFeedback */
const target = (): FeedbackTarget => (globalThis as { __sfFeedback?: FeedbackTarget }).__sfFeedback ?? FEEDBACK;

function gatherFacts(): Facts {
  const sv = save();
  const g = game;
  const nav = navigator as Navigator & { deviceMemory?: number; standalone?: boolean; userAgentData?: { platform?: string } };
  const mm = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches;
  const native = !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const mode = native ? 'app' : mm('(display-mode: fullscreen)') ? 'installed, fullscreen' : mm('(display-mode: standalone)') || nav.standalone ? 'installed' : document.fullscreenElement ? 'browser tab, fullscreen' : 'browser tab';

  // 現在開著的畫面（設定和這個回報頁不算）；戰鬥中帶上任務、回合和模式
  const active = g ? g.scene.getScenes(true).map((s) => s.scene.key) : [];
  let scene = active.filter((k) => k !== 'SfReport' && k !== 'SfSettings').join('+') || '?';
  const b = g?.scene.getScene('SfBattle') as unknown as { mission?: { id: string }; battle?: { turn: number; hard: boolean; easy: boolean } } | null | undefined;
  if (active.includes('SfBattle') && b?.mission && b.battle) scene += ` ${b.mission.id} turn ${b.battle.turn}${b.battle.hard ? ' challenge' : b.battle.easy ? ' easy' : ''}`;

  let renderer = 'canvas';
  let maxTexture: number | null = null;
  const gl = (g?.renderer as { gl?: WebGLRenderingContext } | undefined)?.gl;
  if (gl) {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = `webgl ${String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))}`.slice(0, 140);
      maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || null;
    } catch {
      renderer = 'webgl (no details)';
    }
  }

  const o = offlineState();
  const cs = cloudState();
  const stars = Object.values(sv.stars);
  return {
    version: __APP_VERSION__,
    sha: __GIT_SHA__,
    built: __BUILD_DATE__,
    now: Date.now(),
    scene,
    lang: sv.lang ?? 'auto',
    textScale: sv.textScale,
    fast: sv.fast,
    cutIn: sv.cutIn,
    easy: sv.easy,
    colorBlind: sv.colorBlind,
    sfx: Math.round(sv.sfx * 100) / 100,
    music: Math.round(sv.music * 100) / 100,
    view: `window ${window.innerWidth}x${window.innerHeight}@${Math.round(window.devicePixelRatio * 100) / 100}, canvas ${g ? `${g.scale.width}x${g.scale.height}` : '?'}, screen ${screen.width}x${screen.height}`,
    mode,
    ua: navigator.userAgent.slice(0, 260),
    platform: nav.userAgentData?.platform ?? navigator.platform ?? '?',
    touch: navigator.maxTouchPoints ?? 0,
    cores: navigator.hardwareConcurrency ?? null,
    memory: nav.deviceMemory ?? null,
    renderer,
    maxTexture,
    fps: fps.length ? { now: fps[fps.length - 1], min: Math.min(...fps), span: fps.length } : null,
    offline: o.status === 'ready' ? 'ready' : o.status === 'loading' ? `loading ${o.total ? Math.floor((o.done / o.total) * 100) : 0}%` : 'off',
    cloud: !cloudAvailable() ? 'off' : cs.user ? cs.status : 'signed out',
    progress: `${stars.filter((n) => n > 0).length}/${MISSIONS.length} cleared, ${stars.reduce((a, n) => a + n, 0)} stars, slot ${activeSlot()}`,
    errors,
  };
}

/** 給玩家看、也給玩家複製的那段文字 */
export const reportText = (): string => formatReport(gatherFacts());

/** 預先填好的回報表單網址；表單還沒設定就是 null */
export const reportLink = (): string | null => reportUrl(gatherFacts(), target());

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 舊的瀏覽器、或這個頁面沒有剪貼簿的權限：改用下面的老方法
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
