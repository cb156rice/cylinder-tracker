import { describe, expect, it } from 'vitest'
import { makeSeed } from '../store/seed'
import { confirmationNote, deliveryView } from './deliveries'
import { fromWall } from './time'
import { askConfirmation, confirmDelivery } from './transitions'

const NOW = fromWall(2026, 11, 4, 10, 12)

describe('deliveryView', () => {
  const { tickets, schedule } = makeSeed(NOW)

  it('matches today’s schedule to tickets and flags promised orders that are missing', () => {
    const v = deliveryView(tickets, schedule, NOW)
    expect(v.rows.map(r => r.ticket?.id ?? null)).toEqual(['RG-1046', 'RG-1044', null, null])
    expect(v.missing.map(t => t.id)).toEqual(['RG-1045'])
    expect(v.pending).toBe(3)
  })

  it('ignores a schedule from another day', () => {
    const tomorrow = fromWall(2026, 11, 5, 10)
    const v = deliveryView(tickets, schedule, tomorrow)
    expect(v.today).toEqual([])
    expect(v.latestDay).toBe('2026-11-04')
  })

  it('stops counting a ticket once the lab answers', () => {
    const answered = tickets.map(t => (t.id === 'RG-1046' ? confirmDelivery(askConfirmation(t, NOW), true, NOW) : t))
    expect(deliveryView(answered, schedule, NOW).pending).toBe(2)
    expect(confirmationNote(answered.find(t => t.id === 'RG-1046')!)).toBe("Aisha confirmed it's fixed. Ticket closed.")
  })
})
