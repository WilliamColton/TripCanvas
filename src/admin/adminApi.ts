import type { Announcement, BugFeedback, BugFeedbackStatus, ChangelogEntry, ChangelogEntryPayload, PromptTemplate, PromptTemplatePayload } from '../types'
import { sha256Hex } from '../lib/backendApi'

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL?.trim()?.replace(/\/+$/, '') || 'http://localhost:3001'
const ADMIN_TOKEN_KEY = 'gpt-image-playground-admin-token'

export interface AdminUser {
  id: string
  label: string
  username?: string
  role: string
  status: string
  quota: number
  unlimitedQuota: boolean
  usedCount: number
  createdAt: number
}

export interface RedemptionCode {
  id: string
  code: string
  quota: number
  usedBy: string | null
  usedAt: number | null
  createdAt: number
}

export interface ApiEndpoint {
  baseUrl: string
  apiKey: string
  maxConcurrency?: number
  priority?: number
  costPerImageX10000?: number
  cost1KX10000?: number
  cost2KX10000?: number
  cost4KX10000?: number
  _key?: string
}

let adminUnauthorizedHandler: (() => void) | null = null

export function setAdminUnauthorizedHandler(handler: (() => void) | null) {
  adminUnauthorizedHandler = handler
}

function getAdminToken(): string {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

function buildUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getAdminToken()
  const hadToken = !!token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildUrl(path), { ...options, headers, cache: 'no-store' })
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && hadToken) {
      clearAdminToken()
      adminUnauthorizedHandler?.()
    }
    let message = `HTTP ${response.status}`
    try {
      const payload = await response.json()
      message = payload.error || payload.message || message
    } catch {
      message = await response.text()
    }
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

export async function adminLogin(apikey: string): Promise<{ token: string }> {
  const result = await adminRequest<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ apikey }),
  })
  setAdminToken(result.token)
  return result
}

export function adminListUsers(): Promise<{ users: AdminUser[] }> {
  return adminRequest('/api/admin/users')
}

export function adminUpdateQuota(userId: string, delta: number, resetUsedCount = false, mode: 'delta' | 'set' = 'delta'): Promise<{ ok: true }> {
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/quota`, {
    method: 'PUT',
    body: JSON.stringify({ delta, resetUsedCount, mode }),
  })
}

export function adminToggleStatus(userId: string, status: 'active' | 'disabled'): Promise<{ ok: true }> {
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function adminToggleUnlimited(userId: string, unlimited: boolean): Promise<{ ok: true }> {
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/unlimited`, {
    method: 'PUT',
    body: JSON.stringify({ unlimited }),
  })
}

export function isAdminLoggedIn(): boolean {
  return !!getAdminToken()
}

export function adminCreateCodes(quota: number, count: number = 1): Promise<{ codes: RedemptionCode[] }> {
  return adminRequest('/api/admin/codes', {
    method: 'POST',
    body: JSON.stringify({ quota, count }),
  })
}

export function adminListCodes(): Promise<{ codes: RedemptionCode[] }> {
  return adminRequest('/api/admin/codes')
}

export function adminDeleteUser(userId: string): Promise<{ ok: true }> {
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}

export function adminDeleteUsers(ids: string[]): Promise<{ ok: true; deleted: number }> {
  return adminRequest('/api/admin/users', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

export function adminDeleteCodes(ids: string[]): Promise<{ ok: true; deleted: number }> {
  return adminRequest('/api/admin/codes', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

export function adminGetEndpoints(): Promise<{ endpointsAuto: ApiEndpoint[]; endpoints1K: ApiEndpoint[]; endpoints2K: ApiEndpoint[]; endpoints4K: ApiEndpoint[] }> {
  return adminRequest('/api/admin/config/endpoints')
}

export function adminUpdateEndpoints(endpointsAuto: ApiEndpoint[], endpoints1K: ApiEndpoint[], endpoints2K: ApiEndpoint[], endpoints4K: ApiEndpoint[]): Promise<{ ok: true; endpointsAuto: ApiEndpoint[]; endpoints1K: ApiEndpoint[]; endpoints2K: ApiEndpoint[]; endpoints4K: ApiEndpoint[] }> {
  return adminRequest('/api/admin/config/endpoints', {
    method: 'PUT',
    body: JSON.stringify({ endpointsAuto, endpoints1K, endpoints2K, endpoints4K }),
  })
}

// ─── Pricing Configuration ───

export interface PricingConfigResponse {
  endpointsAuto: ApiEndpoint[]
  endpoints1K: ApiEndpoint[]
  endpoints2K: ApiEndpoint[]
  endpoints4K: ApiEndpoint[]
  salePriceX10000: number
  salePricingMode: string
  salePrice1KX10000: number
  salePrice2KX10000: number
  salePrice4KX10000: number
  moneyScale: number
  ok?: true
}

export function adminGetPricingConfig(): Promise<PricingConfigResponse> {
  return adminRequest<PricingConfigResponse>('/api/admin/config/pricing')
}

export function adminUpdatePricingConfig(
  endpointsAuto: ApiEndpoint[],
  endpoints1K: ApiEndpoint[],
  endpoints2K: ApiEndpoint[],
  endpoints4K: ApiEndpoint[],
  salePriceX10000: number,
  salePricingMode: string,
  salePrice1KX10000: number,
  salePrice2KX10000: number,
  salePrice4KX10000: number,
): Promise<PricingConfigResponse> {
  return adminRequest<PricingConfigResponse>('/api/admin/config/pricing', {
    method: 'PUT',
    body: JSON.stringify({ endpointsAuto, endpoints1K, endpoints2K, endpoints4K, salePriceX10000, salePricingMode, salePrice1KX10000, salePrice2KX10000, salePrice4KX10000 }),
  })
}

// ─── Billing Analytics ───

export type AnalyticsRange = 'today' | '7d' | '30d' | 'all'

export interface AnalyticsMeta {
  range: AnalyticsRange
  from: number | null
  to: number | null
  moneyScale: number
}

export interface BillingSummary {
  revenueX10000: number
  costX10000: number
  profitX10000: number
  successImages: number
}

export interface BillingSummaryResponse {
  meta: AnalyticsMeta
  summary: BillingSummary
}

export interface BillingTrendPoint {
  bucket: string
  revenueX10000: number
  costX10000: number
  profitX10000: number
  successImages: number
}

export interface BillingTrendResponse {
  meta: AnalyticsMeta
  trend: BillingTrendPoint[]
}

export interface BillingEndpointRow {
  endpointBaseUrl: string
  endpointLabel: string
  successImages: number
  revenueX10000: number
  costX10000: number
  profitX10000: number
  profitRateBps: number
}

export interface BillingEndpointBreakdownResponse {
  meta: AnalyticsMeta
  rows: BillingEndpointRow[]
}

export interface BillingUserRow {
  userId: string
  userLabel: string
  successImages: number
  revenueX10000: number
  costX10000: number
  profitX10000: number
  profitRateBps: number
}

export interface BillingUserBreakdownResponse {
  meta: AnalyticsMeta
  rows: BillingUserRow[]
}

export interface ImageSizeRow {
  imageSize: string
  successImages: number
  revenueX10000: number
  costX10000: number
  profitX10000: number
}

export interface ImageSizeBreakdownResponse {
  meta: AnalyticsMeta
  rows: ImageSizeRow[]
}

export interface EndpointSizeCell {
  successImages: number
  costX10000: number
}

export interface EndpointSizeBreakdownRow {
  endpointBaseUrl: string
  endpointLabel: string
  size1K: EndpointSizeCell
  size2K: EndpointSizeCell
  size4K: EndpointSizeCell
  unknown: EndpointSizeCell
}

export interface EndpointSizeBreakdownResponse {
  meta: AnalyticsMeta
  rows: EndpointSizeBreakdownRow[]
}

export function adminGetBillingSummary(range: AnalyticsRange): Promise<BillingSummaryResponse> {
  return adminRequest<BillingSummaryResponse>(`/api/admin/analytics/summary?range=${encodeURIComponent(range)}`)
}

export function adminGetBillingTrend(range: AnalyticsRange): Promise<BillingTrendResponse> {
  return adminRequest<BillingTrendResponse>(`/api/admin/analytics/trend?range=${encodeURIComponent(range)}`)
}

export function adminGetBillingEndpointBreakdown(range: AnalyticsRange): Promise<BillingEndpointBreakdownResponse> {
  return adminRequest<BillingEndpointBreakdownResponse>(`/api/admin/analytics/endpoints?range=${encodeURIComponent(range)}`)
}

export function adminGetBillingUserBreakdown(range: AnalyticsRange): Promise<BillingUserBreakdownResponse> {
  return adminRequest<BillingUserBreakdownResponse>(`/api/admin/analytics/users?range=${encodeURIComponent(range)}`)
}

export function adminGetImageSizeBreakdown(range: AnalyticsRange): Promise<ImageSizeBreakdownResponse> {
  return adminRequest<ImageSizeBreakdownResponse>(`/api/admin/analytics/image-sizes?range=${encodeURIComponent(range)}`)
}

export function adminGetEndpointSizeBreakdown(range: AnalyticsRange): Promise<EndpointSizeBreakdownResponse> {
  return adminRequest<EndpointSizeBreakdownResponse>(`/api/admin/analytics/endpoint-sizes?range=${encodeURIComponent(range)}`)
}

export function adminClearBillingAnalytics(): Promise<{ ok: true; deleted: number }> {
  return adminRequest<{ ok: true; deleted: number }>('/api/admin/analytics', { method: 'DELETE' })
}

export function adminGetAnnouncement(): Promise<Announcement> {
  return adminRequest('/api/admin/announcement')
}

export function adminUpdateAnnouncement(content: string, enabled: boolean): Promise<Announcement> {
  return adminRequest('/api/admin/announcement', {
    method: 'PUT',
    body: JSON.stringify({ content, enabled }),
  })
}

export function adminListFeedbacks(): Promise<{ feedbacks: BugFeedback[] }> {
  return adminRequest('/api/admin/feedback')
}

export function adminUpdateFeedbackStatus(id: string, status: BugFeedbackStatus): Promise<BugFeedback> {
  return adminRequest(`/api/admin/feedback/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function adminListChangelogEntries(): Promise<{ changelogs: ChangelogEntry[] }> {
  return adminRequest('/api/admin/changelog')
}

export function adminCreateChangelogEntry(payload: ChangelogEntryPayload): Promise<ChangelogEntry> {
  return adminRequest('/api/admin/changelog', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function adminUpdateChangelogEntry(id: string, payload: ChangelogEntryPayload): Promise<ChangelogEntry> {
  return adminRequest(`/api/admin/changelog/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function adminDeleteChangelogEntry(id: string): Promise<{ ok: true }> {
  return adminRequest(`/api/admin/changelog/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function adminListTemplates(): Promise<{ templates: PromptTemplate[] }> {
  return adminRequest('/api/admin/templates')
}

export function adminCreateTemplate(payload: PromptTemplatePayload): Promise<{ template: PromptTemplate }> {
  return adminRequest('/api/admin/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function adminUpdateTemplate(id: string, payload: PromptTemplatePayload): Promise<{ template: PromptTemplate }> {
  return adminRequest(`/api/admin/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function adminDeleteTemplate(id: string): Promise<{ ok: true }> {
  return adminRequest(`/api/admin/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function adminToggleTemplateStatus(id: string): Promise<{ template: PromptTemplate }> {
  return adminRequest(`/api/admin/templates/${encodeURIComponent(id)}/toggle`, {
    method: 'PUT',
  })
}

export function adminPreviewTemplate(payload: { promptBody: string; fieldSchema: PromptTemplatePayload['fieldSchema']; templateInputs: Record<string, unknown>; additionalPrompt?: string; negativePrompt?: string }): Promise<{ prompt: string }> {
  return adminRequest('/api/admin/templates/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function adminUploadTemplatePreviewImage(dataUrl: string): Promise<{ id: string; url: string; createdAt: number }> {
  const blob = await dataUrlToBlob(dataUrl)
  const mime = blob.type || 'image/png'
  const sha = await sha256Hex(blob)

  const prepare = await adminRequest<{ deduplicated: boolean; fallback: boolean; id?: string; key?: string; uploadUrl?: string; url?: string; createdAt?: number; source?: string }>('/api/images/prepare', {
    method: 'POST',
    body: JSON.stringify({ sha256: sha, mime, size: blob.size, source: 'upload' }),
  })
  if (prepare.deduplicated && prepare.id) {
    return { id: prepare.id, url: prepare.url ?? dataUrl, createdAt: prepare.createdAt ?? Date.now() }
  }
  if (prepare.fallback) {
    const formData = new FormData()
    formData.append('image', blob, `preview.${mime.split('/')[1] || 'png'}`)
    return adminRequest('/api/admin/template-preview-images', { method: 'POST', body: formData })
  }
  if (!prepare.id || !prepare.key || !prepare.uploadUrl) {
    throw new Error('直传预备失败')
  }
  const putResponse = await fetch(prepare.uploadUrl, {
    method: 'PUT',
    headers: { 'Cache-Control': 'max-age=604800, immutable' },
    body: blob,
  })
  if (!putResponse.ok) throw new Error(`直传失败: HTTP ${putResponse.status}`)
  const committed = await adminRequest<{ id: string; url?: string; createdAt: number; source: string }>('/api/images/commit', {
    method: 'POST',
    body: JSON.stringify({ id: prepare.id, key: prepare.key, sha256: sha, mime, size: blob.size, source: 'upload' }),
  })
  return { id: committed.id, url: committed.url ?? dataUrl, createdAt: committed.createdAt }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

// ─── Invite Code Management ───

export function adminResetPassword(userId: string, password: string): Promise<{ ok: true }> {
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  })
}

export function adminGetInviteConfig(): Promise<{ inviterReward: number; inviteeReward: number; defaultQuota: number; inviteEnabled: boolean }> {
  return adminRequest('/api/admin/invite-config')
}

export function adminUpdateInviteConfig(inviterReward: number, inviteeReward: number, defaultQuota: number, inviteEnabled: boolean): Promise<{ ok: true; inviterReward: number; inviteeReward: number; defaultQuota: number; inviteEnabled: boolean }> {
  return adminRequest('/api/admin/invite-config', {
    method: 'PUT',
    body: JSON.stringify({ inviterReward, inviteeReward, defaultQuota, inviteEnabled }),
  })
}

export function adminListInvites(): Promise<{ invites: Array<{ username: string; inviteCode: string; usageCount: number }> }> {
  return adminRequest('/api/admin/invites')
}

export function adminGetEmailConfig(): Promise<{ allowedSuffixes: string[] }> {
  return adminRequest('/api/admin/email-config')
}

export function adminUpdateEmailConfig(allowedSuffixes: string[]): Promise<{ ok: true; allowedSuffixes: string[] }> {
  return adminRequest('/api/admin/email-config', {
    method: 'PUT',
    body: JSON.stringify({ allowedSuffixes }),
  })
}
