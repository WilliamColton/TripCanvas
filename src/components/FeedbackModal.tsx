import { useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Bug } from 'lucide-react'
import { useStore } from '../store'
import { submitBugFeedback } from '../lib/backendApi'
import type { BugFeedbackCategory } from '../types'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'

interface FeedbackModalProps {
  onClose: () => void
}

export default function FeedbackModal({ onClose }: FeedbackModalProps) {
  const showToast = useStore((s) => s.showToast)
  const [category, setCategory] = useState<BugFeedbackCategory>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      showToast('请填写问题描述', 'error')
      return
    }

    setSubmitting(true)
    try {
      await submitBugFeedback({
        category,
        content: trimmedContent,
        contact: contact.trim(),
      })
      showToast('反馈已提交，感谢你的帮助', 'success')
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose() }}>
      <DialogContent data-no-drag-select className="max-w-md" onInteractOutside={(event) => { if (submitting) event.preventDefault() }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-red-500" />
              反馈
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>分类</Label>
              <Tabs value={category} onValueChange={(value) => setCategory(value as BugFeedbackCategory)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bug" disabled={submitting}>Bug 反馈</TabsTrigger>
                  <TabsTrigger value="feature" disabled={submitting}>功能建议</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-content">内容描述</Label>
              <Textarea
                id="feedback-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={2000}
                rows={7}
                placeholder={category === 'bug' ? '请描述你遇到的问题、操作步骤和预期结果。' : '请描述你希望新增或优化的功能。'}
                disabled={submitting}
                autoFocus
              />
              <div className="text-right text-xs text-gray-400 dark:text-gray-600">{content.length}/2000</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-contact">联系方式（可选）</Label>
              <Input
                id="feedback-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                placeholder="邮箱、微信或其他联系方式"
                disabled={submitting}
              />
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting || !content.trim()}>
              {submitting ? '提交中...' : '提交反馈'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>,
    document.body,
  )
}
