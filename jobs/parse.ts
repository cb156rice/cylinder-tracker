// Pure helpers for turning raw emails into tracker events. No network here, so it's all unit-tested.
import { decodePayload, type ReportPayload } from '../src/report/payload'
import type { AirgasContact, RiceStaff, Ticket } from '../src/lib/types'

/** "Wei Chen <cb156@rice.edu>" → { name: 'Wei Chen', address: 'cb156@rice.edu' } */
export function parseAddress(header: string): { name: string; address: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(header)
  if (m) return { name: m[1].trim(), address: m[2].trim().toLowerCase() }
  return { name: '', address: header.trim().toLowerCase() }
}

export function ticketNumberInSubject(subject: string): number | null {
  const m = /\[RG-(\d+)\]/i.exec(subject)
  return m ? Number(m[1]) : null
}

/** A reply to the "Is it fixed?" email: its subject keeps that question. */
export const isCheckInReply = (subject: string) => /Is it fixed\?/i.test(subject)

/** YES → true, NO → false, anything else → null. Only the first words count (the rest is quoted text or a note). */
export function fixAnswer(text: string): boolean | null {
  const first = text.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase()
  if (/^(yes|yep|yeah|y|fixed)\b/.test(first)) return true
  if (/^(no|nope|n|not)\b/.test(first)) return false
  return null
}

/** The report payload from an EmailJS "[NEW REPORT]" email, or null if this isn't one. */
export function reportFromEmail(subject: string, body: string): ReportPayload | null {
  if (!/\[NEW REPORT\]/i.test(subject)) return null
  const m = /---DATA---\s*([A-Za-z0-9+/=\s]+?)\s*---END---/.exec(body)
  if (!m) return null
  try {
    const p = decodePayload(m[1])
    return p.kind === 'report' && p.v === 1 ? p : null
  } catch {
    return null
  }
}

/**
 * Keeps only the new part of a reply: drops the quoted earlier messages that Gmail, Outlook
 * (Rice) and Apple Mail append, plus "> " quote lines and a "-- " signature block.
 */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const cut = [
    /^On .+wrote:\s*$/i, // Gmail / Apple Mail (one line)
    /^-{2,}\s*Original Message\s*-{2,}/i, // Outlook classic
    /^_{10,}\s*$/, // Outlook web separator line
    /^From:\s.+/i, // Outlook header block of the quoted message
    /^-- $/, // signature delimiter
    /^Sent from my (iPhone|iPad|Android)/i,
  ]
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    // Gmail sometimes wraps "On <date>, <name> <addr>" onto two lines before "wrote:".
    if (/^On .+/i.test(l) && /wrote:\s*$/i.test(lines[i + 1] ?? '') && !/wrote:\s*$/i.test(l)) break
    if (cut.some(r => r.test(l))) break
    if (/^\s*>/.test(l)) continue
    out.push(l)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Crude HTML → text for emails with no plain-text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '') // quoted replies
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
}

/** Who sends from which address. In demo mode one address stands in for several people. */
export interface Directory {
  airgas: string[]
  staff: string[]
}

export type Speaker =
  | { kind: 'airgas'; who: AirgasContact }
  | { kind: 'staff'; who: RiceStaff }
  | { kind: 'unknown'; name: string; address: string }

const AIRGAS_NAMES: [RegExp, AirgasContact][] = [[/\bchris\b/i, 'chris'], [/\bgordan\b/i, 'gordan'], [/\bruben\b/i, 'ruben']]
const STAFF_NAMES: [RegExp, RiceStaff][] = [[/\bjavier\b/i, 'javier'], [/\bisrael\b/i, 'israel'], [/\brobert\b/i, 'robert']]

/** A sign-off name in the last few lines ("Thanks,\nChris") picks the person; otherwise a sensible default. */
function signedAs<T>(text: string, names: [RegExp, T][]): T | null {
  const tail = text.trim().split('\n').slice(-3).join('\n')
  for (const [r, who] of names) if (r.test(tail)) return who
  return null
}

export function identify(fromHeader: string, text: string, t: Ticket, dir: Directory): Speaker {
  const { name, address } = parseAddress(fromHeader)
  if (dir.airgas.includes(address)) {
    const who = signedAs(text, AIRGAS_NAMES) ?? (t.participants.includes('ruben') ? 'ruben' : 'gordan')
    return { kind: 'airgas', who }
  }
  if (dir.staff.includes(address)) return { kind: 'staff', who: signedAs(text, STAFF_NAMES) ?? t.coordinator }
  return { kind: 'unknown', name, address }
}

export function parseDirectory(env: Record<string, string | undefined>): Directory {
  const list = (v?: string) => (v ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return { airgas: list(env.AIRGAS_ADDRESSES), staff: list(env.STAFF_ADDRESSES) }
}
