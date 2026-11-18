// Sends the thread messages the tracker owes: opening emails for new tickets and replies staff wrote
// in the dashboard. Runs right after the poller in the same job.
//
// DEMO MODE (the only mode for now): nobody real is emailed. Airgas people go to the first
// AIRGAS_ADDRESSES address, Rice staff and the reporter to the first STAFF_ADDRESSES address, and the
// email starts with a "would go to" line naming the real recipients.
import { config } from '../src/config'
import { entryKey, threadMessageIds, unsent } from '../src/lib/outbox'
import { PEOPLE, openingSubject, recipients } from '../src/lib/rules'
import type { RiceStaff, ThreadEntry, Ticket } from '../src/lib/types'
import type { GitHubStore } from '../src/store/githubStore'
import type { Directory } from './parse'

export interface MailSender {
  /** Sends an RFC 2822 message; returns the Gmail id of the sent message. */
  send(raw: string): Promise<string>
  /** The Message-ID header Gmail gave the sent message. */
  messageIdOf(id: string): Promise<string>
}

export interface Outgoing {
  to: string[]
  cc: string[]
  subject: string
  text: string
  inReplyTo: string | null
  references: string[]
  /** Who it would go to outside demo mode, for the note on the ticket. */
  wouldGoTo: string
}

/** Pure: what to send for one entry. */
export function composeEmail(t: Ticket, e: ThreadEntry, dir: Directory): Outgoing {
  const r = recipients(t)
  const first = (t.reporter.name.split(' ')[0] || t.reporter.name).trim()
  const wouldGoTo = `${r.to.map(p => PEOPLE[p].name).join(', ') || 'nobody at Airgas'} · cc ${[...r.cc.map(p => PEOPLE[p].name), `${first} (reporter)`].join(', ')}`

  const airgas = dir.airgas[0], staff = dir.staff[0]
  const to = r.to.length ? [airgas] : [staff]
  const cc = to.includes(staff) ? [] : [staff]

  const ids = threadMessageIds(t)
  const subject = ids.length ? `Re: ${openingSubject(t)}` : openingSubject(t)

  const sign = e.kind === 'email' ? `\n\n${PEOPLE[e.from].name}\n${PEOPLE[e.from as RiceStaff].role.replace('Rice · ', 'Rice University, ')}` : ''
  const text = [
    `[DEMO] In real use this would go to: ${wouldGoTo}`,
    '',
    e.text + sign,
    '',
    '--',
    `Rice Stockroom cylinder tracker · ticket ${t.id}`,
    `Please reply all and keep [${t.id}] in the subject so your reply is added to the ticket.`,
  ].join('\n')

  return { to, cc, subject, text, inReplyTo: ids.at(-1) ?? null, references: ids, wouldGoTo }
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`)

/** Pure: the raw RFC 2822 message (plain text, UTF-8, base64 body). */
export function toMime(m: Outgoing, from: string, messageId: string, date: Date): string {
  const lines = [
    `From: "Rice Stockroom" <${from}>`,
    `To: ${m.to.join(', ')}`,
    ...(m.cc.length ? [`Cc: ${m.cc.join(', ')}`] : []),
    `Subject: ${header(m.subject)}`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${messageId}`,
    ...(m.inReplyTo ? [`In-Reply-To: ${m.inReplyTo}`, `References: ${m.references.join(' ')}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(m.text.replace(/\r?\n/g, '\r\n')).replace(/(.{76})/g, '$1\r\n'),
  ]
  return lines.join('\r\n')
}

export interface MailResult { sent: string[]; failed: string[] }

export async function sendOutbox(mail: MailSender, store: GitHubStore, dir: Directory, now: Date, log: (s: string) => void = console.log): Promise<MailResult> {
  const result: MailResult = { sent: [], failed: [] }
  if (!dir.airgas.length || !dir.staff.length) {
    log('Mailer off: AIRGAS_ADDRESSES and STAFF_ADDRESSES must both be set (demo mode only sends to those).')
    return result
  }
  for (const t0 of await store.list()) {
    // `t` moves forward after each send, so the next email threads onto the previous one's Message-ID.
    let t = t0
    for (const e of unsent(t0, now)) {
      const key = entryKey(e)
      const what = `${t.id} (${e.kind === 'auto' ? 'automatic' : PEOPLE[(e as { from: RiceStaff }).from].name})`
      try {
        const out = composeEmail(t, e, dir)
        const mid = `<${t.id.toLowerCase()}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}@cylinder-tracker>`
        const id = await mail.send(toMime(out, config.trackerAddress, mid, now))
        const messageId = (await mail.messageIdOf(id).catch(() => '')) || mid
        t = await store.update(t.id, (x, n) => ({
          ...x,
          thread: [...x.thread, { kind: 'note', at: n.toISOString(), text: `Emailed ${out.wouldGoTo}`, ref: `sent:${key}`, messageId }],
        }))
        result.sent.push(what)
        log(`  ✉ ${what} sent`)
      } catch (err) {
        result.failed.push(what)
        log(`  ! could not send ${what}: ${(err as Error).message}`)
      }
    }
  }
  return result
}
