import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Clock, Download, Expand, ImageIcon, Loader2, Trash2, X } from 'lucide-react'
import type { TaskRecord } from '../types'
import { ensureImageCached, getCachedImage, useStore } from '../store'

interface Props {
  task: TaskRecord
  onDelete: () => void
  onClick: (e: React.MouseEvent | React.TouchEvent) => void
  isSelected?: boolean
}

function formatDateTime(timestamp: number) {
  const date = new Date(timestamp)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`
}

function durationText(task: TaskRecord, now: number) {
  let seconds: number
  if (task.status === 'running' || task.status === 'queued') {
    seconds = Math.floor((now - task.createdAt) / 1000)
  } else if (task.elapsed != null) {
    seconds = Math.floor(task.elapsed / 1000)
  } else {
    seconds = 0
  }
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function statusBadge(task: TaskRecord) {
  if (task.status === 'running') return { text: '生成中', className: 'bg-blue-500 text-white' }
  if (task.status === 'queued') return { text: '排队中', className: 'bg-amber-400 text-white' }
  if (task.status === 'error') return { text: '失败', className: 'bg-red-500 text-white' }
  return { text: '已完成', className: 'bg-emerald-500 text-white' }
}

export default function TaskCard({
  task,
  onDelete,
  onClick,
  isSelected,
}: Props) {
  const [thumbSrc, setThumbSrc] = useState('')
  const [now, setNow] = useState(Date.now())
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeStartedSelected, setSwipeStartedSelected] = useState(false)
  const [swipeActionActive, setSwipeActionActive] = useState(false)
  const toggleTaskSelection = useStore((s) => s.toggleTaskSelection)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeResetTimerRef = useRef<number | null>(null)
  const suppressClickUntilRef = useRef(0)
  const horizontalSwipeRef = useRef(false)

  useEffect(() => () => {
    if (swipeResetTimerRef.current != null) window.clearTimeout(swipeResetTimerRef.current)
  }, [])

  useEffect(() => {
    if (task.status !== 'running' && task.status !== 'queued') return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [task.status])

  useEffect(() => {
    setThumbSrc('')
    if (!task.outputImages?.[0]) return

    const cached = getCachedImage(task.outputImages[0])
    if (cached) {
      setThumbSrc(cached)
      return
    }
    ensureImageCached(task.outputImages[0]).then((url) => {
      if (url) setThumbSrc(url)
    })
  }, [task.outputImages])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
      swipeResetTimerRef.current = null
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    horizontalSwipeRef.current = false
    setSwipeStartedSelected(Boolean(isSelected))
    setSwipeActionActive(false)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const deltaX = e.touches[0].clientX - touchStartRef.current.x
    const deltaY = e.touches[0].clientY - touchStartRef.current.y

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      horizontalSwipeRef.current = true
      e.preventDefault()
      const boundedOffset = Math.max(-60, Math.min(60, deltaX))
      setSwipeOffset(boundedOffset)
      setSwipeActionActive(Math.abs(deltaX) >= 40)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsSwiping(false)
    setSwipeOffset(0)

    if (!touchStartRef.current) return
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    touchStartRef.current = null
    const isSwipeAction = horizontalSwipeRef.current && Math.abs(deltaX) > 40
    horizontalSwipeRef.current = false
    setSwipeActionActive(isSwipeAction)
    swipeResetTimerRef.current = window.setTimeout(() => {
      setSwipeActionActive(false)
      swipeResetTimerRef.current = null
    }, 220)

    if (isSwipeAction) {
      suppressClickUntilRef.current = Date.now() + 350
      e.preventDefault()
      e.stopPropagation()
      toggleTaskSelection(task.id)
    }
  }

  const handleTouchCancel = () => {
    touchStartRef.current = null
    horizontalSwipeRef.current = false
    setIsSwiping(false)
    setSwipeOffset(0)
    setSwipeActionActive(false)
  }

  const showSwipeAction = Math.abs(swipeOffset) >= 40 || swipeActionActive
  const swipeBgClass = showSwipeAction
    ? swipeStartedSelected
      ? 'bg-gray-500 dark:bg-gray-600'
      : 'bg-blue-500'
    : 'bg-gray-200 dark:bg-gray-700'
  const resolutionName = task.templateResolutionName || ''
  const title = task.prompt?.split('·')[0]?.trim() || '标题'
  const elapsed = durationText(task, now)
  const badge = statusBadge(task)

  return (
    <div className="relative rounded-2xl">
      <div
        className={`absolute inset-0 flex items-center rounded-2xl transition-opacity duration-200 pointer-events-none ${
          isSwiping || swipeOffset || swipeActionActive ? 'opacity-100' : 'opacity-0'
        } ${swipeBgClass} ${swipeOffset > 0 ? 'justify-start pl-6' : 'justify-end pr-6'}`}
      >
        {swipeStartedSelected && showSwipeAction ? (
          <X className={`h-7 w-7 transition-transform duration-150 ${showSwipeAction ? 'scale-110 text-white' : 'scale-90 text-white/60'}`} />
        ) : (
          <Check className={`h-7 w-7 transition-transform duration-150 ${showSwipeAction ? 'scale-110 text-white' : 'scale-90 text-white/60'}`} strokeWidth={3} />
        )}
      </div>

      <article
        className={`group relative h-[202px] cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-[0_2px_7px_rgba(15,23,42,0.08)] transition hover:-translate-y-px hover:shadow-[0_4px_10px_rgba(15,23,42,0.09)] dark:bg-gray-950 ${
          task.status === 'running'
            ? 'border-blue-400 generating'
            : task.status === 'queued'
              ? 'border-yellow-400'
              : isSelected
                ? 'border-blue-500 ring-2 ring-blue-500/45'
                : 'border-[#777] dark:border-white/[0.18]'
        }`}
        style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}
        onClick={(e) => {
          if (Date.now() < suppressClickUntilRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
          onClick(e)
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {isSelected && (
          <div className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-sm">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        )}

        <div className="relative h-[126px] bg-white dark:bg-white/[0.03]">
          {!isSelected && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (task.outputImages?.[0]) setLightboxImageId(task.outputImages[0], task.outputImages)
                }}
                disabled={!task.outputImages?.length}
                className="absolute left-2 top-2 z-10 rounded-lg bg-white/85 p-1.5 text-black shadow-sm transition hover:bg-white disabled:opacity-40 dark:bg-gray-950/70 dark:text-white"
                title="放大查看"
              >
                <Expand className="h-4 w-4" strokeWidth={3} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!thumbSrc) return
                  const link = document.createElement('a')
                  link.href = thumbSrc
                  link.download = `${task.id}.png`
                  link.click()
                }}
                disabled={!thumbSrc}
                className="absolute right-2 top-2 z-10 rounded-lg bg-white/85 p-1.5 text-black shadow-sm transition hover:bg-white disabled:opacity-40 dark:bg-gray-950/70 dark:text-white"
                title="下载图片"
              >
                <Download className="h-4 w-4" strokeWidth={3} />
              </button>
            </>
          )}

          {task.status === 'running' && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="text-xs font-bold text-blue-500">生成中...</span>
            </div>
          )}
          {task.status === 'queued' && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Clock className="h-8 w-8 text-yellow-500" />
              <span className="text-xs font-bold text-yellow-500">排队中...</span>
            </div>
          )}
          {task.status === 'error' && (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-2">
              <AlertCircle className="h-7 w-7 text-red-500" />
              <span className="text-center text-xs font-bold text-red-500">失败</span>
            </div>
          )}
          {task.status === 'done' && thumbSrc && (
            <img src={thumbSrc} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          {task.status === 'done' && !thumbSrc && (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="h-9 w-9 text-gray-300" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="relative h-[76px] px-3 py-2.5 pr-10 text-[12px] leading-[1.35] text-black dark:text-gray-100">
          <div className="truncate text-sm font-black">{title}</div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {resolutionName && <span className="min-w-0 truncate rounded-full bg-[#edf6ff] px-2 py-0.5 text-[10px] font-bold text-[#98a2b3] dark:bg-white/[0.06] dark:text-gray-400">{resolutionName}</span>}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${badge.className}`}>
              {badge.text}
            </span>
            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">耗时：{elapsed}</span>
          </div>
          <div className="mt-1 truncate text-[11px] font-bold text-[#98a2b3] dark:text-gray-500">
            创建于 {formatDateTime(task.createdAt)}
          </div>

          {!isSelected && (
            <div className="absolute bottom-2 right-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-black transition hover:bg-red-50 hover:text-red-500 dark:text-gray-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                title="删除记录"
              >
                <Trash2 className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}
