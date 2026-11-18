// Every email the tracker writes, built once as "blocks" and rendered two ways:
//   renderText → the plain-text part (also what the dashboard shows on the timeline)
//   renderHtml → the HTML part (table layout and inline styles, so Outlook and Gmail render it the same)
// Pure functions, unit-tested. Only function bodies use imports from ./rules (the two files import each other).
import { CATEGORY_LABEL, PEOPLE, airgasDate, buildingLabel, locationLabel, recipients } from './rules'
import { fmt, fmtDay, type DateKey } from './time'
import type { Category, ThreadEntry, Ticket } from './types'

export interface Choice { label: string; note: string; reply: string }

export interface EmailBlocks {
  greeting?: string
  paragraphs: string[]
  /** Quoted text (the reporter's description), shown as a block quote. */
  quote?: string
  /** Label/value rows about the ticket. */
  details?: [string, string][]
  /** One-word answers ("YES"/"NO") the reader can send back; buttons in HTML. */
  choices?: Choice[]
  /** Paragraph after the choices. */
  after?: string
  signoff: string[]
}

// ---- Small text helpers ----

const PROBLEM_PHRASE: Record<Category, string> = {
  leak: 'the leaking cylinder',
  notdelivered: 'the missed delivery',
  empty: 'the empty cylinder',
  other: 'the cylinder problem',
}
/** "the leaking cylinder in SST 315" */
export const problemPhrase = (t: Ticket) => `${PROBLEM_PHRASE[t.category]} in ${locationLabel(t)}`
/** "Wed, Nov 18" */
export const niceDay = (x: Date | DateKey) => fmtDay(x).replace(' ', ', ')
/** "Wed, Nov 18, 3:31 PM" */
const niceTime = (d: Date) => fmt(d).replace(' ', ', ')
const firstName = (name: string) => name.split(' ')[0] || name
const andList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const paragraphs = (text: string) => text.trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)

/** "Hi Ruben and Gordan," for whoever is on To. */
function airgasGreeting(t: Ticket): string {
  const names = recipients(t).to.map(p => PEOPLE[p].name)
  return `Hi ${names.length ? andList(names) : 'Airgas team'},`
}

/** The facts Airgas needs, as a table. */
export function ticketDetails(t: Ticket): [string, string][] {
  const contact = [t.reporter.name, t.reporter.email, t.reporter.phone].filter(Boolean).join(' · ')
  return [
    ['Problem', CATEGORY_LABEL[t.category]],
    ['Location', `${buildingLabel(t)}, room ${t.room}`],
    ['Order', t.order],
    ['Reported', niceTime(new Date(t.createdAt))],
    ['Contact', contact],
  ]
}

// ---- The emails ----

/** First email on the Airgas thread. */
export function openingBlocks(t: Ticket): EmailBlocks {
  return {
    greeting: airgasGreeting(t),
    paragraphs: [`A Rice lab reported a problem with an Airgas cylinder. Could you reply all with next steps and the date you expect it to be resolved?`],
    quote: t.description,
    details: ticketDetails(t),
    signoff: ['Thanks,', 'Rice Stockroom'],
  }
}

/** Sent when Airgas hasn't replied 12 business hours after the report. */
export function followUpBlocks(t: Ticket): EmailBlocks {
  return {
    greeting: airgasGreeting(t),
    paragraphs: [
      `Following up on ${problemPhrase(t)}, reported ${niceDay(new Date(t.createdAt))}. We haven't seen a reply yet.`,
      'Could you reply all with next steps and the date you expect it to be resolved?',
    ],
    details: ticketDetails(t),
    signoff: ['Thanks,', 'Rice Stockroom'],
  }
}

/** Sent to Airgas when the reporter answers NO to "Is it fixed?". */
export function notFixedBlocks(t: Ticket, note: string): EmailBlocks {
  return {
    greeting: airgasGreeting(t),
    paragraphs: [
      `${t.reporter.name}, who reported ${problemPhrase(t)}, says it is still not fixed.`,
      'Could you reply all with next steps and a new date?',
    ],
    ...(note ? { quote: note } : {}),
    details: ticketDetails(t),
    signoff: ['Thanks,', 'Rice Stockroom'],
  }
}

/** The "Is it fixed?" check-in, to the reporter only. */
export function checkInBlocks(t: Ticket): EmailBlocks {
  const date = airgasDate(t)
  return {
    greeting: `Hi ${firstName(t.reporter.name)},`,
    paragraphs: [
      `On ${niceDay(new Date(t.createdAt))} you reported ${problemPhrase(t)}:`,
    ],
    quote: t.description.length > 300 ? t.description.slice(0, 297).trimEnd() + '…' : t.description,
    after: `${date ? `Airgas said it would be taken care of by ${niceDay(date)}.` : 'Airgas was asked to take care of it within 2 business days.'} Is it fixed now?`,
    choices: [
      { label: "Yes, it's fixed", note: "We'll close the ticket.", reply: 'YES' },
      { label: 'No, still a problem', note: "We'll follow up with Airgas right away.", reply: 'NO' },
    ],
    signoff: ['Thanks,', 'Rice Stockroom'],
  }
}

/** An email a Rice staff member wrote in the dashboard: their words, then their name and role. */
export function staffBlocks(e: Extract<ThreadEntry, { kind: 'email' }>): EmailBlocks {
  const p = PEOPLE[e.from]
  const paras = paragraphs(e.text)
  // A closing like "Thanks," joins the signature instead of floating as its own paragraph.
  const closing = paras.length > 1 && /^(thanks|thank you|best|regards|best regards|cheers)[,!.]?$/i.test(paras.at(-1)!) ? [paras.pop()!] : []
  return { paragraphs: paras, signoff: [...closing, p.name, p.role.replace(/^Rice · (.*)$/, (_m, r: string) => `${r[0].toUpperCase()}${r.slice(1)} · Rice University`)] }
}

export const checkInSubject = (t: Ticket) => `[${t.id}] Quick check: is ${problemPhrase(t)} fixed?`

// Plain text stored on the timeline when these are queued.
export const openingEmailText = (t: Ticket) => renderText(openingBlocks(t))
export const followUpText = (t: Ticket) => renderText(followUpBlocks(t))
export const checkInText = (t: Ticket) => renderText(checkInBlocks(t))
export const notFixedText = (t: Ticket, note: string) => renderText(notFixedBlocks(t, note))

/** The blocks for any entry the mailer sends. */
export function blocksFor(t: Ticket, e: ThreadEntry): EmailBlocks {
  if (e.kind === 'email') return staffBlocks(e)
  if (e.kind === 'auto') {
    if (e.audience === 'reporter') return checkInBlocks(t)
    if (e.followUp) return followUpBlocks(t)
    if (e === t.thread[0]) return openingBlocks(t)
  }
  // Anything else automatic (e.g. "still not fixed"): its stored text as-is.
  return { paragraphs: paragraphs(e.text), signoff: [] }
}

// ---- Rendering ----

export function renderText(b: EmailBlocks): string {
  const out: string[] = []
  if (b.greeting) out.push(b.greeting, '')
  for (const p of b.paragraphs) out.push(p, '')
  if (b.quote) out.push(`"${b.quote.trim()}"`, '')
  if (b.details) {
    const w = Math.max(...b.details.map(([k]) => k.length)) + 2
    for (const [k, v] of b.details) out.push(`  ${(k + ':').padEnd(w)}${v}`)
    out.push('')
  }
  if (b.after) out.push(b.after, '')
  if (b.choices) {
    out.push('Just reply to this email with one word:', '')
    const w = Math.max(...b.choices.map(c => c.reply.length)) + 2
    for (const c of b.choices) out.push(`  ${c.reply.padEnd(w)}${c.label.replace(/^(Yes|No), /, '').replace(/^./, s => s.toUpperCase())}. ${c.note}`)
    out.push('')
  }
  out.push(...b.signoff)
  return out.join('\n').trim()
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const br = (s: string) => esc(s).replace(/\n/g, '<br>')

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const C = { navy: '#00205B', ink: '#16191F', body: '#2B2F36', muted: '#5D6168', faint: '#7C7E7F', line: '#E3E4E0', soft: '#F4F4F1' }

export interface HtmlOptions {
  /** Small label above the content: "Rice Stockroom · Cylinder issue RG-1010". */
  eyebrow: string
  /** Gray text under the card. */
  footer: string
  /** Demo-mode note shown above the card. */
  demo?: string
  /** For choices: where a button's email goes, and its subject. */
  replyTo?: { address: string; subject: string }
}

export function renderHtml(b: EmailBlocks, o: HtmlOptions): string {
  const p = (inner: string, extra = '') => `<p style="margin:0 0 16px;${extra}">${inner}</p>`
  const parts: string[] = []
  parts.push(`<div style="font-size:12px;line-height:1.4;letter-spacing:.06em;text-transform:uppercase;font-weight:600;color:${C.faint};margin:0 0 20px;">${esc(o.eyebrow)}</div>`)
  if (b.greeting) parts.push(p(esc(b.greeting)))
  for (const x of b.paragraphs) parts.push(p(br(x)))
  if (b.quote) {
    parts.push(`<div style="margin:0 0 20px;padding:2px 0 2px 14px;border-left:3px solid ${C.line};color:${C.body};">${br(b.quote.trim())}</div>`)
  }
  if (b.details) {
    const rows = b.details.map(([k, v], i) =>
      `<tr><td style="padding:9px 12px 9px 0;width:92px;vertical-align:top;color:${C.faint};font-size:13px;${i ? `border-top:1px solid ${C.line};` : ''}">${esc(k)}</td>` +
      `<td style="padding:9px 0;vertical-align:top;color:${C.ink};font-size:14px;${i ? `border-top:1px solid ${C.line};` : ''}">${esc(v)}</td></tr>`).join('')
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px;">${rows}</table>`)
  }
  if (b.after) parts.push(p(br(b.after)))
  if (b.choices) {
    const href = (reply: string) => o.replyTo
      ? `mailto:${o.replyTo.address}?subject=${encodeURIComponent(`Re: ${o.replyTo.subject}`)}&body=${encodeURIComponent(reply)}`
      : '#'
    const buttons = b.choices.map((c, i) => {
      const primary = i === 0
      return `<td style="padding:0 10px 10px 0;"><a href="${esc(href(c.reply))}" style="display:inline-block;padding:11px 18px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;${primary ? `background:${C.navy};color:#ffffff;border:1px solid ${C.navy};` : `background:#ffffff;color:${C.navy};border:1px solid ${C.navy};`}">${esc(c.label)}</a></td>`
    }).join('')
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 6px;"><tr>${buttons}</tr></table>`)
    const notes = b.choices.map(c => `<strong>${esc(c.reply)}</strong>: ${esc(c.note)}`).join('<br>')
    parts.push(p(`Or just reply to this email with <strong>${b.choices.map(c => esc(c.reply)).join('</strong> or <strong>')}</strong>.<br>${notes}`, `font-size:13px;color:${C.muted};`))
  }
  if (b.signoff.length) parts.push(`<p style="margin:8px 0 0;">${b.signoff.map(esc).join('<br>')}</p>`)

  const demo = o.demo
    ? `<tr><td style="padding:0 0 12px;"><div style="padding:10px 14px;border:1px dashed #CFD2D6;border-radius:6px;background:#FAFAF8;font-size:12.5px;line-height:1.45;color:${C.muted};"><strong style="color:${C.body};">Demo.</strong> ${esc(o.demo)}</div></td></tr>`
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"></head>` +
    `<body style="margin:0;padding:0;background:${C.soft};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;font-family:${FONT};">` +
    demo +
    `<tr><td style="background:#ffffff;border:1px solid ${C.line};border-radius:8px;padding:28px 28px 26px;font-size:15px;line-height:1.55;color:${C.ink};">${parts.join('')}</td></tr>` +
    `<tr><td style="padding:14px 4px 0;font-size:12px;line-height:1.5;color:${C.faint};">${br(o.footer)}</td></tr>` +
    `</table></td></tr></table></body></html>`
}
