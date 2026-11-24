// 圖鑑：每種機體與設施一則，照這裡的順序排。數值、武器、技能直接讀 units.ts，這裡只有分類和一段介紹。
// 介紹只寫第一次遇到它時就知道的事，不透露後面的劇情（圖鑑是遇到之後才看得到那一則）。
// tests/starfall/records.test.ts 會檢查 units.ts 裡的每一種都在這裡、而且只出現一次。
import type { L10n } from '../sim/types';

/** squad = 我方、swarm = 機群、directorate = 議會軍、site = 要保護的設施 */
export type Faction = 'squad' | 'swarm' | 'directorate' | 'site';

export interface CodexEntry {
  /** units.ts 的編號 */
  id: string;
  faction: Faction;
  note: L10n;
}

export const CODEX: readonly CodexEntry[] = [
  { id: 'kai', faction: 'squad', note: { zh: '凱・洛文的座機，拾荒隊的隊長機。零件多半是從冰原上撿回來的，壞了也修得起。遠近都能打，隊友站在它旁邊打得更準。', en: "Kai Rowen's frame and the salvage crew's lead. Most of its parts were picked off the ice, so it is easy to keep running. Good at any range, and squadmates beside it shoot straighter." } },
  { id: 'bruno', faction: 'squad', note: { zh: '布魯諾・鐸爾的座機。原本是碼頭的裝卸骨架，裝載臂還留著，裝甲和加農砲是後來加的。走得慢，但站在它旁邊的人比較不會受傷。', en: "Bruno Dahl's frame. It began as a dockside loader and still has the loader arm; the plating and the cannon came later. Slow, but anyone standing next to it gets hurt less." } },
  { id: 'vey', faction: 'squad', note: { zh: '薇・桑德從議會軍帶出來的狙擊型骨架，塗裝還是議會軍的。站得越高，打得越遠。', en: 'The sniper frame Vey Sander took with her when she left the Directorate, still in Directorate colours. The higher it stands, the farther it reaches.' } },
  { id: 'echo', faction: 'squad', note: { zh: '拒絕加入合唱的殘響，借住在一台支援無人機的外殼裡。她的工作是記住名字 —— 四萬零一十二個。會修理骨架，也能癱瘓敵人。', en: 'An Echo that refused to join the Chorus, living in the shell of a support drone. Her job is to remember names, forty thousand and twelve of them. She repairs frames and can disable an enemy.' } },
  { id: 'sparrow', faction: 'squad', note: { zh: '紗羅・米洛夫的輕型骨架，型號沒有登記。她開著它在冰下電車線上送信，跑得比追她的東西都快。', en: "Sara Mirov's light frame, model unregistered. She runs messages along the under-ice tram line in it, faster than anything that chases her." } },
  { id: 'hale_ally', faction: 'squad', note: { zh: '海爾少校的白色指揮機。這一次它站在拾荒隊這一邊，「督戰令」能讓一台友軍再動一次。', en: "Major Hale's white command frame. This time it stands with the salvage crew, and its Rally Order lets one ally act again." } },
  { id: 'worker', faction: 'swarm', note: { zh: '曙光號的維修無人機。單獨一台不難對付，但它們從來不單獨行動。', en: "The Aurelia's maintenance drones. One alone is no trouble, but they are never alone." } },
  { id: 'sentry', faction: 'swarm', note: { zh: '船上的武裝仿生機。沒有特別的弱點，也沒有特別的長處。', en: "The ship's armed androids. No particular weakness, and no particular strength." } },
  { id: 'weaver', faction: 'swarm', note: { zh: '背著迫擊砲的蜘蛛型機體。砲彈會越過牆、波及旁邊的人，但打不到貼近它的目標。', en: 'A spider-legged machine with a mortar on its back. Its shells arc over walls and splash nearby units, but it cannot hit anything close to it.' } },
  { id: 'hunter', faction: 'swarm', note: { zh: '追獵無人機。跑得很快，專挑已經受傷的目標下手。', en: 'A pursuit drone. Very fast, and it goes for whatever is already damaged.' } },
  { id: 'shepherd', faction: 'swarm', note: { zh: '合唱的指揮節點，守著通往 C-7 的斷橋。艾可說，它以前是她隔壁艙的導覽員。', en: 'A command node of the Chorus, holding the Broken Span on the road to C-7. Echo says it used to be the tour guide in the bay next to hers.' } },
  { id: 'relay', faction: 'swarm', note: { zh: '替合唱體分擔傷害的節點，一座分擔四分之一。每拆掉一座，歌聲就小一點。', en: 'A node that takes a share of the damage dealt to the Choir, a quarter each. Every one you break makes the song quieter.' } },
  { id: 'choir', faction: 'swarm', note: { zh: '領唱者的本體：不是一台機器，是一整圈一起開口的機器。先拆兩側的中繼節點，再打它。', en: 'The body of the Cantor: not one machine but a ring of machines opening their mouths together. Break the relay nodes at its sides first.' } },
  { id: 'mender', faction: 'swarm', note: { zh: '會把你打壞的東西修好的無人機，連首領也修。先處理它，不然打不完。', en: 'A drone that repairs whatever you damage, bosses included. Deal with it first or the fight never ends.' } },
  { id: 'warden', faction: 'swarm', note: { zh: '裝甲很厚的重裝機體。鐵砧的震盪砲推不動它 —— 布魯諾試過了。', en: "A heavy walker with very thick armor. Anvil's Shock Cannon cannot move it. Bruno tried." } },
  { id: 'needle', faction: 'swarm', note: { zh: '狙擊無人機，射程比長庚還長。貼近了它就打不到人。', en: 'A sniper drone that outranges even Vesper. Get close and it cannot hit you.' } },
  { id: 'gatekeeper', faction: 'swarm', note: { zh: '主反應爐的守衛，胸口還留著曙光號出發那天的船徽。光束會掃一整排，不要站成一直線。', en: "The guardian of the main reactor, still wearing the Aurelia's emblem from the day she set out. Its beam rakes a whole line, so do not line up." } },
  { id: 'lancer', faction: 'directorate', note: { zh: '議會軍的制式機。訓練有素：打它一槍，它一定還你一槍，而且不打折。', en: 'The standard Directorate frame. Well drilled: shoot one and it shoots back, at full strength.' } },
  { id: 'bastion', faction: 'directorate', note: { zh: '議會軍的重盾機，正面是雙層裝甲。繞到側面或背後再打。', en: 'A Directorate shield frame with double plating in front. Go around to the side or the rear.' } },
  { id: 'turret', faction: 'directorate', note: { zh: '議會軍架設的自動砲塔。不會動，但射程很長。', en: 'An automatic gun set up by the Directorate. It cannot move, but it reaches a long way.' } },
  { id: 'hale', faction: 'directorate', note: { zh: '海爾少校的白色指揮機。電車線上的人說：白色的來了，就是有人要被「清除」了。', en: "Major Hale's white command frame. People on the tram line say that when the white one shows up, somebody is about to be \"sterilized\"." } },
  { id: 'breacher', faction: 'directorate', note: { zh: '議會軍的突擊機，專門繞背。把背貼著牆，或者貼著隊友。', en: 'A Directorate assault frame built to get behind you. Keep your back to a wall or to a friend.' } },
  { id: 'thunderer', faction: 'directorate', note: { zh: '四條腿的自走攻城砲。打得很遠、會波及旁邊，貼近了就打不到人 —— 得有人衝出去。', en: 'A four-legged siege gun. Long reach and splash damage, but it cannot hit anything close to it. Somebody has to go out there.' } },
  { id: 'projector', faction: 'directorate', note: { zh: '發出琥珀色光的裝置，三格內的議會軍少挨四分之一的傷害。先拆它。', en: 'A device glowing amber. Directorate units within three tiles take a quarter less damage. Break it first.' } },
  { id: 'tribunal', faction: 'directorate', note: { zh: '瓦爾加元帥的座機，比守門者還高。海爾少校在它後面站了二十年。', en: "Marshal Varga's own frame, taller than the Gatekeeper. Major Hale stood behind it for twenty years." } },
  { id: 'generator', faction: 'site', note: { zh: '維生發電機。它一停，靠它取暖的人撐不過一個晚上。', en: 'A life-support generator. If it stops, the people it keeps warm will not last the night.' } },
  { id: 'pods', faction: 'site', note: { zh: 'C-7 艙段的冬眠艙。每一個裡面都睡著一個人。', en: 'Sleep pods in bay C-7. There is a person asleep in every one.' } },
];
