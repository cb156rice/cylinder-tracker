import { describe, expect, it } from 'vitest'
import { fromWall } from '../lib/time'
import { makeSeed } from './seed'
import { issueLabels, issueNumber, issueTitle, parseBody, parseComment, renderBody, renderComment, ticketId } from './githubFormat'

const { tickets } = makeSeed(fromWall(2026, 11, 4, 10, 12))
const t = tickets.find(x => x.id === 'RG-1048')!

describe('github format', () => {
  it('maps issue numbers to ticket IDs', () => {
    expect(ticketId(48)).toBe('RG-1048')
    expect(issueNumber('RG-1048')).toBe(48)
  })

  it('round-trips ticket fields through the issue body', () => {
    const { id: _id, thread: _thread, ...fields } = t
    expect(parseBody(renderBody(t))).toEqual(fields)
    expect(renderBody(t)).toContain('**Leak · SST 312**')
    expect(issueTitle(t)).toBe('[RG-1048] Leak · SST 312')
    expect(issueLabels(t)).toEqual(['status:progress', 'building:sst', 'coordinator:israel'])
  })

  it('round-trips every kind of thread entry through comments', () => {
    const all = tickets.flatMap(x => x.thread.map(e => ({ e, x })))
    expect(new Set(all.map(a => a.e.kind))).toEqual(new Set(['auto', 'note', 'email', 'visit', 'call', 'confirm']))
    for (const { e, x } of all) expect(parseComment(renderComment(e, x))).toEqual(e)
  })

  it('survives text that looks like the end of an HTML comment', () => {
    const e = { kind: 'email' as const, from: 'ruben' as const, at: '2026-11-04T16:00:00.000Z', text: 'Arrow --> here -- ok' }
    expect(parseComment(renderComment(e, t))).toEqual(e)
  })

  it('ignores bodies and comments it did not write', () => {
    expect(parseBody('Just a normal issue')).toBeNull()
    expect(parseComment('A person commented on GitHub')).toBeNull()
  })
})
