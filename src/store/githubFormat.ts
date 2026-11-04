// How a ticket is stored in GitHub Issues (private data repo). The Actions jobs in Phase 3
// read and write this same format, so change it carefully (bump FORMAT_VERSION).
//
//   Issue #48            → ticket RG-1048 (the ID comes from the issue number, so it's always unique)
//   Issue title          → "[RG-1048] Leak · SST 312"
//   Issue body           → readable summary + a ```json block with the ticket fields (no thread)
//   Each comment         → one thread entry: a hidden marker with the entry as JSON, then readable text
//   Labels               → status:…, building:…, coordinator:… (for filtering on github.com)
//
// Thread entries are append-only comments, so the mail poller and a person in the dashboard can
// add messages at the same time without overwriting each other.
import { CATEGORY_LABEL, PEOPLE, STATUS_LABEL, authorName, locationLabel, openingSubject } from '../lib/rules'
import type { ThreadEntry, Ticket } from '../lib/types'

export const FORMAT_VERSION = 1
export const ID_OFFSET = 1000
const BODY_MARKER = `<!-- cylinder-tracker:ticket v${FORMAT_VERSION} -->`
const ENTRY_PREFIX = '<!-- cylinder-tracker:entry '

export const ticketId = (issueNumber: number) => `RG-${ID_OFFSET + issueNumber}`
export const issueNumber = (id: string) => Number(id.replace(/\D/g, '')) - ID_OFFSET

/** Ticket fields kept in the issue body: everything except the id (from the issue number) and the thread. */
export type TicketFields = Omit<Ticket, 'id' | 'thread'>

export function issueTitle(t: Ticket): string {
  return openingSubject(t)
}

export function issueLabels(t: Ticket): string[] {
  return [`status:${t.status}`, `building:${t.building}`, `coordinator:${t.coordinator}`]
}

export function renderBody(t: Ticket): string {
  const { id: _id, thread: _thread, ...fields } = t
  const summary = [
    `**${CATEGORY_LABEL[t.category]} · ${locationLabel(t)}** · order \`${t.order}\``,
    '',
    `Reported by ${t.reporter.name} (${t.reporter.email}${t.reporter.phone ? ', ' + t.reporter.phone : ''})`,
    `Status: ${STATUS_LABEL[t.status]} · Coordinator: ${PEOPLE[t.coordinator].name}${t.eta ? ` · ETA ${t.eta}` : ''}`,
    '',
    `> ${t.description.replace(/\n/g, '\n> ')}`,
  ].join('\n')
  return `${BODY_MARKER}\n${summary}\n\n<details><summary>Tracker data (don't edit)</summary>\n\n\`\`\`json\n${JSON.stringify(fields, null, 2)}\n\`\`\`\n</details>\n`
}

export function parseBody(body: string): TicketFields | null {
  if (!body.includes('<!-- cylinder-tracker:ticket')) return null
  const m = /```json\n([\s\S]*?)\n```/.exec(body)
  if (!m) return null
  try {
    return JSON.parse(m[1]) as TicketFields
  } catch {
    return null
  }
}

export function renderComment(e: ThreadEntry, t: Ticket): string {
  // Escape "--" so the JSON can't end the HTML comment early.
  const json = JSON.stringify(e).replace(/--/g, '-\\u002d')
  const who = e.kind === 'note' ? 'Note' : `**${authorName(e, t)}**`
  const kind = { email: 'email', auto: 'sent automatically', call: 'call', visit: 'visit', confirm: 'delivery confirmation', note: '' }[e.kind]
  const head = e.kind === 'note' ? `_${e.text}_` : `${who}${kind ? ` · ${kind}` : ''}\n\n${e.text}`
  return `${ENTRY_PREFIX}${json} -->\n${head}`
}

export function parseComment(body: string): ThreadEntry | null {
  if (!body.startsWith(ENTRY_PREFIX)) return null
  const end = body.indexOf(' -->')
  if (end < 0) return null
  try {
    return JSON.parse(body.slice(ENTRY_PREFIX.length, end)) as ThreadEntry
  } catch {
    return null
  }
}
