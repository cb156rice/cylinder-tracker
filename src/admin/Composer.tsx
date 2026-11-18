import { useState } from 'react'
import { AIRGAS_CONTACTS, PEOPLE, recipients } from '../lib/rules'
import { templateDraft } from '../lib/draft'
import { logContact, receiveEmail, sendEmail } from '../lib/transitions'
import type { AirgasContact, RiceStaff, Ticket } from '../lib/types'
import { useDemoStore, useStore } from '../store/hooks'
import { simulatedReply } from '../store/seed'

/** Reply box. Escalation, call/visit logging and (demo only) simulated replies sit behind "More". */
export function Composer({ ticket: t, viewer, initialDraft = '' }: { ticket: Ticket; viewer: RiceStaff; initialDraft?: string }) {
  const store = useStore()
  const demo = useDemoStore()
  const [draft, setDraft] = useState(initialDraft)
  const [escalating, setEscalating] = useState(false)
  const [more, setMore] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [logKind, setLogKind] = useState<'call' | 'visit'>('call')
  const [logWho, setLogWho] = useState<AirgasContact>('ruben')
  const [logNote, setLogNote] = useState('')

  const r = recipients(t, escalating)
  const names = (ps: string[]) => ps.join(', ')
  const recipientLine = `Goes to ${names(r.to.map(p => PEOPLE[p].name))}, copying ${names([...r.cc.map(p => PEOPLE[p].name), t.reporter.name.split(' ')[0]])}`
  const canEscalate = !t.participants.includes('chris') && !escalating

  function send() {
    if (!draft.trim()) return
    store.update(t.id, (x, n) => sendEmail(x, viewer, draft, n, escalating))
    setDraft('')
    setEscalating(false)
  }

  function saveLog() {
    if (!logNote.trim()) return
    store.update(t.id, (x, n) => logContact(x, viewer, logKind, logWho, logNote, n))
    setLogOpen(false)
    setLogNote('')
  }

  function simulate() {
    if (!demo) return
    const reply = simulatedReply(t.id, demo.nextSimIndex(t.id))
    store.update(t.id, (x, n) => receiveEmail(x, reply.from, reply.text, n))
    setMore(false)
  }

  if (logOpen) {
    return (
      <div className="composer">
        <span className="strong" style={{ fontSize: 14 }}>Write down a phone call or visit</span>
        <div className="row-start" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {(['call', 'visit'] as const).map(k => (
            <button key={k} className="toggle" aria-pressed={logKind === k} onClick={() => setLogKind(k)}>{k === 'call' ? 'Phone call' : 'Visit'}</button>
          ))}
          <select className="mini-select" style={{ marginLeft: 'auto', height: 32 }} value={logWho} aria-label="With whom"
            onChange={e => setLogWho(e.target.value as AirgasContact)}>
            {AIRGAS_CONTACTS.map(p => <option key={p} value={p}>with {PEOPLE[p].name}</option>)}
          </select>
        </div>
        <textarea className="input" rows={3} value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="What was said or agreed?" aria-label="Call or visit notes" />
        <div className="row-end">
          <button className="btn btn--sm" onClick={() => setLogOpen(false)}>Cancel</button>
          <button className="btn btn--sm btn--primary" disabled={!logNote.trim()} onClick={saveLog}>Save</button>
        </div>
      </div>
    )
  }

  return (
    <div className="composer">
      {escalating && (
        <div className="composer__esc">
          <span>Chris (Airgas regional manager) will be added to this email.</span>
          <button className="link-btn" onClick={() => { setEscalating(false); setDraft('') }}>Undo</button>
        </div>
      )}
      <textarea className="input composer__text" rows={4} value={draft} onChange={e => setDraft(e.target.value)}
        placeholder="Write to Airgas…" aria-label="Reply" />
      <span className="faint" style={{ fontSize: 12 }}>{recipientLine}</span>
      <div className="row-between" style={{ alignItems: 'center' }}>
        <button className="link-btn" onClick={() => setDraft(templateDraft(t, viewer, escalating, draft))}
          title="Fills in a starting message you can edit. Claude will write it once it's connected.">
          Write it for me
        </button>
        <button className="btn btn--sm btn--primary" disabled={!draft.trim()} onClick={send}>
          {escalating ? 'Send and add Chris' : 'Send'}
        </button>
      </div>

      <div className="more">
        <button className="link-btn link-btn--muted" aria-expanded={more} onClick={() => setMore(o => !o)}>
          {more ? 'Fewer options' : 'More options'}
        </button>
        {more && (
          <div className="more__list">
            {canEscalate && (
              <button className="more__item" onClick={() => { setEscalating(true); setDraft(templateDraft(t, viewer, true, '')); setMore(false) }}>
                <span className="strong">Escalate to Chris</span><span className="muted">Airgas isn't responding. Add their regional manager.</span>
              </button>
            )}
            <button className="more__item" onClick={() => { setLogOpen(true); setMore(false) }}>
              <span className="strong">Write down a call or visit</span><span className="muted">For things agreed outside email.</span>
            </button>
            {demo && (
              <button className="more__item more__item--demo" onClick={simulate}>
                <span className="strong">Demo: pretend Airgas replied</span><span className="muted">Only in demo mode.</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
