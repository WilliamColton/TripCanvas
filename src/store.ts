import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast as sonnerToast } from 'sonner'
import type {
  Announcement,
  AppSettings,
  ChangelogEntry,
  TaskParams,
  InputImage,
  MaskDraft,
  PromptTemplate,
  PromptTemplateInputs,
  TaskRecord,
} from './types'
import { DEFAULT_SETTINGS, DEFAULT_PARAMS, normalizeTaskN } from './types'
import {
  clearBackendToken,
  clearRemoteTasks,
  deleteRemoteImage,
  deleteRemoteTask,
  getBackendToken,
  getMe,
  getLatestPublicChangelog,
  getPublicAnnouncement,
  getPublicChangelogEntries,
  getPublicConfig,
  getTemplates,
  getTasks as fetchTasks,
  putRemoteTask,
  resolveImageUrl,
  submitGenerateTask,
  submitEditTask,
  uploadImage,
  streamTaskStatus,
  setUnauthorizedHandler,
  type AuthUser,
} from './lib/backendApi'
import {
  hashFile,
} from './lib/db'
import { validateMaskMatchesImage } from './lib/canvasImage'
import { orderInputImagesForMask } from './lib/mask'
import { normalizeImageSize } from './lib/size'

// ===== Image cache =====
// 内存缓存只保存图片对外访问直链（COS 预签名/公开直链，或本地带 token 的回退 URL）。
// 不再 fetch 字节、不再转 base64 dataURL、不再写 IndexedDB：
// 浏览器/CDN HTTP 缓存接管，<img> 直连 COS，字节不经应用服务器。

const imageCache = new Map<string, string>()
const IMAGE_URL_CACHE_KEY = 'tripcanvas-image-url-cache-v1'
// 后端 COS 签名默认 7 天。前端缓存略短一点，避免临界过期 URL 被复用。
const IMAGE_URL_CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000

interface PersistedImageUrl {
  url: string
  expiresAt: number
}

type PersistedImageUrlCache = Record<string, PersistedImageUrl>

function readPersistedImageUrlCache(): PersistedImageUrlCache {
  try {
    const raw = localStorage.getItem(IMAGE_URL_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PersistedImageUrlCache
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePersistedImageUrlCache(cache: PersistedImageUrlCache) {
  try {
    localStorage.setItem(IMAGE_URL_CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore quota/private-mode errors */ }
}

function shouldPersistImageUrl(url: string): boolean {
  // 只持久化远程对象存储/CDN URL。不要持久化 blob: 本地预览，也不要持久化带 JWT 的 /api/images 兜底 URL。
  return /^https?:\/\//i.test(url) && !url.includes('/api/images/')
}

function getPersistedImageUrl(id: string): string | undefined {
  const cache = readPersistedImageUrlCache()
  const entry = cache[id]
  if (!entry) return undefined
  if (!entry.url || entry.expiresAt <= Date.now()) {
    delete cache[id]
    writePersistedImageUrlCache(cache)
    return undefined
  }
  imageCache.set(id, entry.url)
  return entry.url
}

function persistImageUrl(id: string, url: string) {
  if (!shouldPersistImageUrl(url)) return
  const cache = readPersistedImageUrlCache()
  cache[id] = { url, expiresAt: Date.now() + IMAGE_URL_CACHE_TTL_MS }
  writePersistedImageUrlCache(cache)
}

function removePersistedImageUrl(id: string) {
  const cache = readPersistedImageUrlCache()
  if (!(id in cache)) return
  delete cache[id]
  writePersistedImageUrlCache(cache)
}

function clearPersistedImageUrlCache() {
  try {
    localStorage.removeItem(IMAGE_URL_CACHE_KEY)
  } catch { /* ignore */ }
}

// ===== Global polling (fallback for page refresh recovery) =====

let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 5000

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(pollRunningTasks, POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ===== SSE task streams =====

const activeStreams = new Map<string, AbortController>()

function cancelAllStreams() {
  for (const controller of activeStreams.values()) {
    controller.abort()
  }
  activeStreams.clear()
}

function clearLocalSessionState() {
  stopPolling()
  cancelAllStreams()
  imageCache.clear()
  clearPersistedImageUrlCache()
  useStore.getState().setAuthUser(null)
  useStore.getState().setTasks([])
  useStore.setState({ templates: [], templatesLoaded: false, selectedTemplateId: '', selectedTemplateResolutionId: '', templateInputs: {} })
  useStore.getState().setShowSettings(false)
}

setUnauthorizedHandler(clearLocalSessionState)

async function refreshAuthUser() {
  try {
    const { user } = await getMe()
    useStore.getState().setAuthUser(user)
  } catch { /* keep existing session state */ }
}

async function pollRunningTasks() {
  const runningTasks = useStore.getState().tasks.filter(t => t.status === 'running' || t.status === 'queued')
  if (runningTasks.length === 0) {
    stopPolling()
    return
  }

  try {
    const { tasks: remoteTasks } = await fetchTasks()
    for (const local of runningTasks) {
      const remote = remoteTasks.find(t => t.id === local.id)
      if (!remote) continue

      if (remote.status === 'done') {
        for (const imgId of remote.outputImages || []) {
          void ensureImageCached(imgId)
        }
        const { tasks: currentTasks, setTasks } = useStore.getState()
        setTasks(currentTasks.map(t => t.id === local.id ? { ...t, ...remote } : t))
        void refreshAuthUser()
        useStore.getState().showToast(`生成完成，共 ${(remote.outputImages || []).length} 张图片`, 'success')
        if (local.maskImageId) useStore.getState().clearMaskDraft()
      } else if (remote.status === 'error' || remote.error) {
        updateTaskLocal(local.id, {
          status: 'error',
          error: remote.error || 'Unknown error',
          finishedAt: Date.now(),
          elapsed: Date.now() - local.createdAt,
        })
        useStore.getState().setDetailTaskId(local.id)
      } else if ((remote.status === 'queued' || remote.status === 'running') && remote.status !== local.status) {
        updateTaskLocal(local.id, { status: remote.status })
      }
    }
  } catch {
    // ignore poll errors, will retry next interval
  }
}

export function getCachedImage(id: string): string | undefined {
  return imageCache.get(id)
}

/**
 * 按 id 解析图片对外访问直链并缓存。COS 模式返回预签名直链，<img> 直连 COS；
 * 本地模式回退到带 token 的 /api/images/{id}。不再转 base64、不再写 IndexedDB。
 */
export async function ensureImageCached(id: string): Promise<string | undefined> {
  const cached = imageCache.get(id)
  if (cached) return cached

  const persisted = getPersistedImageUrl(id)
  if (persisted) return persisted

  try {
    const url = await resolveImageUrl(id)
    imageCache.set(id, url)
    persistImageUrl(id, url)
    return url
  } catch {
    return undefined
  }
}

// ===== Store 类型 =====

interface AppState {
  // 认证
  authUser: AuthUser | null
  setAuthUser: (user: AuthUser | null) => void

  // 设置
  settings: AppSettings
  setSettings: (s: Partial<AppSettings>) => void
  dismissedCodexCliPrompts: string[]
  dismissCodexCliPrompt: (key: string) => void

  // 输入
  prompt: string
  setPrompt: (p: string) => void
  promptMode: 'freeform' | 'template'
  setPromptMode: (mode: 'freeform' | 'template') => void
  templates: PromptTemplate[]
  setTemplates: (templates: PromptTemplate[]) => void
  loadTemplates: () => Promise<void>
  templatesLoaded: boolean
  selectedTemplateId: string
  setSelectedTemplateId: (id: string) => void
  selectedTemplateResolutionId: string
  setSelectedTemplateResolutionId: (id: string) => void
  templateInputs: PromptTemplateInputs
  setTemplateInput: (key: string, value: unknown) => void
  clearTemplateInputs: () => void
  templateLoading: boolean
  inputImages: InputImage[]
  addInputImage: (img: InputImage) => void
  removeInputImage: (idx: number) => void
  clearInputImages: () => void
  setInputImages: (imgs: InputImage[]) => void
  maskDraft: MaskDraft | null
  setMaskDraft: (draft: MaskDraft | null) => void
  clearMaskDraft: () => void
  maskEditorImageId: string | null
  setMaskEditorImageId: (id: string | null) => void

  // 参数
  params: TaskParams
  setParams: (p: Partial<TaskParams>) => void

  // 任务列表
  tasks: TaskRecord[]
  setTasks: (t: TaskRecord[]) => void

  // 搜索和筛选
  searchQuery: string
  setSearchQuery: (q: string) => void
  filterStatus: 'all' | 'queued' | 'running' | 'done' | 'error'
  setFilterStatus: (status: AppState['filterStatus']) => void
  filterFavorite: boolean
  setFilterFavorite: (f: boolean) => void

  // 多选
  selectedTaskIds: string[]
  setSelectedTaskIds: (ids: string[] | ((prev: string[]) => string[])) => void
  toggleTaskSelection: (id: string, force?: boolean) => void
  clearSelection: () => void

  // UI
  detailTaskId: string | null
  setDetailTaskId: (id: string | null) => void
  lightboxImageId: string | null
  lightboxImageList: string[]
  setLightboxImageId: (id: string | null, list?: string[]) => void
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  announcement: Announcement | null
  setAnnouncement: (announcement: Announcement | null) => void
  seenAnnouncementUpdatedAt: number | null
  markAnnouncementSeen: (updatedAt: number) => void
  latestChangelog: ChangelogEntry | null
  setLatestChangelog: (changelog: ChangelogEntry | null) => void
  changelogEntries: ChangelogEntry[]
  setChangelogEntries: (entries: ChangelogEntry[]) => void
  showChangelog: boolean
  setShowChangelog: (show: boolean, dismissKey?: string | null) => void
  pendingChangelogDismissKey: string | null
  dismissedChangelogKeys: string[]
  dismissChangelog: (key: string) => void

  // Toast
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void

  // Confirm dialog
  confirmDialog: {
    title: string
    message: string
    confirmText?: string
    messageAlign?: 'left' | 'center'
    tone?: 'danger' | 'warning'
    action: () => void
    cancelAction?: () => void
  } | null
  setConfirmDialog: (d: AppState['confirmDialog']) => void
}

function firstTemplateResolutionId(templates: PromptTemplate[], templateId: string): string {
  if (!templateId) return ''
  const template = templates.find((item) => item.id === templateId)
  return template?.resolutionOptions?.[0]?.id || ''
}

function resolveSelectedTemplateState(templates: PromptTemplate[], currentTemplateId: string, currentResolutionId: string) {
  const selectedTemplateId = currentTemplateId || templates[0]?.id || ''
  const template = templates.find((item) => item.id === selectedTemplateId)
  const options = template?.resolutionOptions || []
  const selectedTemplateResolutionId = options.some((option) => option.id === currentResolutionId)
    ? currentResolutionId
    : options[0]?.id || ''
  return { selectedTemplateId, selectedTemplateResolutionId }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      authUser: null,
      setAuthUser: (authUser) => set({ authUser }),

      // Settings
      settings: { ...DEFAULT_SETTINGS },
      setSettings: (s) => set((st) => ({
        settings: {
          ...st.settings,
          ...s,
          apiMode:
            s.apiMode === 'images'
              ? s.apiMode
              : st.settings.apiMode ?? DEFAULT_SETTINGS.apiMode,
          codexCli: s.codexCli ?? st.settings.codexCli ?? DEFAULT_SETTINGS.codexCli,
          theme: s.theme ?? st.settings.theme ?? DEFAULT_SETTINGS.theme,
        },
      })),
      dismissedCodexCliPrompts: [],
      dismissCodexCliPrompt: (key) => set((st) => ({
        dismissedCodexCliPrompts: st.dismissedCodexCliPrompts.includes(key)
          ? st.dismissedCodexCliPrompts
          : [...st.dismissedCodexCliPrompts, key],
      })),

      // Input
      prompt: '',
      setPrompt: (prompt) => set({ prompt }),
      promptMode: 'template',
      setPromptMode: (promptMode) => set({ promptMode }),
      templates: [],
      setTemplates: (templates) => set({ templates, templatesLoaded: true }),
      loadTemplates: async () => {
        set({ templateLoading: true, templatesLoaded: true })
        try {
          const { templates } = await getTemplates()
          set((s) => ({
            templates,
            ...resolveSelectedTemplateState(templates, s.selectedTemplateId, s.selectedTemplateResolutionId),
          }))
        } finally {
          set({ templateLoading: false })
        }
      },
      templatesLoaded: false,
      selectedTemplateId: '',
      setSelectedTemplateId: (selectedTemplateId) => set((s) => ({
        selectedTemplateId,
        selectedTemplateResolutionId: firstTemplateResolutionId(s.templates, selectedTemplateId),
        templateInputs: {},
        ...(selectedTemplateId ? { inputImages: [], maskDraft: null, maskEditorImageId: null } : {}),
      })),
      selectedTemplateResolutionId: '',
      setSelectedTemplateResolutionId: (selectedTemplateResolutionId) => set({ selectedTemplateResolutionId }),
      templateInputs: {},
      setTemplateInput: (key, value) => set((s) => ({ templateInputs: { ...s.templateInputs, [key]: value } })),
      clearTemplateInputs: () => set({ templateInputs: {} }),
      templateLoading: false,
      inputImages: [],
      addInputImage: (img) =>
        set((s) => {
          if (s.inputImages.find((i) => i.id === img.id)) return s
          return { inputImages: [...s.inputImages, img] }
        }),
      removeInputImage: (idx) =>
        set((s) => {
          const removed = s.inputImages[idx]
          const shouldClearMask = removed?.id === s.maskDraft?.targetImageId
          return {
            inputImages: s.inputImages.filter((_, i) => i !== idx),
            ...(shouldClearMask ? { maskDraft: null, maskEditorImageId: null } : {}),
          }
        }),
      clearInputImages: () =>
        set((s) => {
          for (const img of s.inputImages) imageCache.delete(img.id)
          return { inputImages: [], maskDraft: null, maskEditorImageId: null }
        }),
      setInputImages: (imgs) =>
        set((s) => {
          const shouldClearMask =
            Boolean(s.maskDraft) && !imgs.some((img) => img.id === s.maskDraft?.targetImageId)
          return {
            inputImages: imgs,
            ...(shouldClearMask ? { maskDraft: null, maskEditorImageId: null } : {}),
          }
        }),
      maskDraft: null,
      setMaskDraft: (maskDraft) => set({ maskDraft }),
      clearMaskDraft: () => set({ maskDraft: null }),
      maskEditorImageId: null,
      setMaskEditorImageId: (maskEditorImageId) => set({ maskEditorImageId }),

      // Params
      params: { ...DEFAULT_PARAMS },
      setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),

      // Tasks
      tasks: [],
      setTasks: (tasks) => set({ tasks }),

      // Search & Filter
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      filterStatus: 'all',
      setFilterStatus: (filterStatus) => set({ filterStatus }),
      filterFavorite: false,
      setFilterFavorite: (filterFavorite) => set({ filterFavorite }),

      // Selection
      selectedTaskIds: [],
      setSelectedTaskIds: (updater) => set((s) => ({
        selectedTaskIds: typeof updater === 'function' ? updater(s.selectedTaskIds) : updater
      })),
      toggleTaskSelection: (id, force) => set((s) => {
        const isSelected = s.selectedTaskIds.includes(id)
        const shouldSelect = force !== undefined ? force : !isSelected
        if (shouldSelect === isSelected) return s
        return {
          selectedTaskIds: shouldSelect
            ? [...s.selectedTaskIds, id]
            : s.selectedTaskIds.filter((x) => x !== id)
        }
      }),
      clearSelection: () => set({ selectedTaskIds: [] }),

      // UI
      detailTaskId: null,
      setDetailTaskId: (detailTaskId) => set({ detailTaskId }),
      lightboxImageId: null,
      lightboxImageList: [],
      setLightboxImageId: (lightboxImageId, list) =>
        set({ lightboxImageId, lightboxImageList: list ?? (lightboxImageId ? [lightboxImageId] : []) }),
      showSettings: false,
      setShowSettings: (showSettings) => set({ showSettings }),
      announcement: null,
      setAnnouncement: (announcement) => set({ announcement }),
      seenAnnouncementUpdatedAt: null,
      markAnnouncementSeen: (updatedAt) => set({ seenAnnouncementUpdatedAt: updatedAt }),
      latestChangelog: null,
      setLatestChangelog: (latestChangelog) => set({ latestChangelog }),
      changelogEntries: [],
      setChangelogEntries: (changelogEntries) => set({ changelogEntries }),
      showChangelog: false,
      setShowChangelog: (showChangelog, dismissKey = null) => set({
        showChangelog,
        pendingChangelogDismissKey: showChangelog ? dismissKey : null,
      }),
      pendingChangelogDismissKey: null,
      dismissedChangelogKeys: [],
      dismissChangelog: (key) => set((st) => ({
        dismissedChangelogKeys: st.dismissedChangelogKeys.includes(key)
          ? st.dismissedChangelogKeys
          : [...st.dismissedChangelogKeys, key],
      })),

      // Toast
      showToast: (message, type = 'info') => {
        sonnerToast[type](message)
      },

      // Confirm
      confirmDialog: null,
      setConfirmDialog: (confirmDialog) => set({ confirmDialog }),
    }),
    {
      name: 'gpt-image-playground',
      partialize: (state) => ({
        settings: state.settings,
        authUser: state.authUser,
        params: state.params,
        dismissedCodexCliPrompts: state.dismissedCodexCliPrompts,
        seenAnnouncementUpdatedAt: state.seenAnnouncementUpdatedAt,
        dismissedChangelogKeys: state.dismissedChangelogKeys,
      }),
    },
  ),
)

export async function bootstrapBackendSession() {
  if (!getBackendToken()) return
  const [{ user }, { tasks }, publicConfig] = await Promise.all([
    getMe(),
    fetchTasks(),
    getPublicConfig(),
  ])
  useStore.getState().setAuthUser(user)
  useStore.getState().setTasks(tasks)
  useStore.getState().setSettings({ ...publicConfig })
  void useStore.getState().loadTemplates().catch(() => {})
  imageCache.clear()
  // 懒解析：仅预热输出图直链（输入/遮罩等用到时再解析），不再 fetch 字节、不再写 IndexedDB。
  for (const task of tasks) {
    if (task.status === 'done') {
      for (const id of task.outputImages || []) void ensureImageCached(id)
    }
  }

  // Resume polling if any tasks are still running
  if (tasks.some(t => t.status === 'running' || t.status === 'queued')) {
    startPolling()
  }
}

export async function logout() {
  clearBackendToken()
  clearLocalSessionState()
}

// ===== Actions =====

let uid = 0
function genId(): string {
  return Date.now().toString(36) + (++uid).toString(36) + Math.random().toString(36).slice(2, 6)
}

export function getCodexCliPromptKey(settings: AppSettings): string {
  return "default"
}

export function showCodexCliPrompt(force = false, reason = '接口返回的提示词已被改写') {
  const state = useStore.getState()
  const settings = state.settings
  const promptKey = getCodexCliPromptKey(settings)
  if (!force && (settings.codexCli || state.dismissedCodexCliPrompts.includes(promptKey))) return

  state.setConfirmDialog({
    title: '检测到 Codex CLI API',
    message: `${reason}，当前 API 来源很可能是 Codex CLI。\n\n是否开启 Codex CLI 兼容模式？开启后会在 Images API 多图生成时使用并发请求，解决该 API 数量参数无效的问题。同时，提示词文本开头会加入简短的不改写要求，避免模型重写提示词，偏离原意。`,
    confirmText: '开启',
    action: () => {
      const state = useStore.getState()
      state.dismissCodexCliPrompt(promptKey)
      state.setSettings({ codexCli: true })
    },
    cancelAction: () => useStore.getState().dismissCodexCliPrompt(promptKey),
  })
}

/** 初始化：从 IndexedDB 加载任务和图片缓存，清理孤立图片 */
export async function initStore() {
  const [announcement, latestChangelog] = await Promise.all([
    getPublicAnnouncement(),
    getLatestPublicChangelog(),
  ])
  useStore.getState().setAnnouncement(announcement)
  useStore.getState().setLatestChangelog(latestChangelog)

  // Always fetch public config to get inviteEnabled (now public, no auth required)
  try {
    const publicConfig = await getPublicConfig()
    useStore.getState().setSettings({ ...publicConfig })
  } catch { /* ignore - backend unreachable, keep localStorage/defaults */ }

  if (getBackendToken()) {
    try {
      await bootstrapBackendSession()
    } catch {
      clearBackendToken()
      clearLocalSessionState()
    }
  }
}

/** 提交新任务 */
export function getChangelogDismissKey(changelog: ChangelogEntry): string {
  return `${changelog.id}:${changelog.updatedAt}`
}

export async function loadChangelogEntries() {
  const { changelogs } = await getPublicChangelogEntries()
  useStore.getState().setChangelogEntries(changelogs)
  return changelogs
}

export async function submitTask(options: { allowFullMask?: boolean } = {}) {
  const { prompt, promptMode, selectedTemplateId, selectedTemplateResolutionId, templateInputs, templates, inputImages, maskDraft, params, showToast, setConfirmDialog } =
    useStore.getState()

  if (!useStore.getState().authUser) {
    showToast('请先输入 apikey 登录', 'error')
    return
  }

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null
  const isTemplateMode = promptMode === 'template' && Boolean(selectedTemplateId)
  const selectedResolution = isTemplateMode
    ? selectedTemplate?.resolutionOptions?.find((option) => option.id === selectedTemplateResolutionId) || selectedTemplate?.resolutionOptions?.[0] || null
    : null

  if (isTemplateMode) {
    if (!selectedTemplate) {
      showToast('请选择模板', 'error')
      return
    }
    for (const field of selectedTemplate.fieldSchema || []) {
      const value = templateInputs[field.key]
      const isEmpty = value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
      if (field.required && isEmpty) {
        showToast(`请填写${field.label || field.key}`, 'error')
        return
      }
    }
  } else if (!prompt.trim()) {
    showToast('请输入提示词', 'error')
    return
  }

  let orderedInputImages = isTemplateMode ? [] : inputImages
  let maskTargetImageId: string | null = null

  if (!isTemplateMode && maskDraft) {
    try {
      orderedInputImages = orderInputImagesForMask(inputImages, maskDraft.targetImageId)
      const coverage = await validateMaskMatchesImage(maskDraft.maskDataUrl, orderedInputImages[0].dataUrl)
      if (coverage === 'full' && !options.allowFullMask) {
        setConfirmDialog({
          title: '确认编辑整张图片？',
          message: '当前遮罩覆盖了整张图片，提交后可能会重绘全部内容。是否继续？',
          confirmText: '继续提交',
          tone: 'warning',
          action: () => {
            void submitTask({ allowFullMask: true })
          },
        })
        return
      }
      maskTargetImageId = maskDraft.targetImageId
    } catch (err) {
      if (!inputImages.some((img) => img.id === maskDraft.targetImageId)) {
        useStore.getState().clearMaskDraft()
      }
      showToast(err instanceof Error ? err.message : String(err), 'error')
      return
    }
  }

  const { tier: _ignoredTier, ...paramsWithoutTier } = params as TaskParams & { tier?: string }
  const normalizedParams = {
    ...paramsWithoutTier,
    size: isTemplateMode ? DEFAULT_PARAMS.size : normalizeImageSize(params.size) || DEFAULT_PARAMS.size,
    quality: DEFAULT_PARAMS.quality,
    output_compression: DEFAULT_PARAMS.output_compression,
    moderation: DEFAULT_PARAMS.moderation,
    n: normalizeTaskN(params.n),
  }
  if (
    normalizedParams.size !== params.size ||
    normalizedParams.quality !== params.quality ||
    normalizedParams.output_compression !== params.output_compression ||
    normalizedParams.moderation !== params.moderation ||
    normalizedParams.n !== params.n
  ) {
    useStore.getState().setParams({
      size: normalizedParams.size,
      quality: normalizedParams.quality,
      output_compression: normalizedParams.output_compression,
      moderation: normalizedParams.moderation,
      n: normalizedParams.n,
    })
  }

  // Show task UI immediately — uploads happen below
  const taskId = genId()
  const displayPrompt = isTemplateMode
    ? `${selectedTemplate?.title || '旅行模板'} · ${Object.values(templateInputs).filter((value) => value != null && String(value).trim()).slice(0, 3).join(' · ') || prompt.trim() || '待生成'}`
    : prompt.trim()
  const task: TaskRecord = {
    id: taskId,
    prompt: displayPrompt,
    promptMode: isTemplateMode ? 'template' : 'freeform',
    templateId: isTemplateMode ? selectedTemplateId : undefined,
    templateResolutionId: isTemplateMode ? selectedResolution?.id : undefined,
    templateResolutionName: isTemplateMode ? selectedResolution?.name || '' : undefined,
    templateTitle: isTemplateMode ? selectedTemplate?.title : undefined,
    templateVersion: isTemplateMode ? selectedTemplate?.version : undefined,
    templateInputs: isTemplateMode ? { ...templateInputs } : undefined,
    userPrompt: isTemplateMode ? prompt.trim() : prompt.trim(),
    params: normalizedParams,
    inputImageIds: orderedInputImages.map((i) => i.id),
    maskTargetImageId,
    maskImageId: null,
    outputImages: [],
    status: 'queued',
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    elapsed: null,
  }

  const latestTasks = useStore.getState().tasks
  useStore.getState().setTasks([task, ...latestTasks])

  // --- Upload images (runs after UI is visible) ---

  let maskImageId: string | null = null
  if (!isTemplateMode && maskDraft) {
    try {
      const maskUploaded = await uploadImage(maskDraft.maskDataUrl, 'mask')
      maskImageId = maskUploaded.id
      imageCache.set(maskImageId, maskUploaded.dataUrl)
      persistImageUrl(maskImageId, maskUploaded.dataUrl)
      updateTaskLocal(taskId, { maskImageId })
    } catch (err) {
      if (!inputImages.some((img) => img.id === maskDraft.targetImageId)) {
        useStore.getState().clearMaskDraft()
      }
      updateTaskLocal(taskId, { status: 'error', error: err instanceof Error ? err.message : String(err), finishedAt: Date.now() })
      return
    }
  }

  try {
    const idMap = new Map<string, string>() // oldId -> newId
    const uploadedImages: typeof orderedInputImages = []
    for (const img of orderedInputImages) {
      if (!img.dataUrl.startsWith('http')) {
        const uploaded = await uploadImage(img.dataUrl, 'upload')
        imageCache.delete(img.id)
        imageCache.set(uploaded.id, uploaded.dataUrl)
        persistImageUrl(uploaded.id, uploaded.dataUrl)
        idMap.set(img.id, uploaded.id)
        uploadedImages.push({ ...img, id: uploaded.id, dataUrl: uploaded.dataUrl })
      } else {
        uploadedImages.push(img)
      }
    }
    orderedInputImages = uploadedImages

    // Update maskTargetImageId if it was a local ID that got replaced
    if (maskTargetImageId && idMap.has(maskTargetImageId)) {
      maskTargetImageId = idMap.get(maskTargetImageId)!
    }
  } catch (err) {
    updateTaskLocal(taskId, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      finishedAt: Date.now(),
      elapsed: Date.now() - task.createdAt,
    })
    useStore.getState().setDetailTaskId(taskId)
    showToast(`图片上传失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    return
  }

  // Update task with final input image IDs (after upload)
  updateTaskLocal(taskId, {
    inputImageIds: orderedInputImages.map((i) => i.id),
    ...(maskTargetImageId ? { maskTargetImageId } : {}),
  })

  executeTask(taskId)
}

function handleTaskDone(taskId: string, remote: TaskRecord) {
  const local = useStore.getState().tasks.find(t => t.id === taskId)
  for (const imgId of remote.outputImages || []) {
    void ensureImageCached(imgId)
  }
  const { tasks: currentTasks, setTasks } = useStore.getState()
  setTasks(currentTasks.map(t => t.id === taskId ? { ...t, ...remote } : t))
  void refreshAuthUser()
  useStore.getState().showToast(`生成完成，共 ${(remote.outputImages || []).length} 张图片`, 'success')
  if (local?.maskImageId) useStore.getState().clearMaskDraft()
}

function handleTaskError(taskId: string, remote: TaskRecord) {
  updateTaskLocal(taskId, {
    status: 'error',
    error: remote.error || 'Unknown error',
    finishedAt: Date.now(),
    elapsed: Date.now() - (useStore.getState().tasks.find(t => t.id === taskId)?.createdAt || Date.now()),
  })
  useStore.getState().setDetailTaskId(taskId)
}

async function executeTask(taskId: string) {
  const task = useStore.getState().tasks.find((t) => t.id === taskId)
  if (!task) return

  const settings = useStore.getState().settings

  try {
    const templateOptions = task.promptMode === 'template'
        ? {
          promptMode: 'template' as const,
          templateId: task.templateId,
          templateResolutionId: task.templateResolutionId,
          templateInputs: task.templateInputs,
          additionalPrompt: task.userPrompt || '',
        }
      : null

    // Submit task to backend based on apiMode
    if (task.inputImageIds.length > 0 && task.maskImageId) {
      if (templateOptions) {
        await submitEditTask(taskId, task.prompt, task.params, task.inputImageIds, task.maskImageId, settings.codexCli, templateOptions)
      } else {
        await submitEditTask(taskId, task.prompt, task.params, task.inputImageIds, task.maskImageId, settings.codexCli)
      }
    } else if (templateOptions) {
      await submitGenerateTask(taskId, task.prompt, task.params, task.inputImageIds, settings.codexCli, templateOptions)
    } else {
      await submitGenerateTask(taskId, task.prompt, task.params, task.inputImageIds, settings.codexCli)
    }

    // Use SSE for real-time updates, fall back to polling on error
    const controller = streamTaskStatus(
      taskId,
      (remote) => {
        if (remote.status === 'done') {
          activeStreams.delete(taskId)
          handleTaskDone(taskId, remote)
        } else if (remote.status === 'error' || remote.error) {
          activeStreams.delete(taskId)
          handleTaskError(taskId, remote)
        } else if (remote.status === 'queued' || remote.status === 'running') {
          const local = useStore.getState().tasks.find(t => t.id === taskId)
          if (local?.status !== remote.status) updateTaskLocal(taskId, { status: remote.status })
        }
      },
      () => {
        // SSE failed — fall back to polling
        activeStreams.delete(taskId)
        startPolling()
      },
    )
    activeStreams.set(taskId, controller)
  } catch (err) {
    updateTaskLocal(taskId, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      finishedAt: Date.now(),
      elapsed: Date.now() - task.createdAt,
    })
    useStore.getState().setDetailTaskId(taskId)
  }
}

function patchTaskInStore(taskId: string, patch: Partial<TaskRecord>) {
  const { tasks, setTasks } = useStore.getState()
  let changed = false
  const updated = tasks.map((t) => {
    if (t.id !== taskId) return t
    changed = true
    return { ...t, ...patch }
  })
  if (changed) setTasks(updated)
  return updated.find((t) => t.id === taskId) || null
}

function updateTaskLocal(taskId: string, patch: Partial<TaskRecord>) {
  patchTaskInStore(taskId, patch)
}

export function updateTaskInStore(taskId: string, patch: Partial<TaskRecord>) {
  const task = patchTaskInStore(taskId, patch)
  if (task) putRemoteTask(task)
}

/** 复用配置 */
export async function reuseConfig(task: TaskRecord) {
  const { setPrompt, setPromptMode, setSelectedTemplateId, setSelectedTemplateResolutionId, setParams, setInputImages, setMaskDraft, clearMaskDraft, showToast } = useStore.getState()
  if (task.promptMode === 'template' && task.templateId) {
    setPromptMode('template')
    setSelectedTemplateId(task.templateId)
    setSelectedTemplateResolutionId(task.templateResolutionId || '')
    useStore.setState({ templateInputs: { ...(task.templateInputs || {}) } })
    setPrompt(task.userPrompt || '')
  } else {
    setPromptMode('freeform')
    setPrompt(task.prompt)
  }
  setParams(task.params)

  // 恢复输入图片
  const imgs: InputImage[] = []
  for (const imgId of task.inputImageIds) {
    const dataUrl = await ensureImageCached(imgId)
    if (dataUrl) {
      imgs.push({ id: imgId, dataUrl })
    }
  }
  setInputImages(imgs)
  const maskTargetImageId = task.maskTargetImageId ?? (task.maskImageId ? task.inputImageIds[0] : null)
  if (maskTargetImageId && task.maskImageId && imgs.some((img) => img.id === maskTargetImageId)) {
    const maskDataUrl = await ensureImageCached(task.maskImageId)
    if (maskDataUrl) {
      setMaskDraft({
        targetImageId: maskTargetImageId,
        maskDataUrl,
        updatedAt: Date.now(),
      })
    } else {
      clearMaskDraft()
    }
  } else {
    clearMaskDraft()
  }
  showToast('已复用配置到输入框', 'success')
}

/** 编辑输出：将输出图加入输入 */
export async function editOutputs(task: TaskRecord) {
  const { inputImages, addInputImage, clearMaskDraft, showToast } = useStore.getState()
  if (!task.outputImages?.length) return

  clearMaskDraft()
  let added = 0
  for (const imgId of task.outputImages) {
    if (inputImages.find((i) => i.id === imgId)) continue
    const dataUrl = await ensureImageCached(imgId)
    if (dataUrl) {
      addInputImage({ id: imgId, dataUrl })
      added++
    }
  }
  showToast(`已添加 ${added} 张输出图到输入`, 'success')
}

/** 删除多条任务 */
function collectTaskImageIds(tasks: TaskRecord[]): Set<string> {
  const ids = new Set<string>()
  for (const task of tasks) {
    for (const id of task.inputImageIds || []) ids.add(id)
    if (task.maskImageId) ids.add(task.maskImageId)
    for (const id of task.outputImages || []) ids.add(id)
  }
  return ids
}

function collectReferencedImageIds(tasks: TaskRecord[], inputImages: InputImage[]): Set<string> {
  const ids = collectTaskImageIds(tasks)
  for (const img of inputImages) ids.add(img.id)
  return ids
}

async function deleteUnreferencedRemoteImages(imageIds: Set<string>, stillUsed: Set<string>): Promise<number> {
  let failed = 0
  for (const imgId of imageIds) {
    if (stillUsed.has(imgId)) continue
    try {
      await deleteRemoteImage(imgId)
      imageCache.delete(imgId)
      removePersistedImageUrl(imgId)
    } catch {
      failed++
    }
  }
  return failed
}

/** 删除多条任务 */
export async function removeMultipleTasks(taskIds: string[]) {
  const { tasks, setTasks, inputImages, showToast, selectedTaskIds } = useStore.getState()

  if (!taskIds.length) return

  const toDelete = new Set(taskIds)
  const deletedTasks = tasks.filter(t => toDelete.has(t.id))
  const remaining = tasks.filter(t => !toDelete.has(t.id))
  const deletedImageIds = collectTaskImageIds(deletedTasks)
  const stillUsed = collectReferencedImageIds(remaining, inputImages)

  try {
    for (const id of taskIds) {
      await deleteRemoteTask(id)
    }
  } catch (err) {
    showToast(`删除失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    return
  }

  setTasks(remaining)

  const newSelection = selectedTaskIds.filter(id => !toDelete.has(id))
  if (newSelection.length !== selectedTaskIds.length) {
    useStore.getState().setSelectedTaskIds(newSelection)
  }

  const failedImages = await deleteUnreferencedRemoteImages(deletedImageIds, stillUsed)
  if (failedImages > 0) {
    showToast(`已删除 ${taskIds.length} 条记录，${failedImages} 张图片清理失败`, 'error')
    return
  }

  showToast(`已删除 ${taskIds.length} 条记录`, 'success')
}

/** 删除单条任务 */
export async function removeTask(task: TaskRecord) {
  const { tasks, setTasks, inputImages, showToast } = useStore.getState()
  const remaining = tasks.filter((t) => t.id !== task.id)
  const taskImageIds = collectTaskImageIds([task])
  const stillUsed = collectReferencedImageIds(remaining, inputImages)

  try {
    await deleteRemoteTask(task.id)
  } catch (err) {
    showToast(`删除失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    return
  }

  setTasks(remaining)

  const failedImages = await deleteUnreferencedRemoteImages(taskImageIds, stillUsed)
  if (failedImages > 0) {
    showToast(`记录已删除，${failedImages} 张图片清理失败`, 'error')
    return
  }

  showToast('记录已删除', 'success')
}


/** 添加图片到输入（文件上传）—— 用 objectURL 预览，不转 base64、不写 IndexedDB */
export async function addImageFromFile(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) return
  const id = await hashFile(file)
  const dataUrl = URL.createObjectURL(file)
  imageCache.set(id, dataUrl)
  useStore.getState().addInputImage({ id, dataUrl })
}

/** 添加图片到输入（右键菜单）—— 支持 data/blob/http URL，统一转 blob 预览 */
export async function addImageFromUrl(src: string): Promise<void> {
  const res = await fetch(src)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('不是有效的图片')
  const id = await hashFile(blob)
  const dataUrl = URL.createObjectURL(blob)
  imageCache.set(id, dataUrl)
  useStore.getState().addInputImage({ id, dataUrl })
}
