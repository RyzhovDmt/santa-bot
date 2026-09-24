import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_PHRASE_LENGTH, PHRASES, phraseLabel, pickPhrase, placeholdersIn, renderPhrase, stageKey, validatePhrase, withCatchphrase,
} from '../src/texts.js';

test('placeholdersIn finds closed placeholders only', () => {
  assert.deepEqual(placeholdersIn('Привет, {name}! До {date} — {days}'), ['name', 'date', 'days']);
  assert.deepEqual(placeholdersIn('без подстановок { и незакрытая'), []);
});

test('renderPhrase substitutes every occurrence', () => {
  assert.equal(renderPhrase('{name}, {name}! «{title}»', { name: 'Аня', title: 'Офис' }), 'Аня, Аня! «Офис»');
});

test('validatePhrase checks placeholders allowed for the notification', () => {
  assert.equal(validatePhrase('gift2', '{receiver} ждёт подарок до {date}'), null);
  assert.match(validatePhrase('join', 'Тебе дарит {santa}'), /нельзя использовать: \{santa\}/);
  assert.match(validatePhrase('wish2', ''), /пустая/);
  assert.match(validatePhrase('wish2', 'x'.repeat(MAX_PHRASE_LENGTH + 1)), /Слишком длинно/);
});

test('default phrases use only their own placeholders', () => {
  for (const [key, phrase] of Object.entries(PHRASES)) {
    if (phrase.flavor) continue;
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

test('flavor words are prepended at random, with the bot own punctuation', () => {
  const game = {
    phrases: {
      interjections: [{ id: 1, text: 'ну чё!', by: '1' }],
      addresses: [{ id: 2, text: 'братан', by: '1' }],
    },
  };
  const always = () => 0;
  const never = () => 0.99;
  assert.equal(pickPhrase(game, 'draw', { name: 'Аня', title: 'Офис', receiver: 'Вика' }, always), 'Ну чё, братан! 🎅 Жеребьёвка в игре «Офис» проведена!');
  assert.equal(pickPhrase(game, 'draw', { name: 'Аня', title: 'Офис', receiver: 'Вика' }, never), '🦌 Олени доставили тебе имя получателя!');
  assert.equal(pickPhrase({}, 'draw', { title: 'Офис' }, always), '🎅 Жеребьёвка в игре «Офис» проведена!');
  assert.match(validatePhrase('addresses', 'x'.repeat(41)), /максимум 40/);
  assert.match(validatePhrase('addresses', 'эй {name}'), /нельзя использовать/);
});

test('catchphrase is appended at the end sometimes', () => {
  const game = { phrases: { catchphrases: [{ id: 1, text: 'Ну это база', by: '1' }] } };
  assert.equal(withCatchphrase(game, 'Текст', () => 0), 'Текст\n\n💬 Ну это база');
  assert.equal(withCatchphrase(game, 'Текст', () => 0.99), 'Текст');
  assert.equal(withCatchphrase({}, 'Текст', () => 0), 'Текст');
});

test('names after a preposition are rejected: they would not be declined', () => {
  assert.match(validatePhrase('gift2', 'Подарок для {receiver} готов?'), /без склонения: «для \{receiver\}»/);
  assert.match(validatePhrase('wish2', 'У {name} нет пожелания'), /«У \{name\}»/);
  assert.equal(validatePhrase('gift2', '{receiver} ждёт подарок до {date}'), null);
  assert.equal(validatePhrase('gift2', 'Купи подарок к {date}'), null);
});

test('soft participants get harsh phrases much less often; soft mode from softNames or the organizer', async () => {
  const { isSoft } = await import('../src/texts.js');
  const game = {
    softNames: ['Ира', 'Ирина'],
    phrases: { draw: [{ id: 1, text: 'ЖЁСТКО', by: 'import', harsh: true }] },
  };
  const count = (soft) => {
    let harsh = 0;
    for (let i = 0; i < 1000; i++) if (pickPhrase(game, 'draw', {}, { random: () => (i + 0.5) / 1000, soft }) === 'ЖЁСТКО') harsh++;
    return harsh;
  };
  assert.ok(count(false) > 150, 'normal: 1 of 5 phrases');
  assert.ok(count(true) < 50 && count(true) > 0, 'soft: rare but possible');

  assert.equal(isSoft(game, { name: 'Ирина' }), true);
  assert.equal(isSoft(game, { name: 'Ирина Сергеевна (@ira)' }), true);
  assert.equal(isSoft(game, { name: 'Сергей' }), false);
  assert.equal(isSoft(game, { name: 'Ирина', soft: false }), false);
  assert.equal(isSoft(game, { name: 'Сергей', soft: true }), true);
});
