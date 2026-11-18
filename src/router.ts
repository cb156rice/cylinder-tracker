// Hash routes work on GitHub Pages without any server config:
//   #/report            public form
//   #/admin             admin queue
//   #/admin/RG-1048     admin queue with that ticket open
//   #/admin/users, #/admin/settings, #/admin/how   other admin tabs
import { useEffect, useState } from 'react'

export type AdminTab = 'queue' | 'users' | 'settings' | 'how'
export type Route =
  | { page: 'report' }
  | { page: 'admin'; tab: AdminTab; ticketId: string | null }

export function parseHash(hash: string): Route {
  const [path] = hash.replace(/^#\/?/, '').split('?')
  const [page, sub] = path.split('/')
  if (page !== 'admin') return { page: 'report' }
  if (sub === 'how' || sub === 'users' || sub === 'settings') return { page: 'admin', tab: sub, ticketId: null }
  // Old links to the removed deliveries tab land on the queue.
  return { page: 'admin', tab: 'queue', ticketId: sub && sub !== 'deliveries' ? decodeURIComponent(sub) : null }
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
  tab === 'queue'
    ? (ticketId ? `#/admin/${encodeURIComponent(ticketId)}` : '#/admin')
    : `#/admin/${tab}`

export const go = (hash: string) => { location.hash = hash }
