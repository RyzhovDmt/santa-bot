import { santaOf } from '../draw.js';
import { BTN, button, cancelKeyboard, inline, mainMenu } from '../ui.js';

// Voice, video notes, contacts and locations can give the sender away, so they are not relayed.
const RELAYABLE = ['text', 'photo', 'video', 'animation', 'sticker'];

function targetOf(game, userId, to) {
  return to === 'receiver' ? game.pairs[userId] : santaOf(game.pairs, userId);
}

async function askMessage(app, ctx, game, userId, to) {
  if (game.status === 'open') return ctx.reply('Переписка откроется после жеребьёвки.');
  app.store.setMode(userId, { type: 'chat', code: game.code, to });
  await app.store.save();
  const prompt = to === 'receiver'
    ? `Напиши сообщение получателю (${game.participants[game.pairs[userId]].name}) — он не узнает, что это ты.`
    : 'Напиши сообщение своему Тайному Санте.';
  return ctx.reply(`${prompt}\nМожно текст, фото, видео, гифку или стикер.`, cancelKeyboard(game.code));
}

async function relay(app, ctx, game, mode) {
  const userId = app.userId(ctx);
  const msg = ctx.message;
  if (!RELAYABLE.some((kind) => msg[kind])) {
    return ctx.reply('Такое не пересылаю: голосовые, кружки и контакты могут выдать отправителя. Можно текст, фото, видео, гифку или стикер.');
  }

  const target = targetOf(game, userId, mode.to);
  const header = mode.to === 'receiver'
    ? `🎅 Сообщение от твоего Тайного Санты (игра «${game.title}»):`
    : `🎁 Сообщение от получателя — ${game.participants[userId].name}:`;
  // The answer goes back the other way: receiver replies to Santa and vice versa.
  const replyTo = mode.to === 'receiver' ? 'santa' : 'receiver';
  const replyKeyboard = inline([[button('↩️ Ответить', `chat.${replyTo}`, game.code)]]);

  try {
    if (msg.text) {
      await app.bot.api.sendMessage(target, `${header}\n\n${msg.text}`, replyKeyboard);
    } else {
      // copyMessage sends the content without a "forwarded from" label.
      await app.bot.api.sendMessage(target, header);
      await app.bot.api.copyMessage(target, ctx.chat.id, msg.message_id, replyKeyboard);
    }
  } catch (err) {
    console.error('Failed to relay anonymous message:', err.message);
    return ctx.reply('Не удалось доставить сообщение — возможно, собеседник заблокировал бота.');
  }

  app.store.setMode(userId, null);
  await app.store.save();
  return ctx.reply('Отправлено ✅', mainMenu(game));
}

export function register(app) {
  app.bot.hears(BTN.toSanta, (ctx) => {
    const userId = app.userId(ctx);
    const game = app.store.currentGame(userId);
    if (!game) return ctx.reply('Ты пока не в игре.', mainMenu());
    return askMessage(app, ctx, game, userId, 'santa');
  });
  app.onAction('chat.santa', (ctx, game, userId) => askMessage(app, ctx, game, userId, 'santa'));
  app.onAction('chat.receiver', (ctx, game, userId) => askMessage(app, ctx, game, userId, 'receiver'));
}

export const inputs = {
  chat: relay,
};
