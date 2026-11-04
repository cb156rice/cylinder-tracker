import { createContext } from 'react'
import type { TicketStore } from './store'

export const StoreContext = createContext<TicketStore | null>(null)
