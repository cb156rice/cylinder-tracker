import emailjs from '@emailjs/browser'
import { config } from '../config'
import { CATEGORY_LABEL, buildingLabel } from '../lib/rules'
import type { ReportInput } from '../lib/types'
import { encodePayload, makePayload, type ReportPayload } from './payload'

export type { ReportPayload } from './payload'

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
