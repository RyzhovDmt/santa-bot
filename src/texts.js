// Phrase pools for notifications. Every notification = a random phrase + a fixed info block
// added by the bot, so a phrase can't drop important details (receiver, dates, wish).
// Defaults can be edited here; each game can add its own phrases from the bot.

import { plural } from './ui.js';

export const MAX_PHRASE_LENGTH = 300;
export const MAX_CUSTOM_PHRASES = 20;

export const PHRASES = {
  join: {
    label: '👋 Приветствие',
    hint: 'когда участник вступает в игру',
    placeholders: ['name', 'title'],
    defaults: [
      'Ты в игре «{title}»! 🎄',
      'Добро пожаловать в «{title}», {name}! 🎅',
      'Ура, ещё один Санта в «{title}»! ✨',
    ],
  },
  draw: {
    label: '🎲 Жеребьёвка',
    hint: 'сообщение с именем получателя',
    placeholders: ['name', 'title', 'receiver'],
    defaults: [
      '🎅 Жеребьёвка в игре «{title}» проведена!',
      '🎲 Жребий брошен, {name}!',
      '✨ Волшебный мешок Санты сделал выбор!',
      '🦌 Олени доставили тебе имя получателя!',
    ],
  },
  // Reminders are graded by days left: a stage applies from its minDays up to the next stage's minDays - 1.
  // Change minDays to move the boundaries; labels in the bot follow automatically.
  wishEarly: {
    label: '✍️ Пожелание',
    hint: 'спокойное напоминание, если пожелание не готово',
    stage: { group: 'wish', minDays: 7 },
    placeholders: ['name', 'title', 'days', 'date'],
    defaults: [
      '✍️ {name}, самое время подумать, что ты хочешь получить.',
      '🎁 Чем подробнее пожелание, тем точнее подарок.',
      '🎄 Санта уже собирается в путь — расскажи ему о своей мечте.',
    ],
  },
  wishSoon: {
    label: '✍️ Пожелание',
    hint: 'дедлайн приближается, а пожелание не готово',
    stage: { group: 'wish', minDays: 3 },
    placeholders: ['name', 'title', 'days', 'date'],
    defaults: [
      '⏰ Санта ждёт твоё пожелание!',
      '🦌 Олени уже запряжены, а пожелания всё нет!',
      '📝 {name}, осталось {days} — не откладывай пожелание.',
    ],
  },
  wishClose: {
    label: '✍️ Пожелание',
    hint: 'срочно: дедлайн почти наступил',
    stage: { group: 'wish', minDays: 1 },
    placeholders: ['name', 'title', 'days', 'date'],
    defaults: [
      '⚠️ {name}, до дедлайна всего {days}!',
      '🏃 Санта уже пакует мешок — успей написать пожелание!',
      '⏳ Совсем скоро жеребьёвка, а твоего пожелания всё нет.',
    ],
  },
  lastDay: {
    label: '🔥 Пожелание',
    hint: 'в день дедлайна, если пожелание не готово',
    stage: { group: 'wish', minDays: 0 },
    placeholders: ['name', 'title', 'date'],
    defaults: [
      '🔥 Сегодня последний день, чтобы заполнить пожелание!',
      '⏳ {name}, время почти вышло — пожелание нужно сегодня.',
      '🚨 Последний шанс рассказать Санте о своей мечте!',
    ],
  },
  giftEarly: {
    label: '🛍 Подарок',
    hint: 'спокойное напоминание, если подарок не куплен',
    stage: { group: 'gift', minDays: 15 },
    placeholders: ['name', 'title', 'days', 'date', 'receiver'],
    defaults: [
      '🎄 До праздника ещё {days} — можно спокойно выбрать подарок.',
      '💡 {name}, самое время присмотреться к подаркам.',
      '📦 {receiver} уже мечтает о сюрпризе.',
    ],
  },
  giftSoon: {
    label: '🛍 Подарок',
    hint: 'вручение приближается, а подарок не куплен',
    stage: { group: 'gift', minDays: 6 },
    placeholders: ['name', 'title', 'days', 'date', 'receiver'],
    defaults: [
      '🎁 Подарок сам себя не купит!',
      '🛍 Самое время заглянуть в магазин.',
      '🎄 Праздник всё ближе, {name}!',
    ],
  },
  giftClose: {
    label: '🛍 Подарок',
    hint: 'срочно: вручение совсем скоро',
    stage: { group: 'gift', minDays: 1 },
    placeholders: ['name', 'title', 'days', 'date', 'receiver'],
    defaults: [
      '🚨 {name}, до вручения всего {days}!',
      '🏃 Бегом за подарком — {receiver} ждёт!',
      '⏰ Санта не опаздывает. И ты не опоздай!',
    ],
  },
  reveal: {
    label: '🎉 Раскрытие Сант',
    hint: 'когда организатор раскрывает, кто кому дарил',
    placeholders: ['name', 'title', 'santa'],
    defaults: [
      '🎉 Тайные Санты игры «{title}» раскрыты!',
      '🎭 Маски сброшены!',
      '✨ Настало время узнать, кто был твоим Сантой!',
    ],
  },
};

const daysWord = (n) => plural(n, ['день', 'дня', 'дней']);

// "✍️ Пожелание: за 3–6 дней" for staged reminders, plain label otherwise.
export function phraseLabel(key) {
  const { label, stage } = PHRASES[key];
  if (!stage) return label;
  if (stage.minDays === 0) return `${label}: последний день`;
  const next = Object.values(PHRASES)
    .filter((p) => p.stage?.group === stage.group && p.stage.minDays > stage.minDays)
    .map((p) => p.stage.minDays)
    .sort((a, b) => a - b)[0];
  if (next === undefined) return `${label}: за ${stage.minDays}+ ${daysWord(stage.minDays)}`;
  const last = next - 1;
  return last === stage.minDays
    ? `${label}: за ${last} ${daysWord(last)}`
    : `${label}: за ${stage.minDays}–${last} ${daysWord(last)}`;
}

export const PLACEHOLDER_HELP = {
  name: 'имя того, кто получает уведомление',
  title: 'название игры',
  days: 'сколько дней осталось',
  date: 'дата дедлайна или вручения',
  receiver: 'кому ты даришь',
  santa: 'кто тебе дарит',
};

// "{a} x {b}" -> ['a', 'b']; unclosed braces are ignored.
export function placeholdersIn(text) {
  return text.split('{').slice(1).filter((part) => part.includes('}')).map((part) => part.slice(0, part.indexOf('}')));
}

export function renderPhrase(template, vars) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value ?? ''), template);
}

// Returns an error message or null.
export function validatePhrase(key, text) {
  if (!text) return 'Фраза пустая.';
  if (text.length > MAX_PHRASE_LENGTH) return `Слишком длинная фраза: максимум ${MAX_PHRASE_LENGTH} символов.`;
  const allowed = PHRASES[key].placeholders;
  const unknown = placeholdersIn(text).filter((p) => !allowed.includes(p));
  if (unknown.length) {
    return `Здесь нельзя использовать: ${unknown.map((p) => `{${p}}`).join(', ')}.\nМожно: ${allowed.map((p) => `{${p}}`).join(', ')}.`;
  }
  return null;
}

export const customPhrases = (game, key) => game.phrases?.[key] ?? [];

// Phrase key for a reminder group ('wish' | 'gift') by days left: the stage with the largest minDays <= daysLeft.
export function stageKey(group, daysLeft) {
  const stages = Object.entries(PHRASES)
    .filter(([, p]) => p.stage?.group === group && daysLeft >= p.stage.minDays)
    .sort(([, a], [, b]) => b.stage.minDays - a.stage.minDays);
  return stages[0]?.[0];
}

export function pickPhrase(game, key, vars, random = Math.random) {
  const pool = [...PHRASES[key].defaults, ...customPhrases(game, key).map((p) => p.text)];
  return renderPhrase(pool[Math.floor(random() * pool.length)], vars);
}

// Name without "(@username)" reads better inside a sentence.
export const shortName = (participant) => participant.name.split(' (@')[0];
