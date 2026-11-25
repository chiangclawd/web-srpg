// 回報問題：把這一版和這台裝置的狀況整理成一段文字，玩家可以帶到回報表單、或複製起來。
// 裡面只有版本、設定、裝置和最近的程式錯誤，沒有帳號名稱，也沒有存檔內容。
// 全部用英文和數字：這段字會放進表單的網址，中文在網址裡一個字要九個字元。
// 這個檔案只有純函式（測試直接用）；讀瀏覽器和遊戲狀態的部分在 report-env.ts。

export interface ErrorNote {
  /** 發生的時間（毫秒） */
  t: number;
  /** 那時候是哪一版：重新整理或更新之後，還看得出是哪一版出的錯 */
  build: string;
  msg: string;
}

export const MAX_ERRORS = 5;
const MAX_MSG = 180;

/** 記一筆錯誤，最多留最近五筆。同一個錯連續出現只留一筆：每一格畫面都丟同一個錯的時候，不要把前面的洗掉 */
export function pushError(list: ErrorNote[], e: ErrorNote): ErrorNote[] {
  // 檔案網址的前半段每一筆都一樣，拿掉；空白壓成一格
  const msg = e.msg
    .replace(/https?:\/\/[^/\s]+\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MSG);
  if (!msg || (list.length && list[list.length - 1].msg === msg)) return list;
  return [...list, { t: e.t, build: e.build, msg }].slice(-MAX_ERRORS);
}

/** 從裝置裡讀回來的錯誤紀錄：形狀不對的丟掉 */
export function cleanErrors(raw: unknown): ErrorNote[] {
  if (!Array.isArray(raw)) return [];
  const ok = raw.filter((e): e is ErrorNote => !!e && typeof e === 'object' && typeof (e as ErrorNote).t === 'number' && typeof (e as ErrorNote).build === 'string' && typeof (e as ErrorNote).msg === 'string');
  return ok.map((e) => ({ t: e.t, build: e.build.slice(0, 12), msg: e.msg.slice(0, MAX_MSG) })).slice(-MAX_ERRORS);
}

/** 報告裡的每一項。蒐集的地方在 report-env.ts 的 gatherFacts */
export interface Facts {
  version: string;
  sha: string;
  built: string;
  now: number;
  /** 現在在哪個畫面；戰鬥中會帶任務、回合和模式 */
  scene: string;
  lang: string;
  textScale: number;
  fast: boolean;
  cutIn: boolean;
  easy: boolean;
  colorBlind: boolean;
  sfx: number;
  music: number;
  /** 視窗、畫布和螢幕的大小 */
  view: string;
  /** 瀏覽器分頁、裝在主畫面、還是 App */
  mode: string;
  ua: string;
  platform: string;
  touch: number;
  cores: number | null;
  memory: number | null;
  renderer: string;
  maxTexture: number | null;
  fps: { now: number; min: number; span: number } | null;
  offline: string;
  cloud: string;
  progress: string;
  errors: ErrorNote[];
}

const iso = (t: number): string => new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
const onOff = (b: boolean): string => (b ? 'on' : 'off');

/** omitted：為了讓網址不要太長而沒放進來的舊錯誤有幾筆 */
export function formatReport(f: Facts, omitted = 0): string {
  const lines = [
    `Starfall Echo ${f.version} ${f.sha} (built ${f.built} UTC)`,
    `time: ${iso(f.now)}`,
    `scene: ${f.scene}`,
    `settings: lang ${f.lang}, text ${f.textScale}, ${f.fast ? 'fast' : 'normal speed'}, cut-in ${onOff(f.cutIn)}, ${f.easy ? 'easy' : 'normal'}, colour-blind ${onOff(f.colorBlind)}, sfx ${f.sfx}, music ${f.music}`,
    `view: ${f.view}, ${f.mode}`,
    `device: ${f.ua}`,
    `platform: ${f.platform}, touch ${f.touch}, cores ${f.cores ?? '?'}, memory ${f.memory ?? '?'} GB`,
    `gpu: ${f.renderer}, max texture ${f.maxTexture ?? '?'}`,
    `fps: ${f.fps ? `${f.fps.now} (lowest ${f.fps.min} in the last ${f.fps.span} s)` : '?'}`,
    `offline: ${f.offline}, cloud: ${f.cloud}`,
    `progress: ${f.progress}`,
  ];
  if (!f.errors.length && !omitted) lines.push('errors: none');
  else {
    lines.push(omitted ? `errors (${omitted} older left out):` : 'errors:');
    for (const e of f.errors) lines.push(`- ${iso(e.t)} [${e.build}] ${e.msg}`);
  }
  return lines.join('\n');
}

export interface FeedbackTarget {
  form: string;
  entry: string;
}

/** 表單網址的長度上限：再長有的瀏覽器或伺服器不收 */
export const URL_LIMIT = 4000;

/** 預先填好診斷資訊的表單網址；表單還沒設定（或設定的不是 Google 表單）就回傳 null。太長的話從最舊的錯誤開始拿掉 */
export function reportUrl(f: Facts, target: FeedbackTarget): string | null {
  if (!/^https:\/\/docs\.google\.com\/forms\/[^?#]+$/.test(target.form) || !/^\d+$/.test(target.entry)) return null;
  const base = `${target.form}?usp=pp_url&entry.${target.entry}=`;
  for (let keep = f.errors.length; keep >= 0; keep--) {
    const url = base + encodeURIComponent(formatReport({ ...f, errors: f.errors.slice(f.errors.length - keep) }, f.errors.length - keep));
    if (url.length <= URL_LIMIT) return url;
  }
  // 一筆錯誤都不放還是太長（瀏覽器報的裝置名稱特別長）：從後面切，切到放得下
  let text = formatReport({ ...f, errors: [] }, f.errors.length);
  while (text.length > 100 && (base + encodeURIComponent(text)).length > URL_LIMIT) text = text.slice(0, text.length - 100);
  return base + encodeURIComponent(text);
}
