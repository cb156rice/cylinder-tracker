import { useState } from 'react'
import {
  CATEGORY_LABEL, COMPLEXITY_LABEL, PEOPLE, RESOLVER_LABEL, RICE_STAFF, STATUS_LABEL, clock, locationLabel,
} from '../lib/rules'
import { fmt, fmtDay, sameDay } from '../lib/time'
import {
  acceptEta, complete, ignoreEta, reopen, setComplexity, setCoordinator, startProgress,
} from '../lib/transitions'
import type { Complexity, ResolvedBy, RiceStaff, ScheduleEntry, Status, Ticket } from '../lib/types'
import { useStore } from '../store/hooks'
import type { Change } from '../store/store'
import { Composer } from './Composer'
import { STATUS_COLORS, TONE_BAR, TONE_TEXT } from './display'
import { Thread } from './Thread'

const COMPLEXITY_SUB: Record<Complexity, string> = { low: '12 hrs', medium: '2 days', high: '1 week' }

export function TicketPanel({ ticket: t, schedule, now, viewer, onClose }: { ticket: Ticket; schedule: ScheduleEntry[]; now: Date; viewer: RiceStaff; onClose: () => void }) {
  const store = useStore()
  const [completing, setCompleting] = useState(false)
  const [doneBy, setDoneBy] = useState<ResolvedBy>('airgas')
  const [doneNotes, setDoneNotes] = useState('')

  const apply = (change: Change) => store.update(t.id, change)
  const c = clock(t, now)

  function onStatus(s: Status) {
    if (s === 'done') {
      if (t.status !== 'done') { setCompleting(true); setDoneBy('airgas'); setDoneNotes('') }
      return
    }
    setCompleting(false)
    if (s === t.status) return
    apply(s === 'progress' ? (x, n) => startProgress(x, viewer, n) : (x, n) => reopen(x, n))
  }

  const onSchedule = schedule.some(r => r.order === t.order && sameDay(r.date, now))
  const etaNote = !t.eta ? null
    : sameDay(t.eta, now)
      ? onSchedule ? { text: "On today's delivery schedule", color: 'oklch(0.42 0.1 150)' } : { text: "Not on today's schedule", color: 'oklch(0.48 0.11 65)' }
      : { text: "Will check that day's schedule", color: 'var(--muted)' }

  return (
    <aside className="card panel" aria-label={`Ticket ${t.id}`}>
      <div className="panel__head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="mono muted" style={{ fontSize: 12.5 }}>{t.id} · {t.order}</span>
          <h2>{CATEGORY_LABEL[t.category]} · {locationLabel(t)}</h2>
          <span className="muted" style={{ fontSize: 13 }}>
            {t.reporter.name} · submitted {fmt(new Date(t.createdAt))}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            <a href={`mailto:${t.reporter.email}`}>{t.reporter.email}</a>{t.reporter.phone && ` · ${t.reporter.phone}`}
          </span>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close ticket">×</button>
      </div>

      <div className="panel__body">
        <p className="panel__desc">{t.description}</p>

        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Status</span>
          <div className="grid-3">
            {(['open', 'progress', 'done'] as Status[]).map(s => {
              const active = t.status === s || (s === 'done' && completing)
              const col = STATUS_COLORS[s]
              return (
                <button key={s} className="status-btn" aria-pressed={active} onClick={() => onStatus(s)}
                  style={active ? { background: col.bg, color: col.fg, borderColor: col.dot } : undefined}>
                  <span className="dot" style={{ background: col.dot }} />{STATUS_LABEL[s]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="clockbox">
          <div className="row-between"><span className="muted">{c.label}</span><span className="strong" style={{ color: TONE_TEXT[c.tone] }}>{c.text}</span></div>
          <div className="bar"><div style={{ width: `${c.pct}%`, background: TONE_BAR[c.tone] }} /></div>
          <span className="faint" style={{ fontSize: 12 }}>Business hours only: 9 AM–5 PM, Mon–Fri</span>
          {c.over && <span className="strong" style={{ color: 'oklch(0.48 0.16 25)' }}>Escalated to Javier</span>}
        </div>

        {t.status === 'progress' && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Complexity</span>
            <div className="grid-3">
              {(['low', 'medium', 'high'] as Complexity[]).map(k => (
                <button key={k} className="cx-btn" aria-pressed={t.complexity === k}
                  onClick={() => t.complexity !== k && apply((x, n) => setComplexity(x, k, n))}>
                  <span className="strong">{COMPLEXITY_LABEL[k]}</span><span className="muted" style={{ fontSize: 11.5 }}>{COMPLEXITY_SUB[k]}</span>
                </button>
              ))}
            </div>
            {!t.complexity && <span style={{ fontSize: 13, color: 'var(--yellow-fg)', fontWeight: 500 }}>Set complexity to start the resolution clock.</span>}
          </div>
        )}

        {completing && t.status !== 'done' && (
          <div className="closeout">
            <span className="strong" style={{ fontSize: 14 }}>Close out ticket</span>
            <label className="field">Resolved by
              <select className="input input--sm" value={doneBy} onChange={e => setDoneBy(e.target.value as ResolvedBy)}>
                <option value="airgas">Airgas</option>
                {RICE_STAFF.map(p => <option key={p} value={p}>{RESOLVER_LABEL[p]}</option>)}
              </select>
            </label>
            <div className="row-between"><span className="muted">When</span><span style={{ fontWeight: 500 }}>{fmt(now)}</span></div>
            <label className="field">Notes
              <textarea className="input" rows={3} value={doneNotes} onChange={e => setDoneNotes(e.target.value)}
                placeholder="What was done? Anything the next person should know?" />
            </label>
            <div className="row-end">
              <button className="btn btn--sm" onClick={() => setCompleting(false)}>Cancel</button>
              <button className="btn btn--sm btn--green" onClick={() => { apply((x, n) => complete(x, doneBy, doneNotes, n)); setCompleting(false) }}>Mark completed</button>
            </div>
          </div>
        )}

        {t.status === 'done' && (
          <div className="resolved">
            <div className="row-between"><span className="muted">Resolved by</span><span className="strong">{t.resolvedBy ? RESOLVER_LABEL[t.resolvedBy] : '—'}</span></div>
            <div className="row-between"><span className="muted">When</span><span className="strong">{t.resolvedAt ? fmt(new Date(t.resolvedAt)) : '—'}</span></div>
            {t.confirm === 'yes' && <div className="row-between"><span className="muted">Lab confirmed</span><span className="strong" style={{ color: 'var(--green-fg)' }}>Yes, fixed</span></div>}
            <div className="stack" style={{ gap: 4, paddingTop: 4 }}><span className="muted">Notes</span><span style={{ lineHeight: 1.5 }}>{t.resolutionNotes}</span></div>
          </div>
        )}

        {t.etaSuggestion && t.status !== 'done' && (
          <div className="eta-suggest">
            <span className="eta-suggest__title">ETA found in {PEOPLE[t.etaSuggestion.from].name}'s reply</span>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>"{t.etaSuggestion.quote}" → <strong>{fmtDay(t.etaSuggestion.date)}</strong></span>
            <div className="row-start">
              <button className="btn btn--sm btn--primary" onClick={() => apply(acceptEta)}>Set ETA</button>
              <button className="btn btn--sm" onClick={() => apply(x => ignoreEta(x))}>Ignore</button>
            </div>
          </div>
        )}

        {t.eta && t.status !== 'done' && etaNote && (
          <div className="eta-box">
            <span className="stack" style={{ gap: 2 }}><span className="faint" style={{ fontSize: 12 }}>ETA</span><span style={{ fontSize: 15, fontWeight: 700 }}>{fmtDay(t.eta)}</span></span>
            <span style={{ fontSize: 13, fontWeight: 500, color: etaNote.color, textAlign: 'right' }}>{etaNote.text}</span>
          </div>
        )}

        <div className="stack" style={{ gap: 10 }}>
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <span className="label">Email thread with Airgas</span>
            <select className="mini-select" value={t.coordinator} aria-label="Coordinator"
              onChange={e => apply((x, n) => setCoordinator(x, e.target.value as RiceStaff, n))}>
              {RICE_STAFF.map(p => <option key={p} value={p}>Coordinator: {PEOPLE[p].name}</option>)}
            </select>
          </div>
          <Thread ticket={t} />
        </div>

        {t.status !== 'done' && <Composer ticket={t} viewer={viewer} />}
      </div>
    </aside>
  )
}
