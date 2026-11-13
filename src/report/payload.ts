// The report data carried inside the EmailJS email. Shared by the browser form and the mail poller (no browser-only imports here).
import type { ReportInput } from '../lib/types'

/**
 * What the mail poller reads back out of the report email, between ---DATA--- and ---END---.
 * Bump `v` if the shape changes; the poller must handle every version still in the mailbox.
 */
export interface ReportPayload {
  v: 1
  kind: 'report'
  /** Random id so the poller can skip a report it has already turned into a ticket. */
  submissionId: string
  submittedAt: string
  report: ReportInput
}

export function makePayload(input: ReportInput, now: Date = new Date(), submissionId: string = crypto.randomUUID()): ReportPayload {
  const report = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as unknown as ReportInput
  return { v: 1, kind: 'report', submissionId, submittedAt: now.toISOString(), report }
}

/** UTF-8 safe base64 (names like "José" or "O'Connor" survive the round trip). */
export function encodePayload(p: ReportPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function decodePayload(b64: string): ReportPayload {
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as ReportPayload
}
