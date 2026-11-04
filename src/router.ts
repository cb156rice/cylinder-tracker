// Hash routes work on GitHub Pages without any server config:
//   #/report            public form
//   #/admin             admin queue
//   #/admin/RG-1048     admin queue with that ticket open
//   #/admin/RG-1045?ask=schedule  ...with a question pre-filled in the reply box
//   #/admin/deliveries  (and #/admin/how) other admin tabs
import { useEffect, useState } from 'react'

export type AdminTab = 'queue' | 'deliveries' | 'how'
export type Route =
  | { page: 'report' }
  | { page: 'admin'; tab: AdminTab; ticketId: string | null; ask: string | null }

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [page, sub] = path.split('/')
  if (page !== 'admin') return { page: 'report' }
  const ask = new URLSearchParams(query).get('ask')
  if (sub === 'deliveries' || sub === 'how') return { page: 'admin', tab: sub, ticketId: null, ask: null }
  return { page: 'admin', tab: 'queue', ticketId: sub ? decodeURIComponent(sub) : null, ask }
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
export const adminHref = (tab: AdminTab = 'queue', ticketId?: string | null, ask?: string) =>
  tab === 'queue'
    ? (ticketId ? `#/admin/${encodeURIComponent(ticketId)}${ask ? `?ask=${encodeURIComponent(ask)}` : ''}` : '#/admin')
    : `#/admin/${tab}`

export const go = (hash: string) => { location.hash = hash }
