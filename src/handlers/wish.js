import { santaOf } from '../draw.js';
import { flavored } from '../texts.js';
import { BTN, button, cancelKeyboard, giftDetails, inline, mainMenu } from '../ui.js';

// Keeps the draw message (wish + details) under Telegram's 4096 chars limit.
const MAX_WISH = 3000;

function wishView(game, userId) {
  const p = game.participants[userId];
  const c = game.code;
  if (!p.wish) {
    return {
      text: `Пожелание в игре «${game.title}» пока не заполнено.`,
      keyboard: inline([[button('✏️ Написать пожелание', 'wish.replace', c)]]),
    };
  }
  return {
    text: `Твоё пожелание в игре «${game.title}»:\n\n${p.wish}\n\nСтатус: ${p.wishReady ? '✅ готово' : '⏳ ещё дописываю'}`,
    keyboard: inline([
      [button('➕ Дополнить', 'wish.add', c), button('🔄 Заменить', 'wish.replace', c)],
      [p.wishReady ? button('⏳ Ещё дописываю', 'wish.unready', c) : button('✅ Готово', 'wish.ready', c)],
    ]),
  };
}

function whomView(game, userId) {
  const receiver = game.participants[game.pairs[userId]];
  const me = game.participants[userId];
  const details = giftDetails(game);
  return {
    text: [
      `Ты даришь подарок: ${receiver.name}`,
      '',
      `Пожелание:\n${receiver.wish}`,
      ...(details ? ['', details] : []),
      '',
      `Подарок: ${me.giftBought ? '🛍 куплен' : '⏳ ещё не куплен'}`,
    ].join('\n'),
    keyboard: inline([
      [button('✉️ Написать получателю', 'chat.receiver', game.code)],
      [me.giftBought ? button('↩️ Ещё не куплен', 'gift.unbought', game.code) : button('🛍 Подарок куплен', 'gift.bought', game.code)],
    ]),
  };
}

// Shows a view as a new message, or updates the message with the pressed button.
function render(ctx, view, edit = false) {
  if (edit) return ctx.editMessageText(view.text, view.keyboard).catch(() => ctx.reply(view.text, view.keyboard));
  return ctx.reply(view.text, view.keyboard);
}

function currentGameOrHint(app, ctx) {
  const game = app.store.currentGame(app.userId(ctx));
  if (!game) ctx.reply(`Ты пока не в игре. Попроси у организатора ссылку-приглашение или создай свою: «${BTN.create}».`, mainMenu());
  return game;
}

function showWhom(ctx, game, userId, edit = false) {
  if (game.status === 'open') return ctx.reply('Жеребьёвка ещё не проведена — получатель появится после неё.');
  return render(ctx, whomView(game, userId), edit);
}

async function askWish(app, ctx, game, userId, how) {
  app.store.setMode(userId, { type: 'wish', code: game.code, how });
  await app.store.save();
  const prompt = how === 'add' ? 'Напиши, что добавить к пожеланию:' : 'Напиши пожелание к подарку одним сообщением:';
  return ctx.reply(prompt, cancelKeyboard(game.code));
}

export async function saveWish(app, ctx, game, userId, rawText, how) {
  const p = game.participants[userId];
  const text = rawText.trim();
  if (!text) return ctx.reply('Пожелание пустое. Напиши, что хочешь получить.');

  const adding = how === 'add' && Boolean(p.wish);
  const wish = adding ? `${p.wish}\n${text}` : text;
  if (wish.length > MAX_WISH) return ctx.reply(`Слишком длинное пожелание: максимум ${MAX_WISH} символов.`);

  p.wish = wish;
  p.wishReady = true;
  app.store.setMode(userId, null);
  await app.store.save();

  let suffix = '';
  if (game.status !== 'open') {
    const santaId = santaOf(game.pairs, userId);
    const header = adding
      ? `➕ Пожелание твоего получателя (${p.name}) дополнено:\n\n${text}\n\nЦеликом:\n${wish}`
      : `✏️ Пожелание твоего получателя (${p.name}) изменилось:\n\n${wish}`;
    const sent = santaId && await app.notify(santaId, flavored(game, 'santaUpdate', game.participants[santaId], header, { receiver: p.name }));
    suffix = sent ? ' Твой Санта получил обновление.' : '';
  }

  const view = wishView(game, userId);
  return ctx.reply(flavored(game, 'wishSaved', p, `Пожелание сохранено ✅${suffix}\n\n${view.text}`), view.keyboard);
}

async function setFlag(app, ctx, game, userId, flag, value, view) {
  const p = game.participants[userId];
  if (flag === 'wishReady' && value && !p.wish) return ctx.reply('Сначала напиши пожелание.');
  if (flag === 'giftBought' && game.status === 'open') return ctx.reply('Жеребьёвка ещё не проведена.');
  p[flag] = value;
  await app.store.save();
  await render(ctx, view(game, userId), true);
  if (flag === 'giftBought' && value) {
    return ctx.reply(flavored(game, 'giftBought', p, 'Отметил: подарок куплен 🛍', { receiver: game.participants[game.pairs[userId]].name }));
  }
}

export function register(app) {
  const { bot } = app;

  const showWish = (ctx) => {
    const game = currentGameOrHint(app, ctx);
    return game && render(ctx, wishView(game, app.userId(ctx)));
  };
  bot.hears(BTN.wish, showWish);
  bot.command('wish', (ctx) => {
    if (!ctx.match.trim()) return showWish(ctx);
    const game = currentGameOrHint(app, ctx);
    return game && saveWish(app, ctx, game, app.userId(ctx), ctx.match, 'replace');
  });

  const whom = (ctx) => {
    const game = currentGameOrHint(app, ctx);
    return game && showWhom(ctx, game, app.userId(ctx));
  };
  bot.hears(BTN.whom, whom);
  bot.command('whom', whom);

  app.onAction('wish.view', (ctx, game, userId) => render(ctx, wishView(game, userId)));
  app.onAction('wish.add', (ctx, game, userId) => askWish(app, ctx, game, userId, 'add'));
  app.onAction('wish.replace', (ctx, game, userId) => askWish(app, ctx, game, userId, 'replace'));
  app.onAction('wish.ready', (ctx, game, userId) => setFlag(app, ctx, game, userId, 'wishReady', true, wishView));
  app.onAction('wish.unready', (ctx, game, userId) => setFlag(app, ctx, game, userId, 'wishReady', false, wishView));

  app.onAction('whom.view', (ctx, game, userId) => showWhom(ctx, game, userId));
  app.onAction('gift.bought', (ctx, game, userId) => setFlag(app, ctx, game, userId, 'giftBought', true, whomView));
  app.onAction('gift.unbought', (ctx, game, userId) => setFlag(app, ctx, game, userId, 'giftBought', false, whomView));
}

export const inputs = {
  wish: (app, ctx, game, mode) => (ctx.message.text
    ? saveWish(app, ctx, game, app.userId(ctx), ctx.message.text, mode.how)
    : ctx.reply('Пожелание нужно прислать текстом.')),
};
