import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOGIN_GEMS, loginReward, previousDay } from '../../src/td/data/login';
import { dailyKey } from '../../src/td/data/daily';

test('first login gives day 1', () => {
  assert.deepEqual(loginReward(undefined, '2026-10-17', '2026-10-16'), { day: 1, gems: LOGIN_GEMS[0] });
});

test('same day cannot be claimed twice', () => {
  assert.equal(loginReward({ last: '2026-10-17', streak: 3 }, '2026-10-17', '2026-10-16'), null);
});

test('consecutive days climb the streak and wrap after day 7', () => {
  assert.deepEqual(loginReward({ last: '2026-10-16', streak: 3 }, '2026-10-17', '2026-10-16'), { day: 4, gems: LOGIN_GEMS[3] });
  assert.deepEqual(loginReward({ last: '2026-10-16', streak: 7 }, '2026-10-17', '2026-10-16'), { day: 1, gems: LOGIN_GEMS[0] });
});

test('a missed day resets the streak', () => {
  assert.deepEqual(loginReward({ last: '2026-10-14', streak: 5 }, '2026-10-17', '2026-10-16'), { day: 1, gems: LOGIN_GEMS[0] });
});

test('previousDay crosses month and year boundaries', () => {
  assert.equal(dailyKey(previousDay(new Date(2026, 2, 1))), '2026-02-28');
  assert.equal(dailyKey(previousDay(new Date(2027, 0, 1))), '2026-12-31');
});
