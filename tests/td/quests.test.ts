import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS, QUESTS_PER_DAY, addQuestProgress, claimable, ensureQuests, questText, questsFor, type QuestTally } from '../../src/td/data/quests';

const none: QuestTally = { kills: 0, wins: 0, threeStars: 0, towers: 0, meteorKills: 0, earlyCalls: 0, bosses: 0, hazardKills: 0, daily: 0 };

test('each day draws the same three distinct quests', () => {
  const a = questsFor('2026-10-17', 10);
  assert.deepEqual(a, questsFor('2026-10-17', 10));
  assert.equal(a.length, QUESTS_PER_DAY);
  assert.equal(new Set(a.map((q) => q.id)).size, QUESTS_PER_DAY);
  const days = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].map((d) => questsFor(d, 10).map((q) => q.id).join());
  assert.ok(new Set(days).size > 1, 'quests change from day to day');
});

test('new players only get quests they can already do, at the easy tier', () => {
  for (let d = 1; d <= 28; d++) {
    const day = `2026-11-${String(d).padStart(2, '0')}`;
    for (const q of questsFor(day, 0)) {
      const def = QUESTS.find((x) => x.id === q.id)!;
      assert.ok((def.minCleared ?? 0) === 0, `${q.id} is open to new players`);
      assert.equal(q.n, def.targets[0]);
      assert.equal(q.reward, def.rewards[0]);
    }
  }
});

test('progress accumulates, caps at the target and reports completion once', () => {
  const q = ensureQuests(undefined, '2026-10-17', 10);
  const kills = q.list.find((s) => s.id === 'kills') ?? q.list[0];
  const big: QuestTally = { ...none, [kills.id]: kills.n - 1 };
  assert.deepEqual(addQuestProgress(q, big), []);
  assert.equal(kills.cur, kills.n - 1);
  const done = addQuestProgress(q, { ...none, [kills.id]: 50 });
  assert.ok(done.includes(kills));
  assert.equal(kills.cur, kills.n);
  assert.deepEqual(addQuestProgress(q, { ...none, [kills.id]: 5 }), [], 'already complete');
  assert.equal(claimable(q), 1);
  kills.claimed = true;
  assert.equal(claimable(q), 0);
});

test('the same day keeps its saved progress; a new day draws fresh quests', () => {
  const q = ensureQuests(undefined, '2026-10-17', 10);
  q.list[0].cur = 1;
  assert.equal(ensureQuests(q, '2026-10-17', 10), q);
  const next = ensureQuests(q, '2026-10-18', 10);
  assert.notEqual(next, q);
  assert.ok(next.list.every((s) => s.cur === 0 && !s.claimed));
});

test('quest text fills in the target number in both languages', () => {
  for (const def of QUESTS) {
    const t = questText({ id: def.id, n: def.targets[0], reward: def.rewards[0], cur: 0, claimed: false });
    assert.ok(!t.zh.includes('{n}') && !t.en.includes('{n}'));
    assert.equal(def.targets.length, def.rewards.length);
  }
});
