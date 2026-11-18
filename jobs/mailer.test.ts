import { describe, expect, it } from 'vitest'
import { fromWall } from '../src/lib/time'
import { sendEmail } from '../src/lib/transitions'
import { fakeGitHub } from '../src/store/fakeGitHub'
import { GitHubStore } from '../src/store/githubStore'
import { sendOutbox, type MailSender } from './mailer'

const NOW = fromWall(2026, 11, 13, 10, 0)
const DIR = { airgas: ['airgas@example.com'], staff: ['staff@example.com'] }
const REPORT = { name: 'Wei Chen', email: 'wc@rice.edu', phone: '', order: '11111', building: 'sst' as const, otherBuilding: '', room: '315', category: 'leak' as const, description: 'Hissing' }

function fakeSender() {
  const sent: string[] = []
  const box: MailSender = {
    async send(raw) { sent.push(raw); return `g${sent.length}` },
    async messageIdOf(id) { return `<${id}@mail.gmail.com>` },
  }
  return { box, sent }
}

const header = (raw: string, name: string) => new RegExp(`^${name}: (.*)$`, 'm').exec(raw)?.[1] ?? null
const body = (raw: string) => Buffer.from(raw.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8').replace(/\r\n/g, '\n')

describe('sendOutbox', () => {
  it('sends the opening email and dashboard replies once each, threaded, to the demo addresses only', async () => {
    const store = new GitHubStore(fakeGitHub().api(), () => NOW)
    await store.create(REPORT, { at: new Date(NOW.getTime() - 3600_000), ref: 'report:s1' })
    const { box, sent } = fakeSender()

    const r1 = await sendOutbox(box, store, DIR, NOW, () => {})
    expect(r1.sent).toEqual(['RG-1001 (automatic)'])
    expect(header(sent[0], 'To')).toBe('airgas@example.com')
    expect(header(sent[0], 'Cc')).toBe('staff@example.com')
    expect(header(sent[0], 'In-Reply-To')).toBeNull()
    expect(body(sent[0])).toContain('would go to: Ruben, Gordan · cc Israel, Wei (reporter)')
    expect(body(sent[0])).toContain('keep [RG-1001] in the subject')
    expect(body(sent[0])).not.toContain('wc@rice.edu>') // the reporter is never a real recipient in demo mode
    expect(sent[0]).not.toMatch(/^(To|Cc):.*wc@rice\.edu/m)

    await store.update('RG-1001', (t, n) => sendEmail(t, 'israel', 'Any update?', n, true))
    const r2 = await sendOutbox(box, store, DIR, NOW, () => {})
    expect(r2.sent).toEqual(['RG-1001 (Israel)'])
    expect(header(sent[1], 'In-Reply-To')).toBe('<g1@mail.gmail.com>')
    expect(body(sent[1])).toContain('Ruben, Gordan, Chris')
    expect(body(sent[1])).toContain('Any update?\n\nIsrael')

    const r3 = await sendOutbox(box, store, DIR, NOW, () => {})
    expect(r3.sent).toEqual([])
    expect(sent).toHaveLength(2)
    const t = (await store.list())[0]
    expect(t.thread.filter(e => e.kind === 'note' && e.ref?.startsWith('sent:'))).toHaveLength(2)
  })

  it('never sends old messages, and does nothing without both address lists', async () => {
    const store = new GitHubStore(fakeGitHub().api(), () => NOW)
    await store.create(REPORT, { at: new Date(NOW.getTime() - 3 * 86400_000), ref: 'report:old' })
    await store.create(REPORT, { at: NOW, ref: 'report:new' })
    const { box, sent } = fakeSender()

    expect((await sendOutbox(box, store, { airgas: [], staff: ['s@x.com'] }, NOW, () => {})).sent).toEqual([])
    expect(sent).toHaveLength(0)
    expect((await sendOutbox(box, store, DIR, NOW, () => {})).sent).toEqual(['RG-1002 (automatic)'])
  })
})
