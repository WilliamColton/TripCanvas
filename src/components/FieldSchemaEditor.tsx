import { useMemo, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PromptTemplateField } from '../types'
import { Switch } from './ui/switch'
import Select from './Select'
import { Input } from './ui/input'

interface Props {
  promptBody: string
  fields: PromptTemplateField[]
  onChange: (fields: PromptTemplateField[]) => void
}

const PLACEHOLDER_RE = /\{([^}]+)\}/g

function extractPlaceholders(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const key = match[1].trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      result.push(key)
    }
  }
  return result
}

function defaultField(key: string): PromptTemplateField {
  return { key, label: key, type: 'short_text', required: true, placeholder: `请输入${key}` }
}

const collapsedSet = new Set<string>()

export default function FieldSchemaEditor({ promptBody, fields, onChange }: Props) {
  const placeholders = useMemo(() => extractPlaceholders(promptBody), [promptBody])

  const syncedFields = useMemo(() => {
    const existingByKey = new Map(fields.map((f) => [f.key, f]))
    const result: PromptTemplateField[] = []
    for (const key of placeholders) {
      result.push(existingByKey.get(key) || defaultField(key))
    }
    return result
  }, [fields, placeholders])

  useEffect(() => {
    const same = syncedFields.length === fields.length && syncedFields.every((field, index) => fields[index]?.key === field.key)
    if (!same) onChange(syncedFields)
  }, [fields, syncedFields, onChange])

  const updateField = useCallback(
    (index: number, patch: Partial<PromptTemplateField>) => {
      const next = [...syncedFields]
      next[index] = { ...next[index], ...patch }
      onChange(next)
    },
    [syncedFields, onChange],
  )

  const toggleCollapsed = useCallback((key: string) => {
    if (collapsedSet.has(key)) collapsedSet.delete(key)
    else collapsedSet.add(key)
    // force re-render
    onChange([...syncedFields])
  }, [syncedFields, onChange])

  const fieldTypeOptions = [
    { label: '短文本', value: 'short_text' },
    { label: '长文本', value: 'long_text' },
    { label: '单选', value: 'select' },
    { label: '多选', value: 'multi_select' },
    { label: '数字', value: 'number' },
    { label: '布尔', value: 'boolean' },
  ]

  const commonClass = 'w-full rounded-lg border border-gray-200/60 bg-white/70 px-2.5 py-1.5 text-xs shadow-sm transition focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04]'

  if (placeholders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 px-4 py-6 text-center text-xs text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.02]">
        在提示词中使用 <code className="rounded bg-gray-200 px-1 py-0.5 text-[11px] dark:bg-white/[0.08]">{'{字段名}'}</code> 占位符，字段配置会自动出现在这里
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">检测到 {placeholders.length} 个占位符，展开卡片配置每个字段：</p>
      {syncedFields.map((field, index) => {
        const collapsed = collapsedSet.has(field.key)
        const showsOptions = field.type === 'select' || field.type === 'multi_select'
        const showsAllowCustom = field.type === 'select'
        return (
          <div key={field.key} className="rounded-xl border border-gray-200/70 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <button
              type="button"
              onClick={() => toggleCollapsed(field.key)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50/70 dark:text-gray-200 dark:hover:bg-white/[0.04]"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />}
              <code className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{`{${field.key}}`}</code>
              <span className="truncate text-gray-500 dark:text-gray-400">{field.label !== field.key ? ` — ${field.label}` : ''}</span>
              {field.required && <span className="ml-auto flex-shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-500 dark:bg-red-500/10">必填</span>}
            </button>
            {!collapsed && (
              <div className="border-t border-gray-100 px-3 pb-3 pt-2 dark:border-white/[0.06]">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
                    显示名称
                    <Input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} placeholder={field.key} className={commonClass} />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
                    类型
                    <Select
                      value={field.type}
                      onChange={(value) => updateField(index, {
                        type: value as PromptTemplateField['type'],
                        options: value === 'select' || value === 'multi_select' ? (field.options?.length ? field.options : ['']) : undefined,
                        allowCustom: value === 'select' ? field.allowCustom : undefined,
                      })}
                      options={fieldTypeOptions}
                      className={commonClass}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
                    占位提示
                    <Input value={field.placeholder || ''} onChange={(e) => updateField(index, { placeholder: e.target.value })} placeholder="输入框里的灰色提示" className={commonClass} />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
                    帮助文案
                    <Input value={field.help || ''} onChange={(e) => updateField(index, { help: e.target.value || undefined })} placeholder="字段下方的小字说明" className={commonClass} />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
                    最大长度
                    <Input
                      value={field.maxLength || ''}
                      onChange={(e) => updateField(index, { maxLength: e.target.value ? Number(e.target.value) : undefined })}
                      type="number"
                      placeholder="不限"
                      className={commonClass}
                    />
                  </label>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Switch checked={field.required !== false} onCheckedChange={(checked) => updateField(index, { required: checked })} className="scale-75" />
                      必填
                    </label>
                    {showsAllowCustom && (
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Switch checked={Boolean(field.allowCustom)} onCheckedChange={(checked) => updateField(index, { allowCustom: checked })} className="scale-75" />
                        允许自定义
                      </label>
                    )}
                  </div>
                </div>
                {showsOptions && (
                  <label className="mt-2 flex flex-col gap-0.5 text-[11px] text-gray-500">
                    选项（逗号分隔）
                    <Input
                      value={(field.options || []).join(', ')}
                      onChange={(e) => updateField(index, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      placeholder="选项A, 选项B, 选项C"
                      className={commonClass}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
