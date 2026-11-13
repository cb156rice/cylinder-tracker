import { useState, type FormEvent } from 'react'
import { FAQS, INSTALL_STEPS, SAFETY_PHONE } from '../content'
import { CATEGORIES, RESOLVER_LABEL, RESPONSE_LIMIT, coordinatorFor, validateReport, type ReportErrors } from '../lib/rules'
import { addBiz, fmt } from '../lib/time'
import type { ReportInput } from '../lib/types'
import { sendReport, type ReportPayload } from './sendReport'
import { randomTestReport, testEmail } from './testReports'
import './ReportPage.css'

const EMPTY: ReportInput = { name: '', email: '', phone: '', order: '', building: '', otherBuilding: '', room: '', category: '', description: '' }

export function ReportPage() {
  const [form, setForm] = useState<ReportInput>(EMPTY)
  const [errors, setErrors] = useState<ReportErrors>({})
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState<ReportPayload | null>(null)
  const [submitError, setSubmitError] = useState('')

  const set = <K extends keyof ReportInput>(k: K, v: ReportInput[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const er = validateReport(form)
    if (Object.keys(er).length) {
      setErrors(er)
      document.getElementById(`f-${Object.keys(er)[0]}`)?.focus()
      return
    }
    setSending(true)
    setSubmitError('')
    try {
      setSubmitted(await sendReport(form))
      scrollTo({ top: 0 })
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const text = (k: 'name' | 'email' | 'phone' | 'order' | 'room' | 'otherBuilding', label: string, placeholder: string, opts: { optional?: boolean; mono?: boolean; type?: string; autoComplete?: string } = {}) => (
    <label className="field">
      <span>{label}{opts.optional && <span className="field__opt"> · Optional</span>}</span>
      <input
        id={`f-${k}`} className={'input' + (opts.mono ? ' mono' : '')} type={opts.type ?? 'text'} autoComplete={opts.autoComplete}
        value={form[k]} placeholder={placeholder} aria-invalid={!!errors[k]} onChange={e => set(k, e.target.value)}
      />
      {errors[k] && <span className="field__error">{errors[k]}</span>}
    </label>
  )

  return (
    <>
      <header className="hero">
        <div className="hero__inner">
          <div className="hero__eyebrow">Rice University · Stockroom</div>
          <h1>Report a gas cylinder issue</h1>
          <p>For Airgas cylinder deliveries and problems in campus labs. Your report goes to the stockroom lead for your building, who will respond within 12 business hours.</p>
        </div>
      </header>
      <div className="wrap">
        <div className="safety" role="note">
          <span className="safety__dot" />
          <span><strong>Strong odor, active leak or alarm?</strong> Leave the area and call RUPD at {SAFETY_PHONE} first. Use this form afterward.</span>
        </div>
      </div>

      <main className="report-cols">
        <div className="card report-main">
          {submitted ? (
            <Success sent={submitted} onAnother={() => { setSubmitted(null); setForm(EMPTY); setErrors({}) }} />
          ) : (
            <form className="report-form" onSubmit={submit} noValidate>
              {import.meta.env.DEV && (
                <div className="test-fill">
                  <span>{testEmail ? <>Local testing · fills as <strong>{testEmail}</strong></> : <>Local testing · set VITE_TEST_EMAIL in .env.local to fill your email</>}</span>
                  <button type="button" className="btn" onClick={() => { setForm(randomTestReport()); setErrors({}) }}>Fill test report</button>
                </div>
              )}
              <fieldset className="section">
                <legend className="section__head"><span className="section__num">01</span><h2>Your contact info</h2></legend>
                <div className="grid3">
                  {text('name', 'Name', 'First and last name', { autoComplete: 'name' })}
                  {text('email', 'Email', 'netid@rice.edu', { type: 'email', autoComplete: 'email' })}
                  {text('phone', 'Phone', '713-348-0000', { optional: true, type: 'tel', autoComplete: 'tel' })}
                </div>
              </fieldset>

              <fieldset className="section">
                <legend className="section__head"><span className="section__num">02</span><h2>Order and location</h2></legend>
                <div className="grid3">
                  {text('order', 'Order number', 'From your Airgas confirmation', { mono: true })}
                  <label className="field">
                    Building
                    <select id="f-building" className="input" value={form.building} aria-invalid={!!errors.building}
                      onChange={e => set('building', e.target.value as ReportInput['building'])}>
                      <option value="">Select building</option>
                      <option value="sst">SST</option>
                      <option value="oconnor">O'Connor</option>
                      <option value="other">Other building</option>
                    </select>
                    {errors.building && <span className="field__error">{errors.building}</span>}
                  </label>
                  {text('room', 'Room number', 'e.g. 214')}
                </div>
                {form.building === 'other' && text('otherBuilding', 'Building name', 'Which building?')}
              </fieldset>

              <fieldset className="section">
                <legend className="section__head"><span className="section__num">03</span><h2>What's wrong?</h2></legend>
                <div id="f-category" className={'cats' + (errors.category ? ' cats--error' : '')} role="radiogroup" aria-label="Category" tabIndex={-1}>
                  {CATEGORIES.map(c => (
                    <button key={c.key} type="button" role="radio" aria-checked={form.category === c.key} className="cat" onClick={() => set('category', c.key)}>
                      <span className="cat__ring" />
                      <span className="cat__text"><span className="cat__label">{c.label}</span><span className="cat__hint">{c.hint}</span></span>
                    </button>
                  ))}
                </div>
                {errors.category && <span className="field__error" style={{ fontSize: 13 }}>{errors.category}</span>}
                <label className="field">
                  <span>Description of issue <span className="field__opt">{form.category === 'other' ? 'Required for Others' : 'Optional'}</span></span>
                  <textarea id="f-description" className="input" rows={4} value={form.description} aria-invalid={!!errors.description}
                    placeholder="What did you notice, which gas, and when?" onChange={e => set('description', e.target.value)} />
                  {errors.description && <span className="field__error">{errors.description}</span>}
                </label>
              </fieldset>

              <div className="report-foot">
                <span>{submitError ? <span className="field__error">{submitError}</span> : "You'll get a ticket number by email and be copied on the thread with Airgas."}</span>
                <button type="submit" className="btn btn--primary" disabled={sending}>{sending ? 'Sending…' : 'Submit report'}</button>
              </div>
            </form>
          )}
        </div>

        <aside className="report-side">
          <Faq />
          <section className="card side-card guide">
            <div className="side-card__head"><h3>Installation guide</h3><span className="draft-tag">DRAFT · ROBERT TO PROVIDE</span></div>
            <div className="guide__media">regulator install photo / video</div>
            <ol>
              {INSTALL_STEPS.map((s, i) => <li key={s}><span className="guide__n">{String(i + 1).padStart(2, '0')}</span><span>{s}</span></li>)}
            </ol>
            <a href="#/report" onClick={e => e.preventDefault()} aria-disabled="true">Download full guide (PDF)</a>
          </section>
        </aside>
      </main>
    </>
  )
}

function Success({ sent, onAnother }: { sent: ReportPayload; onAnother: () => void }) {
  const r = sent.report
  const due = addBiz(new Date(sent.submittedAt), RESPONSE_LIMIT)
  return (
    <div className="success" role="status">
      <span className="success__badge" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2>Report received</h2>
        <p>
          It goes to <strong>{r.building ? RESOLVER_LABEL[coordinatorFor(r.building)] : 'the stockroom'}</strong> and to Airgas.
          Your ticket number is on its way to <strong>{r.email}</strong> (usually within 15 minutes), and you'll be copied on the
          email thread. Expect a response by <strong>{fmt(due)}</strong>.
        </p>
      </div>
      <div className="success__actions">
        <button className="btn" onClick={onAnother}>Submit another report</button>
      </div>
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="card side-card">
      <div className="side-card__head"><h3>Troubleshooting FAQ</h3><span className="draft-tag">DRAFT · ROBERT TO PROVIDE</span></div>
      {FAQS.map((f, i) => (
        <div className="faq" key={f.q}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            {f.q}<span className="faq__sign">{open === i ? '–' : '+'}</span>
          </button>
          {open === i && <p>{f.a}</p>}
        </div>
      ))}
    </section>
  )
}
