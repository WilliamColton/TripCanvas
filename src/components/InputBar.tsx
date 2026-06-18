import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ban, ImageIcon, Loader2, Paperclip, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import { addImageFromFile, submitTask, useStore } from '../store'
import { DEFAULT_PARAMS, MAX_TASK_N, normalizeTaskN, type PromptTemplateField } from '../types'
import { normalizeImageSize } from '../lib/size'
import Select from './Select'
import SizePickerModal from './SizePickerModal'
import { Textarea } from './ui/textarea'
import MyTemplateModal from './MyTemplateModal'
import TemplatePickerModal from './TemplatePickerModal'
import { getTemplatePreviewImageUrl } from '../lib/backendApi'
import { getTemplatePreviewLightboxId } from '../lib/lightboxIds'

const API_MAX_IMAGES = 16
const STYLE_PRESETS = ['默认', '新中式', '实景摄影风']

function fieldLooksLikeStyle(field: PromptTemplateField) {
  const text = `${field.label || ''}${field.key || ''}`
  return text.includes('风格') || text.includes('样式')
}

function fieldPlaceholder(field: PromptTemplateField) {
  if (field.placeholder) return field.placeholder
  return '请输入内容'
}

function labelText(label: string, required = false) {
  return `${required ? '*' : ''}${label}：`
}

function useTemplateBootstrap() {
  const templatesLoaded = useStore((s) => s.templatesLoaded)
  const templateLoading = useStore((s) => s.templateLoading)
  const loadTemplates = useStore((s) => s.loadTemplates)

  useEffect(() => {
    if (!templatesLoaded && !templateLoading) {
      void loadTemplates().catch(() => {})
    }
  }, [templatesLoaded, templateLoading, loadTemplates])
}

export default function InputBar() {
  const authUser = useStore((s) => s.authUser)
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const promptMode = useStore((s) => s.promptMode)
  const setPromptMode = useStore((s) => s.setPromptMode)
  const templates = useStore((s) => s.templates)
  const selectedTemplateId = useStore((s) => s.selectedTemplateId)
  const setSelectedTemplateId = useStore((s) => s.setSelectedTemplateId)
  const selectedTemplateResolutionId = useStore((s) => s.selectedTemplateResolutionId)
  const setSelectedTemplateResolutionId = useStore((s) => s.setSelectedTemplateResolutionId)
  const templateInputs = useStore((s) => s.templateInputs)
  const setTemplateInput = useStore((s) => s.setTemplateInput)
  const clearTemplateInputs = useStore((s) => s.clearTemplateInputs)
  const templateLoading = useStore((s) => s.templateLoading)
  const inputImages = useStore((s) => s.inputImages)
  const removeInputImage = useStore((s) => s.removeInputImage)
  const clearInputImages = useStore((s) => s.clearInputImages)
  const params = useStore((s) => s.params)
  const setParams = useStore((s) => s.setParams)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const maskDraft = useStore((s) => s.maskDraft)
  const clearMaskDraft = useStore((s) => s.clearMaskDraft)
  const setMaskEditorImageId = useStore((s) => s.setMaskEditorImageId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showMyTemplateModal, setShowMyTemplateModal] = useState(false)
  const [nInput, setNInput] = useState(String(params.n))
  const [freeformStyle, setFreeformStyle] = useState(STYLE_PRESETS[0])

  useTemplateBootstrap()

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null
  const isTemplateMode = promptMode === 'template'
  const templateFields = selectedTemplate?.fieldSchema || []
  const resolutionOptions = selectedTemplate?.resolutionOptions || []
  const selectedResolutionId = resolutionOptions.some((option) => option.id === selectedTemplateResolutionId)
    ? selectedTemplateResolutionId
    : resolutionOptions[0]?.id || ''
  const styleField = templateFields.find(fieldLooksLikeStyle) || null
  const formFields = templateFields.filter((field) => field.key !== styleField?.key)
  const selectedStyleValue = styleField ? String(templateInputs[styleField.key] ?? '') : ''
  const styleOptions = useMemo(() => {
    const configured = (styleField?.options || []).map((option) => option.trim()).filter(Boolean)
    return configured.length > 0 ? configured : STYLE_PRESETS
  }, [styleField])
  const selectedStyleOption = styleField ? selectedStyleValue || styleOptions[0] || '' : freeformStyle
  const atImageLimit = inputImages.length >= API_MAX_IMAGES
  const remainingCredits = authUser
    ? authUser.unlimitedQuota
      ? '不限'
      : String(Math.max(authUser.quota - authUser.usedCount, 0))
    : '0'
  const previewImageUrl = selectedTemplate?.previewImageId
    ? getTemplatePreviewImageUrl(selectedTemplate.previewImageId)
    : ''

  const canSubmit = isTemplateMode
    ? Boolean(selectedTemplateId) && formFields.concat(styleField ? [styleField] : []).every((field) => {
        if (!field.required) return true
        const value = templateInputs[field.key]
        return value != null && String(value).trim() !== ''
      })
    : Boolean(prompt.trim())

  useEffect(() => {
    setNInput(String(params.n))
  }, [params.n])

  useEffect(() => {
    if (!selectedTemplate) {
      if (selectedTemplateResolutionId) setSelectedTemplateResolutionId('')
      return
    }
    if (selectedResolutionId !== selectedTemplateResolutionId) {
      setSelectedTemplateResolutionId(selectedResolutionId)
    }
  }, [selectedTemplate, selectedResolutionId, selectedTemplateResolutionId, setSelectedTemplateResolutionId])

  useEffect(() => {
    if (!styleField || styleOptions.length === 0) return
    if (!selectedStyleValue || !styleOptions.includes(selectedStyleValue)) {
      setTemplateInput(styleField.key, styleOptions[0])
    }
  }, [styleField, selectedStyleValue, styleOptions, setTemplateInput])

  const commitN = useCallback(() => {
    const nextValue = Number(nInput)
    const normalizedValue = normalizeTaskN(
      nInput.trim() === '' ? DEFAULT_PARAMS.n : Number.isNaN(nextValue) ? params.n : nextValue,
    )
    setNInput(String(normalizedValue))
    setParams({ n: normalizedValue })
  }, [nInput, params.n, setParams])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    try {
      if (useStore.getState().promptMode === 'template') return
      const currentCount = useStore.getState().inputImages.length
      if (currentCount >= API_MAX_IMAGES) {
        useStore.getState().showToast(`参考图数量已达上限（${API_MAX_IMAGES} 张）`, 'error')
        return
      }

      const remaining = API_MAX_IMAGES - currentCount
      const accepted = Array.from(files).filter((file) => file.type.startsWith('image/'))
      const toAdd = accepted.slice(0, remaining)
      const discarded = accepted.length - toAdd.length

      for (const file of toAdd) {
        await addImageFromFile(file)
      }

      if (discarded > 0) {
        useStore.getState().showToast(`已达上限 ${API_MAX_IMAGES} 张，${discarded} 张图片被丢弃`, 'error')
      }
    } catch (err) {
      useStore.getState().showToast(`图片添加失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }, [])

  const handleFilesRef = useRef(handleFiles)
  handleFilesRef.current = handleFiles

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (useStore.getState().promptMode === 'template') return
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault()
        handleFilesRef.current(imageFiles)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (useStore.getState().promptMode === 'template') return
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      if (e.dataTransfer?.types.includes('Files')) setIsDragging(true)
    }
    const handleDragOver = (e: DragEvent) => {
      if (useStore.getState().promptMode === 'template') return
      e.preventDefault()
      e.stopPropagation()
    }
    const handleDragLeave = (e: DragEvent) => {
      if (useStore.getState().promptMode === 'template') return
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragging(false)
      }
    }
    const handleDrop = (e: DragEvent) => {
      if (useStore.getState().promptMode === 'template') return
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsDragging(false)
      const files = e.dataTransfer?.files
      if (files?.length) void handleFilesRef.current(files)
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  const templateOptions = useMemo(
    () => [
      { label: templateLoading ? '模板加载中' : '请选择板式', value: '__none' },
      ...templates.map((template) => ({ label: template.title, value: template.id })),
    ],
    [templates, templateLoading],
  )

  const handleStyleChange = (style: string) => {
    if (styleField) {
      setTemplateInput(styleField.key, style)
      return
    }
    setFreeformStyle(style)
    const stylePrefixes = STYLE_PRESETS.filter((item) => item !== '默认').map((item) => `${item}。`)
    const promptWithoutStyle = stylePrefixes.reduce((text, prefix) => text.startsWith(prefix) ? text.slice(prefix.length) : text, prompt)
    setPrompt(style === '默认' ? promptWithoutStyle : `${style}。${promptWithoutStyle}`.trim())
  }

  const handleReset = () => {
    clearTemplateInputs()
    setPrompt('')
    clearInputImages()
    clearMaskDraft()
    setParams({ ...DEFAULT_PARAMS })
  }

  const inputClass =
    'h-9 w-full rounded-md border border-transparent bg-white px-3 text-sm font-semibold text-[#9aa3b1] shadow-[0_1px_10px_rgba(31,41,55,0.16)] outline-none transition focus:border-blue-300 focus:text-gray-900 focus:ring-2 focus:ring-blue-200/70 dark:bg-white/[0.06] dark:text-gray-300 dark:focus:text-white'
  const labelClass = 'grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-2 text-base font-bold text-black dark:text-gray-100'

  const renderTemplateField = (field: PromptTemplateField) => {
    const value = templateInputs[field.key]
    const onChange = (next: unknown) => setTemplateInput(field.key, next)

    return (
      <label key={field.key} className={labelClass}>
        <span className="truncate">{labelText(field.label || field.key, field.required)}</span>
        {field.type === 'long_text' ? (
          <Textarea
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder={fieldPlaceholder(field)}
            className={`${inputClass} min-h-[4.25rem] resize-none py-2`}
          />
        ) : field.type === 'select' && field.options?.length ? (
          <Select
            value={String(value ?? '')}
            onChange={(next) => onChange(next)}
            options={[{ label: fieldPlaceholder(field), value: '' }, ...field.options.map((option) => ({ label: option, value: option }))]}
            className={inputClass}
          />
        ) : field.type === 'boolean' ? (
          <Select
            value={String(value ?? false)}
            onChange={(next) => onChange(next === 'true')}
            options={[{ label: '否', value: 'false' }, { label: '是', value: 'true' }]}
            className={inputClass}
          />
        ) : (
          <input
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            type={field.type === 'number' ? 'number' : 'text'}
            maxLength={field.maxLength || undefined}
            placeholder={fieldPlaceholder(field)}
            className={inputClass}
          />
        )}
      </label>
    )
  }

  const renderFreeformField = () => (
    <label className="flex min-w-0 flex-col gap-2 text-base font-bold text-black dark:text-gray-100">
      {labelText('标题', true)}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={5}
        placeholder="请输入内容"
        className={`${inputClass} min-h-[8rem] resize-none py-3 leading-relaxed`}
      />
    </label>
  )

  return (
    <>
      {isDragging && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-md dark:bg-gray-950/70">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 p-8 shadow-xl dark:bg-gray-900/80">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed ${
              atImageLimit ? 'border-red-300 bg-red-50' : 'border-blue-400 bg-blue-50'
            }`}>
              {atImageLimit ? (
                <Ban className="h-10 w-10 text-red-400" />
              ) : (
                <ImageIcon className="h-10 w-10 text-blue-500" strokeWidth={1.5} />
              )}
            </div>
            <p className={`text-lg font-semibold ${atImageLimit ? 'text-red-500' : 'text-gray-700 dark:text-gray-100'}`}>
              {atImageLimit ? `已达上限 ${API_MAX_IMAGES} 张` : '释放以添加参考图'}
            </p>
          </div>
        </div>
      )}

      {showSizePicker && !isTemplateMode && (
        <SizePickerModal
          currentSize={params.size}
          onSelect={(size) => setParams({ size })}
          onClose={() => setShowSizePicker(false)}
        />
      )}

      <section
        data-input-bar
        data-no-drag-select
        className="flex min-h-[calc(100vh-9.25rem)] flex-col rounded-md bg-white p-6 shadow-[0_1px_8px_rgba(15,23,42,0.2)] dark:bg-gray-950 dark:ring-1 dark:ring-white/[0.08]"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black text-black dark:text-gray-100">板式</h2>
          <div className="whitespace-nowrap text-2xl font-black text-black dark:text-gray-100">
            剩余积分：{remainingCredits}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <div className="mb-5 text-base font-bold text-black dark:text-gray-100">板式参考</div>
            {isTemplateMode ? (
              <button
                type="button"
                disabled={!selectedTemplate?.previewImageId}
                onClick={() => {
                  if (!selectedTemplate?.previewImageId) return
                  const lightboxId = getTemplatePreviewLightboxId(selectedTemplate.previewImageId)
                  setLightboxImageId(lightboxId, [lightboxId])
                }}
                className={`flex h-[248px] w-[220px] max-w-full items-center justify-center overflow-hidden rounded-md border border-[#777] bg-white text-gray-300 transition focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/[0.18] dark:bg-white/[0.03] ${
                  previewImageUrl ? 'cursor-zoom-in hover:border-blue-400' : 'cursor-default'
                }`}
                title={previewImageUrl ? '点击查看大图' : '暂无板式参考图'}
              >
                {previewImageUrl ? (
                  <img src={previewImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10" strokeWidth={1.3} />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => !atImageLimit && fileInputRef.current?.click()}
                className="flex h-[248px] w-[220px] max-w-full items-center justify-center overflow-hidden rounded-md border border-[#777] bg-white text-gray-300 transition hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/[0.18] dark:bg-white/[0.03]"
                title={atImageLimit ? `已达上限 ${API_MAX_IMAGES} 张` : '添加参考图'}
              >
                {inputImages.length > 0 ? (
                  <div className="grid h-full w-full grid-cols-2 gap-2 p-2">
                    {inputImages.slice(0, 4).map((image) => (
                      <img key={image.id} src={image.dataUrl} alt="" className="h-full min-h-0 w-full rounded object-cover" />
                    ))}
                  </div>
                ) : (
                  <ImageIcon className="h-10 w-10" strokeWidth={1.3} />
                )}
              </button>
            )}
            {!isTemplateMode && inputImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {inputImages.map((image, index) => {
                  const isMaskTarget = maskDraft?.targetImageId === image.id
                  return (
                    <div key={image.id} className="group relative h-12 w-12 overflow-hidden rounded border border-gray-200 shadow-sm dark:border-white/[0.12]">
                      <img
                        src={image.dataUrl}
                        alt=""
                        className="h-full w-full cursor-pointer object-cover"
                        onClick={() => setLightboxImageId(image.id, inputImages.map((item) => item.id))}
                      />
                      {isMaskTarget && <span className="absolute left-0 top-0 bg-blue-600 px-1 text-[8px] font-bold text-white">MASK</span>}
                      <button
                        type="button"
                        onClick={() => setMaskEditorImageId(image.id)}
                        className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex"
                        title={isMaskTarget ? '编辑遮罩' : '添加遮罩'}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInputImage(index)}
                        className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-red-500 text-white opacity-0 transition group-hover:opacity-100"
                        title="移除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      title: '清空参考图',
                      message: `确定要清空全部 ${inputImages.length} 张参考图吗？`,
                      action: clearInputImages,
                    })
                  }
                  className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 transition hover:border-red-300 hover:text-red-500 dark:border-white/[0.12]"
                  title="清空参考图"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <label className="mb-5 block">
              <span className="mb-5 block text-base font-bold text-black dark:text-gray-100">板式选择</span>
              <Select
                value={selectedTemplateId || '__none'}
                onChange={(value) => {
                  const nextId = value === '__none' ? '' : String(value)
                  setPromptMode(nextId ? 'template' : 'freeform')
                  setSelectedTemplateId(nextId)
                }}
                options={templateOptions}
                className="h-[38px] w-full rounded-md border border-[#8d8d8d] bg-white px-3 text-base font-bold text-[#9aa3b1] shadow-none focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-white/[0.04] dark:text-gray-300"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowTemplatePicker(true)}
                className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-bold text-white shadow-[0_3px_10px_rgba(47,128,237,0.35)] transition hover:bg-blue-600"
              >
                选择模板
              </button>
              <button
                type="button"
                onClick={() => setShowMyTemplateModal(true)}
                className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-bold text-white shadow-[0_3px_10px_rgba(47,128,237,0.35)] transition hover:bg-blue-600"
              >
                我的模板
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-3 text-base font-bold text-black dark:text-gray-100">
            {styleField?.required ? '*风格' : '风格'}
          </div>
          <Select
            value={selectedStyleOption}
            onChange={(value) => handleStyleChange(String(value))}
            options={styleOptions.map((style) => ({ label: style, value: style }))}
            className={`${inputClass} max-w-[320px]`}
          />
        </div>

        <div className="mt-5 grid gap-x-8 gap-y-3 xl:grid-cols-2">
          {selectedTemplate ? formFields.map(renderTemplateField) : renderFreeformField()}
          <label className={labelClass}>
            <span>补充：</span>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入内容"
              className={inputClass}
            />
          </label>
          {isTemplateMode ? (
            <label className={labelClass}>
              <span>分辨率：</span>
              {resolutionOptions.length > 0 ? (
                <Select
                  value={selectedResolutionId}
                  onChange={(value) => setSelectedTemplateResolutionId(String(value))}
                  options={resolutionOptions.map((option) => ({ label: option.name, value: option.id }))}
                  className={inputClass}
                />
              ) : (
                <button
                  type="button"
                  disabled
                  className={`${inputClass} text-left text-gray-500 dark:text-gray-400`}
                >
                  默认
                </button>
              )}
            </label>
          ) : (
            <label className={labelClass}>
              <span>尺寸：</span>
              <button
                type="button"
                onClick={() => setShowSizePicker(true)}
                className={`${inputClass} text-left font-mono text-gray-700 dark:text-gray-200`}
              >
                {normalizeImageSize(params.size) || DEFAULT_PARAMS.size}
              </button>
            </label>
          )}
          <label className={labelClass}>
            <span>格式：</span>
            <Select
              value={params.output_format}
              onChange={(value) => setParams({ output_format: value as typeof params.output_format })}
              options={[
                { label: 'PNG', value: 'png' },
                { label: 'JPEG', value: 'jpeg' },
                { label: 'WebP', value: 'webp' },
              ]}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span>数量：</span>
            <input
              value={nInput}
              onChange={(e) => setNInput(e.target.value)}
              onBlur={commitN}
              type="number"
              min={1}
              max={MAX_TASK_N}
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-auto pt-8">
          <p className="mb-5 text-base font-bold text-black dark:text-gray-100">*号为必填项/其余为选填项</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-[#e5f1ff] text-base font-black text-[#2f80ed] transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
            >
              <RefreshCw className="h-5 w-5" />
              重置
            </button>
            <button
              type="button"
              onClick={() => void submitTask()}
              disabled={!canSubmit}
              className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-[#2f80ed] text-base font-black text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-white"
            >
              {templateLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              消耗{normalizeTaskN(params.n)}积分生成图片
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            await handleFiles(e.target.files || [])
            e.target.value = ''
          }}
        />
      </section>

      <TemplatePickerModal
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onManageTemplates={() => {
          setShowTemplatePicker(false)
          setShowMyTemplateModal(true)
        }}
      />
      <MyTemplateModal open={showMyTemplateModal} onClose={() => setShowMyTemplateModal(false)} />
    </>
  )
}
