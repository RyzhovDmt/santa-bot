import { formatDate } from './dates.js';

export const BTN = {
  create: '🎄 Создать игру',
  wish: '✏️ Моё пожелание',
  players: '👥 Участники',
  info: 'ℹ️ Об игре',
  whom: '🎁 Кому я дарю',
  toSanta: '✉️ Написать Санте',
};

export const BUTTON_LABELS = new Set(Object.values(BTN));

export const STATUS_TITLE = {
  open: 'идёт набор',
  drawn: 'жеребьёвка проведена',
  revealed: 'Санты раскрыты',
};

export const HELP = [
  'Я бот для игры «Тайный Санта» 🎅',
  '',
  '1. Организатор создаёт игру и отправляет участникам ссылку-приглашение.',
  '2. Каждый пишет пожелание к подарку.',
  '3. Организатор проводит жеребьёвку — каждый узнаёт, кому дарит.',
  '4. С получателем и своим Сантой можно переписываться анонимно.',
  '',
  'Всё управление — кнопками внизу.',
  'Команды: /menu /new /status /info /wish /whom /draw /reveal /leave /cancel',
].join('\n');

// Keyboards are plain Bot API objects, passed as the "other" argument of reply/sendMessage.
const replyKeyboard = (rows) => ({
  reply_markup: { keyboard: rows.map((row) => row.map((text) => ({ text }))), resize_keyboard: true },
});

export function mainMenu(game) {
  if (!game) return replyKeyboard([[BTN.create]]);
  if (game.status === 'open') return replyKeyboard([[BTN.wish, BTN.players], [BTN.info]]);
  return replyKeyboard([[BTN.whom, BTN.wish], [BTN.toSanta, BTN.players], [BTN.info]]);
}

// Callback data is "<action>:<gameCode>" (Telegram allows up to 64 bytes).
export const button = (text, action, code) => ({ text, callback_data: code ? `${action}:${code}` : action });

export const inline = (rows) => ({ reply_markup: { inline_keyboard: rows } });

export const cancelKeyboard = (code) => inline([[button('Отмена', 'mode.cancel', code)]]);

export function displayName(from) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
  return from.username ? `${name} (@${from.username})` : name;
}

export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const daysText = (n) => `${n} ${plural(n, ['день', 'дня', 'дней'])}`;

export function gameDetails(game) {
  return [
    `💰 Бюджет: ${game.budget || 'не задан'}`,
    `⏰ Дедлайн пожеланий: ${game.wishDeadline ? formatDate(game.wishDeadline) : 'не задан'}`,
    `📅 Вручение подарков: ${game.giftDate ? formatDate(game.giftDate) : 'не задано'}`,
  ].join('\n');
}

// Short version for gift-related messages: only what is set.
export function giftDetails(game) {
  const lines = [];
  if (game.budget) lines.push(`💰 Бюджет: ${game.budget}`);
  if (game.giftDate) lines.push(`📅 Вручение: ${formatDate(game.giftDate)}`);
  return lines.join('\n');
}
