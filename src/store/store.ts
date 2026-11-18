// Where tickets live. Demo: the browser (LocalStore). Live: GitHub Issues (GitHubStore).
// Screens only talk to this interface, so swapping the backend doesn't touch them.
import type { Settings } from '../lib/directory'
import type { ReportInput, ScheduleEntry, Ticket } from '../lib/types'

/** A ticket change: one of the functions in lib/transitions, partially applied. */
export type Change = (t: Ticket, now: Date) => Ticket

export interface StoreStatus {
  syncing: boolean
  error: string | null
  lastSync: Date | null
}

export interface TicketStore {
  readonly mode: 'demo' | 'github'
  now(): Date
  list(): Promise<Ticket[]>
  /** Turns a valid form submission into a ticket (routing, ID, opening email). */
  create(input: ReportInput): Promise<Ticket>
  update(id: string, change: Change): Promise<Ticket>
  /** The latest Airgas delivery schedule. */
  schedule(): Promise<ScheduleEntry[]>
  /** People and routing (Users and Settings pages). Defaults if nothing has been saved yet. */
  loadSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>
  /** Called after any change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Stores backed by a server re-fetch on this interval (ms). */
  readonly refreshMs?: number
  refresh?(): Promise<void>
  status?(): StoreStatus
}
