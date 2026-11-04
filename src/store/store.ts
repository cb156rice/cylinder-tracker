// Where tickets live. Phase 1: the browser (LocalStore). Phase 2: GitHub Issues.
// Screens only talk to this interface, so swapping the backend doesn't touch them.
import type { ReportInput, ScheduleEntry, Ticket } from '../lib/types'

/** A ticket change: one of the functions in lib/transitions, partially applied. */
export type Change = (t: Ticket, now: Date) => Ticket

export interface TicketStore {
  readonly mode: 'demo' | 'github'
  now(): Date
  list(): Promise<Ticket[]>
  /** Turns a valid form submission into a ticket (routing, ID, opening email). */
  create(input: ReportInput): Promise<Ticket>
  update(id: string, change: Change): Promise<Ticket>
  /** The latest Airgas delivery schedule. */
  schedule(): Promise<ScheduleEntry[]>
  /** Called after any change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}
