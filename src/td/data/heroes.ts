import type { HeroDef } from '../sim/defs';

/** 英雄等級經驗門檻（累積 XP），最高 10 級 */
export const HERO_XP_TABLE = [0, 300, 750, 1350, 2100, 3000, 4100, 5400, 6900, 8600];
export const HERO_MAX_LEVEL = HERO_XP_TABLE.length;

export function heroLevelForXp(xp: number): number {
  let lv = 1;
  for (let i = 0; i < HERO_XP_TABLE.length; i++) if (xp >= HERO_XP_TABLE[i]) lv = i + 1;
  return lv;
}

export const HEROES: Record<string, HeroDef> = {
  arthur: {
    id: 'arthur',
    name: { zh: '亞瑟', en: 'Arthur' },
    title: { zh: '王國騎士', en: 'Knight of the Realm' },
    desc: { zh: '堅毅的劍盾騎士，擅長擋住敵人並激勵友軍。', en: 'Stalwart sword-and-board knight who holds the line and rallies allies.' },
    sprite: 'sp_arthur',
    portrait: 'pt_arthur',
    facesRight: true,
    height: 54,
    hp: 320,
    hpPerLevel: 32,
    armor: 0.35,
    dmg: [11, 17],
    dmgPerLevel: 2.4,
    cd: 1,
    speed: 72,
    regen: 8,
    skills: [
      {
        id: 'bash',
        name: { zh: '盾擊', en: 'Shield Bash' },
        desc: { zh: '以盾猛擊敵人，造成傷害並暈眩。', en: 'Slams an enemy, dealing damage and stunning it.' },
        unlockLevel: 1,
        cd: 7,
      },
      {
        id: 'rally',
        name: { zh: '王者號令', en: 'Royal Rally' },
        desc: { zh: '治療周圍友軍並提升護甲。', en: 'Heals nearby allies and raises their armor.' },
        unlockLevel: 4,
        cd: 22,
      },
      {
        id: 'holyblade',
        name: { zh: '聖劍斬', en: 'Holy Blade' },
        desc: { zh: '揮出聖光劍氣，重創周圍所有敵人。', en: 'A sweeping arc of holy light hits all nearby enemies.' },
        unlockLevel: 7,
        cd: 16,
      },
    ],
  },
  elena: {
    id: 'elena',
    name: { zh: '艾蓮娜', en: 'Elena' },
    title: { zh: '森林遊俠', en: 'Forest Ranger' },
    desc: { zh: '百步穿楊的弓手，能攻擊空中目標。', en: 'Peerless archer who can strike flying foes.' },
    sprite: 'sp_elena',
    portrait: 'pt_elena',
    facesRight: true,
    height: 54,
    hp: 210,
    hpPerLevel: 20,
    armor: 0.1,
    dmg: [10, 16],
    dmgPerLevel: 2,
    cd: 0.9,
    speed: 82,
    regen: 6,
    ranged: { range: 175, kind: 'arrow', dmgKind: 'physical' },
    skills: [
      {
        id: 'multishot',
        name: { zh: '連珠箭', en: 'Multishot' },
        desc: { zh: '同時射出數支箭攻擊不同敵人。', en: 'Shoots several arrows at different enemies.' },
        unlockLevel: 1,
        cd: 7,
      },
      {
        id: 'pierce',
        name: { zh: '穿雲箭', en: 'Piercing Shot' },
        desc: { zh: '無視護甲的強力一箭。', en: 'A mighty shot that ignores armor.' },
        unlockLevel: 4,
        cd: 12,
      },
      {
        id: 'hail',
        name: { zh: '箭雨', en: 'Arrow Storm' },
        desc: { zh: '對一片區域降下箭雨。', en: 'Rains arrows over an area.' },
        unlockLevel: 7,
        cd: 18,
      },
    ],
  },
  lila: {
    id: 'lila',
    name: { zh: '莉拉', en: 'Lila' },
    title: { zh: '冰霜術士', en: 'Frost Sorceress' },
    desc: { zh: '操縱冰霜的法師，能緩速並重創成群敵人。', en: 'Frost mage who slows and shatters crowds.' },
    sprite: 'sp_lila',
    portrait: 'pt_lila',
    facesRight: true,
    height: 56,
    hp: 180,
    hpPerLevel: 18,
    armor: 0,
    dmg: [16, 28],
    dmgPerLevel: 3,
    cd: 1.6,
    speed: 70,
    regen: 6,
    ranged: { range: 160, kind: 'magic', dmgKind: 'magic' },
    unlockAfter: 'l3',
    skills: [
      {
        id: 'frostnova',
        name: { zh: '冰霜新星', en: 'Frost Nova' },
        desc: { zh: '冰凍周圍敵人，造成傷害並大幅緩速。', en: 'Freezes nearby enemies, damaging and slowing them.' },
        unlockLevel: 1,
        cd: 12,
      },
      {
        id: 'icelance',
        name: { zh: '寒冰長槍', en: 'Ice Lance' },
        desc: { zh: '貫穿一條直線上的敵人。', en: 'Impales every enemy in a line.' },
        unlockLevel: 4,
        cd: 14,
      },
      {
        id: 'blizzard',
        name: { zh: '暴風雪', en: 'Blizzard' },
        desc: { zh: '召喚暴風雪持續傷害並冰凍敵人。', en: 'Summons a blizzard that damages and freezes.' },
        unlockLevel: 7,
        cd: 24,
      },
    ],
  },
};

export const HERO_ORDER = ['arthur', 'elena', 'lila'];
