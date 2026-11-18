import { useState, type FormEvent } from 'react'
import { config } from './config'
import { fmtShort } from './lib/time'
import { adminHref, reportHref } from './router'
import { connect, disconnect } from './store/connection'
import { GitHubStore } from './store/githubStore'
import { useDemoStore, useStore, useStoreStatus } from './store/hooks'

/** Dark strip above every page: which data you're looking at, view switch, and connect/reset. */
export function TopBar({ page }: { page: 'report' | 'admin' }) {
  const store = useStore()
  const demo = useDemoStore()
  const status = useStoreStatus()
  const [connecting, setConnecting] = useState(false)
  const [mail, setMail] = useState<{ state: 'idle' | 'starting' | 'running' } | { state: 'error'; message: string }>({ state: 'idle' })

  async function checkMail() {
    if (!(store instanceof GitHubStore)) return
    setMail({ state: 'starting' })
    try {
      const result = await store.checkMail(() => setMail({ state: 'running' }))
      setMail(result === 'success' ? { state: 'idle' } : { state: 'error', message: result === 'timed out' ? 'The mail check is taking longer than usual. Tickets will update when it finishes.' : `The mail check didn't finish (${result}). See the Actions tab of ${config.dataRepo.name} for details.` })
    } catch (e) {
      setMail({ state: 'error', message: (e as Error).message })
    }
  }
  const checking = mail.state === 'starting' || mail.state === 'running'

  const reset = () => {
    if (confirm('Reset the demo? This throws away every change made in this browser and reloads the sample tickets.')) demo?.reset()
  }
  const leave = () => {
    if (confirm('Disconnect this browser from GitHub? The token is removed from this browser and the demo data comes back.')) {
      disconnect(); location.reload()
    }
  }

  return (
    <>
      <div className="demo-bar">
        <div className="demo-bar__info">
          {demo ? (
            <><span className="demo-bar__tag">DEMO</span><span>Sample data, stored only in this browser. No emails are sent.</span></>
          ) : (
            <>
              <span className="demo-bar__tag demo-bar__tag--live">LIVE</span>
              <span>
                Shared data in {config.dataRepo.name}
                {status?.syncing ? ' · syncing…' : status?.lastSync ? ` · updated ${fmtShort(status.lastSync)}` : ''}
                . Emails go out about every 15 minutes, or now with Check mail now.
              </span>
            </>
          )}
        </div>
        <div className="demo-bar__actions">
          <nav className="seg" aria-label="Views">
            <a href={reportHref} aria-current={page === 'report' ? 'page' : undefined}>Public report form</a>
            <a href={adminHref()} aria-current={page === 'admin' ? 'page' : undefined}>Admin dashboard</a>
          </nav>
          {demo ? (
            <>
              <button className="demo-bar__reset" onClick={reset}>Reset demo</button>
              <button className="demo-bar__reset" onClick={() => setConnecting(true)}>Connect to GitHub</button>
            </>
          ) : (
            <>
              <button className="demo-bar__reset demo-bar__primary" onClick={checkMail} disabled={checking}
                title="Reads the tracker inbox, sends queued emails, then refreshes. Takes about a minute.">
                {mail.state === 'starting' ? 'Starting…' : mail.state === 'running' ? 'Checking mail…' : 'Check mail now'}
              </button>
              <button className="demo-bar__reset" onClick={() => store.refresh?.().catch(() => {})} disabled={status?.syncing}>Refresh</button>
              <button className="demo-bar__reset" onClick={leave}>Disconnect</button>
            </>
          )}
        </div>
      </div>
      {status?.error && <div className="error-bar" role="alert">{status.error}</div>}
      {mail.state === 'error' && <div className="error-bar" role="alert">{mail.message} <button className="link-btn" style={{ color: 'inherit' }} onClick={() => setMail({ state: 'idle' })}>Dismiss</button></div>}
      {connecting && <ConnectDialog onClose={() => setConnecting(false)} />}
    </>
  )
}

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setBusy(true); setError('')
    try {
      await connect(token)
      location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="modal__box connect" role="dialog" aria-modal="true" aria-label="Connect to GitHub" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2 className="h2">Connect to the shared tickets</h2>
        <p>
          Paste a GitHub token for <span className="mono">{config.dataRepo.owner}/{config.dataRepo.name}</span> with Issues: Read and write (and Actions: Read and write, for Check mail now).
          It's saved only in this browser, and the dashboard then shows the same tickets to everyone who's connected.
        </p>
        <label className="field">
          GitHub token
          <input className="input mono" type="password" autoComplete="off" spellCheck={false} value={token}
            onChange={e => setToken(e.target.value)} placeholder="github_pat_…" autoFocus aria-invalid={!!error} />
          {error && <span className="field__error">{error}</span>}
        </label>
        <div className="row-end" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !token.trim()}>{busy ? 'Checking…' : 'Connect'}</button>
        </div>
      </form>
    </div>
  )
}
