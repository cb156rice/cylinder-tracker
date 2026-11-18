// Sends the thread messages the tracker owes: opening emails for new tickets and replies staff wrote
// in the dashboard. Runs right after the poller in the same job.
//
// Each email is multipart: a plain-text part and an HTML part, both from the templates in src/lib/emails.ts.
//
// DEMO MODE (the only mode for now): nobody real is emailed. Airgas people go to the first
// AIRGAS_ADDRESSES address, Rice staff and the reporter to the first STAFF_ADDRESSES address, and the
// email starts with a note naming the real recipients.
import { config } from '../src/config'
import { entryKey, threadMessageIds, unsent } from '../src/lib/outbox'
import { blocksFor, checkInSubject, renderHtml, renderText } from '../src/lib/emails'
import { PEOPLE, isCheckIn, openingSubject, recipients } from '../src/lib/rules'
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
  html: string
  inReplyTo: string | null
  references: string[]
  /** Who it would go to outside demo mode, for the note on the ticket. */
  wouldGoTo: string
  /** The "Is it fixed?" check-in: not part of the Airgas thread, so later emails don't thread onto it. */
  reporterOnly?: boolean
}

/** Pure: what to send for one entry. */
export function composeEmail(t: Ticket, e: ThreadEntry, dir: Directory): Outgoing {
  const r = recipients(t)
  const first = (t.reporter.name.split(' ')[0] || t.reporter.name).trim()
  const blocks = blocksFor(t, e)
  const eyebrow = `Rice Stockroom · Cylinder issue ${t.id}`

  if (isCheckIn(e)) {
    // Just the reporter, as its own email (not on the Airgas thread).
    const subject = checkInSubject(t)
    const demo = `In real use this goes to ${t.reporter.name} <${t.reporter.email}>.`
    return {
      to: [dir.staff[0]], cc: [], subject, inReplyTo: null, references: [], wouldGoTo: `${first} (reporter)`, reporterOnly: true,
      text: `[DEMO] ${demo}\n\n${renderText(blocks)}\n\n--\nTicket ${t.id} · Order ${t.order}`,
      html: renderHtml(blocks, { eyebrow, demo, footer: `Ticket ${t.id} · Order ${t.order}`, replyTo: { address: config.trackerAddress, subject } }),
    }
  }

  const wouldGoTo = `${r.to.map(p => PEOPLE[p].name).join(', ') || 'nobody at Airgas'} · cc ${[...r.cc.map(p => PEOPLE[p].name), `${first} (reporter)`].join(', ')}`
  const airgas = dir.airgas[0], staff = dir.staff[0]
  const to = r.to.length ? [airgas] : [staff]
  const cc = to.includes(staff) ? [] : [staff]

  const ids = threadMessageIds(t)
  const subject = ids.length ? `Re: ${openingSubject(t)}` : openingSubject(t)
  const demo = `In real use this goes to ${wouldGoTo}.`
  const footer = `Ticket ${t.id} · Order ${t.order}\nPlease reply all and keep [${t.id}] in the subject so your reply is added to the ticket.`
  return {
    to, cc, subject, inReplyTo: ids.at(-1) ?? null, references: ids, wouldGoTo,
    text: `[DEMO] ${demo}\n\n${renderText(blocks)}\n\n--\n${footer}`,
    html: renderHtml(blocks, { eyebrow, demo, footer }),
  }
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`)

/** Pure: the raw RFC 2822 message, multipart/alternative (plain text + HTML, both UTF-8, base64). */
export function toMime(m: Outgoing, from: string, messageId: string, date: Date): string {
  const boundary = `=_ct_${messageId.replace(/[^a-z0-9]/gi, '').slice(0, 24)}`
  const part = (type: string, body: string) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(body.replace(/\r?\n/g, '\r\n'))),
  ].join('\r\n')
  const lines = [
    `From: "Rice Stockroom" <${from}>`,
    `To: ${m.to.join(', ')}`,
    ...(m.cc.length ? [`Cc: ${m.cc.join(', ')}`] : []),
    `Subject: ${header(m.subject)}`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${messageId}`,
    ...(m.inReplyTo ? [`In-Reply-To: ${m.inReplyTo}`, `References: ${m.references.join(' ')}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    part('text/plain', m.text),
    part('text/html', m.html),
    `--${boundary}--`,
    '',
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
      const what = `${t.id} (${isCheckIn(e) ? 'fix check-in' : e.kind === 'auto' ? (e.followUp ? 'follow-up' : 'automatic') : PEOPLE[(e as { from: RiceStaff }).from].name})`
      try {
        const out = composeEmail(t, e, dir)
        const mid = `<${t.id.toLowerCase()}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}@cylinder-tracker>`
        const id = await mail.send(toMime(out, config.trackerAddress, mid, now))
        const messageId = (await mail.messageIdOf(id).catch(() => '')) || mid
        t = await store.update(t.id, (x, n) => ({
          ...x,
          thread: [...x.thread, { kind: 'note', at: n.toISOString(), text: `Emailed ${out.wouldGoTo}`, ref: `sent:${key}`, ...(out.reporterOnly ? {} : { messageId }) }],
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
