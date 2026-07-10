import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const updateEqualsRedeemerViewportMetrics = () => {
  document.documentElement.style.setProperty('--eq-window-height', `${window.innerHeight}px`)
}

updateEqualsRedeemerViewportMetrics()
window.addEventListener('resize', updateEqualsRedeemerViewportMetrics)
window.visualViewport?.addEventListener('resize', updateEqualsRedeemerViewportMetrics)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
