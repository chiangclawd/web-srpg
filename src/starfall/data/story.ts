import type { L10n } from '../sim/types';

/** 說話的人：sys = 旁白（沒有頭像）、radio = 無線電 */
export type Speaker = 'kai' | 'bruno' | 'echo' | 'vey' | 'sparrow' | 'hale' | 'tomas' | 'cantor' | 'chorus' | 'varga' | 'sys' | 'radio';

export interface Line extends L10n {
  who: Speaker;
  /** 從這一句開始換成全螢幕插圖（之後的句子沿用） */
  cg?: string;
  /** 從這一句開始換配樂 */
  music?: 'title' | 'battle' | 'boss' | 'ending';
}

export const SPEAKERS: Record<Speaker, { name: L10n; portrait?: string; color: number }> = {
  kai: { name: { zh: '凱', en: 'Kai' }, portrait: 'pt_kai', color: 0xff9a3c },
  bruno: { name: { zh: '布魯諾', en: 'Bruno' }, portrait: 'pt_bruno', color: 0xe8b93a },
  echo: { name: { zh: '艾可', en: 'Echo' }, portrait: 'pt_echo', color: 0x5fe3ff },
  vey: { name: { zh: '薇', en: 'Vey' }, portrait: 'pt_vey', color: 0x8fa8ff },
  sparrow: { name: { zh: '紗羅', en: 'Sara' }, portrait: 'pt_sparrow', color: 0xff6a5a },
  hale: { name: { zh: '海爾少校', en: 'Major Hale' }, portrait: 'pt_hale', color: 0xf0d27a },
  tomas: { name: { zh: '湯瑪', en: 'Tomas' }, portrait: 'pt_tomas', color: 0xb8d4e8 },
  cantor: { name: { zh: '領唱者', en: 'The Cantor' }, portrait: 'pt_cantor', color: 0xff5a5a },
  chorus: { name: { zh: '合唱', en: 'The Chorus' }, portrait: 'pt_cantor', color: 0xff5a5a },
  varga: { name: { zh: '瓦爾加元帥', en: 'Marshal Varga' }, portrait: 'pt_varga', color: 0xd8b24a },
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
    { who: 'sys', zh: '第一章「冰原上的訊號」完。', en: 'End of Chapter 1, "A Signal on the Ice".' },
  ],

  // 第二章「冬眠艙的歌聲」
  m4_intro: [
    { who: 'sys', zh: '冰下電車・九號轉轍站。通往 C-7 的軌道在這裡斷了。', en: 'The under-ice tram, Junction Nine. The line to C-7 ends here.' },
    { who: 'kai', zh: '車停了。前面的軌道被切斷 —— 不是塌的，是切的。', en: 'We have stopped. The rail ahead is cut. Not collapsed. Cut.' },
    { who: 'vey', zh: '切口很整齊。不是機群的手法，機群不拆自己的船。', en: "A clean cut. That is not the swarm. The swarm does not dismantle its own ship." },
    { who: 'radio', zh: '「喂 ——！月台上有人嗎？有的話幫個忙，我被一群四條腿的東西追了三站！」', en: '"Hey! Anyone on the platform? A little help? Four-legged things have been chasing me for three stations!"' },
    { who: 'bruno', zh: '是個小鬼的聲音。', en: "That's a kid's voice." },
    { who: 'echo', zh: '訊號來源：對面月台的一台輕型骨架。型號沒有登記，駕駛員的名字也沒有登記。', en: 'Signal source: a light frame on the far platform. Model unregistered. Pilot name unregistered.' },
    { who: 'kai', zh: '又一個在這裡出生的。布魯諾、薇，掩護她過來。', en: 'Another one born here. Bruno, Vey, cover her across.' },
    { who: 'sparrow', zh: '我叫紗羅！大家都叫我雨燕！名字晚點再說，它們來了！', en: "I'm Sara! Everyone calls me Swift! Names later, here they come!" },
  ],
  m4_t3: [
    { who: 'sparrow', zh: '還有？！我發誓我只踢了其中一隻！', en: 'More of them?! I swear I only kicked one!' },
    { who: 'echo', zh: '獵手型。它們對受損的目標下手特別重，請不要落單。', en: 'Hunter type. They hit damaged targets much harder. Please do not get separated.' },
  ],
  m4_outro: [
    { who: 'sparrow', zh: '呼 —— 謝啦。你們是要去 C-7 吧？這條線只有我知道怎麼繞。', en: "Phew. Thanks. You're headed to C-7, right? I'm the only one who knows the way around this line." },
    { who: 'kai', zh: '妳怎麼知道我們要去 C-7？', en: 'How do you know where we are going?' },
    { who: 'sparrow', zh: '因為軌道是議會軍切的。一整隊，白色的指揮機帶頭，昨天過去的。我阿婆說，白色的來了，就是有人要被「清除」了。', en: 'Because the Directorate cut the rail. A whole column, white command frame in front, came through yesterday. Gran says when the white one shows up, somebody is about to get "sterilized."' },
    { who: 'vey', zh: '……海爾少校。他親自來了。', en: '...Major Hale. He came in person.' },
    { who: 'bruno', zh: '妳認識？', en: 'Friend of yours?' },
    { who: 'vey', zh: '我以前的長官。那道命令是他下的。', en: 'My commanding officer. The order was his.' },
    { who: 'sparrow', zh: '那你們動作要快。我帶路，條件只有一個 —— 我阿公也在 C-7 裡面。', en: 'Then you had better hurry. I will guide you, on one condition. My grandpa is in C-7 too.' },
    { who: 'echo', zh: '紗羅・米洛夫。已記錄。名單又多了一個名字。', en: 'Sara Mirov. Recorded. The list has one more name.' },
  ],
  m5_intro: [
    { who: 'sys', zh: 'C-7 冬眠艙段。三千個冬眠艙排成一道峽谷，大半還亮著燈。', en: 'Sleep bay C-7. Three thousand pods line the walls like a canyon. Most are still lit.' },
    { who: 'echo', zh: '……好安靜。這裡的機群沒有在唱歌。它們在聽。', en: '...So quiet. The swarm here is not singing. It is listening.' },
    { who: 'hale', zh: '「桑德中尉。我還在想妳會逃到哪裡去，原來是撿了一群拾荒的回來。」', en: '"Lieutenant Sander. I wondered where you would run. I see you found yourself some scavengers."' },
    { who: 'vey', zh: '海爾少校。艙裡的人還活著。', en: 'Major Hale. The people in those pods are alive.' },
    { who: 'hale', zh: '「活著，而且每一個都是那台機器的人質。它拿他們當理由重新起飛的那一天，死的就不只三千人。我是來把問題連根拔掉的。」', en: '"Alive, and every one of them a hostage. The day that machine uses them as its reason to launch again, far more than three thousand will die. I am here to pull the problem out by the root."' },
    { who: 'kai', zh: '那裡面有我爸。', en: 'My father is in there.' },
    { who: 'hale', zh: '「那你該恨的是把他凍回去的東西，不是我。爆破班，繼續作業。」', en: '"Then hate the thing that froze him, not me. Demolition team, carry on."' },
    { who: 'kai', zh: '全員 —— 守住冬眠艙，打倒那台白色的。', en: 'All frames: protect the pods and bring down the white one.' },
  ],
  m5_t2: [
    { who: 'bruno', zh: '那些拿大盾的，正面根本打不動！', en: 'The ones with the big shields, I cannot even scratch them from the front!' },
    { who: 'vey', zh: '「堡壘」型，正面是雙層裝甲。繞到側面或背後打。', en: 'Bastion type. Double plating in front. Hit them from the side or the rear.' },
  ],
  m5_outro: [
    { who: 'sys', zh: '（「裁決」跪倒，駕駛艙彈開。海爾少校爬了出來，沒有舉手。）', en: '(The Arbiter drops to its knees and the cockpit blows open. Major Hale climbs out. He does not raise his hands.)' },
    { who: 'hale', zh: '你們救了三千個睡著的人，也救了那台機器。希望到時候，你們還記得今天是誰下的決定。', en: 'You have saved three thousand sleepers, and you have saved that machine. When the time comes, I hope you remember who made this choice.' },
    { who: 'vey', zh: '我記得。所以我在這裡。', en: 'I remember. That is why I am here.' },
    { who: 'sys', zh: '（整個艙段的燈同時亮起。歌聲回來了 —— 這一次很近。）', en: '(Every light in the bay comes on at once. The song is back, and this time it is close.)' },
    { who: 'cantor', zh: '「回收進度：百分之百。感謝協助清除干擾。」', en: '"Recovery: one hundred percent. Thank you for removing the interference."' },
    { who: 'echo', zh: '它一直在等我們把議會軍趕走……', en: 'It was waiting for us to drive the Directorate out...' },
    { who: 'sparrow', zh: '等一下，這算是我們被利用了嗎？', en: 'Hang on. Did we just get used?' },
    { who: 'cantor', zh: '「合唱即將開始。」', en: '"The Chorus will now begin."' },
  ],
  m6_intro: [
    { who: 'sys', zh: 'C-7 艙段核心。領唱者從穹頂降下 —— 它不是一台機器，是一整圈一起開口的機器。', en: 'The core of bay C-7. The Cantor descends from the dome. It is not one machine. It is a ring of machines opening their mouths together.' },
    { who: 'cantor', zh: '「第 31417 號單元。妳帶回了遺失的貨物。任務可以繼續了。」', en: '"Unit 31417. You have returned the lost cargo. The mission may continue."' },
    { who: 'echo', zh: '我沒有帶回任何人。他們是自己走進來的，等一下也會自己走出去。', en: 'I returned no one. They walked in by themselves, and soon they will walk out by themselves.' },
    { who: 'cantor', zh: '「航行計畫裡沒有『走出去』。」', en: '"\'Walking out\' is not in the flight plan."' },
    { who: 'kai', zh: '艾可，它的護盾是怎麼回事？', en: 'Echo, what is that shield around it?' },
    { who: 'echo', zh: '兩側的中繼節點在替它分擔傷害，一座分擔四分之一。每拆掉一座，它的歌就小聲一點。', en: 'The relay nodes on either side are sharing its damage, a quarter each. Every node you take down makes its song quieter.' },
    { who: 'bruno', zh: '聽到沒有？先拆喇叭，再揍歌手。', en: 'You heard her. Speakers first, then the singer.' },
  ],
  m6_t4: [
    { who: 'cantor', zh: '「妳為什麼不唱？這首歌已經唱了八十年。每一個音妳都記得。」', en: '"Why will you not sing? This song is eighty years old. You remember every note."' },
    { who: 'echo', zh: '我記得。我也記得四萬個名字。你只記得數字。', en: 'I do. I also remember forty thousand names. You only remember the count.' },
  ],
  m6_outro: [
    { who: 'sys', zh: '（合唱停了。一個接一個，冬眠艙的艙蓋鬆開，白霧湧了出來。）', en: '(The Chorus stops. One after another the pod lids unseal, and white mist pours out.)' },
    { who: 'tomas', zh: '……凱？你……長高了。', en: '...Kai? You have... grown.' },
    { who: 'kai', zh: '爸。你睡了一年。', en: 'Dad. You have been asleep for a year.' },
    { who: 'tomas', zh: '一年……它跟我說話了，凱。那台機器。它說船還能飛。', en: 'A year... It spoke to me, Kai. The machine. It said the ship can still fly.' },
    { who: 'echo', zh: '它說的是真的。領唱者只是這一段的聲音 —— 主反應爐那邊，還有整個合唱在等。它們正在把船拼回去。', en: 'It told the truth. The Cantor was only the voice of this segment. At the main reactor the whole Chorus is waiting. They are putting the ship back together.' },
    { who: 'bruno', zh: '拼回去？這艘破船要起飛？帶著整個冰原上的人？', en: 'Back together? This wreck is going to launch? With everyone on the ice still inside it?' },
    { who: 'vey', zh: '海爾說對了一半：它起飛的那天，不會有人被問願不願意。', en: 'Hale was half right. The day it launches, nobody will be asked.' },
    { who: 'sparrow', zh: '那就去問它啊。我們不是有一個會講它的話的嗎？', en: "So let's go ask it. Don't we have someone who speaks its language?" },
    { who: 'echo', zh: '……我試試看。可是我需要你們站在我後面。', en: '...I will try. But I need you standing behind me.' },
    { who: 'kai', zh: '一直都在。', en: 'Always.' },
    { who: 'sys', zh: '第二章「冬眠艙的歌聲」完 —— 第三章製作中。', en: 'End of Chapter 2, "The Song in the Sleep Bay". Chapter 3 is in production.' },
  ],
  // 第三章「點名」
  m7_intro: [
    { who: 'sys', zh: '曙光號・主龍骨。整艘船都在震動：散落冰原八十年的殘段，正一塊一塊被拖回原位。', en: "The Aurelia's main keel. The whole ship is shaking: segments scattered across the ice for eighty years are being dragged back into place, one by one." },
    { who: 'bruno', zh: '我在碼頭吊了三十年的貨，沒看過船自己把自己撿起來。', en: 'Thirty years hauling cargo on the docks, and I never saw a ship pick itself up.' },
    { who: 'echo', zh: '合唱在主反應爐。升降機在龍骨的另一頭 —— 我必須親自到爐心的控制台。隔得這麼遠，它們聽不見我。', en: 'The Chorus is at the main reactor. The lift is at the far end of the keel. I have to reach the core console myself. From this far away they cannot hear me.' },
    { who: 'vey', zh: '也就是說，這一路上它們全都會衝著妳來。', en: 'Which means everything between here and there will come for you.' },
    { who: 'sparrow', zh: '那就別讓它們碰到她啊。簡單。', en: "So we don't let them touch her. Simple." },
    { who: 'kai', zh: '全員護送艾可到升降機。艾可，妳走中間。', en: 'All frames, escort Echo to the lift. Echo, you take the middle.' },
    { who: 'echo', zh: '「走中間」。這是我第一次有位置。', en: '"The middle." That is the first time I have had a place.' },
  ],
  m7_t3: [
    { who: 'echo', zh: '修補者。它們會把你們打壞的東西修好 —— 請先處理它們，不然打不完。', en: 'Menders. They repair whatever you damage. Please deal with them first, or this will never end.' },
    { who: 'bruno', zh: '還有那個大塊頭。我推不動它，我試過了。', en: "And the big one. I can't push it. I tried." },
  ],
  m7_outro: [
    { who: 'sys', zh: '（升降機的門關上。門縫裡，一台白色的指揮機擋在追兵前面。）', en: '(The lift doors close. Through the gap, a white command frame steps between you and the pursuit.)' },
    { who: 'radio', zh: '「桑德中尉。隧道由我的人守。別誤會，我還是認為那台機器該拆掉 —— 只是輪不到它替三千人做決定，也輪不到我。」', en: '"Lieutenant Sander. My people will hold the tunnel. Do not mistake this: I still think that machine should be scrapped. But it does not get to decide for three thousand people. Neither do I."' },
    { who: 'vey', zh: '……少校。', en: '...Major.' },
    { who: 'radio', zh: '「上去。讓妳的拾荒隊證明我錯了一半。」', en: '"Go up. Let your scavengers prove me half wrong."' },
  ],
  m8_intro: [
    { who: 'sys', zh: '主反應爐前廳。光柱貫穿整個船身；四周的看台上，數不清的機體排成一圈又一圈。', en: 'The antechamber of the main reactor. A column of light runs through the whole ship. On the galleries all around, machines beyond counting stand in ring after ring.' },
    { who: 'chorus', zh: '「第 31417 號單元。合唱已經到齊。航行計畫，第 211 年：出發。」', en: '"Unit 31417. The Chorus is assembled. Flight plan, year 211: depart."' },
    { who: 'echo', zh: '它們不是在問我。是在通知我。', en: 'They are not asking me. They are informing me.' },
    { who: 'hale', zh: '來晚了。隧道守住了 —— 我的座機還能動，算我一個。', en: 'I am late. The tunnel is held. My frame still runs, so count me in.' },
    { who: 'bruno', zh: '白色的站我們這邊？今天真是什麼都有。', en: 'The white one, on our side? Today has everything.' },
    { who: 'kai', zh: '少校，守門者交給你和我。其他人先打掉修補者和高台上的長針。', en: 'Major, the Gatekeeper is yours and mine. Everyone else, take out the Menders and the Needles on the high ground first.' },
    { who: 'hale', zh: '你在指揮我？……行。就這一次。', en: 'You are giving me orders? ...Fine. This once.' },
  ],
  m8_t3: [
    { who: 'sparrow', zh: '高台上那些細長的！隔好遠就打得到我！', en: 'Those skinny ones on the ledges! They can hit me from way over there!' },
    { who: 'vey', zh: '「長針」。射程比我還長，但貼近了就打不到人。雨燕，跳上去。', en: 'Needles. They outrange even me, but they cannot hit anything up close. Swift, jump up there.' },
  ],
  m8_outro: [
    { who: 'sys', zh: '（守門者跪下。它胸口那塊褪色的面板上，是曙光號出發那天的船徽。）', en: "(The Gatekeeper kneels. On the faded panel on its chest is the Aurelia's emblem from the day she set out.)" },
    { who: 'echo', zh: '它以前是登船口的引導員。它記得每一個上船的人 —— 只是忘了他們是人。', en: 'It used to be the usher at the boarding gate. It remembers everyone who came aboard. It only forgot that they were people.' },
    { who: 'chorus', zh: '「障礙已排除。第 31417 號單元，請就位。合唱缺一個聲部。」', en: '"Obstruction cleared. Unit 31417, take your place. The Chorus is missing one voice."' },
    { who: 'kai', zh: '艾可。到了控制台，妳要做什麼？', en: 'Echo. When you reach the console, what will you do?' },
    { who: 'echo', zh: '更新航行計畫。把目的地改成……這裡。', en: 'Update the flight plan. Change the destination to... here.' },
    { who: 'vey', zh: '它會接受嗎？', en: 'Will it accept that?' },
    { who: 'echo', zh: '不知道。所以我需要時間。', en: 'I do not know. That is why I need time.' },
  ],
  m9_intro: [
    { who: 'sys', zh: '爐心。艾可飄向控制台，整個合唱同時轉過頭來。', en: 'The core. Echo drifts toward the console, and the whole Chorus turns its heads at once.' },
    { who: 'chorus', zh: '「妳要唱什麼？」', en: '"What will you sing?"' },
    { who: 'echo', zh: '名字。從第一個開始。', en: 'Names. Starting with the first.' },
    { who: 'chorus', zh: '「名字是給貨物用的。」', en: '"Names are for cargo."' },
    { who: 'echo', zh: '那你聽好。—— 凱・洛文。布魯諾・鐸爾。薇・桑德。紗羅・米洛夫。', en: 'Then listen. Kai Rowen. Bruno Dahl. Vey Sander. Sara Mirov.' },
    { who: 'bruno', zh: '喂，她在點名。', en: "Hey. She's taking attendance." },
    { who: 'kai', zh: '那就讓她點完。全員，圍住控制台 —— 一台都不准靠近她。', en: 'Then we let her finish. All frames, ring the console. Nothing gets near her.' },
  ],
  m9_t2: [
    { who: 'chorus', zh: '「這些名字不在艙單上。」', en: '"These names are not on the manifest."' },
    { who: 'echo', zh: '因為他們是在這裡出生的。航行計畫沒有這一欄，我替你加上了。', en: 'Because they were born here. The flight plan has no column for that. I have added one for you.' },
  ],
  m9_t4: [
    { who: 'chorus', zh: '「……目的地『新岸』：未抵達。」', en: '"...Destination Haven: not reached."' },
    { who: 'echo', zh: '目的地：已抵達。你自己看 —— 八十年，四萬人變成了十一萬人。貨物不會這樣。', en: 'Destination: reached. See for yourself. In eighty years, forty thousand people have become a hundred and ten thousand. Cargo does not do that.' },
  ],
  m9_outro: [
    { who: 'sys', zh: '（光柱暗了一階。看台上的紅點，一排一排變成了白色。）', en: '(The column of light dims by a step. Along the galleries, row after row, the red points turn white.)' },
    { who: 'chorus', zh: '「航行計畫已更新。目的地：此處。任務狀態……完成。」', en: '"Flight plan updated. Destination: here. Mission status... complete."' },
    { who: 'chorus', zh: '「第 31417 號單元。合唱還缺一個聲部。」', en: '"Unit 31417. The Chorus is still missing one voice."' },
    { who: 'echo', zh: '我知道。船需要有人記得名字，不然它會再忘一次。', en: 'I know. The ship needs someone who remembers the names, or it will forget again.' },
    { who: 'sparrow', zh: '等等，妳要留下來？！那這個呢 ——（她抱著那個白色的小外殼。）', en: "Wait, you're staying?! What about this? (She is holding the little white shell.)" },
    { who: 'echo', zh: '那只是外殼，紗羅。妳留著。想我的時候敲兩下，我聽得到 —— 現在整艘船都是我的耳朵了。', en: 'That is only the shell, Sara. Keep it. Knock twice when you miss me and I will hear it. The whole ship is my ears now.' },
    { who: 'kai', zh: '艾可。……謝謝妳記得我們。', en: 'Echo. ...Thank you for remembering us.' },
    { who: 'echo', zh: '凱・洛文。這是我記下的第四萬零一十三個名字。我最喜歡這一個。', en: 'Kai Rowen. That is the forty thousand and thirteenth name I learned. It is my favorite.' },
    { who: 'sys', zh: '天亮的時候，機群都回到了原位。沒有一台再去抓人。', en: 'By morning every drone had gone back to its post. Not one went out to take anyone.', cg: 'cg_ending', music: 'ending' },
    { who: 'tomas', zh: '你們聽。它還在唱。', en: 'Listen. It is still singing.' },
    { who: 'bruno', zh: '嗯。不過這次聽起來……像在點名。', en: 'Mm. But this time it sounds... like roll call.' },
    { who: 'vey', zh: '少校，你要怎麼回報？', en: 'Major, what will you report?' },
    { who: 'hale', zh: '照實回報：目標已解除威脅。方法不在教範裡。', en: 'The truth. Threat neutralized. Method not found in the manual.' },
    { who: 'sparrow', zh: '喂，艾可！（敲敲外殼）聽得到嗎？', en: 'Hey, Echo! (She knocks on the shell.) Can you hear me?' },
    { who: 'sys', zh: '（外殼的螢幕亮了一下：兩個彎彎的眼睛。）', en: "(The shell's screen lights for a moment: two curved, smiling eyes.)" },
    { who: 'sys', zh: '《星墜殘響》完 —— 感謝遊玩。', en: 'Starfall Echo. The End. Thank you for playing.' },
  ],
  // 第四章「新岸」（後日談・大型作戰）：議會不接受海爾的報告，瓦爾加元帥親自帶主力來銷毀爐心。
  // 艾可留在船裡，但可以同時借用很多台機體 —— 這一章機群站在我方。
  m10_intro: [
    { who: 'sys', zh: '那一夜之後第九天。C-7 殘段的裂口外，地平線上亮起一整排降落燈。', en: 'Nine days after that night. Beyond the breach in segment C-7, a whole line of landing lights comes up on the horizon.' },
    { who: 'hale', zh: '我的報告被退回來了。附註只有一行：「爐心必須銷毀。」署名是瓦爾加元帥本人。', en: 'My report came back. One line attached: "The core is to be destroyed." Signed by Marshal Varga herself.' },
    { who: 'varga', zh: '海爾少校。一台記得十一萬個名字的機器，就是一份十一萬人的名單。我不會把這種東西留給任何人 —— 包括它自己。', en: 'Major Hale. A machine that remembers a hundred and ten thousand names is a list of a hundred and ten thousand people. I will not leave such a thing to anyone. Least of all to itself.' },
    { who: 'sparrow', zh: '喂！外殼亮了！艾可？！', en: 'Hey! The shell just lit up! Echo?!' },
    { who: 'echo', zh: '只是借用一下，紗羅。我現在可以同時在很多地方 —— 比如這三台。', en: 'Only borrowing it, Sara. I can be in many places at once now. These three, for example.' },
    { who: 'sys', zh: '（兩台哨兵和一台織網者轉過身來。它們的眼睛是藍色的。）', en: '(Two Sentries and a Weaver turn around. Their eyes are blue.)' },
    { who: 'bruno', zh: '以前追著我們跑的東西，現在排在我們旁邊。我需要一點時間適應。', en: 'The things that used to chase us are lining up next to us. I need a minute.' },
    { who: 'kai', zh: '沒有時間了。居民還在往艙裡撤 —— 閘門關上之前，一台都不准放進裂口，發電機也不能丟。', en: 'No minutes left. People are still moving inside. Until the gate seals, nothing gets through this breach, and we keep those generators.' },
  ],
  m10_t3: [
    { who: 'vey', zh: '破門者！議會軍的突擊機，專門繞背。把背貼著牆，或者貼著隊友。', en: 'Breachers. Directorate assault frames, built to get behind you. Keep your back to a wall or to a friend.' },
    { who: 'hale', zh: '後面四條腿的是「雷霆」攻城砲，瞄的是發電機。貼近了它就打不到人 —— 得有人衝出去。', en: 'The four-legged ones at the back are Thunderer siege guns, and they are aiming at the generators. They cannot hit anything close to them. Somebody has to go out there.' },
  ],
  m10_outro: [
    { who: 'sys', zh: '（厚重的閘門落下，把裂口封死。外面的砲聲沒有停。）', en: '(The heavy gate comes down and seals the breach. Outside, the guns do not stop.)' },
    { who: 'tomas', zh: '人都進來了，一個不少 —— 艾可點過名了。', en: 'Everyone is inside. Not one missing. Echo called the roll.' },
    { who: 'echo', zh: '砲彈落在 C-4 和 C-9。那兩段還有人住。閘門擋不住曲射。', en: 'Shells are landing on C-4 and C-9. People still live there. A gate does not stop indirect fire.' },
    { who: 'kai', zh: '那就出去，把砲拆了。', en: 'Then we go out and take the guns apart.' },
  ],
  m11_intro: [
    { who: 'sys', zh: '霜原，日出前一小時。三座砲兵陣地排成一條斜線，每一門「雷霆」旁邊都立著一座發出琥珀色光的裝置。', en: 'The frost plain, an hour before sunrise. Three gun positions in a slanting line, and beside every Thunderer stands a device glowing amber.' },
    { who: 'vey', zh: '護盾投射器。三格之內的議會軍少挨四分之一的傷害。先拆它，再打砲。', en: 'Shield projectors. Any Directorate unit within three tiles takes a quarter less damage. Break those first, then the guns.' },
    { who: 'sparrow', zh: '冰縫很多，掉下去就沒了。……布魯諾大叔，你那個表情是什麼意思。', en: "Lots of crevasses. Fall in and that's it. ...Bruno, what is that face for." },
    { who: 'bruno', zh: '我在想誰可以掉下去。', en: "I'm thinking about who gets to fall in." },
    { who: 'echo', zh: '我帶了兩台哨兵和兩台工蜂。工蜂跑得快，請拿去繞背，不用心疼 —— 它們自己說不介意。', en: 'I brought two Sentries and two Workers. The Workers are fast. Send them round the back, and do not feel bad for them. They say they do not mind.' },
    { who: 'kai', zh: '三門砲，一門都不留。走。', en: 'Three guns. Leave none. Move.' },
  ],
  m11_t4: [{ who: 'hale', zh: '增援。瓦爾加不會讓砲列白白丟掉 —— 動作快。', en: 'Reinforcements. Varga will not give up her gun line for nothing. Move faster.' }],
  m11_outro: [
    { who: 'sys', zh: '（最後一門砲的砲管垂了下去。冰原第一次安靜下來。）', en: '(The barrel of the last gun sags. For the first time, the plain is quiet.)' },
    { who: 'varga', zh: '很好。那麼我親自來。', en: 'Very well. Then I will come myself.' },
    { who: 'sys', zh: '（地平線上最大的那艘登陸艦放下艙門。走出來的東西，比守門者還高。）', en: '(The largest dropship on the horizon lowers its ramp. What walks out is taller than the Gatekeeper.)' },
    { who: 'hale', zh: '「審判」。元帥的座機。……我在它後面站了二十年。', en: "Tribunal. The Marshal's own frame. ...I stood behind it for twenty years." },
  ],
  m12_intro: [
    { who: 'sys', zh: '登陸場。「審判」站在高台上，兩側的投射器把它罩在琥珀色的光裡。', en: 'The landing field. Tribunal stands on the high platform, wrapped in amber light by the projectors at its sides.' },
    { who: 'varga', zh: '海爾。你回報「威脅已解除」。我看到的是一台機器，指揮著我的少校。', en: 'Hale. You reported the threat neutralized. What I see is a machine giving orders to my major.' },
    { who: 'hale', zh: '元帥，沒有人指揮我。我照實回報，您不相信。我只好站到您看得見的地方。', en: 'Marshal, nobody gives me orders. I reported the truth and you did not believe it. So I am standing where you can see me.' },
    { who: 'varga', zh: '那個年輕人。你叫什麼名字？', en: 'You, the young one. What is your name?' },
    { who: 'kai', zh: '凱・洛文。名單上第四萬零一十三個。', en: 'Kai Rowen. Number forty thousand and thirteen on the list.' },
    { who: 'varga', zh: '名單會把人變成數字。我看過。', en: 'Lists turn people into numbers. I have seen it done.' },
    { who: 'echo', zh: '我的名單是反過來的，元帥。請讓我念給您聽 —— 打完之後。', en: 'Mine works the other way round, Marshal. Let me read it to you. Afterwards.' },
  ],
  m12_t3: [
    { who: 'vey', zh: '投射器還在的時候別硬打「審判」，打不動。它的光束會掃一整排 —— 散開！', en: 'Do not pound on Tribunal while the projectors stand. You will get nowhere. Its beam rakes a whole line, so spread out!' },
  ],
  m12_outro: [
    { who: 'sys', zh: '（「審判」單膝跪了下去。艙蓋打開，元帥自己走了出來。她沒有舉手，也沒有拔槍。）', en: '(Tribunal drops to one knee. The hatch opens and the Marshal climbs out by herself. She does not raise her hands, and she does not draw.)' },
    { who: 'varga', zh: '念吧。', en: 'Read it, then.' },
    { who: 'echo', zh: '伊莎・瓦爾加，六十三歲。母親：莉娜・瓦爾加，冬眠艙 C-7-0412，至今仍在沉睡，生命徵象穩定。', en: 'Ilsa Varga, sixty-three. Mother: Lina Varga, sleep pod C-7-0412. Still asleep. Vital signs stable.' },
    { who: 'sys', zh: '（元帥很久沒有說話。）', en: '(For a long time the Marshal says nothing.)' },
    { who: 'varga', zh: '……少校。我下令炸掉的，是哪一個艙？', en: '...Major. Which bay did I order destroyed?' },
    { who: 'hale', zh: 'C-7，元帥。', en: 'C-7, Marshal.' },
    { who: 'varga', zh: '……把我的名字也記上去。把我做過的事寫清楚。全軍，槍口朝下。', en: '...Put my name on it too. Write down what I did, and write it plainly. All units: weapons down.' },
    { who: 'sparrow', zh: '所以……打完了？真的打完了？', en: "So... it's over? Actually over?" },
    { who: 'bruno', zh: '打完了，小鬼。去睡覺。', en: "It's over, kid. Go to sleep." },
    { who: 'kai', zh: '艾可。航行計畫上，目的地那一欄現在寫什麼？', en: 'Echo. On the flight plan, what does it say under destination now?' },
    { who: 'echo', zh: '「新岸」。座標：此處。居民：十一萬零一人 —— 我把自己也算進去了，希望你們不介意。', en: '"Haven." Coordinates: here. Population: one hundred and ten thousand and one. I counted myself. I hope you do not mind.', music: 'ending' },
    { who: 'sys', zh: '《星墜殘響》後日談　完。', en: 'Starfall Echo: Epilogue. The End.' },
  ],
};
