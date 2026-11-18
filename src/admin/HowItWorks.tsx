import type { ReactNode } from 'react'

const STEPS: [string, ReactNode][] = [
  ['New report', <>
    <span>Within about 15 minutes the tracker emails Ruben and Gordan at Airgas with the order number, location and contact. The building lead and the reporter are copied.</span>
    <span className="muted">SST → Israel · O'Connor → Robert · other buildings → Javier</span>
  </>],
  ['Airgas replies', 'Every reply-all lands on the ticket within about 15 minutes. The first reply from Airgas moves the ticket to In progress by itself. If a reply has a date ("tomorrow", "Friday"), it becomes the expected date; the lead can ignore it if it was read wrong.'],
  ['Due dates', 'Airgas has 12 business hours to reply. After that, the fix is due on the date Airgas gave, or 2 business days after the report if they never gave one. Late tickets are marked Late in the queue.'],
  ['Is it fixed?', 'When the fix due date passes, the reporter gets an email: "Is it fixed? Reply YES or NO." YES closes the ticket. NO tells Airgas on the thread and waits for a new date. This also catches fixes Airgas makes without replying.'],
  ['Rice steps in', <span key="b">Anyone can reply on the thread, close a ticket with <strong>Mark fixed</strong>, or under <strong>More options</strong> escalate to Chris or write down a phone call or visit (kept on the ticket, never emailed).</span>],
]

const TARGETS = [
  { label: 'Airgas reply', value: '12 hrs', sub: '1.5 business days after the report' },
  { label: 'Fix, no date given', value: '16 hrs', sub: '2 business days after the report' },
  { label: 'Fix, date given', value: 'That day', sub: 'by 5 PM' },
]

const OPEN_QUESTIONS = [
  `Should a reporter's YES close the ticket, or wait for the lead?`,
  'Should Rice holidays pause the clock?',
  'Which other buildings get cylinders, and who coordinates them?',
]

export function HowItWorks() {
  return (
    <main className="admin-body admin-body--cols">
      <section className="card how">
        <h2 className="h2" style={{ marginBottom: 10 }}>How a ticket moves</h2>
        {STEPS.map(([title, body]) => (
          <div key={title} className="how__row">
            <span className="how__title">{title}</span>
            <div className="how__body">{body}</div>
          </div>
        ))}
      </section>
      <div className="deliv-side" style={{ flexBasis: 360, gap: 20 }}>
        <section className="card how">
          <h2 className="h2" style={{ marginBottom: 10 }}>Targets for Airgas</h2>
          {TARGETS.map(r => (
            <div key={r.label} className="target">
              <span style={{ fontSize: 14 }}>{r.label}</span>
              <span className="stack" style={{ alignItems: 'flex-end', gap: 2 }}><span className="strong" style={{ fontSize: 14 }}>{r.value}</span><span className="faint" style={{ fontSize: 12 }}>{r.sub}</span></span>
            </div>
          ))}
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5 }}>Hours count 9 AM–5 PM, Monday–Friday, Houston time.</p>
        </section>
        <section className="card how">
          <h2 className="h2" style={{ marginBottom: 10 }}>To decide</h2>
          <ul className="how__list">{OPEN_QUESTIONS.map(q => <li key={q}>{q}</li>)}</ul>
        </section>
      </div>
    </main>
  )
}
