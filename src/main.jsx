import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const esCampoEditable = (el) =>
  el instanceof HTMLElement &&
  ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) &&
  !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(el.type)

document.addEventListener('focusin', (e) => {
  if (!esCampoEditable(e.target)) return
  if (!window.matchMedia('(max-width: 900px), (pointer: coarse)').matches) return
  const el = e.target
  setTimeout(() => {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
    }
  }, 250)
}, true)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
