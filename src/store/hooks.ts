import { useContext, useEffect, useState } from 'react'
import type { ScheduleEntry, Ticket } from '../lib/types'
import { StoreContext } from './storeContext'
import { LocalStore } from './localStore'
import type { TicketStore } from './store'

export function useStore(): TicketStore {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used inside <StoreProvider>')
  return s
}

/** The demo store, when that's what's running (for demo-only buttons). */
export function useDemoStore(): LocalStore | null {
  const s = useStore()
  return s instanceof LocalStore ? s : null
}

/** Live list of tickets and the schedule; re-renders whenever the store changes. */
export function useTickets(): { tickets: Ticket[]; schedule: ScheduleEntry[]; loading: boolean } {
  const store = useStore()
  const [state, setState] = useState<{ tickets: Ticket[]; schedule: ScheduleEntry[]; loading: boolean }>({ tickets: [], schedule: [], loading: true })
  useEffect(() => {
    let live = true
    const load = () => Promise.all([store.list(), store.schedule()]).then(([tickets, schedule]) => {
      if (live) setState({ tickets, schedule, loading: false })
    })
    load()
    const off = store.subscribe(load)
    return () => { live = false; off() }
  }, [store])
  return state
}

/** The current time, refreshed every 30 s so clocks tick. */
export function useNow(): Date {
  const store = useStore()
  const [now, setNow] = useState(() => store.now())
  useEffect(() => {
    const id = setInterval(() => setNow(store.now()), 30_000)
    return () => clearInterval(id)
  }, [store])
  return now
}
