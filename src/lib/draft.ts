// Email drafts. Phase 4 sends `draftPrompt` to Claude from a GitHub Action; until then (and as a
// fallback if Claude is unavailable) the dashboard fills in `templateDraft`.
import { CATEGORY_LABEL, PEOPLE, STATUS_LABEL, authorName, locationLabel } from './rules'
import { fmt, fmtDay } from './time'
import type { RiceStaff, Ticket } from './types'

export function templateDraft(t: Ticket, me: RiceStaff, escalating: boolean, notes: string): string {
  const greet = escalating ? 'Hi Chris,\n\nAdding you to this thread' : 'Hi Ruben and Gordan,\n\nFollowing up on this ticket'
  return `${greet} (${t.id}, order ${t.order}, ${locationLabel(t)}). ${notes.trim() || 'Could you share an ETA for a fix?'}\n\nThanks,\n${PEOPLE[me].name}\nRice Stockroom`
}

/** The system and user prompts from the prototype's draftAi(). */
export function draftPrompt(t: Ticket, me: RiceStaff, escalating: boolean, notes: string, now: Date): { system: string; user: string } {
  const thread = t.thread
    .filter(e => e.kind !== 'note')
    .map(e => `${authorName(e, t)} (${fmt(new Date(e.at))})${e.kind === 'call' || e.kind === 'visit' ? ` [${e.kind} log]` : ''}: ${e.text}`)
    .join('\n')
  const ask = escalating
    ? 'Write a short escalation email that adds Chris (Airgas regional manager) to this thread. Greet Chris, summarize the issue and what has happened so far in 2-3 sentences, and ask for a firm resolution date.'
    : notes.trim()
      ? `Turn these rough notes into the reply: "${notes.trim()}"`
      : 'Write the next reply on the thread. If Airgas has not replied, politely follow up and ask for an ETA. If they asked a question, answer with what is known or say we will check. If they gave a date, confirm it and thank them.'
  const p = PEOPLE[me]
  return {
    system: `You draft emails for ${p.name} (${p.role}) at Rice University to Airgas contacts on an existing reply-all thread: Ruben (account manager), Gordan (plant manager), Chris (regional manager). Plain text only, no subject line, 40-110 words. Friendly and direct, no filler. Address people by first name. End with "${p.name}\nRice Stockroom". Never invent facts, dates, or order numbers.`,
    user: `Ticket ${t.id}, order ${t.order}, ${locationLabel(t)}. Category: ${CATEGORY_LABEL[t.category]}. Reported by ${t.reporter.name}: "${t.description}". Status: ${STATUS_LABEL[t.status]}. ETA: ${t.eta ? fmtDay(t.eta) : 'none yet'}. Today is ${fmt(now)}.\n\nThread so far:\n${thread}\n\n${ask}`,
  }
}
