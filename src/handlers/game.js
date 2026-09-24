import { daysBetween, formatDate, parseDate } from '../dates.js';
import { cycles, draw, santaOf } from '../draw.js';
import {
  BTN, HELP, STATUS_TITLE, button, cancelKeyboard, displayName, gameDetails, giftDetails, inline, mainMenu,
} from '../ui.js';
import {
  flavored, isSoft, pickPhrase, shortName, toneFor, withCatchphrase,
} from '../texts.js';

const MIN_PLAYERS = 3;
// Draw sends one message per player; the free plan allows 50 subrequests per invocation.
const MAX_PLAYERS = 40;
const MAX_TITLE = 100;
const MAX_BUDGET = 100;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars: byte % 32 is unbiased
const CODE_LENGTH = 8;

const SETTINGS = {
  budget: {
    label: '💰 Бюджет',
    ask: 'Напиши бюджет подарка, например: до 1500 ₽',
    format: (value) => value,
    allowed: (game) => game.status !== 'revealed',
  },
  wishDeadline: {
    label: '⏰ Дедлайн пожеланий',
    ask: 'Напиши дату дедлайна пожеланий: ДД.ММ или ДД.ММ.ГГГГ.\nДо него бот каждый день напоминает тем, чьё пожелание не готово.',
    format: formatDate,
    allowed: (game) => game.status === 'open',
  },
  giftDate: {
    label: '📅 Дата вручения',
    ask: 'Напиши дату вручения подарков: ДД.ММ или ДД.ММ.ГГГГ.\nДо неё бот каждый день напоминает тем, кто ещё не купил подарок.',
    format: formatDate,
    allowed: (game) => game.status !== 'revealed',
  },
};

const newParticipant = (from) => ({ name: displayName(from), wish: '', wishReady: false, giftBought: false });

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function infoKeyboard(game, userId) {
  const c = game.code;
  const rows = [];
  if (game.ownerId === userId) {
    for (const [field, setting] of Object.entries(SETTINGS)) {
      if (setting.allowed(game)) rows.push([button(setting.label, `set.${field}`, c)]);
    }
    if (game.status === 'open') rows.push([button('🎲 Провести жеребьёвку', 'draw', c)]);
    if (game.status === 'drawn') rows.push([button('🎉 Раскрыть Сант', 'reveal.ask', c)]);
    if (game.status !== 'revealed') rows.push([button('🙊 Мягкий тон', 'soft.menu', c)]);
    rows.push([button('🗑 Удалить игру', 'cancel.ask', c)]);
  } else if (game.status === 'open') {
    rows.push([button('🚪 Выйти из игры', 'leave', c)]);
  }
  if (game.status !== 'revealed') rows.push([button('💬 Фразы уведомлений', 'phr.menu', c)]);
  return rows.length ? inline(rows) : undefined;
}

function notInGame(ctx) {
  return ctx.reply(`Ты пока не в игре. Попроси у организатора ссылку-приглашение или создай свою игру: «${BTN.create}».`, mainMenu());
}

// Runs fn for the user's current game if the user is its organizer.
function ownGame(app, ctx, fn) {
  const userId = app.userId(ctx);
  const game = app.store.currentGame(userId);
  if (!game) return notInGame(ctx);
  if (game.ownerId !== userId) return ctx.reply(denied(game, userId));
  return fn(game, userId);
}

const denied = (game, userId) => flavored(game, 'denied', game.participants[userId], 'Это может сделать только организатор игры.');

const ownerOnly = (handler) => (ctx, game, userId) =>
  game.ownerId === userId ? handler(ctx, game, userId) : ctx.reply(denied(game, userId));

async function createGame(app, ctx, rawTitle) {
  const { store } = app;
  const userId = app.userId(ctx);
  const current = store.currentGame(userId);
  if (current?.status === 'open') {
    return ctx.reply(`Ты уже в игре «${current.title}», где жеребьёвка ещё не прошла. Сначала выйди из неё или удали её: «${BTN.info}».`);
  }

  const title = rawTitle.trim().slice(0, MAX_TITLE);
  if (!title) return ctx.reply('Название пустое. Напиши, как назвать игру:');

  const code = newCode();
  const game = {
    code,
    title,
    ownerId: userId,
    status: 'open',
    createdAt: new Date().toISOString(),
    budget: '',
    wishDeadline: null,
    giftDate: null,
    participants: { [userId]: newParticipant(ctx.from) },
    pairs: {},
  };
  store.addGame(game);
  store.setCurrentGame(userId, code);
  store.setMode(userId, null);
  await store.save();

  await ctx.reply(`Игра «${title}» создана 🎁\n\nОтправь участникам ссылку-приглашение:\n${app.inviteLink(code)}`, mainMenu(game));
  return ctx.reply(
    `Настрой игру — участники увидят эти параметры:\n\n${gameDetails(game)}\n\nТы тоже участник: не забудь написать своё пожелание — «${BTN.wish}».`,
    infoKeyboard(game, userId),
  );
}

async function askTitle(app, ctx) {
  const userId = app.userId(ctx);
  app.store.setMode(userId, { type: 'newGame' });
  await app.store.save();
  return ctx.reply('Как назвать игру? Например: Офис 2026', cancelKeyboard());
}

async function joinGame(app, ctx, code) {
  const { store } = app;
  const userId = app.userId(ctx);
  const game = store.getGame(code);
  if (!game) return ctx.reply('Игра не найдена. Проверь ссылку у организатора.', mainMenu(store.currentGame(userId)));

  if (game.participants[userId]) {
    store.setCurrentGame(userId, code);
    await store.save();
    return ctx.reply(`Ты уже в игре «${game.title}».`, mainMenu(game));
  }
  if (game.status !== 'open') return ctx.reply('В этой игре жеребьёвка уже прошла, присоединиться нельзя.');
  if (Object.keys(game.participants).length >= MAX_PLAYERS) return ctx.reply(`В игре уже ${MAX_PLAYERS} участников — это максимум.`);

  const current = store.currentGame(userId);
  if (current && current.status === 'open') {
    return ctx.reply(`Ты уже в игре «${current.title}», где жеребьёвка ещё не прошла. Сначала выйди из неё: «${BTN.info}» → «Выйти из игры».`);
  }

  const participant = newParticipant(ctx.from);
  game.participants[userId] = participant;
  store.setCurrentGame(userId, code);
  store.setMode(userId, null);
  await store.save();
  const tone = toneFor(game, participant);
  const greeting = pickPhrase(game, 'join', { name: shortName(participant), title: game.title }, tone);
  return ctx.reply(
    withCatchphrase(game, `${greeting}\n\n${gameDetails(game)}\n\nНапиши своё пожелание к подарку одним сообщением — его увидит только твой Тайный Санта.`, tone),
    mainMenu(game),
  );
}

function showPlayers(app, ctx) {
  const game = app.store.currentGame(app.userId(ctx));
  if (!game) return notInGame(ctx);

  const entries = Object.entries(game.participants);
  const drawn = game.status !== 'open';
  const isDone = (p) => (drawn ? p.giftBought : p.wishReady);
  const lines = entries.map(([id, p]) => {
    const mark = isDone(p) ? (drawn ? '🛍' : '✅') : '⏳';
    return `${mark} ${p.name}${id === game.ownerId ? ' — организатор' : ''}`;
  });
  const done = entries.filter(([, p]) => isDone(p)).length;
  const summary = drawn
    ? `🛍 Подарок куплен: ${done} из ${entries.length}`
    : `✅ Пожелание готово: ${done} из ${entries.length}`;
  const invite = game.status === 'open' ? `\n\nСсылка-приглашение: ${app.inviteLink(game.code)}` : '';

  return ctx.reply(`«${game.title}» — ${STATUS_TITLE[game.status]}\nУчастников: ${entries.length}\n${summary}\n\n${lines.join('\n')}${invite}`);
}

function showInfo(app, ctx) {
  const userId = app.userId(ctx);
  const game = app.store.currentGame(userId);
  if (!game) return notInGame(ctx);

  const lines = [
    `«${game.title}» — ${STATUS_TITLE[game.status]}`,
    `Организатор: ${game.participants[game.ownerId].name}`,
    '',
    gameDetails(game),
  ];
  if (game.status === 'open') lines.push('', `Ссылка-приглашение: ${app.inviteLink(game.code)}`);
  return ctx.reply(lines.join('\n'), infoKeyboard(game, userId));
}

async function askSetting(app, ctx, game, userId, field) {
  if (!SETTINGS[field].allowed(game)) return ctx.reply('На этом этапе игры это уже не изменить.');
  app.store.setMode(userId, { type: 'setting', code: game.code, field });
  await app.store.save();
  return ctx.reply(`${SETTINGS[field].ask}\n\nЧтобы убрать значение — отправь «-».`, cancelKeyboard(game.code));
}

async function applySetting(app, ctx, game, userId, field, raw) {
  const setting = SETTINGS[field];
  if (!setting.allowed(game)) return ctx.reply('На этом этапе игры это уже не изменить.');

  const input = raw.trim();
  if (!input) return ctx.reply(setting.ask);

  let value;
  if (input === '-') {
    value = field === 'budget' ? '' : null;
  } else if (field === 'budget') {
    value = input.slice(0, MAX_BUDGET);
  } else {
    const today = app.today();
    value = parseDate(input, today);
    if (!value) return ctx.reply('Не понял дату. Формат: ДД.ММ или ДД.ММ.ГГГГ, например 27.12');
    if (daysBetween(today, value) < 0) return ctx.reply('Эта дата уже прошла. Напиши другую:');
    const deadline = field === 'wishDeadline' ? value : game.wishDeadline;
    const giftDate = field === 'giftDate' ? value : game.giftDate;
    if (deadline && giftDate && daysBetween(deadline, giftDate) < 0) {
      return ctx.reply('Дедлайн пожеланий должен быть не позже даты вручения. Напиши другую дату:');
    }
  }

  game[field] = value;
  // A new date restarts its reminder schedule.
  if (field === 'wishDeadline') app.store.resetReminders(game.code, ['wish', 'deadlinePassed']);
  if (field === 'giftDate') app.store.resetReminders(game.code, ['gift']);
  app.store.setMode(userId, null);
  await app.store.save();

  const shown = value ? setting.format(value) : 'не задано';
  const others = Object.keys(game.participants).filter((id) => id !== userId);
  await app.broadcast(others.map((to) => ({
    to,
    text: flavored(game, 'settingsUpdate', game.participants[to], `ℹ️ Организатор обновил игру «${game.title}»:\n${setting.label}: ${shown}`),
  })));
  return ctx.reply(`Сохранено ✅\n\n${gameDetails(game)}`, infoKeyboard(game, userId));
}

function drawMessage(game, giverId, receiverId) {
  const receiver = game.participants[receiverId];
  const details = giftDetails(game);
  const tone = toneFor(game, game.participants[giverId]);
  return withCatchphrase(game, [
    pickPhrase(game, 'draw', { name: shortName(game.participants[giverId]), title: game.title, receiver: receiver.name }, tone),
    '',
    `Игра «${game.title}»`,
    '',
    `Ты даришь подарок: ${receiver.name}`,
    '',
    `Пожелание:\n${receiver.wish}`,
    ...(details ? ['', details] : []),
    '',
    `Спросить что-то у получателя анонимно: «${BTN.whom}» → «✉️ Написать получателю».`,
    'Никому не говори — это секрет 🤫',
  ].join('\n'), tone);
}

async function runDraw(app, ctx, game) {
  if (game.status !== 'open') return ctx.reply('Жеребьёвка уже проведена.');

  const ids = Object.keys(game.participants);
  if (ids.length < MIN_PLAYERS) {
    return ctx.reply(`Нужно минимум ${MIN_PLAYERS} участника, сейчас ${ids.length}. Пригласи ещё: ${app.inviteLink(game.code)}`);
  }
  const notReady = ids.filter((id) => !game.participants[id].wishReady).map((id) => game.participants[id].name);
  if (notReady.length) {
    return ctx.reply(`Пожелание ещё не готово у:\n${notReady.join('\n')}\n\nЖеребьёвка — когда пожелания будут готовы у всех.`);
  }

  // State is switched synchronously before any await, so a second draw can't run in parallel.
  game.pairs = Object.fromEntries(draw(ids));
  game.status = 'drawn';
  game.drawnAt = new Date().toISOString();
  await app.store.save();

  const failed = await app.broadcast(Object.entries(game.pairs).map(([giver, receiver]) => ({
    to: giver,
    text: drawMessage(game, giver, receiver),
    extra: mainMenu(game),
  })));

  const report = failed.length
    ? `\n\nНе удалось отправить сообщение (возможно, заблокировали бота):\n${failed.map((id) => game.participants[id].name).join('\n')}\nОни могут узнать получателя кнопкой «${BTN.whom}».`
    : '';
  return ctx.reply(`Готово! Каждый участник получил имя своего получателя.${report}`);
}

function askReveal(app, ctx, game) {
  if (game.status !== 'drawn') return ctx.reply(game.status === 'open' ? 'Сначала нужно провести жеребьёвку.' : 'Санты уже раскрыты.');
  const early = game.giftDate && daysBetween(app.today(), game.giftDate) > 0
    ? `\n\n⚠️ Дата вручения ещё не наступила (${formatDate(game.giftDate)}).`
    : '';
  return ctx.reply(
    `Раскрыть всем участникам, кто кому дарил? Отменить это нельзя.${early}`,
    inline([[button('🎉 Да, раскрыть', 'reveal.yes', game.code), button('Отмена', 'dismiss')]]),
  );
}

async function reveal(app, ctx, game) {
  if (game.status !== 'drawn') return ctx.reply('Санты уже раскрыты.');
  game.status = 'revealed';
  game.revealedAt = new Date().toISOString();
  await app.store.save();
  await ctx.editMessageText('Раскрываем Сант 🎉').catch(() => {});

  const name = (id) => game.participants[id].name;
  const chains = cycles(game.pairs).map((cycle) => [...cycle, cycle[0]].map(name).join(' → ')).join('\n\n');
  await app.broadcast(Object.keys(game.participants).map((to) => ({
    to,
    text: withCatchphrase(game, [
      pickPhrase(game, 'reveal', { name: shortName(game.participants[to]), title: game.title, santa: name(santaOf(game.pairs, to)) }, toneFor(game, game.participants[to])),
      '',
      `Тебе дарит: ${name(santaOf(game.pairs, to))}`,
      '',
      `Кто кому дарит:\n${chains}`,
    ].join('\n'), toneFor(game, game.participants[to])),
    extra: mainMenu(game),
  })));
}

function askCancel(ctx, game) {
  return ctx.reply(
    `Удалить игру «${game.title}»? Участники получат уведомление, восстановить игру нельзя.`,
    inline([[button('🗑 Да, удалить', 'cancel.yes', game.code), button('Отмена', 'dismiss')]]),
  );
}

async function cancelGame(app, ctx, game, userId) {
  const others = Object.keys(game.participants).filter((id) => id !== userId);
  app.store.deleteGame(game.code);
  await app.store.save();
  await ctx.editMessageText(`Игра «${game.title}» удалена.`).catch(() => {});
  await app.broadcast(others.map((to) => ({ to, text: `Организатор удалил игру «${game.title}».`, extra: mainMenu() })));
  return ctx.reply('Готово.', mainMenu());
}

async function leaveGame(app, ctx, game, userId) {
  if (game.status !== 'open') return ctx.reply('После жеребьёвки выйти нельзя — у тебя уже есть получатель.');
  if (game.ownerId === userId) return ctx.reply('Организатор не может выйти из игры, но может удалить её.');

  delete game.participants[userId];
  app.store.setCurrentGame(userId, null);
  await app.store.save();
  return ctx.reply(`Ты больше не участвуешь в игре «${game.title}».`, mainMenu());
}

// Organizer-only: participants in soft mode get harsh phrases much less often.
function softView(game) {
  const rows = Object.entries(game.participants).map(([id, p]) => [
    button(`${isSoft(game, p) ? '🙊' : '😈'} ${p.name}`, 'soft.toggle', game.code, id),
  ]);
  return {
    text: '🙊 Мягкий тон\n\nУчастникам с 🙊 жёсткие фразы (мат, грубые подколы) выпадают намного реже. Нажми на участника, чтобы переключить.',
    keyboard: inline(rows),
  };
}

async function toggleSoft(app, ctx, game, participantId) {
  const p = game.participants[participantId];
  if (!p) return;
  p.soft = !isSoft(game, p);
  await app.store.save();
  const view = softView(game);
  return ctx.editMessageText(view.text, view.keyboard).catch(() => ctx.reply(view.text, view.keyboard));
}

export function register(app) {
  const { bot, store } = app;

  app.onAction('soft.menu', ownerOnly((ctx, game) => {
    const view = softView(game);
    return ctx.reply(view.text, view.keyboard);
  }));
  app.onAction('soft.toggle', (ctx, game, userId, participantId) => (game.ownerId === userId
    ? toggleSoft(app, ctx, game, participantId)
    : ctx.reply(denied(game, userId))));

  bot.command('start', (ctx) => {
    const code = ctx.match.trim().toUpperCase();
    if (code) return joinGame(app, ctx, code);
    return ctx.reply(HELP, mainMenu(store.currentGame(app.userId(ctx))));
  });
  bot.command('help', (ctx) => ctx.reply(HELP, mainMenu(store.currentGame(app.userId(ctx)))));
  bot.command('menu', (ctx) => ctx.reply('Меню 👇', mainMenu(store.currentGame(app.userId(ctx)))));

  bot.command('new', (ctx) => (ctx.match.trim() ? createGame(app, ctx, ctx.match) : askTitle(app, ctx)));
  bot.hears(BTN.create, (ctx) => askTitle(app, ctx));

  bot.command('status', (ctx) => showPlayers(app, ctx));
  bot.hears(BTN.players, (ctx) => showPlayers(app, ctx));
  bot.command('info', (ctx) => showInfo(app, ctx));
  bot.hears(BTN.info, (ctx) => showInfo(app, ctx));

  const commands = { budget: 'budget', deadline: 'wishDeadline', giftdate: 'giftDate' };
  for (const [command, field] of Object.entries(commands)) {
    bot.command(command, (ctx) => ownGame(app, ctx, (game, userId) => (ctx.match.trim()
      ? applySetting(app, ctx, game, userId, field, ctx.match)
      : askSetting(app, ctx, game, userId, field))));
  }
  for (const field of Object.keys(SETTINGS)) {
    app.onAction(`set.${field}`, ownerOnly((ctx, game, userId) => askSetting(app, ctx, game, userId, field)));
  }

  bot.command('draw', (ctx) => ownGame(app, ctx, (game) => runDraw(app, ctx, game)));
  app.onAction('draw', ownerOnly((ctx, game) => runDraw(app, ctx, game)));

  bot.command('reveal', (ctx) => ownGame(app, ctx, (game) => askReveal(app, ctx, game)));
  app.onAction('reveal.ask', ownerOnly((ctx, game) => askReveal(app, ctx, game)));
  app.onAction('reveal.yes', ownerOnly((ctx, game) => reveal(app, ctx, game)));

  bot.command('cancel', (ctx) => ownGame(app, ctx, (game) => askCancel(ctx, game)));
  app.onAction('cancel.ask', ownerOnly((ctx, game) => askCancel(ctx, game)));
  app.onAction('cancel.yes', ownerOnly((ctx, game, userId) => cancelGame(app, ctx, game, userId)));

  bot.command('leave', (ctx) => {
    const userId = app.userId(ctx);
    const game = store.currentGame(userId);
    return game ? leaveGame(app, ctx, game, userId) : notInGame(ctx);
  });
  app.onAction('leave', (ctx, game, userId) => leaveGame(app, ctx, game, userId));
}

// Handlers for the next message in a given mode.
export const inputs = {
  newGame: (app, ctx) => (ctx.message.text ? createGame(app, ctx, ctx.message.text) : ctx.reply('Напиши название текстом.')),
  setting: (app, ctx, game, mode) => {
    const userId = app.userId(ctx);
    if (game.ownerId !== userId) return ctx.reply(denied(game, userId));
    if (!ctx.message.text) return ctx.reply('Пришли значение текстом.');
    return applySetting(app, ctx, game, userId, mode.field, ctx.message.text);
  },
};
