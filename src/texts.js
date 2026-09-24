// Phrase pools for notifications. Every notification = a random phrase + a fixed info block
// added by the bot, so a phrase can't drop important details (receiver, dates, wish).
// Defaults can be edited here; each game can add its own phrases from the bot.

export const MAX_PHRASE_LENGTH = 300;
const MAX_CUSTOM_PHRASES = 100;
const MAX_CUSTOM_FLAVOR = 200;

// Own phrases per notification in a game; short flavor lists may be longer.
export const maxCustomPhrases = (key) => (PHRASES[key]?.flavor ? MAX_CUSTOM_FLAVOR : MAX_CUSTOM_PHRASES);

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
    '🤔 {name}, подарок уже выбран? {receiver} ждёт.',
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
    '📣 Внимание! Подарок всё ещё не куплен, а {receiver} ждёт!',
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
  wish: { label: '✍️ Напоминания о пожелании', hint: 'Чем больше напоминаний участник уже получил, тем настойчивее тон. Выбери ступень:' },
  gift: { label: '🛍 Напоминания о подарке', hint: 'Чем больше напоминаний участник уже получил, тем настойчивее тон. Выбери ступень:' },
  replies: { label: '📌 Ответы бота', hint: 'Бот отвечает этими фразами на действия участников: сохранил пожелание, купил подарок, отправил сообщение, написал что-то непонятное…' },
  flavor: { label: '🗣 Обращения, междометия, фразочки', hint: 'Бот случайно добавляет их в любое уведомление: обращение и междометие — в начало («Ну чё, братан! …»), фразочку — в конец. Пока списки пустые — ничего не добавляется.' },
};

// Flavor lists: short words prepended to notifications and catchphrases appended, at random.
const FLAVOR_MAX_LENGTH = { interjections: 40, addresses: 40, catchphrases: 150 };
const INTERJECTION_CHANCE = 0.6;
const ADDRESS_CHANCE = 0.75;
const CATCHPHRASE_CHANCE = 0.5;

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
  ...stageEntries('wish', '✍️ Пожелание', 'каждый день до дедлайна, если пожелание не готово',
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
  ...stageEntries('gift', '🛍 Подарок', 'каждый день до вручения, если подарок не куплен',
    ['name', 'title', 'days', 'date', 'receiver', 'count'], GIFT_STAGES),
  wishSaved: {
    label: '✅ Пожелание сохранено',
    hint: 'ответ, когда участник записал или дополнил пожелание',
    menuGroup: 'replies',
    placeholders: ['name', 'title'],
    defaults: ['📝 Записал!', '✅ Санта в курсе.', '🎁 Отличное пожелание, {name}!'],
  },
  giftBought: {
    label: '🛍 Подарок куплен',
    hint: 'ответ, когда участник отметил, что купил подарок',
    menuGroup: 'replies',
    placeholders: ['name', 'title', 'receiver'],
    defaults: ['🛍 Красота! Подарок куплен.', '🎉 {name}, вот это по-сантовски!', '✅ Отметил: подарок есть.'],
  },
  sent: {
    label: '📨 Сообщение отправлено',
    hint: 'ответ после анонимного сообщения Санте или получателю',
    menuGroup: 'replies',
    placeholders: ['name', 'title'],
    defaults: ['📨 Доставлено.', '🤫 Отправил анонимно.', '🦌 Олени унесли твоё сообщение.'],
  },
  santaUpdate: {
    label: '✏️ Санте: пожелание изменилось',
    hint: 'Санта получает, когда его получатель меняет пожелание',
    menuGroup: 'replies',
    placeholders: ['name', 'title', 'receiver'],
    defaults: ['✏️ Новости от получателя!', '📬 Получатель кое-что поменял в пожелании.', '👀 Обнови планы, Санта.'],
  },
  settingsUpdate: {
    label: '📣 Изменились настройки игры',
    hint: 'всем участникам, когда организатор меняет бюджет или даты',
    menuGroup: 'replies',
    placeholders: ['name', 'title'],
    defaults: ['📣 Внимание, изменения!', 'ℹ️ Организатор что-то поменял.', '🔧 Обновление правил игры.'],
  },
  idle: {
    label: '🤔 Бот не понял',
    hint: 'ответ на сообщение, которое бот не ждал',
    menuGroup: 'replies',
    placeholders: ['name', 'title'],
    defaults: ['🤔 Не понял, но звучит интересно.', '👇 Кнопки внизу, {name}.', '🙃 Я бот, я так не умею.'],
  },
  denied: {
    label: '🔒 Кнопка организатора',
    hint: 'ответ, когда участник пытается сделать то, что может только организатор',
    menuGroup: 'replies',
    placeholders: ['name', 'title'],
    defaults: ['🙅 Не-а.', '🔒 Это кнопка организатора.', '✋ Полегче, это не твоя зона.'],
  },
  interjections: {
    label: '💥 Междометия',
    hint: 'в начале уведомления, примерно в половине случаев',
    menuGroup: 'flavor',
    flavor: true,
    example: 'Ну чё',
    placeholders: [],
    defaults: [],
  },
  addresses: {
    label: '🗣 Обращения',
    hint: 'в начале уведомления, в большинстве случаев',
    menuGroup: 'flavor',
    flavor: true,
    example: 'братан',
    placeholders: [],
    defaults: [],
  },
  catchphrases: {
    label: '💬 Фразочки',
    hint: 'коронные фразы — в конце уведомления, примерно в трети случаев',
    menuGroup: 'flavor',
    flavor: true,
    example: 'Ну это база',
    placeholders: [],
    defaults: [],
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

// Names are substituted as-is (nominative): "для {receiver}" would read "для Ирина".
const NAME_PLACEHOLDERS = ['name', 'receiver', 'santa'];
const PREPOSITIONS = new Set(['для', 'у', 'к', 'ко', 'от', 'про', 'без', 'о', 'об', 'обо', 'с', 'со', 'за', 'над', 'под', 'перед', 'при', 'по']);

function nameAfterPreposition(text) {
  for (const p of NAME_PLACEHOLDERS) {
    for (let i = text.indexOf(`{${p}}`); i !== -1; i = text.indexOf(`{${p}}`, i + 1)) {
      const before = text.slice(0, i).trim().split(' ');
      if (PREPOSITIONS.has(before[before.length - 1].toLowerCase())) return `${before[before.length - 1]} {${p}}`;
    }
  }
  return null;
}

// Returns an error message or null.
export function validatePhrase(key, text) {
  if (!text) return 'Фраза пустая.';
  const maxLength = PHRASES[key].flavor ? FLAVOR_MAX_LENGTH[key] : MAX_PHRASE_LENGTH;
  if (text.length > maxLength) return `Слишком длинно: максимум ${maxLength} символов.`;
  const allowed = PHRASES[key].placeholders;
  const unknown = placeholdersIn(text).filter((p) => !allowed.includes(p));
  if (unknown.length) {
    return `Здесь нельзя использовать: ${unknown.map((p) => `{${p}}`).join(', ')}.\nМожно: ${allowed.map((p) => `{${p}}`).join(', ')}.`;
  }
  const oblique = nameAfterPreposition(text);
  if (oblique) {
    return `Имя подставляется как есть, без склонения: «${oblique}» превратится в «для Ирина». Перестрой фразу, чтобы имя было в начале или после тире, например: «{receiver} ждёт подарок».`;
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

// "ёпта!" -> "ёпта": flavor words are joined with the bot's own punctuation.
function trimPunctuation(text) {
  let end = text.length;
  while (end > 0 && '!?.,;:… '.includes(text[end - 1])) end--;
  return text.slice(0, end);
}

// Harsh phrases (mat, rough teasing) are marked `harsh: true`; for participants in soft mode
// they are this many times less likely than usual, not excluded.
const SOFT_HARSH_WEIGHT = 0.15;

// Uniform pick when nothing is harsh or the recipient isn't soft.
function weightedPick(items, soft, random) {
  const weight = (item) => (soft && item.harsh ? SOFT_HARSH_WEIGHT : 1);
  let r = random() * items.reduce((sum, item) => sum + weight(item), 0);
  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

// opts: { random, soft } — a bare function is accepted as `random` for brevity in tests.
const pickOptions = (opts = {}) => (typeof opts === 'function' ? { random: opts, soft: false } : { random: Math.random, soft: false, ...opts });

function pickFlavor(game, key, chance, { random, soft }) {
  const list = customPhrases(game, key);
  if (!list.length || random() >= chance) return '';
  return weightedPick(list, soft, random).text;
}

// Prepends a random interjection and/or address from the game's flavor lists: "Ну чё, братан! <text>".
function decorate(game, text, opts) {
  const head = [
    trimPunctuation(pickFlavor(game, 'interjections', INTERJECTION_CHANCE, opts)),
    trimPunctuation(pickFlavor(game, 'addresses', ADDRESS_CHANCE, opts)),
  ].filter(Boolean).join(', ');
  return head ? `${head[0].toUpperCase()}${head.slice(1)}! ${text}` : text;
}

export function pickPhrase(game, key, vars, options) {
  const opts = pickOptions(options);
  const pool = [...PHRASES[key].defaults.map((text) => ({ text })), ...customPhrases(game, key)];
  return decorate(game, renderPhrase(weightedPick(pool, opts.soft, opts.random).text, vars), opts);
}

// Appends a random catchphrase to a whole notification (sometimes, if the game has any).
export function withCatchphrase(game, text, options) {
  const phrase = pickFlavor(game, 'catchphrases', CATCHPHRASE_CHANCE, pickOptions(options));
  return phrase ? `${text}\n\n💬 ${phrase}` : text;
}

// Name without "(@username)" reads better inside a sentence.
export const shortName = (participant) => participant.name.split(' (@')[0];

// Soft mode: set by the organizer per participant, or by first name from game.softNames (e.g. from a phrase pack).
export function isSoft(game, participant) {
  if (typeof participant.soft === 'boolean') return participant.soft;
  const name = shortName(participant).toLowerCase();
  return (game.softNames ?? []).some((n) => name === n.toLowerCase() || name.startsWith(`${n.toLowerCase()} `));
}

// Options for picking phrases addressed to a participant.
export const toneFor = (game, participant) => ({ soft: isSoft(game, participant) });

// A bot reply with the game's flavor: "<random phrase>\n\n<fixed text>" plus a catchphrase sometimes.
// Without a game (or participant) the fixed text is returned as is.
export function flavored(game, key, participant, text, vars = {}) {
  if (!game || !participant) return text;
  const tone = toneFor(game, participant);
  const phrase = pickPhrase(game, key, { name: shortName(participant), title: game.title, ...vars }, tone);
  return withCatchphrase(game, `${phrase}\n\n${text}`, tone);
}
