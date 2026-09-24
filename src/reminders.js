import { daysBetween, formatDate, hourIn, todayIn } from './dates.js';
import { loadActiveGames, markReminder } from './storage.js';
import { button, daysText, inline } from './ui.js';

const WISH_EVERY_DAYS = 2;
const GIFT_EVERY_DAYS = 5;

// Which reminders are due for the game today. Schedule is counted back from the date itself,
// so reminders don't depend on when the date was set or when the bot was restarted.
export function dueReminders(game, today) {
  const sent = game.reminders ?? {};
  const due = [];

  if (game.status === 'open' && game.wishDeadline) {
    const left = daysBetween(today, game.wishDeadline);
    if (left >= 0 && left % WISH_EVERY_DAYS === 0 && sent.wish !== today) due.push({ kind: 'wish', daysLeft: left });
    if (left < 0 && !sent.deadlinePassed) due.push({ kind: 'deadlinePassed' });
  }

  if (game.status === 'drawn' && game.giftDate) {
    const left = daysBetween(today, game.giftDate);
    if (left > 0 && left % GIFT_EVERY_DAYS === 0 && sent.gift !== today) due.push({ kind: 'gift', daysLeft: left });
  }

  return due;
}

export function reminderMessages(game, reminder) {
  const c = game.code;
  const entries = Object.entries(game.participants);

  if (reminder.kind === 'wish') {
    const text = reminder.daysLeft === 0
      ? `⏰ Сегодня последний день, чтобы заполнить пожелание в игре «${game.title}».`
      : `⏰ До дедлайна пожеланий в игре «${game.title}» — ${daysText(reminder.daysLeft)} (${formatDate(game.wishDeadline)}).`;
    return entries.filter(([, p]) => !p.wishReady).map(([to]) => ({
      to,
      text: `${text}\nНапиши, что хочешь получить, и отметь пожелание готовым — так Санта будет знать, что тебе подарить.`,
      extra: inline([[button('✏️ Моё пожелание', 'wish.view', c)]]),
    }));
  }

  if (reminder.kind === 'deadlinePassed') {
    const ready = entries.filter(([, p]) => p.wishReady).length;
    return [{
      to: game.ownerId,
      text: `⏰ Дедлайн пожеланий в игре «${game.title}» прошёл.\nПожелание готово: ${ready} из ${entries.length}.\n\nМожно проводить жеребьёвку.`,
      extra: inline([[button('🎲 Провести жеребьёвку', 'draw', c)]]),
    }];
  }

  // kind === 'gift'
  return entries.filter(([, p]) => !p.giftBought).map(([to]) => ({
    to,
    text: [
      `🎁 До вручения подарков в игре «${game.title}» — ${daysText(reminder.daysLeft)} (${formatDate(game.giftDate)}).`,
      `Ты даришь: ${game.participants[game.pairs[to]].name}`,
      ...(game.budget ? [`💰 Бюджет: ${game.budget}`] : []),
    ].join('\n'),
    extra: inline([[button('🛍 Подарок куплен', 'gift.bought', c), button('🎁 Кому я дарю', 'whom.view', c)]]),
  }));
}

// Subrequest budget per cron run (free plan: 50): 2 for loading, the rest for marks and messages.
// Whatever doesn't fit is sent on the next hourly run of the same day.
const CRON_BUDGET = 46;

// Runs from the hourly cron. Each reminder is marked before sending:
// after a failure it is skipped rather than sent twice.
export async function runReminders(app, db, { hour, now = new Date() }) {
  if (hourIn(app.timeZone, now) < hour) return;
  const today = todayIn(app.timeZone, now);
  let budget = CRON_BUDGET;

  for (const game of await loadActiveGames(db)) {
    for (const reminder of dueReminders(game, today)) {
      const messages = reminderMessages(game, reminder);
      if (1 + messages.length > budget) continue;
      budget -= 1 + messages.length;
      await markReminder(db, game.code, reminder.kind, today);
      await app.broadcast(messages);
    }
  }
}
