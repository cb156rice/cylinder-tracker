import { useState } from 'react'
import { activePeople, getSettings, riceStaff } from '../lib/directory'
import type { RiceStaff } from '../lib/types'
import { adminHref, type AdminTab } from '../router'
import { useNow, useTickets } from '../store/hooks'
import { HowItWorks } from './HowItWorks'
import { Queue } from './Queue'
import { SettingsPage } from './SettingsPage'
import { UsersPage } from './UsersPage'
import './admin.css'

const VIEWER_KEY = 'cylinder-tracker:viewer'

const defaultViewer = () => getSettings().alwaysCopied[0] ?? riceStaff()[0] ?? ''

function savedViewer(): RiceStaff {
  try {
    const v = localStorage.getItem(VIEWER_KEY) as RiceStaff | null
    return v && riceStaff().includes(v) ? v : defaultViewer()
  } catch { return defaultViewer() }
}

export function AdminPage({ tab, ticketId }: { tab: AdminTab; ticketId: string | null }) {
  const { tickets, loading } = useTickets()
  const now = useNow()
  // Prototype-only identity switch. Phase 2 uses whoever's GitHub token is signed in.
  const [viewer, setViewerState] = useState<RiceStaff>(savedViewer)
  const setViewer = (v: RiceStaff) => {
    setViewerState(v)
    try { localStorage.setItem(VIEWER_KEY, v) } catch { /* ignore */ }
  }

  const tabs: [AdminTab, string][] = [['queue', 'Queue'], ['users', 'Users'], ['settings', 'Settings'], ['how', 'How it works']]

  return (
    <>
      <header className="admin-head">
        <div className="admin-head__inner">
          <div className="admin-head__top">
            <div className="admin-head__title">
              <div className="eyebrow">Stockroom · Admin</div>
              <h1>Cylinder issues</h1>
            </div>
            <label className="viewer">
              Viewing as
              <select value={viewer} onChange={e => setViewer(e.target.value as RiceStaff)}>
                {activePeople('rice').map(p => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
              </select>
            </label>
          </div>
          <nav className="admin-tabs" aria-label="Admin sections">
            {tabs.map(([k, label]) => (
              <a key={k} href={adminHref(k)} aria-current={tab === k ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {loading ? null
        : tab === 'queue' ? <Queue tickets={tickets} now={now} viewer={viewer} selectedId={ticketId} />
        : tab === 'users' ? <UsersPage />
        : tab === 'settings' ? <SettingsPage />
        : <HowItWorks />}
    </>
  )
}
