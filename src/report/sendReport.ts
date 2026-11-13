import emailjs from '@emailjs/browser'
import { config } from '../config'
import { CATEGORY_LABEL, buildingLabel } from '../lib/rules'
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

/** The EmailJS template variables (see the template in the EmailJS dashboard). */
export function templateParams(p: ReportPayload): Record<string, string> {
  const r = p.report
  return {
    name: r.name,
    email: r.email,
    phone: r.phone || '—',
    order: r.order || '—',
    building: r.building ? buildingLabel({ building: r.building, otherBuilding: r.otherBuilding }) : '—',
    room: r.room,
    category: r.category ? CATEGORY_LABEL[r.category] : '—',
    description: r.description,
    payload: encodePayload(p),
  }
}

/** Sends the report to the tracker mailbox. The poller turns it into a ticket. */
export async function sendReport(input: ReportInput): Promise<ReportPayload> {
  const p = makePayload(input)
  try {
    await emailjs.send(config.emailjs.serviceId, config.emailjs.templateId, templateParams(p), { publicKey: config.emailjs.publicKey })
  } catch (err) {
    const status = (err as { status?: number; text?: string })?.status
    const text = (err as { text?: string })?.text
    throw new Error(
      status
        ? `The report couldn't be sent (${status}${text ? `: ${text}` : ''}). Please try again, or email ${config.trackerAddress}.`
        : `The report couldn't be sent. Check your connection and try again, or email ${config.trackerAddress}.`,
    )
  }
  return p
}
