// Dates are stored as ISO strings "YYYY-MM-DD" in the bot's time zone.

const DAY_MS = 86_400_000;
const DATE_PART = /^\d{1,4}$/;

export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function hourIn(timeZone, now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now));
}

function toUtc(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(from, to) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function isRealDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const toIso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Accepts "27.12", "27.12.26" or "27.12.2026". Without a year picks the nearest date not in the past.
export function parseDate(input, today) {
  const parts = input.trim().split('.');
  if (parts.length < 2 || parts.length > 3 || !parts.every((p) => DATE_PART.test(p))) return null;

  const [d, m] = parts.map(Number);
  if (parts.length === 3) {
    const y = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2]);
    return isRealDate(y, m, d) ? toIso(y, m, d) : null;
  }

  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    if (isRealDate(y, m, d) && daysBetween(today, toIso(y, m, d)) >= 0) return toIso(y, m, d);
  }
  return null;
}
