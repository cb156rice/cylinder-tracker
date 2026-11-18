import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, newId, normalize, person, riceStaff, setSettings, usesOf, type Settings } from './directory'
import { coordinatorFor, createTicket, recipients } from './rules'
import { sendEmail } from './transitions'
import { fromWall } from './time'

const NOW = fromWall(2026, 11, 18, 10)
const REPORT = { name: 'Wei Chen', email: 'wc@rice.edu', phone: '', order: '1', building: 'sst' as const, otherBuilding: '', room: '1', category: 'leak' as const, description: 'x' }
const withMaria = (): Settings => ({
  ...DEFAULT_SETTINGS,
  people: [...DEFAULT_SETTINGS.people, { id: 'maria', name: 'Maria Lopez', title: 'SST stockroom', org: 'rice', email: 'm@rice.edu', github: 'mlopez' },
    { id: 'dana', name: 'Dana', title: 'service manager', org: 'airgas', email: '', github: '' }],
  leads: { ...DEFAULT_SETTINGS.leads, sst: 'maria' },
  alwaysCopied: ['javier', 'robert'],
  newTicketContacts: ['dana'],
  escalationContact: 'gordan',
})

afterEach(() => setSettings(DEFAULT_SETTINGS))

describe('people and routing settings', () => {
  it('drives routing, recipients and escalation', () => {
    setSettings(withMaria())
    expect(coordinatorFor('sst')).toBe('maria')
    const t = createTicket(REPORT, 'RG-1', NOW)
    expect(t.participants).toEqual(['dana'])
    expect(recipients(t)).toEqual({ to: ['dana'], cc: ['maria', 'javier', 'robert'] })
    const e = sendEmail(t, 'maria', 'Help', NOW, true)
    expect(e.participants).toEqual(['dana', 'gordan'])
    expect(e.thread.at(-1)?.text).toBe('Escalated to Gordan')
    expect(person('maria')).toMatchObject({ name: 'Maria Lopez', role: 'Rice · SST stockroom', airgas: false })
  })
  it('drops removed people from lists and email, but keeps their names on old tickets', () => {
    const s = withMaria()
    setSettings({ ...s, people: s.people.map(p => (p.id === 'robert' ? { ...p, removed: true } : p)) })
    expect(riceStaff()).toEqual(['israel', 'javier', 'maria'])
    expect(recipients(createTicket(REPORT, 'RG-1', NOW)).cc).toEqual(['maria', 'javier'])
    expect(person('robert').name).toBe('Robert')
  })
  it("won't remove someone who leads a building or is the escalation contact", () => {
    expect(usesOf('israel')).toEqual(['leads SST'])
    expect(usesOf('chris')).toEqual(['is the escalation contact'])
    expect(usesOf('ruben')).toEqual([])
  })
  it('makes unique ids and fills gaps in saved settings', () => {
    expect(newId('Israel Gómez')).toBe('israel-gomez')
    expect(newId('Israel')).toBe('israel-2')
    expect(normalize({ people: [] }).people).toHaveLength(6)
    expect(normalize({ autoCloseOnYes: false }).autoCloseOnYes).toBe(false)
  })
})
