import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen } from 'lucide-react'
import { getChangelogDismissKey, loadChangelogEntries, useStore } from '../store'
import type { ChangelogEntry } from '../types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { EmptyState } from './ui/empty-state'
import { ScrollArea } from './ui/scroll-area'

interface ChangelogModalProps {
  onClose: () => void
}

function formatTime(ms: number | null) {
  if (!ms) return '-'
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTitle(entry: ChangelogEntry) {
  return entry.title || '更新日志'
}

export default function ChangelogModal({ onClose }: ChangelogModalProps) {
  const latestChangelog = useStore((s) => s.latestChangelog)
  const entries = useStore((s) => s.changelogEntries)
  const pendingDismissKey = useStore((s) => s.pendingChangelogDismissKey)
  const dismissChangelog = useStore((s) => s.dismissChangelog)
  const showToast = useStore((s) => s.showToast)
  const [selectedId, setSelectedId] = useState(latestChangelog?.id || '')
  const [loading, setLoading] = useState(entries.length === 0)

  useEffect(() => {
    let cancelled = false
    setLoading(entries.length === 0)
    loadChangelogEntries()
      .then((loaded) => {
        if (cancelled) return
        if (!selectedId) setSelectedId(latestChangelog?.id || loaded[0]?.id || '')
      })
      .catch((err) => {
        if (!cancelled) showToast(err instanceof Error ? err.message : String(err), 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const visibleEntries = useMemo(() => {
    if (entries.length > 0) return entries
    return latestChangelog ? [latestChangelog] : []
  }, [entries, latestChangelog])

  const selected = visibleEntries.find(entry => entry.id === selectedId) || visibleEntries[0] || null

  function handleClose() {
    if (pendingDismissKey) dismissChangelog(pendingDismissKey)
    onClose()
  }

  return createPortal(
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent data-no-drag-select className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            更新日志
          </DialogTitle>
          {latestChangelog && <DialogDescription>当前版本 v{latestChangelog.version}</DialogDescription>}
        </DialogHeader>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">加载中...</div>
        ) : visibleEntries.length === 0 || !selected ? (
          <EmptyState title="暂无更新日志" />
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[180px_1fr]">
            <ScrollArea className="min-h-0 whitespace-nowrap pb-2 md:max-h-[58vh] md:whitespace-normal md:pb-0">
              <div className="flex gap-2 md:block md:space-y-2">
                {visibleEntries.map(entry => {
                  const active = entry.id === selected.id
                  return (
                    <Button
                      key={entry.id}
                      type="button"
                      variant={active ? 'secondary' : 'outline'}
                      onClick={() => setSelectedId(entry.id)}
                      className={`h-auto min-w-32 justify-start px-3 py-2 text-left md:w-full ${active ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400' : ''}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs">v{entry.version}</span>
                        <span className="mt-1 block truncate text-xs opacity-80">{getTitle(entry)}</span>
                      </span>
                    </Button>
                  )
                })}
              </div>
            </ScrollArea>

            <ScrollArea className="min-h-0 max-h-[58vh] pr-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge>v{selected.version}</Badge>
                <span className="text-xs text-gray-400 dark:text-gray-500">发布于 {formatTime(selected.publishedAt)}</span>
              </div>
              <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">{getTitle(selected)}</h4>
              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-600 dark:text-gray-300">
                {selected.content || '暂无内容'}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>,
    document.body,
  )
}

export function shouldAutoOpenChangelog(changelog: ChangelogEntry | null, dismissedKeys: string[]) {
  return Boolean(
    changelog?.published &&
    changelog.version.trim() &&
    !dismissedKeys.includes(getChangelogDismissKey(changelog)),
  )
}
