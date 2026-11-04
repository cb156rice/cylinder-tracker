import { useCallback, useState } from 'react'
import { CATEGORY_LABEL, PEOPLE, clock, locationLabel } from '../lib/rules'
import { fmtShort } from '../lib/time'
import type { RiceStaff, ScheduleEntry, Ticket } from '../lib/types'
import { adminHref, go } from '../router'
import { TONE_TEXT, threadSummary } from './display'
import { StatusPill } from './StatusPill'
import { Printouts, type PrintoutKind } from './Printouts'
import { TicketPanel } from './TicketPanel'

type Filter = 'all' | 'open' | 'progress' | 'done' | 'overdue'

const VIEWER_NOTE: Record<RiceStaff, string> = {
  javier: 'Supervisor. Emailed only on escalations.',
  israel: 'SST stockroom lead. You coordinate SST tickets with Airgas.',
  robert: "O'Connor stockroom lead. You coordinate O'Connor tickets with Airgas.",
}

export function Queue({ tickets, schedule, now, viewer, selectedId, ask }: { tickets: Ticket[]; schedule: ScheduleEntry[]; now: Date; viewer: RiceStaff; selectedId: string | null; ask: string | null }) {
  const [mine, setMine] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [printout, setPrintout] = useState<PrintoutKind | null>(null)

  const rows = tickets.map(t => ({ t, c: clock(t, now) }))
  const scope = mine ? rows.filter(r => r.t.coordinator === viewer) : rows
  const matches = (f: Filter, r: (typeof rows)[number]) => f === 'all' || (f === 'overdue' ? r.c.over : r.t.status === f)
  const visible = scope.filter(r => matches(filter, r))
  const selected = tickets.find(t => t.id === selectedId) ?? null

  const cards: [Filter, string, string][] = [
    ['all', 'All tickets', '#9AA0A8'],
    ['open', 'Not started', 'var(--red-dot)'],
    ['progress', 'In progress', 'var(--yellow-dot)'],
    ['done', 'Completed', 'var(--green-dot)'],
    ['overdue', 'Overdue · escalated', 'oklch(0.45 0.17 25)'],
  ]

  const select = (id: string | null) => go(adminHref('queue', id))
  const closePrintout = useCallback(() => setPrintout(null), [])

  return (
    <main className="admin-body">
      <div className="toolbar">
        <div className="toolbar__note">{VIEWER_NOTE[viewer]}</div>
        <div className="toolbar__actions">
          <button className="btn-outline" onClick={() => setPrintout('agenda')}>Visit agenda</button>
          <button className="btn-outline" onClick={() => setPrintout('driver')}>Driver report</button>
          <div className="switch" role="group" aria-label="Which tickets">
            {([[false, 'All issues', rows.length], [true, 'Assigned to me', rows.filter(r => r.t.coordinator === viewer).length]] as const).map(([v, label, n]) => (
              <button key={label} aria-pressed={mine === v} onClick={() => setMine(v)}>{label}<span className="mono">{n}</span></button>
            ))}
          </div>
        </div>
      </div>

      <div className="summary">
        {cards.map(([k, label, dot]) => (
          <button key={k} className="summary__card" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            <span className="summary__label"><span className="dot" style={{ background: dot, width: 9, height: 9 }} />{label}</span>
            <span className="summary__count">{scope.filter(r => matches(k, r)).length}</span>
          </button>
        ))}
      </div>

      <div className="queue-cols">
        <div className="card table-wrap">
          <div className={'table' + (selected ? ' table--compact' : '')}>
            <div className="table__row table__head">
              {['Ticket', 'Issue', 'Location', 'Coordinator', 'Airgas thread', 'Status', 'Clock'].map(h => <span key={h} className={h === 'Coordinator' ? 'col-coord' : undefined}>{h}</span>)}
            </div>
            {visible.map(({ t, c }) => {
              const th = threadSummary(t)
              return (
                <a key={t.id} href={adminHref('queue', t.id)} className="table__row" aria-current={t.id === selectedId ? 'true' : undefined}>
                  <span className="mono table__id">{t.id}</span>
                  <span className="stack"><span className="strong">{CATEGORY_LABEL[t.category]}</span><span className="clip muted">{t.description}</span></span>
                  <span className="stack"><span style={{ fontWeight: 500 }}>{locationLabel(t)}</span><span className="faint">{fmtShort(new Date(t.createdAt))}</span></span>
                  <span className="col-coord" style={{ fontWeight: 500 }}>{PEOPLE[t.coordinator].name}</span>
                  <span className="stack"><span className="strong" style={{ color: th.color }}>{th.top}</span><span className="clip faint">{th.sub}</span></span>
                  <span><StatusPill status={t.status} /></span>
                  <span className="stack"><span className="strong" style={{ color: TONE_TEXT[c.tone] }}>{c.text}</span><span className="faint" style={{ fontSize: 12 }}>{c.label}</span></span>
                </a>
              )
            })}
            {visible.length === 0 && <div className="table__empty">No tickets in this view.</div>}
          </div>
        </div>

        {selected && <TicketPanel key={selected.id + (ask ?? '')} ticket={selected} schedule={schedule} now={now} viewer={viewer} ask={ask} onClose={() => select(null)} />}
      </div>
      {printout && <Printouts kind={printout} setKind={setPrintout} tickets={tickets} now={now} onClose={closePrintout} />}
    </main>
  )
}
