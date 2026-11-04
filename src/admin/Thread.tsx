import { PEOPLE, authorName, isAirgas } from '../lib/rules'
import { fmtShort } from '../lib/time'
import type { ThreadEntry, Ticket } from '../lib/types'

/** Participant chips, then the timeline: emails, auto-sent messages, call logs, confirmations, notes. */
export function Thread({ ticket: t }: { ticket: Ticket }) {
  const chips = [
    ...t.participants.map(p => ({ label: `${PEOPLE[p].name} · ${PEOPLE[p].role.split(' · ')[1]}`, airgas: isAirgas(p) })),
    ...(t.participants.includes(t.coordinator) ? [] : [{ label: `${PEOPLE[t.coordinator].name} · coordinator`, airgas: false }]),
    { label: `${t.reporter.name.split(' ')[0]} · reporter`, airgas: false },
  ]
  return (
    <>
      <div className="chips">
        {chips.map(c => <span key={c.label} className={'chip' + (c.airgas ? ' chip--airgas' : '')}>{c.label}</span>)}
      </div>
      <ol className="timeline">
        {t.thread.map((e, i) => <Entry key={i} e={e} t={t} first={i === 0} />)}
      </ol>
    </>
  )
}

function Entry({ e, t, first }: { e: ThreadEntry; t: Ticket; first: boolean }) {
  const when = fmtShort(new Date(e.at))
  if (e.kind === 'note') {
    return <li className="note"><span className="mono">{when}</span><span>{e.text}</span></li>
  }
  let variant: string, tag = '', role: string
  switch (e.kind) {
    case 'auto': variant = 'auto'; tag = first ? 'Opening email · sent automatically' : 'Sent automatically'; role = PEOPLE.tracker.role; break
    case 'call':
    case 'visit': variant = 'log'; tag = `${e.kind === 'call' ? 'Call' : 'Visit'} with ${PEOPLE[e.with].name} · logged`; role = PEOPLE[e.from].role; break
    case 'confirm': variant = 'confirm'; tag = 'Delivery confirmation'; role = 'reporter'; break
    case 'email': variant = isAirgas(e.from) ? 'airgas' : 'rice'; role = PEOPLE[e.from].role; break
  }
  const added = e.kind === 'email' && e.added?.length ? `Added ${e.added.map(a => PEOPLE[a].name).join(', ')} to the thread` : ''
  return (
    <li className={`msg msg--${variant}`}>
      <div className="msg__head"><span><strong>{authorName(e, t)}</strong> <span className="faint">{role}</span></span><span className="mono faint">{when}</span></div>
      {tag && <span className="msg__tag">{tag}</span>}
      <span className="msg__text">{e.text}</span>
      {added && <span className="muted" style={{ fontSize: 12 }}>{added}</span>}
    </li>
  )
}
