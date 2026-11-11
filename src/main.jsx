import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// MÓVIL: al tocar un campo, la pantalla se desplaza sola para dejarlo a la vista
// (teclado + barra superior tapan el fondo). Usa scrollIntoView para que también
// funcione dentro de modales y secciones con scroll propio.
const esCampoEditable = (el) =>
  el instanceof HTMLElement &&
  ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) &&
  !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(el.type)

document.addEventListener('focusin', (e) => {
  if (!esCampoEditable(e.target)) return
  // Solo en pantallas táctiles/estrechas: en escritorio no debe molestar
  if (!window.matchMedia('(max-width: 900px), (pointer: coarse)').matches) return
  const el = e.target
  // Deja un margen para que la topbar y el teclado no tapen el campo
  setTimeout(() => {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      /* navegadores sin soporte: se omite */
    }
  }, 250)
}, true)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
