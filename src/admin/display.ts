// Display helpers for the admin screens: colors for rule outputs and the "Airgas thread" summary.
import { PEOPLE, deadline, isOverdue, lastAirgasEmail, threadState } from '../lib/rules'
import { fmtDay, fmtShort } from '../lib/time'
import type { Ticket } from '../lib/types'

/** Headline + detail for the queue's "Airgas thread" column. */
export function threadSummary(t: Ticket): { top: string; sub: string; color: string } {
  const last = lastAirgasEmail(t)
  const quote = last ? `${PEOPLE[last.from].name}: "${last.text}"` : ''
  switch (threadState(t)) {
    case 'lab-confirmed': return { top: 'Reporter confirmed fixed', sub: '', color: 'var(--muted)' }
    case 'closed': return { top: 'Closed', sub: '', color: 'var(--muted)' }
    case 'eta-suggested': {
      const s = t.etaSuggestion!
      return { top: `Expected ${fmtDay(s.date)}`, sub: `${PEOPLE[s.from].name}: "${s.quote}"`, color: 'var(--ink)' }
    }
    case 'eta': return { top: `Expected ${fmtDay(t.eta!)}`, sub: quote, color: 'var(--ink)' }
    case 'replied': return { top: `${PEOPLE[last!.from].name} replied`, sub: `"${last!.text}"`, color: 'var(--ink)' }
    case 'no-reply': return { top: 'Waiting for Airgas', sub: '', color: 'var(--muted)' }
  }
}

/** The due date in plain words, instead of a countdown. */
export function dueInfo(t: Ticket, now: Date): { text: string; late: boolean } {
  if (t.status === 'done') return { text: t.resolvedAt ? `Closed ${fmtShort(new Date(t.resolvedAt))}` : 'Closed', late: false }
  const d = deadline(t)
  if (!d) return { text: 'Size not set', late: false }
  return { text: fmtShort(d), late: isOverdue(t, now) }
}
