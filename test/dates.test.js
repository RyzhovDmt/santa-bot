import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysBetween, formatDate, hourIn, parseDate, todayIn } from '../src/dates.js';

test('parseDate with explicit year', () => {
  assert.equal(parseDate('27.12.2026', '2026-09-24'), '2026-12-27');
  assert.equal(parseDate('1.2.27', '2026-09-24'), '2027-02-01');
});

test('parseDate without year picks nearest date not in the past', () => {
  assert.equal(parseDate('27.12', '2026-09-24'), '2026-12-27');
  assert.equal(parseDate('10.01', '2026-12-27'), '2027-01-10');
  assert.equal(parseDate('27.12', '2026-12-27'), '2026-12-27');
});

test('parseDate rejects garbage and impossible dates', () => {
  for (const input of ['', 'завтра', '31.02.2026', '32.12', '12', '1.2.3.4', '27/12', '27.12.']) {
    assert.equal(parseDate(input, '2026-09-24'), null, input);
  }
});

test('daysBetween and formatDate', () => {
  assert.equal(daysBetween('2026-12-25', '2026-12-27'), 2);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-12-27', '2026-12-25'), -2);
  assert.equal(formatDate('2026-12-07'), '07.12.2026');
});

test('todayIn / hourIn respect the time zone', () => {
  const now = new Date('2026-12-31T22:30:00Z'); // 01:30 on Jan 1 in Moscow
  assert.equal(todayIn('Europe/Moscow', now), '2027-01-01');
  assert.equal(todayIn('UTC', now), '2026-12-31');
  assert.equal(hourIn('Europe/Moscow', now), 1);
});
