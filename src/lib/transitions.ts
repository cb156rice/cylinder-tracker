// Ticket state changes. Each takes a ticket and returns a new one (never mutates),
// appending the thread entries the prototype shows for that change.
import { PEOPLE, checkInText, isAirgas, suggestEta } from './rules'
import { fmtDay } from './time'
import type {
  AirgasContact, ResolvedBy, RiceStaff, Ticket, ThreadEntry,
} from './types'

const iso = (d: Date) => d.toISOString()
const note = (now: Date, text: string): ThreadEntry => ({ kind: 'note', at: iso(now), text })
const push = (t: Ticket, ...entries: ThreadEntry[]): Ticket => ({ ...t, thread: [...t.thread, ...entries] })
const SHORT_RESOLVER: Record<ResolvedBy, string> = { israel: 'Israel', robert: 'Robert', javier: 'Javier', airgas: 'Airgas' }

export function startProgress(t: Ticket, by: RiceStaff, now: Date): Ticket {
  if (t.status === 'progress') return t
  return push({ ...t, status: 'progress', startedAt: iso(now) }, note(now, `${PEOPLE[by].name} moved to In progress`))
}

export function reopen(t: Ticket, now: Date): Ticket {
  if (t.status === 'open') return t
  return push(
    { ...t, status: 'open', startedAt: null, complexity: null, resolvedBy: null, resolvedAt: null, resolutionNotes: '' },
    note(now, 'Reopened'),
  )
}

export function complete(t: Ticket, by: ResolvedBy, notes: string, now: Date): Ticket {
  return push(
    { ...t, status: 'done', resolvedBy: by, resolvedAt: iso(now), resolutionNotes: notes.trim() || '(No notes)', etaSuggestion: null, startedAt: t.startedAt ?? iso(now) },
    note(now, `Completed by ${SHORT_RESOLVER[by]}`),
  )
}

export function setCoordinator(t: Ticket, c: RiceStaff, now: Date): Ticket {
  if (t.coordinator === c) return t
  return push({ ...t, coordinator: c }, note(now, `Coordinator changed to ${PEOPLE[c].name}`))
}

export function acceptEta(t: Ticket, now: Date): Ticket {
  const s = t.etaSuggestion
  if (!s) return t
  return push({ ...t, eta: s.date, etaSuggestion: null }, note(now, `ETA set to ${fmtDay(s.date)} from ${PEOPLE[s.from].name}'s reply`))
}

export const ignoreEta = (t: Ticket): Ticket => ({ ...t, etaSuggestion: null })

/** A Rice staff member sends an email on the thread. Escalating adds Chris. */
export function sendEmail(t: Ticket, from: RiceStaff, text: string, now: Date, escalating = false): Ticket {
  const added: AirgasContact[] = escalating && !t.participants.includes('chris') ? ['chris'] : []
  const next = push(
    { ...t, participants: [...t.participants, ...added] },
    { kind: 'email', at: iso(now), from, text: text.trim(), ...(added.length ? { added } : {}) },
  )
  return added.length ? push(next, note(now, 'Escalated to Chris')) : next
}

/** An email from Airgas arrives. New recipients join the thread; a date in it becomes an ETA suggestion. */
export function receiveEmail(t: Ticket, from: AirgasContact | RiceStaff, text: string, now: Date, added: (AirgasContact | RiceStaff)[] = []): Ticket {
  const fresh = added.filter(p => !t.participants.includes(p))
  const next = push(
    { ...t, participants: [...t.participants, ...fresh], etaSuggestion: suggestEta(t, from, text, now) },
    { kind: 'email', at: iso(now), from, text, ...(fresh.length ? { added: fresh } : {}) },
  )
  // Airgas answering is what moves a ticket along; nobody at Rice has to click anything.
  if (t.status === 'open' && isAirgas(from)) {
    return push({ ...next, status: 'progress', startedAt: iso(now) }, note(now, `${PEOPLE[from].name} replied · moved to In progress`))
  }
  return next
}

/** A logged call or visit. Never emailed; can still produce an ETA suggestion. */
export function logContact(t: Ticket, by: RiceStaff, kind: 'call' | 'visit', withWho: AirgasContact, text: string, now: Date): Ticket {
  const body = text.trim()
  return push(
    { ...t, etaSuggestion: suggestEta(t, withWho, body, now) },
    { kind, at: iso(now), from: by, with: withWho, text: body },
  )
}

/** The "Is it fixed? Reply YES or NO" email to the reporter (sent by the mailer). */
export function askFixed(t: Ticket, now: Date): Ticket {
  return push({ ...t, confirm: 'asked' }, { kind: 'auto', at: iso(now), audience: 'reporter', text: checkInText(t) })
}

/**
 * The reporter answers "Is it fixed?"
 * Yes → close (or mark ready to close when autoClose is off). No → In progress, clear Airgas's date
 * (it passed without a fix), and tell Airgas on the thread.
 */
export function confirmDelivery(t: Ticket, fixed: boolean, now: Date, autoClose = true): Ticket {
  if (fixed) {
    const answered = push({ ...t, confirm: 'yes' }, { kind: 'confirm', at: iso(now), text: "Yes, it's fixed.", fixed: true })
    if (!autoClose) return push(answered, note(now, 'Lab confirmed · ready to close'))
    return push(
      { ...answered, status: 'done', resolvedBy: 'airgas', resolvedAt: iso(now), resolutionNotes: 'The reporter confirmed it is fixed.', etaSuggestion: null, startedAt: t.startedAt ?? iso(now) },
      note(now, `Closed: ${t.reporter.name.split(' ')[0]} confirmed it's fixed`),
    )
  }
  return push(
    { ...t, confirm: 'no', status: 'progress', startedAt: t.startedAt ?? iso(now), eta: null, etaSuggestion: null },
    { kind: 'confirm', at: iso(now), text: 'No, still a problem.', fixed: false },
    { kind: 'auto', at: iso(now), text: `${t.reporter.name} says this is still not fixed (${t.id}, order ${t.order}). Please reply all with next steps and a new date.` },
    note(now, `${t.reporter.name.split(' ')[0]} says it's not fixed`),
  )
}
