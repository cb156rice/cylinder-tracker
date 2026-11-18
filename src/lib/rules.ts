// Business rules, ported from the prototype (design/Cylinder Issue Tracker v2.dc.html).
// Pure functions only: no React, no storage, no styling. The UI maps `tone` values to colors.
import { detectEta } from './eta'
import { HOUR, addBiz, bizMs, fmtDay, fromWall, sameDay, type DateKey } from './time'
import type {
  AirgasContact, Building, Category, EtaSuggestion, PersonId, ReportInput,
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

/** Business time Airgas has to reply to a new ticket. */
export const RESPONSE_LIMIT = 12 * HOUR
/** Business time for the fix when Airgas hasn't given a date: 2 business days after the report. */
export const FIX_LIMIT = 16 * HOUR

export type ClockTone = 'ok' | 'over' | 'done'
export interface Clock {
  label: string // "Airgas reply due", "Fix due", "Closed"
  tone: ClockTone
  over: boolean
}

/** The date Airgas gave: the accepted ETA, else a date found in an Airgas message that nobody has ignored. */
export function airgasDate(t: Ticket): DateKey | null {
  if (t.eta) return t.eta
  return t.etaSuggestion && isAirgas(t.etaSuggestion.from) ? t.etaSuggestion.date : null
}

/** When the fix is due: the end of Airgas's date (5 PM), or 2 business days after the report. */
export function fixDue(t: Ticket): Date {
  const d = airgasDate(t)
  if (d) {
    const [y, m, day] = d.split('-').map(Number)
    return fromWall(y, m, day, 17)
  }
  return addBiz(new Date(t.createdAt), FIX_LIMIT)
}

/** The one date that matters now: Airgas's reply while Not started, the fix once In progress. */
export function deadline(t: Ticket): Date | null {
  if (t.status === 'open') return addBiz(new Date(t.createdAt), RESPONSE_LIMIT)
  if (t.status === 'progress') return fixDue(t)
  return null
}

export function clock(t: Ticket, now: Date): Clock {
  if (t.status === 'done') return { label: 'Closed', tone: 'done', over: false }
  const d = deadline(t)!
  const over = +now > +d
  return { label: t.status === 'open' ? 'Airgas reply due' : 'Fix due', tone: over ? 'over' : 'ok', over }
}

export const isOverdue = (t: Ticket, now: Date) => clock(t, now).over

// ---- No reply from Airgas: follow up, then warn ----

/** The automatic follow-up to Airgas when they haven't replied in time. */
export const isFollowUp = (e: ThreadEntry) => e.kind === 'auto' && !!e.followUp

/** Airgas hasn't replied within 12 business hours of the report and we haven't followed up yet. */
export function followUpDue(t: Ticket, now: Date): boolean {
  return t.status === 'open' && !lastAirgasEmail(t) && !t.thread.some(isFollowUp) && bizMs(new Date(t.createdAt), now) > RESPONSE_LIMIT
}

export function followUpText(t: Ticket): string {
  return [
    'Hi Ruben and Gordan,',
    '',
    `Following up on ${problemPhrase(t)} (order ${t.order}), reported ${niceDay(new Date(t.createdAt))}. We haven't seen a reply yet.`,
    '',
    'Could you reply all with next steps and the date you expect it to be taken care of?',
    '',
    'Thanks,',
    'Rice Stockroom',
  ].join('\n')
}

/** We followed up and Airgas still hasn't replied after another 12 business hours: the follow-up's time, else null. */
export function noReplyWarning(t: Ticket, now: Date): Date | null {
  if (t.status === 'done') return null
  const f = t.thread.filter(isFollowUp).at(-1)
  if (!f) return null
  const last = lastAirgasEmail(t)
  if (last && new Date(last.at) >= new Date(f.at)) return null
  return bizMs(new Date(f.at), now) >= RESPONSE_LIMIT ? new Date(f.at) : null
}

/** The automatic "Is it fixed?" email to the reporter (an auto entry addressed to the reporter only). */
export const isCheckIn = (e: ThreadEntry) => e.kind === 'auto' && e.audience === 'reporter'

/**
 * Time to ask the reporter "Is it fixed?": the fix due date has passed (we wait until business hours after
 * it, so the email arrives in the morning), and we haven't asked since that date was set.
 * A NO clears the date, so the next ask waits for Airgas to give a new one.
 */
export function checkInDue(t: Ticket, now: Date): boolean {
  if (t.status === 'done' || t.confirm === 'yes') return false
  const due = fixDue(t)
  if (bizMs(due, now) <= 0) return false
  const asked = t.thread.filter(isCheckIn).at(-1)
  return !asked || new Date(asked.at) < due
}

/** How the check-in email names the problem: "the leak in SST 315". */
const PROBLEM_PHRASE: Record<Category, string> = {
  leak: 'the leaking cylinder',
  notdelivered: 'the missed delivery',
  empty: 'the empty cylinder',
  other: 'the cylinder problem',
}
export const problemPhrase = (t: Ticket) => `${PROBLEM_PHRASE[t.category]} in ${locationLabel(t)}`

const niceDay = (x: Date | DateKey) => fmtDay(x).replace(' ', ', ') // "Wed, Nov 18"

/** Subject of the check-in. Replies keep "fixed?" in the subject, which is how the poller recognizes them. */
export const checkInSubject = (t: Ticket) => `[${t.id}] Quick check: is ${problemPhrase(t)} fixed?`

export function checkInText(t: Ticket): string {
  const name = t.reporter.name.split(' ')[0] || t.reporter.name
  const date = airgasDate(t)
  const promise = date
    ? `Airgas said it would be taken care of by ${niceDay(date)}.`
    : 'Airgas was asked to take care of it within 2 business days.'
  const desc = t.description.length > 200 ? t.description.slice(0, 197).trimEnd() + '…' : t.description
  return [
    `Hi ${name},`,
    '',
    `On ${niceDay(new Date(t.createdAt))} you reported ${problemPhrase(t)}:`,
    `"${desc}"`,
    '',
    `${promise} Is it fixed now?`,
    '',
    'Just reply to this email with one word:',
    '',
    "  YES  It's fixed. We'll close the ticket.",
    "  NO   It's still a problem. We'll follow up with Airgas right away.",
    '',
    "If it's a NO, a line about what's still wrong helps.",
    '',
    'Thanks,',
    'Rice Stockroom',
    `Ticket ${t.id} · Order ${t.order}`,
  ].join('\n')
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

/**
 * Who gets the next email: Airgas contacts on To; the coordinator, Javier (always, as supervisor),
 * other Rice staff and the reporter on Cc.
 */
export function recipients(t: Ticket, escalating = false): { to: AirgasContact[]; cc: RiceStaff[] } {
  const to = t.participants.filter((p): p is AirgasContact => AIRGAS_CONTACTS.includes(p as AirgasContact))
  if (escalating && !to.includes('chris')) to.push('chris')
  const cc = [...new Set<RiceStaff>([t.coordinator, 'javier', ...t.participants.filter((p): p is RiceStaff => RICE_STAFF.includes(p as RiceStaff))])]
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

