import type { L10n } from '../sim/defs';

/**
 * 第 4 級特化塔技能的每級數值。模擬（World）和介面說明共用同一份公式，
 * 調整平衡時改這裡，技能選單裡的「1 / 2 / 3 級效果」會跟著更新。
 */
export const SKILL_FX = {
  /** 毒箭：命中附加毒傷（每秒、秒數） */
  poison: (lv: number) => ({ dps: 4 + 5 * lv, dur: 3 }),
  /** 荊棘纏繞：束縛數量、秒數、傷害、冷卻 */
  thorns: (lv: number) => ({ targets: 2 + lv, root: 1 + 0.7 * lv, dmg: 10 * lv, cd: 11 }),
  /** 狙殺：傷害、秒殺機率、冷卻 */
  snipe: (lv: number) => ({ dmg: 150 + 110 * lv, kill: 0.1 + 0.08 * lv, cd: 16 - 2 * lv }),
  /** 散射：箭數、冷卻 */
  scatter: (lv: number) => ({ arrows: 3 + 2 * lv, cd: 9 }),
  /** 聖光治療：回復最大生命比例、冷卻（血量低於一半才觸發） */
  healing: (lv: number) => ({ heal: 0.2 + 0.15 * lv, cd: 10 }),
  /** 聖擊：機率、範圍魔法傷害 */
  holystrike: (lv: number) => ({ chance: 0.2, dmg: 15 + 20 * lv }),
  /** 旋風斬：機率、周圍傷害 */
  whirlwind: (lv: number) => ({ chance: 0.3, dmg: 12 + 12 * lv }),
  /** 飛斧：傷害範圍、射程 */
  axes: (lv: number) => ({ dmg: [10 + 10 * lv, 18 + 14 * lv] as [number, number], range: 130 }),
  /** 分解：冷卻（只對血量 100 以上的非首領敵人） */
  disintegrate: (lv: number) => ({ cd: 24 - 4 * lv }),
  /** 傳送：人數、往回送的距離、冷卻 */
  teleport: (lv: number) => ({ targets: 3 + lv, back: 70 + 35 * lv, cd: 15 - lv }),
  /** 土元素：生命、攻擊 */
  golem: (lv: number) => ({ hp: 250 + 150 * lv, dmg: [8 + 8 * lv, 16 + 10 * lv] as [number, number] }),
  /** 變羊術：冷卻 */
  polymorph: (lv: number) => ({ cd: 20 - 3 * lv }),
  /** 超載：閃電跳躍次數（沒學是 3 次） */
  supercharge: (lv: number) => ({ jumps: 3 + 2 * lv }),
  /** 過載放電：每次攻擊對周圍的魔法傷害 */
  overcharge: (lv: number) => ({ dmg: 8 + 10 * lv }),
  /** 子母彈：彈數、冷卻 */
  cluster: (lv: number) => ({ bombs: 3 + 2 * lv, cd: 12 }),
  /** 追蹤飛彈：傷害、冷卻 */
  missile: (lv: number) => ({ dmg: 120 + 100 * lv, cd: 11 - lv }),
};

export type SkillId = keyof typeof SKILL_FX;

const pct = (x: number): number => Math.round(x * 100);
const sec = (x: number): string => String(Math.round(x * 10) / 10);

/** 某技能在第 lv 級的效果（一句話） */
export function skillLevelText(id: string, lv: number): L10n {
  const k = id as SkillId;
  switch (k) {
    case 'poison': {
      const f = SKILL_FX.poison(lv);
      return { zh: `每秒 ${f.dps} 點毒傷，持續 ${f.dur} 秒`, en: `${f.dps} poison dmg/s for ${f.dur}s` };
    }
    case 'thorns': {
      const f = SKILL_FX.thorns(lv);
      return { zh: `每 ${f.cd} 秒束縛 ${f.targets} 個敵人 ${sec(f.root)} 秒，${f.dmg} 傷害`, en: `Every ${f.cd}s roots ${f.targets} foes for ${sec(f.root)}s, ${f.dmg} dmg` };
    }
    case 'snipe': {
      const f = SKILL_FX.snipe(lv);
      return { zh: `每 ${f.cd} 秒 ${f.dmg} 傷害，${pct(f.kill)}% 機率秒殺`, en: `Every ${f.cd}s: ${f.dmg} dmg, ${pct(f.kill)}% instant kill` };
    }
    case 'scatter': {
      const f = SKILL_FX.scatter(lv);
      return { zh: `每 ${f.cd} 秒射出 ${f.arrows} 支箭`, en: `Every ${f.cd}s fires ${f.arrows} bolts` };
    }
    case 'healing': {
      const f = SKILL_FX.healing(lv);
      return { zh: `血量低於一半時回復 ${pct(f.heal)}% 生命（每 ${f.cd} 秒）`, en: `Below half HP heals ${pct(f.heal)}% (every ${f.cd}s)` };
    }
    case 'holystrike': {
      const f = SKILL_FX.holystrike(lv);
      return { zh: `${pct(f.chance)}% 機率造成範圍 ${f.dmg} 魔法傷害`, en: `${pct(f.chance)}% chance: ${f.dmg} area magic dmg` };
    }
    case 'whirlwind': {
      const f = SKILL_FX.whirlwind(lv);
      return { zh: `${pct(f.chance)}% 機率對周圍造成 ${f.dmg} 傷害`, en: `${pct(f.chance)}% chance: ${f.dmg} dmg to all around` };
    }
    case 'axes': {
      const f = SKILL_FX.axes(lv);
      return { zh: `擲出 ${f.dmg[0]}~${f.dmg[1]} 傷害的飛斧（射程 ${f.range}）`, en: `Throws axes for ${f.dmg[0]}-${f.dmg[1]} dmg (range ${f.range})` };
    }
    case 'disintegrate': {
      const f = SKILL_FX.disintegrate(lv);
      return { zh: `每 ${f.cd} 秒分解一個非首領敵人`, en: `Every ${f.cd}s erases one non-boss foe` };
    }
    case 'teleport': {
      const f = SKILL_FX.teleport(lv);
      return { zh: `每 ${f.cd} 秒把最多 ${f.targets} 個敵人送回 ${f.back} 步`, en: `Every ${f.cd}s sends up to ${f.targets} foes ${f.back} steps back` };
    }
    case 'golem': {
      const f = SKILL_FX.golem(lv);
      return { zh: `土元素：生命 ${f.hp}，攻擊 ${f.dmg[0]}~${f.dmg[1]}`, en: `Earth golem: ${f.hp} HP, ${f.dmg[0]}-${f.dmg[1]} dmg` };
    }
    case 'polymorph': {
      const f = SKILL_FX.polymorph(lv);
      return { zh: `每 ${f.cd} 秒把一個敵人變成羊`, en: `Every ${f.cd}s turns a foe into a sheep` };
    }
    case 'supercharge': {
      const f = SKILL_FX.supercharge(lv);
      return { zh: `閃電跳躍 ${f.jumps} 次（原本 3 次）`, en: `Lightning jumps ${f.jumps} times (base 3)` };
    }
    case 'overcharge': {
      const f = SKILL_FX.overcharge(lv);
      return { zh: `每次放電對周圍造成 ${f.dmg} 魔法傷害`, en: `Each zap deals ${f.dmg} magic dmg around the tower` };
    }
    case 'cluster': {
      const f = SKILL_FX.cluster(lv);
      return { zh: `每 ${f.cd} 秒灑下 ${f.bombs} 顆子母彈`, en: `Every ${f.cd}s drops ${f.bombs} bomblets` };
    }
    case 'missile': {
      const f = SKILL_FX.missile(lv);
      return { zh: `每 ${f.cd} 秒發射 ${f.dmg} 傷害的飛彈`, en: `Every ${f.cd}s fires a ${f.dmg}-dmg missile` };
    }
    default:
      return { zh: '', en: '' };
  }
}
