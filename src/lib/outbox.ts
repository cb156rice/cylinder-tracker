// Which thread entries still need to be emailed, shared by the mailer job and the dashboard
// ("Sending…" under a message). Pure, so it's unit-tested.
//
// Sent = there's a note on the same ticket whose ref is `sent:<key>` (the mailer adds it after Gmail accepts
// the message). The thread is append-only, so nothing is ever edited to mark it sent.
import { person } from './directory'
import type { ThreadEntry, Ticket } from './types'

/** Emails older than this are never sent (sample tickets, or a mailer that was off for days). */
export const SEND_WINDOW_MS = 24 * 3600_000

/** Stable key for an entry: time + kind + a short hash of the text. */
export function entryKey(e: ThreadEntry): string {
  let h = 5381
  for (let i = 0; i < e.text.length; i++) h = ((h * 33) ^ e.text.charCodeAt(i)) >>> 0
  return `${e.at}|${e.kind}|${h.toString(36)}`
}

/**
 * Entries the tracker has to send itself:
 *  - automatic messages (the opening email, follow-ups), and
 *  - emails Rice staff wrote in the dashboard.
 * Emails that came in through the inbox carry the email's Message-ID as `ref`; they were already delivered.
 */
export function needsSending(e: ThreadEntry): boolean {
  if (e.kind === 'auto') return !e.ref || e.ref.startsWith('report:')
  if (e.kind === 'email') return !e.ref && e.from !== 'tracker' && !person(e.from).airgas
  return false
}

export function sentKeys(t: Ticket): Set<string> {
  return new Set(t.thread.flatMap(e => (e.kind === 'note' && e.ref?.startsWith('sent:') ? [e.ref.slice(5)] : [])))
}

/** Entries waiting to go out, oldest first. */
export function unsent(t: Ticket, now: Date): ThreadEntry[] {
  const sent = sentKeys(t)
  return t.thread.filter(e => needsSending(e) && !sent.has(entryKey(e)) && now.getTime() - new Date(e.at).getTime() < SEND_WINDOW_MS)
}

/** Message-IDs on this ticket's email thread, oldest first, for In-Reply-To/References. */
export function threadMessageIds(t: Ticket): string[] {
  return t.thread.flatMap(e => {
    if (e.kind === 'note' && e.messageId) return [e.messageId]
    if (e.kind === 'email' && e.ref?.startsWith('<')) return [e.ref]
    return []
  })
}
