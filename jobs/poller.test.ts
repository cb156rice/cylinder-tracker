import { describe, expect, it } from 'vitest'
import { fromWall } from '../src/lib/time'
import { fakeGitHub } from '../src/store/fakeGitHub'
import { GitHubStore } from '../src/store/githubStore'
import { encodePayload, makePayload } from '../src/report/payload'
import type { Mail } from './gmail'
import { pollInbox, PROCESSED, SKIPPED, type MailBox } from './poller'
import { fixAnswer, identify, parseAddress, stripQuoted } from './parse'

const NOW = fromWall(2026, 11, 13, 10, 0)
const DIR = { airgas: ['airgas@example.com'], staff: ['staff@example.com'] }
const REPORT = { name: 'Wei Chen', email: 'wc@rice.edu', phone: '', order: '11111', building: 'sst' as const, otherBuilding: '', room: '315', category: 'leak' as const, description: 'Hissing' }

function reportMail(id: string, at: Date): Mail {
  const p = makePayload(REPORT, at, `sub-${id}`)
  return { id, threadId: id, date: at, from: 'Wei Chen <tracker@gmail.com>', subject: '[NEW REPORT] Leak · SST 315', messageId: `<${id}@emailjs>`,
    text: `New cylinder issue report\n\nName: Wei Chen\n\n---DATA---\n${encodePayload(p).replace(/(.{70})/g, '$1\n')}\n---END---\nEmail sent via EmailJS.com` }
}

function fakeMail(mails: Mail[]) {
  const labels = new Map<string, Set<string>>()
  const box: MailBox = {
    async search() { return mails.filter(m => !labels.get(m.id)?.size).map(m => m.id) },
    async get(id) { return mails.find(m => m.id === id)! },
    async label(name) { return name },
    async addLabel(id, l) { labels.set(id, (labels.get(id) ?? new Set()).add(l)) },
  }
  return { box, labels }
}

describe('pollInbox', () => {
  it('turns a form report into a ticket, then attaches replies and ignores repeats', async () => {
    const gh = fakeGitHub()
    const store = new GitHubStore(gh.api(), () => NOW)
    const mails: Mail[] = [reportMail('m1', new Date(NOW.getTime() - 3600_000))]
    const { box, labels } = fakeMail(mails)

    const r1 = await pollInbox(box, store, DIR, () => {})
    expect(r1.created).toEqual(['RG-1001'])
    expect(labels.get('m1')).toContain(PROCESSED)
    const t = (await store.list())[0]
    expect(t.createdAt).toBe(new Date(NOW.getTime() - 3600_000).toISOString())
    expect(t.thread[0].ref).toBe('report:sub-m1')

    mails.push(
      { id: 'm2', threadId: 't', date: NOW, from: 'Carlos <airgas@example.com>', subject: 'Re: [RG-1001] Leak · SST 315', messageId: '<m2@x>',
        text: "We'll swap it on tomorrow's truck.\n\nThanks,\nChris\n\nOn Fri, Nov 13, 2026 at 9:00 AM Tracker <tracker@gmail.com> wrote:\n> Order 11111 · SST 315" },
      { id: 'm3', threadId: 't', date: NOW, from: 'cb156 <STAFF@example.com>', subject: 'RE: [RG-1001] Leak · SST 315', messageId: '<m3@x>',
        text: 'Thanks, lab is aware.\n\n________________________________\nFrom: Carlos <airgas@example.com>\nSent: Friday' },
      { id: 'm4', threadId: 'u', date: NOW, from: 'Lab person <lab@rice.edu>', subject: 'Re: [RG-1001] Leak · SST 315', messageId: '<m4@x>', text: 'Still smells.' },
      { id: 'm5', threadId: 'v', date: NOW, from: 'news@spam.com', subject: 'Weekly deals', messageId: '<m5@x>', text: 'Buy' },
    )
    const r2 = await pollInbox(box, store, DIR, () => {})
    expect(r2.replies).toEqual(['RG-1001', 'RG-1001', 'RG-1001'])
    expect(labels.get('m5')).toContain(SKIPPED)

    await store.refresh()
    const after = (await store.list())[0]
    const [, airgas, moved, staff, unknown] = after.thread
    expect(airgas).toMatchObject({ kind: 'email', from: 'chris', text: "We'll swap it on tomorrow's truck.\n\nThanks,\nChris", ref: '<m2@x>' })
    expect(moved).toMatchObject({ kind: 'note', text: 'Chris replied · moved to In progress' })
    expect(after.status).toBe('progress')
    expect(staff).toMatchObject({ kind: 'email', from: 'israel', text: 'Thanks, lab is aware.' })
    expect(unknown).toMatchObject({ kind: 'note', text: 'Email from Lab person: Still smells.' })
    expect(after.etaSuggestion?.date).toBe('2026-11-16') // Friday's "tomorrow" → Monday

    // Labels lost (or a crash before labelling): a re-run must not duplicate anything.
    labels.clear()
    const r3 = await pollInbox(box, store, DIR, () => {})
    expect(r3).toMatchObject({ created: [], replies: [], duplicates: 4 })
  })
})

describe('"Is it fixed?" replies', () => {
  it('closes on YES, and on NO reopens and queues a note to Airgas', async () => {
    const store = new GitHubStore(fakeGitHub().api(), () => NOW)
    const mails: Mail[] = [reportMail('a', new Date(NOW.getTime() - 7200_000)), reportMail('b', new Date(NOW.getTime() - 3600_000))]
    const { box } = fakeMail(mails)
    await pollInbox(box, store, DIR, () => {})
    const ask = (id: string, n: number, text: string): Mail =>
      ({ id, threadId: id, date: NOW, from: 'Wei <staff@example.com>', subject: `Re: [RG-${n}] Is it fixed? Reply YES or NO`, messageId: `<${id}@x>`, text })
    mails.push(
      ask('y', 1001, 'Yes, all good now.\n\nOn Fri, Nov 13 Tracker wrote:\n> Is it fixed?'),
      ask('n', 1002, 'no - still hissing'),
    )
    const r = await pollInbox(box, store, DIR, () => {})
    expect(r.answers).toEqual(['RG-1001 YES', 'RG-1002 NO'])
    const [b, a] = await store.list()
    expect(a).toMatchObject({ id: 'RG-1001', status: 'done', confirm: 'yes' })
    expect(b).toMatchObject({ id: 'RG-1002', status: 'progress', confirm: 'no' })
    const toAirgas = b.thread.find(e => e.kind === 'auto' && e.text.includes('still not fixed'))
    expect(toAirgas?.ref).toBeUndefined() // so the mailer sends it
    expect(b.thread.find(e => e.kind === 'confirm')?.ref).toBe('<n@x>')
  })
})

describe('email parsing', () => {
  it('reads YES / NO answers', () => {
    expect(fixAnswer('Yes!')).toBe(true)
    expect(fixAnswer('  fixed, thanks')).toBe(true)
    expect(fixAnswer('No, still empty')).toBe(false)
    expect(fixAnswer('Not yet')).toBe(false)
    expect(fixAnswer('I think so?')).toBeNull()
  })

  it('strips Gmail, Outlook and quote-line replies', () => {
    expect(stripQuoted('Yes.\n\nOn Thu, Nov 12, 2026 at 3:01 PM Someone <a@b.c>\nwrote:\n> old')).toBe('Yes.')
    expect(stripQuoted('OK\r\n-----Original Message-----\r\nFrom: x')).toBe('OK')
    expect(stripQuoted('Line one\n> quoted\nLine two\n-- \nSig')).toBe('Line one\nLine two')
  })

  it('reads names and addresses from From headers', () => {
    expect(parseAddress('"Chen, Wei" <WC@Rice.edu>')).toEqual({ name: 'Chen, Wei', address: 'wc@rice.edu' })
    expect(parseAddress('wc@rice.edu')).toEqual({ name: '', address: 'wc@rice.edu' })
  })

  it('picks the person from a sign-off, or a default', async () => {
    const gh = fakeGitHub()
    const t = await new GitHubStore(gh.api(), () => NOW).create(REPORT)
    expect(identify('a <airgas@example.com>', 'ok', t, DIR)).toEqual({ kind: 'airgas', who: 'ruben' })
    expect(identify('a <airgas@example.com>', 'ok\n— Gordan', t, DIR)).toEqual({ kind: 'airgas', who: 'gordan' })
    expect(identify('s <staff@example.com>', 'ok\nJavier', t, DIR)).toEqual({ kind: 'staff', who: 'javier' })
  })
})
