import { describe, expect, it } from 'vitest'
import {
  clock, coordinatorFor, createTicket, deadline, locationLabel,
  missingFromSchedule, nextTicketId, openingSubject, recipients, threadState, validateReport,
} from './rules'
import { fromWall } from './time'
import type { ReportInput, Ticket } from './types'

const ct = (m: number, d: number, h = 0, mi = 0) => fromWall(2026, m, d, h, mi)
const NOW = ct(10, 5, 14, 30)

const REPORT: ReportInput = {
  name: 'Priya Raman', email: 'pr42@rice.edu', phone: '713-348-2211', order: 'AG-58213947',
  building: 'sst', otherBuilding: '', room: '214', category: 'leak', description: 'Faint hissing at the regulator.',
}
const ticket = (over: Partial<Ticket> = {}, at = NOW): Ticket => ({ ...createTicket(REPORT, 'RG-1047', at), ...over })

describe('routing and new tickets', () => {
  it('routes by building', () => {
    expect(coordinatorFor('sst')).toBe('israel')
    expect(coordinatorFor('oconnor')).toBe('robert')
    expect(coordinatorFor('other')).toBe('javier')
  })
  it('validates the form', () => {
    expect(validateReport(REPORT)).toEqual({})
    const empty: ReportInput = { name: '', email: 'nope', phone: '', order: '', building: '', otherBuilding: '', room: '', category: '', description: '' }
    expect(Object.keys(validateReport(empty)).sort()).toEqual(['building', 'category', 'email', 'name', 'order', 'room'])
    expect(validateReport({ ...REPORT, category: 'other', description: ' ' })).toEqual({ description: 'Describe the issue' })
    expect(validateReport({ ...REPORT, building: 'other' })).toEqual({ otherBuilding: 'Enter the building name' })
  })
  it('creates a ticket with the opening email', () => {
    const t = ticket()
    expect(t).toMatchObject({ status: 'open', coordinator: 'israel', participants: ['ruben', 'gordan'], createdAt: NOW.toISOString() })
    expect(t.thread).toHaveLength(1)
    expect(t.thread[0].kind).toBe('auto')
    expect(t.thread[0].text).toContain('Order AG-58213947 · SST 214')
    expect(t.thread[0].text).toContain('Please reply all with next steps and an ETA.')
    expect(openingSubject(t)).toBe('[RG-1047] Leak · SST 214')
  })
  it('labels other buildings', () => {
    const t = createTicket({ ...REPORT, building: 'other', otherBuilding: 'BRC' }, 'RG-1', NOW)
    expect(locationLabel(t)).toBe('BRC 214')
    expect(t.coordinator).toBe('javier')
  })
  it('numbers tickets', () => {
    expect(nextTicketId([])).toBe('RG-1001')
    expect(nextTicketId([{ id: 'RG-1048' }, { id: 'RG-1041' }])).toBe('RG-1049')
  })
})

describe('clock', () => {
  it('gives a new ticket 12 business hours to respond', () => {
    const t = ticket({}, ct(10, 5, 10, 5))
    expect(clock(t, NOW)).toMatchObject({ label: 'Response due', text: '7h 35m left', tone: 'ok', over: false })
    expect(deadline(t)).toEqual(ct(10, 6, 14, 5))
  })
  it('warns in the last quarter and flags overdue', () => {
    const t = ticket({}, ct(10, 1, 11))
    expect(clock(t, ct(10, 2, 13))).toMatchObject({ tone: 'warn', text: '2h 0m left' })
    expect(clock(t, NOW)).toMatchObject({ tone: 'over', over: true, text: '7h 30m overdue', pct: 100 })
  })
  it('asks for a complexity once in progress', () => {
    const t = ticket({ status: 'progress', startedAt: NOW.toISOString(), complexity: null })
    expect(clock(t, NOW)).toMatchObject({ tone: 'needs-complexity', text: 'Set complexity' })
    expect(deadline(t)).toBeNull()
  })
  it('uses the complexity limit once set', () => {
    const t = ticket({ status: 'progress', startedAt: ct(10, 5, 9, 40).toISOString(), complexity: 'medium' })
    expect(clock(t, NOW)).toMatchObject({ label: 'Resolve · Medium', text: '11h 10m left', tone: 'ok' })
  })
  it('reports resolution time when done', () => {
    const t = ticket({ status: 'done', resolvedAt: ct(10, 6, 10, 5).toISOString() }, ct(10, 5, 10, 5))
    expect(clock(t, NOW)).toMatchObject({ label: 'Resolved in', text: '8h 0m biz', tone: 'done' })
  })
})

describe('thread', () => {
  it('summarises the Airgas thread', () => {
    const t = ticket()
    expect(threadState(t)).toBe('no-reply')
    const replied = { ...t, thread: [...t.thread, { kind: 'email' as const, from: 'ruben' as const, at: NOW.toISOString(), text: 'Checking.' }] }
    expect(threadState(replied)).toBe('replied')
    expect(threadState({ ...replied, eta: '2026-10-06' })).toBe('eta')
    expect(threadState({ ...replied, etaSuggestion: { date: '2026-10-06', quote: 'x', from: 'ruben' } })).toBe('eta-suggested')
    expect(threadState({ ...replied, status: 'done', confirm: 'yes' })).toBe('lab-confirmed')
  })
  it('puts Airgas on To and Rice on Cc', () => {
    const t = ticket({ participants: ['ruben', 'gordan', 'javier'] })
    expect(recipients(t)).toEqual({ to: ['ruben', 'gordan'], cc: ['israel', 'javier'] })
    expect(recipients(t, true).to).toEqual(['ruben', 'gordan', 'chris'])
  })
})

describe('deliveries', () => {
  it('warns about promised deliveries missing from the schedule', () => {
    const due = ticket({ eta: '2026-10-05' })
    expect(missingFromSchedule([due], ['AG-1'], NOW)).toEqual([due])
    expect(missingFromSchedule([due], [due.order], NOW)).toEqual([])
  })
})
