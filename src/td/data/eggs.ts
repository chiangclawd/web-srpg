import type { L10n, LevelDef, ThemeId } from '../sim/defs';

/**
 * 彩蛋：戰場上可以點的小驚喜（敲房門、驚起樹上的鳥、石頭後偷看的怪物、跳出水面的魚……）。
 * 位置直接取自關卡的裝飾物（手繪背景就是照著它們畫的），每個彩蛋第一次被發現時送 1 顆寶石。
 */
export type EggKind = 'knock' | 'castle' | 'camp' | 'birds' | 'fish' | 'ice' | 'peek' | 'bats' | 'altar' | 'troll' | 'sheep';

export interface Egg {
  id: string;
  kind: EggKind;
  x: number;
  y: number;
  /** 點擊判定半徑 */
  r: number;
  /** peek：探出頭的怪物圖 */
  sprite?: string;
}

/** 達成「好奇寶寶」需要發現的彩蛋數 */
export const EGG_GOAL = 15;

/** 每個地形躲在石頭後面的小怪 */
const PEEKER: Record<ThemeId, string> = {
  grass: 'mon_goblin',
  forest: 'mon_wolf',
  autumn: 'mon_wolf',
  snow: 'mon_yeti',
  waste: 'mon_skeleton',
  desert: 'mon_scorpion',
  volcano: 'mon_magma_imp',
  coast: 'mon_reef_crab',
};

/** 草原上吃草的綿羊（點五下會爆開，致敬經典塔防） */
const SHEEP: Record<string, { x: number; y: number }[]> = {
  l1: [{ x: 335, y: 625 }],
  l2: [{ x: 205, y: 528 }],
};

export const EGG_LINES: Partial<Record<EggKind, L10n[]>> = {
  knock: [
    { zh: '誰呀？', en: "Who's there?" },
    { zh: '今天不買東西！', en: "We're not buying anything!" },
    { zh: '外面在打仗，別敲了！', en: "There's a war on, stop knocking!" },
    { zh: '門沒鎖……開玩笑的！', en: "It's open… just kidding!" },
  ],
  castle: [
    { zh: '口令？', en: 'Password?' },
    { zh: '城門不開！', en: 'The gate stays shut!' },
    { zh: '國王在午睡。', en: 'The king is napping.' },
  ],
  camp: [
    { zh: 'Zzz……', en: 'Zzz…' },
    { zh: '再睡五分鐘……', en: 'Five more minutes…' },
    { zh: '誰偷吃了我的烤肉？', en: 'Who ate my roast?' },
  ],
  peek: [
    { zh: '嘿嘿……', en: 'Heh heh…' },
    { zh: '被發現了！', en: 'Spotted!' },
    { zh: '我什麼都沒看到！', en: "I didn't see anything!" },
  ],
  troll: [
    { zh: '過橋費！', en: 'Toll, please!' },
    { zh: '這是我的橋！', en: 'My bridge!' },
  ],
  altar: [
    { zh: '……回去吧……', en: '…turn back…' },
    { zh: '……深淵在看著你……', en: '…the abyss is watching…' },
  ],
  sheep: [
    { zh: '咩～', en: 'Baa~' },
    { zh: '咩咩！', en: 'Baa baa!' },
    { zh: '咩……？', en: 'Baa…?' },
  ],
};

/** 從關卡裝飾物推出彩蛋清單（純資料，測試也用） */
export function levelEggs(level: LevelDef): Egg[] {
  const out: Egg[] = [];
  const add = (kind: EggKind, x: number, y: number, r: number, sprite?: string) => out.push({ id: `${level.id}:${out.length}`, kind, x, y, r, sprite });
  const theme = level.theme;
  for (const d of level.decor ?? []) {
    switch (d.kind) {
      case 'house':
        add('knock', d.x, d.y - 24, 46);
        break;
      case 'castle':
        add('castle', d.x, d.y - 30, 56);
        break;
      case 'camp':
        add('camp', d.x, d.y, 50);
        break;
      case 'trees':
        add('birds', d.x, d.y, Math.min(70, d.r * 0.7));
        break;
      case 'rocks':
        // 有落石／雪球機關的石堆留給機關（點擊會被機關吃掉）
        if (!(level.hazards ?? []).some((h) => Math.hypot(h.x - d.x, h.y - d.y) < 90)) add('peek', d.x, d.y, 46, PEEKER[theme]);
        break;
      case 'tower_ruin':
        add('bats', d.x, d.y - 20, 50);
        break;
      case 'altar':
        add('altar', d.x, d.y - 10, 50);
        break;
      case 'bridge':
        add('troll', d.x, d.y, 44, 'mon_troll');
        break;
      case 'river': {
        const p = d.points[Math.floor(d.points.length * 0.7)];
        if (p) add('fish', p.x, p.y, 40);
        break;
      }
      case 'lake':
        if (theme === 'volcano') add('peek', d.x, d.y, Math.min(70, d.rx * 0.7), 'mon_magma_imp');
        else if (theme === 'waste') add('peek', d.x, d.y, Math.min(70, d.rx * 0.7), 'mon_skeleton');
        else add(theme === 'snow' ? 'ice' : 'fish', d.x, d.y, Math.min(80, d.rx * 0.7));
        break;
      default:
        break;
    }
  }
  for (const s of SHEEP[level.id] ?? []) add('sheep', s.x, s.y, 40);
  return out;
}

/** 給圖鑑／成就用：全部彩蛋的數量 */
export function totalEggs(levels: LevelDef[]): number {
  return levels.reduce((n, l) => n + levelEggs(l).length, 0);
}
