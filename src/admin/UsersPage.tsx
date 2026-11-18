import { useState, type FormEvent } from 'react'
import {
  activePeople, isEmail, newId, usesOf, type Org, type Person, type Settings,
} from '../lib/directory'
import type { Building } from '../lib/types'
import { useSettings, useStore } from '../store/hooks'
import { useSaveSettings } from './useSaveSettings'

const BUILDING_NAME: Record<Building, string> = { sst: 'SST', oconnor: "O'Connor", other: 'other buildings' }
const GITHUB_NAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

/** People who can appear on tickets: Rice staff and Airgas contacts, with their email and dashboard access. */
export function UsersPage() {
  const settings = useSettings()
  const { save } = useSaveSettings()
  const live = useStore().mode === 'github'
  const [editing, setEditing] = useState<string | null>(null) // a person id, or "new:rice" / "new:airgas"

  return (
    <main className="admin-body settings">
      <p className="settings__intro">
        Everyone who can be on a ticket. Rice staff can use the dashboard; Airgas contacts only get emails.
        {live ? ' Anyone connected to the dashboard can change these for now; the login page will limit that later.' : ' This is the browser demo: changes stay in this browser.'}
      </p>
      {(['rice', 'airgas'] as Org[]).map(org => (
        <section key={org} className="card settings__card">
          <div className="settings__head">
            <div className="stack" style={{ gap: 2 }}>
              <h2 className="h2">{org === 'rice' ? 'Rice staff' : 'Airgas contacts'}</h2>
              <span className="muted" style={{ fontSize: 13 }}>
                {org === 'rice' ? 'Building leads, the supervisor and anyone else who handles tickets.' : 'The people Airgas tickets are emailed to.'}
              </span>
            </div>
            <button className="btn btn--sm" onClick={() => setEditing(`new:${org}`)} disabled={editing !== null}>Add person</button>
          </div>
          <div className="people">
            {activePeople(org).map(p => editing === p.id
              ? <PersonForm key={p.id} org={org} person={p} settings={settings} onDone={() => setEditing(null)} save={save} />
              : <PersonRow key={p.id} p={p} settings={settings} onEdit={() => setEditing(p.id)} disabled={editing !== null} />)}
            {editing === `new:${org}` && <PersonForm org={org} settings={settings} onDone={() => setEditing(null)} save={save} />}
            {activePeople(org).length === 0 && editing !== `new:${org}` && <div className="people__empty">Nobody yet.</div>}
          </div>
        </section>
      ))}
    </main>
  )
}

/** What this person does, in plain words ("Leads SST · Copied on every email"). */
function rolesOf(p: Person, s: Settings): string[] {
  const out: string[] = []
  for (const [b, lead] of Object.entries(s.leads) as [Building, string][]) if (lead === p.id) out.push(`Leads ${BUILDING_NAME[b]}`)
  if (s.alwaysCopied.includes(p.id)) out.push('Copied on every email')
  if (s.newTicketContacts.includes(p.id)) out.push('Gets new tickets')
  if (s.escalationContact === p.id) out.push('Escalation contact')
  return out
}

function PersonRow({ p, settings, onEdit, disabled }: { p: Person; settings: Settings; onEdit: () => void; disabled: boolean }) {
  const roles = rolesOf(p, settings)
  return (
    <div className="person">
      <div className="stack">
        <span className="strong">{p.name} <span className="muted" style={{ fontWeight: 400 }}>· {p.title || 'no title'}</span></span>
        {roles.length > 0 && <span className="muted" style={{ fontSize: 12.5 }}>{roles.join(' · ')}</span>}
      </div>
      <span className={p.email ? '' : 'faint'}>{p.email || 'No email yet'}</span>
      {p.org === 'rice'
        ? <span className={p.github ? 'mono' : 'faint'} title="GitHub username, for dashboard access">{p.github ? `@${p.github}` : 'No dashboard access'}</span>
        : <span />}
      <button className="link-btn" onClick={onEdit} disabled={disabled}>Edit</button>
    </div>
  )
}

function PersonForm({ org, person: p, settings, onDone, save }: {
  org: Org; person?: Person; settings: Settings; onDone: () => void; save: (s: Settings) => Promise<boolean>
}) {
  const [name, setName] = useState(p?.name ?? '')
  const [title, setTitle] = useState(p?.title ?? '')
  const [email, setEmail] = useState(p?.email ?? '')
  const [github, setGithub] = useState(p?.github ?? '')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removeBlock, setRemoveBlock] = useState('')

  const errors = {
    name: name.trim() ? '' : 'Enter a name',
    email: !email.trim() || isEmail(email) ? '' : 'Enter a valid email address',
    github: !github.trim() || GITHUB_NAME.test(github.trim().replace(/^@/, '')) ? '' : 'Enter a GitHub username (letters, numbers and dashes)',
  }
  const valid = !errors.name && !errors.email && !errors.github

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!valid) return
    const fields = { name: name.trim(), title: title.trim(), email: email.trim(), github: org === 'rice' ? github.trim().replace(/^@/, '') : '' }
    const people = p
      ? settings.people.map(x => (x.id === p.id ? { ...x, ...fields } : x))
      : [...settings.people, { id: newId(fields.name, settings), org, ...fields }]
    setBusy(true)
    if (await save({ ...settings, people })) onDone()
    setBusy(false)
  }

  async function remove() {
    if (!p) return
    const uses = usesOf(p.id, settings)
    if (uses.length) {
      setRemoveBlock(`${p.name} ${uses.join(' and ')}. Pick someone else on the Settings page first.`)
      return
    }
    if (!confirm(`Remove ${p.name}? They stop getting emails. Their name stays on old tickets.`)) return
    setBusy(true)
    const next: Settings = {
      ...settings,
      people: settings.people.map(x => (x.id === p.id ? { ...x, removed: true } : x)),
      alwaysCopied: settings.alwaysCopied.filter(id => id !== p.id),
      newTicketContacts: settings.newTicketContacts.filter(id => id !== p.id),
    }
    if (await save(next)) onDone()
    setBusy(false)
  }

  const err = (k: keyof typeof errors) => tried && errors[k] ? <span className="field__error">{errors[k]}</span> : null
  return (
    <form className="person-form" onSubmit={submit} noValidate>
      <div className="person-form__grid">
        <label className="field">Name
          <input className="input input--sm" value={name} onChange={e => setName(e.target.value)} autoFocus aria-invalid={tried && !!errors.name} />
          {err('name')}
        </label>
        <label className="field">Title
          <input className="input input--sm" value={title} onChange={e => setTitle(e.target.value)} placeholder={org === 'rice' ? 'SST stockroom' : 'account manager'} />
        </label>
        <label className="field">Email
          <input className="input input--sm" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" aria-invalid={tried && !!errors.email} />
          {err('email')}
        </label>
        {org === 'rice' && (
          <label className="field">GitHub username <span className="faint" style={{ fontWeight: 400 }}>(for dashboard access)</span>
            <input className="input input--sm mono" value={github} onChange={e => setGithub(e.target.value)} placeholder="optional" aria-invalid={tried && !!errors.github} />
            {err('github')}
          </label>
        )}
      </div>
      {removeBlock && <div className="composer__esc">{removeBlock}</div>}
      <div className="row-between" style={{ alignItems: 'center' }}>
        {p ? <button type="button" className="link-btn link-btn--muted" onClick={remove} disabled={busy}>Remove {p.name}</button> : <span />}
        <div className="row-start" style={{ gap: 8 }}>
          <button type="button" className="btn btn--sm" onClick={onDone} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--sm btn--primary" disabled={busy}>{busy ? 'Saving…' : p ? 'Save' : 'Add'}</button>
        </div>
      </div>
    </form>
  )
}
