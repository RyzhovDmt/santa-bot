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
  assert.equal(validatePhrase('gift2', 'Купи подарок для {receiver} до {date}'), null);
  assert.match(validatePhrase('join', 'Тебе дарит {santa}'), /нельзя использовать: \{santa\}/);
  assert.match(validatePhrase('wish2', ''), /пустая/);
  assert.match(validatePhrase('wish2', 'x'.repeat(MAX_PHRASE_LENGTH + 1)), /длинная/);
});

test('default phrases use only their own placeholders', () => {
  for (const [key, phrase] of Object.entries(PHRASES)) {
    assert.ok(phrase.defaults.length >= 3, `${key}: at least 3 defaults`);
    for (const text of phrase.defaults) assert.equal(validatePhrase(key, text), null, `${key}: ${text}`);
  }
});

test('pickPhrase chooses among defaults and game phrases', () => {
  const game = { phrases: { gift2: [{ id: 1, text: 'Своя фраза для {name}', by: '1' }] } };
  const pool = PHRASES.gift2.defaults.length + 1;
  const seen = new Set();
  for (let i = 0; i < pool; i++) seen.add(pickPhrase(game, 'gift2', { name: 'Аня' }, () => (i + 0.5) / pool));
  assert.equal(seen.size, pool);
  assert.ok(seen.has('Своя фраза для Аня'));
});

test('reminder stage is chosen by the reminder number, 7+ share the last stage', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 15].map((n) => stageKey('wish', n)),
    ['wish1', 'wish2', 'wish3', 'wish4', 'wish5', 'wish6', 'wish7', 'wish7', 'wish7']);
  assert.equal(stageKey('gift', 3), 'gift3');
  assert.notEqual(validatePhrase('lastDay', 'Осталось {days}'), null);
  assert.equal(validatePhrase('wish4', 'Это {count}-е напоминание'), null);
});

test('stage labels are derived from stage starts', () => {
  assert.equal(phraseLabel('wish1'), '✍️ Пожелание: 1-е напоминание');
  assert.equal(phraseLabel('wish6'), '✍️ Пожелание: 6-е напоминание');
  assert.equal(phraseLabel('wish7'), '✍️ Пожелание: 7-е и дальше');
  assert.equal(phraseLabel('gift2'), '🛍 Подарок: 2-е напоминание');
  assert.equal(phraseLabel('lastDay'), '🔥 Пожелание: последний день');
  assert.equal(phraseLabel('draw'), '🎲 Жеребьёвка');
});
