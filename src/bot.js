import { Bot } from 'grammy';
import { todayIn } from './dates.js';
import * as chat from './handlers/chat.js';
import * as game from './handlers/game.js';
import * as phrases from './handlers/phrases.js';
import * as wish from './handlers/wish.js';
import { Store } from './storage.js';
import { BTN, BUTTON_LABELS, HELP, mainMenu } from './ui.js';

const SEND_DELAY_MS = 35; // stay well below Telegram's ~30 msg/s limit
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const COMMANDS = [
  { command: 'menu', description: 'Показать меню' },
  { command: 'new', description: 'Создать игру' },
  { command: 'wish', description: 'Моё пожелание' },
  { command: 'whom', description: 'Кому я дарю' },
  { command: 'status', description: 'Участники игры' },
  { command: 'info', description: 'Об игре и настройки' },
  { command: 'help', description: 'Помощь' },
];

// Bot info is built from config instead of calling getMe on every cold start (saves a subrequest).
function botInfo(env) {
  return {
    id: Number(env.BOT_TOKEN.split(':')[0]),
    is_bot: true,
    first_name: env.BOT_NAME || env.BOT_USERNAME,
    username: env.BOT_USERNAME,
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  };
}

// Game codes an update refers to, so that their games are loaded before handlers run.
function codesOf(ctx) {
  const data = ctx.callbackQuery?.data;
  if (data) return [data.split(':')[1]];
  const text = ctx.message?.text ?? '';
  if (text.startsWith('/start ')) return [text.slice('/start '.length).trim().toUpperCase()];
  return [];
}

// A bot instance is created per request: a Worker gets its env (token, DB) only with the request.
export function createApp(env, { apiTransformer } = {}) {
  const bot = new Bot(env.BOT_TOKEN, { botInfo: botInfo(env) });
  if (apiTransformer) bot.api.config.use(apiTransformer);

  const store = new Store(env.DB);
  const timeZone = env.BOT_TIMEZONE || 'Europe/Moscow';
  const actions = new Map();

  // Shared helpers passed to all handler modules.
  const app = {
    bot,
    store,
    timeZone,
    today: () => todayIn(timeZone),
    userId: (ctx) => String(ctx.from.id),
    inviteLink: (code) => `https://t.me/${bot.botInfo.username}?start=${code}`,

    // Inline button handler; callback data is "<action>:<gameCode>[:<arg>]".
    onAction(name, handler) {
      actions.set(name, handler);
    },

    async notify(userId, text, extra) {
      try {
        await bot.api.sendMessage(userId, text, extra);
        return true;
      } catch (err) {
        console.error(`Failed to send message to ${userId}:`, err.message);
        return false;
      }
    },

    // messages: [{ to, text, extra }]; returns ids that didn't get the message.
    async broadcast(messages) {
      const failed = [];
      for (const { to, text, extra } of messages) {
        if (!(await app.notify(to, text, extra))) failed.push(to);
        await sleep(SEND_DELAY_MS);
      }
      return failed;
    },
  };

  // Wishes and pairs are private, so the bot works only in direct messages.
  bot.use((ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private') {
      if (ctx.message?.text?.startsWith('/')) {
        return ctx.reply(`Я работаю только в личных сообщениях: https://t.me/${ctx.me.username}`);
      }
      return;
    }
    if (!ctx.from) return;
    return next();
  });

  bot.use(async (ctx, next) => {
    await store.preload(app.userId(ctx), codesOf(ctx));
    return next();
  });

  // A command or a menu button interrupts whatever the bot was waiting for.
  bot.use(async (ctx, next) => {
    const text = ctx.message?.text;
    if (text && (text.startsWith('/') || BUTTON_LABELS.has(text))) {
      const userId = app.userId(ctx);
      if (store.getMode(userId)) {
        store.setMode(userId, null);
        await store.save();
      }
    }
    return next();
  });

  game.register(app);
  wish.register(app);
  chat.register(app);
  phrases.register(app);

  bot.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const [action, code, arg] = ctx.callbackQuery.data.split(':');
    const userId = app.userId(ctx);

    if (action === 'dismiss' || action === 'mode.cancel') {
      if (action === 'mode.cancel') {
        store.setMode(userId, null);
        await store.save();
      }
      return ctx.editMessageText('Отменено.').catch(() => {});
    }

    const handler = actions.get(action);
    if (!handler) return;
    const current = code && store.getGame(code);
    if (!current || !current.participants[userId]) return ctx.reply('Эта игра больше недоступна.');
    return handler(ctx, current, userId, arg);
  });

  const inputs = { ...game.inputs, ...wish.inputs, ...chat.inputs, ...phrases.inputs };

  bot.on('message', async (ctx) => {
    const userId = app.userId(ctx);
    const text = ctx.message.text;
    if (text?.startsWith('/')) return ctx.reply(`Не знаю такой команды.\n\n${HELP}`);

    const mode = store.getMode(userId);
    if (mode) {
      const modeGame = mode.code ? store.getGame(mode.code) : undefined;
      if (mode.code && !modeGame?.participants[userId]) {
        store.setMode(userId, null);
        await store.save();
        return ctx.reply('Эта игра больше недоступна.', mainMenu(store.currentGame(userId)));
      }
      return inputs[mode.type](app, ctx, modeGame, mode);
    }

    const current = store.currentGame(userId);
    // The very first text after joining is the wish: the join message asks for it.
    if (text && current && !current.participants[userId].wish) {
      return wish.saveWish(app, ctx, current, userId, text, 'replace');
    }

    if (!current) return ctx.reply(`Ты пока не в игре. Попроси у организатора ссылку-приглашение или создай свою: «${BTN.create}».`, mainMenu());
    const hints = [`«${BTN.wish}» — изменить или дополнить пожелание`];
    if (current.status !== 'open') hints.push(`«${BTN.whom}» — получатель и переписка с ним`, `«${BTN.toSanta}» — написать своему Санте`);
    return ctx.reply(`Пользуйся кнопками внизу 👇\n\n${hints.join('\n')}`, mainMenu(current));
  });

  bot.catch(async (err) => {
    // Only the stack: API errors also carry the request payload, which may contain a pair or a wish.
    console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error?.stack ?? String(err.error));
    await err.ctx.reply('Что-то пошло не так, попробуй ещё раз.').catch(() => {});
  });

  return app;
}
