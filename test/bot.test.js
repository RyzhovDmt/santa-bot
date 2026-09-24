// End-to-end scenario: real handlers, D1 emulated with node:sqlite, Telegram API stubbed.
// A new app is created for every update, like the Worker does per request.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createApp } from '../src/bot.js';
import { runReminders } from '../src/reminders.js';
import { FakeD1 } from './fake-d1.js';

const USERS = {
  A: { id: 101, first_name: 'Аня' },
  B: { id: 102, first_name: 'Борис' },
  C: { id: 103, first_name: 'Вика' },
};
const NAME_TO_ID = Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, String(u.id)]));
const ID_TO_NAME = Object.fromEntries(Object.entries(NAME_TO_ID).map(([k, id]) => [id, k]));

let env;
let sent;
let updateId;

const apiTransformer = async (prev, method, payload) => {
  sent.push({ method, to: String(payload.chat_id ?? ''), text: payload.text ?? '', payload });
  const result = method === 'sendMessage' || method === 'copyMessage' || method === 'editMessageText'
    ? { message_id: sent.length, date: 0, chat: { id: payload.chat_id, type: 'private' }, text: payload.text }
    : true;
  return { ok: true, result };
};

beforeEach(() => {
  env = { BOT_TOKEN: '123456:test', BOT_USERNAME: 'test_santa_bot', BOT_TIMEZONE: 'Europe/Moscow', DB: new FakeD1() };
  sent = [];
  updateId = 1;
});

async function handle(update) {
  const before = sent.length;
  const app = createApp(env, { apiTransformer });
  await app.bot.handleUpdate({ update_id: updateId++, ...update });
  return sent.slice(before).filter((m) => m.method !== 'answerCallbackQuery');
}

const from = (who) => ({ ...USERS[who], is_bot: false });
const chat = (who) => ({ id: USERS[who].id, type: 'private' });

function say(who, text) {
  const entities = text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined;
  return handle({ message: { message_id: updateId, date: 0, from: from(who), chat: chat(who), text, entities } });
}

function sendMedia(who, media) {
  return handle({ message: { message_id: 500 + updateId, date: 0, from: from(who), chat: chat(who), ...media } });
}

function press(who, data) {
  return handle({
    callback_query: { id: String(updateId), from: from(who), chat_instance: '1', data, message: { message_id: 1, date: 0, chat: chat(who), text: 'x' } },
  });
}

const dateIn = (days) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
};

const loadGame = () => JSON.parse(env.DB.db.prepare('SELECT data FROM games').get().data);
const buttons = (m) => (m.payload.reply_markup?.inline_keyboard ?? []).flat().map((b) => b.callback_data);

async function setupGame() {
  await say('A', '🎄 Создать игру');
  const created = await say('A', 'Офис');
  const code = loadGame().code;
  assert.match(created[0].text, new RegExp(`start=${code}`));
  await say('B', `/start ${code}`);
  await say('C', `/start ${code.toLowerCase()}`);
  await say('A', 'Книга');
  await say('B', 'Носки');
  await say('C', 'Чай');
  return code;
}

test('create game, settings and validation', async () => {
  await say('A', '🎄 Создать игру');
  await say('A', 'Офис');
  const code = loadGame().code;

  await press('A', `set.budget:${code}`);
  const saved = await say('A', 'до 1500 ₽');
  assert.match(saved[0].text, /Бюджет: до 1500 ₽/);

  await press('A', `set.giftDate:${code}`);
  assert.match((await say('A', '31.02'))[0].text, /Не понял дату/);
  await say('A', dateIn(30));
  assert.match((await say('A', `/deadline ${dateIn(40)}`))[0].text, /не позже даты вручения/);
  await say('A', `/deadline ${dateIn(10)}`);

  const game = loadGame();
  assert.equal(game.budget, 'до 1500 ₽');
  assert.ok(game.giftDate && game.wishDeadline);

  await say('B', `/start ${code}`);
  assert.match((await press('B', `set.budget:${code}`))[0].text, /только организатор/);
});

test('draw requires ready wishes and the organizer, pairs have no self and mutual gifts', async () => {
  const code = await setupGame();
  await press('B', `wish.unready:${code}`);
  assert.match((await press('A', `draw:${code}`))[0].text, /не готово у:\nБорис/);
  await press('B', `wish.ready:${code}`);
  assert.match((await press('B', `draw:${code}`))[0].text, /только организатор/);

  const out = await press('A', `draw:${code}`);
  const pairMessages = out.filter((m) => m.text.includes('Ты даришь подарок'));
  assert.deepEqual(pairMessages.map((m) => ID_TO_NAME[m.to]).sort(), ['A', 'B', 'C']);

  const { pairs, status } = loadGame();
  assert.equal(status, 'drawn');
  for (const [giver, receiver] of Object.entries(pairs)) {
    assert.notEqual(giver, receiver);
    assert.notEqual(pairs[receiver], giver);
  }
  assert.match((await press('A', `draw:${code}`))[0].text, /уже проведена/);
  assert.match((await say('A', '/start ' + code))[0].text, /уже в игре/);
});

test('anonymous chat both ways, media rules, wish updates reach Santa', async () => {
  const code = await setupGame();
  await press('A', `draw:${code}`);
  const { pairs } = loadGame();
  const bReceiver = ID_TO_NAME[pairs[NAME_TO_ID.B]];

  await press('B', `chat.receiver:${code}`);
  const toReceiver = await say('B', 'Какой размер?');
  const relayed = toReceiver.find((m) => m.to === NAME_TO_ID[bReceiver]);
  assert.match(relayed.text, /от твоего Тайного Санты/);
  assert.doesNotMatch(relayed.text, /Борис/);
  assert.deepEqual(buttons(relayed), [`chat.santa:${code}`]);

  await press(bReceiver, `chat.santa:${code}`);
  assert.match((await sendMedia(bReceiver, { voice: { file_id: 'v', file_unique_id: 'v', duration: 1 } }))[0].text, /Такое не пересылаю/);
  const photo = await sendMedia(bReceiver, { photo: [{ file_id: 'p', file_unique_id: 'p', width: 1, height: 1 }] });
  assert.ok(photo.some((m) => m.method === 'copyMessage' && m.to === NAME_TO_ID.B));

  // After a relay the mode is reset: next text is not sent anywhere.
  const after = await say(bReceiver, 'просто текст');
  assert.equal(after.length, 1);
  assert.match(after[0].text, /Пользуйся кнопками/);

  const bSanta = ID_TO_NAME[Object.keys(pairs).find((g) => pairs[g] === NAME_TO_ID.B)];
  await press('B', `wish.add:${code}`);
  const added = await say('B', 'и шарф');
  const notice = added.find((m) => m.to === NAME_TO_ID[bSanta]);
  assert.match(notice.text, /дополнено:\n\nи шарф\n\nЦеликом:\nНоски\nи шарф/);
});

test('gift bought status, reveal and cancel', async () => {
  const code = await setupGame();
  await press('A', `draw:${code}`);

  await press('C', `gift.bought:${code}`);
  assert.match((await say('A', '👥 Участники'))[0].text, /Подарок куплен: 1 из 3/);

  assert.match((await press('B', `reveal.ask:${code}`))[0].text, /только организатор/);
  const revealed = await press('A', `reveal.yes:${code}`);
  assert.equal(revealed.filter((m) => m.text.includes('Тебе дарит')).length, 3);
  assert.equal(loadGame().status, 'revealed');

  await press('A', `cancel.yes:${code}`);
  assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM games').get().n, 0);
  assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM users WHERE game IS NOT NULL').get().n, 0);
});

test('cron sends due reminders once a day and only after the reminder hour', async () => {
  const code = await setupGame();
  await say('A', `/giftdate ${dateIn(20)}`);
  await press('A', `draw:${code}`);
  await press('C', `gift.bought:${code}`);

  const app = createApp(env, { apiTransformer });
  const giftDay = new Date(Date.now() + 10 * 86_400_000); // 10 days before the gift date
  const at = (hourUtc) => new Date(Date.UTC(giftDay.getUTCFullYear(), giftDay.getUTCMonth(), giftDay.getUTCDate(), hourUtc));

  sent = [];
  await runReminders(app, env.DB, { hour: 11, now: at(6) }); // 09:00 MSK
  assert.equal(sent.length, 0);

  await runReminders(app, env.DB, { hour: 11, now: at(9) }); // 12:00 MSK
  assert.deepEqual(sent.map((m) => ID_TO_NAME[m.to]).sort(), ['A', 'B']);
  assert.match(sent[0].text, /До вручения подарков .* — 10 дней/);

  sent = [];
  await runReminders(app, env.DB, { hour: 11, now: at(10) });
  assert.equal(sent.length, 0);

  // Reminder numbers are counted per participant: A and B got one, C (gift bought) none.
  const counts = env.DB.db.prepare("SELECT user_id, count FROM reminder_counts WHERE kind = 'gift' ORDER BY user_id").all();
  assert.deepEqual(counts.map((r) => [ID_TO_NAME[r.user_id], r.count]), [['A', 1], ['B', 1]]);

  // Next due day (5 days later): the second reminder bumps the numbers again.
  await runReminders(app, env.DB, { hour: 11, now: new Date(at(9).getTime() + 5 * 86_400_000) });
  const after = env.DB.db.prepare("SELECT count FROM reminder_counts WHERE kind = 'gift'").all();
  assert.deepEqual(after.map((r) => r.count), [2, 2]);
});

test('phrase menu has reminder groups with stages', async () => {
  const code = await setupGame();
  const menu = await press('A', `phr.menu:${code}`);
  assert.ok(buttons(menu[0]).includes(`phr.group:${code}:wish`));
  const group = await press('A', `phr.group:${code}:gift`);
  assert.deepEqual(buttons(group[0]).filter((b) => b.startsWith('phr.key')).length, 7);
  const stage = await press('A', `phr.key:${code}:gift7`);
  assert.match(stage[0].text, /7-е и дальше/);
  assert.ok(buttons(stage[0]).includes(`phr.group:${code}:gift`));
});

test('participants add phrases, only author or organizer can delete, phrases appear in notifications', async () => {
  const code = await setupGame();

  const menu = await press('B', `phr.menu:${code}`);
  assert.ok(buttons(menu[0]).includes(`phr.key:${code}:draw`));

  await press('B', `phr.add:${code}:draw`);
  assert.match((await say('B', 'Тебе дарит {santa}'))[0].text, /нельзя использовать/);
  const added = await say('B', 'Для {receiver} — от всего сердца!');
  assert.match(added[0].text, /Фраза добавлена/);

  let game = loadGame();
  const phraseId = game.phrases.draw[0].id;
  assert.equal(game.phrases.draw[0].by, NAME_TO_ID.B);

  // Another participant sees the phrase but gets no delete button for it.
  const cView = await press('C', `phr.key:${code}:draw`);
  assert.match(cView[0].text, /1\. Для \{receiver\} — от всего сердца!/);
  assert.ok(!buttons(cView[0]).includes(`phr.del:${code}:draw.${phraseId}`));
  assert.match((await press('C', `phr.del:${code}:draw.${phraseId}`))[0].text, /только свою/);
  // The author isn't shown to anyone.
  assert.doesNotMatch(cView[0].text, /Борис/);

  // With only the custom phrase possible, the draw message starts with it.
  const random = Math.random;
  Math.random = () => 0.999;
  try {
    const out = await press('A', `draw:${code}`);
    const pairMessage = out.find((m) => m.text.includes('Ты даришь подарок'));
    assert.match(pairMessage.text, /^Для .+ — от всего сердца!/);
  } finally {
    Math.random = random;
  }

  // Organizer can delete any phrase.
  await press('A', `phr.del:${code}:draw.${phraseId}`);
  game = loadGame();
  assert.equal(game.phrases.draw.length, 0);
});

test('an update stays within the free plan subrequest limit', async () => {
  const code = await setupGame();
  env.DB.calls = 0;
  sent = [];
  await press('A', `draw:${code}`);
  assert.ok(env.DB.calls + sent.length < 50, `${env.DB.calls} DB calls + ${sent.length} API calls`);
});
