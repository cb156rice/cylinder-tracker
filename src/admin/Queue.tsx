import { useState } from 'react'
import { CATEGORY_LABEL, clock, locationLabel } from '../lib/rules'
import type { RiceStaff, Ticket } from '../lib/types'
import { adminHref, go } from '../router'
import { dueInfo, threadSummary } from './display'
import { StatusPill } from './StatusPill'
import { TicketPanel } from './TicketPanel'
import { useStore } from '../store/hooks'
import { GitHubStore } from '../store/githubStore'
import { makeSeed } from '../store/seed'

type Filter = 'todo' | 'overdue' | 'done' | 'all'

const FILTERS: [Filter, string][] = [['todo', 'To do'], ['overdue', 'Late'], ['done', 'Completed'], ['all', 'All']]

export function Queue({ tickets, now, viewer, selectedId }: { tickets: Ticket[]; now: Date; viewer: RiceStaff; selectedId: string | null }) {
  const [mine, setMine] = useState(false)
  const [filter, setFilter] = useState<Filter>('todo')

  const rows = tickets.map(t => ({ t, c: clock(t, now) }))
  const scope = mine ? rows.filter(r => r.t.coordinator === viewer) : rows
  const matches = (f: Filter, r: (typeof rows)[number]) =>
    f === 'all' || (f === 'overdue' ? r.c.over : f === 'done' ? r.t.status === 'done' : r.t.status !== 'done')
  const visible = scope.filter(r => matches(filter, r))
  const selected = tickets.find(t => t.id === selectedId) ?? null

  const select = (id: string | null) => go(adminHref('queue', id))

  return (
    <main className="admin-body">
      <div className="toolbar">
        <div className="switch" role="group" aria-label="Show">
          {FILTERS.map(([k, label]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}<span className="mono">{scope.filter(r => matches(k, r)).length}</span>
            </button>
          ))}
        </div>
        <div className="toolbar__actions">
          <label className="checkbox">
            <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />
            Only mine
          </label>
        </div>
      </div>

      <div className="queue-cols">
        <div className="card table-wrap">
          <div className={'table' + (selected ? ' table--compact' : '')}>
            <div className="table__row table__head">
              {['Ticket', 'Problem', 'Airgas', 'Status', 'Due'].map(h => <span key={h}>{h}</span>)}
            </div>
            {visible.map(({ t }) => {
              const th = threadSummary(t)
              const due = dueInfo(t, now)
              return (
                <a key={t.id} href={adminHref('queue', t.id)} className="table__row" aria-current={t.id === selectedId ? 'true' : undefined}>
                  <span className="mono table__id">{t.id}</span>
                  <span className="stack"><span className="strong">{CATEGORY_LABEL[t.category]} · {locationLabel(t)}</span><span className="clip muted">{t.description}</span></span>
                  <span className="stack"><span style={{ color: th.color, fontWeight: 500 }}>{th.top}</span>{th.sub && <span className="clip faint">{th.sub}</span>}</span>
                  <span><StatusPill status={t.status} /></span>
                  <span className="stack"><span className={due.late ? 'late-tag' : 'muted'}>{due.late ? 'Late' : due.text}</span>{due.late && <span className="faint clip">was due {due.text.split(" · ")[0]}</span>}</span>
                </a>
              )
            })}
            {visible.length === 0 && (tickets.length === 0 ? <EmptyRepo /> : <div className="table__empty">{filter === 'overdue' ? 'Nothing is late.' : 'No tickets here.'}</div>)}
          </div>
        </div>

        {selected && <TicketPanel key={selected.id} ticket={selected} now={now} viewer={viewer} onClose={() => select(null)} />}
      </div>
    </main>
  )
}

/** Live mode with no tickets yet: offer to copy the sample tickets in, for a demo. */
function EmptyRepo() {
  const store = useStore()
  const [done, setDone] = useState<number | null>(null)
  if (!(store instanceof GitHubStore)) return <div className="table__empty">No tickets yet.</div>
  const load = async () => {
    setDone(0)
    try { await store.importTickets(makeSeed(store.now()).tickets, setDone) } catch { setDone(null) }
  }
  return (
    <div className="table__empty" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <span>No tickets in the shared data yet. Submit one from the report form, or load the 8 sample tickets for a demo.</span>
      <button className="btn btn--sm btn--primary" disabled={done !== null} onClick={load}>
        {done === null ? 'Load sample tickets' : `Loading… ${done} of 8`}
      </button>
    </div>
  )
}
