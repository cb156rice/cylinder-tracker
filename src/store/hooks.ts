import { getSettings, onSettings, setSettings, type Settings } from '../lib/directory'
import { useContext, useEffect, useState } from 'react'
import type { ScheduleEntry, Ticket } from '../lib/types'
import { StoreContext } from './storeContext'
import { LocalStore } from './localStore'
import type { StoreStatus, TicketStore } from './store'

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
    // Settings (people, routing) load with the tickets, so names and lists are right on the first render
    // and pick up changes made on another computer at each refresh.
    const load = () => Promise.all([store.list(), store.schedule(), store.loadSettings()]).then(([tickets, schedule, settings]) => {
      if (!live) return
      setSettings(settings)
      setState({ tickets, schedule, loading: false })
    })
    load()
    const off = store.subscribe(load)
    // Live data: re-fetch on an interval, and when the tab comes back into view.
    const refresh = () => { if (document.visibilityState === 'visible') store.refresh?.().catch(() => {}) }
    const timer = store.refreshMs ? setInterval(refresh, store.refreshMs) : undefined
    if (store.refreshMs) document.addEventListener('visibilitychange', refresh)
    return () => {
      live = false; off(); clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
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

/** Sync state for live stores (null for the demo). */
export function useStoreStatus(): StoreStatus | null {
  const store = useStore()
  const [status, setStatus] = useState(() => store.status?.() ?? null)
  useEffect(() => store.subscribe(() => setStatus(store.status?.() ?? null)), [store])
  return status
}

/** The current people and routing settings; re-renders when they change. */
export function useSettings(): Settings {
  const [s, set] = useState(getSettings)
  useEffect(() => onSettings(() => set(getSettings())), [])
  return s
}
