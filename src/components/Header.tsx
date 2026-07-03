import { useState } from 'react'
import { Bell, BookOpen, Bug, HelpCircle, Palette, Settings } from 'lucide-react'
import { useStore } from '../store'
import AnnouncementModal from './AnnouncementModal'
import AppearanceModal from './AppearanceModal'
import FeedbackModal from './FeedbackModal'
import HelpModal from './HelpModal'

export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const announcement = useStore((s) => s.announcement)
  const latestChangelog = useStore((s) => s.latestChangelog)
  const setShowChangelog = useStore((s) => s.setShowChangelog)
  const authUser = useStore((s) => s.authUser)
  const [showHelp, setShowHelp] = useState(false)
  const [showAnnouncement, setShowAnnouncement] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const hasAnnouncement = Boolean(announcement?.enabled && announcement.content.trim())
  const version = latestChangelog?.published ? latestChangelog.version.trim() : ''
  const accountLabel = authUser?.username || authUser?.label || '未登录'

  return (
    <header className="safe-area-top sticky top-0 z-40 border-b border-[#dfe7f2] bg-[#edf6ff]/95 shadow-[0_1px_18px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-950/90">
      <div className="safe-area-x safe-header-inner mx-auto flex h-20 max-w-[1920px] items-center justify-between gap-4 px-7 sm:h-[5.25rem]">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          <picture className="block shrink-0">
            <source media="(max-width: 640px)" srcSet="./jingpin-logo-vertical.png" />
            <img
              src="./jingpin-logo-horizontal.png"
              alt="精品旅图"
              className="h-14 w-auto max-w-[260px] object-contain sm:h-16 sm:max-w-[360px] lg:max-w-[460px]"
            />
          </picture>
          <p className="hidden whitespace-nowrap text-base font-bold text-black dark:text-gray-100 md:block">
            账户：{accountLabel}
          </p>
          {version && (
            <button
              onClick={() => setShowChangelog(true)}
              className="mt-0.5 rounded-full bg-white/80 px-2 py-0.5 font-mono text-xs font-medium text-blue-600 shadow-sm transition hover:bg-white dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
              title="查看更新日志"
            >
              v{version}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHelp(true)}
            className="mr-1 hidden flex-col items-center justify-center rounded-xl px-3 py-1.5 text-black transition-colors hover:bg-white/70 dark:text-gray-100 dark:hover:bg-white/[0.08] sm:flex"
            title="使用说明"
          >
            <BookOpen className="h-7 w-7" strokeWidth={2.4} />
            <span className="-mt-0.5 text-xs font-semibold">使用说明</span>
          </button>
          {version && (
            <button
              onClick={() => setShowChangelog(true)}
              className="rounded-lg p-2 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.08]"
              title="更新日志"
            >
              <BookOpen className="h-5 w-5 text-gray-700 dark:text-gray-400" />
            </button>
          )}
          <button
            onClick={() => setShowFeedback(true)}
            className="rounded-lg p-2 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.08]"
            title="Bug 反馈"
          >
            <Bug className="h-5 w-5 text-gray-700 dark:text-gray-400" />
          </button>
          <button
            onClick={() => setShowAnnouncement(true)}
            disabled={!hasAnnouncement}
            className={`rounded-lg p-2 transition-colors ${
              hasAnnouncement
                ? 'text-gray-700 hover:bg-white/70 dark:text-gray-400 dark:hover:bg-white/[0.08]'
                : 'cursor-not-allowed text-gray-300 dark:text-gray-700'
            }`}
            title={hasAnnouncement ? '站点公告' : '暂无公告'}
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowAppearance(true)}
            className="rounded-lg p-2 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.08]"
            title="外观"
          >
            <Palette className="h-5 w-5 text-gray-700 dark:text-gray-400" />
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="rounded-lg p-2 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.08] sm:hidden"
            title="操作指南"
          >
            <HelpCircle className="h-5 w-5 text-gray-700 dark:text-gray-400" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-2 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.08]"
            title="设置"
          >
            <Settings className="h-5 w-5 text-gray-700 dark:text-gray-400" />
          </button>
        </div>
      </div>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showAppearance && <AppearanceModal onClose={() => setShowAppearance(false)} />}
      {showAnnouncement && <AnnouncementModal mode="manual" onClose={() => setShowAnnouncement(false)} />}
    </header>
  )
}
