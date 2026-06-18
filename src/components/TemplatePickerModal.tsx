import { useMemo, useState } from 'react'
import { Check, ImageIcon, X } from 'lucide-react'
import { useStore } from '../store'
import { getTemplatePreviewImageUrl } from '../lib/backendApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface Props {
  open: boolean
  onClose: () => void
  onManageTemplates: () => void
}

export default function TemplatePickerModal({ open, onClose, onManageTemplates }: Props) {
  const templates = useStore((s) => s.templates)
  const selectedTemplateId = useStore((s) => s.selectedTemplateId)
  const setSelectedTemplateId = useStore((s) => s.setSelectedTemplateId)
  const [category, setCategory] = useState('全部')

  const categories = useMemo(() => {
    const values = Array.from(new Set(templates.map((template) => template.source === 'user' ? '我的模板' : template.category).filter(Boolean)))
    return ['全部', ...values]
  }, [templates])

  const filteredTemplates = useMemo(() => {
    if (category === '全部') return templates
    if (category === '我的模板') return templates.filter((template) => template.source === 'user')
    return templates.filter((template) => template.category === category && template.source !== 'user')
  }, [templates, category])

  const handleSelect = (id: string) => {
    setSelectedTemplateId(id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[86vh] flex flex-col p-0" hideClose>
        <DialogHeader className="flex-shrink-0 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base">选择模板</DialogTitle>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-shrink-0 overflow-x-auto border-b border-gray-100 px-5 py-3 dark:border-white/[0.08]">
          <div className="flex gap-2 whitespace-nowrap">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${category === item ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]'}`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={onManageTemplates}
              className="rounded-full border border-blue-200/70 px-3 py-1.5 text-xs text-blue-600 transition hover:bg-blue-50 dark:border-blue-400/20 dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              管理我的模板
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filteredTemplates.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 py-12 text-center text-sm text-gray-400 dark:bg-white/[0.03]">暂无模板</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => {
                const selected = template.id === selectedTemplateId
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelect(template.id)}
                    className={`group overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-lg ${selected ? 'border-blue-400 bg-blue-50/60 shadow-sm dark:border-blue-400/50 dark:bg-blue-500/10' : 'border-gray-200/70 bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.03]'}`}
                  >
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-50 via-cyan-50 to-amber-50 dark:from-blue-500/10 dark:via-cyan-500/10 dark:to-amber-500/10">
                      {template.previewImageId ? (
                        <img src={getTemplatePreviewImageUrl(template.previewImageId)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-300 dark:text-gray-500">
                          <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
                          <span className="text-xs">暂无预览图</span>
                        </div>
                      )}
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{template.title}</span>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-300">{template.source === 'user' ? '我的模板' : template.category}</span>
                        <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-[10px] text-gray-500">{(template.fieldSchema || []).length} 个字段</span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{template.description || '暂无描述'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
