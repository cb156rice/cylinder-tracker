import { useState } from 'react'
import { AIRGAS_CONTACTS, PEOPLE, recipients } from '../lib/rules'
import { templateDraft } from '../lib/draft'
import { logContact, receiveEmail, sendEmail } from '../lib/transitions'
import type { AirgasContact, RiceStaff, Ticket } from '../lib/types'
import { useDemoStore, useStore } from '../store/hooks'
import { simulatedReply } from '../store/seed'

/** Reply box, escalation, call/visit logging and (demo only) simulated Airgas replies. */
export function Composer({ ticket: t, viewer, initialDraft = '' }: { ticket: Ticket; viewer: RiceStaff; initialDraft?: string }) {
  const store = useStore()
  const demo = useDemoStore()
  const [draft, setDraft] = useState(initialDraft)
  const [escalating, setEscalating] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [logKind, setLogKind] = useState<'call' | 'visit'>('call')
  const [logWho, setLogWho] = useState<AirgasContact>('ruben')
  const [logNote, setLogNote] = useState('')

  const r = recipients(t, escalating)
  const recipientLine = `To ${r.to.map(p => PEOPLE[p].name).join(', ')} · cc ${[...r.cc.map(p => PEOPLE[p].name), t.reporter.name.split(' ')[0]].join(', ')}`
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
  }

  return (
    <div className="composer">
      {escalating && <div className="composer__esc">Escalation: Chris (Airgas regional manager) will be added to the thread.</div>}
      <textarea className="input composer__text" rows={5} value={draft} onChange={e => setDraft(e.target.value)}
        placeholder="Reply on the thread. Write rough notes or leave empty, then Draft." aria-label="Reply" />
      <span className="faint" style={{ fontSize: 12 }}>{recipientLine}</span>
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <button className="btn-outline" onClick={() => setDraft(templateDraft(t, viewer, escalating, draft))}
          title="Fills in a simple template. Claude writes the draft once Phase 4 is set up.">
          <span className="dot" style={{ background: 'var(--green-dot)', width: 7, height: 7 }} />Draft (template until Claude is connected)
        </button>
        <button className="btn btn--sm btn--primary" style={{ marginLeft: 'auto' }} disabled={!draft.trim()} onClick={send}>
          {escalating ? 'Send and add Chris' : 'Send to thread'}
        </button>
      </div>
      <div className="row-start" style={{ flexWrap: 'wrap', paddingTop: 4 }}>
        {canEscalate && (
          <button className="btn btn--xs btn--danger" onClick={() => { setEscalating(true); setDraft(templateDraft(t, viewer, true, '')) }}>Escalate to Chris</button>
        )}
        {escalating && <button className="btn btn--xs" onClick={() => { setEscalating(false); setDraft('') }}>Cancel escalation</button>}
        <button className="btn btn--xs" aria-expanded={logOpen} onClick={() => setLogOpen(o => !o)}>Log call/visit</button>
        {demo && <button className="btn btn--xs btn--demo" onClick={simulate}>Demo: simulate Airgas reply</button>}
      </div>

      {logOpen && (
        <div className="logbox">
          <div className="row-start" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {(['call', 'visit'] as const).map(k => (
              <button key={k} className="toggle" aria-pressed={logKind === k} onClick={() => setLogKind(k)}>{k === 'call' ? 'Call' : 'Visit'}</button>
            ))}
            <select className="mini-select" style={{ marginLeft: 'auto', height: 32 }} value={logWho} aria-label="With whom"
              onChange={e => setLogWho(e.target.value as AirgasContact)}>
              {AIRGAS_CONTACTS.map(p => <option key={p} value={p}>with {PEOPLE[p].name}</option>)}
            </select>
          </div>
          <textarea className="input" rows={2} value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="What was said or agreed?" aria-label="Call or visit notes" />
          <div className="row-end">
            <button className="btn btn--xs" onClick={() => setLogOpen(false)}>Cancel</button>
            <button className="btn btn--xs btn--primary" disabled={!logNote.trim()} onClick={saveLog}>Add to ticket</button>
          </div>
        </div>
      )}
    </div>
  )
}
