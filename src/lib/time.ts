// Time helpers. Everything is computed in America/Chicago wall time, regardless of the
// machine's own time zone (GitHub Actions runners use UTC; a visitor's laptop could be anywhere).
//
// Approach: read an instant's Chicago calendar fields with Intl.DateTimeFormat, do calendar math
// on plain UTC-midnight "day" numbers, and convert Chicago wall times back to instants.
// The 9 AM–5 PM business window never contains a DST switch (those happen at 2 AM),
// so durations inside it are always exact.

export const TIME_ZONE = 'America/Chicago'
export const HOUR = 3600e3
const DAY = 24 * HOUR
const OPEN_HOUR = 9
const CLOSE_HOUR = 17

/** A calendar date in Chicago, formatted 'YYYY-MM-DD'. Used for ETAs (a day, not a moment). */
export type DateKey = string

/**
 * Days that don't count as business days ('YYYY-MM-DD'). Empty until the stockroom decides
 * whether Rice holidays pause the clock (open question in design/README.md).
 */
export const HOLIDAYS: ReadonlySet<DateKey> = new Set()

export interface Wall {
  year: number
  month: number // 1–12
  day: number
  hour: number // 0–23
  minute: number
  weekday: number // 0 = Sunday
}

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  weekday: 'short',
})
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Chicago wall-clock fields for an instant. */
export function toWall(d: Date): Wall & { second: number } {
  const p: Record<string, string> = {}
  for (const { type, value } of parts.formatToParts(d)) p[type] = value
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour % 24,
    minute: +p.minute,
    second: +p.second,
    weekday: WEEKDAYS.indexOf(p.weekday),
  }
}

/** The instant when Chicago clocks read the given wall time. */
export function fromWall(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let t = target
  // Two passes settle the UTC offset, including near DST switches.
  for (let i = 0; i < 2; i++) {
    const w = toWall(new Date(t))
    const offset = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - t
    t = target - offset
  }
  return new Date(t)
}

/** UTC midnight of the instant's Chicago calendar date: a number that steps cleanly by days. */
function dayNumber(d: Date): number {
  const w = toWall(d)
  return Date.UTC(w.year, w.month - 1, w.day)
}
const keyOfDayNumber = (n: number): DateKey => new Date(n).toISOString().slice(0, 10)
const dayNumberOfKey = (k: DateKey): number => Date.parse(k + 'T00:00:00Z')

function isBusinessDay(n: number): boolean {
  const w = new Date(n).getUTCDay()
  return w !== 0 && w !== 6 && !HOLIDAYS.has(keyOfDayNumber(n))
}
function windowOf(n: number): [number, number] {
  const c = new Date(n)
  const y = c.getUTCFullYear(), m = c.getUTCMonth() + 1, d = c.getUTCDate()
  return [+fromWall(y, m, d, OPEN_HOUR), +fromWall(y, m, d, CLOSE_HOUR)]
}

/** Business milliseconds (9–5, Mon–Fri, Chicago) between two instants. */
export function bizMs(a: Date, b: Date): number {
  if (+b <= +a) return 0
  let ms = 0
  for (let n = dayNumber(a), end = dayNumber(b); n <= end; n += DAY) {
    if (!isBusinessDay(n)) continue
    const [open, close] = windowOf(n)
    const lo = Math.max(open, +a), hi = Math.min(close, +b)
    if (hi > lo) ms += hi - lo
  }
  return ms
}

/** The instant `ms` business milliseconds after `start`. */
export function addBiz(start: Date, ms: number): Date {
  if (ms <= 0) return new Date(start)
  let left = ms
  // 4000 days is far more than any real deadline; it only guards against a runaway loop.
  for (let n = dayNumber(start), i = 0; i < 4000; n += DAY, i++) {
    if (!isBusinessDay(n)) continue
    const [open, close] = windowOf(n)
    const from = Math.max(open, +start)
    if (from >= close) continue
    if (left <= close - from) return new Date(from + left)
    left -= close - from
  }
  throw new Error('addBiz: no business days found')
}

// ---- Calendar days (ETAs) ----

export const dayKey = (d: Date): DateKey => keyOfDayNumber(dayNumber(d))
export const addDays = (k: DateKey, n: number): DateKey => keyOfDayNumber(dayNumberOfKey(k) + n * DAY)
export const weekdayOf = (k: DateKey): number => new Date(dayNumberOfKey(k)).getUTCDay()
export const isWeekend = (k: DateKey): boolean => weekdayOf(k) === 0 || weekdayOf(k) === 6
export const sameDay = (a: Date | DateKey, b: Date | DateKey): boolean => asKey(a) === asKey(b)
const asKey = (x: Date | DateKey): DateKey => (typeof x === 'string' ? x : dayKey(x))

// ---- Formatting ----

const clock12 = (w: Wall) => `${w.hour % 12 || 12}:${String(w.minute).padStart(2, '0')}`

/** "Mon Oct 5, 2:30 PM" */
export function fmt(d: Date): string {
  const w = toWall(d)
  return `${WEEKDAYS[w.weekday]} ${MONTHS[w.month - 1]} ${w.day}, ${clock12(w)} ${w.hour >= 12 ? 'PM' : 'AM'}`
}

/** "Oct 5 · 2:30p" */
export function fmtShort(d: Date): string {
  const w = toWall(d)
  return `${MONTHS[w.month - 1]} ${w.day} · ${clock12(w)}${w.hour >= 12 ? 'p' : 'a'}`
}

/** "Mon Oct 5". Accepts an instant or a DateKey. */
export function fmtDay(x: Date | DateKey): string {
  const n = dayNumberOfKey(asKey(x))
  const c = new Date(n)
  return `${WEEKDAYS[c.getUTCDay()]} ${MONTHS[c.getUTCMonth()]} ${c.getUTCDate()}`
}

/** "3h 20m" or "45m". Sign is dropped; callers say "left" or "overdue". */
export function dur(ms: number): string {
  const m = Math.round(Math.abs(ms) / 60000), h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}
