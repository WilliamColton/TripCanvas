import type { Announcement, AppSettings, BugFeedback, ChangelogEntry, CreateBugFeedbackPayload, PromptMode, PromptTemplate, PromptTemplateInputs, PromptTemplatePayload, StoredImage, TaskRecord, TaskParams } from '../types'

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL?.trim()?.replace(/\/+$/, '') || 'http://localhost:3001'
const TOKEN_KEY = 'gpt-image-playground-token'

export interface AuthUser {
  id: string
  label: string
  role: 'admin' | 'user'
  imageCount: number
  quota: number
  unlimitedQuota: boolean
  usedCount: number
  username?: string
  needsMigration?: boolean
  email?: string
  emailVerified?: boolean
}

export function getBackendToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setBackendToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearBackendToken() {
  localStorage.removeItem(TOKEN_KEY)
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function handleUnauthorized(hadToken: boolean) {
  if (!hadToken) return
  clearBackendToken()
  unauthorizedHandler?.()
}

function buildUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getBackendToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const hadToken = Boolean(token)
  const response = await fetch(buildUrl(path), { ...options, headers, cache: 'no-store' })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const payload = await response.json()
      message = payload.error || payload.message || message
    } catch {
      message = await response.text()
    }
    if (response.status === 401) handleUnauthorized(hadToken)
    throw new Error(message)
  }
  const payload = await response.json()
  return unwrapApiResponse<T>(payload)
}

function unwrapApiResponse<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const wrapped = payload as { success: boolean; message?: string; data?: unknown }
    if (!wrapped.success) throw new Error(wrapped.message || '请求失败')
    return (wrapped.data ?? { ok: true }) as T
  }
  return payload as T
}

export async function loginWithApikey(apikey: string): Promise<{ token: string; user: AuthUser }> {
  const result = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ apikey }),
  })
  setBackendToken(result.token)
  return result
}

export async function loginWithCode(code: string): Promise<{ token: string; user: AuthUser }> {
  const result = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  setBackendToken(result.token)
  return result
}

export function redeemCode(code: string): Promise<{ ok: true; quota?: number; usedCount?: number }> {
  return request('/api/auth/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function loginWithPassword(username: string, password: string): Promise<{ token: string; user: AuthUser; needsMigration: boolean }> {
  const result = await request<{ token: string; user: AuthUser; needsMigration: boolean }>('/api/auth/login-password', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setBackendToken(result.token)
  return result
}

export async function register(inviteCode: string, email: string, username: string, password: string): Promise<{ pendingEmail: true }> {
  const result = await request<{ pendingEmail: true }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ inviteCode, email, username, password }),
  })
  return result
}

export async function verifyEmail(email: string, code: string): Promise<{ token: string; user: AuthUser; needsMigration: boolean }> {
  const result = await request<{ token: string; user: AuthUser; needsMigration: boolean }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
  setBackendToken(result.token)
  return result
}

export function resendVerifyCode(email: string): Promise<{ ok: true }> {
  return request('/api/auth/resend-verify-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function migrate(username: string, password: string, confirmPassword: string): Promise<{ user: AuthUser }> {
  return request('/api/auth/migrate', {
    method: 'POST',
    body: JSON.stringify({ username, password, confirmPassword }),
  })
}

export function changePassword(oldPassword: string, newPassword: string, confirmPassword: string): Promise<{ ok: true }> {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
  })
}

export function changeUsername(username: string): Promise<{ ok: true }> {
  return request('/api/auth/username', {
    method: 'PUT',
    body: JSON.stringify({ username }),
  })
}

export function setInviteCode(code: string): Promise<{ ok: true }> {
  return request('/api/auth/invite-code', {
    method: 'PUT',
    body: JSON.stringify({ code }),
  })
}

export function getInviteCode(): Promise<{ code: string | null; setAt: number | null }> {
  return request('/api/auth/invite-code')
}

export interface InvitedUser {
  username: string
  label: string
  createdAt: number
}

export function getInvitedUsers(): Promise<{ invitedUsers: InvitedUser[] }> {
  return request('/api/auth/invited-users')
}

export function getMe(): Promise<{ user: AuthUser }> {
  return request('/api/auth/me')
}

export async function getPublicConfig(): Promise<AppSettings> {
  const response = await fetch(buildUrl('/api/config/public'), { cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return unwrapApiResponse<AppSettings>(await response.json())
}

export async function getPublicAnnouncement(): Promise<Announcement | null> {
  try {
    const response = await fetch(buildUrl('/api/announcement'), { cache: 'no-store' })
    if (!response.ok) return null
    return unwrapApiResponse<Announcement>(await response.json())
  } catch {
    return null
  }
}

export async function getLatestPublicChangelog(): Promise<ChangelogEntry | null> {
  try {
    const response = await fetch(buildUrl('/api/changelog/latest'), { cache: 'no-store' })
    if (!response.ok) return null
    const payload = unwrapApiResponse<{ changelog: ChangelogEntry | null }>(await response.json())
    return payload.changelog
  } catch {
    return null
  }
}

export async function getPublicChangelogEntries(): Promise<{ changelogs: ChangelogEntry[] }> {
  try {
    const response = await fetch(buildUrl('/api/changelog'), { cache: 'no-store' })
    if (!response.ok) return { changelogs: [] }
    return unwrapApiResponse<{ changelogs: ChangelogEntry[] }>(await response.json())
  } catch {
    return { changelogs: [] }
  }
}

export function submitBugFeedback(payload: CreateBugFeedbackPayload): Promise<{ feedback: BugFeedback }> {
  return request('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function uploadImage(dataUrl: string, source: NonNullable<StoredImage['source']> = 'upload'): Promise<StoredImage> {
  const blob = await dataUrlToBlob(dataUrl)
  const mime = blob.type || 'image/png'
  const sha = await sha256Hex(blob)

  const prepare = await request<{ deduplicated: boolean; fallback: boolean; id?: string; key?: string; uploadUrl?: string; url?: string; createdAt?: number; source?: StoredImage['source'] }>('/api/images/prepare', {
    method: 'POST',
    body: JSON.stringify({ sha256: sha, mime, size: blob.size, source }),
  })

  if (prepare.deduplicated && prepare.id) {
    const url = prepare.url && prepare.url.startsWith('http') ? prepare.url : dataUrl
    return { id: prepare.id, dataUrl: url, createdAt: prepare.createdAt ?? Date.now(), source: prepare.source ?? source }
  }

  if (prepare.fallback) {
    // 本地存储不支持直传，回退 multipart。
    const formData = new FormData()
    formData.append('image', blob, `image.${mime.split('/')[1] || 'png'}`)
    formData.append('source', source)
    const result = await request<{ id: string; url?: string; createdAt: number; source: StoredImage['source'] }>('/api/images', {
      method: 'POST',
      body: formData,
    })
    const url = result.url && result.url.startsWith('http') ? result.url : dataUrl
    return { id: result.id, dataUrl: url, createdAt: result.createdAt, source: result.source }
  }

  if (!prepare.id || !prepare.key || !prepare.uploadUrl) {
    throw new Error('直传预备失败')
  }
  // 前端直传 PUT 到 COS 预签名 URL。带 Cache-Control 让对象长缓存（与后端中转上传一致）。
  const putResponse = await fetch(prepare.uploadUrl, {
    method: 'PUT',
    headers: { 'Cache-Control': 'max-age=604800, immutable' },
    body: blob,
  })
  if (!putResponse.ok) throw new Error(`直传失败: HTTP ${putResponse.status}`)

  const committed = await request<{ id: string; url?: string; createdAt: number; source: StoredImage['source'] }>('/api/images/commit', {
    method: 'POST',
    body: JSON.stringify({ id: prepare.id, key: prepare.key, sha256: sha, mime, size: blob.size, source }),
  })
  const url = committed.url && committed.url.startsWith('http') ? committed.url : dataUrl
  return { id: committed.id, dataUrl: url, createdAt: committed.createdAt, source: committed.source }
}

/** 计算 Blob 的 SHA-256 十六进制摘要。 */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 按 id 解析图片对外访问直链：COS 模式返回预签名 URL（<img> 直连 COS）。
 */
export async function resolveImageUrl(id: string): Promise<string> {
  const result = await request<{ url: string }>(`/api/images/${encodeURIComponent(id)}/url`)
  if (!result.url || !result.url.startsWith('http')) {
    throw new Error('后端未返回 COS 图片直链')
  }
  return result.url
}

export function getTemplatePreviewImageUrl(id: string): string {
  return buildUrl(`/api/template-preview-images/${encodeURIComponent(id)}`)
}

// 模板预览图直链缓存：内存 + localStorage，TTL 6 天（< 7 天预签名）。
const previewUrlCache = new Map<string, string>()
const PREVIEW_URL_CACHE_KEY = 'tripcanvas-preview-url-cache-v1'
const PREVIEW_URL_TTL_MS = 6 * 24 * 60 * 60 * 1000

function loadPersistedPreviewUrls() {
  try {
    const raw = localStorage.getItem(PREVIEW_URL_CACHE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, { url: string; expiresAt: number }>
    const now = Date.now()
    for (const [id, entry] of Object.entries(obj)) {
      if (entry?.url && entry.expiresAt > now) previewUrlCache.set(id, entry.url)
    }
  } catch { /* ignore */ }
}
loadPersistedPreviewUrls()

function persistPreviewUrl(id: string, url: string) {
  try {
    const raw = localStorage.getItem(PREVIEW_URL_CACHE_KEY)
    const obj = raw ? JSON.parse(raw) as Record<string, { url: string; expiresAt: number }> : {}
    obj[id] = { url, expiresAt: Date.now() + PREVIEW_URL_TTL_MS }
    localStorage.setItem(PREVIEW_URL_CACHE_KEY, JSON.stringify(obj))
  } catch { /* ignore */ }
}

/** 同步读取已缓存的预览图直链（未缓存返回 undefined）。 */
export function getCachedTemplatePreviewUrl(id: string): string | undefined {
  return previewUrlCache.get(id)
}

/** 按 id 异步解析模板预览图直链并缓存。 */
export async function resolveTemplatePreviewUrl(id: string): Promise<string | undefined> {
  const cached = previewUrlCache.get(id)
  if (cached) return cached
  try {
    const result = await request<{ url: string }>(`/api/template-preview-images/${encodeURIComponent(id)}/url`)
    if (result.url && result.url.startsWith('http')) {
      previewUrlCache.set(id, result.url)
      persistPreviewUrl(id, result.url)
      return result.url
    }
    return undefined
  } catch {
    return undefined
  }
}

export function getTasks(): Promise<{ tasks: TaskRecord[] }> {
  return request('/api/tasks')
}

export function putRemoteTask(task: TaskRecord): Promise<{ ok: true }> {
  return request(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: 'PUT',
    body: JSON.stringify(task),
  })
}

export function deleteRemoteTask(id: string): Promise<{ ok: true }> {
  return request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function deleteRemoteImage(id: string): Promise<{ ok: true }> {
  return request(`/api/images/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function clearRemoteTasks(): Promise<{ ok: true }> {
  return request('/api/tasks', { method: 'DELETE' })
}

export interface SubmitTaskTemplateOptions {
  promptMode?: PromptMode
  templateId?: string
  templateResolutionId?: string
  templateQualityId?: string
  templateInputs?: PromptTemplateInputs
  additionalPrompt?: string
}

export function getTemplates(): Promise<{ templates: PromptTemplate[] }> {
  return request('/api/templates')
}

export function getTemplate(id: string): Promise<{ template: PromptTemplate }> {
  return request(`/api/templates/${encodeURIComponent(id)}`)
}

export function createTemplate(payload: PromptTemplatePayload): Promise<{ template: PromptTemplate }> {
  return request('/api/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTemplate(id: string, payload: PromptTemplatePayload): Promise<{ template: PromptTemplate }> {
  return request(`/api/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteTemplate(id: string): Promise<{ ok: true }> {
  return request(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Submit image generation task to backend */
export async function submitGenerateTask(taskId: string, prompt: string, params: TaskParams, inputImageIds: string[], codexCli: boolean, templateOptions: SubmitTaskTemplateOptions = {}): Promise<{ taskId: string; status: string }> {
  return request('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ taskId, prompt, params, inputImageIds, codexCli, ...templateOptions }),
  })
}

/** Submit image edit task to backend */
export async function submitEditTask(taskId: string, prompt: string, params: TaskParams, inputImageIds: string[], maskImageId: string | null, codexCli: boolean, templateOptions: SubmitTaskTemplateOptions = {}): Promise<{ taskId: string; status: string }> {
  return request('/api/edit', {
    method: 'POST',
    body: JSON.stringify({ taskId, prompt, params, inputImageIds, maskImageId, codexCli, ...templateOptions }),
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

/** Stream task status via SSE. Returns an AbortController to cancel. */
export function streamTaskStatus(
  taskId: string,
  onUpdate: (task: TaskRecord) => void,
  onError?: (err: Error) => void,
): AbortController {
  const controller = new AbortController()

  ;(async () => {
    try {
      const token = getBackendToken()
      const response = await fetch(buildUrl(`/api/tasks/${encodeURIComponent(taskId)}/stream`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        if (response.status === 401) handleUnauthorized(Boolean(token))
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      let lastStatus: string | undefined
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6)) as TaskRecord | { error?: string }
              const task = 'status' in payload ? payload : {
                id: taskId,
                prompt: '',
                params: { size: 'auto', quality: 'auto', output_format: 'png', output_compression: null, moderation: 'auto', n: 1 },
                inputImageIds: [],
                maskTargetImageId: null,
                maskImageId: null,
                outputImages: [],
                status: 'error',
                error: payload.error || '任务更新失败',
                createdAt: Date.now(),
                finishedAt: Date.now(),
                elapsed: null,
              } as TaskRecord
              lastStatus = task.status
              onUpdate(task)
              if (task.status === 'done' || task.status === 'error') {
                reader.cancel()
                return
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
      // Stream ended gracefully — fall back to polling if task still pending
      if (lastStatus === 'queued' || lastStatus === 'running') {
        onError?.(new Error('SSE stream ended before task completion'))
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError?.(err as Error)
      }
    }
  })()

  return controller
}
