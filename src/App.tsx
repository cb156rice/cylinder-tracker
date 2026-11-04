import { AdminPage } from './admin/AdminPage'
import { ReportPage } from './report/ReportPage'
import { useRoute } from './router'
import { TopBar } from './TopBar'

export default function App() {
  const route = useRoute()
  return (
    <>
      <TopBar page={route.page} />
      {route.page === 'report' ? <ReportPage /> : <AdminPage tab={route.tab} ticketId={route.ticketId} ask={route.ask} />}
    </>
  )
}
