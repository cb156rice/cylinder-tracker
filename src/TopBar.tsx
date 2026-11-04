import { useState, type FormEvent } from 'react'
import { config } from './config'
import { fmtShort } from './lib/time'
import { adminHref, reportHref } from './router'
import { connect, disconnect } from './store/connection'
import { useDemoStore, useStore, useStoreStatus } from './store/hooks'

/** Dark strip above every page: which data you're looking at, view switch, and connect/reset. */
export function TopBar({ page }: { page: 'report' | 'admin' }) {
  const store = useStore()
  const demo = useDemoStore()
  const status = useStoreStatus()
  const [connecting, setConnecting] = useState(false)

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
                . No emails are sent yet.
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
              <button className="demo-bar__reset" onClick={() => store.refresh?.().catch(() => {})} disabled={status?.syncing}>Refresh</button>
              <button className="demo-bar__reset" onClick={leave}>Disconnect</button>
            </>
          )}
        </div>
      </div>
      {status?.error && <div className="error-bar" role="alert">{status.error}</div>}
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
          Paste a GitHub token that can read and write issues in <span className="mono">{config.dataRepo.owner}/{config.dataRepo.name}</span>.
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
