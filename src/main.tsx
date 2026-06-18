import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installMobileViewportGuards } from './lib/viewport'

installMobileViewportGuards()

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }
}

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

if (isAdminRoute) {
  const AdminPage = lazy(() => import('./admin/AdminPage'))
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
        <AdminPage />
      </Suspense>
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
