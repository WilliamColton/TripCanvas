import { Bell } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

interface AnnouncementModalProps {
  mode?: 'auto' | 'manual'
  onClose?: () => void
}

export default function AnnouncementModal({ mode = 'auto', onClose }: AnnouncementModalProps) {
  const announcement = useStore((s) => s.announcement)
  const seenAnnouncementUpdatedAt = useStore((s) => s.seenAnnouncementUpdatedAt)
  const markAnnouncementSeen = useStore((s) => s.markAnnouncementSeen)

  const visible =
    !!announcement?.enabled &&
    !!announcement.content.trim() &&
    !(mode === 'auto' && announcement.updatedAt === seenAnnouncementUpdatedAt)

  const handleClose = () => {
    if (mode === 'auto' && announcement) markAnnouncementSeen(announcement.updatedAt)
    onClose?.()
  }

  useCloseOnEscape(visible, handleClose)

  if (!visible) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" data-no-drag-select hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            公告
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[55vh] pr-3">
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-600 dark:text-gray-300">
            {announcement.content}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleClose}>
            我知道了
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
