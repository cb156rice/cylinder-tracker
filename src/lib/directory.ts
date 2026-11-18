// People and routing settings: who is who, who leads each building, who gets which emails.
// Edited on the dashboard's Users and Settings pages and stored in the data repo, so the dashboard
// and the mail job always use the same copy. Everything else reads them through the getters below.
//
// The defaults are the six people from the original design. They carry no email addresses: real
// addresses live only in the private data repo, never in this public code.
import type { Building } from './types'

export type Org = 'rice' | 'airgas'

export interface Person {
  /** Stable id stored on tickets ("israel"). Never changes, even if the name does. */
  id: string
  name: string
  /** "SST stockroom", "account manager"… */
  title: string
  org: Org
  email: string
  /** Rice staff: GitHub username, for dashboard access (used by the login page later). */
  github: string
  /** Removed people stay in the data so old tickets still show their names. */
  removed?: boolean
}

export interface Settings {
  v: 1
  people: Person[]
  /** Building → id of the Rice person who coordinates its tickets. */
  leads: Record<Building, string>
  /** Rice people copied on every email (the supervisor). */
  alwaysCopied: string[]
  /** Airgas people every new ticket is emailed to. */
  newTicketContacts: string[]
  /** Airgas person added when someone presses Escalate. */
  escalationContact: string
  /** A reporter's YES closes the ticket (otherwise it's marked ready for the lead to close). */
  autoCloseOnYes: boolean
}

const P = (id: string, name: string, org: Org, title: string): Person => ({ id, name, org, title, email: '', github: '' })

export const DEFAULT_SETTINGS: Settings = {
  v: 1,
  people: [
    P('israel', 'Israel', 'rice', 'SST stockroom'),
    P('robert', 'Robert', 'rice', "O'Connor stockroom"),
    P('javier', 'Javier', 'rice', 'supervisor'),
    P('ruben', 'Ruben', 'airgas', 'account manager'),
    P('gordan', 'Gordan', 'airgas', 'plant manager'),
    P('chris', 'Chris', 'airgas', 'regional manager'),
  ],
  leads: { sst: 'israel', oconnor: 'robert', other: 'javier' },
  alwaysCopied: ['javier'],
  newTicketContacts: ['ruben', 'gordan'],
  escalationContact: 'chris',
  autoCloseOnYes: true,
}

let current: Settings = DEFAULT_SETTINGS
const listeners = new Set<() => void>()

export const getSettings = () => current
export function setSettings(s: Settings) {
  current = normalize(s)
  for (const l of listeners) l()
}
export function onSettings(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

/** Fills in anything missing (older saved settings, hand edits) from the defaults. */
export function normalize(s: Partial<Settings> | null | undefined): Settings {
  const d = DEFAULT_SETTINGS
  const people = Array.isArray(s?.people) && s.people.length ? s.people.map(p => ({ ...P(p.id, p.name, p.org, p.title ?? ''), ...p })) : d.people
  return {
    v: 1,
    people,
    leads: { ...d.leads, ...(s?.leads ?? {}) },
    alwaysCopied: s?.alwaysCopied ?? d.alwaysCopied,
    newTicketContacts: s?.newTicketContacts ?? d.newTicketContacts,
    escalationContact: s?.escalationContact ?? d.escalationContact,
    autoCloseOnYes: s?.autoCloseOnYes ?? d.autoCloseOnYes,
  }
}

const TRACKER = { name: 'Rice Stockroom', role: 'sent automatically', airgas: false }

/** Display info for anyone who can appear on a ticket (unknown ids show as themselves). */
export function person(id: string): { name: string; role: string; airgas: boolean; title: string } {
  if (id === 'tracker') return { ...TRACKER, title: '' }
  const p = current.people.find(x => x.id === id)
  if (!p) return { name: id, role: '', airgas: false, title: '' }
  return { name: p.name, title: p.title, airgas: p.org === 'airgas', role: `${p.org === 'airgas' ? 'Airgas' : 'Rice'} · ${p.title}` }
}

/** Active people in an organization, in the order they were added. */
export const activePeople = (org: Org) => current.people.filter(p => p.org === org && !p.removed)
export const riceStaff = () => activePeople('rice').map(p => p.id)
export const airgasContacts = () => activePeople('airgas').map(p => p.id)

/** Things that would break if this person were removed, in plain words (empty = safe to remove). */
export function usesOf(id: string, s: Settings = current): string[] {
  const uses: string[] = []
  const labels: Record<Building, string> = { sst: 'SST', oconnor: "O'Connor", other: 'other buildings' }
  for (const [b, lead] of Object.entries(s.leads) as [Building, string][]) if (lead === id) uses.push(`leads ${labels[b]}`)
  if (s.escalationContact === id) uses.push('is the escalation contact')
  return uses
}

/** A new id from a name, unique among existing people ("maria", "maria-2"). */
export function newId(name: string, s: Settings = current): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'person'
  let id = base, n = 2
  while (id === 'tracker' || id === 'airgas' || s.people.some(p => p.id === id)) id = `${base}-${n++}`
  return id
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
