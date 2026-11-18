// Business rules, ported from the prototype (design/Cylinder Issue Tracker v2.dc.html).
// Pure functions only: no React, no storage, no styling. The UI maps `tone` values to colors.
import { detectEta } from './eta'
import { HOUR, addBiz, bizMs, dur, sameDay, type DateKey } from './time'
import type {
  AirgasContact, Building, Category, Complexity, EtaSuggestion, PersonId, ReportInput,
  ResolvedBy, RiceStaff, Status, Ticket, ThreadEntry,
} from './types'

// ---- Reference data ----

export const PEOPLE: Record<PersonId, { name: string; role: string; airgas: boolean }> = {
  ruben: { name: 'Ruben', role: 'Airgas · account manager', airgas: true },
  gordan: { name: 'Gordan', role: 'Airgas · plant manager', airgas: true },
  chris: { name: 'Chris', role: 'Airgas · regional manager', airgas: true },
  israel: { name: 'Israel', role: 'Rice · SST stockroom', airgas: false },
  robert: { name: 'Robert', role: "Rice · O'Connor stockroom", airgas: false },
  javier: { name: 'Javier', role: 'Rice · supervisor', airgas: false },
  tracker: { name: 'Rice Stockroom', role: 'sent automatically', airgas: false },
}
export const RICE_STAFF: RiceStaff[] = ['israel', 'robert', 'javier']
export const AIRGAS_CONTACTS: AirgasContact[] = ['ruben', 'gordan', 'chris']

/** Who closed a ticket, as shown in the close-out form. */
export const RESOLVER_LABEL: Record<ResolvedBy, string> = {
  israel: 'Israel (SST stockroom)',
  robert: "Robert (O'Connor stockroom)",
  javier: 'Javier (Supervisor)',
  airgas: 'Airgas',
}

export const BUILDING_LABEL: Record<Exclude<Building, 'other'>, string> = { sst: 'SST', oconnor: "O'Connor" }

export const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'leak', label: 'Leak', hint: 'Hissing, odor, or a failed leak test' },
  { key: 'notdelivered', label: 'Not delivered', hint: "Order placed but the cylinder hasn't arrived" },
  { key: 'empty', label: 'Cylinder empty/half full', hint: 'Gauge reads low on a new cylinder' },
  { key: 'other', label: 'Others', hint: 'Anything else (please describe below)' },
]
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label])) as Record<Category, string>

export const STATUS_LABEL: Record<Status, string> = { open: 'Not started', progress: 'In progress', done: 'Completed' }

// ---- Deadlines ----

/** Business time allowed to move a new ticket to In progress. */
export const RESPONSE_LIMIT = 12 * HOUR
/** Business time allowed to resolve, by complexity. */
export const RESOLVE_LIMIT: Record<Complexity, number> = { low: 12 * HOUR, medium: 16 * HOUR, high: 40 * HOUR }
export const COMPLEXITY_LABEL: Record<Complexity, string> = { low: 'Low', medium: 'Medium', high: 'High' }

export type ClockTone = 'ok' | 'warn' | 'over' | 'done' | 'needs-complexity'
export interface Clock {
  label: string // "Response due", "Resolve · Medium", "Resolved in", "Resolution"
  text: string // "3h 20m left", "1h 5m overdue", "Set complexity"
  tone: ClockTone
  /** Share of the allowed time used, 0–100. */
  pct: number
  over: boolean
}

export function clock(t: Ticket, now: Date): Clock {
  if (t.status === 'done') {
    const took = bizMs(new Date(t.createdAt), new Date(t.resolvedAt ?? now))
    return { label: 'Resolved in', text: `${dur(took)} biz`, tone: 'done', pct: 100, over: false }
  }
  let limit: number, start: string, label: string
  if (t.status === 'open') {
    limit = RESPONSE_LIMIT; start = t.createdAt; label = 'Response due'
  } else if (!t.complexity || !t.startedAt) {
    return { label: 'Resolution', text: 'Set complexity', tone: 'needs-complexity', pct: 0, over: false }
  } else {
    limit = RESOLVE_LIMIT[t.complexity]; start = t.startedAt; label = `Resolve · ${COMPLEXITY_LABEL[t.complexity]}`
  }
  const used = bizMs(new Date(start), now)
  const left = limit - used
  const over = left < 0
  const tone: ClockTone = over ? 'over' : left < limit * 0.25 ? 'warn' : 'ok'
  return { label, text: `${dur(left)} ${over ? 'overdue' : 'left'}`, tone, pct: Math.min(100, Math.round((used / limit) * 100)), over }
}

export const isOverdue = (t: Ticket, now: Date) => clock(t, now).over

/** When the current clock runs out (null when there is no running clock). */
export function deadline(t: Ticket): Date | null {
  if (t.status === 'open') return addBiz(new Date(t.createdAt), RESPONSE_LIMIT)
  if (t.status === 'progress' && t.complexity && t.startedAt) return addBiz(new Date(t.startedAt), RESOLVE_LIMIT[t.complexity])
  return null
}

// ---- Routing and new tickets ----

export function coordinatorFor(building: Building): RiceStaff {
  return building === 'sst' ? 'israel' : building === 'oconnor' ? 'robert' : 'javier'
}

export function buildingLabel(t: Pick<Ticket, 'building' | 'otherBuilding'>): string {
  return t.building === 'other' ? t.otherBuilding.trim() || 'Other building' : BUILDING_LABEL[t.building]
}
export function locationLabel(t: Pick<Ticket, 'building' | 'otherBuilding' | 'room'>): string {
  return `${buildingLabel(t)} ${t.room}`
}

export type ReportErrors = Partial<Record<keyof ReportInput, string>>

export function validateReport(f: ReportInput): ReportErrors {
  const er: ReportErrors = {}
  if (!f.name.trim()) er.name = 'Enter your name'
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = 'Enter a valid email'
  if (!f.order.trim()) er.order = 'Enter the order number'
  if (!f.building) er.building = 'Choose a building'
  if (f.building === 'other' && !f.otherBuilding.trim()) er.otherBuilding = 'Enter the building name'
  if (!f.room.trim()) er.room = 'Enter a room'
  if (!f.category) er.category = 'Choose a category'
  if (f.category === 'other' && !f.description.trim()) er.description = 'Describe the issue'
  return er
}

/** "RG-1049": one more than the highest existing number. */
export function nextTicketId(tickets: Pick<Ticket, 'id'>[], first = 1001): string {
  const max = Math.max(first - 1, ...tickets.map(t => Number(t.id.replace(/\D/g, '')) || 0))
  return `RG-${max + 1}`
}

export function openingEmailText(t: Ticket): string {
  return `Order ${t.order} · ${locationLabel(t)}\n${CATEGORY_LABEL[t.category]}: ${t.description}\n` +
    `Contact: ${t.reporter.name}, ${t.reporter.email}${t.reporter.phone ? ', ' + t.reporter.phone : ''}\n\n` +
    'Please reply all with next steps and an ETA.'
}

export function openingSubject(t: Ticket): string {
  return `[${t.id}] ${CATEGORY_LABEL[t.category]} · ${locationLabel(t)}`
}

/** Builds a ticket from a valid form submission, with the opening email on its thread. */
export function createTicket(f: ReportInput, id: string, now: Date): Ticket {
  if (!f.building || !f.category) throw new Error('createTicket: report is not valid')
  const t: Ticket = {
    id,
    order: f.order.trim(),
    building: f.building,
    otherBuilding: f.building === 'other' ? f.otherBuilding.trim() : '',
    room: f.room.trim(),
    category: f.category,
    description: f.description.trim() || '(No description)',
    reporter: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() },
    createdAt: now.toISOString(),
    status: 'open',
    complexity: null,
    startedAt: null,
    coordinator: coordinatorFor(f.building),
    participants: ['ruben', 'gordan'],
    eta: null,
    etaSuggestion: null,
    confirm: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: '',
    thread: [],
  }
  t.thread.push({ kind: 'auto', at: t.createdAt, text: openingEmailText(t) })
  return t
}

// ---- Thread ----

export function authorName(e: ThreadEntry, t: Ticket): string {
  switch (e.kind) {
    case 'confirm': return t.reporter.name
    case 'auto': return PEOPLE.tracker.name
    case 'note': return ''
    default: return PEOPLE[e.from].name
  }
}

export const isAirgas = (p: PersonId) => PEOPLE[p].airgas

/** The most recent email from Airgas, if any. */
export function lastAirgasEmail(t: Ticket) {
  for (let i = t.thread.length - 1; i >= 0; i--) {
    const e = t.thread[i]
    if (e.kind === 'email' && isAirgas(e.from)) return e
  }
  return null
}

/** The most recent entry that isn't a system note. */
export function lastMessage(t: Ticket): ThreadEntry | null {
  for (let i = t.thread.length - 1; i >= 0; i--) if (t.thread[i].kind !== 'note') return t.thread[i]
  return null
}

/** Who gets the next email: Airgas contacts on To; coordinator, other Rice staff and the reporter on Cc. */
export function recipients(t: Ticket, escalating = false): { to: AirgasContact[]; cc: RiceStaff[] } {
  const to = t.participants.filter((p): p is AirgasContact => AIRGAS_CONTACTS.includes(p as AirgasContact))
  if (escalating && !to.includes('chris')) to.push('chris')
  const cc = [...new Set([t.coordinator, ...t.participants.filter((p): p is RiceStaff => RICE_STAFF.includes(p as RiceStaff))])]
  return { to, cc }
}

export type ThreadState = 'closed' | 'lab-confirmed' | 'eta-suggested' | 'eta' | 'replied' | 'no-reply'

/** The "Airgas thread" column in the queue. */
export function threadState(t: Ticket): ThreadState {
  if (t.status === 'done') return t.confirm === 'yes' ? 'lab-confirmed' : 'closed'
  if (t.etaSuggestion) return 'eta-suggested'
  if (t.eta) return 'eta'
  return lastAirgasEmail(t) ? 'replied' : 'no-reply'
}

/**
 * A new message may contain a date. Returns the ticket's ETA suggestion after that message:
 * a new one if a date was found that isn't already the ETA, otherwise the existing one.
 */
export function suggestEta(t: Ticket, from: PersonId, text: string, now: Date): EtaSuggestion | null {
  const date = detectEta(text, now)
  if (date && !(t.eta && sameDay(t.eta, date))) return { date, quote: text, from }
  return t.etaSuggestion
}

// ---- Deliveries ----

/** Open tickets promised for `day` whose order is missing from that day's schedule. */
export function missingFromSchedule(tickets: Ticket[], scheduleOrders: string[], day: Date | DateKey): Ticket[] {
  const orders = new Set(scheduleOrders)
  return tickets.filter(t => t.status !== 'done' && t.eta && sameDay(t.eta, day) && !orders.has(t.order))
}
