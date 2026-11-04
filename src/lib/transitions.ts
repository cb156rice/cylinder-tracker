// Ticket state changes. Each takes a ticket and returns a new one (never mutates),
// appending the thread entries the prototype shows for that change.
import { COMPLEXITY_LABEL, PEOPLE, suggestEta } from './rules'
import { fmtDay } from './time'
import type {
  AirgasContact, Complexity, ResolvedBy, RiceStaff, Ticket, ThreadEntry,
} from './types'

const iso = (d: Date) => d.toISOString()
const note = (now: Date, text: string): ThreadEntry => ({ kind: 'note', at: iso(now), text })
const push = (t: Ticket, ...entries: ThreadEntry[]): Ticket => ({ ...t, thread: [...t.thread, ...entries] })
const SHORT_RESOLVER: Record<ResolvedBy, string> = { israel: 'Israel', robert: 'Robert', javier: 'Javier', airgas: 'Airgas' }

export function startProgress(t: Ticket, by: RiceStaff, now: Date): Ticket {
  if (t.status === 'progress') return t
  return push({ ...t, status: 'progress', startedAt: iso(now), complexity: null }, note(now, `${PEOPLE[by].name} moved to In progress`))
}

export function reopen(t: Ticket, now: Date): Ticket {
  if (t.status === 'open') return t
  return push(
    { ...t, status: 'open', startedAt: null, complexity: null, resolvedBy: null, resolvedAt: null, resolutionNotes: '' },
    note(now, 'Reopened'),
  )
}

/** Picking a complexity (re)starts the resolution clock. */
export function setComplexity(t: Ticket, c: Complexity, now: Date): Ticket {
  return push({ ...t, complexity: c, startedAt: iso(now) }, note(now, `Complexity set to ${COMPLEXITY_LABEL[c]}`))
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
  return push(
    { ...t, participants: [...t.participants, ...fresh], etaSuggestion: suggestEta(t, from, text, now) },
    { kind: 'email', at: iso(now), from, text, ...(fresh.length ? { added: fresh } : {}) },
  )
}

/** A logged call or visit. Never emailed; can still produce an ETA suggestion. */
export function logContact(t: Ticket, by: RiceStaff, kind: 'call' | 'visit', withWho: AirgasContact, text: string, now: Date): Ticket {
  const body = text.trim()
  return push(
    { ...t, etaSuggestion: suggestEta(t, withWho, body, now) },
    { kind, at: iso(now), from: by, with: withWho, text: body },
  )
}

export function askConfirmation(t: Ticket, now: Date): Ticket {
  return push({ ...t, confirm: 'asked' }, note(now, `Delivery confirmation sent to ${t.reporter.name.split(' ')[0]}`))
}

/**
 * The reporter answers "Did your delivery fix the problem?"
 * Yes → close (or mark ready to close when autoClose is off). No → back to In progress,
 * clear the ETA, and post on the Airgas thread.
 */
export function confirmDelivery(t: Ticket, fixed: boolean, now: Date, autoClose = true): Ticket {
  if (fixed) {
    const answered = push({ ...t, confirm: 'yes' }, { kind: 'confirm', at: iso(now), text: "Yes, it's fixed.", fixed: true })
    if (!autoClose) return push(answered, note(now, 'Lab confirmed · ready to close'))
    return push(
      { ...answered, status: 'done', resolvedBy: 'airgas', resolvedAt: iso(now), resolutionNotes: 'Lab confirmed fixed after delivery.', etaSuggestion: null, startedAt: t.startedAt ?? iso(now) },
      note(now, 'Closed after lab confirmation'),
    )
  }
  return push(
    { ...t, confirm: 'no', status: 'progress', startedAt: t.startedAt ?? iso(now), eta: null },
    { kind: 'confirm', at: iso(now), text: 'No, still a problem.', fixed: false },
    { kind: 'auto', at: iso(now), text: `${t.reporter.name} reports the issue is not fixed after today's delivery (${t.id}, order ${t.order}). Please reply all with next steps.` },
    note(now, 'Reopened after lab said not fixed'),
  )
}
