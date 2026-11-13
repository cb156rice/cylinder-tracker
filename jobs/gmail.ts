// Minimal Gmail REST client for the tracker mailbox (scope gmail.modify, OAuth refresh token).
import { htmlToText } from './parse'

interface Part { mimeType: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] }
interface RawMessage { id: string; threadId: string; internalDate: string; labelIds?: string[]; payload: Part }

export interface Mail {
  id: string
  threadId: string
  date: Date
  from: string
  subject: string
  messageId: string
  text: string
}

export class Gmail {
  private token = ''
  private readonly creds: { clientId: string; clientSecret: string; refreshToken: string }
  constructor(creds: { clientId: string; clientSecret: string; refreshToken: string }) { this.creds = creds }

  private async auth() {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.creds.clientId, client_secret: this.creds.clientSecret,
        refresh_token: this.creds.refreshToken, grant_type: 'refresh_token',
      }),
    })
    const j = await res.json() as { access_token?: string; error?: string; error_description?: string }
    if (!j.access_token) {
      throw new Error(`Gmail sign-in failed (${j.error}: ${j.error_description}). If it says invalid_grant, re-run scripts/get-gmail-token.mjs and update GMAIL_REFRESH_TOKEN.`)
    }
    this.token = j.access_token
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.token) await this.auth()
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`Gmail ${method} ${path.split('?')[0]} → ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  }

  /** Message ids matching a Gmail search, newest first (Gmail's order). */
  async search(q: string, max = 100): Promise<string[]> {
    const r = await this.call<{ messages?: { id: string }[] }>('GET', `/messages?maxResults=${max}&q=${encodeURIComponent(q)}`)
    return (r.messages ?? []).map(m => m.id)
  }

  async get(id: string): Promise<Mail> {
    const m = await this.call<RawMessage>('GET', `/messages/${id}?format=full`)
    const h = (name: string) => m.payload.headers?.find(x => x.name.toLowerCase() === name.toLowerCase())?.value ?? ''
    return {
      id: m.id, threadId: m.threadId, date: new Date(Number(m.internalDate)),
      from: h('From'), subject: h('Subject'), messageId: h('Message-ID') || `gmail:${m.id}`,
      text: bodyText(m.payload),
    }
  }

  /** Finds or creates a label like "tracker/processed"; returns its id. */
  async label(name: string): Promise<string> {
    const { labels } = await this.call<{ labels: { id: string; name: string }[] }>('GET', '/labels')
    const found = labels.find(l => l.name === name)
    if (found) return found.id
    return (await this.call<{ id: string }>('POST', '/labels', { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })).id
  }

  async addLabel(id: string, labelId: string) {
    await this.call('POST', `/messages/${id}/modify`, { addLabelIds: [labelId] })
  }
}

const b64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

function find(p: Part, type: string): Part | null {
  if (p.mimeType === type && p.body?.data) return p
  for (const c of p.parts ?? []) { const f = find(c, type); if (f) return f }
  return null
}

function bodyText(p: Part): string {
  const plain = find(p, 'text/plain')
  if (plain) return b64url(plain.body!.data!)
  const html = find(p, 'text/html')
  return html ? htmlToText(b64url(html.body!.data!)) : ''
}
