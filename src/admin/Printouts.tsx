import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  CATEGORY_LABEL, DRIVER_ACTION, agendaAsk, agendaEta, authorName, driverGroups, lastMessage, locationLabel,
} from '../lib/rules'
import { fmtDay } from '../lib/time'
import type { Ticket } from '../lib/types'

export type PrintoutKind = 'agenda' | 'driver'

/** Visit agenda / driver stop sheet in a modal. Print uses the page's print styles (only the sheet prints). */
export function Printouts({ kind, setKind, tickets, now, onClose }: {
  kind: PrintoutKind; setKind: (k: PrintoutKind) => void; tickets: Ticket[]; now: Date; onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', onKey)
    document.body.classList.add('has-printout')
    return () => { removeEventListener('keydown', onKey); document.body.classList.remove('has-printout') }
  }, [onClose])

  const open = tickets.filter(t => t.status !== 'done')
  const title = kind === 'agenda' ? "Open issues for Ruben's visit" : 'Driver stop sheet'

  return createPortal(
    <div className="modal" onClick={onClose}>
      <div className="modal__box" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="modal__bar">
          <div className="switch" role="group" aria-label="Printout">
            <button aria-pressed={kind === 'agenda'} onClick={() => setKind('agenda')}>Visit agenda</button>
            <button aria-pressed={kind === 'driver'} onClick={() => setKind('driver')}>Driver stop sheet</button>
          </div>
          <div className="row-start" style={{ gap: 8 }}>
            <button className="btn btn--sm btn--primary" onClick={() => print()}>Print</button>
            <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        <div className="sheet">
          <div className="sheet__head">
            <div className="stack" style={{ gap: 4 }}>
              <span className="sheet__eyebrow">Rice University · Airgas</span>
              <span className="sheet__title">{title}</span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--body-2)' }}>{fmtDay(now)} · {open.length} open</span>
          </div>
          {kind === 'agenda' ? <Agenda tickets={open} /> : <Driver tickets={open} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Agenda({ tickets }: { tickets: Ticket[] }) {
  return (
    <div>
      <div className="sheet__row sheet__row--agenda sheet__th"><span>Ticket</span><span>Where</span><span>Latest on the thread</span><span>ETA</span><span>To discuss</span></div>
      {tickets.map(t => {
        const last = lastMessage(t)
        const text = last ? `${authorName(last, t)}: ${last.text.length > 110 ? last.text.slice(0, 107) + '…' : last.text}` : ''
        return (
          <div key={t.id} className="sheet__row sheet__row--agenda">
            <span className="mono" style={{ fontSize: 12 }}>{t.id}</span>
            <span className="stack" style={{ gap: 2 }}><span className="strong">{locationLabel(t)}</span><span className="muted">{CATEGORY_LABEL[t.category]} · since {fmtDay(new Date(t.createdAt))}</span></span>
            <span style={{ color: 'var(--body)' }}>{text}</span>
            <span className="strong">{agendaEta(t)}</span>
            <span>{agendaAsk(t)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Driver({ tickets }: { tickets: Ticket[] }) {
  return (
    <>
      {driverGroups(tickets).map(g => (
        <div key={g.building} className="stack" style={{ gap: 6 }}>
          <span className="sheet__group">{g.building}</span>
          <div className="sheet__row sheet__row--driver sheet__th"><span>Room</span><span>Order</span><span>Issue</span><span>Action</span><span>Done</span></div>
          {g.tickets.map(t => (
            <div key={t.id} className="sheet__row sheet__row--driver">
              <span className="strong">{t.room}</span>
              <span className="mono" style={{ fontSize: 12 }}>{t.order}</span>
              <span className="stack" style={{ gap: 2 }}><span className="strong">{CATEGORY_LABEL[t.category]}</span><span className="muted">{t.description}</span></span>
              <span className="stack" style={{ gap: 2 }}><span className="strong">{DRIVER_ACTION[t.category]}</span><span className="muted">On site: {t.reporter.name} {t.reporter.phone}</span></span>
              <span className="sheet__box" aria-label="Done checkbox" />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
