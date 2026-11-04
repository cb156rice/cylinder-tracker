// Hash routes work on GitHub Pages without any server config:
//   #/report            public form
//   #/admin             admin queue
//   #/admin/RG-1048     admin queue with that ticket open
//   #/admin/deliveries  (and #/admin/how) other admin tabs
import { useEffect, useState } from 'react'

export type AdminTab = 'queue' | 'deliveries' | 'how'
export type Route =
  | { page: 'report' }
  | { page: 'admin'; tab: AdminTab; ticketId: string | null }

export function parseHash(hash: string): Route {
  const [page, sub] = hash.replace(/^#\/?/, '').split('/')
  if (page !== 'admin') return { page: 'report' }
  if (sub === 'deliveries' || sub === 'how') return { page: 'admin', tab: sub, ticketId: null }
  return { page: 'admin', tab: 'queue', ticketId: sub ? decodeURIComponent(sub) : null }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export const reportHref = '#/report'
export const adminHref = (tab: AdminTab = 'queue', ticketId?: string | null) =>
  tab === 'queue' ? (ticketId ? `#/admin/${encodeURIComponent(ticketId)}` : '#/admin') : `#/admin/${tab}`

export const go = (hash: string) => { location.hash = hash }
