import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dueReminders, reminderMessages } from '../src/reminders.js';

const players = () => ({
  1: { name: 'Аня', wish: 'книга', wishReady: true, giftBought: true },
  2: { name: 'Борис', wish: '', wishReady: false, giftBought: false },
  3: { name: 'Вика', wish: 'чай', wishReady: false, giftBought: false },
});

const openGame = (extra = {}) => ({
  code: 'ABC', title: 'Офис', ownerId: '1', status: 'open', participants: players(), pairs: {}, reminders: {}, ...extra,
});

const drawnGame = (extra = {}) => ({
  ...openGame(), status: 'drawn', pairs: { 1: '2', 2: '3', 3: '1' }, ...extra,
});

const kinds = (game, today) => dueReminders(game, today).map((r) => `${r.kind}:${r.daysLeft ?? ''}`);

test('wish reminders every 2 days before the deadline, including the deadline day', () => {
  const game = openGame({ wishDeadline: '2026-12-10' });
  const days = ['2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-08', '2026-12-09', '2026-12-10'];
  assert.deepEqual(days.map((d) => kinds(game, d)), [[], ['wish:6'], [], ['wish:4'], ['wish:2'], [], ['wish:0']]);
});

test('wish reminder is sent once per day', () => {
  const game = openGame({ wishDeadline: '2026-12-10', reminders: { wish: '2026-12-08' } });
  assert.deepEqual(kinds(game, '2026-12-08'), []);
});

test('organizer is told once when the deadline has passed', () => {
  assert.deepEqual(kinds(openGame({ wishDeadline: '2026-12-10' }), '2026-12-11'), ['deadlinePassed:']);
  assert.deepEqual(kinds(openGame({ wishDeadline: '2026-12-10', reminders: { deadlinePassed: true } }), '2026-12-12'), []);
});

test('gift reminders every 5 days before the gift date, only after the draw', () => {
  const game = drawnGame({ giftDate: '2026-12-27' });
  const days = ['2026-12-12', '2026-12-17', '2026-12-20', '2026-12-22', '2026-12-27'];
  assert.deepEqual(days.map((d) => kinds(game, d)), [['gift:15'], ['gift:10'], [], ['gift:5'], []]);
  assert.deepEqual(kinds(openGame({ giftDate: '2026-12-27' }), '2026-12-22'), []);
  assert.deepEqual(kinds(drawnGame({ giftDate: '2026-12-27', status: 'revealed' }), '2026-12-22'), []);
});

test('wish reminders go only to those whose wish is not ready', () => {
  const messages = reminderMessages(openGame({ wishDeadline: '2026-12-10' }), { kind: 'wish', daysLeft: 2 });
  assert.deepEqual(messages.map((m) => m.to), ['2', '3']);
  assert.match(messages[0].text, /2 дня/);
});

test('gift reminders go only to those who have not bought a gift and name their receiver', () => {
  const messages = reminderMessages(drawnGame({ giftDate: '2026-12-27', budget: '1500 ₽' }), { kind: 'gift', daysLeft: 5 });
  assert.deepEqual(messages.map((m) => m.to), ['2', '3']);
  assert.match(messages[0].text, /Ты даришь: Вика/);
  assert.match(messages[1].text, /Ты даришь: Аня/);
  assert.match(messages[0].text, /5 дней/);
});

test('deadline notice goes to the organizer only', () => {
  const messages = reminderMessages(openGame({ wishDeadline: '2026-12-10' }), { kind: 'deadlinePassed' });
  assert.deepEqual(messages.map((m) => m.to), ['1']);
  assert.match(messages[0].text, /1 из 3/);
});
