// Data model. Everything here is plain JSON (instants are ISO strings) so a ticket can be
// stored as-is in the browser now and in a GitHub issue later.
import type { DateKey } from './time'

/** ISO 8601 instant, e.g. "2026-10-05T19:30:00.000Z". */
export type Instant = string

export type Building = 'sst' | 'oconnor' | 'other'
export type Category = 'leak' | 'notdelivered' | 'empty' | 'other'
export type Status = 'open' | 'progress' | 'done'
export type Complexity = 'low' | 'medium' | 'high'

export type RiceStaff = 'israel' | 'robert' | 'javier'
export type AirgasContact = 'ruben' | 'gordan' | 'chris'
/** Everyone who can appear on a thread. 'tracker' is the automatic sender. */
export type PersonId = RiceStaff | AirgasContact | 'tracker'
export type ResolvedBy = RiceStaff | 'airgas'
/** Delivery confirmation: null = not asked yet. */
export type ConfirmState = null | 'asked' | 'yes' | 'no'

export interface Reporter {
  name: string
  email: string
  phone: string
}

export interface EtaSuggestion {
  date: DateKey
  quote: string
  from: PersonId
}

interface EntryBase {
  at: Instant
  text: string
}
/** An email on the thread, from Airgas or Rice staff. */
export interface EmailEntry extends EntryBase {
  kind: 'email'
  from: RiceStaff | AirgasContact
  /** People this message added to the thread ("Ruben added Chris"). */
  added?: PersonId[]
}
/** An email the tracker sent on its own (opening email, follow-ups). */
export interface AutoEntry extends EntryBase {
  kind: 'auto'
}
/** A logged phone call or visit. Kept on the timeline only, never emailed. */
export interface LogEntry extends EntryBase {
  kind: 'call' | 'visit'
  from: RiceStaff
  with: AirgasContact
}
/** The reporter's answer to "Did your delivery fix the problem?" */
export interface ConfirmEntry extends EntryBase {
  kind: 'confirm'
  fixed: boolean
}
/** A one-line system note ("Israel moved to In progress"). */
export interface NoteEntry extends EntryBase {
  kind: 'note'
}
export type ThreadEntry = EmailEntry | AutoEntry | LogEntry | ConfirmEntry | NoteEntry

export interface Ticket {
  id: string // "RG-1048"
  order: string
  building: Building
  otherBuilding: string // only used when building === 'other'
  room: string
  category: Category
  description: string
  reporter: Reporter
  createdAt: Instant

  status: Status
  complexity: Complexity | null
  /** When the resolution clock started (moved to In progress or complexity changed). */
  startedAt: Instant | null
  coordinator: RiceStaff
  /** People on the email thread besides the reporter and the tracker. */
  participants: PersonId[]

  eta: DateKey | null
  etaSuggestion: EtaSuggestion | null
  confirm: ConfirmState

  resolvedBy: ResolvedBy | null
  resolvedAt: Instant | null
  resolutionNotes: string

  thread: ThreadEntry[]
}

/** What the public form collects. */
export interface ReportInput {
  name: string
  email: string
  phone: string
  order: string
  building: Building | ''
  otherBuilding: string
  room: string
  category: Category | ''
  description: string
}

export interface ScheduleEntry {
  date: DateKey
  order: string
  site: string
  item: string
}
