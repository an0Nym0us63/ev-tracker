import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // When a new SW is waiting, reload to apply update
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available — reload automatically
            navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
            newWorker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }).catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
