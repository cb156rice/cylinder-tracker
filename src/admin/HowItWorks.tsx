import type { ReactNode } from 'react'

const STEPS: [string, ReactNode][] = [
  ['New report', <>
    <span>An email thread starts automatically with Ruben and Gordan, with the order number, location and contact. The building lead and the reporter are copied.</span>
    <span className="chips" style={{ fontSize: 13 }}>
      <span className="chip chip--airgas">SST → Israel</span>
      <span className="chip chip--airgas">O'Connor → Robert</span>
      <span className="chip chip--airgas">Other → Javier</span>
    </span>
  </>],
  ['Replies', 'Every reply-all lands on the ticket within about 15 minutes (or right away with "Check mail now"), including people added to the thread. Dates in a reply are suggested as the ETA; the coordinator confirms.'],
  ['No reply', <span key="b">After 12 business hours the tracker follows up on the same thread, and Javier is notified. The coordinator can press <strong>Escalate to Chris</strong> to add the regional manager with a summary.</span>],
  ['Calls and visits', <span key="b">Write down a phone call or visit under <strong>More options</strong>. It's kept on the ticket and never emailed.</span>],
  ['Confirming the fix', 'The daily delivery schedule comes to the tracker mailbox and is matched by order number. At 4 PM the reporter gets an email asking them to reply YES or NO. YES closes the ticket; NO reopens it and replies on the Airgas thread.'],
  ['Email drafting', 'Claude (Anthropic) writes drafts from the ticket and thread. Nothing is sent until the coordinator presses Send. The API key stays in a GitHub secret and is never sent to the browser.'],
]

const TARGETS = [
  { label: 'Not started → In progress', value: '12 hrs', sub: '1.5 business days', dot: 'var(--red-dot)' },
  { label: 'Low complexity', value: '12 hrs', sub: '1.5 business days', dot: 'var(--yellow-dot)' },
  { label: 'Medium complexity', value: '16 hrs', sub: '2 business days', dot: 'var(--yellow-dot)' },
  { label: 'High complexity', value: '40 hrs', sub: '1 business week', dot: 'var(--yellow-dot)' },
]

const OPEN_QUESTIONS = [
  'Can Airgas send the daily schedule straight to the tracker address? In what format?',
  `Should a lab's "YES, it's fixed" close the ticket, or wait for the coordinator?`,
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
          <h2 className="h2" style={{ marginBottom: 10 }}>Response targets</h2>
          {TARGETS.map(r => (
            <div key={r.label} className="target">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><span className="dot" style={{ background: r.dot, width: 9, height: 9 }} />{r.label}</span>
              <span className="stack" style={{ alignItems: 'flex-end', gap: 2 }}><span className="strong" style={{ fontSize: 14 }}>{r.value}</span><span className="faint" style={{ fontSize: 12 }}>{r.sub}</span></span>
            </div>
          ))}
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5 }}>Clocks count 9 AM–5 PM, Monday–Friday, Houston time. The resolution clock starts when complexity is set.</p>
        </section>
        <section className="card how">
          <h2 className="h2" style={{ marginBottom: 10 }}>To decide</h2>
          <ul className="how__list">{OPEN_QUESTIONS.map(q => <li key={q}>{q}</li>)}</ul>
        </section>
      </div>
    </main>
  )
}
