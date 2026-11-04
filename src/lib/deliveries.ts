// Matching Airgas's daily delivery schedule against tickets ("Today's deliveries" tab).
import { missingFromSchedule } from './rules'
import { fmtDay, sameDay } from './time'
import type { ScheduleEntry, Ticket } from './types'

export interface DeliveryView {
  /** The schedule for today (empty if the latest schedule is from another day). */
  today: ScheduleEntry[]
  /** Day of the most recent schedule received, if any. */
  latestDay: string | null
  /** Each scheduled order with its ticket, if one matches. */
  rows: { entry: ScheduleEntry; ticket: Ticket | null }[]
  /** Tickets on today's schedule: candidates for "Did it get fixed?" */
  matched: Ticket[]
  /** Open tickets with ETA today whose order isn't on today's schedule. */
  missing: Ticket[]
  /** Items still needing attention, for the tab badge. */
  pending: number
}

export function deliveryView(tickets: Ticket[], schedule: ScheduleEntry[], now: Date): DeliveryView {
  const latestDay = schedule.reduce<string | null>((d, e) => (!d || e.date > d ? e.date : d), null)
  const today = schedule.filter(e => sameDay(e.date, now))
  const rows = today.map(entry => ({ entry, ticket: tickets.find(t => t.order === entry.order) ?? null }))
  const matched = rows.flatMap(r => (r.ticket ? [r.ticket] : []))
  const missing = missingFromSchedule(tickets, today.map(e => e.order), now)
  const pending = matched.filter(t => t.status !== 'done' && (!t.confirm || t.confirm === 'asked')).length + missing.length
  return { today, latestDay, rows, matched, missing, pending }
}

/** The status line on a "Did it get fixed?" card. */
export function confirmationNote(t: Ticket): string {
  const first = t.reporter.name.split(' ')[0]
  switch (t.confirm) {
    case 'yes': return `${first} confirmed it's fixed. ${t.status === 'done' ? 'Ticket closed.' : 'Ready to close.'}`
    case 'no': return `${first} says it's still a problem. Ticket reopened and Airgas notified on the thread.`
    case 'asked': return `Waiting for ${first} to reply. This is the email they received:`
    default:
      if (t.status === 'done') return 'Ticket already closed.'
      return t.eta
        ? `ETA was ${fmtDay(t.eta)}. Airgas's schedule shows it delivered today. ${first} will be asked at 4 PM.`
        : `On today's schedule, though nobody confirmed it on the thread. ${first} will be asked at 4 PM.`
  }
}

export function confirmationSubject(t: Ticket): string {
  return `[${t.id}] Did your Airgas delivery fix the problem?`
}
