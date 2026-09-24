import {
  MAX_CUSTOM_PHRASES, PHRASE_GROUPS, PHRASES, PLACEHOLDER_HELP, customPhrases, phraseLabel, validatePhrase,
} from '../texts.js';
import { button, cancelKeyboard, inline } from '../ui.js';

const DELETE_BUTTONS_PER_ROW = 5;

const canDelete = (game, userId, phrase) => game.ownerId === userId || phrase.by === userId;

const phraseCount = (game, key) => PHRASES[key].defaults.length + customPhrases(game, key).length;
const keysOf = (group) => Object.keys(PHRASES).filter((key) => PHRASES[key].menuGroup === group);

// Top level: single notifications and reminder groups; a group opens a list of its stages.
function menuView(game) {
  const rows = [];
  const shownGroups = new Set();
  for (const [key, p] of Object.entries(PHRASES)) {
    if (!p.menuGroup) {
      rows.push([button(`${phraseLabel(key)} (${phraseCount(game, key)})`, 'phr.key', game.code, key)]);
    } else if (!shownGroups.has(p.menuGroup)) {
      shownGroups.add(p.menuGroup);
      rows.push([button(`${PHRASE_GROUPS[p.menuGroup].label} ▸`, 'phr.group', game.code, p.menuGroup)]);
    }
  }
  return {
    text: `💬 Фразы уведомлений игры «${game.title}»\n\nВ каждом уведомлении бот выбирает случайную фразу из списка. Добавь свои — они появятся в уведомлениях всех участников этой игры. Авторы фраз не показываются.\n\nВыбери уведомление:`,
    keyboard: inline(rows),
  };
}

function groupView(game, group) {
  const rows = keysOf(group).map((key) => [button(`${phraseLabel(key)} (${phraseCount(game, key)})`, 'phr.key', game.code, key)]);
  rows.push([button('← Все уведомления', 'phr.menu', game.code, 'edit')]);
  return {
    text: `${PHRASE_GROUPS[group].label}\n\n${PHRASE_GROUPS[group].hint}`,
    keyboard: inline(rows),
  };
}

function keyView(game, key, userId) {
  const phrase = PHRASES[key];
  const custom = customPhrases(game, key);
  const lines = [
    `${phraseLabel(key)} — ${phrase.hint}`,
    '',
    ...(phrase.defaults.length ? ['Стандартные:', ...phrase.defaults.map((text) => `• ${text}`), ''] : []),
    'Добавленные в игре:',
    ...(custom.length ? custom.map((p, i) => `${i + 1}. ${p.text}`) : ['пока нет']),
    ...(phrase.placeholders.length
      ? ['', 'Подстановки:', ...phrase.placeholders.map((p) => `{${p}} — ${PLACEHOLDER_HELP[p]}`)]
      : []),
  ];

  const rows = [];
  if (custom.length < MAX_CUSTOM_PHRASES) rows.push([button('➕ Добавить фразу', 'phr.add', game.code, key)]);
  const deletable = custom.map((p, i) => ({ p, i })).filter(({ p }) => canDelete(game, userId, p));
  for (let i = 0; i < deletable.length; i += DELETE_BUTTONS_PER_ROW) {
    rows.push(deletable.slice(i, i + DELETE_BUTTONS_PER_ROW).map(({ p, i: n }) => button(`🗑 ${n + 1}`, 'phr.del', game.code, `${key}.${p.id}`)));
  }
  const group = phrase.menuGroup;
  rows.push([group
    ? button(`← ${PHRASE_GROUPS[group].label}`, 'phr.group', game.code, group)
    : button('← Все уведомления', 'phr.menu', game.code, 'edit')]);
  return { text: lines.join('\n'), keyboard: inline(rows) };
}

const edit = (ctx, view) => ctx.editMessageText(view.text, view.keyboard).catch(() => ctx.reply(view.text, view.keyboard));

async function askPhrase(app, ctx, game, userId, key) {
  if (!PHRASES[key]) return;
  if (customPhrases(game, key).length >= MAX_CUSTOM_PHRASES) return ctx.reply(`Уже ${MAX_CUSTOM_PHRASES} фраз — это максимум. Удали какую-нибудь, чтобы добавить новую.`);
  app.store.setMode(userId, { type: 'phrase', code: game.code, key });
  await app.store.save();
  const phrase = PHRASES[key];
  const help = phrase.placeholders.length
    ? `\n\nМожно использовать подстановки:\n${phrase.placeholders.map((p) => `{${p}} — ${PLACEHOLDER_HELP[p]}`).join('\n')}`
    : '';
  const example = phrase.example ?? phrase.defaults[1] ?? phrase.defaults[0];
  return ctx.reply(`Напиши ${phrase.flavor ? 'слово или короткую фразу' : 'фразу'} для «${phraseLabel(key)}».${help}\n\nНапример: ${example}`, cancelKeyboard(game.code));
}

async function addPhrase(app, ctx, game, mode) {
  const userId = app.userId(ctx);
  const text = ctx.message.text?.trim();
  if (!text) return ctx.reply('Фразу нужно прислать текстом.');
  const error = validatePhrase(mode.key, text);
  if (error) return ctx.reply(`${error}\n\nПопробуй ещё раз:`);
  if (customPhrases(game, mode.key).length >= MAX_CUSTOM_PHRASES) return ctx.reply(`Уже ${MAX_CUSTOM_PHRASES} фраз — это максимум.`);

  game.phrases ??= {};
  game.phrases[mode.key] ??= [];
  game.nextPhraseId = (game.nextPhraseId ?? 0) + 1;
  game.phrases[mode.key].push({ id: game.nextPhraseId, text, by: userId });
  app.store.setMode(userId, null);
  await app.store.save();

  const view = keyView(game, mode.key, userId);
  return ctx.reply(`Фраза добавлена ✅\n\n${view.text}`, view.keyboard);
}

async function deletePhrase(app, ctx, game, userId, arg) {
  const [key, id] = (arg ?? '').split('.');
  const list = customPhrases(game, key);
  const phrase = list.find((p) => String(p.id) === id);
  if (!phrase) return edit(ctx, keyView(game, key, userId));
  if (!canDelete(game, userId, phrase)) return ctx.reply('Удалить можно только свою фразу.');

  game.phrases[key] = list.filter((p) => p !== phrase);
  await app.store.save();
  return edit(ctx, keyView(game, key, userId));
}

export function register(app) {
  app.onAction('phr.menu', (ctx, game, userId, arg) => {
    const view = menuView(game);
    return arg === 'edit' ? edit(ctx, view) : ctx.reply(view.text, view.keyboard);
  });
  app.onAction('phr.group', (ctx, game, userId, group) => PHRASE_GROUPS[group] && edit(ctx, groupView(game, group)));
  app.onAction('phr.key', (ctx, game, userId, key) => PHRASES[key] && edit(ctx, keyView(game, key, userId)));
  app.onAction('phr.add', (ctx, game, userId, key) => askPhrase(app, ctx, game, userId, key));
  app.onAction('phr.del', (ctx, game, userId, arg) => deletePhrase(app, ctx, game, userId, arg));
}

export const inputs = {
  phrase: addPhrase,
};
