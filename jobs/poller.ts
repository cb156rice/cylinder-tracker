// Reads the tracker mailbox and turns emails into ticket changes in the GitHub data repo.
//   [NEW REPORT] email (EmailJS, from the public form) → new ticket
//   Reply with [RG-####] in the subject                → email on that ticket's thread (ETA detection included)
// Every entry carries a `ref` (submission id or Message-ID), so running twice never adds anything twice.
import { config } from '../src/config'
import { confirmDelivery, receiveEmail } from '../src/lib/transitions'
import type { ThreadEntry, Ticket } from '../src/lib/types'
import type { GitHubStore } from '../src/store/githubStore'
import type { Mail } from './gmail'
import { answerNote, fixAnswer, identify, isCheckInReply, reportFromEmail, stripQuoted, ticketNumberInSubject, type Directory } from './parse'

export interface MailBox {
  search(q: string): Promise<string[]>
  get(id: string): Promise<Mail>
  label(name: string): Promise<string>
  addLabel(id: string, labelId: string): Promise<void>
}

export const PROCESSED = 'tracker/processed'
export const SKIPPED = 'tracker/skipped'
const QUERY = `in:inbox -label:${PROCESSED} -label:${SKIPPED} newer_than:30d`

export interface PollResult { created: string[]; replies: string[]; answers: string[]; skipped: string[]; duplicates: number }

/** Tags the first entry this email added (the email or the answer itself, not the notes after it) with its Message-ID. */
const withRef = (before: Ticket, after: Ticket, ref: string): Ticket => {
  const thread = [...after.thread]
  const i = before.thread.length
  if (i < thread.length) thread[i] = { ...thread[i], ref } as ThreadEntry
  return { ...after, thread }
}

export async function pollInbox(mail: MailBox, store: GitHubStore, dir: Directory, log: (s: string) => void = console.log): Promise<PollResult> {
  const result: PollResult = { created: [], replies: [], answers: [], skipped: [], duplicates: 0 }
  const ids = await mail.search(QUERY)
  log(`${ids.length} new email(s) in the tracker inbox`)
  if (!ids.length) return result

  const mails = (await Promise.all(ids.map(id => mail.get(id)))).sort((a, b) => a.date.getTime() - b.date.getTime())
  const tickets = await store.list()
  const byId = new Map(tickets.map(t => [t.id, t]))
  const seen = new Set(tickets.flatMap(t => t.thread.map(e => e.ref).filter(Boolean)))
  const [processed, skipped] = await Promise.all([mail.label(PROCESSED), mail.label(SKIPPED)])

  for (const m of mails) {
    const what = `"${m.subject}" from ${m.from}`
    try {
      const report = reportFromEmail(m.subject, m.text)
      const n = ticketNumberInSubject(m.subject)

      if (report) {
        const ref = `report:${report.submissionId}`
        if (seen.has(ref)) { result.duplicates++ } else {
          const t = await store.create(report.report, { at: new Date(report.submittedAt), ref })
          byId.set(t.id, t); seen.add(ref)
          result.created.push(t.id)
          log(`  + ${t.id} created from ${what}`)
        }
      } else if (n !== null && byId.has(`RG-${n}`) && isCheckInReply(m.subject)) {
        // The reporter answering "Is it fixed?"
        const id = `RG-${n}`
        if (seen.has(m.messageId)) { result.duplicates++ } else {
          const text = stripQuoted(m.text) || '(empty message)'
          const fixed = fixAnswer(text)
          const t = await store.update(id, (t, _now) => fixed === null
            ? { ...t, thread: [...t.thread, { kind: 'note', at: m.date.toISOString(), text: `${t.reporter.name.split(' ')[0]} replied to "Is it fixed?" without a clear YES or NO: ${text}`, ref: m.messageId }] }
            : withRef(t, confirmDelivery(t, fixed, m.date, config.autoCloseOnConfirm, fixed ? '' : answerNote(text)), m.messageId))
          byId.set(id, t); seen.add(m.messageId)
          result.answers.push(`${id} ${fixed === null ? 'unclear' : fixed ? 'YES' : 'NO'}`)
          log(`  ✓ ${id}: reporter answered ${fixed === null ? '(unclear)' : fixed ? 'YES' : 'NO'}`)
        }
      } else if (n !== null && byId.has(`RG-${n}`)) {
        const id = `RG-${n}`
        if (seen.has(m.messageId)) { result.duplicates++ } else {
          const text = stripQuoted(m.text) || '(empty message)'
          const t = await store.update(id, (t, _now) => {
            const who = identify(m.from, text, t, dir)
            if (who.kind === 'unknown') {
              return { ...t, thread: [...t.thread, { kind: 'note', at: m.date.toISOString(), text: `Email from ${who.name || who.address}: ${text}`, ref: m.messageId }] }
            }
            return withRef(t, receiveEmail(t, who.who, text, m.date), m.messageId)
          })
          byId.set(id, t); seen.add(m.messageId)
          result.replies.push(id)
          log(`  ↩ ${id} reply added from ${what}`)
        }
      } else {
        await mail.addLabel(m.id, skipped)
        result.skipped.push(m.subject)
        log(`  · skipped ${what} (${n !== null ? `no ticket RG-${n}` : 'not a report or ticket reply'})`)
        continue
      }
      await mail.addLabel(m.id, processed)
    } catch (e) {
      // Leave it unlabelled so the next run retries it.
      log(`  ! failed on ${what}: ${(e as Error).message}`)
    }
  }
  return result
}
