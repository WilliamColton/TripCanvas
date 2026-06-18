import { Palette } from 'lucide-react'
import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import type { ThemeMode } from '../types'
import { Dialog, DialogContent } from './ui/dialog'

interface AppearanceModalProps {
  onClose: () => void
}

const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

export default function AppearanceModal({ onClose }: AppearanceModalProps) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)

  useCloseOnEscape(true, onClose)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md" data-no-drag-select hideClose>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-500" />
            外观
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100/70 p-1 dark:bg-white/[0.04]">
          {themeOptions.map((option) => {
            const active = settings.theme === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSettings({ theme: option.value })}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.12] dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
