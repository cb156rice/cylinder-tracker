import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './store/context'
import { LocalStore } from './store/localStore'

// Phase 1: demo data in the browser. Phase 2 swaps in the GitHub Issues store here.
const store = new LocalStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
)
