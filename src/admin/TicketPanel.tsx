import { useState } from 'react'
import {
  CATEGORY_LABEL, PEOPLE, RESOLVER_LABEL, RICE_STAFF, clock, locationLabel,
} from '../lib/rules'
import { fmt, fmtDay, fmtShort, sameDay } from '../lib/time'
import {
  acceptEta, complete, ignoreEta, reopen, setComplexity, setCoordinator, startProgress,
} from '../lib/transitions'
import type { Complexity, ResolvedBy, RiceStaff, ScheduleEntry, Ticket } from '../lib/types'
import { useStore } from '../store/hooks'
import type { Change } from '../store/store'
import { scheduleAskDraft } from '../lib/draft'
import { Composer } from './Composer'
import { TONE_BAR, TONE_TEXT } from './display'
import { StatusPill } from './StatusPill'
import { Thread } from './Thread'

const SIZE: Record<Complexity, [string, string]> = {
  low: ['Small', 'Should take about 12 business hours'],
  medium: ['Medium', 'About 2 business days'],
  high: ['Big', 'About 1 business week'],
}

/**
 * One ticket. The "next step" card shows only the action that fits the ticket's state
 * (start → pick size → complete → reopen); everything else is reading.
 */
export function TicketPanel({ ticket: t, schedule, now, viewer, ask, onClose }: { ticket: Ticket; schedule: ScheduleEntry[]; now: Date; viewer: RiceStaff; ask: string | null; onClose: () => void }) {
  const store = useStore()
  const [completing, setCompleting] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [doneBy, setDoneBy] = useState<ResolvedBy>('airgas')
  const [doneNotes, setDoneNotes] = useState('')

  const apply = (change: Change) => store.update(t.id, change)
  const c = clock(t, now)

  const onSchedule = schedule.some(r => r.order === t.order && sameDay(r.date, now))
  const etaNote = !t.eta ? null
    : sameDay(t.eta, now)
      ? onSchedule ? { text: "On today's delivery schedule", color: 'oklch(0.42 0.1 150)' } : { text: "Not on today's schedule", color: 'oklch(0.48 0.11 65)' }
      : { text: "We'll check that day's schedule", color: 'var(--muted)' }

  const pickSize = t.status === 'progress' && (!t.complexity || resizing)

  return (
    <aside className="card panel" aria-label={`Ticket ${t.id}`}>
      <div className="panel__head">
        <div className="stack" style={{ gap: 6 }}>
          <span className="mono muted" style={{ fontSize: 12.5 }}>{t.id} · Order {t.order}</span>
          <h2>{CATEGORY_LABEL[t.category]} · {locationLabel(t)}</h2>
          <div className="panel__meta">
            <StatusPill status={t.status} />
            <label className="plain-select">
              <span className="sr-only">Coordinator</span>
              <select value={t.coordinator} onChange={e => apply((x, n) => setCoordinator(x, e.target.value as RiceStaff, n))}>
                {RICE_STAFF.map(p => <option key={p} value={p}>Handled by {PEOPLE[p].name}</option>)}
              </select>
            </label>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close ticket">×</button>
      </div>

      <div className="panel__body">
        <div className="stack" style={{ gap: 6 }}>
          <p className="panel__desc">{t.description}</p>
          <span className="muted" style={{ fontSize: 13 }}>
            From {t.reporter.name} (<a href={`mailto:${t.reporter.email}`}>{t.reporter.email}</a>{t.reporter.phone && `, ${t.reporter.phone}`}) · {fmtShort(new Date(t.createdAt))}
          </span>
        </div>

        {/* ---- Next step ---- */}
        {t.status === 'done' ? (
          <div className="resolved">
            <span className="strong" style={{ fontSize: 14, color: 'var(--green-fg)' }}>
              Fixed by {t.resolvedBy ? RESOLVER_LABEL[t.resolvedBy] : '—'}{t.resolvedAt && ` · ${fmt(new Date(t.resolvedAt))}`}
            </span>
            {t.confirm === 'yes' && <span className="muted">The lab confirmed it's fixed.</span>}
            {t.resolutionNotes && <span style={{ lineHeight: 1.5 }}>{t.resolutionNotes}</span>}
            <button className="link-btn" onClick={() => apply((x, n) => reopen(x, n))}>Not fixed after all? Reopen</button>
          </div>
        ) : completing ? (
          <div className="closeout">
            <span className="strong" style={{ fontSize: 14 }}>Close this ticket</span>
            <label className="field">Who fixed it?
              <select className="input input--sm" value={doneBy} onChange={e => setDoneBy(e.target.value as ResolvedBy)}>
                <option value="airgas">Airgas</option>
                {RICE_STAFF.map(p => <option key={p} value={p}>{RESOLVER_LABEL[p]}</option>)}
              </select>
            </label>
            <label className="field">What was done? (optional)
              <textarea className="input" rows={3} value={doneNotes} onChange={e => setDoneNotes(e.target.value)}
                placeholder="Anything the next person should know" />
            </label>
            <div className="row-end">
              <button className="btn btn--sm" onClick={() => setCompleting(false)}>Cancel</button>
              <button className="btn btn--sm btn--green" onClick={() => { apply((x, n) => complete(x, doneBy, doneNotes, n)); setCompleting(false) }}>Close ticket</button>
            </div>
          </div>
        ) : pickSize ? (
          <div className="nextstep">
            <span className="strong" style={{ fontSize: 14 }}>How big is the fix?</span>
            <span className="muted" style={{ fontSize: 13 }}>This sets how long Airgas has before it counts as late.</span>
            <div className="stack" style={{ gap: 6 }}>
              {(['low', 'medium', 'high'] as Complexity[]).map(k => (
                <button key={k} className="choice" aria-pressed={t.complexity === k}
                  onClick={() => { if (t.complexity !== k) apply((x, n) => setComplexity(x, k, n)); setResizing(false) }}>
                  <span className="strong">{SIZE[k][0]}</span><span className="muted">{SIZE[k][1]}</span>
                </button>
              ))}
            </div>
            {resizing && <button className="link-btn" onClick={() => setResizing(false)}>Cancel</button>}
          </div>
        ) : (
          <div className="nextstep">
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <span className="muted">{t.status === 'open' ? 'Airgas should respond' : 'Airgas should fix it'}</span>
              <span className="strong" style={{ color: TONE_TEXT[c.tone], fontSize: 14 }}>{c.text}</span>
            </div>
            <div className="bar" title="Counts business hours only: 9 AM–5 PM, Mon–Fri"><div style={{ width: `${c.pct}%`, background: TONE_BAR[c.tone] }} /></div>
            {c.over && <span style={{ fontSize: 12.5, color: 'var(--red-fg)' }}>Late, so Javier has been told.</span>}
            {t.status === 'open'
              ? <button className="btn btn--sm btn--primary" onClick={() => apply((x, n) => startProgress(x, viewer, n))}>Airgas is on it: start tracking</button>
              : (
                <div className="row-between" style={{ alignItems: 'center' }}>
                  <button className="link-btn" onClick={() => setResizing(true)}>Size: {SIZE[t.complexity!][0]} · change</button>
                  <button className="btn btn--sm btn--green" onClick={() => { setCompleting(true); setDoneBy('airgas'); setDoneNotes('') }}>It's fixed</button>
                </div>
              )}
          </div>
        )}

        {t.etaSuggestion && t.status !== 'done' && (
          <div className="eta-suggest">
            <span className="eta-suggest__title">{PEOPLE[t.etaSuggestion.from].name} gave a date</span>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>"{t.etaSuggestion.quote}" → <strong>{fmtDay(t.etaSuggestion.date)}</strong></span>
            <div className="row-start">
              <button className="btn btn--sm btn--primary" onClick={() => apply(acceptEta)}>Use this date</button>
              <button className="btn btn--sm" onClick={() => apply(x => ignoreEta(x))}>Ignore</button>
            </div>
          </div>
        )}

        {t.eta && t.status !== 'done' && etaNote && (
          <div className="eta-box">
            <span className="stack" style={{ gap: 2 }}><span className="faint" style={{ fontSize: 12 }}>Expected</span><span style={{ fontSize: 15, fontWeight: 700 }}>{fmtDay(t.eta)}</span></span>
            <span style={{ fontSize: 13, fontWeight: 500, color: etaNote.color, textAlign: 'right' }}>{etaNote.text}</span>
          </div>
        )}

        <div className="stack" style={{ gap: 10 }}>
          <span className="label">Emails with Airgas</span>
          <Thread ticket={t} now={now} />
        </div>

        {t.status !== 'done' && <Composer ticket={t} viewer={viewer} initialDraft={ask === 'schedule' ? scheduleAskDraft(t, viewer) : ''} />}
      </div>
    </aside>
  )
}
