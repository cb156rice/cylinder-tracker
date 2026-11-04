// Demo store: keeps tickets in this browser's localStorage. Each visitor gets their own copy,
// seeded from the prototype's data; "Reset demo" puts it back.
import { createTicket, nextTicketId, validateReport } from '../lib/rules'
import type { ReportInput, ScheduleEntry, Ticket } from '../lib/types'
import { makeSeed } from './seed'
import type { Change, TicketStore } from './store'

const KEY = 'cylinder-tracker:demo:v1'

interface Saved {
  version: 1
  tickets: Ticket[]
  schedule: ScheduleEntry[]
  /** How many simulated replies each ticket has had, so the button cycles through them. */
  simCount: Record<string, number>
}

export class LocalStore implements TicketStore {
  readonly mode = 'demo' as const
  private data: Saved
  private listeners = new Set<() => void>()
  private readonly clock: () => Date
  private readonly storage: Storage | null

  constructor(opts: { now?: () => Date; storage?: Storage | null } = {}) {
    this.clock = opts.now ?? (() => new Date())
    this.storage = opts.storage !== undefined ? opts.storage : safeLocalStorage()
    this.data = this.load() ?? this.fresh()
  }

  now() { return this.clock() }

  async list() { return this.data.tickets }

  async schedule() { return this.data.schedule }

  async create(input: ReportInput) {
    const errors = validateReport(input)
    if (Object.keys(errors).length) throw new Error('Report is not valid: ' + Object.keys(errors).join(', '))
    const t = createTicket(input, nextTicketId(this.data.tickets, 1049), this.now())
    this.commit({ ...this.data, tickets: [t, ...this.data.tickets] })
    return t
  }

  async update(id: string, change: Change) {
    const old = this.data.tickets.find(t => t.id === id)
    if (!old) throw new Error(`No ticket ${id}`)
    const next = change(old, this.now())
    this.commit({ ...this.data, tickets: this.data.tickets.map(t => (t.id === id ? next : t)) })
    return next
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  // ---- Demo-only ----

  /** Next index into the canned replies for a ticket, then advances it. */
  nextSimIndex(id: string): number {
    const n = this.data.simCount[id] ?? 0
    this.commit({ ...this.data, simCount: { ...this.data.simCount, [id]: n + 1 } })
    return n
  }

  /** Throws away all changes and reseeds relative to the current time. */
  reset() { this.commit(this.fresh()) }

  private fresh(): Saved {
    return { version: 1, ...makeSeed(this.now()), simCount: {} }
  }

  private load(): Saved | null {
    try {
      const raw = this.storage?.getItem(KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Saved
      return parsed.version === 1 && Array.isArray(parsed.tickets) ? parsed : null
    } catch {
      return null
    }
  }

  private commit(data: Saved) {
    this.data = data
    try { this.storage?.setItem(KEY, JSON.stringify(data)) } catch { /* private window or full storage: keep in memory */ }
    this.listeners.forEach(l => l())
  }
}

function safeLocalStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}
