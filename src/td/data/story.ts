import type { L10n } from '../sim/defs';

export interface StoryLine {
  /** 說話者 id（對應立繪 pt_<id>） */
  who: string;
  text: L10n;
}

export const SPEAKERS: Record<string, { name: L10n; enemy?: boolean }> = {
  arthur: { name: { zh: '亞瑟', en: 'Arthur' } },
  sharon: { name: { zh: '夏儂', en: 'Sharon' } },
  elena: { name: { zh: '艾蓮娜', en: 'Elena' } },
  lila: { name: { zh: '莉拉', en: 'Lila' } },
  rain: { name: { zh: '雷恩', en: 'Rain' } },
  aria: { name: { zh: '艾莉雅', en: 'Aria' } },
  gary: { name: { zh: '蓋瑞', en: 'Gary' } },
  viktor: { name: { zh: '維克托', en: 'Viktor' } },
  shadow: { name: { zh: '影', en: 'Shade' } },
  morden: { name: { zh: '莫登', en: 'Morden' }, enemy: true },
  selene: { name: { zh: '瑟琳', en: 'Selene' }, enemy: true },
  carl: { name: { zh: '卡爾', en: 'Carl' }, enemy: true },
  high_priest: { name: { zh: '黑暗主教', en: 'Dark Bishop' }, enemy: true },
  sub_priest: { name: { zh: '凜', en: 'Rin' }, enemy: true },
  cult_leader: { name: { zh: '黯', en: 'Umbra' }, enemy: true },
};

/** 劇情用到、但不是英雄的立繪（BootScene 會另外載入） */
// viktor 也是英雄，立繪由英雄頭像那段產生（同一張圖不能被兩段各載入、各移除一次）
export const STORY_PORTRAITS = ['gary', 'morden', 'selene', 'carl', 'high_priest', 'sub_priest', 'cult_leader'];

/** 每關開場對話（第一次進入戰役時播放） */
export const STORY: Record<string, StoryLine[]> = {
  l1: [
    { who: 'gary', text: { zh: '隊長！北方山脈冒出狼煙，蠻族的先遣隊來了！', en: 'Captain! Smoke over the northern hills. The barbarian vanguard is here!' } },
    { who: 'arthur', text: { zh: '在村口建起防線。只要守住這裡，村民就有時間撤離。', en: 'Build a line at the village gate. Hold here and the villagers can get away.' } },
  ],
  l2: [
    { who: 'elena', text: { zh: '兩支部隊要在渡口會合。我在林中看見雪原狼的足跡，牠們跑得很快。', en: 'Two warbands will meet at the ford. I saw snow wolf tracks in the woods. They are fast.' } },
    { who: 'arthur', text: { zh: '那就讓他們在橋頭撞上我們的箭雨。', en: 'Then let them meet our arrows at the bridge.' } },
  ],
  l3: [
    { who: 'lila', text: { zh: '森林裡有黑暗魔力的波動……是教派的術士，他們在替蠻族治療傷兵。', en: 'Dark magic stirs in the woods. Cult adepts are healing the barbarians.' } },
    { who: 'viktor', text: { zh: '鐵甲槍兵也來了。弓箭奈何不了那身重甲，交給法師塔吧。', en: 'Ironclad lancers too. Arrows will not pierce that plate. Leave them to the mage towers.' } },
  ],
  l4: [
    { who: 'viktor', text: { zh: '北境雪原無險可守，敵人還會從天上來。', en: 'The snowfield has no cover, and they will come from the sky as well.' } },
    { who: 'elena', text: { zh: '獅鷲騎手交給我和弓箭手。巨魔……就靠大家了。', en: 'Leave the griffin riders to my archers. The trolls are on all of us.' } },
  ],
  l5: [
    { who: 'morden', text: { zh: '哈！王國的小騎士，就讓我莫登親自踏平你們的防線！', en: 'Ha! Little knights of the kingdom, I, Morden, will trample your line myself!' } },
    { who: 'arthur', text: { zh: '楓紅隘口就是你的終點。全軍，迎戰！', en: 'Crimson Pass is where you fall. All forces, to arms!' } },
  ],
  l6: [
    { who: 'rain', text: { zh: '莫登倒下了，但蠻族的獅鷲軍團還盤據在山口。', en: 'Morden has fallen, but the griffin legion still holds the pass.' } },
    { who: 'lila', text: { zh: '還有成群的吸血蝙蝠……多蓋幾座法師塔吧。', en: 'And swarms of vampire bats. We will want more mage towers.' } },
  ],
  l7: [
    { who: 'selene', text: { zh: '冰會封住你們的塔，風雪會吞沒你們的兵。這片湖，就是你們的墳場。', en: 'Ice will seal your towers and the blizzard will swallow your soldiers. This lake is your grave.' } },
    { who: 'lila', text: { zh: '她的冰封咒有範圍限制，把塔分散開來！', en: 'Her freezing spell has limited reach. Spread out the towers!' } },
  ],
  l8: [
    { who: 'viktor', text: { zh: '這片沼澤的屍體……又站起來了。是死靈術！', en: 'The dead in this marsh are rising. Necromancy!' } },
    { who: 'arthur', text: { zh: '黑暗教派終於現身了。先除掉死靈術士，別讓他們源源不絕地召喚。', en: 'So the cult shows itself at last. Take out the necromancers before they raise an army.' } },
  ],
  l9: [
    { who: 'carl', text: { zh: '亞瑟，王國早已腐朽。投降吧，教派會給你們更好的未來。', en: 'Arthur, the kingdom is rotten. Surrender. The cult offers a better future.' } },
    { who: 'arthur', text: { zh: '卡爾將軍……你曾是我們的榜樣。今天，我會親手阻止你。', en: 'General Carl, you were once our example. Today I will stop you myself.' } },
  ],
  l10: [
    { who: 'high_priest', text: { zh: '迷途的羔羊們，在主教的聖光下安息吧。', en: 'Lost lambs, rest now beneath the Bishop’s light.' } },
    { who: 'elena', text: { zh: '他會治療所有部下！集中火力，別讓他躲在人群後面。', en: 'He heals all of them! Focus fire and do not let him hide behind the crowd.' } },
  ],
  l11: [
    { who: 'sub_priest', text: { zh: '血月升起之時，儀式便會完成。你們來得太遲了。', en: 'When the blood moon rises, the rite is complete. You are too late.' } },
    { who: 'aria', text: { zh: '她能瞬間移動到防線後方！要層層設防才行。', en: 'She can blink past the front line! We need defense in depth.' } },
  ],
  l12: [
    { who: 'cult_leader', text: { zh: '王國、蠻族、教派……一切都將歸於深淵。', en: 'Kingdom, horde, cult. All will return to the abyss.' } },
    { who: 'arthur', text: { zh: '這是最後一戰。為了王國，為了所有人，守住終焉之門！', en: 'This is the last battle. For the kingdom and for everyone, hold the Gate of the End!' } },
  ],
  l13: [
    { who: 'aria', text: { zh: '我在西方沙海上空看見教派的旗幟……殘黨跟沙漠遊牧民結盟了。', en: 'I saw cult banners over the western sands. The remnants have allied with the desert nomads.' } },
    { who: 'rain', text: { zh: '小心腳下！巨蠍鑽進沙裡時刀槍不入，等牠們冒出來再打。', en: 'Watch the sand! Scorpions are untouchable while burrowed. Strike when they surface.' } },
  ],
  l14: [
    { who: 'lila', text: { zh: '地底傳來的震動越來越強……教派用禁咒喚醒了沙海的遠古巨蟲。', en: 'The tremors are getting stronger. The cult used a forbidden rite to wake the ancient wyrm.' } },
    { who: 'arthur', text: { zh: '牠鑽進沙裡時誰都碰不到。守住每一段路，等牠冒出來就全力攻擊！', en: 'Nothing can touch it underground. Hold every stretch of road and strike hard when it surfaces!' } },
  ],
  l15: [
    { who: 'rain', text: { zh: '教派最後的殘黨逃進了北方冰河……他們在冰層底下喚醒了某個龐然大物。', en: 'The last cultists fled into the northern glacier, and woke something enormous beneath the ice.' } },
    { who: 'elena', text: { zh: '是冰霜巨人！牠一踏地，附近的塔就會被凍住，塔別全擠在一起。冰精靈不怕魔法，交給弓箭手！', en: 'A frost giant! Its stomp freezes nearby towers, so spread them out. Frost sprites shrug off magic. Leave them to the archers!' } },
  ],
  l16: [
    { who: 'sharon', text: { zh: '古籍記載，冰河旁沉睡著一座火山，裡面封著炎魔伊格尼斯……巨人倒下時，封印也跟著碎了。', en: 'The old texts speak of a volcano asleep beside the glacier, with Ignis the Fire Lord sealed inside. When the giant fell, the seal broke with it.' } },
    { who: 'viktor', text: { zh: '熔岩魔像碎了會迸出小魔，塔要多打幾下；炎魔的熔岩噴發會燒停附近的塔，別把塔全蓋在一處！', en: 'Lava golems burst into imps when they break, so keep firing. The Fire Lord’s eruptions scorch nearby towers. Don’t build them all in one spot!' } },
  ],
  l17: [
    { who: 'aria', text: { zh: '深淵之門旁的漁村傳來求救！教派的殘黨在海灣舉行儀式，海面整片都黑了……', en: 'A cry for help from the fishing village by the Abyss Gate! The last cultists held a rite in the cove, and the whole sea has turned black…' } },
    { who: 'sharon', text: { zh: '溺亡者會慢慢自我修復，要集中火力一口氣打倒。礁石巨蟹的殼很硬，交給法師塔。', en: 'The drowned slowly mend themselves, so focus fire and finish them fast. Reef crab shells are tough. Leave them to the mage towers.' } },
    { who: 'viktor', text: { zh: '海裡那個大傢伙會潛進水裡，再冒出來震暈一整片的塔。塔分散蓋，守住兩條路！', en: 'The big one in the water dives under, then surfaces and stuns every tower nearby. Spread your towers and hold both roads!' } },
  ],
};

/** 通關外傳終章（熔岩火山口）後的尾聲 */
export const SIDE_EPILOGUE: StoryLine[] = [
  { who: 'viktor', text: { zh: '火山的怒吼平息了。北境的冰河與火山，總算都安靜下來。', en: 'The volcano’s roar has died down. The glacier and the mountain are finally quiet.' } },
  { who: 'sharon', text: { zh: '我用最古老的聖典文字重新刻下封印，這次誰也打不開了。', en: 'I carved the seal again in the oldest script of the scriptures. No one will open it this time.' } },
  { who: 'elena', text: { zh: '沙海、冰河、火山……我們走了好遠的路。', en: 'The sand sea, the glacier, the volcano… we’ve come a long way.' } },
  { who: 'rain', text: { zh: '該回家了！村子今晚有慶典，聽說蓋瑞準備了烤全羊。', en: 'Time to go home! The village is celebrating tonight, and I hear Gary is roasting a whole sheep.' } },
  { who: 'aria', text: { zh: '下次冒險，我先飛去探路！', en: 'Next adventure, I’ll fly ahead and scout!' } },
  { who: 'shadow', text: { zh: '……一路上替你們清掉落單敵人的，是我。往後我也會在暗處守著王國。', en: '…I was the one picking off your stragglers all along. From now on I’ll guard the kingdom from the shadows.' } },
  { who: 'arthur', text: { zh: '辛苦了，各位。王國的每一寸土地，都留下了我們守護過的足跡。', en: 'Well done, everyone. Every corner of the kingdom bears the footprints of those who defended it.' } },
];

/** 通關番外篇（黑潮海灣）後的尾聲 */
export const EXTRA_EPILOGUE: StoryLine[] = [
  { who: 'aria', text: { zh: '海水變回藍色了！利維坦沉回深海，再也沒有浮上來。', en: 'The sea is blue again! The Leviathan sank back into the deep and never came up.' } },
  { who: 'gary', text: { zh: '漁夫們說要請大家吃一整船的烤魚，今晚不醉不歸！', en: 'The fishermen are treating everyone to a whole boatload of grilled fish. Tonight we feast!' } },
  { who: 'shadow', text: { zh: '教派最後的殘黨，我已經全部送進大牢了。', en: 'I’ve put the very last of the cultists behind bars.' } },
  { who: 'arthur', text: { zh: '從邊境村莊到海灣，王國終於全都安全了。謝謝你，指揮官。', en: 'From the border village to the cove, the whole kingdom is finally safe. Thank you, Commander.' } },
];

/** 通關最終關後的尾聲 */
export const EPILOGUE: StoryLine[] = [
  { who: 'cult_leader', text: { zh: '不可能……深淵之門，竟然被凡人封上了……', en: 'Impossible... the Abyss Gate, sealed by mere mortals...' } },
  { who: 'arthur', text: { zh: '門已經關上了。黑暗教派的陰謀，到此為止。', en: 'The gate is shut. The cult’s scheme ends here.' } },
  { who: 'elena', text: { zh: '北方的蠻族也撤回山裡了。這一次，是真正的和平。', en: 'The northern clans have gone back to the hills. This time the peace is real.' } },
  { who: 'lila', text: { zh: '王都的法師們正在淨化荒原，花草很快就會長回來的。', en: 'The royal mages are cleansing the wastes. The flowers will grow back soon.' } },
  { who: 'rain', text: { zh: '卡爾將軍最後說了聲「謝謝」。也許，他一直在等人阻止他。', en: 'General Carl said “thank you” at the end. Maybe he was waiting for someone to stop him.' } },
  { who: 'aria', text: { zh: '我飛遍了整個王國，每個村莊都在慶祝！', en: 'I flew over the whole kingdom. Every village is celebrating!' } },
  { who: 'gary', text: { zh: '村民說要在村口立一座紀念碑，就立在我們蓋第一座箭塔的地方！', en: 'The villagers want a monument at the gate, right where we built our first archer tower!' } },
  { who: 'arthur', text: { zh: '那就回家吧。為了守護這片土地的每一個人，乾杯！', en: 'Then let us go home. To everyone who held this land together. Cheers!' } },
];

export type EpilogueId = 'main' | 'side' | 'extra';

export const EPILOGUES: Record<EpilogueId, StoryLine[]> = { main: EPILOGUE, side: SIDE_EPILOGUE, extra: EXTRA_EPILOGUE };
