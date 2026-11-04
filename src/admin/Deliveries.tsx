import { config } from '../config'
import { confirmationNote, confirmationSubject, type DeliveryView } from '../lib/deliveries'
import { CATEGORY_LABEL, PEOPLE, lastAirgasEmail, locationLabel } from '../lib/rules'
import { fmtDay } from '../lib/time'
import { askConfirmation, confirmDelivery } from '../lib/transitions'
import type { Ticket } from '../lib/types'
import { adminHref } from '../router'
import { useDemoStore, useStore } from '../store/hooks'
import { StatusPill } from './StatusPill'

export function Deliveries({ view, now }: { view: DeliveryView; now: Date }) {
  const demo = useDemoStore()
  return (
    <main className="admin-body admin-body--cols">
      <section className="card deliv-sched">
        <div className="deliv-sched__head">
          <h2>Airgas delivery schedule · {fmtDay(now)}</h2>
          <span className="muted">Airgas's daily schedule is sent to the tracker mailbox. Order numbers are matched against tickets.</span>
        </div>
        {view.rows.map(({ entry, ticket }) => (
          <div key={entry.order} className="deliv-row">
            <span className="mono" style={{ fontSize: 12.5 }}>{entry.order}</span>
            <span className="stack"><span style={{ fontWeight: 500 }}>{entry.site}</span><span className="faint">{entry.item}</span></span>
            {ticket ? <a className="ticket-chip mono" href={adminHref('queue', ticket.id)}>{ticket.id}</a> : <span className="deliv-row__none">No ticket</span>}
          </div>
        ))}
        {view.rows.length === 0 && (
          <div className="table__empty">
            No schedule received for today yet.
            {view.latestDay && <> The latest one is from {fmtDay(view.latestDay)}.{demo && ' Reset the demo to load a sample for today.'}</>}
          </div>
        )}
      </section>

      <div className="deliv-side">
        <div className="stack" style={{ gap: 4 }}>
          <h2 className="h2">Did it get fixed?</h2>
          <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
            At 4 PM on the delivery day, the person who reported the issue gets an email asking them to reply YES or NO.{' '}
            {config.autoCloseOnConfirm
              ? 'YES closes the ticket; NO reopens it and replies on the Airgas thread.'
              : 'YES marks the ticket ready for the coordinator to close; NO reopens it and replies on the Airgas thread.'}
          </span>
        </div>
        {view.matched.map(t => <ConfirmCard key={t.id} t={t} />)}
        {view.missing.length > 0 && (
          <section className="warn-card">
            <span className="warn-card__title">Promised today, not on the schedule</span>
            {view.missing.map(t => {
              const last = lastAirgasEmail(t)
              return (
                <div key={t.id} className="warn-card__row">
                  <span className="stack" style={{ fontSize: 13.5, gap: 2 }}>
                    <span className="strong">{t.id} · {CATEGORY_LABEL[t.category]} · {locationLabel(t)}</span>
                    <span className="muted">{last ? `${PEOPLE[last.from].name} said "${last.text}"` : `ETA ${fmtDay(t.eta!)}`}</span>
                  </span>
                  <a className="btn-outline" style={{ height: 34, padding: '0 12px', textDecoration: 'none' }} href={adminHref('queue', t.id, 'schedule')}>Ask on thread</a>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function ConfirmCard({ t }: { t: Ticket }) {
  const store = useStore()
  const demo = useDemoStore()
  const first = t.reporter.name.split(' ')[0]
  return (
    <section className="card confirm-card">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <span className="stack">
          <span className="mono muted" style={{ fontSize: 12 }}>{t.id} · {t.order}</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{CATEGORY_LABEL[t.category]} · {locationLabel(t)}</span>
        </span>
        <StatusPill status={t.status} />
      </div>
      <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--body)' }}>{confirmationNote(t)}</span>
      {!t.confirm && t.status !== 'done' && (
        <button className="btn btn--sm btn--primary" style={{ alignSelf: 'flex-start' }}
          onClick={() => store.update(t.id, askConfirmation)}>Send {first}'s email now</button>
      )}
      {t.confirm === 'asked' && (
        <div className="email-preview">
          <div className="email-preview__head">
            <span><span className="faint">To</span> {t.reporter.email}</span>
            <span className="strong">{confirmationSubject(t)}</span>
          </div>
          <div className="email-preview__body">
            <span>Hi {first},</span>
            <span>Airgas's schedule shows a delivery today for your report ({CATEGORY_LABEL[t.category]}, {locationLabel(t)}). Is the problem fixed?</span>
            <span>Just reply to this email with <strong>YES</strong> if it's fixed, or <strong>NO</strong> if it's still a problem.</span>
            <span>Thanks,<br />Rice Stockroom</span>
          </div>
          {demo && (
            <div className="email-preview__demo">
              <span className="faint" style={{ fontSize: 12 }}>Demo: pretend {first} replied</span>
              <div className="row-start">
                <button className="btn btn--xs btn--green" onClick={() => store.update(t.id, (x, n) => confirmDelivery(x, true, n, config.autoCloseOnConfirm))}>YES</button>
                <button className="btn btn--xs btn--danger" onClick={() => store.update(t.id, (x, n) => confirmDelivery(x, false, n, config.autoCloseOnConfirm))}>NO</button>
              </div>
            </div>
          )}
        </div>
      )}
      <a href={adminHref('queue', t.id)} style={{ fontSize: 13, fontWeight: 600 }}>Open ticket</a>
    </section>
  )
}
