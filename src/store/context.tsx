import type { ReactNode } from 'react'
import { StoreContext } from './storeContext'
import type { TicketStore } from './store'

export function StoreProvider({ store, children }: { store: TicketStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
