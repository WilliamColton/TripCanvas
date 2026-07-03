import { useMemo, useRef, useState, useEffect } from 'react'
import { Download, ImageIcon, Trash2, X } from 'lucide-react'
import { ensureImageCached, useStore, removeMultipleTasks, removeTask } from '../store'
import TaskCard from './TaskCard'

const HISTORY_LIMIT = 16

export default function TaskGrid() {
  const tasks = useStore((s) => s.tasks)
  const searchQuery = useStore((s) => s.searchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const selectedTaskIds = useStore((s) => s.selectedTaskIds)
  const setSelectedTaskIds = useStore((s) => s.setSelectedTaskIds)
  const clearSelection = useStore((s) => s.clearSelection)
  const showToast = useStore((s) => s.showToast)
  const hasOverlayOpen = useStore((s) =>
    Boolean(s.detailTaskId || s.lightboxImageId || s.maskEditorImageId || s.showSettings || s.confirmDialog),
  )

  const rootRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [barLeft, setBarLeft] = useState<number | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const hasDragged = useRef(false)
  const suppressClickUntil = useRef(0)
  const startedOnCard = useRef(false)
  const startedWithCtrl = useRef(false)
  const initialSelection = useRef<string[]>([])
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    const updateBarLeft = () => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setBarLeft(rect.left + rect.width / 2)
    }
    updateBarLeft()
    window.addEventListener('resize', updateBarLeft)
    window.addEventListener('scroll', updateBarLeft, true)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateBarLeft) : null
    if (ro && rootRef.current) ro.observe(rootRef.current)
    return () => {
      window.removeEventListener('resize', updateBarLeft)
      window.removeEventListener('scroll', updateBarLeft, true)
      ro?.disconnect()
    }
  }, [])

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt)
    const q = searchQuery.trim().toLowerCase()
    
    return sorted.filter((t) => {
      if (filterFavorite && !t.isFavorite) return false
      const matchStatus = filterStatus === 'all' || t.status === filterStatus
      if (!matchStatus) return false
      
      if (!q) return true
      const prompt = (t.prompt || '').toLowerCase()
      const paramStr = JSON.stringify(t.params).toLowerCase()
      return prompt.includes(q) || paramStr.includes(q)
    })
  }, [tasks, searchQuery, filterStatus, filterFavorite])

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIds.includes(task.id)),
    [tasks, selectedTaskIds],
  )
  const selectedDownloadItems = useMemo(
    () => selectedTasks.flatMap((task) =>
      (task.outputImages || []).map((imageId, imageIndex) => ({ taskId: task.id, imageId, imageIndex })),
    ),
    [selectedTasks],
  )
  const selectedTasksWithoutOutputs = selectedTasks.filter((task) => !task.outputImages?.length).length

  const handleDelete = (task: typeof tasks[0]) => {
    setConfirmDialog({
      title: '删除记录',
      message: '确定要删除这条记录吗？关联的图片资源也会被清理（如果没有其他任务引用）。',
      action: () => removeTask(task),
    })
  }

  const beginSelection = (target: HTMLElement, clientX: number, clientY: number, isCtrl: boolean) => {
    startedOnCard.current = Boolean(target.closest('.task-card-wrapper'))
    startedWithCtrl.current = isCtrl
    initialSelection.current = [...useStore.getState().selectedTaskIds]

    isDragging.current = true
    hasDragged.current = false
    dragStart.current = { x: clientX, y: clientY }
    document.body.classList.add('select-none')
    document.body.classList.add('drag-selecting')
    setSelectionBox({
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
    })
  }

  const updateSelectionFromPoint = (clientX: number, clientY: number) => {
    const start = dragStart.current
    if (!start || !gridRef.current) return

    const minX = Math.min(start.x, clientX)
    const maxX = Math.max(start.x, clientX)
    const minY = Math.min(start.y, clientY)
    const maxY = Math.max(start.y, clientY)

    const cards = gridRef.current.querySelectorAll('.task-card-wrapper')
    const newSelected = new Set(initialSelection.current)
    const initialSelected = new Set(initialSelection.current)

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const taskId = card.getAttribute('data-task-id')
      if (!taskId) return

      const isIntersecting =
        minX < rect.right && maxX > rect.left && minY < rect.bottom && maxY > rect.top

      if (isIntersecting) {
        if (initialSelected.has(taskId)) {
          newSelected.delete(taskId)
        } else {
          newSelected.add(taskId)
        }
      } else if (!initialSelected.has(taskId)) {
        newSelected.delete(taskId)
      }
    })

    setSelectedTaskIds(Array.from(newSelected))
  }

  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (hasOverlayOpen) return
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      if (!target) return
      if (!target.closest('[data-home-main]')) return
      if (target.closest('[data-input-bar]')) return
      if (target.closest('[data-no-drag-select]')) return
      if (target.closest('button, a, input, textarea, select')) return

      const isCtrl = isMac ? e.metaKey : e.ctrlKey
      beginSelection(target, e.clientX, e.clientY, isCtrl)
    }

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return

      const start = dragStart.current
      const distance = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (distance < 6 && !hasDragged.current) return

      hasDragged.current = true
      setSelectionBox({
        startX: start.x,
        startY: start.y,
        currentX: e.clientX,
        currentY: e.clientY,
      })
      updateSelectionFromPoint(e.clientX, e.clientY)
      e.preventDefault()
    }

    const handleDocumentMouseUp = () => {
      if (isDragging.current) {
        document.body.classList.remove('select-none')
        document.body.classList.remove('drag-selecting')
      }
      if (isDragging.current && !hasDragged.current && !startedOnCard.current && !startedWithCtrl.current) {
        clearSelection()
      }
      if (isDragging.current && hasDragged.current) {
        suppressClickUntil.current = Date.now() + 250
      }
      isDragging.current = false
      dragStart.current = null
      setSelectionBox(null)
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)
    }
  }, [clearSelection, hasOverlayOpen, isMac])

  if (!filteredTasks.length) {
    return (
      <section className="flex min-h-[calc(100vh-8.5rem)] flex-col rounded-3xl border border-white/75 bg-white/[0.82] p-5 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.28),0_6px_18px_-14px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/[0.78] dark:shadow-[0_18px_36px_-22px_rgba(0,0,0,0.55),0_6px_18px_-14px_rgba(0,0,0,0.35)] sm:p-6">
        <HistoryHeader visibleCount={0} totalCount={tasks.length} />
        <div className="flex flex-1 items-center justify-center text-center text-gray-400 dark:text-gray-500">
          {searchQuery || filterFavorite || filterStatus !== 'all' ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white/70 px-8 py-10 backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.03]">
              <ImageIcon className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-gray-600" strokeWidth={1.4} />
              <p className="text-sm font-bold text-slate-500 dark:text-gray-400">没有找到匹配的记录</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">试试调整关键词、状态或收藏筛选</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white/70 px-8 py-10 backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.03]">
              <ImageIcon className="mx-auto mb-3 h-10 w-10 text-blue-300 dark:text-blue-400" strokeWidth={1.4} />
              <p className="text-sm font-bold text-slate-600 dark:text-gray-200">暂无历史记录</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">左侧选择模板并生成第一张旅图</p>
            </div>
          )}
        </div>
      </section>
    )
  }

  const handleBatchDelete = () => {
    const ids = selectedTasks.map((task) => task.id)
    if (!ids.length) return
    setConfirmDialog({
      title: '批量删除记录',
      message: `确定要删除选中的 ${ids.length} 条记录吗？关联的图片资源也会被清理（如果没有其他任务引用）。`,
      confirmText: '确认删除',
      tone: 'danger',
      action: () => {
        void removeMultipleTasks(ids)
      },
    })
  }

  const downloadSelectedTasks = async () => {
    if (!selectedDownloadItems.length) {
      showToast('选中的记录没有可下载图片', 'error')
      return
    }

    const resolvedItems = await Promise.all(
      selectedDownloadItems.map(async (item) => ({ ...item, url: await ensureImageCached(item.imageId) })),
    )
    const downloadableItems = resolvedItems.filter((item): item is typeof item & { url: string } => Boolean(item.url))

    for (const item of downloadableItems) {
      const link = document.createElement('a')
      link.href = item.url
      link.download = downloadableItems.length > 1 ? `${item.taskId}-${item.imageIndex + 1}.png` : `${item.taskId}.png`
      link.click()
    }
    if (downloadableItems.length > 0) {
      showToast(`已开始下载 ${downloadableItems.length} 张图片`, 'success')
    } else {
      showToast('图片下载失败', 'error')
    }
  }

  const handleBatchDownload = () => {
    const imageCount = selectedDownloadItems.length
    if (!imageCount) {
      showToast('选中的记录没有可下载图片', 'error')
      return
    }
    const unavailableText = selectedTasksWithoutOutputs > 0
      ? `，${selectedTasksWithoutOutputs} 条记录暂无可下载图片`
      : ''
    setConfirmDialog({
      title: '批量下载图片',
      message: `确定要下载选中记录中的 ${imageCount} 张图片吗${unavailableText}？浏览器可能会连续触发多个下载。`,
      confirmText: '开始下载',
      action: () => {
        void downloadSelectedTasks()
      },
    })
  }

  const visibleTasks = filteredTasks.slice(0, HISTORY_LIMIT)

  return (
    <>
    <section
      ref={rootRef}
      data-task-grid-root
      className="relative flex min-h-[calc(100vh-8.5rem)] flex-col rounded-3xl border border-white/75 bg-white/[0.82] p-5 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.28),0_6px_18px_-14px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/[0.78] dark:shadow-[0_18px_36px_-22px_rgba(0,0,0,0.55),0_6px_18px_-14px_rgba(0,0,0,0.35)] sm:p-6"
    >
      <HistoryHeader visibleCount={visibleTasks.length} totalCount={filteredTasks.length} />
      <div
        ref={gridRef}
        className={`grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pl-1 pr-1 pt-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1700px]:grid-cols-5 ${selectedTaskIds.length > 0 ? 'pb-24' : 'pb-2'}`}
      >
        {visibleTasks.map((task) => (
          <div key={task.id} className="task-card-wrapper" data-task-id={task.id}>
            <TaskCard
              task={task}
              onClick={(e) => {
                if (Date.now() < suppressClickUntil.current) {
                  e.preventDefault()
                  return
                }
                suppressClickUntil.current = 0
                const isCtrl = isMac ? e.metaKey : e.ctrlKey
                if (selectedTaskIds.length > 0 || isCtrl) {
                  useStore.getState().toggleTaskSelection(task.id)
                } else {
                  setDetailTaskId(task.id)
                }
              }}
              onDelete={() => handleDelete(task)}
              isSelected={selectedTaskIds.includes(task.id)}
            />
          </div>
        ))}
      </div>
    </section>
    {selectedTaskIds.length > 0 && (
      <div data-no-drag-select style={barLeft != null ? { left: barLeft, transform: 'translateX(-50%)' } : undefined} className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-2xl border border-blue-100 bg-[#edf6ff]/90 px-4 py-3 text-sm font-bold text-black shadow-[0_10px_30px_rgba(15,23,42,0.16)] dark:border-blue-400/10 dark:bg-gray-950/90 dark:text-gray-100">
        <span className="pointer-events-auto whitespace-nowrap">已选择 {selectedTaskIds.length} 条记录</span>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleBatchDownload}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2f80ed] px-3 py-2 text-white transition hover:bg-blue-600"
          >
            <Download className="h-4 w-4" />
            批量下载
          </button>
          <button
            type="button"
            onClick={handleBatchDelete}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            <Trash2 className="h-4 w-4" />
            批量删除
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-gray-500 transition hover:bg-gray-50 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]"
          >
            <X className="h-4 w-4" />
            取消选择
          </button>
        </div>
      </div>
    )}
    </>
  )
}

function HistoryHeader({ visibleCount, totalCount }: { visibleCount: number; totalCount: number }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-black text-black dark:text-gray-100">
        历史记录（{visibleCount}/{Math.min(totalCount, HISTORY_LIMIT)}）
        </h2>
        <p className="mt-1 text-sm font-bold text-[#98a2b3] dark:text-gray-400">查看、筛选和复用最近生成的图片</p>
      </div>
      <p className="hidden max-w-sm pt-1 text-right text-xs font-bold leading-relaxed text-[#98a2b3] dark:text-gray-500 md:block">
        为避免卡顿，图片保存数量上限为{HISTORY_LIMIT}张，超出部分按顺序自动删除
      </p>
    </div>
  )
}
