import { describe, expect, it } from 'vitest'
import { HOUR, addBiz, addDays, bizMs, dayKey, dur, fmt, fmtDay, fmtShort, fromWall, sameDay, toWall } from './time'

// Chicago wall time → instant, for readable test inputs.
const ct = (m: number, d: number, h = 0, mi = 0) => fromWall(2026, m, d, h, mi)

describe('fromWall / toWall', () => {
  it('converts Chicago wall time in CDT and CST', () => {
    expect(ct(10, 5, 14, 30).toISOString()).toBe('2026-10-05T19:30:00.000Z') // CDT, UTC-5
    expect(ct(11, 2, 10).toISOString()).toBe('2026-11-02T16:00:00.000Z') // CST, UTC-6
  })
  it('handles DST switch days', () => {
    expect(ct(3, 8, 9).toISOString()).toBe('2026-03-08T14:00:00.000Z') // spring forward day
    expect(ct(11, 1, 9).toISOString()).toBe('2026-11-01T15:00:00.000Z') // fall back day
  })
  it('round-trips', () => {
    expect(toWall(ct(10, 5, 14, 30))).toMatchObject({ year: 2026, month: 10, day: 5, hour: 14, minute: 30, weekday: 1 })
  })
})

describe('addBiz', () => {
  it('Mon Oct 5 2:30 PM + 12 business hrs = Wed Oct 7 10:30 AM', () => {
    expect(addBiz(ct(10, 5, 14, 30), 12 * HOUR)).toEqual(ct(10, 7, 10, 30))
  })
  it('Fri Oct 30 4 PM CDT + 2 hrs = Mon Nov 2 10 AM CST (across the weekend and DST)', () => {
    const due = addBiz(ct(10, 30, 16), 2 * HOUR)
    expect(due.toISOString()).toBe('2026-11-02T16:00:00.000Z')
    expect(fmt(due)).toBe('Mon Nov 2, 10:00 AM')
  })
  it('starts at 9 AM when submitted before hours or on a weekend', () => {
    expect(addBiz(ct(10, 5, 6), HOUR)).toEqual(ct(10, 5, 10))
    expect(addBiz(ct(10, 3, 12), HOUR)).toEqual(ct(10, 5, 10)) // Saturday
    expect(addBiz(ct(10, 5, 18), HOUR)).toEqual(ct(10, 6, 10)) // after 5 PM
  })
  it('ends exactly at 5 PM rather than rolling to the next morning', () => {
    expect(addBiz(ct(10, 5, 9), 8 * HOUR)).toEqual(ct(10, 5, 17))
  })
  it('40 business hours is one business week', () => {
    expect(addBiz(ct(10, 5, 14, 30), 40 * HOUR)).toEqual(ct(10, 12, 14, 30))
  })
})

describe('bizMs', () => {
  it('counts only 9–5 on weekdays', () => {
    expect(bizMs(ct(10, 5, 14, 30), ct(10, 7, 10, 30))).toBe(12 * HOUR)
    expect(bizMs(ct(10, 2, 16), ct(10, 5, 10))).toBe(2 * HOUR) // Fri 4 PM → Mon 10 AM
    expect(bizMs(ct(10, 3, 0), ct(10, 4, 23))).toBe(0) // weekend
    expect(bizMs(ct(10, 5, 18), ct(10, 6, 8))).toBe(0) // overnight
  })
  it('is exact across the DST change', () => {
    expect(bizMs(ct(10, 30, 16), ct(11, 2, 10))).toBe(2 * HOUR)
  })
  it('is zero when the end is not after the start', () => {
    expect(bizMs(ct(10, 5, 12), ct(10, 5, 11))).toBe(0)
  })
  it('is the inverse of addBiz', () => {
    const start = ct(10, 28, 11, 17)
    for (const h of [1, 7.5, 12, 16, 40]) expect(bizMs(start, addBiz(start, h * HOUR))).toBe(h * HOUR)
  })
})

describe('days', () => {
  it('uses the Chicago date, not the UTC date', () => {
    const lateEvening = new Date('2026-10-06T03:00:00Z') // Mon Oct 5, 10 PM in Chicago
    expect(dayKey(lateEvening)).toBe('2026-10-05')
    expect(sameDay(lateEvening, '2026-10-05')).toBe(true)
    expect(fmtDay(lateEvening)).toBe('Mon Oct 5')
  })
  it('steps across month ends and DST', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
  })
})

describe('formatting', () => {
  it('formats like the prototype', () => {
    expect(fmt(ct(10, 5, 14, 30))).toBe('Mon Oct 5, 2:30 PM')
    expect(fmt(ct(10, 5, 0, 5))).toBe('Mon Oct 5, 12:05 AM')
    expect(fmtShort(ct(10, 5, 9, 12))).toBe('Oct 5 · 9:12a')
    expect(fmtShort(ct(10, 5, 12, 0))).toBe('Oct 5 · 12:00p')
    expect(fmtDay('2026-10-08')).toBe('Thu Oct 8')
  })
  it('formats durations', () => {
    expect(dur(45 * 60e3)).toBe('45m')
    expect(dur(-(3 * HOUR + 20 * 60e3))).toBe('3h 20m')
  })
})
