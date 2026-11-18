import { describe, expect, it } from 'vitest'
import { createTicket } from './rules'
import { fromWall } from './time'
import {
  acceptEta, complete, confirmDelivery, logContact, receiveEmail, reopen, sendEmail, startProgress,
} from './transitions'

const NOW = fromWall(2026, 10, 5, 14, 30)
const base = createTicket(
  { name: 'Marcus Lee', email: 'ml77@rice.edu', phone: '', order: 'AG-58207730', building: 'oconnor', otherBuilding: '', room: '310', category: 'notdelivered', description: 'Argon missing.' },
  'RG-1044', NOW,
)

describe('transitions', () => {
  it('moves through the lifecycle with notes', () => {
    const p = startProgress(base, 'robert', NOW)
    expect(p).toMatchObject({ status: 'progress', startedAt: NOW.toISOString() })
    expect(p.thread.at(-1)?.text).toBe('Robert moved to In progress')
    const d = complete(p, 'airgas', '', NOW)
    expect(d).toMatchObject({ status: 'done', resolvedBy: 'airgas', resolutionNotes: '(No notes)' })
    expect(reopen(d, NOW)).toMatchObject({ status: 'open', resolvedBy: null, complexity: null })
    expect(base.thread).toHaveLength(1) // never mutates
  })

  it('turns a dated Airgas reply into a suggestion, then an ETA', () => {
    const r = receiveEmail(base, 'ruben', "It's on today's truck.", NOW, ['chris'])
    expect(r.etaSuggestion).toEqual({ date: '2026-10-05', quote: "It's on today's truck.", from: 'ruben' })
    expect(r.participants).toContain('chris')
    expect(r.thread.at(-2)).toMatchObject({ kind: 'email', from: 'ruben', added: ['chris'] })
    // Airgas's first reply moves the ticket along by itself.
    expect(r).toMatchObject({ status: 'progress', startedAt: NOW.toISOString() })
    expect(r.thread.at(-1)?.text).toBe('Ruben replied · moved to In progress')
    expect(receiveEmail(base, 'israel', 'Checking.', NOW).status).toBe('open')
    const a = acceptEta(r, NOW)
    expect(a).toMatchObject({ eta: '2026-10-05', etaSuggestion: null })
    expect(a.thread.at(-1)?.text).toBe("ETA set to Mon Oct 5 from Ruben's reply")
    // Repeating the same date doesn't re-suggest it.
    expect(receiveEmail(a, 'gordan', 'Yes, today.', NOW).etaSuggestion).toBeNull()
  })

  it('logs calls with an ETA suggestion but no email', () => {
    const l = logContact(base, 'robert', 'call', 'gordan', 'Gordan says Thursday.', NOW)
    expect(l.thread.at(-1)).toMatchObject({ kind: 'call', with: 'gordan' })
    expect(l.etaSuggestion?.date).toBe('2026-10-08')
  })

  it('escalates by adding Chris once', () => {
    const e = sendEmail(base, 'robert', 'Hi Chris', NOW, true)
    expect(e.participants).toEqual(['ruben', 'gordan', 'chris'])
    expect(e.thread.at(-1)?.text).toBe('Escalated to Chris')
    expect(sendEmail(e, 'robert', 'Again', NOW, true).participants).toEqual(['ruben', 'gordan', 'chris'])
  })

  it('closes on a lab YES, or waits when auto-close is off', () => {
    const t = { ...base, status: 'progress' as const, eta: '2026-10-05' }
    expect(confirmDelivery(t, true, NOW)).toMatchObject({ status: 'done', confirm: 'yes', resolvedBy: 'airgas' })
    expect(confirmDelivery(t, true, NOW, false)).toMatchObject({ status: 'progress', confirm: 'yes' })
  })

  it('reopens on a lab NO and tells Airgas', () => {
    const t = { ...base, status: 'progress' as const, eta: '2026-10-05' }
    const n = confirmDelivery(t, false, NOW)
    expect(n).toMatchObject({ status: 'progress', confirm: 'no', eta: null, etaSuggestion: null })
    expect(n.thread.map(e => e.kind).slice(-3)).toEqual(['confirm', 'auto', 'note'])
    expect(n.thread.at(-2)?.text).toContain('Marcus Lee, who reported the missed delivery in O\'Connor 310, says it is still not fixed.')
    const c = confirmDelivery(t, false, NOW, true, 'still nothing at the dock')
    expect(c.thread.at(-3)?.text).toBe('No, still a problem: still nothing at the dock')
    expect(c.thread.at(-2)?.text).toContain('"still nothing at the dock"')
  })
})
