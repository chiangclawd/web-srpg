import type { LevelDef, WaveDef } from '../../src/td/sim/defs';
import { World, type WorldOptions } from '../../src/td/sim/World';

/** 一條水平直路、路旁 4 個建造點的測試關卡 */
export function testLevel(waves: WaveDef[] = [], extra: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    index: 0,
    name: { zh: '測試', en: 'Test' },
    desc: { zh: '', en: '' },
    theme: 'grass',
    paths: [
      [
        { x: -40, y: 360 },
        { x: 1320, y: 360 },
      ],
    ],
    spots: [
      { x: 300, y: 280 },
      { x: 500, y: 440 },
      { x: 700, y: 280 },
      { x: 900, y: 440 },
    ],
    startGold: 1000,
    lives: 20,
    waves,
    heroStart: { x: 600, y: 360 },
    mapPos: { x: 0, y: 0 },
    seed: 1,
    ...extra,
  };
}

export function mkWorld(level: LevelDef = testLevel(), opts: Partial<WorldOptions> = {}): World {
  return new World({ level, hero: null, ...opts });
}

/** 推進模擬 sec 秒（固定步長 1/60） */
export function run(w: World, sec: number): void {
  for (let i = 0; i < Math.round(sec * 60) && !w.result; i++) w.step(1 / 60);
}
