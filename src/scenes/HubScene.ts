import Phaser from 'phaser';
import { CHAPTERS } from '../data/chapters';
import { COMMANDERS, RECRUIT_AT_CHAPTER } from '../data/commanders';
import { UNIT_TYPES } from '../data/unitTypes';
import { EQUIPMENT, getEquippableFor, unlockChapterFor } from '../data/equipment';
import {
  getCommanderProgress,
  setCommanderEquipment,
  getExcludedCommanders,
  toggleCommanderDeploy,
} from '../data/save';
import type { CommanderDef, EquipmentDef } from '../types';
import { audio } from '../utils/audio';
import { tryUnlockAchievement } from '../utils/achievementToast';
import { addHitRect } from '../utils/uiHit';
import { t, tn } from '../utils/i18n';
import { getThemeColors } from '../utils/settings';
import { getPortraitKey } from '../data/assetManifest';

export interface HubSceneData {
  chapterId: string;
}

/** 把裝備數值轉為人類可讀字串（含命中／爆擊加成）*/
function formatStats(kind: 'weapon' | 'armor', item: EquipmentDef): string {
  const parts: string[] = [];
  if (kind === 'weapon') {
    parts.push(`+${item.atk} 攻`);
    if (item.def) parts.push(`+${item.def} 防`);
    if (item.hitBonus) parts.push(`+${item.hitBonus}% 命中`);
    if (item.critBonus) parts.push(`+${item.critBonus}% 爆`);
  } else {
    if (item.def) parts.push(`+${item.def} 防`);
    if (item.hpBonus) parts.push(`+${item.hpBonus} HP`);
    if (item.critBonus) parts.push(`+${item.critBonus}% 爆`);
  }
  return parts.join(' ');
}

export class HubScene extends Phaser.Scene {
  private chapterId = '';
  private playerCommanders: CommanderDef[] = [];
  private selectedIdx = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private equipPicker: Phaser.GameObjects.Container | null = null;
  /** 卡片捲動時設為 true，讓卡片 click handler 知道剛才是 drag 不是 tap */
  private cardsDidDrag = false;

  constructor() {
    super({ key: 'HubScene' });
  }

  init(data: HubSceneData): void {
    this.chapterId = data.chapterId;
    const ch = CHAPTERS[data.chapterId];
    const chapterNumber = ch?.number ?? 1;
    this.playerCommanders = Object.values(COMMANDERS)
      .filter((c) => c.faction === 'player')
      .filter((c) => (RECRUIT_AT_CHAPTER[c.id] ?? 1) <= chapterNumber);
    this.selectedIdx = 0;
    this.cards = [];
    this.equipPicker = null;
  }

  create(): void {
    const ch = CHAPTERS[this.chapterId];
    if (!ch) {
      this.scene.start('TitleScene');
      return;
    }

    // Hub BGM（peaceful，與 Title 同 mood 不會重啟）
    audio.startBgm('peaceful');

    // 成就：五人成軍（招募所有 5 位）
    if (this.playerCommanders.length >= 5) {
      tryUnlockAchievement(this, 'all_recruited');
    }

    const { width, height } = this.scale;
    const theme = getThemeColors();
    this.add.rectangle(0, 0, width, height, theme.panelBg).setOrigin(0);

    const chTitle = tn(`chapter.${ch.id}.title`, ch.title);
    this.add
      .text(width / 2, 32, t('hub.chapterTitle', { n: ch.number, title: chTitle }), {
        fontSize: '36px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 74, '出陣前確認 · 點擊武將檢視詳細資訊 · 可換裝', {
        fontSize: '22px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // 卡片 grid：每排最多 3 張，超過自動換行（避免 5 張單排在 iPhone 橫屏被切掉）
    const cardW = 220;
    const cardH = 220;
    const cardGap = 18;
    const cardsX0 = 30;
    const cardsY0 = 110;
    const maxPerRow = 3;
    // 卡片包進 cardsContainer（之後好做 mask + 垂直捲動）
    const cardsContainer = this.add.container(0, 0);
    cardsContainer.setDepth(2);
    this.playerCommanders.forEach((cmd, idx) => {
      const row = Math.floor(idx / maxPerRow);
      const col = idx % maxPerRow;
      const x = cardsX0 + col * (cardW + cardGap);
      const y = cardsY0 + row * (cardH + cardGap);
      const card = this.makeCommanderCard(cmd, x, y, cardW, cardH, idx);
      cardsContainer.add(card); // 從 scene root 移到 cardsContainer 下
      this.cards.push(card);
    });

    // 武將資訊欄：放在卡片區右側，避開卡片寬度後始終貼齊
    const infoX = cardsX0 + maxPerRow * (cardW + cardGap) + 8;
    this.add.text(infoX, cardsY0, '武將資訊', {
      fontSize: '32px',
      color: '#7ed1ff',
      fontStyle: 'bold',
    });
    this.infoText = this.add.text(infoX, cardsY0 + 50, '', {
      fontSize: '24px',
      color: '#dddddd',
      lineSpacing: 8,
      wordWrap: { width: width - infoX - 20 },
    });

    // 出陣 + 換裝按鈕都放在右側欄底部，避免和 infoText 的「成長率」這幾行打架
    const sortieH = 80;
    const sortieY = height - sortieH - 24;
    const swapY = sortieY - 56;
    this.makeInlineButton(infoX, swapY, '▸ 換武器', '#ffaa66', () => {
      const cmd = this.playerCommanders[this.selectedIdx];
      if (cmd) this.openEquipPicker('weapon', cmd.id);
    });
    this.makeInlineButton(infoX + 200, swapY, '▸ 換防具', '#88ccff', () => {
      const cmd = this.playerCommanders[this.selectedIdx];
      if (cmd) this.openEquipPicker('armor', cmd.id);
    });

    const sortieW = Math.min(420, width - infoX - 30);
    this.makeButton(infoX, sortieY, sortieW, sortieH, '▶ 出陣', 0xe24a4a, '36px', () => {
      this.scene.start('BattleScene', { chapterId: this.chapterId });
    });
    this.makeButton(20, 16, 140, 44, '◀ 回標題', 0x444444, '22px', () => {
      this.scene.start('TitleScene');
    });

    // === 卡片區垂直捲動 ===
    // 設計：以 swapY 上方留 12px 為視覺底界，超過視窗就 mask + 拖曳
    const rows = Math.ceil(this.playerCommanders.length / maxPerRow);
    const totalCardsH = rows * (cardH + cardGap) - cardGap;
    const cardsViewportTop = cardsY0;
    const cardsViewportH = swapY - cardsY0 - 12;
    const cardsViewportRight = infoX - 12; // 不要蓋到右側 info / 出陣按鈕
    const maxScroll = Math.max(0, totalCardsH - cardsViewportH);

    if (maxScroll > 0) {
      // Geometry mask — 只顯示卡片視窗範圍內的內容
      const m = this.make.graphics({ x: 0, y: 0 }, false);
      m.fillStyle(0xffffff);
      m.fillRect(0, cardsViewportTop - 6, cardsViewportRight, cardsViewportH + 12);
      cardsContainer.setMask(m.createGeometryMask());

      // 拖曳捲動
      let scrollY = 0;
      let dragActive = false;
      let dragStartScroll = 0;
      let dragStartPointerY = 0;
      const inCardsRegion = (p: Phaser.Input.Pointer): boolean =>
        p.x <= cardsViewportRight &&
        p.y >= cardsViewportTop - 6 &&
        p.y <= cardsViewportTop + cardsViewportH + 6;

      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!inCardsRegion(p)) return;
        dragActive = true;
        dragStartScroll = scrollY;
        dragStartPointerY = p.y;
        this.cardsDidDrag = false;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!dragActive || !p.isDown) return;
        const dy = p.y - dragStartPointerY;
        if (Math.abs(dy) > 8) this.cardsDidDrag = true;
        scrollY = Phaser.Math.Clamp(dragStartScroll + dy, -maxScroll, 0);
        cardsContainer.y = scrollY;
      });
      this.input.on('pointerup', () => {
        dragActive = false;
        // 不立刻清 cardsDidDrag — 讓 cardHit pointerup 能讀到，下一次 pointerdown 才重置
      });

      // 滑鼠滾輪（桌機）
      this.input.on(
        'wheel',
        (p: Phaser.Input.Pointer, _objs: unknown[], _dx: number, dy: number) => {
          if (!inCardsRegion(p)) return;
          scrollY = Phaser.Math.Clamp(scrollY - dy * 0.5, -maxScroll, 0);
          cardsContainer.y = scrollY;
        }
      );

      // 右側捲軸提示（細長軌道 + 把手）
      const trackX = cardsViewportRight - 6;
      const track = this.add.rectangle(
        trackX,
        cardsViewportTop,
        4,
        cardsViewportH,
        0x444444,
        0.4
      );
      track.setOrigin(0, 0);
      track.setDepth(3);
      const thumbH = Math.max(40, cardsViewportH * (cardsViewportH / totalCardsH));
      const thumb = this.add.rectangle(trackX, cardsViewportTop, 4, thumbH, 0x7ed1ff, 0.8);
      thumb.setOrigin(0, 0);
      thumb.setDepth(3);
      // 把手位置隨 scrollY 移動
      this.events.on('postupdate', () => {
        const ratio = maxScroll > 0 ? -scrollY / maxScroll : 0;
        thumb.y = cardsViewportTop + ratio * (cardsViewportH - thumbH);
      });
    }

    this.selectCommander(0);
  }

  private makeCommanderCard(
    cmd: CommanderDef,
    x: number,
    y: number,
    w: number,
    h: number,
    idx: number
  ): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, w, h, 0x2a2a2a);
    bg.setStrokeStyle(2, 0x444444);

    const utype = UNIT_TYPES[cmd.unitType];

    // 立繪：有圖用圖、無圖用色塊 + 名字
    const portraitKey = getPortraitKey(cmd.id);
    const hasPortrait = this.textures.exists(portraitKey);
    let portrait: Phaser.GameObjects.GameObject;
    if (hasPortrait) {
      const img = this.add.image(0, -48, portraitKey);
      img.setDisplaySize(80, 80);
      portrait = img;
    } else {
      const r = this.add.rectangle(0, -48, 80, 80, 0x4a90e2);
      r.setStrokeStyle(2, 0x000000);
      portrait = r;
    }
    const dispName = tn(`commander.${cmd.id}.name`, cmd.name);
    const nameY = hasPortrait ? 6 : -48;
    const portraitName = this.add.text(0, nameY, dispName, {
      fontSize: hasPortrait ? '26px' : '40px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    portraitName.setOrigin(0.5);

    const badgeBg = this.add.circle(48, -86, 20, utype.color);
    badgeBg.setStrokeStyle(2, 0x000000);
    const badgeText = this.add.text(48, -87, utype.shortName, {
      fontSize: '22px',
      color: '#000000',
      fontStyle: 'bold',
    });
    badgeText.setOrigin(0.5);

    const lvBg = this.add.circle(-48, -86, 20, 0x222222);
    lvBg.setStrokeStyle(2, 0xffffff);
    const lvText = this.add.text(-48, -87, String(cmd.startingLevel), {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    lvText.setOrigin(0.5);

    const subtitle = this.add.text(0, 38, utype.name, {
      fontSize: '22px',
      color: '#aaaaaa',
    });
    subtitle.setOrigin(0.5);

    const skill = this.add.text(0, 66, `特技：${cmd.skill.name}`, {
      fontSize: '20px',
      color: '#7ed1ff',
    });
    skill.setOrigin(0.5);

    // 出陣 / 候補 切換按鈕
    const excluded = getExcludedCommanders();
    const isDeployed = !excluded.has(cmd.id);
    const deployTxt = this.add.text(
      0,
      h / 2 - 24,
      isDeployed ? '✓ 出陣中' : '✗ 候補',
      {
        fontSize: '24px',
        color: isDeployed ? '#7ed17e' : '#aa6666',
        fontStyle: 'bold',
      }
    );
    deployTxt.setOrigin(0.5);
    deployTxt.setName('deployTxt');

    // 透明 hit areas（卡片本體 + 出陣切換）
    const cardHit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    cardHit.setInteractive({ useHandCursor: true });
    const toggleHit = this.add.rectangle(0, h / 2 - 24, 150, 36, 0x000000, 0);
    toggleHit.setInteractive({ useHandCursor: true });

    // toggleHit 在 cardHit 之上 → 點擊出陣按鈕優先
    const card = this.add.container(x + w / 2, y + h / 2, [
      bg, portrait, portraitName, badgeBg, badgeText, lvBg, lvText, subtitle, skill,
      cardHit, deployTxt, toggleHit,
    ]);
    card.setSize(w, h);

    cardHit.on('pointerover', () => bg.setStrokeStyle(2, 0x7ed1ff));
    cardHit.on('pointerout', () => {
      bg.setStrokeStyle(this.selectedIdx === idx ? 3 : 2, this.selectedIdx === idx ? 0xffd700 : 0x444444);
    });
    // 改用 pointerup + cardsDidDrag 檢查，讓垂直拖曳捲動時不會誤觸卡片選取
    cardHit.on('pointerup', () => {
      if (this.cardsDidDrag) return;
      this.selectCommander(idx);
    });

    toggleHit.on('pointerup', () => {
      if (this.cardsDidDrag) return;
      const nowDeployed = toggleCommanderDeploy(cmd.id);
      deployTxt.setText(nowDeployed ? '✓ 出陣中' : '✗ 候補');
      deployTxt.setColor(nowDeployed ? '#7ed17e' : '#aa6666');
    });

    return card;
  }

  private getCurrentEquipment(cmd: CommanderDef): {
    weapon: EquipmentDef | null;
    armor: EquipmentDef | null;
  } {
    const progress = getCommanderProgress(cmd.id);
    let weaponId: string | null = cmd.startingEquipment.weapon ?? null;
    let armorId: string | null = cmd.startingEquipment.armor ?? null;
    if (progress?.weaponId !== undefined) weaponId = progress.weaponId;
    if (progress?.armorId !== undefined) armorId = progress.armorId;
    return {
      weapon: weaponId ? EQUIPMENT[weaponId] ?? null : null,
      armor: armorId ? EQUIPMENT[armorId] ?? null : null,
    };
  }

  private selectCommander(idx: number): void {
    this.selectedIdx = idx;
    const cmd = this.playerCommanders[idx];
    if (!cmd) return;

    this.cards.forEach((card, i) => {
      const bg = card.list[0] as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(i === idx ? 3 : 2, i === idx ? 0xffd700 : 0x444444);
    });

    const utype = UNIT_TYPES[cmd.unitType];
    const lvBonus = cmd.startingLevel - 1;
    const baseHp = utype.baseStats.hp + cmd.statBonus.hp + cmd.growthRates.hp * lvBonus;
    const baseAtk = utype.baseStats.attack + cmd.statBonus.attack + cmd.growthRates.attack * lvBonus;
    const baseDef = utype.baseStats.defense + cmd.statBonus.defense + cmd.growthRates.defense * lvBonus;
    const { weapon, armor } = this.getCurrentEquipment(cmd);
    const finalHp = baseHp + (armor?.hpBonus ?? 0);
    const finalAtk = baseAtk + (weapon?.atk ?? 0);
    const finalDef = baseDef + (armor?.def ?? 0);

    const lines = [
      `${cmd.name}　${utype.name}　LV ${cmd.startingLevel}`,
      ``,
      `HP ${finalHp}　攻 ${finalAtk}　防 ${finalDef}`,
      `移動 ${utype.moveRange}　射程 ${utype.attackRange}`,
      ``,
      `武器：${weapon?.name ?? '無'}${weapon ? `（+${weapon.atk} 攻）` : ''}`,
      `防具：${armor?.name ?? '無'}${armor ? `（+${armor.def} 防 +${armor.hpBonus} HP）` : ''}`,
      ``,
      `特技：${cmd.skill.name}`,
      `　${cmd.skill.desc}`,
      ``,
      `成長率：HP+${cmd.growthRates.hp}　攻+${cmd.growthRates.attack}　防+${cmd.growthRates.defense}`,
    ];
    this.infoText.setText(lines.join('\n'));
  }

  // ===== 換裝 picker =====
  private openEquipPicker(kind: 'weapon' | 'armor', cmdId: string): void {
    this.closeEquipPicker();
    const cmd = COMMANDERS[cmdId];
    if (!cmd) return;
    const cmdLevel = getCommanderProgress(cmdId)?.level ?? cmd.startingLevel;

    const { width, height } = this.scale;
    const items: Phaser.GameObjects.GameObject[] = [];

    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.88);
    bg.setInteractive();
    items.push(bg);

    const title = this.add
      .text(
        width / 2,
        60,
        `${kind === 'weapon' ? '— 選擇武器 —' : '— 選擇防具 —'}\n${cmd.name}（${cmd.unitType}）LV ${cmdLevel}`,
        {
          fontSize: '32px',
          color: '#7ed1ff',
          fontStyle: 'bold',
          align: 'center',
        }
      )
      .setOrigin(0.5);
    items.push(title);

    // 此兵種專屬可選裝備（已過 level + 章節）
    const currentChapterNumber = CHAPTERS[this.chapterId]?.number ?? 1;
    const equippable = getEquippableFor(cmd.unitType, cmdLevel, kind, currentChapterNumber);
    // 還沒解鎖（兵種對但 level / 章節有一項未到）→ 顯示灰色「Lv X / Ch Y 解鎖」提示
    const locked = Object.values(EQUIPMENT).filter((e) => {
      if (e.kind !== kind) return false;
      if (!e.unitTypes || !e.unitTypes.includes(cmd.unitType)) return false;
      const lvBlocked = (e.requiredLevel ?? 0) > cmdLevel;
      const chBlocked = unlockChapterFor(e) > currentChapterNumber;
      return lvBlocked || chBlocked;
    });

    let itemY = 140;
    items.push(
      this.makePickerItem(width / 2, itemY, '【無 — 卸下裝備】', '#aaaaaa', () => {
        this.equipItem(cmdId, kind, null);
      })
    );
    itemY += 46;

    if (equippable.length === 0 && locked.length === 0) {
      const t = this.add
        .text(width / 2, itemY, `（${cmd.unitType} 沒有可用的此類裝備）`, {
          fontSize: '22px',
          color: '#888888',
        })
        .setOrigin(0.5);
      items.push(t);
      itemY += 44;
    }

    for (const item of equippable) {
      const stats = formatStats(kind, item);
      const label = `${item.name}（${stats}）`;
      items.push(
        this.makePickerItem(width / 2, itemY, label, '#ffffff', () => {
          this.equipItem(cmdId, kind, item.id);
        })
      );
      itemY += 44;
    }

    if (locked.length > 0) {
      itemY += 12;
      const sep = this.add
        .text(width / 2, itemY, '— 尚未解鎖 —', {
          fontSize: '20px',
          color: '#666666',
        })
        .setOrigin(0.5);
      items.push(sep);
      itemY += 36;

      for (const item of locked) {
        const stats = formatStats(kind, item);
        // 顯示哪一個門檻沒過：lv / 章節，兩個都沒過時兩個都標
        const reasons: string[] = [];
        if ((item.requiredLevel ?? 0) > cmdLevel) reasons.push(`LV ${item.requiredLevel}`);
        if (unlockChapterFor(item) > currentChapterNumber) {
          reasons.push(`第 ${unlockChapterFor(item)} 章`);
        }
        const label = `🔒 ${item.name}（${stats}）　${reasons.join(' / ')} 解鎖`;
        const lockTxt = this.add
          .text(width / 2, itemY, label, {
            fontSize: '22px',
            color: '#666666',
          })
          .setOrigin(0.5);
        items.push(lockTxt);
        itemY += 40;
      }
    }

    items.push(
      this.makePickerItem(width / 2, itemY + 30, '✕ 取消', '#cc7777', () => this.closeEquipPicker())
    );

    this.equipPicker = this.add.container(0, 0, items);
    this.equipPicker.setDepth(150);
  }

  private equipItem(
    cmdId: string,
    kind: 'weapon' | 'armor',
    itemId: string | null
  ): void {
    const cmd = COMMANDERS[cmdId];
    if (!cmd) return;
    const { weapon, armor } = this.getCurrentEquipment(cmd);
    const newWeapon = kind === 'weapon' ? itemId : weapon?.id ?? null;
    const newArmor = kind === 'armor' ? itemId : armor?.id ?? null;
    setCommanderEquipment(cmdId, newWeapon, newArmor);
    this.closeEquipPicker();
    this.selectCommander(this.selectedIdx);
  }

  private closeEquipPicker(): void {
    this.equipPicker?.destroy();
    this.equipPicker = null;
  }

  private makePickerItem(
    x: number,
    y: number,
    label: string,
    color: string,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const txt = this.add.text(x, y, label, {
      fontSize: '24px',
      color,
      fontStyle: 'bold',
    });
    txt.setOrigin(0.5);
    const w = Math.max(txt.width + 40, 280);
    const h = txt.height + 16;
    const hit = addHitRect(
      this,
      x,
      y,
      w,
      h,
      onClick,
      () => txt.setColor('#ffd700'),
      () => txt.setColor(color)
    );
    hit.setDepth(151); // above picker overlay
    if (this.equipPicker) this.equipPicker.add(hit);
    return txt;
  }

  private makeInlineButton(
    x: number,
    y: number,
    label: string,
    color: string,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const txt = this.add.text(x, y, label, {
      fontSize: '26px',
      color,
      fontStyle: 'bold',
    });
    const w = Math.max(txt.width + 24, 140);
    const h = txt.height + 16;
    addHitRect(
      this,
      x + txt.width / 2,
      y + txt.height / 2,
      w,
      h,
      onClick,
      () => txt.setColor('#ffffff'),
      () => txt.setColor(color)
    );
    return txt;
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    fontSize: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, w, h, color);
    bg.setStrokeStyle(2, 0x000000);
    const txt = this.add.text(0, 0, label, {
      fontSize,
      color: '#ffffff',
      fontStyle: 'bold',
    });
    txt.setOrigin(0.5);
    // 透明 hit area child
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    const c = this.add.container(x + w / 2, y + h / 2, [bg, txt, hit]);
    c.setSize(w, h);
    hit.on('pointerover', () => bg.setFillStyle(this.tint(color, 1.2)));
    hit.on('pointerout', () => bg.setFillStyle(color));
    hit.on('pointerdown', onClick);
    return c;
  }

  private tint(color: number, factor: number): number {
    const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.floor((color & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
  }
}
