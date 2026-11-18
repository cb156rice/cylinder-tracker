import { describe, expect, it } from 'vitest'
import {
  clock, coordinatorFor, createTicket, deadline, locationLabel,
  checkInDue, fixDue, nextTicketId, openingSubject, recipients, threadState, validateReport,
} from './rules'
import { askFixed } from './transitions'
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

describe('due dates', () => {
  it('gives Airgas 12 business hours to reply to a new ticket', () => {
    const t = ticket({}, ct(10, 5, 10, 5))
    expect(deadline(t)).toEqual(ct(10, 6, 14, 5))
    expect(clock(t, NOW)).toMatchObject({ label: 'Airgas reply due', over: false })
    expect(clock(ticket({}, ct(10, 1, 11)), NOW)).toMatchObject({ over: true })
  })
  it('without a date from Airgas, the fix is due 2 business days after the report', () => {
    const t = ticket({ status: 'progress', startedAt: NOW.toISOString() }, ct(10, 5, 10, 5))
    expect(deadline(t)).toEqual(ct(10, 7, 10, 5))
    expect(clock(t, NOW)).toMatchObject({ label: 'Fix due', over: false })
  })
  it("uses the date Airgas gave (5 PM that day), not dates from Rice's own messages", () => {
    const t = ticket({ status: 'progress' }, ct(10, 5, 10, 5))
    expect(fixDue({ ...t, etaSuggestion: { date: '2026-10-08', quote: 'Thursday', from: 'gordan' } })).toEqual(ct(10, 8, 17))
    expect(fixDue({ ...t, eta: '2026-10-09' })).toEqual(ct(10, 9, 17))
    expect(fixDue({ ...t, etaSuggestion: { date: '2026-10-08', quote: 'Thursday?', from: 'israel' } })).toEqual(ct(10, 7, 10, 5))
  })
  it('has no clock once closed', () => {
    expect(clock(ticket({ status: 'done' }), NOW)).toMatchObject({ label: 'Closed', over: false })
  })
})

describe('"Is it fixed?" check-in', () => {
  const t = ticket({ status: 'progress' }, ct(10, 1, 11)) // fix due Mon Oct 5, 11 AM
  it('asks once the fix due date has passed, during business hours', () => {
    expect(checkInDue(t, ct(10, 5, 10))).toBe(false)
    expect(checkInDue(t, NOW)).toBe(true)
    expect(checkInDue(ticket({ status: 'progress', eta: '2026-10-08' }, ct(10, 1, 11)), ct(10, 8, 20))).toBe(false) // evening: wait for morning
    expect(checkInDue(ticket({ status: 'progress', eta: '2026-10-08' }, ct(10, 1, 11)), ct(10, 9, 9, 30))).toBe(true)
  })
  it("asks again only after Airgas gives a new date, and never on closed tickets", () => {
    const asked = askFixed(t, NOW)
    expect(asked.confirm).toBe('asked')
    expect(asked.thread.at(-1)).toMatchObject({ kind: 'auto', audience: 'reporter' })
    expect(asked.thread.at(-1)?.text).toContain('Please reply YES or NO')
    expect(checkInDue(asked, ct(10, 6, 12))).toBe(false)
    expect(checkInDue({ ...asked, eta: '2026-10-08' }, ct(10, 9, 10))).toBe(true)
    expect(checkInDue({ ...t, status: 'done' }, NOW)).toBe(false)
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
})
