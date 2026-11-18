import { PEOPLE, authorName, isAirgas } from '../lib/rules'
import { fmtShort } from '../lib/time'
import type { ThreadEntry, Ticket } from '../lib/types'
import { unsent } from '../lib/outbox'
import { useStore } from '../store/hooks'
import { GitHubStore } from '../store/githubStore'

/** The timeline: emails, auto-sent messages, call logs, confirmations, notes. */
export function Thread({ ticket: t, now }: { ticket: Ticket; now: Date }) {
  // Live mode only: the mailer job sends within about 15 minutes and then adds an "Emailed …" note.
  const live = useStore() instanceof GitHubStore
  const waiting = new Set(live ? unsent(t, now) : [])
  return (
    <ol className="timeline">
      {t.thread.map((e, i) => <Entry key={i} e={e} t={t} first={i === 0} pending={waiting.has(e)} />)}
    </ol>
  )
}

function Entry({ e, t, first, pending }: { e: ThreadEntry; t: Ticket; first: boolean; pending: boolean }) {
  const when = fmtShort(new Date(e.at))
  if (e.kind === 'note') {
    return <li className="note"><span className="mono">{when}</span><span>{e.text}</span></li>
  }
  let variant: string, tag = '', role: string
  switch (e.kind) {
    case 'auto': variant = 'auto'; tag = e.audience === 'reporter' ? `"Is it fixed?" email to ${t.reporter.name.split(' ')[0]}` : first ? 'Opening email' : 'Automatic email'; role = PEOPLE.tracker.role; break
    case 'call':
    case 'visit': variant = 'log'; tag = `${e.kind === 'call' ? 'Call' : 'Visit'} with ${PEOPLE[e.with].name} · logged`; role = PEOPLE[e.from].role; break
    case 'confirm': variant = 'confirm'; tag = 'Answer to "Is it fixed?"'; role = 'reporter'; break
    case 'email': variant = isAirgas(e.from) ? 'airgas' : 'rice'; role = PEOPLE[e.from].role; break
  }
  const added = e.kind === 'email' && e.added?.length ? `Added ${e.added.map(a => PEOPLE[a].name).join(', ')} to the thread` : ''
  return (
    <li className={`msg msg--${variant}`}>
      <div className="msg__head"><span><strong>{authorName(e, t)}</strong> <span className="faint">{role}</span></span><span className="mono faint">{when}</span></div>
      {tag && <span className="msg__tag">{tag}</span>}
      <span className="msg__text">{e.text}</span>
      {added && <span className="muted" style={{ fontSize: 12 }}>{added}</span>}
      {pending && <span className="msg__pending">Sending in the next few minutes…</span>}
    </li>
  )
}
