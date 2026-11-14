import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import UpdateNotice from './components/UpdateNotice'
import { watchUnhandled } from './lib/errors'

watchUnhandled()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UpdateNotice />
    <App />
  </StrictMode>,
)
