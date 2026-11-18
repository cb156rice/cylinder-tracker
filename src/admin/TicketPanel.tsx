import { useState } from 'react'
import {
  CATEGORY_LABEL, PEOPLE, RESOLVER_LABEL, RICE_STAFF, airgasDate, deadline, isCheckIn, isOverdue, locationLabel,
} from '../lib/rules'
import { fmt, fmtDay, fmtShort } from '../lib/time'
import {
  acceptEta, complete, ignoreEta, reopen, setCoordinator,
} from '../lib/transitions'
import type { ResolvedBy, RiceStaff, Ticket } from '../lib/types'
import { useStore } from '../store/hooks'
import type { Change } from '../store/store'
import { Composer } from './Composer'
import { StatusPill } from './StatusPill'
import { Thread } from './Thread'

/**
 * One ticket. Airgas's replies move it along by themselves; the "next step" card shows the one date
 * that matters and the one action Rice might take (mark fixed, or reopen).
 */
export function TicketPanel({ ticket: t, now, viewer, onClose }: { ticket: Ticket; now: Date; viewer: RiceStaff; onClose: () => void }) {
  const store = useStore()
  const [completing, setCompleting] = useState(false)
  const [doneBy, setDoneBy] = useState<ResolvedBy>('airgas')
  const [doneNotes, setDoneNotes] = useState('')

  const apply = (change: Change) => store.update(t.id, change)
  const due = deadline(t)
  const late = isOverdue(t, now)
  const dateFromAirgas = airgasDate(t)
  const asked = t.thread.filter(isCheckIn).at(-1)
  const first = t.reporter.name.split(' ')[0]
  const startClose = () => { setCompleting(true); setDoneBy('airgas'); setDoneNotes('') }

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
            <span className="strong" style={{ fontSize: 14 }}>
              Fixed by {t.resolvedBy ? RESOLVER_LABEL[t.resolvedBy] : '—'}{t.resolvedAt && ` · ${fmt(new Date(t.resolvedAt))}`}
            </span>
            {t.confirm === 'yes' && <span className="muted">{first} confirmed it's fixed.</span>}
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
              <button className="btn btn--sm btn--primary" onClick={() => { apply((x, n) => complete(x, doneBy, doneNotes, n)); setCompleting(false) }}>Close ticket</button>
            </div>
          </div>
        ) : (
          <div className="nextstep">
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <span title="Counts business hours only: 9 AM–5 PM, Mon–Fri">
                {t.status === 'open' ? 'Airgas reply due' : 'Fix due'} <strong>{due ? fmt(due) : '—'}</strong>
              </span>
              {late && <span className="late-tag">Late</span>}
            </div>
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              {t.status === 'open'
                ? 'Moves to In progress by itself when Airgas replies.'
                : dateFromAirgas
                  ? `The date Airgas gave (${fmtDay(dateFromAirgas)}). After it, we ask ${first} if it's fixed.`
                  : `Airgas hasn't given a date, so it's 2 business days after the report. After it, we ask ${first} if it's fixed.`}
              {asked && t.confirm === 'asked' && ` Asked ${first} on ${fmtShort(new Date(asked.at))}; waiting for a YES or NO.`}
              {t.confirm === 'no' && ` ${first} said it's not fixed yet.`}
            </span>
            <div className="row-between" style={{ alignItems: 'center' }}>
              <span />
              <button className="btn btn--sm btn--primary" onClick={startClose}>Mark fixed</button>
            </div>
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

        <div className="stack" style={{ gap: 10 }}>
          <span className="label">Emails with Airgas</span>
          <Thread ticket={t} now={now} />
        </div>

        {t.status !== 'done' && <Composer ticket={t} viewer={viewer} />}
      </div>
    </aside>
  )
}
