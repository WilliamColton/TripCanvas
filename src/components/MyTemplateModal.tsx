import { useState, useMemo } from 'react'
import { Edit3, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { createTemplate, updateTemplate, deleteTemplate } from '../lib/backendApi'
import type { PromptTemplate, PromptTemplateField, PromptTemplatePayload } from '../types'
import FieldSchemaEditor from './FieldSchemaEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

interface Props {
  open: boolean
  onClose: () => void
}

export default function MyTemplateModal({ open, onClose }: Props) {
  const templates = useStore((s) => s.templates)
  const showToast = useStore((s) => s.showToast)
  const loadTemplates = useStore((s) => s.loadTemplates)
  const [tab, setTab] = useState<'list' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('旅行海报')
  const [description, setDescription] = useState('')
  const [promptBody, setPromptBody] = useState('生成一张图片，{风格}风格，时间是{季节}。')
  const [fields, setFields] = useState<PromptTemplateField[]>([])

  const myTemplates = useMemo(
    () => templates.filter((t) => t.source === 'user'),
    [templates],
  )

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setCategory('旅行海报')
    setDescription('')
    setPromptBody('生成一张图片，{风格}风格，时间是{季节}。')
    setFields([])
    setTab('list')
  }

  const startCreate = () => {
    resetForm()
    setFields([
      { key: '风格', label: '风格', type: 'short_text', required: true, placeholder: '例如：日系胶片', maxLength: 60 },
      { key: '季节', label: '季节', type: 'short_text', required: true, placeholder: '例如：秋季', maxLength: 40 },
    ])
    setTab('edit')
  }

  const startEdit = (template: PromptTemplate) => {
    setEditingId(template.id)
    setTitle(template.title)
    setCategory(template.category)
    setDescription(template.description)
    setPromptBody(template.promptBody || '')
    setFields(template.fieldSchema || [])
    setTab('edit')
  }

  const handleSave = async () => {
    const payload: PromptTemplatePayload = {
      title: title.trim(),
      category: category.trim() || '旅行海报',
      description: description.trim(),
      promptBody: promptBody.trim(),
      fieldSchema: fields,
      assemblyMode: 'sections',
      visibility: 'private',
    }
    if (!payload.title || !payload.promptBody) {
      showToast('请填写模板名称和提示词', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateTemplate(editingId, payload)
        showToast('模板已更新', 'success')
      } else {
        await createTemplate(payload)
        showToast('模板已创建', 'success')
      }
      await loadTemplates()
      resetForm()
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id)
      await loadTemplates()
      showToast('模板已删除', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const commonInputClass = 'w-full rounded-xl border border-gray-200/60 bg-white/70 px-3 py-2 text-xs shadow-sm transition focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04]'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetForm(); onClose() } }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0" hideClose>
        <DialogHeader className="px-5 pt-5 pb-0 flex-shrink-0">
          <DialogTitle className="text-base">我的模板</DialogTitle>
        </DialogHeader>

        <div className="flex-shrink-0 px-5 pb-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'list' | 'edit')}>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">我的模板</TabsTrigger>
              <TabsTrigger value="edit" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">{editingId ? '编辑模板' : '新建模板'}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {tab === 'list' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">{myTemplates.length > 0 ? `共 ${myTemplates.length} 个模板` : '还没有自己的模板'}</span>
                <Button type="button" size="sm" onClick={startCreate}><Plus className="mr-1 h-3.5 w-3.5" />新建模板</Button>
              </div>
              {myTemplates.length === 0 && (
                <div className="rounded-2xl bg-gray-50 py-10 text-center text-xs text-gray-400 dark:bg-white/[0.03]">
                  <p>点击「新建模板」创建你的第一个模板</p>
                  <p className="mt-2">使用 {'{字段名}'} 作为占位符，系统会自动生成输入框</p>
                </div>
              )}
              <div className="space-y-2">
                {myTemplates.map((template) => (
                  <div key={template.id} className="flex items-start justify-between rounded-xl border border-gray-200/70 bg-white/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{template.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-300">{template.category}</span>
                        <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-[10px] text-gray-500">{(template.fieldSchema || []).length} 个字段</span>
                      </div>
                      {template.promptBody && (
                        <p className="mt-2 line-clamp-2 text-xs text-gray-400 dark:text-gray-500">{template.promptBody}</p>
                      )}
                    </div>
                    <div className="ml-3 flex flex-shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-500" onClick={() => startEdit(template)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDelete(template.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'edit' && (
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-xs text-gray-500">
                模板名称
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：我的小红书封面" className={commonInputClass} />
              </label>

              <label className="flex flex-col gap-1 text-xs text-gray-500">
                分类
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="例如：旅行海报" className={commonInputClass} />
              </label>

              <label className="flex flex-col gap-1 text-xs text-gray-500">
                描述
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="对模板的简短说明"
                  className={`${commonInputClass} min-h-[4rem] resize-none`}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-gray-500">
                提示词模板
                <Textarea
                  value={promptBody}
                  onChange={(e) => setPromptBody(e.target.value)}
                  rows={4}
                  placeholder="生成一张 {风格} 风格的旅行图，地点是 {地点}"
                  className={`${commonInputClass} min-h-[6rem] resize-none font-mono text-xs`}
                />
              </label>

              <FieldSchemaEditor promptBody={promptBody} fields={fields} onChange={setFields} />

              <div className="flex gap-2 pt-2">
                <Button type="button" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : editingId ? '保存修改' : '创建模板'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>取消</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
