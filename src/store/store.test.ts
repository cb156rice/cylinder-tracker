import { describe, expect, it } from 'vitest'
import { clock, missingFromSchedule } from '../lib/rules'
import { addBizDays, dayKey, fromWall } from '../lib/time'
import { receiveEmail, startProgress } from '../lib/transitions'
import { LocalStore } from './localStore'
import { makeSeed, simulatedReply } from './seed'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
}
const storage = () => new MemoryStorage() as unknown as Storage

// A Wednesday morning, a month after the prototype's frozen clock.
const NOW = fromWall(2026, 11, 4, 10, 12)

describe('seed', () => {
  const { tickets, schedule } = makeSeed(NOW)
  const byId = (id: string) => tickets.find(t => t.id === id)!

  it('keeps the prototype clocks on any day', () => {
    expect(clock(byId('RG-1047'), NOW).text).toBe('7h 35m left')
    expect(clock(byId('RG-1048'), NOW).text).toBe('11h 10m left')
    expect(clock(byId('RG-1044'), NOW).text).toBe('7h 30m overdue')
    expect(clock(byId('RG-1042'), NOW).text).toBe('6h 0m biz')
  })
  it('never puts anything in the future', () => {
    for (const t of tickets) for (const e of t.thread) expect(+new Date(e.at)).toBeLessThanOrEqual(+NOW)
  })
  it('moves ETAs and the schedule to today', () => {
    expect(byId('RG-1046').eta).toBe('2026-11-04')
    expect(byId('RG-1048').etaSuggestion?.date).toBe('2026-11-05')
    expect(schedule[0].date).toBe('2026-11-04')
    expect(missingFromSchedule(tickets, schedule.map(s => s.order), NOW).map(t => t.id)).toEqual(['RG-1045'])
  })
  it('uses Friday as "today" on a weekend', () => {
    const sat = fromWall(2026, 11, 7, 11)
    expect(makeSeed(sat).schedule[0].date).toBe(addBizDays(dayKey(sat), -1))
  })
})

describe('LocalStore', () => {
  const REPORT = { name: 'A B', email: 'ab@rice.edu', phone: '', order: 'AG-1', building: 'oconnor' as const, otherBuilding: '', room: '101', category: 'empty' as const, description: '' }

  it('creates, updates, notifies and persists', async () => {
    const s = storage()
    const store = new LocalStore({ now: () => NOW, storage: s })
    let calls = 0
    store.subscribe(() => calls++)
    const t = await store.create(REPORT)
    expect(t).toMatchObject({ id: 'RG-1049', coordinator: 'robert' })
    await store.update(t.id, (x, now) => startProgress(x, 'robert', now))
    expect(calls).toBe(2)

    const again = new LocalStore({ now: () => NOW, storage: s })
    expect((await again.list())[0]).toMatchObject({ id: 'RG-1049', status: 'progress' })
    again.reset()
    expect((await again.list()).some(x => x.id === 'RG-1049')).toBe(false)
  })

  it('rejects invalid reports', async () => {
    const store = new LocalStore({ now: () => NOW, storage: storage() })
    await expect(store.create({ ...REPORT, email: 'x' })).rejects.toThrow('email')
  })

  it('cycles simulated replies into ETA suggestions', async () => {
    const store = new LocalStore({ now: () => NOW, storage: storage() })
    const r = simulatedReply('RG-1047', store.nextSimIndex('RG-1047'))
    const t = await store.update('RG-1047', (x, now) => receiveEmail(x, r.from, r.text, now))
    expect(t.etaSuggestion).toMatchObject({ from: 'gordan', date: '2026-11-05' })
  })

  it('works without storage', async () => {
    const store = new LocalStore({ now: () => NOW, storage: null })
    expect((await store.list()).length).toBe(8)
  })
})
