import type { L10n, LevelMode } from '../sim/defs';

export type ItemId = 'keg' | 'frost' | 'potion' | 'gold';

export interface ItemDef {
  id: ItemId;
  name: L10n;
  desc: L10n;
  icon: string;
  /** 寶石價格 */
  price: number;
  /** 需要點選地面施放 */
  targeted: boolean;
}

export const ITEM_ORDER: ItemId[] = ['keg', 'frost', 'potion', 'gold'];

/** 道具數值 */
export const KEG = { dmg: 320, r: 95, stun: 1.2 };
export const FROST_SEC = 4;
export const POTION_LIVES = 5;
export const GOLD_SACK = 200;

export const ITEMS: Record<ItemId, ItemDef> = {
  keg: {
    id: 'keg',
    name: { zh: '炸藥桶', en: 'Powder Keg' },
    desc: { zh: `點選地面引爆：範圍內地面敵人受到 ${KEG.dmg} 點真實傷害並暈眩`, en: `Tap the ground: ${KEG.dmg} true damage to ground enemies nearby, plus a stun` },
    icon: 'it_keg',
    price: 60,
    targeted: true,
  },
  frost: {
    id: 'frost',
    name: { zh: '冰霜水晶', en: 'Frost Crystal' },
    desc: { zh: `冰凍全場敵人 ${FROST_SEC} 秒（首領較短）`, en: `Freezes every enemy for ${FROST_SEC}s (shorter on bosses)` },
    icon: 'it_frost',
    price: 80,
    targeted: false,
  },
  potion: {
    id: 'potion',
    name: { zh: '生命藥水', en: 'Heart Potion' },
    desc: { zh: `恢復 ${POTION_LIVES} 條生命（不超過上限）`, en: `Restores ${POTION_LIVES} lives (up to the maximum)` },
    icon: 'it_potion',
    price: 50,
    targeted: false,
  },
  gold: {
    id: 'gold',
    name: { zh: '金幣袋', en: 'Gold Sack' },
    desc: { zh: `立即獲得 ${GOLD_SACK} 金幣`, en: `Gain ${GOLD_SACK} gold instantly` },
    icon: 'it_gold',
    price: 40,
    targeted: false,
  },
};

/** 一場結束獲得的寶石（不含成就獎勵） */
export function gemReward(mode: LevelMode, victory: boolean, stars: number, firstClear: boolean, wave: number): number {
  if (mode === 'endless') return Math.floor(wave / 2);
  if (!victory) return 0;
  // 每日挑戰：當天第一次過關給較多寶石
  if (mode === 'daily') return firstClear ? 15 + stars * 3 : 0;
  if (mode === 'campaign') return 4 + stars * 3 + (firstClear ? 10 : 0);
  return firstClear ? 30 : 8;
}

/** 每個新解鎖成就的寶石獎勵 */
export const GEMS_PER_ACHIEVEMENT = 10;
