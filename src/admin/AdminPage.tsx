import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { isAdminLoggedIn, setAdminUnauthorizedHandler } from './adminApi'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn())
  const theme = useStore((s) => s.settings.theme)

  useEffect(() => {
    setAdminUnauthorizedHandler(() => setLoggedIn(false))
    return () => setAdminUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches))
    }

    applyTheme()
    if (theme !== 'system') return

    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [theme])

  if (!loggedIn) {
    return <AdminLogin onLogin={() => setLoggedIn(true)} />
  }

  return <AdminDashboard onLogout={() => {
    import('./adminApi').then(m => m.clearAdminToken())
    setLoggedIn(false)
  }} />
}
