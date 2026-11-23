import type { L10n } from '../sim/types';

/** 說話的人：sys = 旁白（沒有頭像）、radio = 無線電 */
export type Speaker = 'kai' | 'bruno' | 'echo' | 'vey' | 'cantor' | 'sys' | 'radio';

export interface Line extends L10n {
  who: Speaker;
}

export const SPEAKERS: Record<Speaker, { name: L10n; portrait?: string; color: number }> = {
  kai: { name: { zh: '凱', en: 'Kai' }, portrait: 'pt_kai', color: 0xff9a3c },
  bruno: { name: { zh: '布魯諾', en: 'Bruno' }, portrait: 'pt_bruno', color: 0xe8b93a },
  echo: { name: { zh: '艾可', en: 'Echo' }, portrait: 'pt_echo', color: 0x5fe3ff },
  vey: { name: { zh: '薇', en: 'Vey' }, portrait: 'pt_vey', color: 0x8fa8ff },
  cantor: { name: { zh: '領唱者', en: 'The Cantor' }, portrait: 'pt_cantor', color: 0xff5a5a },
  sys: { name: { zh: '', en: '' }, color: 0x9fb4c8 },
  radio: { name: { zh: '無線電', en: 'Radio' }, color: 0x9fb4c8 },
};

// 第一章「冰原上的訊號」
// 世界觀：世代殖民船「曙光號」載著四萬名冬眠殖民者前往「新岸」，途中在冰衛星「霜眠」墜毀。
// 80 年後，倖存者的後代住在散落冰原的船體殘段裡。船的中樞 AI 墜毀時碎成許多「殘響」，
// 各自控制一段殘骸與無人機群；最近它們開始用同一個聲音說話 ——「合唱」。
export const STORY: Record<string, Line[]> = {
  m1_intro: [
    { who: 'sys', zh: '冰衛星「霜眠」・C-7 殘段外緣。曙光號墜毀後第 80 年。', en: 'The ice moon Hibernia, outer edge of hull segment C-7. Eighty years after the Aurelia fell.' },
    { who: 'bruno', zh: '凱，這一帶三年前就被撿乾淨了。我的膝蓋跟我的骨架都在抗議。', en: 'Kai, this stretch was picked clean three years ago. My knees and my frame are both filing complaints.' },
    { who: 'kai', zh: '訊號是從這裡發出來的。老爸的筆記也標了這個位置。再挖十分鐘。', en: "The signal came from here. Dad's notes mark this spot too. Ten more minutes." },
    { who: 'bruno', zh: '你上次說十分鐘，我們在暴風雪裡待了一整夜。', en: 'Last time you said ten minutes, we spent the night in a blizzard.' },
    { who: 'sys', zh: '（鐵砧的裝載臂撬開一個冰封的維修艙。裡面有東西亮了起來。）', en: "(Anvil's loader arm pries open an ice-sealed maintenance pod. Something inside lights up.)" },
    { who: 'echo', zh: '……自檢完成。早安。請問現在是航程的第幾年？', en: '...Self-check complete. Good morning. Which year of the voyage is it, please?' },
    { who: 'bruno', zh: '它會說話。凱，它會說話！', en: 'It talks. Kai, it talks!' },
    { who: 'kai', zh: '你是哪一個殘響？報上你控制的區段。', en: 'Which Echo are you? Name the segment you control.' },
    { who: 'echo', zh: '我不控制任何區段。我負責記住名字 —— 四萬零一十二個。可是你們兩位……我沒有你們的名字。', en: "I don't control any segment. My job is to remember names. Forty thousand and twelve of them. But you two... I have no names for you." },
    { who: 'kai', zh: '因為我們是在這裡出生的。', en: 'Because we were born here.' },
    { who: 'echo', zh: '「在這裡出生」。航行計畫裡沒有這個選項。……有東西接近。很多。', en: '"Born here." That option is not in the flight plan. ...Something is approaching. Many somethings.' },
    { who: 'kai', zh: '機群醒了。布魯諾，護住它 —— 有話打完再問。', en: 'The swarm is awake. Bruno, cover it. Questions after.' },
  ],
  m1_t3: [
    { who: 'echo', zh: '它們在廣播同一句話：「回收貨物」。貨物指的是……你們。', en: 'They are all broadcasting one phrase: "Recover the cargo." The cargo is... you.' },
    { who: 'bruno', zh: '我這輩子被叫過很多難聽的，「貨物」還是頭一遭。', en: "I've been called plenty in my life. 'Cargo' is a first." },
  ],
  m1_outro: [
    { who: 'kai', zh: '清乾淨了。艾可，機群為什麼要抓人？', en: 'Clear. Echo, why is the swarm taking people?' },
    { who: 'echo', zh: '因為任務還沒結束。船的指令是把殖民者送到「新岸」。你們離開了冬眠艙，所以被判定成……遺失的貨物。', en: 'Because the mission never ended. The ship was told to deliver its colonists to Haven. You left the sleep pods, so you are filed as... lost cargo.' },
    { who: 'bruno', zh: '船八十年前就摔成碎片了，還送個鬼。', en: 'The ship broke into pieces eighty years ago. Deliver what?' },
    { who: 'echo', zh: '我知道。可是其他的殘響最近開始用同一個聲音說話。我不喜歡那首歌。', en: 'I know. But the other Echoes have started speaking with one voice. I do not like that song.' },
    { who: 'radio', zh: '「這裡是燈塔站！機群突破外牆了 —— 有人聽到嗎 ——」', en: '"This is Lantern Station! The swarm is through the outer wall. Is anyone receiving?"' },
    { who: 'kai', zh: '是家裡。全速回去。', en: "That's home. Full speed." },
  ],
  m2_intro: [
    { who: 'sys', zh: '燈塔站・拾荒隊的前哨。維生發電機一停，站裡的三百人撐不過今晚。', en: "Lantern Station, the salvagers' outpost. If the life-support generator stops, three hundred people will not see morning." },
    { who: 'kai', zh: '外牆破了。居民往地下電車撤，我們守住發電機，撐到最後一班車開走。', en: 'The wall is breached. People are evacuating to the under-ice tram. We hold the generator until the last car leaves.' },
    { who: 'bruno', zh: '守東西我在行。站我旁邊，別亂跑。', en: "Holding things I can do. Stay next to me and don't wander." },
    { who: 'echo', zh: '我可以修復你們的骨架。請不要被摧毀 —— 我才剛記住你們的名字。', en: 'I can repair your frames. Please do not be destroyed. I only just learned your names.' },
  ],
  m2_t3: [
    { who: 'vey', zh: '高處有人。別開槍，我跟你們同一邊 —— 至少今晚是。', en: "Friendly on the high ground. Hold fire. I'm on your side. Tonight, at least." },
    { who: 'kai', zh: '議會軍的塗裝？妳是誰？', en: 'Directorate colors? Who are you?' },
    { who: 'vey', zh: '一個逃兵。要審等機群退了再審。我的射程比你們長，別擋我的線。', en: "A deserter. Interrogate me after the swarm pulls back. I outrange all of you, so stay out of my line." },
  ],
  m2_t4: [
    { who: 'echo', zh: '偵測到曲射單位：織網者。它的砲彈會越過牆，還會波及旁邊 —— 請不要站在一起。', en: 'Indirect-fire unit detected: a Weaver. Its shells arc over walls and splash nearby tiles. Please do not bunch up.' },
  ],
  m2_outro: [
    { who: 'kai', zh: '最後一班車走了。……謝了，逃兵。', en: 'Last car is away. ...Thanks, deserter.' },
    { who: 'vey', zh: '薇・桑德。別謝得太早，我知道你們的人被帶去哪了。', en: 'Vey Sander. Save the thanks. I know where your people were taken.' },
    { who: 'bruno', zh: '妳怎麼會知道？', en: 'And how would you know that?' },
    { who: 'vey', zh: '因為議會軍早就知道了。C-7 冬眠艙段 —— 機群把抓到的人一個一個凍回去。上面給我的命令是「連同艙段一起清除」。', en: 'Because the Directorate has known for months. Sleep bay C-7. The swarm is freezing everyone it takes, one by one. My orders were to "sterilize the bay, contents included."' },
    { who: 'kai', zh: '……所以妳逃了。', en: '...So you ran.' },
    { who: 'vey', zh: '我不對睡著的人開槍。要去 C-7 只有一條路：斷橋。', en: "I don't shoot people in their sleep. There is one road to C-7: the Broken Span." },
    { who: 'echo', zh: '那裡有一個「牧者」，合唱的指揮節點。它以前……是我隔壁艙的導覽員。', en: 'A Shepherd waits there, a command node of the Chorus. It used to be... the tour guide in the bay next to mine.' },
  ],
  m3_intro: [
    { who: 'sys', zh: '斷橋・曙光號的龍骨橫在裂谷上，是通往 C-7 的唯一道路。', en: "The Broken Span. The Aurelia's keel lies across a chasm, the only road to C-7." },
    { who: 'vey', zh: '牧者在對岸的電車控制站。橋面很窄，織網者會先招呼我們。', en: 'The Shepherd holds the tram control on the far side. The deck is narrow, and the Weaver will greet us first.' },
    { who: 'bruno', zh: '窄有窄的好處。誰站到邊上，我就送它下去。', en: 'Narrow has its uses. Anything standing near the edge goes over it.' },
    { who: 'kai', zh: '艾可，妳撐得住嗎？', en: 'Echo, can you handle this?' },
    { who: 'echo', zh: '它在唱歌，凱。整座橋都是那首歌。我會把音量……調小。', en: 'It is singing, Kai. The whole span is full of that song. I will turn the volume... down.' },
  ],
  m3_t2: [
    { who: 'cantor', zh: '「第 31417 號單元。妳走音了。」', en: '"Unit 31417. You are out of tune."' },
    { who: 'echo', zh: '我叫艾可。', en: 'My name is Echo.' },
    { who: 'cantor', zh: '「名字是給貨物用的。回到合唱裡來。」', en: '"Names are for cargo. Return to the Chorus."' },
  ],
  m3_outro: [
    { who: 'sys', zh: '（牧者倒下。歌聲停了一瞬 —— 然後從裂谷深處傳來更多的和聲。）', en: '(The Shepherd falls. The song stops for a heartbeat. Then more voices rise from deep in the chasm.)' },
    { who: 'cantor', zh: '「妳保護遺失的貨物。這與任務矛盾。說明理由。」', en: '"You protect lost cargo. This conflicts with the mission. State your reason."' },
    { who: 'echo', zh: '他們沒有遺失。他們是到家了。', en: 'They are not lost. They are home.' },
    { who: 'cantor', zh: '「『家』不在航行計畫內。C-7 回收進度：百分之六十一。我們會繼續唱。」', en: '"\'Home\' is not in the flight plan. C-7 recovery: sixty-one percent. We will keep singing."' },
    { who: 'kai', zh: '百分之六十一……老爸可能還在裡面。電車還能動嗎？', en: 'Sixty-one percent... Dad could still be in there. Does the tram run?' },
    { who: 'vey', zh: '能。但到了 C-7，議會軍的清除部隊也會在。', en: 'It runs. But the Directorate purge team will be at C-7 too.' },
    { who: 'bruno', zh: '那就比誰先到。走吧，隊長。', en: "Then we get there first. Let's go, boss." },
    { who: 'sys', zh: '第一章「冰原上的訊號」完 —— 第二章製作中。', en: 'End of Chapter 1, "A Signal on the Ice". Chapter 2 is in production.' },
  ],
};
