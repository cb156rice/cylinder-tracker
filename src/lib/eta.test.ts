import { describe, expect, it } from 'vitest'
import { detectEta } from './eta'
import { fromWall } from './time'

const MON = fromWall(2026, 10, 5, 14, 30) // Mon Oct 5, 2:30 PM
const FRI = fromWall(2026, 10, 9, 15, 0) // Fri Oct 9, 3 PM

describe('detectEta', () => {
  it('reads today', () => {
    expect(detectEta("It's on today's truck.", MON)).toBe('2026-10-05')
    expect(detectEta('Driver will be there this afternoon', MON)).toBe('2026-10-05')
  })
  it("reads tomorrow, skipping the weekend", () => {
    expect(detectEta("We'll swap it on tomorrow's truck.", MON)).toBe('2026-10-06')
    expect(detectEta('Tomorrow for sure.', FRI)).toBe('2026-10-12')
  })
  it('reads next week as next Monday', () => {
    expect(detectEta('Should ship next week', MON)).toBe('2026-10-12')
  })
  it('reads weekday names', () => {
    expect(detectEta('It will go out Thursday.', MON)).toBe('2026-10-08')
    expect(detectEta("This will be on Wednesday's truck.", MON)).toBe('2026-10-07')
    expect(detectEta("We'll swap it Monday.", FRI)).toBe('2026-10-12')
  })
  it('uses the first weekday mentioned', () => {
    expect(detectEta('Friday if not Tuesday', MON)).toBe('2026-10-09')
  })
  it('uses the Chicago date late in the evening', () => {
    const lateMon = new Date('2026-10-06T03:00:00Z') // still Monday in Chicago
    expect(detectEta('Tomorrow', lateMon)).toBe('2026-10-06')
  })
  it('returns null without a date', () => {
    expect(detectEta('Thanks, checking with the plant and will get back to you.', MON)).toBeNull()
    expect(detectEta("The argon order missed last week's route.", MON)).toBeNull()
  })
})
