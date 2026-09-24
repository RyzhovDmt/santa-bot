import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_PHRASE_LENGTH, PHRASES, phraseLabel, pickPhrase, placeholdersIn, renderPhrase, stageKey, validatePhrase,
} from '../src/texts.js';

test('placeholdersIn finds closed placeholders only', () => {
  assert.deepEqual(placeholdersIn('Привет, {name}! До {date} — {days}'), ['name', 'date', 'days']);
  assert.deepEqual(placeholdersIn('без подстановок { и незакрытая'), []);
});

test('renderPhrase substitutes every occurrence', () => {
  assert.equal(renderPhrase('{name}, {name}! «{title}»', { name: 'Аня', title: 'Офис' }), 'Аня, Аня! «Офис»');
});

test('validatePhrase checks placeholders allowed for the notification', () => {
  assert.equal(validatePhrase('giftSoon', 'Купи подарок для {receiver} до {date}'), null);
  assert.match(validatePhrase('join', 'Тебе дарит {santa}'), /нельзя использовать: \{santa\}/);
  assert.match(validatePhrase('wishSoon', ''), /пустая/);
  assert.match(validatePhrase('wishSoon', 'x'.repeat(MAX_PHRASE_LENGTH + 1)), /длинная/);
});

test('default phrases use only their own placeholders', () => {
  for (const [key, phrase] of Object.entries(PHRASES)) {
    assert.ok(phrase.defaults.length >= 3, `${key}: at least 3 defaults`);
    for (const text of phrase.defaults) assert.equal(validatePhrase(key, text), null, `${key}: ${text}`);
  }
});

test('pickPhrase chooses among defaults and game phrases', () => {
  const game = { phrases: { giftSoon: [{ id: 1, text: 'Своя фраза для {name}', by: '1' }] } };
  const pool = PHRASES.giftSoon.defaults.length + 1;
  const seen = new Set();
  for (let i = 0; i < pool; i++) seen.add(pickPhrase(game, 'giftSoon', { name: 'Аня' }, () => (i + 0.5) / pool));
  assert.equal(seen.size, pool);
  assert.ok(seen.has('Своя фраза для Аня'));
});

test('reminder stages by days left follow the reminder schedule', () => {
  assert.deepEqual([12, 8, 7, 6, 4, 3, 2, 1, 0].map((d) => stageKey('wish', d)),
    ['wishEarly', 'wishEarly', 'wishEarly', 'wishSoon', 'wishSoon', 'wishSoon', 'wishClose', 'wishClose', 'lastDay']);
  assert.deepEqual([25, 15, 14, 10, 6, 5, 1].map((d) => stageKey('gift', d)),
    ['giftEarly', 'giftEarly', 'giftSoon', 'giftSoon', 'giftSoon', 'giftClose', 'giftClose']);
  assert.notEqual(validatePhrase('lastDay', 'Осталось {days}'), null);
});

test('stage labels are derived from minDays', () => {
  assert.equal(phraseLabel('wishEarly'), '✍️ Пожелание: за 7+ дней');
  assert.equal(phraseLabel('wishSoon'), '✍️ Пожелание: за 3–6 дней');
  assert.equal(phraseLabel('wishClose'), '✍️ Пожелание: за 1–2 дня');
  assert.equal(phraseLabel('lastDay'), '🔥 Пожелание: последний день');
  assert.equal(phraseLabel('giftSoon'), '🛍 Подарок: за 6–14 дней');
  assert.equal(phraseLabel('draw'), '🎲 Жеребьёвка');
});
