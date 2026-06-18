import { useEffect } from 'react'
import { getChangelogDismissKey, initStore, useStore } from './store'
import Header from './components/Header'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import MaskEditorModal from './components/MaskEditorModal'
import LoginModal from './components/LoginModal'
import AnnouncementModal from './components/AnnouncementModal'
import ChangelogModal from './components/ChangelogModal'
import MigrationModal from './components/MigrationModal'

export default function App() {
  const authUser = useStore((s) => s.authUser)
  const theme = useStore((s) => s.settings.theme)
  const latestChangelog = useStore((s) => s.latestChangelog)
  const dismissedChangelogKeys = useStore((s) => s.dismissedChangelogKeys)
  const showChangelog = useStore((s) => s.showChangelog)
  const setShowChangelog = useStore((s) => s.setShowChangelog)

  useEffect(() => {
    initStore()
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

  useEffect(() => {
    if (!latestChangelog?.published || !latestChangelog.version.trim()) return
    const key = getChangelogDismissKey(latestChangelog)
    if (!dismissedChangelogKeys.includes(key)) {
      setShowChangelog(true, key)
    }
  }, [latestChangelog, dismissedChangelogKeys, setShowChangelog])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <Header />
      <main data-home-main className="safe-area-x mx-auto grid min-h-[calc(100vh-6.25rem)] w-full max-w-[1920px] gap-4 px-6 py-6 lg:grid-cols-[minmax(420px,630px)_minmax(0,1fr)] 2xl:grid-cols-[630px_minmax(0,1fr)]">
        <InputBar />
        <TaskGrid />
      </main>
      <DetailModal />
      <Lightbox />
      <SettingsModal />
      <ConfirmDialog />
      <Toaster />
      <AnnouncementModal mode="auto" />
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      <MaskEditorModal />
      {!authUser && <LoginModal />}
      {authUser?.needsMigration && <MigrationModal />}
    </TooltipProvider>
  )
}
