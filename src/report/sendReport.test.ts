import { describe, expect, it } from 'vitest'
import { decodePayload, encodePayload, makePayload } from './payload'
import { templateParams } from './sendReport'
import type { ReportInput } from '../lib/types'

const input: ReportInput = {
  name: ' José Núñez ', email: 'jn@rice.edu', phone: '', order: '', building: 'other', otherBuilding: 'BioScience',
  room: '210', category: 'leak', description: 'Hissing at the regulator — smells like “rotten eggs”',
}

describe('report payload', () => {
  it('round-trips non-ASCII text through base64', () => {
    const p = makePayload(input, new Date('2026-11-13T15:00:00Z'), 'abc')
    const back = decodePayload(encodePayload(p))
    expect(back).toEqual(p)
    expect(back.report.name).toBe('José Núñez')
    expect(back.submittedAt).toBe('2026-11-13T15:00:00.000Z')
  })

  it('ignores line breaks the mail client adds inside the base64', () => {
    const b64 = encodePayload(makePayload(input))
    const wrapped = b64.replace(/(.{60})/g, '$1\r\n')
    expect(decodePayload(wrapped).report.room).toBe('210')
  })

  it('fills the template with readable labels', () => {
    const t = templateParams(makePayload(input))
    expect(t.building).toBe('BioScience')
    expect(t.category).toBe('Leak')
    expect(t.order).toBe('—')
  })
})
