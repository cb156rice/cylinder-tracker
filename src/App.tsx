import { ReportPage } from './report/ReportPage'
import { AdminPage } from './admin/AdminPage'
import { adminHref, reportHref, useRoute } from './router'
import { useDemoStore } from './store/hooks'

export default function App() {
  const route = useRoute()
  return (
    <>
      <DemoBar page={route.page} />
      {route.page === 'report' ? <ReportPage /> : <AdminPage tab={route.tab} ticketId={route.ticketId} />}
    </>
  )
}

function DemoBar({ page }: { page: 'report' | 'admin' }) {
  const demo = useDemoStore()
  if (!demo) return null
  const reset = () => {
    if (confirm('Reset the demo? This throws away every change made in this browser and reloads the sample tickets.')) demo.reset()
  }
  return (
    <div className="demo-bar">
      <div className="demo-bar__info">
        <span className="demo-bar__tag">DEMO</span>
        <span>Sample data, stored only in this browser. No emails are sent.</span>
      </div>
      <div className="demo-bar__actions">
        <nav className="seg" aria-label="Views">
          <a href={reportHref} aria-current={page === 'report' ? 'page' : undefined}>Public report form</a>
          <a href={adminHref()} aria-current={page === 'admin' ? 'page' : undefined}>Admin dashboard</a>
        </nav>
        <button className="demo-bar__reset" onClick={reset}>Reset demo</button>
      </div>
    </div>
  )
}
