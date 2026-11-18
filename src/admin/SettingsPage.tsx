import { useState } from 'react'
import { activePeople, type Settings } from '../lib/directory'
import type { Building } from '../lib/types'
import { useSettings, useStore } from '../store/hooks'
import { useSaveSettings } from './useSaveSettings'

const BUILDINGS: [Building, string][] = [['sst', 'SST'], ['oconnor', "O'Connor"], ['other', 'Other buildings']]

/** Email routing and ticket rules. Edits are a draft until "Save changes". */
export function SettingsPage() {
  const saved = useSettings()
  const live = useStore().mode === 'github'
  const { save } = useSaveSettings()
  const [draft, setDraft] = useState<Settings>(saved)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const rice = activePeople('rice'), airgas = activePeople('airgas')
  const set = (patch: Partial<Settings>) => { setDraft(d => ({ ...d, ...patch })); setDone(false) }
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  const problem = draft.newTicketContacts.length === 0 ? 'Pick at least one Airgas contact for new tickets.' : ''

  async function submit() {
    if (problem) return
    setBusy(true)
    if (await save(draft)) setDone(true)
    setBusy(false)
  }

  return (
    <main className="admin-body settings">
      <p className="settings__intro">
        Who handles each building and who gets which emails. Changes apply from the next email the tracker sends.
        People are added and edited on the Users page.
      </p>

      <section className="card settings__card">
        <h2 className="h2">Building leads</h2>
        <p className="settings__hint">The lead is copied on every email for their building's tickets and shows as "Handled by". Open tickets keep their current lead.</p>
        <div className="settings__rows">
          {BUILDINGS.map(([b, label]) => (
            <label key={b} className="settings__row">
              <span>{label}</span>
              <select className="input input--sm" value={draft.leads[b]} onChange={e => set({ leads: { ...draft.leads, [b]: e.target.value } })}>
                {rice.map(p => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="card settings__card">
        <h2 className="h2">Who gets emails</h2>
        <p className="settings__hint">The building lead and the person who reported the problem are always copied.</p>
        <fieldset className="settings__group">
          <legend>New tickets are emailed to</legend>
          {airgas.map(p => (
            <label key={p.id} className="checkbox">
              <input type="checkbox" checked={draft.newTicketContacts.includes(p.id)} onChange={() => set({ newTicketContacts: toggle(draft.newTicketContacts, p.id) })} />
              <span>{p.name} <span className="muted">· {p.title}</span></span>
            </label>
          ))}
          {problem && <span className="field__error">{problem}</span>}
        </fieldset>
        <fieldset className="settings__group">
          <legend>Also copied on every email</legend>
          {rice.map(p => (
            <label key={p.id} className="checkbox">
              <input type="checkbox" checked={draft.alwaysCopied.includes(p.id)} onChange={() => set({ alwaysCopied: toggle(draft.alwaysCopied, p.id) })} />
              <span>{p.name} <span className="muted">· {p.title}</span></span>
            </label>
          ))}
        </fieldset>
        <label className="settings__row">
          <span>Escalate to</span>
          <select className="input input--sm" value={draft.escalationContact} onChange={e => set({ escalationContact: e.target.value })}>
            {airgas.map(p => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
          </select>
        </label>
      </section>

      <section className="card settings__card">
        <h2 className="h2">Closing tickets</h2>
        <label className="checkbox" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={draft.autoCloseOnYes} onChange={e => set({ autoCloseOnYes: e.target.checked })} style={{ marginTop: 3 }} />
          <span>
            Close the ticket when the reporter answers YES to "Is it fixed?"
            <span className="settings__hint" style={{ display: 'block' }}>If off, the ticket stays open, marked as confirmed, for the lead to close.</span>
          </span>
        </label>
      </section>

      <section className="card settings__card">
        <h2 className="h2">Email mode</h2>
        {live ? (
          <p className="settings__hint" style={{ margin: 0 }}>
            <strong style={{ color: 'var(--ink)' }}>Demo mode is on.</strong> Every email goes to the two stand-in addresses, with a note saying
            who it would really go to. The email addresses on the Users page are saved for when demo mode is turned off, which happens in
            GitHub when the tracker goes live at Rice.
          </p>
        ) : (
          <p className="settings__hint" style={{ margin: 0 }}>This is the browser demo. No emails are sent.</p>
        )}
      </section>

      <div className="settings__save">
        {done && !dirty && <span className="muted">Saved.</span>}
        {dirty && <button className="btn btn--sm" onClick={() => setDraft(saved)} disabled={busy}>Discard changes</button>}
        <button className="btn btn--sm btn--primary" onClick={submit} disabled={!dirty || busy || !!problem}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </main>
  )
}
