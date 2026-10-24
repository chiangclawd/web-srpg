import type { L10n } from '../sim/defs';

export interface StoryLine {
  /** 說話者 id（對應立繪 pt_<id>） */
  who: string;
  text: L10n;
}

export const SPEAKERS: Record<string, { name: L10n; enemy?: boolean; portrait?: string }> = {
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
  // 鏡淵篇：深淵之鏡裡的教主倒影（沿用教主立繪）
  echo_umbra: { name: { zh: '鏡中的黯', en: 'Umbra’s Reflection' }, enemy: true, portrait: 'cult_leader' },
};

/** 劇情用到、但不是英雄的立繪（BootScene 會另外載入） */
// viktor 也是英雄，立繪由英雄頭像那段產生（同一張圖不能被兩段各載入、各移除一次）
export const STORY_PORTRAITS = ['gary', 'morden', 'selene', 'carl', 'high_priest', 'sub_priest', 'cult_leader'];

/** 劇情插畫上飄的粒子 */
export type StoryAtmos = 'leaves' | 'snow' | 'blizzard' | 'embers' | 'sand' | 'ghost' | 'motes' | 'dark' | 'petals';

/**
 * 有手繪劇情插畫的段落（assets/story/<id>.webp）：關卡開場與各段尾聲。
 * src：沿用另一段的插畫；flip / grade：左右翻轉、乘色（鏡淵篇把舊場景「照進鏡子裡」）。
 */
export const STORY_ART: Record<string, { atmos?: StoryAtmos; startPan?: number; src?: string; flip?: boolean; grade?: number }> = {
  l1: { atmos: 'motes' },
  l2: { atmos: 'snow' },
  l3: { atmos: 'dark' },
  l4: { atmos: 'snow' },
  l5: { atmos: 'leaves', startPan: 1 },
  l6: { atmos: 'motes' },
  l7: { atmos: 'blizzard', startPan: 1 },
  l8: { atmos: 'ghost' },
  l9: { atmos: 'motes', startPan: 1 },
  l10: { atmos: 'dark', startPan: 1 },
  l11: { atmos: 'embers' },
  l12: { atmos: 'dark', startPan: 1 },
  l13: { atmos: 'sand' },
  l14: { atmos: 'sand' },
  l15: { atmos: 'snow' },
  l16: { atmos: 'embers' },
  l17: { atmos: 'motes' },
  l18: { atmos: 'motes' },
  l19: { atmos: 'ghost' },
  ep_main: { atmos: 'petals' },
  ep_side: { atmos: 'motes' },
  ep_extra: { atmos: 'motes' },
  // 鏡淵篇：舊戰場的插畫翻轉、染紫，像是鏡子裡的倒影
  l20: { atmos: 'dark', src: 'l3', flip: true, grade: 0xc8b8ff },
  l21: { atmos: 'snow', src: 'l15', flip: true, grade: 0xb8b0ff },
  l22: { atmos: 'dark', src: 'l12', flip: true, grade: 0xd0b8ff, startPan: -1 },
  ep_mirror: { atmos: 'petals', src: 'ep_main' },
  // 夜之番外：外傳的插畫染成夜色
  l23: { atmos: 'sand', src: 'l13', grade: 0x8a98d0 },
  l24: { atmos: 'embers', src: 'l16', grade: 0x9a8ab8 },
};

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
  l18: [
    { who: 'gary', text: { zh: '慶典辦得正熱鬧……等等，月亮怎麼變紅了？森林裡有好多發光的眼睛！', en: 'The festival was in full swing… wait, why has the moon turned red? There are glowing eyes all over the woods!' } },
    { who: 'sub_priest', text: { zh: '血月之夜，正是我們的時刻。燈火熄滅之時，就是這座村莊的末日！', en: 'The night of the blood moon is our hour. When the lights go out, this village falls!' } },
    { who: 'shadow', text: { zh: '夜裡塔的視線會變短，只有營火和民房照得到的塔能看得遠。夜行的魔物交給我。', en: 'Towers see less far at night. Only towers lit by campfires and houses keep their full range. Leave the night creatures to me.' } },
    { who: 'sharon', text: { zh: '小心提燈的怨靈，躲在黑暗裡的牠只會受到一半傷害。塔身邊和英雄身上都有光，讓牠飛進光裡再打！', en: 'Watch out for the lantern wraiths. In the dark they take only half damage. Towers and heroes give off light, so strike when they drift into it!' } },
  ],
  l20: [
    { who: 'gary', text: { zh: '隊長！村口紀念碑旁冒出一面發光的鏡子……鏡子裡的森林跟我們打過仗的那片一模一樣，可是左右顛倒了！', en: 'Captain! A glowing mirror appeared beside the monument at the gate. The forest inside looks just like the one we fought in, only flipped left to right!' } },
    { who: 'lila', text: { zh: '是深淵之門封印時崩落的碎片。它把我們記憶裡的戰場照了出來，裡面的敵人……全是過去敵人的殘影。', en: 'It is a shard that broke off when the Abyss Gate was sealed. It reflects the battlefields in our memories, and the enemies inside are echoes of old foes.' } },
    { who: 'arthur', text: { zh: '殘影要從鏡子裡走出來了，在鏡中把它們擋下！鏡影騎士會突然閃到前方，防線後面要多留幾座塔。', en: 'The echoes are about to walk out of the mirror. Stop them inside it! Echo Knights can flash forward, so keep a few towers behind the front line.' } },
  ],
  l21: [
    { who: 'elena', text: { zh: '鏡子裡的冰河沒有白天……冰霜巨人又站起來了，可是牠全身像玻璃一樣透著紫光。', en: 'The glacier in the mirror has no daylight… The frost giant is standing again, but its whole body glows violet like glass.' } },
    { who: 'sharon', text: { zh: '那只是巨人的殘影。鏡晶魔像被打碎時會散成碎片飛走，記得留幾座打得到空中的塔。', en: 'That is only the giant’s echo. Shard Golems burst into flying shards when they break, so keep some towers that can hit the air.' } },
    { who: 'rain', text: { zh: '夜裡塔的射程會變短，只有營火旁的塔看得遠。上吧，把鏡子裡的冬天打碎！', en: 'Towers see less far at night, except the ones by the campfires. Let’s go and shatter the winter in the mirror!' } },
  ],
  l22: [
    { who: 'echo_umbra', text: { zh: '你們封住了門，卻封不住門的倒影。這面鏡子，就是新的深淵。', en: 'You sealed the gate, but not its reflection. This mirror is the new abyss.' } },
    { who: 'aria', text: { zh: '他的鏡之護盾會保護身邊的部下！先把部下引開，再集中火力打他！', en: 'His mirror ward shields the troops around him! Draw them away first, then focus fire on him!' } },
    { who: 'arthur', text: { zh: '不過是個影子。大家，最後一次——把這面鏡子打碎！', en: 'You are only a shadow. Everyone, one last time: shatter this mirror!' } },
  ],
  l19: [
    { who: 'rain', text: { zh: '礦坑那邊怎麼有綠色的光？卡爾不是早就被我們打倒了嗎……', en: 'Why is there green light over at the mines? Didn’t we beat Carl long ago…?' } },
    { who: 'sharon', text: { zh: '是鬼火。血月喚醒了埋在坑道裡的礦工亡魂，狼人也循著月光跟來了。', en: 'Ghostfire. The blood moon woke the miners buried in the tunnels, and the werewolves followed the moonlight here.' } },
    { who: 'elena', text: { zh: '兩條路都有東西過來！把塔蓋在路邊照亮怨靈，營火旁的塔射程也不會打折。', en: 'Things are coming down both roads! Build towers by the road to light up the wraiths. Towers by the campfires keep their full range, too.' } },
  ],
  l23: [
    { who: 'elena', text: { zh: '沙漠的晚上好冷……營火那邊有影子在動。', en: 'The desert is freezing at night… something is moving by the campfire.' } },
    { who: 'aria', text: { zh: '我從天上看到了！沙丘底下有好幾道隆起正往這邊鑽，是巨蠍！', en: 'I saw it from the air! Ridges are tunneling toward us under the dunes. Scorpions!' } },
    { who: 'arthur', text: { zh: '夜裡塔看不遠，把塔蓋在營火和城堡旁邊。等月亮升高，沙暴巨蟲也會醒來。', en: 'Towers can’t see far at night. Build them by the campfire and the castle. When the moon rises, the Sandstorm Wyrm will wake too.' } },
  ],
  l24: [
    { who: 'viktor', text: { zh: '火山口又亮起來了。伊格尼斯不是已經熄滅了嗎？', en: 'The crater is glowing again. Didn’t we put Ignis out?' } },
    { who: 'sharon', text: { zh: '只剩一點餘燼……但血月把狼人和怨靈引來了，餘燼借著牠們的力量又燒了起來。', en: 'Only embers were left… but the blood moon drew werewolves and wraiths here, and the embers are burning again on their strength.' } },
    { who: 'lila', text: { zh: '那就用我的冰霜把它徹底澆熄！熔岩池旁邊很亮，塔蓋在那裡看得最遠。', en: 'Then my frost will put it out for good! It’s bright by the lava pools, so towers there see the farthest.' } },
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

/** 通關鏡淵篇終章（鏡淵之門）後的尾聲 */
export const MIRROR_EPILOGUE: StoryLine[] = [
  { who: 'lila', text: { zh: '鏡子碎了。碎片化成光點，一片一片飄回天上。', en: 'The mirror has shattered. The shards turned into motes of light and drifted back up into the sky.' } },
  { who: 'sharon', text: { zh: '那些被困在鏡子裡的殘影，終於能安息了。', en: 'The echoes trapped inside the mirror can finally rest.' } },
  { who: 'gary', text: { zh: '紀念碑旁邊又只剩下花了。我還是比較喜歡這樣！', en: 'There are only flowers by the monument again. I like it much better this way!' } },
  { who: 'arthur', text: { zh: '不管是真實還是倒影，這個王國都由我們守護。謝謝你，指揮官。', en: 'Real or reflected, we will always guard this kingdom. Thank you, Commander.' } },
];

export type EpilogueId = 'main' | 'side' | 'extra' | 'mirror';

export const EPILOGUES: Record<EpilogueId, StoryLine[]> = { main: EPILOGUE, side: SIDE_EPILOGUE, extra: EXTRA_EPILOGUE, mirror: MIRROR_EPILOGUE };
