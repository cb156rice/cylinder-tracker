// Finds a delivery date in a message ("tomorrow's truck", "Thursday", "next week").
// Only ever produces a *suggestion*; a coordinator has to click Set ETA.
// Phase 4 may replace this with Claude structured output.
import { addDays, dayKey, isWeekend, weekdayOf, type DateKey } from './time'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function detectEta(text: string, now: Date): DateKey | null {
  const l = text.toLowerCase()
  const today = dayKey(now)

  if (/\btoday\b|this afternoon|this morning/.test(l)) return today
  if (/\btomorrow\b/.test(l)) {
    // Airgas doesn't deliver on weekends, so Friday's "tomorrow" means Monday.
    let d = addDays(today, 1)
    while (isWeekend(d)) d = addDays(d, 1)
    return d
  }
  if (/\bnext week\b/.test(l)) {
    let d = addDays(today, 1)
    while (weekdayOf(d) !== 1) d = addDays(d, 1)
    return d
  }

  // The first weekday name in the text, resolved to its next occurrence (today counts).
  let bestAt = Infinity, bestDay = -1
  for (let day = 0; day < 7; day++) {
    const m = new RegExp(`\\b${DAY_NAMES[day]}\\b`).exec(l)
    if (m && m.index < bestAt) { bestAt = m.index; bestDay = day }
  }
  if (bestDay < 0) return null
  let d = today
  while (weekdayOf(d) !== bestDay) d = addDays(d, 1)
  return d
}
