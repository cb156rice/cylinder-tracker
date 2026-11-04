import { ReportPage } from './report/ReportPage'
import { href, useRoute } from './router'
import { useDemoStore } from './store/hooks'

export default function App() {
  const route = useRoute()
  return (
    <>
      <DemoBar route={route} />
      {route === 'report' ? <ReportPage /> : <AdminPlaceholder />}
    </>
  )
}

function DemoBar({ route }: { route: string }) {
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
          <a href={href('report')} aria-current={route === 'report' ? 'page' : undefined}>Public report form</a>
          <a href={href('admin')} aria-current={route === 'admin' ? 'page' : undefined}>Admin dashboard</a>
        </nav>
        <button className="demo-bar__reset" onClick={reset}>Reset demo</button>
      </div>
    </div>
  )
}

function AdminPlaceholder() {
  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ color: 'var(--navy)', fontSize: 26 }}>Cylinder issues</h1>
      <p style={{ color: 'var(--muted)' }}>The admin dashboard is the next step.</p>
    </main>
  )
}
