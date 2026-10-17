import type { L10n } from '../sim/defs';

export interface ChangeEntry {
  /** 遞增編號：大於存檔中的 newsSeen 就自動顯示 */
  id: number;
  date: string;
  title: L10n;
  items: L10n[];
}

/** 更新內容（最新在前）。每次部署新功能就在最前面加一筆。 */
export const CHANGELOG: ChangeEntry[] = [
  {
    id: 64,
    date: '2026-10-17',
    title: { zh: '夜戰小幫手', en: 'Night Battle Help' },
    items: [
      { zh: '在夜戰中落敗時，結算畫面會教你怎麼對付怨靈與狼人', en: 'Lose a night battle and the result screen now gives tips on wraiths and werewolves' },
      { zh: '夜裡派遣英雄時，英雄偶爾會說出夜晚專屬台詞', en: 'Heroes sometimes say night-only lines when you send them out after dark' },
      { zh: '修正手機上「新敵人」介紹卡的說明文字太長時，會蓋住標籤和 OK 按鈕的問題', en: 'Fixed long descriptions on the “New Enemy” card covering the tags and OK button on phones' },
    ],
  },
  {
    id: 63,
    date: '2026-10-17',
    title: { zh: '夜戰關卡標示', en: 'Night Level Markers' },
    items: [
      { zh: '地圖上的夜戰關卡旗子旁會掛一彎月亮、發出紫色光暈，一眼就認得出來', en: 'Night levels on the world map carry a crescent moon and a violet glow, so you can spot them at a glance' },
      { zh: '修正夜戰關卡的螢火蟲不見了的問題', en: 'Fixed the missing fireflies in night battles' },
    ],
  },
  {
    id: 62,
    date: '2026-10-17',
    title: { zh: '番外篇：礦坑鬼火', en: 'Extra chapter: Mine Ghostfire' },
    items: [
      { zh: '新關卡「礦坑鬼火」（通關月夜突襲後解鎖）：夜裡的廢棄礦坑，提燈怨靈與血月狼人從兩條路一起湧出', en: 'New level “Mine Ghostfire” (unlocks after Moonlit Raid): the abandoned mines at night, with lantern wraiths and werewolves coming down two roads at once' },
      { zh: '也可以挑戰英雄、鋼鐵與無盡模式', en: 'Heroic, Iron and Endless modes are available too' },
    ],
  },
  {
    id: 61,
    date: '2026-10-17',
    title: { zh: '新的每日任務', en: 'New Daily Quests' },
    items: [
      { zh: '每日任務新增「在戰鬥中賺取金幣」與「通關一次英雄挑戰或鋼鐵挑戰」（通關 4 關後開放）', en: 'New daily quests: “Earn gold in battle” and “Clear a Heroic or Iron Challenge” (after clearing 4 levels)' },
    ],
  },
  {
    id: 60,
    date: '2026-10-17',
    title: { zh: '夜戰小幫手', en: 'Night Battle Helpers' },
    items: [
      { zh: '有怨靈的夜晚，建塔或點塔時會多畫一圈黃色光圈：怨靈飛進圈內就會現形', en: 'On nights with wraiths, building or selecting a tower also shows a yellow ring: wraiths inside it are revealed' },
      { zh: '「月夜突襲」的鋼鐵挑戰攻勢減輕，現在打得過了', en: 'Moonlit Raid’s Iron Challenge is lighter and now winnable' },
    ],
  },
  {
    id: 59,
    date: '2026-10-17',
    title: { zh: '手機版圖鑑', en: 'Phone Encyclopedia' },
    items: [
      { zh: '手機上圖鑑的防禦塔、敵人格子放大，比較好點；放不下的可以上下滑動', en: 'On phones the encyclopedia’s tower and enemy grids have bigger, easier-to-tap icons and scroll when they don’t fit' },
      { zh: '修正中文說明在手機上偶爾超出面板邊緣（逗號、句號改成掛在行尾）', en: 'Fixed Chinese descriptions sometimes running past panel edges on phones' },
    ],
  },
  {
    id: 58,
    date: '2026-10-17',
    title: { zh: '手機版成就頁＋夜晚音效', en: 'Phone Achievements & Night Sounds' },
    items: [
      { zh: '手機上的成就頁改成兩欄大卡片，可以上下滑動，說明文字清楚好讀', en: 'On phones the achievements page now shows two columns of big cards that scroll, so descriptions are easy to read' },
      { zh: '新成就「迎接黎明」：在無盡模式撐過第一個夜晚', en: 'New achievement “See the Dawn”: survive the first night in Endless' },
      { zh: '狼人狂暴時會仰天長嚎，怨靈飄進光裡時會發出叮的一聲並閃一下', en: 'Werewolves howl when they enrage, and wraiths chime and flash when they drift into the light' },
    ],
  },
  {
    id: 57,
    date: '2026-10-17',
    title: { zh: '無盡模式：日夜交替', en: 'Endless: Day and Night' },
    items: [
      { zh: '無盡模式每 20 波會入夜一次（第 16–20、36–40…波），夜幕緩緩降臨，首領波在黑暗中登場', en: 'Endless now has nights: waves 16–20, 36–40 and so on. Darkness falls slowly, and the boss wave arrives in the dark' },
      { zh: '夜裡塔的射程 -15%（燈火照到的塔除外），還有提燈怨靈趁黑出沒；天亮後一切恢復', en: 'At night towers lose 15% range (unless lit), and lantern wraiths come out. Everything returns to normal at dawn' },
    ],
  },
  {
    id: 56,
    date: '2026-10-17',
    title: { zh: '夜行魔物', en: 'Creatures of the Night' },
    items: [
      { zh: '新敵人「提燈怨靈」：躲在黑暗裡時只受一半傷害，飄進營火、塔或英雄的光裡才會現形 — 夜戰時塔的位置更重要了', en: 'New enemy: the Lantern Wraith takes only half damage while hidden in the dark and shows itself in the light of campfires, towers or your hero. Where you build matters even more at night' },
      { zh: '新敵人「血月狼人」：傷口會快速癒合，重傷時狂暴衝刺', en: 'New enemy: the Blood-Moon Werewolf heals fast and charges in a rage when badly hurt' },
      { zh: '「月夜突襲」的波次換上兩種新魔物並重新調整難度', en: 'Moonlit Raid waves now feature both new creatures, with difficulty retuned' },
    ],
  },
  {
    id: 55,
    date: '2026-10-17',
    title: { zh: '我的戰績', en: 'My Record' },
    items: [
      { zh: '成就頁右上角新增「統計」：遊戲時間、出戰與勝利次數、擊敗的敵人／首領／精英、建塔數、彩蛋與最常出戰的英雄', en: 'New Stats button on the achievements page: time played, battles and victories, enemies, bosses and elites defeated, towers built, easter eggs and your favourite hero' },
    ],
  },
  {
    id: 54,
    date: '2026-10-17',
    title: { zh: '番外篇：月夜突襲', en: 'Extra chapter: Moonlit Raid' },
    items: [
      { zh: '新關卡「月夜突襲」（通關黑潮海灣後解鎖）：血月之夜，副教主凜帶著蝙蝠、狼群與刺客突襲邊境村莊', en: 'New level “Moonlit Raid” (unlocks after Blacktide Cove): under a blood moon, Rin leads bats, wolves and assassins against the border village' },
      { zh: '全新夜戰：畫面變暗，防禦塔射程 -15%；但蓋在營火、民房燈光照得到的塔射程不減（建塔預覽會標示）。夜裡還有螢火蟲和蟋蟀聲', en: 'Night battles: the field goes dark and towers lose 15% range, except towers lit by campfires and houses (shown in the build preview). Watch for fireflies and listen for crickets' },
      { zh: '新增夜戰配樂、成就「守夜人」；每日挑戰新增修正「月黑風高」（10/18 起加入抽選）', en: 'New night battle theme, the “Night Watch” achievement, and a new Daily Challenge modifier “Dark Night” (in the draw from Oct 18)' },
    ],
  },
  {
    id: 53,
    date: '2026-10-17',
    title: { zh: '小改進', en: 'Small improvements' },
    items: [
      { zh: '升級塔時的預覽會用綠字標出傷害、射程、生命增加多少', en: 'Upgrade previews now show in green how much damage, range and health you gain' },
      { zh: '番外尾聲改在黑潮海灣的漁村慶祝', en: 'The extra epilogue now celebrates in the Blacktide Cove fishing village' },
    ],
  },
  {
    id: 52,
    date: '2026-10-17',
    title: { zh: '精英敵人', en: 'Elite enemies' },
    items: [
      { zh: '英雄挑戰與無盡模式會出現腳下發光的精英敵人：迅捷（更快）、堅韌（更硬）、再生（會回血）、護盾（帶護盾），賞金加倍', en: 'Elite enemies with a glowing ring now appear in Heroic and Endless: Swift, Tough, Regenerating or Shielded. They pay double bounty' },
      { zh: '點精英可以看到牠的詞綴；新成就「精英獵手」：累計擊敗 50 名精英', en: 'Tap an elite to see its trait; new achievement “Elite Hunter”: defeat 50 elites' },
      { zh: '每日挑戰新增修正「精英橫行」（10/18 起加入抽選）', en: 'New Daily Challenge modifier “Elite Rampage” (in the draw from Oct 18)' },
    ],
  },
  {
    id: 51,
    date: '2026-10-17',
    title: { zh: '手機介面調整', en: 'Phone layout fixes' },
    items: [
      { zh: '設定新增「介面大小」：選「大」可讓手機上的彈出面板、建塔選單與地圖按鈕再放大一些（重新整理後生效）', en: 'New UI size setting: Large makes pop-up panels, the build menu and map buttons a bit bigger on phones (applies after a reload)' },
      { zh: '修正 16:9 手機上地圖左下的商店鈕被關閉鈕蓋住', en: 'Fixed the Shop button hiding under the close button on 16:9 phones' },
      { zh: '修正手機上英雄室技能名稱與說明、每日挑戰的修正名稱與說明疊在一起', en: 'Fixed names overlapping descriptions in the hero room and the Daily Challenge panel on phones' },
      { zh: '中文說明不再在數字前後提早換行（例如「恢復 5 / 條生命」）', en: 'Chinese descriptions no longer break early around numbers' },
      { zh: '首次載入更快：角色圖改用較小的圖檔', en: 'Faster first load: character art now uses smaller files' },
    ],
  },
  {
    id: 50,
    date: '2026-10-17',
    title: { zh: '戰場環境音', en: 'Battlefield ambience' },
    items: [
      { zh: '每種地形都有自己的環境音：海灣的浪聲與海鷗、雪山的呼嘯寒風、草原的微風鳥鳴、火山的低沉轟鳴與火星劈啪、荒原的陰森低鳴（跟著音效音量）', en: 'Every land now has its own ambience: surf and gulls at the cove, howling wind in the snow, breeze and birdsong in the meadows, a deep rumble and crackling embers at the volcano, an eerie drone in the wastes (follows the sound volume)' },
    ],
  },
  {
    id: 49,
    date: '2026-10-17',
    title: { zh: '黑潮海灣：火藥桶機關', en: 'Blacktide Cove: powder kegs' },
    items: [
      { zh: '黑潮海灣的沉船上堆著火藥桶：點一下讓它沿著海灘的路滾下去，滾到底轟然爆炸，炸傷並暈眩一整群敵人', en: 'Powder kegs are stacked on the wreck in Blacktide Cove: tap them to roll one down the beach road, where it blows up and stuns a whole crowd' },
    ],
  },
  {
    id: 48,
    date: '2026-10-17',
    title: { zh: '每日任務', en: 'Daily quests' },
    items: [
      { zh: '地圖右上角新增「任務」：每天三個小任務（擊敗敵人、建塔、三星通關、擊敗首領……），完成後領寶石，午夜換新', en: 'New Quests button on the map: three small tasks every day (defeat enemies, build towers, win with 3 stars, slay a boss…) that pay out gems, refreshed at midnight' },
      { zh: '戰鬥結算時會提示完成了哪些任務，地圖按鈕的紅點表示有獎勵可領', en: 'The result screen tells you when a quest is complete, and a red dot on the map button means a reward is waiting' },
    ],
  },
  {
    id: 47,
    date: '2026-10-17',
    title: { zh: '戰場彩蛋', en: 'Battlefield easter eggs' },
    items: [
      { zh: '戰場上藏了一百多個彩蛋：敲敲房門、驚起樹上的鳥、看看石頭後面躲著誰、湖裡會跳出魚……每找到一個新的送 1 顆寶石', en: 'Over a hundred easter eggs hide on the battlefields: knock on doors, startle birds from the trees, find out who lurks behind the rocks, catch a fish leaping from the lake… each new one is worth a gem' },
      { zh: '草原上有隻綿羊，連點五下會發生什麼事呢？', en: 'There is a sheep in the meadow. What happens if you tap it five times?' },
      { zh: '新成就「好奇寶寶」：發現 15 個彩蛋', en: 'New achievement “Curious Mind”: find 15 easter eggs' },
    ],
  },
  {
    id: 46,
    date: '2026-10-17',
    title: { zh: '番外篇：黑潮海灣', en: 'Extra chapter: Blacktide Cove' },
    items: [
      { zh: '新關卡「黑潮海灣」（通關熔岩火山口後解鎖）：全新海岸地形，椰林、沙灘與海浪，兩條路在漁村前匯流', en: 'New level “Blacktide Cove” (unlocks after Ember Crater): a brand-new coastal land with palms, sand and surf, where two roads meet before the fishing village' },
      { zh: '新敵人：殼硬抗物理的礁岩巨蟹、會自我修復的溺亡者', en: 'New enemies: armored reef crabs and the self-mending drowned' },
      { zh: '新首領「深淵利維坦」：掀起巨浪讓附近的塔停擺、潛入水中向前衝，還會喚來巨蟹', en: 'New boss, the Abyssal Leviathan: its tidal waves knock out nearby towers, it dives and surges ahead, and it calls reef crabs' },
      { zh: '新增海灣戰鬥配樂、番外尾聲與成就「平息怒海」；首領連戰增加為十名首領', en: 'New coastal battle theme, an extra epilogue and the “Calm Waters” achievement; Boss Rush now has ten bosses' },
    ],
  },
  {
    id: 45,
    date: '2026-10-17',
    title: { zh: '角色開口說話了', en: 'Heroes, bosses and towers speak' },
    items: [
      { zh: '八位英雄都有中英文配音：選定、開戰、移動、施放絕招時會喊話並冒出對話泡泡；英雄室點頭像也會打招呼', en: 'All eight heroes are voiced in Chinese and English: they speak with a speech bubble when chosen, at the first wave, when moved and when casting their ultimate, and greet you in the hero room' },
      { zh: '八位首領登場時會放話（頭上泡泡或畫面字幕，關掉聲音也看得到）；沙暴巨蟲則會震耳咆哮', en: 'Eight bosses taunt you on arrival (as a bubble or caption, readable with the sound off); the Sandstorm Wyrm roars' },
      { zh: '英文模式下防禦塔也會說出泡泡上的台詞（中文配音之後補上）', en: 'Towers speak their bubble lines in English (Chinese voices coming later)' },
      { zh: '設定新增「角色語音」開關', en: 'New Voices switch in Settings' },
    ],
  },
  {
    id: 44,
    date: '2026-10-17',
    title: { zh: '全新原創配樂', en: 'All-new soundtrack' },
    items: [
      { zh: '十首新配樂：標題、世界地圖、草原／森林／雪山／荒原／沙漠／火山各有專屬戰鬥曲，首領登場與最終關另有專屬音樂', en: 'Ten new tracks: title, world map, a battle theme for each land, plus boss and final-battle music' },
      { zh: '勝利時奏起主題曲的收尾和弦，結算時戰鬥配樂會先淡出', en: 'Victory plays the main theme’s closing chord, and battle music fades out on the result screen' },
      { zh: '圖鑑新增「音樂」分頁，到過的地區就能自由聆聽', en: 'New Music tab in the encyclopedia: listen to every track from lands you have reached' },
      { zh: '設定裡的音樂、音效可切換 關／30%／60%／100%', en: 'Music and sound volume step through Off / 30% / 60% / 100% in Settings' },
    ],
  },
  {
    id: 43,
    date: '2026-10-17',
    title: { zh: '英雄更好用', en: 'Hero upgrades' },
    items: [
      { zh: '關卡面板「出征」旁有英雄頭像，點一下就能直接換出戰英雄（附名字）', en: 'Swap heroes right from the level panel: tap the portrait next to Battle' },
      { zh: '英雄室新增「訓練」：花 40 寶石獲得這一級所需經驗的 40%（約 3 次升一級）', en: 'New Train button in the hero room: 40 gems buy 40% of the XP needed for the next level (about 3 per level)' },
    ],
  },
  {
    id: 41,
    date: '2026-10-17',
    title: { zh: '每日登入獎勵', en: 'Daily login reward' },
    items: [
      { zh: '每天第一次打開地圖可以領寶石，連續登入 7 天獎勵遞增（第 7 天 30 顆）；中斷就從第 1 天重來', en: 'Claim gems the first time you open the map each day; seven days in a row pays more each day (30 on day 7), and missing a day starts over' },
      { zh: '新成就「忠誠守衛」：連續 7 天領取登入獎勵', en: 'New achievement Loyal Guardian: claim the daily reward 7 days in a row' },
    ],
  },
  {
    id: 33,
    date: '2026-10-17',
    title: { zh: '手機更好點、更好讀', en: 'Bigger on phones' },
    items: [
      { zh: '手機上的戰鬥按鈕、圖示與文字再放大，寬螢幕手機放大更多', en: 'Battle buttons, icons and text are larger on phones, more so on wide screens' },
      { zh: '建造點、塔、英雄與地圖機關的點擊範圍加大，更不容易點錯', en: 'Build spots, towers, heroes and traps have larger tap areas' },
      { zh: '選單、彈出視窗、英雄室與升級畫面的字也一起放大', en: 'Menus, pop-ups, the hero room and upgrades use larger text too' },
    ],
  },
  {
    id: 32,
    date: '2026-10-17',
    title: { zh: '每日挑戰新修正', en: 'New daily modifiers' },
    items: [
      { zh: '從 10/18 起每日挑戰多四種修正：蝠群夜襲（每波多一群蝙蝠）、巨魔之血（敵人回血）、山崩季節（地圖機關冷卻減半、傷害 +50%）、英雄之日（絕招冷卻 -40%）', en: 'From Oct 18 daily challenges can roll four new modifiers: Bat Swarm (extra bats every wave), Troll Blood (enemies regenerate), Rockslide Season (traps recharge twice as fast and hit harder) and Hero’s Day (ultimate recharges 40% faster)' },
    ],
  },
  {
    id: 31,
    date: '2026-10-17',
    title: { zh: '成就進度條', en: 'Achievement progress' },
    items: [
      { zh: '累積型成就（擊殺數、建塔數、全三星、挑戰全通、每日挑戰天數、無盡波數、英雄等級）會顯示目前進度與進度條', en: 'Cumulative achievements (kills, towers built, all stars, all challenges, daily streak, endless wave, hero level) now show your current progress with a bar' },
    ],
  },
  {
    id: 30,
    date: '2026-10-17',
    title: { zh: '戰鬥存檔點', en: 'Battle checkpoints' },
    items: [
      { zh: '每一波開始前會自動存檔；手機切到別的 App 被重新整理時，回到標題畫面可以選擇「繼續戰鬥」，塔、金幣和生命都會保留，從那一波重新開始', en: 'The game now saves a checkpoint before every wave. If your phone reloads the page while you’re away, the title screen offers to continue: your towers, gold and lives are kept and the wave starts again' },
    ],
  },
  {
    id: 29,
    date: '2026-10-17',
    title: { zh: '新模式：首領連戰', en: 'New mode: Boss Rush' },
    items: [
      { zh: '通關最終關後，每張地圖的關卡面板多了「首領連戰」：九名首領依序登場、各帶隨行部隊，依剩餘生命給 1~3 星，每張地圖各自記錄', en: 'After beating the finale, every map’s level panel gets a “Boss Rush” tab: all nine bosses one after another, each with an escort. Earn 1–3 stars by lives left, recorded per map' },
      { zh: '每張地圖第一次通關給大量寶石；新成就「首領獵人」', en: 'Big gem reward for the first clear on each map; new achievement “Boss Hunter”' },
    ],
  },
  {
    id: 28,
    date: '2026-10-17',
    title: { zh: '首領擊破的瞬間', en: 'Boss takedown moment' },
    items: [
      { zh: '擊倒首領時畫面閃光、短暫慢動作，並跳出「首領擊破！」與首領名字', en: 'Felling a boss now flashes the screen, slows time for a moment and shows “Boss defeated!” with the boss’s name' },
    ],
  },
  {
    id: 27,
    date: '2026-10-17',
    title: { zh: '第八位英雄：影', en: 'Eighth hero: Shade' },
    items: [
      { zh: '無聲刺客「影」：通關外傳終章「熔岩火山口」後加入，出手極快的近戰刺客', en: 'Shade the Silent Blade joins after the side-story finale, Ember Crater: a lightning-fast melee assassin' },
      { zh: '技能：瞬影（瞬移到術士、弓手或最虛弱的敵人身後背刺）、煙霧彈（暈眩並減速周圍敵人、自己回血）、處決（秒殺生命低於 22% 的敵人）；絕招「千刃亂舞」連斬 12 次並留下兩個影分身', en: 'Skills: Shadow Step (blinks behind a caster, archer or the weakest foe for a backstab), Smoke Bomb (stuns and slows nearby foes, heals Shade), Execute (finishes enemies below 22% health). Ultimate “Thousand Cuts” slashes 12 times and leaves two shadow clones' },
      { zh: '外傳尾聲多了影的現身台詞', en: 'Shade makes an appearance in the side-story epilogue' },
    ],
  },
  {
    id: 26,
    date: '2026-10-17',
    title: { zh: '塔的戰績與落石音效', en: 'Tower stats and rumbling traps' },
    items: [
      { zh: '點選防禦塔時會顯示它本場造成的傷害與擊殺數', en: 'Selecting a tower now shows how much damage it has dealt and how many enemies it has felled this battle' },
      { zh: '落石與雪球滾動時有低沉的隆隆聲和碎石聲', en: 'Rolling boulders and snowballs now rumble and scatter pebbles' },
    ],
  },
  {
    id: 25,
    date: '2026-10-17',
    title: { zh: '外傳尾聲', en: 'Side-story epilogue' },
    items: [
      { zh: '通關外傳終章「熔岩火山口」後，可以觀看外傳尾聲：英雄們回村慶祝，接著播放製作群名單', en: 'Clearing the side-story finale, Ember Crater, now unlocks a side-story epilogue: the heroes head home to celebrate, followed by the credits' },
    ],
  },
  {
    id: 24,
    date: '2026-10-17',
    title: { zh: '本場 MVP', en: 'Battle MVP' },
    items: [
      { zh: '勝利畫面會標出本場傷害最高的塔（MVP），附上傷害與擊殺數；兵營士兵與塔放出的火焰也算進該塔', en: 'The victory screen now names the battle’s MVP tower — the one that dealt the most damage — with its damage and kills. Barracks soldiers and tower fire count toward their tower' },
    ],
  },
  {
    id: 23,
    date: '2026-10-17',
    title: { zh: '外傳終章：熔岩火山口', en: 'Side-story finale: Ember Crater' },
    items: [
      { zh: '新外傳關卡「熔岩火山口」（通關冰封隘口後解鎖）：全新火山地形，熔岩池、火星與灰燼，崖邊還有玄武岩落石', en: 'New side-story level “Ember Crater” (unlocks after Frozen Pass): a brand-new volcanic land with lava pools, embers and ash, plus a basalt boulder trap' },
      { zh: '新敵人：熔岩小魔（快速、魔抗、會閃避）、熔岩魔像（重甲、範圍攻擊，被打碎時迸出兩隻小魔）', en: 'New enemies: the Magma Imp (fast, magic-resistant, dodges) and the Lava Golem (armored, hits an area, bursts into two imps when shattered)' },
      { zh: '新首領「炎魔・伊格尼斯」：熔岩噴發會燒停附近的塔（塔會發紅）、召喚熔岩魔像、重傷時狂暴；新成就「撲滅烈焰」，「外傳完結」改為通關本關', en: 'New boss “Ignis the Fire Lord”: lava bursts scorch nearby towers (they glow red), it summons lava golems and enrages when hurt. New achievement “Fire Fighter”; “Side Story Complete” now asks for this level' },
    ],
  },
  {
    id: 22,
    date: '2026-10-17',
    title: { zh: '世界地圖動起來了', en: 'A livelier world map' },
    items: [
      { zh: '世界地圖上有雲影與薄雲緩緩飄過、偶爾一群鳥飛過，關卡旗幟會隨風飄動', en: 'Cloud shadows and wisps drift across the world map, flocks of birds fly by now and then, and the level flags flutter in the wind' },
    ],
  },
  {
    id: 21,
    date: '2026-10-17',
    title: { zh: '更多地圖機關', en: 'More map traps' },
    items: [
      { zh: '第 6、10 關與灼熱沙丘、巨蟲巢穴也有可以推下的落石／雪球（沙漠是砂岩、教派荒地是帶紫晶的玄武岩），共 8 關有機關', en: 'Levels 6 and 10, Scorching Dunes and the Wyrm’s Nest now have traps too (sandstone in the desert, crystal-studded basalt in the cult wastes) — 8 levels in all' },
    ],
  },
  {
    id: 20,
    date: '2026-10-17',
    title: { zh: '守軍會說話了', en: 'Your defenders speak up' },
    items: [
      { zh: '蓋塔、升級、點塔和移動英雄時，守軍偶爾會冒出一句台詞；每種特化塔和每位英雄都有自己的對白', en: 'Towers and heroes now pipe up with a line now and then when you build, upgrade, select or move them. Every specialization and hero has their own lines' },
    ],
  },
  {
    id: 19,
    date: '2026-10-17',
    title: { zh: '關卡縮圖與 3 倍速', en: 'Level previews and 3× speed' },
    items: [
      { zh: '世界地圖的關卡面板會顯示該關的手繪戰場縮圖，進關時直接沿用，載入更快', en: 'The level panel on the world map shows a painted preview of the battlefield, which is reused when the battle starts so it loads faster' },
      { zh: '戰鬥速度可切換 1x → 2x → 3x', en: 'Battle speed now cycles 1x → 2x → 3x' },
      { zh: '關卡說明太長時自動縮小字級，不再壓到難度按鈕', en: 'Long level descriptions shrink to fit instead of overlapping the difficulty buttons' },
    ],
  },
  {
    id: 18,
    date: '2026-10-17',
    title: { zh: '地圖機關：落石與雪崩', en: 'Map traps: boulders and avalanches' },
    items: [
      { zh: '第 4、5、9 關與冰封隘口的崖邊多了落石／大雪球：點一下推下去，沿路滾動砸傷敵人（落石暈眩、雪球減速），約 35~40 秒後恢復', en: 'Levels 4, 5, 9 and Frozen Pass now have a boulder or giant snowball on a ledge: tap it to send it rolling down the road, crushing enemies (boulders stun, snowballs slow). It comes back after 35–40 seconds' },
      { zh: '新成就「山崩地裂」：一次擊倒 5 名敵人', en: 'New achievement “Landslide”: crush 5 enemies with one roll' },
    ],
  },
  {
    id: 17,
    date: '2026-10-17',
    title: { zh: '更省記憶體、慶功場景換新', en: 'Lighter on memory, new celebration scene' },
    items: [
      { zh: '戰鬥中先釋放世界地圖與標題圖，手機記憶體用量約減少四分之一', en: 'The world map and title art are released during battles, cutting memory use on phones by about a quarter' },
      { zh: '通關尾聲的慶功場景改用手繪的邊境村莊', en: 'The ending celebration now takes place in the painted border village' },
      { zh: '成就提示移到結算面板上方，不再蓋住「勝利」', en: 'Achievement pop-ups sit above the result panel instead of covering “Victory”' },
    ],
  },
  {
    id: 16,
    date: '2026-10-17',
    title: { zh: '第七位英雄：維克托', en: 'Seventh hero: Viktor' },
    items: [
      { zh: '鐵壁元帥維克托：通關最終關「終焉之門」後加入，重甲長槍、專門擋住最硬的敵人', en: 'Viktor the Iron Marshal joins after you clear the finale, Gate of the End: heavy plate and a spear made for holding back the toughest foes' },
      { zh: '技能：長槍貫刺（刺穿一排敵人）、鐵壁方陣（敵人減速、友軍加護甲）、破甲重擊（目標受到的傷害 +30%）；絕招「長槍壁壘」暈眩敵人並召喚三名重甲槍兵', en: 'Skills: Spear Thrust (pierces a line of enemies), Iron Phalanx (slows foes, armors allies), Sunder (target takes +30% damage). Ultimate “Spear Wall” stuns enemies and summons three armored spearmen' },
      { zh: '英雄室改成兩欄，七位英雄一次看得到', en: 'The hero room now uses two columns so all seven heroes fit' },
      { zh: '解鎖新英雄時，回到地圖會跳出介紹卡，可直接前往英雄室', en: 'Unlocking a hero now shows an introduction card on the map with a shortcut to the hero room' },
    ],
  },
  {
    id: 15,
    date: '2026-10-17',
    title: { zh: '新外傳關卡：冰封隘口', en: 'New side-story level: Frozen Pass' },
    items: [
      { zh: '第 15 關「冰封隘口」：打通巨蟲巢穴後解鎖，兩條雪道在隘口匯合', en: 'Level 15 “Frozen Pass” unlocks after Wyrm’s Nest: two snowy roads meet at the pass' },
      { zh: '新敵人：冰原雪怪（魔抗、範圍拳擊）、冰霜精靈（飛行、魔抗，交給弓箭手）', en: 'New enemies: the Glacier Yeti (magic resist, area punches) and the Frost Sprite (flying, magic resist; leave it to archers)' },
      { zh: '新 BOSS：冰霜巨人・約頓，踏地會凍住附近的塔並喚來雪怪', en: 'New boss: Jotun the Frost Giant, whose stomp freezes nearby towers and calls yetis' },
      { zh: '新成就：冰河崩塌（擊敗冰霜巨人）、外傳完結（通關冰封隘口）', en: 'New achievements: Glacier Breaker (defeat the frost giant) and Side Story Complete (clear Frozen Pass)' },
    ],
  },
  {
    id: 14,
    date: '2026-10-17',
    title: { zh: '新的載入畫面', en: 'New loading screen' },
    items: [
      { zh: '載入時改用手繪主視覺當背景，並隨機顯示一則遊戲小技巧', en: 'The loading screen shows the painted key art and a random gameplay tip' },
    ],
  },
  {
    id: 13,
    date: '2026-10-16',
    title: { zh: '會動的戰場', en: 'Living battlefields' },
    items: [
      { zh: '營火會冒煙、噴火星，祭壇散發紫光，湖面與河流閃閃發亮', en: 'Campfires smoke and spark, altars pulse with purple light, lakes and rivers glitter' },
      { zh: '草原與森林有蝴蝶飛舞，荒地飄著紫色微光，沙漠吹起陣陣風沙', en: 'Butterflies over meadows and forests, purple motes drifting across the wastelands, sand gusts in the desert' },
    ],
  },
  {
    id: 12,
    date: '2026-10-16',
    title: { zh: '14 張戰場全部手繪', en: 'All 14 battlefields hand-painted' },
    items: [
      { zh: '每一關的戰場背景都重繪成手繪風格：草原、森林、雪原、楓林、荒地與沙漠，道路與建造點位置完全不變', en: 'Every battlefield is repainted: meadows, forests, snowfields, autumn woods, wastelands and deserts. Roads and build spots stay exactly where they were' },
      { zh: '背景圖在進入關卡時才下載（每關約 200 KB）', en: 'Each battlefield downloads when you enter the level (about 200 KB each)' },
    ],
  },
  {
    id: 11,
    date: '2026-10-16',
    title: { zh: '手繪世界地圖', en: 'Hand-painted world map' },
    items: [
      { zh: '世界地圖整張重繪：沙漠、森林、雪山、楓林、荒地與深淵之門，關卡位置不變', en: 'The whole world map is repainted: desert, forest, snowy peaks, autumn woods, the wasteland and the abyss gate. Level locations are unchanged' },
      { zh: '第 11 關的旗子往上移，手機上不會被下方按鈕擋住', en: 'Level 11\'s flag moved up so the bottom buttons no longer cover it on phones' },
    ],
  },
  {
    id: 10,
    date: '2026-10-16',
    title: { zh: '砲管換新', en: 'New cannon barrels' },
    items: [
      { zh: '四種砲塔的臼砲（木砲、鐵砲、青銅砲、巨砲貝莎）換成手繪造型', en: 'All four mortars (wood, iron, bronze and Big Bertha) are hand-painted to match the towers' },
      { zh: '修正砲口方向：現在會朝向正在攻擊的敵人', en: 'Fixed barrel direction: mortars now lean toward the enemy they are shelling' },
    ],
  },
  {
    id: 9,
    date: '2026-10-16',
    title: { zh: '全新標題畫面', en: 'New title screen' },
    items: [
      { zh: '標題畫面換成手繪主視覺：騎士與守軍迎戰巨魔、惡魔大軍，背景是遠方的王城', en: 'A hand-painted title illustration: the knight and his garrison face a horde of trolls and imps, with the royal castle in the distance' },
      { zh: '分享連結時的預覽圖也換成新主視覺', en: 'Shared links now preview the new artwork' },
    ],
  },
  {
    id: 8,
    date: '2026-10-16',
    title: { zh: '防禦塔換上手繪新造型', en: 'Hand-painted towers' },
    items: [
      { zh: '弓箭、法師、兵營、砲塔共 20 種造型（含所有分支）全部重繪，升級時外觀變化更明顯', en: 'All 20 tower looks (every level and branch) are repainted, so upgrades read at a glance' },
      { zh: '弓箭手和法師站在城垛後面，箭矢、法球、砲彈從塔頂射出', en: 'Archers and mages stand behind the battlements; arrows, bolts and shells now fly from the tower tops' },
      { zh: '建造選單的塔圖示也一起更新', en: 'Build-menu tower icons match the new art' },
    ],
  },
  {
    id: 7,
    date: '2026-10-16',
    title: { zh: '魔物換上手繪新造型', en: 'Hand-painted monsters' },
    items: [
      { zh: '哥布林、狼、巨魔、蝙蝠、骷髏、蠍子、惡魔、沙暴巨蟲，以及變羊與石像，全部換成和英雄同風格的手繪圖', en: 'Goblins, wolves, trolls, bats, skeletons, scorpions, demons, the Sandstorm Wyrm, plus the sheep and stone golem now share the heroes\' painted style' },
      { zh: '圖鑑的敵人標籤恢復底框', en: 'Enemy tags in the encyclopedia have their backgrounds again' },
    ],
  },
  {
    id: 6,
    date: '2026-10-16',
    title: { zh: '雙指縮放地圖', en: 'Pinch to zoom' },
    items: [
      { zh: '戰鬥中可雙指放大地圖（最多 2.2 倍），放大後拖曳移動；縮回就看到整張地圖。電腦可用滾輪', en: 'Pinch to zoom the battlefield (up to 2.2x) and drag to move around; pinch back out to see the whole map. Mouse wheel on desktop' },
      { zh: '拖曳地圖時不會再誤點蓋塔', en: 'Dragging the map no longer triggers accidental builds' },
    ],
  },
  {
    id: 5,
    date: '2026-10-16',
    title: { zh: '手機按鈕更好按', en: 'Bigger buttons on phones' },
    items: [
      { zh: '手機上英雄、法術、絕招、道具、暫停／加速、建塔選單、呼叫波次與地圖按鈕整體放大', en: 'On phones, hero, spell, ultimate, item, pause/speed, build menu, wave call and map buttons are all larger' },
      { zh: '微調第 5、9、10、14 關各一個建造點，避免被放大的按鈕蓋住', en: 'Nudged one build spot each in levels 5, 9, 10 and 14 so the bigger buttons do not cover them' },
    ],
  },
  {
    id: 4,
    date: '2026-10-16',
    title: { zh: '手機文字更清楚', en: 'Readable text on phones' },
    items: [
      { zh: '手機上的小字自動放大；關卡資訊、每日挑戰、結算、劇情對話等視窗整體放大', en: 'Small text is enlarged on phones; level info, daily challenge, results and story dialogs are scaled up as a whole' },
      { zh: '修正多處文字擠在一起或超出框外（成就、商店、英雄、更新內容）', en: 'Fixed overlapping or clipped text in achievements, shop, heroes and what\'s new' },
    ],
  },
  {
    id: 3,
    date: '2026-10-16',
    title: { zh: '每日挑戰與分享成績', en: 'Daily Challenge & sharing' },
    items: [
      { zh: '地圖右上新增每日挑戰：每天換一關＋兩個修正，所有人同一題（通過該關即可挑戰）', en: 'New Daily Challenge (top right of the map): one level and two modifiers per day, the same for everyone (clear that level to take it on)' },
      { zh: '每天第一次通過可得寶石，連續挑戰還有新成就', en: 'Gems for your first clear each day, plus new achievements' },
      { zh: '結算畫面可一鍵分享成績給朋友', en: 'Share your result with friends from the results screen' },
    ],
  },
  {
    id: 2,
    date: '2026-10-16',
    title: { zh: '修正 iPhone 閃退', en: 'iPhone crash fix' },
    items: [
      { zh: '大幅降低手機的記憶體用量，修正 iPhone 橫向遊玩時頁面「重複發生問題」而無法開啟', en: 'Much lower memory use on phones; fixes the page crashing ("a problem repeatedly occurred") on iPhone in landscape' },
      { zh: '萬一又意外關閉，下次開啟會自動改用「省電」畫質', en: 'If the game still closes unexpectedly, it switches to Low graphics on the next launch' },
    ],
  },
  {
    id: 1,
    date: '2026-10-16',
    title: { zh: '首次公開測試', en: 'First public test' },
    items: [
      { zh: '12 關主線戰役＋2 關沙漠外傳，6 種地形與 7 名首領', en: '12 campaign levels plus 2 desert side levels, 6 terrains and 7 bosses' },
      { zh: '6 位英雄，各有 3 個技能與 1 個手動絕招（左下金色按鈕）', en: '6 heroes, each with 3 skills and a hand-cast ultimate (gold button)' },
      { zh: '4 種防禦塔、8 種特化與 16 個技能', en: '4 towers, 8 specializations and 16 skills' },
      { zh: '英雄挑戰、鋼鐵挑戰、無盡模式與 27 項成就', en: 'Heroic, Iron and Endless modes, plus 27 achievements' },
      { zh: '寶石商店：炸藥桶、冰霜水晶、生命藥水、金幣袋', en: 'Gem shop: powder kegs, frost crystals, heart potions, gold sacks' },
      { zh: '設定可備份存檔、切換畫質；手機橫向遊玩最順手', en: 'Back up your save and change graphics in Settings; best played in landscape' },
    ],
  },
];
