import { daysBetween, formatDate, hourIn, todayIn } from './dates.js';
import { loadActiveGames, markReminder } from './storage.js';
import { pickPhrase, shortName, stageKey, toneFor, withCatchphrase } from './texts.js';
import { button, daysText, inline } from './ui.js';

const WISH_EVERY_DAYS = 1;
const GIFT_EVERY_DAYS = 1;

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

// Number of the reminder this participant is about to get (1 for the first one).
const reminderNumber = (game, kind, userId) => (game.reminderCounts?.[kind]?.[userId] ?? 0) + 1;

export function reminderMessages(game, reminder) {
  const c = game.code;
  const entries = Object.entries(game.participants);

  if (reminder.kind === 'wish') {
    const date = formatDate(game.wishDeadline);
    const lastDay = reminder.daysLeft === 0;
    const info = lastDay
      ? `Сегодня последний день дедлайна пожеланий в игре «${game.title}» (${date}).`
      : `До дедлайна пожеланий в игре «${game.title}» — ${daysText(reminder.daysLeft)} (${date}).`;
    return entries.filter(([, p]) => !p.wishReady).map(([to, p]) => ({
      to,
      text: withCatchphrase(game, [
        pickPhrase(game, lastDay ? 'lastDay' : stageKey('wish', reminderNumber(game, 'wish', to)), {
          name: shortName(p), title: game.title, days: daysText(reminder.daysLeft), date, count: reminderNumber(game, 'wish', to),
        }, toneFor(game, p)),
        '',
        info,
        'Напиши пожелание и отметь его готовым.',
      ].join('\n'), toneFor(game, p)),
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
  const date = formatDate(game.giftDate);
  return entries.filter(([, p]) => !p.giftBought).map(([to, p]) => ({
    to,
    text: withCatchphrase(game, [
      pickPhrase(game, stageKey('gift', reminderNumber(game, 'gift', to)), {
        name: shortName(p), title: game.title, days: daysText(reminder.daysLeft), date,
        receiver: game.participants[game.pairs[to]].name, count: reminderNumber(game, 'gift', to),
      }, toneFor(game, p)),
      '',
      `До вручения подарков в игре «${game.title}» — ${daysText(reminder.daysLeft)} (${date}).`,
      `Ты даришь: ${game.participants[game.pairs[to]].name}`,
      ...(game.budget ? [`💰 Бюджет: ${game.budget}`] : []),
    ].join('\n'), toneFor(game, p)),
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
      await markReminder(db, game.code, reminder.kind, today, messages.map((m) => m.to));
      await app.broadcast(messages);
    }
  }
}
