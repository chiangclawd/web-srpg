// 自動對戰：雙方都交給 AI 打完每一關，看關卡打不打得過、要幾回合。
// 用法：npx tsx scripts/starfall-sim.ts [missionId] [-v]
import { Battle } from '../src/starfall/sim/Battle';
import { autoPlay } from '../src/starfall/sim/ai';
import { MISSIONS } from '../src/starfall/data/missions';
import { UNITS } from '../src/starfall/data/units';

const only = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : null;
const verbose = process.argv.includes('-v');
for (const m of MISSIONS) {
  if (only && m.id !== only) continue;
  const b = new Battle(m, UNITS);
  const name = (uid: number): string => `${b.unit(uid).def.id}#${uid}`;
  const r = autoPlay(b, 40, verbose ? (ev) => {
    for (const e of ev) {
      if (e.t === 'phase') console.log(`── turn ${e.turn} ${e.side}`);
      else if (e.t === 'move') console.log(`   ${name(e.uid)} → ${e.path[e.path.length - 1].x},${e.path[e.path.length - 1].y}`);
      else if (e.t === 'attack') console.log(`   ${name(e.uid)} ${e.kind}${e.skill ? `:${e.skill}` : ''} ${name(e.target)} -${e.dmg} → ${e.hp}${e.killed ? ' KILLED' : ''}`);
      else if (e.t === 'heal') console.log(`   ${name(e.uid)} heal ${name(e.target)} +${e.amount}`);
      else if (e.t === 'stun') console.log(`   ${name(e.uid)} stun ${name(e.target)}`);
      else if (e.t === 'push') console.log(`   push ${name(e.target)} → ${e.to.x},${e.to.y}${e.fell ? ' FELL' : ''}`);
      else if (e.t === 'spawn') console.log(`   spawn ${name(e.uid)}`);
      else if (e.t === 'overwatch') console.log(`   ${name(e.uid)} overwatch`);
    }
  } : undefined);
  const left = b
    .alive('player')
    .map((u) => `${u.def.id}:${u.hp}`)
    .join(' ');
  const foes = b
    .alive('enemy')
    .map((u) => `${u.def.id}:${u.hp}`)
    .join(' ');
  console.log(`${m.id} ${r.result.padEnd(7)} turns ${String(r.turns).padStart(2)} lost ${r.lost} stars ${r.stars} | ${left} | enemy ${foes || '-'}`);
}
