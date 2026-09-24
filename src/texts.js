// Phrase pools for notifications. Every notification = a random phrase + a fixed info block
// added by the bot, so a phrase can't drop important details (receiver, dates, wish).
// Defaults can be edited here; each game can add its own phrases from the bot.

export const MAX_PHRASE_LENGTH = 300;
export const MAX_CUSTOM_PHRASES = 20;

// Reminder tone escalates with the number of the reminder a participant gets (1st, 2nd, ...).
// A stage applies from its `from` number up to the next stage; the last stage covers the rest.
// Change the numbers to move boundaries — labels in the bot follow automatically.
const STAGE_STARTS = [1, 2, 3, 4, 5, 6, 7];

const WISH_STAGES = [
  [
    '✍️ {name}, самое время подумать, что ты хочешь получить.',
    '🎁 Чем подробнее пожелание, тем точнее подарок.',
    '🎄 Санта уже собирается в путь — расскажи ему о своей мечте.',
  ],
  [
    '⏰ Санта ждёт твоё пожелание!',
    '📝 {name}, не забудь про пожелание — Санта очень ждёт.',
    '🦌 Олени уже запряжены, а пожелания всё нет!',
  ],
  [
    '🤔 {name}, Санта начинает волноваться: пожелания всё нет.',
    '📬 Почтовый ящик Санты пуст. Исправим?',
    '🎅 Санта перечитал все письма, а твоего там нет.',
  ],
  [
    '⚠️ {name}, это уже {count}-е напоминание про пожелание!',
    '😬 Эльфы уже шепчутся: пожелания от тебя всё нет.',
    '🧦 Без пожелания рискуешь получить носки. Опять.',
  ],
  [
    '🚨 {name}, Санта почти отчаялся дождаться твоего пожелания!',
    '📣 Внимание! Пожелание всё ещё не написано!',
    '🙏 Пожалуйста, {name}, всего пара слов для Санты.',
  ],
  [
    '😤 {count}-е напоминание, {name}. Санта держится из последних сил.',
    '🔥 Эльфы объявили забастовку, пока ты не напишешь пожелание.',
    '🦌 Олени отказываются лететь без твоего пожелания.',
  ],
  [
    '🫠 {name}, Санта уже не знает, как ещё тебя попросить.',
    '📜 Это напоминание № {count}. Легенды о твоём пожелании передают из уст в уста.',
    '🎁 Ладно, Санта подарит сюрприз. Но пожелание всё-таки напиши!',
  ],
];

const GIFT_STAGES = [
  [
    '🎄 До праздника ещё {days} — можно спокойно выбрать подарок.',
    '💡 {name}, самое время присмотреться к подаркам.',
    '📦 {receiver} уже мечтает о сюрпризе.',
  ],
  [
    '🎁 Подарок сам себя не купит!',
    '🛍 Самое время заглянуть в магазин.',
    '🎄 Праздник всё ближе, {name}!',
  ],
  [
    '🤔 {name}, подарок для {receiver} уже выбран?',
    '🛒 Корзина пуста, а праздник всё ближе.',
    '🎅 Санта интересуется, как там подарок.',
  ],
  [
    '⚠️ {name}, это уже {count}-е напоминание про подарок!',
    '⏳ До вручения {days}, а подарок всё не куплен.',
    '😬 {receiver} ждёт, а подарка всё нет.',
  ],
  [
    '🚨 {name}, пора бежать за подарком!',
    '🏃 Бегом за подарком — {receiver} ждёт!',
    '📣 Внимание! Подарок для {receiver} всё ещё не куплен!',
  ],
  [
    '😤 {count}-е напоминание, {name}. Подарок сам не появится.',
    '🔥 Санта нервно поглядывает на календарь: осталось {days}.',
    '⏰ Санта не опаздывает. И ты не опоздай!',
  ],
  [
    '🫠 {name}, это напоминание № {count}. Подарок, ну пожалуйста!',
    '🎁 Последний звонок: {receiver} без подарка не останется, правда?',
    '🦌 Олени готовы подвезти тебя до магазина.',
  ],
];

function stageEntries(group, label, hint, placeholders, stagePhrases) {
  return Object.fromEntries(STAGE_STARTS.map((from, i) => [
    `${group}${i + 1}`,
    { label, hint, menuGroup: group, stage: { group, from }, placeholders, defaults: stagePhrases[i] },
  ]));
}

export const PHRASE_GROUPS = {
  wish: '✍️ Напоминания о пожелании',
  gift: '🛍 Напоминания о подарке',
};

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
  ...stageEntries('wish', '✍️ Пожелание', 'раз в 2 дня до дедлайна, если пожелание не готово',
    ['name', 'title', 'days', 'date', 'count'], WISH_STAGES),
  lastDay: {
    label: '🔥 Пожелание: последний день',
    hint: 'в день дедлайна — вместо обычной ступени',
    menuGroup: 'wish',
    placeholders: ['name', 'title', 'date', 'count'],
    defaults: [
      '🔥 Сегодня последний день, чтобы заполнить пожелание!',
      '⏳ {name}, время почти вышло — пожелание нужно сегодня.',
      '🚨 Последний шанс рассказать Санте о своей мечте!',
    ],
  },
  ...stageEntries('gift', '🛍 Подарок', 'раз в 5 дней до вручения, если подарок не куплен',
    ['name', 'title', 'days', 'date', 'receiver', 'count'], GIFT_STAGES),
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

export const PLACEHOLDER_HELP = {
  name: 'имя того, кто получает уведомление',
  title: 'название игры',
  days: 'сколько дней осталось',
  date: 'дата дедлайна или вручения',
  receiver: 'кому ты даришь',
  santa: 'кто тебе дарит',
  count: 'номер напоминания этому участнику',
};

// "✍️ Пожелание: 3-е напоминание" for stages, plain label otherwise.
export function phraseLabel(key) {
  const { label, stage } = PHRASES[key];
  if (!stage) return label;
  const next = Object.values(PHRASES)
    .filter((p) => p.stage?.group === stage.group && p.stage.from > stage.from)
    .map((p) => p.stage.from)
    .sort((a, b) => a - b)[0];
  if (next === undefined) return `${label}: ${stage.from}-е и дальше`;
  const last = next - 1;
  return last === stage.from ? `${label}: ${last}-е напоминание` : `${label}: ${stage.from}–${last}-е напоминания`;
}

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

// Phrase key for a reminder group ('wish' | 'gift') by the reminder number: the stage with the largest from <= number.
export function stageKey(group, number) {
  const stages = Object.entries(PHRASES)
    .filter(([, p]) => p.stage?.group === group && number >= p.stage.from)
    .sort(([, a], [, b]) => b.stage.from - a.stage.from);
  return stages[0]?.[0];
}

export function pickPhrase(game, key, vars, random = Math.random) {
  const pool = [...PHRASES[key].defaults, ...customPhrases(game, key).map((p) => p.text)];
  return renderPhrase(pool[Math.floor(random() * pool.length)], vars);
}

// Name without "(@username)" reads better inside a sentence.
export const shortName = (participant) => participant.name.split(' (@')[0];
