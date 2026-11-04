// Display helpers for the admin screens: colors for rule outputs and the "Airgas thread" summary.
import { PEOPLE, lastAirgasEmail, threadState, type ClockTone } from '../lib/rules'
import { fmtDay, fmtShort } from '../lib/time'
import type { Status, Ticket } from '../lib/types'

export const TONE_TEXT: Record<ClockTone, string> = {
  ok: 'var(--body)',
  warn: 'oklch(0.5 0.11 65)',
  over: 'oklch(0.5 0.17 25)',
  done: 'var(--muted)',
  'needs-complexity': 'var(--yellow-fg)',
}
export const TONE_BAR: Record<ClockTone, string> = {
  ok: 'var(--navy)',
  warn: 'var(--yellow-dot)',
  over: 'var(--red-dot)',
  done: 'var(--green-dot)',
  'needs-complexity': 'var(--yellow-dot)',
}
export const STATUS_COLORS: Record<Status, { bg: string; fg: string; dot: string }> = {
  open: { bg: 'var(--red-bg)', fg: 'var(--red-fg)', dot: 'var(--red-dot)' },
  progress: { bg: 'var(--yellow-bg)', fg: 'var(--yellow-fg)', dot: 'var(--yellow-dot)' },
  done: { bg: 'var(--green-bg)', fg: 'var(--green-fg)', dot: 'var(--green-dot)' },
}

/** Headline + detail for the queue's "Airgas thread" column. */
export function threadSummary(t: Ticket): { top: string; sub: string; color: string } {
  const last = lastAirgasEmail(t)
  const quote = last ? `${PEOPLE[last.from].name}: "${last.text}"` : ''
  switch (threadState(t)) {
    case 'lab-confirmed': return { top: 'Lab confirmed', sub: t.resolvedAt ? fmtShort(new Date(t.resolvedAt)) : '', color: 'var(--muted)' }
    case 'closed': return { top: 'Closed', sub: t.resolvedAt ? fmtShort(new Date(t.resolvedAt)) : '', color: 'var(--muted)' }
    case 'eta-suggested': {
      const s = t.etaSuggestion!
      return { top: `ETA suggested · ${fmtDay(s.date)}`, sub: `${PEOPLE[s.from].name}: "${s.quote}"`, color: 'var(--navy)' }
    }
    case 'eta': return { top: `ETA ${fmtDay(t.eta!)}`, sub: quote, color: 'oklch(0.42 0.1 150)' }
    case 'replied': return { top: `${PEOPLE[last!.from].name} replied`, sub: `"${last!.text}"`, color: 'var(--body)' }
    case 'no-reply': return { top: 'No reply yet', sub: `Emailed ${fmtShort(new Date(t.createdAt))}`, color: 'oklch(0.5 0.17 25)' }
  }
}
