import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import {
  adminListUsers, adminUpdateQuota, adminToggleStatus, adminDeleteUser, clearAdminToken,
  adminCreateCodes, adminListCodes, adminDeleteUsers, adminDeleteCodes,
  adminGetEndpoints, adminUpdateEndpoints, adminGetAnnouncement, adminUpdateAnnouncement,
  adminListFeedbacks, adminUpdateFeedbackStatus,
  adminListChangelogEntries, adminCreateChangelogEntry, adminUpdateChangelogEntry, adminDeleteChangelogEntry,
  adminGetPricingConfig, adminUpdatePricingConfig,
  adminGetBillingSummary, adminGetBillingTrend,
  adminGetBillingEndpointBreakdown, adminGetBillingUserBreakdown,
  adminGetImageSizeBreakdown, adminGetEndpointSizeBreakdown, adminClearBillingAnalytics,
  adminResetPassword, adminGetInviteConfig, adminUpdateInviteConfig, adminListInvites,
  adminGetEmailConfig, adminUpdateEmailConfig,
  adminToggleUnlimited,
  adminListTemplates, adminCreateTemplate, adminUpdateTemplate, adminDeleteTemplate, adminToggleTemplateStatus, adminPreviewTemplate, adminUploadTemplatePreviewImage,
  type AdminUser, type RedemptionCode, type ApiEndpoint,
  type AnalyticsRange, type AnalyticsMeta, type BillingSummary, type BillingTrendPoint,
  type BillingEndpointRow, type BillingUserRow, type ImageSizeRow, type EndpointSizeBreakdownRow,
} from './adminApi'
import { formatMoneyInputFromX10000, parseMoneyInputToX10000 } from './moneyFormat'
import { copyTextToClipboard } from '../lib/clipboard'
import { useStore } from '../store'
import { Toaster } from '../components/ui/sonner'
import { TASK_QUALITIES, normalizeTaskQuality } from '../types'
import type { BugFeedback, BugFeedbackStatus, ChangelogEntry, ChangelogEntryPayload, PromptTemplate, PromptTemplateField, PromptTemplatePayload, PromptTemplateQualityOption, PromptTemplateResolutionOption, TaskQuality, ThemeMode } from '../types'
import FieldSchemaEditor from '../components/FieldSchemaEditor'
import TemplatePreviewImg from '../components/TemplatePreviewImg'
import Select from '../components/Select'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Switch } from '../components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'


const TEMPLATE_QUALITY_LABELS: Record<TaskQuality, string> = {
  auto: '自动',
  low: '低质量',
  medium: '中质量',
  high: '高质量',
}

const TEMPLATE_QUALITY_BADGE_CLASS_NAMES: Record<TaskQuality, string> = {
  auto: 'bg-gray-500/10 text-gray-700 ring-1 ring-gray-500/20 dark:text-gray-200',
  low: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300',
  medium: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
  high: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300',
}

function templateOptionCreditValue(value: unknown, fallback = 1) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 1000 ? numeric : fallback
}

function fixedTemplateQualityOptions(options: PromptTemplateQualityOption[] = [], fallbackCreditCost = 1): PromptTemplateQualityOption[] {
  const normalizedFallbackCreditCost = templateOptionCreditValue(fallbackCreditCost)
  const creditCostByQuality = new Map<TaskQuality, number>()
  for (const option of options) {
    const quality = normalizeTaskQuality(option.quality)
    creditCostByQuality.set(quality, templateOptionCreditValue(option.creditCost, normalizedFallbackCreditCost))
  }
  return TASK_QUALITIES.map((quality) => ({
    id: `quality_${quality}`,
    name: TEMPLATE_QUALITY_LABELS[quality],
    quality,
    creditCost: creditCostByQuality.get(quality) ?? normalizedFallbackCreditCost,
  }))
}

function defaultTemplateQualityOptions(creditCost = 1): PromptTemplateQualityOption[] {
  return fixedTemplateQualityOptions([], creditCost)
}

interface Props {
  onLogout: () => void
}

type Tab = 'users' | 'codes' | 'config' | 'analytics' | 'announcement' | 'feedback' | 'changelog' | 'templates' | 'invites'
type EndpointTierTab = 'auto' | '1K' | '2K' | '4K'

export default function AdminDashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [codes, setCodes] = useState<RedemptionCode[]>([])
  const [loading, setLoading] = useState(true)
  const [quotaModal, setQuotaModal] = useState<{ user: AdminUser; mode: 'increase' | 'decrease' | 'set' } | null>(null)
  const [quotaValue, setQuotaValue] = useState('')
  const [quotaConfirm, setQuotaConfirm] = useState<{ user: AdminUser; mode: 'increase' | 'decrease' | 'set'; value: number } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ user: AdminUser; action: 'disable' | 'enable' | 'delete' } | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [selectedCodeIds, setSelectedCodeIds] = useState<Set<string>>(new Set())
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())
  const [batchConfirm, setBatchConfirm] = useState<{ type: 'users' | 'codes'; count: number } | null>(null)
  const toast = useStore((s) => s.showToast)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [codeQuota, setCodeQuota] = useState('')
  const [codeCount, setCodeCount] = useState('1')
  const [creating, setCreating] = useState(false)
  const [codeFilter, setCodeFilter] = useState<number | null>(null)
  const [endpointsAuto, setEndpointsAuto] = useState<ApiEndpoint[]>([])
  const [endpoints1K, setEndpoints1K] = useState<ApiEndpoint[]>([])
  const [endpoints2K, setEndpoints2K] = useState<ApiEndpoint[]>([])
  const [endpoints4K, setEndpoints4K] = useState<ApiEndpoint[]>([])
  const [activeTierTab, setActiveTierTab] = useState<EndpointTierTab>('auto')
  const [endpointsLoading, setEndpointsLoading] = useState(false)
  const [pricingSaving, setPricingSaving] = useState(false)
  const [salePriceInput, setSalePriceInput] = useState('')
  const [costDraftsAuto, setCostDraftsAuto] = useState<Record<string, { '1K': string; '2K': string; '4K': string }>>({})
  const [costDrafts1K, setCostDrafts1K] = useState<Record<string, string>>({})
  const [costDrafts2K, setCostDrafts2K] = useState<Record<string, string>>({})
  const [costDrafts4K, setCostDrafts4K] = useState<Record<string, string>>({})
  const [priceErrorsAuto, setPriceErrorsAuto] = useState<Record<string, { '1K'?: string | null; '2K'?: string | null; '4K'?: string | null }>>({})
  const [priceErrors1K, setPriceErrors1K] = useState<Record<string, string | null>>({})
  const [priceErrors2K, setPriceErrors2K] = useState<Record<string, string | null>>({})
  const [priceErrors4K, setPriceErrors4K] = useState<Record<string, string | null>>({})
  const [salePricingMode, setSalePricingMode] = useState('unified')
  const [salePrice1KInput, setSalePrice1KInput] = useState('')
  const [salePrice2KInput, setSalePrice2KInput] = useState('')
  const [salePrice4KInput, setSalePrice4KInput] = useState('')
  const [visibleKeysAuto, setVisibleKeysAuto] = useState<Set<string>>(new Set())
  const [visibleKeys1K, setVisibleKeys1K] = useState<Set<string>>(new Set())
  const [visibleKeys2K, setVisibleKeys2K] = useState<Set<string>>(new Set())
  const [visibleKeys4K, setVisibleKeys4K] = useState<Set<string>>(new Set())
  const [announcementContent, setAnnouncementContent] = useState('')
  const [announcementEnabled, setAnnouncementEnabled] = useState(false)
  const [announcementLoading, setAnnouncementLoading] = useState(false)
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [feedbacks, setFeedbacks] = useState<BugFeedback[]>([])
  const [feedbacksLoading, setFeedbacksLoading] = useState(false)
  const [feedbackUpdatingId, setFeedbackUpdatingId] = useState<string | null>(null)
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([])
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [changelogSaving, setChangelogSaving] = useState(false)
  const [editingChangelogId, setEditingChangelogId] = useState<string | null>(null)
  const [changelogVersion, setChangelogVersion] = useState('')
  const [changelogTitle, setChangelogTitle] = useState('')
  const [changelogContent, setChangelogContent] = useState('')
  const [changelogPublished, setChangelogPublished] = useState(false)
  const [deleteChangelogId, setDeleteChangelogId] = useState<string | null>(null)

  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateCategory, setTemplateCategory] = useState('旅行海报')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templatePromptBody, setTemplatePromptBody] = useState('生成一张图片，风格是明亮风格。此外，用户输入是 {风格}，时间是 {季节}。')
  const [templatePreviewImageId, setTemplatePreviewImageId] = useState('')
  const [templatePreviewImageDataUrl, setTemplatePreviewImageDataUrl] = useState('')
  const [templatePreviewUploading, setTemplatePreviewUploading] = useState(false)
  const [templateNegativePrompt, setTemplateNegativePrompt] = useState('')
  const [templateCreditCost, setTemplateCreditCost] = useState('1')
  const [templateSortOrder, setTemplateSortOrder] = useState('0')
  const [templateFields, setTemplateFields] = useState<PromptTemplateField[]>([])
  const [templateResolutionOptions, setTemplateResolutionOptions] = useState<PromptTemplateResolutionOption[]>([])
  const [templateQualityOptions, setTemplateQualityOptions] = useState<PromptTemplateQualityOption[]>(() => defaultTemplateQualityOptions())
  const [templatePreview, setTemplatePreview] = useState('')
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState<PromptTemplate | null>(null)
  const [templateBatchDeleteConfirm, setTemplateBatchDeleteConfirm] = useState(false)

  // ─── Invite code state ───
  const [inviterReward, setInviterReward] = useState(0)
  const [inviteeReward, setInviteeReward] = useState(0)
  const [defaultQuota, setDefaultQuota] = useState(0)
  const [inviteEnabled, setInviteEnabled] = useState(true)
  const [inviteConfigLoading, setInviteConfigLoading] = useState(false)
  const [inviteConfigSaving, setInviteConfigSaving] = useState(false)
  const [inviteRows, setInviteRows] = useState<Array<{username:string;inviteCode:string;usageCount:number}>>([])
  const [inviteRowsLoading, setInviteRowsLoading] = useState(false)
  const [emailSuffixes, setEmailSuffixes] = useState<string[]>([])
  const [emailSuffixInput, setEmailSuffixInput] = useState('')
  const [emailSuffixLoading, setEmailSuffixLoading] = useState(false)
  const [emailSuffixSaving, setEmailSuffixSaving] = useState(false)
  const [resetPasswordModal, setResetPasswordModal] = useState<{userId:string;label:string} | null>(null)
  const [resetQuotaConfirm, setResetQuotaConfirm] = useState<string | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<{userId:string;label:string;value:string} | null>(null)

  // ─── Analytics state ───
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('7d')
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [summaryMeta, setSummaryMeta] = useState<AnalyticsMeta | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [trend, setTrend] = useState<BillingTrendPoint[]>([])
  const [trendMeta, setTrendMeta] = useState<AnalyticsMeta | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState('')
  const [endpointRows, setEndpointRows] = useState<BillingEndpointRow[]>([])
  const [endpointMeta, setEndpointMeta] = useState<AnalyticsMeta | null>(null)
  const [endpointLoading, setEndpointLoading] = useState(false)
  const [endpointError, setEndpointError] = useState('')
  const [userRows, setUserRows] = useState<BillingUserRow[]>([])
  const [userMeta, setUserMeta] = useState<AnalyticsMeta | null>(null)
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState('')
  const [imageSizeRows, setImageSizeRows] = useState<ImageSizeRow[]>([])
  const [imageSizeMeta, setImageSizeMeta] = useState<AnalyticsMeta | null>(null)
  const [imageSizeLoading, setImageSizeLoading] = useState(false)
  const [imageSizeError, setImageSizeError] = useState('')
  const [endpointSizeRows, setEndpointSizeRows] = useState<EndpointSizeBreakdownRow[]>([])
  const [endpointSizeMeta, setEndpointSizeMeta] = useState<AnalyticsMeta | null>(null)
  const [endpointSizeLoading, setEndpointSizeLoading] = useState(false)
  const [endpointSizeError, setEndpointSizeError] = useState('')
  const [mergeEndpoints, setMergeEndpoints] = useState(false)
  const [clearAnalyticsConfirm, setClearAnalyticsConfirm] = useState(false)
  const [clearAnalyticsCountdown, setClearAnalyticsCountdown] = useState(0)
  const [clearAnalyticsLoading, setClearAnalyticsLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const { users } = await adminListUsers()
      setUsers(users)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadCodes = useCallback(async () => {
    try {
      const { codes } = await adminListCodes()
      setCodes(codes || [])
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadPricingConfig = useCallback(async () => {
    setEndpointsLoading(true)
    try {
      const pricing = await adminGetPricingConfig()
      const keyEps = (eps: ApiEndpoint[]) => (eps || []).map(ep => ({
        ...ep,
        _key: ep._key || ((ep.baseUrl || 'new') + '_' + Math.random().toString(36).slice(2, 8)),
      }))
      const epsAuto = keyEps(pricing.endpointsAuto)
      const eps1K = keyEps(pricing.endpoints1K)
      const eps2K = keyEps(pricing.endpoints2K)
      const eps4K = keyEps(pricing.endpoints4K)
      setEndpointsAuto(epsAuto)
      setEndpoints1K(eps1K)
      setEndpoints2K(eps2K)
      setEndpoints4K(eps4K)
      setSalePriceInput(formatMoneyInputFromX10000(pricing.salePriceX10000))
      setSalePricingMode(pricing.salePricingMode || 'unified')
      setSalePrice1KInput(formatMoneyInputFromX10000(pricing.salePrice1KX10000 ?? 0))
      setSalePrice2KInput(formatMoneyInputFromX10000(pricing.salePrice2KX10000 ?? 0))
      setSalePrice4KInput(formatMoneyInputFromX10000(pricing.salePrice4KX10000 ?? 0))

      const initDrafts = (eps: ApiEndpoint[], tier: '1K' | '2K' | '4K') => {
        const d: Record<string, string> = {}
        const e: Record<string, string | null> = {}
        eps.forEach(ep => {
          const value = tier === '1K' ? ep.cost1KX10000 : tier === '2K' ? ep.cost2KX10000 : ep.cost4KX10000
          d[ep._key!] = formatMoneyInputFromX10000(value ?? 0)
          e[ep._key!] = null
        })
        return { drafts: d, errors: e }
      }
      const initAutoDrafts = (eps: ApiEndpoint[]) => {
        const drafts: Record<string, { '1K': string; '2K': string; '4K': string }> = {}
        const errors: Record<string, { '1K'?: string | null; '2K'?: string | null; '4K'?: string | null }> = {}
        eps.forEach(ep => {
          drafts[ep._key!] = {
            '1K': formatMoneyInputFromX10000(ep.cost1KX10000 ?? 0),
            '2K': formatMoneyInputFromX10000(ep.cost2KX10000 ?? 0),
            '4K': formatMoneyInputFromX10000(ep.cost4KX10000 ?? 0),
          }
          errors[ep._key!] = {}
        })
        return { drafts, errors }
      }
      const dAuto = initAutoDrafts(epsAuto)
      const d1K = initDrafts(eps1K, '1K')
      const d2K = initDrafts(eps2K, '2K')
      const d4K = initDrafts(eps4K, '4K')
      setCostDraftsAuto(dAuto.drafts)
      setCostDrafts1K(d1K.drafts)
      setCostDrafts2K(d2K.drafts)
      setCostDrafts4K(d4K.drafts)
      setPriceErrorsAuto(dAuto.errors)
      setPriceErrors1K(d1K.errors)
      setPriceErrors2K(d2K.errors)
      setPriceErrors4K(d4K.errors)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setEndpointsLoading(false)
    }
  }, [toast])

  const loadAnnouncement = useCallback(async () => {
    setAnnouncementLoading(true)
    try {
      const announcement = await adminGetAnnouncement()
      setAnnouncementContent(announcement.content || '')
      setAnnouncementEnabled(announcement.enabled)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setAnnouncementLoading(false)
    }
  }, [toast])

  const loadFeedbacks = useCallback(async () => {
    setFeedbacksLoading(true)
    try {
      const { feedbacks } = await adminListFeedbacks()
      setFeedbacks(feedbacks || [])
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setFeedbacksLoading(false)
      setLoading(false)
    }
  }, [toast])

  const loadChangelogs = useCallback(async () => {
    setChangelogLoading(true)
    try {
      const { changelogs } = await adminListChangelogEntries()
      setChangelogs(changelogs || [])
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setChangelogLoading(false)
      setLoading(false)
    }
  }, [toast])

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true)
    try {
      const { templates } = await adminListTemplates()
      setTemplates(templates || [])
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setTemplateLoading(false)
      setLoading(false)
    }
  }, [toast])

  const loadInviteConfig = useCallback(async () => {
    setInviteConfigLoading(true)
    try {
      const cfg = await adminGetInviteConfig()
      setInviterReward(cfg.inviterReward)
      setInviteeReward(cfg.inviteeReward)
      setDefaultQuota(cfg.defaultQuota)
      setInviteEnabled(cfg.inviteEnabled)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setInviteConfigLoading(false)
    }
  }, [toast])

  const loadInviteRows = useCallback(async () => {
    setInviteRowsLoading(true)
    try {
      const { invites } = await adminListInvites()
      setInviteRows(invites || [])
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setInviteRowsLoading(false)
    }
  }, [toast])

  const loadEmailSuffixes = useCallback(async () => {
    setEmailSuffixLoading(true)
    try {
      const cfg = await adminGetEmailConfig()
      setEmailSuffixes(cfg.allowedSuffixes || [])
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setEmailSuffixLoading(false)
    }
  }, [toast])

  const handleSaveEmailSuffixes = async () => {
    setEmailSuffixSaving(true)
    try {
      const res = await adminUpdateEmailConfig(emailSuffixes)
      setEmailSuffixes(res.allowedSuffixes || [])
      setSettings({ allowedEmailSuffixes: res.allowedSuffixes || [] })
      toast('配置已保存', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setEmailSuffixSaving(false)
    }
  }

  const addEmailSuffix = () => {
    const raw = emailSuffixInput.trim()
    if (!raw) return
    let s = raw.toLowerCase()
    if (!s.startsWith('@')) s = '@' + s
    if (emailSuffixes.includes(s)) {
      toast('该后缀已存在', 'error')
      return
    }
    setEmailSuffixes([...emailSuffixes, s])
    setEmailSuffixInput('')
  }

  const removeEmailSuffix = (s: string) => {
    setEmailSuffixes(emailSuffixes.filter((x) => x !== s))
  }

  // ─── Analytics loaders ───
  const loadAnalyticsSummary = useCallback(async (range: AnalyticsRange = analyticsRange) => {
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const res = await adminGetBillingSummary(range)
      setSummary(res.summary)
      setSummaryMeta(res.meta)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err))
    } finally {
      setSummaryLoading(false)
    }
  }, [analyticsRange])

  const loadAnalyticsTrend = useCallback(async (range: AnalyticsRange = analyticsRange) => {
    setTrendLoading(true)
    setTrendError('')
    try {
      const res = await adminGetBillingTrend(range)
      setTrend(res.trend)
      setTrendMeta(res.meta)
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : String(err))
    } finally {
      setTrendLoading(false)
    }
  }, [analyticsRange])

  const loadAnalyticsEndpointBreakdown = useCallback(async (range: AnalyticsRange = analyticsRange) => {
    setEndpointLoading(true)
    setEndpointError('')
    try {
      const res = await adminGetBillingEndpointBreakdown(range)
      setEndpointRows(res.rows)
      setEndpointMeta(res.meta)
    } catch (err) {
      setEndpointError(err instanceof Error ? err.message : String(err))
    } finally {
      setEndpointLoading(false)
    }
  }, [analyticsRange])

  const loadAnalyticsUserBreakdown = useCallback(async (range: AnalyticsRange = analyticsRange) => {
    setUserLoading(true)
    setUserError('')
    try {
      const res = await adminGetBillingUserBreakdown(range)
      setUserRows(res.rows)
      setUserMeta(res.meta)
    } catch (err) {
      setUserError(err instanceof Error ? err.message : String(err))
    } finally {
      setUserLoading(false)
    }
  }, [analyticsRange])

  const loadImageSizeBreakdown = useCallback(async (range: AnalyticsRange = analyticsRange) => {
    setImageSizeLoading(true)
    setImageSizeError('')
    try {
      const res = await adminGetImageSizeBreakdown(range)
      setImageSizeRows(res.rows)
      setImageSizeMeta(res.meta)
    } catch (err) {
      setImageSizeError(err instanceof Error ? err.message : String(err))
    } finally {
      setImageSizeLoading(false)
    }
  }, [analyticsRange])

  const loadEndpointSizeBreakdown = useCallback(async (range: AnalyticsRange = analyticsRange) => {
    setEndpointSizeLoading(true)
    setEndpointSizeError('')
    try {
      const res = await adminGetEndpointSizeBreakdown(range)
      setEndpointSizeRows(res.rows)
      setEndpointSizeMeta(res.meta)
    } catch (err) {
      setEndpointSizeError(err instanceof Error ? err.message : String(err))
    } finally {
      setEndpointSizeLoading(false)
    }
  }, [analyticsRange])

  const refreshAnalytics = useCallback((range: AnalyticsRange = analyticsRange) => {
    loadAnalyticsSummary(range)
    loadAnalyticsTrend(range)
    loadAnalyticsEndpointBreakdown(range)
    loadAnalyticsUserBreakdown(range)
    loadImageSizeBreakdown(range)
    loadEndpointSizeBreakdown(range)
  }, [analyticsRange, loadAnalyticsSummary, loadAnalyticsTrend, loadAnalyticsEndpointBreakdown, loadAnalyticsUserBreakdown, loadImageSizeBreakdown, loadEndpointSizeBreakdown])

  const openClearAnalyticsConfirm = () => {
    setClearAnalyticsCountdown(5)
    setClearAnalyticsConfirm(true)
  }

  const handleClearAnalytics = async () => {
    if (clearAnalyticsCountdown > 0 || clearAnalyticsLoading) return
    setClearAnalyticsLoading(true)
    try {
      const result = await adminClearBillingAnalytics()
      setClearAnalyticsConfirm(false)
      setSummary(null)
      setTrend([])
      setEndpointRows([])
      setUserRows([])
      setImageSizeRows([])
      setEndpointSizeRows([])
      refreshAnalytics(analyticsRange)
      toast(`已清空 ${result.deleted} 条成本收益统计记录`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setClearAnalyticsLoading(false)
    }
  }

  useEffect(() => {
    if (!clearAnalyticsConfirm || clearAnalyticsCountdown <= 0) return
    const timer = window.setTimeout(() => setClearAnalyticsCountdown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [clearAnalyticsConfirm, clearAnalyticsCountdown])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    else if (tab === 'codes') loadCodes()
    else if (tab === 'config') loadPricingConfig()
    else if (tab === 'analytics') { refreshAnalytics(analyticsRange) }
    else if (tab === 'announcement') loadAnnouncement()
    else if (tab === 'feedback') loadFeedbacks()
    else if (tab === 'changelog') loadChangelogs()
    else if (tab === 'templates') loadTemplates()
    else if (tab === 'invites') { loadInviteConfig(); loadInviteRows(); loadEmailSuffixes() }
  }, [tab, loadUsers, loadCodes, loadPricingConfig, loadAnnouncement, loadFeedbacks, loadChangelogs, loadTemplates, loadInviteConfig, loadInviteRows, loadEmailSuffixes, refreshAnalytics, analyticsRange])

  const handleRefreshCurrentTab = () => {
    if (tab === 'users') loadUsers()
    else if (tab === 'codes') loadCodes()
    else if (tab === 'config') loadPricingConfig()
    else if (tab === 'analytics') { refreshAnalytics(analyticsRange); toast('统计已刷新', 'success') }
    else if (tab === 'announcement') loadAnnouncement()
    else if (tab === 'feedback') loadFeedbacks()
    else if (tab === 'changelog') loadChangelogs()
    else if (tab === 'templates') loadTemplates()
    else if (tab === 'invites') { loadInviteConfig(); loadInviteRows(); loadEmailSuffixes() }
  }

  const handleQuotaConfirm = () => {
    if (!quotaModal) return
    const val = parseInt(quotaValue, 10)
    if (Number.isNaN(val) || val < 0 || (quotaModal.mode !== 'set' && val === 0)) {
      toast(quotaModal.mode === 'set' ? '请输入 0 或正整数' : '请输入大于 0 的数值', 'error')
      return
    }
    setQuotaConfirm({ ...quotaModal, value: val })
    setQuotaModal(null)
  }

  const handleQuotaSubmit = async () => {
    if (!quotaConfirm) return
    const { user, mode, value } = quotaConfirm
    setQuotaConfirm(null)
    try {
      if (mode === 'set') {
        await adminUpdateQuota(user.id, value, false, 'set')
      } else {
        const delta = mode === 'increase' ? value : -value
        await adminUpdateQuota(user.id, delta)
      }
      setQuotaValue(''); await loadUsers(); toast('配额已更新', 'success')
    } catch (err) { toast(err instanceof Error ? err.message : String(err), 'error') }
  }

  const handleToggleUnlimited = async (userId: string, unlimited: boolean) => {
    try {
      await adminToggleUnlimited(userId, unlimited)
      setUsers(users => users.map(u => u.id === userId ? { ...u, unlimitedQuota: unlimited } : u))
      toast(unlimited ? '已开启无限制配额' : '已关闭无限制配额', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const handleReset = async (userId: string) => {
    setResetQuotaConfirm(userId)
  }

  const handleResetConfirm = async () => {
    if (!resetQuotaConfirm) return
    try { await adminUpdateQuota(resetQuotaConfirm, 0, true); await loadUsers(); toast('已重置使用计数', 'success') }
    catch (err) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setResetQuotaConfirm(null) }
  }

  const handleToggleStatus = (user: AdminUser) => { setConfirmModal({ user, action: user.status === 'active' ? 'disable' : 'enable' }) }
  const handleDeleteUser = (user: AdminUser) => { setConfirmModal({ user, action: 'delete' }) }

  const handleConfirmAction = async () => {
    if (!confirmModal) return
    try {
      if (confirmModal.action === 'delete') { await adminDeleteUser(confirmModal.user.id) }
      else { await adminToggleStatus(confirmModal.user.id, confirmModal.action === 'disable' ? 'disabled' : 'active') }
      const action = confirmModal.action; setConfirmModal(null); await loadUsers()
      if (action === 'delete') toast('用户已删除', 'success')
      else if (action === 'disable') toast('用户已禁用', 'success')
      else toast('用户已启用', 'success')
    } catch (err) { toast(err instanceof Error ? err.message : String(err), 'error') }
  }

  const handleCreateCodes = async () => {
    const quota = parseInt(codeQuota, 10); const count = parseInt(codeCount, 10) || 1
    if (!quota || quota <= 0) { toast('配额必须大于 0', 'error'); return }
    setCreating(true)
    try {
      const { codes: newCodes } = await adminCreateCodes(quota, count); await loadCodes()
      const text = newCodes.map(c => c.code).join('\n'); await copyTextToClipboard(text)
      toast(`已创建 ${newCodes.length} 个兑换码并复制到剪贴板`, 'success')
    } catch (err) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setCreating(false) }
  }

  const filteredCodes = codeFilter !== null ? codes.filter(c => c.quota === codeFilter) : codes

  const handleCopyUnused = async () => {
    const unused = filteredCodes.filter(c => !c.usedBy)
    if (unused.length === 0) { toast('没有未使用的兑换码', 'error'); return }
    const text = unused.map(c => c.code).join('\n')
    try { await copyTextToClipboard(text); toast(`已复制 ${unused.length} 个未使用码`, 'success') }
    catch { toast('复制到剪贴板失败', 'error') }
  }

  const handleCopyCode = async (code: string) => {
    try { await copyTextToClipboard(code); toast(`已复制: ${code}`, 'success') }
    catch { toast('复制到剪贴板失败', 'error') }
  }

  const handleLogout = () => { clearAdminToken(); onLogout() }

  const toggleUserSelect = (id: string) => { setSelectedUserIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const toggleAllUsers = () => { if (selectedUserIds.size === users.length) setSelectedUserIds(new Set()); else setSelectedUserIds(new Set(users.map(u => u.id))) }
  const toggleCodeSelect = (id: string) => { setSelectedCodeIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const toggleAllCodes = () => { if (selectedCodeIds.size === filteredCodes.length) setSelectedCodeIds(new Set()); else setSelectedCodeIds(new Set(filteredCodes.map(c => c.id))) }

  const handleBatchDelete = async () => {
    if (!batchConfirm) return
    try {
      if (batchConfirm.type === 'users') {
        const count = selectedUserIds.size; await adminDeleteUsers(Array.from(selectedUserIds)); setSelectedUserIds(new Set()); await loadUsers(); toast(`已删除 ${count} 个用户`, 'success')
      } else {
        const count = selectedCodeIds.size; await adminDeleteCodes(Array.from(selectedCodeIds)); setSelectedCodeIds(new Set()); await loadCodes(); toast(`已删除 ${count} 个兑换码`, 'success')
      }
    } catch (err) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setBatchConfirm(null) }
  }

  // ─── Per-tier endpoint helpers ───

  const getEndpointsForTier = (tier: EndpointTierTab) =>
    tier === 'auto' ? endpointsAuto : tier === '1K' ? endpoints1K : tier === '2K' ? endpoints2K : endpoints4K
  const setEndpointsForTier = (tier: EndpointTierTab, eps: ApiEndpoint[]) => {
    if (tier === 'auto') setEndpointsAuto(eps); else if (tier === '1K') setEndpoints1K(eps); else if (tier === '2K') setEndpoints2K(eps); else setEndpoints4K(eps)
  }
  const getCostDraftsForTier = (tier: Exclude<EndpointTierTab, 'auto'>) =>
    tier === '1K' ? costDrafts1K : tier === '2K' ? costDrafts2K : costDrafts4K
  const setCostDraftsForTier = (tier: Exclude<EndpointTierTab, 'auto'>, val: Record<string, string>) => {
    if (tier === '1K') setCostDrafts1K(val); else if (tier === '2K') setCostDrafts2K(val); else setCostDrafts4K(val)
  }
  const getPriceErrorsForTier = (tier: Exclude<EndpointTierTab, 'auto'>) =>
    tier === '1K' ? priceErrors1K : tier === '2K' ? priceErrors2K : priceErrors4K
  const setPriceErrorsForTier = (tier: Exclude<EndpointTierTab, 'auto'>, val: Record<string, string | null>) => {
    if (tier === '1K') setPriceErrors1K(val); else if (tier === '2K') setPriceErrors2K(val); else setPriceErrors4K(val)
  }
  const getVisibleKeysForTier = (tier: EndpointTierTab) =>
    tier === 'auto' ? visibleKeysAuto : tier === '1K' ? visibleKeys1K : tier === '2K' ? visibleKeys2K : visibleKeys4K
  const setVisibleKeysForTier = (tier: EndpointTierTab, val: Set<string>) => {
    if (tier === 'auto') setVisibleKeysAuto(val); else if (tier === '1K') setVisibleKeys1K(val); else if (tier === '2K') setVisibleKeys2K(val); else setVisibleKeys4K(val)
  }

  const handleAddEndpoint = (tier: EndpointTierTab) => {
    const key = 'new_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    setEndpointsForTier(tier, [...getEndpointsForTier(tier), { baseUrl: '', apiKey: '', priority: 0, _key: key }])
    if (tier === 'auto') {
      setCostDraftsAuto({ ...costDraftsAuto, [key]: { '1K': '0', '2K': '0', '4K': '0' } })
      setPriceErrorsAuto({ ...priceErrorsAuto, [key]: {} })
    } else {
      setCostDraftsForTier(tier, { ...getCostDraftsForTier(tier), [key]: '0' })
      setPriceErrorsForTier(tier, { ...getPriceErrorsForTier(tier), [key]: null })
    }
  }

  const handleRemoveEndpoint = (tier: EndpointTierTab, key: string) => {
    setEndpointsForTier(tier, getEndpointsForTier(tier).filter(ep => ep._key !== key))
    if (tier === 'auto') {
      const nextDrafts = { ...costDraftsAuto }
      delete nextDrafts[key]
      setCostDraftsAuto(nextDrafts)
      const nextErrors = { ...priceErrorsAuto }
      delete nextErrors[key]
      setPriceErrorsAuto(nextErrors)
      return
    }
    const trimDrafts = (prev: Record<string, string>) => { const n = { ...prev }; delete n[key]; return n }
    setCostDraftsForTier(tier, trimDrafts(getCostDraftsForTier(tier)))
    const trimErrors = (prev: Record<string, string | null>) => { const n = { ...prev }; delete n[key]; return n }
    setPriceErrorsForTier(tier, trimErrors(getPriceErrorsForTier(tier)))
  }

  const handleEndpointCostChange = (tier: EndpointTierTab, key: string, rawValue: string, costTier?: '1K' | '2K' | '4K') => {
    if (tier === 'auto') {
      const targetTier = costTier || '1K'
      const nextDrafts = { ...costDraftsAuto, [key]: { ...(costDraftsAuto[key] || { '1K': '0', '2K': '0', '4K': '0' }), [targetTier]: rawValue } }
      setCostDraftsAuto(nextDrafts)
      const nextErrors = { ...priceErrorsAuto, [key]: { ...(priceErrorsAuto[key] || {}) } }
      if (rawValue.trim() === '' || parseMoneyInputToX10000(rawValue) === null) nextErrors[key][targetTier] = '请输入非负数字，最多 4 位小数'
      else delete nextErrors[key][targetTier]
      setPriceErrorsAuto(nextErrors)
      return
    }
    setCostDraftsForTier(tier, { ...getCostDraftsForTier(tier), [key]: rawValue })
    if (rawValue.trim() === '' || parseMoneyInputToX10000(rawValue) === null) {
      setPriceErrorsForTier(tier, { ...getPriceErrorsForTier(tier), [key]: '请输入非负数字，最多 4 位小数' })
    } else {
      const next = { ...getPriceErrorsForTier(tier) }
      delete next[key]
      setPriceErrorsForTier(tier, next)
    }
  }

  const parseOptionalNonNegativeInteger = (value: string): number | undefined | null => {
    if (value === '') return undefined
    if (!/^\d+$/.test(value)) return null
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }

  const handleEndpointChange = (tier: EndpointTierTab, key: string, field: 'baseUrl' | 'apiKey' | 'maxConcurrency' | 'priority', value: string) => {
    setEndpointsForTier(tier, getEndpointsForTier(tier).map(ep => {
      if (ep._key !== key) return ep
      if (field === 'maxConcurrency' || field === 'priority') {
        const parsed = parseOptionalNonNegativeInteger(value)
        if (parsed === null) {
          toast('最大并发数和优先级请输入非负整数', 'error')
          return ep
        }
        return { ...ep, [field]: parsed }
      }
      return { ...ep, [field]: value }
    }))
  }

  const handleSavePricingConfig = async () => {
    if (endpointsLoading) return
    const buildPool = (eps: ApiEndpoint[], tier: Exclude<EndpointTierTab, 'auto'>) => {
      const drafts = getCostDraftsForTier(tier)
      return eps.filter(ep => ep.baseUrl.trim()).map(ep => ({
        baseUrl: ep.baseUrl.trim(),
        apiKey: ep.apiKey.trim(),
        cost1KX10000: tier === '1K' ? parseMoneyInputToX10000(drafts[ep._key!] ?? '0') ?? 0 : 0,
        cost2KX10000: tier === '2K' ? parseMoneyInputToX10000(drafts[ep._key!] ?? '0') ?? 0 : 0,
        cost4KX10000: tier === '4K' ? parseMoneyInputToX10000(drafts[ep._key!] ?? '0') ?? 0 : 0,
        maxConcurrency: ep.maxConcurrency,
        priority: ep.priority,
      }))
    }
    const buildAutoPool = (eps: ApiEndpoint[]) => eps.filter(ep => ep.baseUrl.trim()).map(ep => {
      const drafts = costDraftsAuto[ep._key!] || { '1K': '0', '2K': '0', '4K': '0' }
      return {
        baseUrl: ep.baseUrl.trim(),
        apiKey: ep.apiKey.trim(),
        cost1KX10000: parseMoneyInputToX10000(drafts['1K']) ?? 0,
        cost2KX10000: parseMoneyInputToX10000(drafts['2K']) ?? 0,
        cost4KX10000: parseMoneyInputToX10000(drafts['4K']) ?? 0,
        maxConcurrency: ep.maxConcurrency,
        priority: ep.priority,
      }
    })

    const validatePool = (eps: ApiEndpoint[], tier: EndpointTierTab) => {
      const valid = eps.filter(ep => ep.baseUrl.trim())
      const missingKey = valid.find(ep => !ep.apiKey.trim())
      if (missingKey) { toast(`${tier === 'auto' ? '自动' : tier} 池存在缺少 API Key 的端点`, 'error'); return false }
      for (const ep of eps) {
        if (!ep._key || !ep.baseUrl.trim()) continue
        if (ep.maxConcurrency !== undefined && (!Number.isSafeInteger(ep.maxConcurrency) || ep.maxConcurrency < 0)) {
          toast(`${tier === 'auto' ? '自动' : tier} 池最大并发数必须为非负整数`, 'error'); return false
        }
        if (ep.priority !== undefined && (!Number.isSafeInteger(ep.priority) || ep.priority < 0)) {
          toast(`${tier === 'auto' ? '自动' : tier} 池优先级必须为非负整数`, 'error'); return false
        }
        if (tier === 'auto') {
          const drafts = costDraftsAuto[ep._key] || { '1K': '', '2K': '', '4K': '' }
          for (const costTier of ['1K','2K','4K'] as const) {
            const d = drafts[costTier] ?? ''
            if (d.trim() !== '' && parseMoneyInputToX10000(d) === null) {
              toast(`自动池 ${costTier} 成本价格式无效`, 'error'); return false
            }
          }
        } else {
          const drafts = getCostDraftsForTier(tier)
          const d = drafts[ep._key] ?? ''
          if (d.trim() !== '' && parseMoneyInputToX10000(d) === null) {
            toast(`${tier} 池成本价格式无效`, 'error'); return false
          }
        }
      }
      return true
    }

    const unifiedPrice = parseMoneyInputToX10000(salePriceInput)
    const price1K = parseMoneyInputToX10000(salePrice1KInput)
    const price2K = parseMoneyInputToX10000(salePrice2KInput)
    const price4K = parseMoneyInputToX10000(salePrice4KInput)
    const saleInvalid = salePricingMode === 'unified'
      ? unifiedPrice === null
      : price1K === null || price2K === null || price4K === null

    if (saleInvalid) { toast('请输入有效的售价，最多 4 位小数', 'error'); return }

    if (!validatePool(endpointsAuto, 'auto')) return
    if (!validatePool(endpoints1K, '1K')) return
    if (!validatePool(endpoints2K, '2K')) return
    if (!validatePool(endpoints4K, '4K')) return

    const pricedAuto = buildAutoPool(endpointsAuto)
    const priced1K = buildPool(endpoints1K, '1K')
    const priced2K = buildPool(endpoints2K, '2K')
    const priced4K = buildPool(endpoints4K, '4K')

    setPricingSaving(true)
    try {
      await adminUpdatePricingConfig(
        pricedAuto, priced1K, priced2K, priced4K,
        unifiedPrice ?? 0, salePricingMode,
        price1K ?? 0, price2K ?? 0, price4K ?? 0,
      )
      toast('配置已保存', 'success')
      await loadPricingConfig()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setPricingSaving(false)
    }
  }

  const handleSaveAnnouncement = async () => {
    setAnnouncementSaving(true)
    try { await adminUpdateAnnouncement(announcementContent, announcementEnabled); toast('公告已保存', 'success') }
    catch (err) { toast(err instanceof Error ? err.message : String(err), 'error') }
    finally { setAnnouncementSaving(false) }
  }

  const handleUpdateFeedbackStatus = async (id: string, status: BugFeedbackStatus) => {
    setFeedbackUpdatingId(id)
    try {
      const updated = await adminUpdateFeedbackStatus(id, status)
      setFeedbacks(feedbacks.map(feedback => feedback.id === id ? updated : feedback))
      toast('反馈状态已更新', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setFeedbackUpdatingId(null)
    }
  }

  const resetChangelogForm = () => {
    setEditingChangelogId(null)
    setChangelogVersion('')
    setChangelogTitle('')
    setChangelogContent('')
    setChangelogPublished(false)
  }

  const openChangelogEditor = (entry: ChangelogEntry) => {
    setEditingChangelogId(entry.id)
    setChangelogVersion(entry.version)
    setChangelogTitle(entry.title)
    setChangelogContent(entry.content)
    setChangelogPublished(entry.published)
  }

  const handleSaveChangelog = async () => {
    if (changelogPublished && !changelogVersion.trim()) {
      toast('发布更新日志前请填写版本号', 'error')
      return
    }
    const payload: ChangelogEntryPayload = {
      version: changelogVersion,
      title: changelogTitle,
      content: changelogContent,
      published: changelogPublished,
    }
    setChangelogSaving(true)
    try {
      if (editingChangelogId) {
        await adminUpdateChangelogEntry(editingChangelogId, payload)
        toast('更新日志已保存', 'success')
      } else {
        await adminCreateChangelogEntry(payload)
        toast('更新日志已创建', 'success')
      }
      resetChangelogForm()
      await loadChangelogs()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setChangelogSaving(false)
    }
  }

  const handleDeleteChangelog = async () => {
    if (!deleteChangelogId) return
    try {
      await adminDeleteChangelogEntry(deleteChangelogId)
      if (editingChangelogId === deleteChangelogId) resetChangelogForm()
      setDeleteChangelogId(null)
      await loadChangelogs()
      toast('更新日志已删除', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const handleSaveInviteConfig = async () => {
    setInviteConfigSaving(true)
    try {
      await adminUpdateInviteConfig(inviterReward, inviteeReward, defaultQuota, inviteEnabled)
      toast('配置已保存', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setInviteConfigSaving(false)
    }
  }

  const handleResetPasswordConfirm = () => {
    if (!resetPasswordModal) return
    if (resetPasswordValue.length < 8) {
      toast('密码至少需要 8 个字符', 'error')
      return
    }
    setResetPasswordConfirm({ ...resetPasswordModal, value: resetPasswordValue.trim() })
    setResetPasswordModal(null)
  }

  const handleResetPassword = async () => {
    if (!resetPasswordConfirm) return
    try {
      await adminResetPassword(resetPasswordConfirm.userId, resetPasswordConfirm.value)
      toast('密码已重置', 'success')
      setResetPasswordConfirm(null)
      setResetPasswordValue('')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  // ─── Money formatting for analytics (uses response meta.moneyScale) ───
  const formatMoneyX10000 = useCallback((value: number, moneyScale?: number): string => {
    const scale = moneyScale && moneyScale > 0 ? moneyScale : 10000
    const negative = value < 0
    const abs = negative ? -value : value
    const integerPart = Math.floor(abs / scale)
    const fractionalPart = abs % scale

    if (fractionalPart === 0) return negative ? `-${integerPart}` : `${integerPart}`

    let fracStr = fractionalPart.toString()
    // Scale fractional digits based on moneyScale (e.g. 10000 = 4 digits)
    const fracDigits = scale.toString().length - 1
    fracStr = fracStr.padStart(fracDigits, '0').replace(/0+$/, '')
    if (fracStr === '') return negative ? `-${integerPart}` : `${integerPart}`
    return negative ? `-${integerPart}.${fracStr}` : `${integerPart}.${fracStr}`
  }, [])

  const formatMoneyInAnalytics = useCallback((value: number): string => {
    // Prefer summary meta moneyScale, fallback to trend meta, fallback to 10000
    const scale = summaryMeta?.moneyScale ?? trendMeta?.moneyScale ?? 10000
    return formatMoneyX10000(value, scale)
  }, [summaryMeta, trendMeta, formatMoneyX10000])

  const formatProfitClass = (value: number): string => {
    if (value > 0) return 'text-green-800 dark:text-green-400 tabular-nums'
    if (value < 0) return 'text-red-500 dark:text-red-400 tabular-nums'
    return 'text-gray-500 dark:text-gray-400 tabular-nums'
  }

  const formatProfitRate = (bps: number): string => {
    const pct = bps / 100
    return pct.toFixed(2) + '%'
  }

  const imageSizeLabel = (size: string) => size || '未知'

  const imageSizeColor = (size: string) => {
    if (size === '1K') return '#93c5fd'
    if (size === '2K') return '#fbbf24'
    if (size === '4K') return '#c084fc'
    return '#9ca3af'
  }

  const shortEndpointLabel = (value: string) => {
    try {
      return new URL(value).hostname || value
    } catch {
      return value.length > 28 ? `${value.slice(0, 25)}...` : value
    }
  }

  const mergeEndpointRows = (rows: BillingEndpointRow[]): BillingEndpointRow[] => {
    const merged = new Map<string, BillingEndpointRow>()
    for (const row of rows) {
      let key = row.endpointBaseUrl
      try {
        key = new URL(row.endpointBaseUrl).origin
      } catch {
        key = row.endpointBaseUrl
      }
      const current = merged.get(key)
      if (current) {
        current.successImages += row.successImages
        current.revenueX10000 += row.revenueX10000
        current.costX10000 += row.costX10000
        current.profitX10000 += row.profitX10000
      } else {
        merged.set(key, { ...row, endpointBaseUrl: key, endpointLabel: key })
      }
    }
    return Array.from(merged.values()).map(row => ({
      ...row,
      profitRateBps: row.revenueX10000 > 0 ? Math.round(row.profitX10000 * 10000 / row.revenueX10000) : 0,
    })).sort((a, b) => b.costX10000 - a.costX10000)
  }

  const displayEndpointRows = mergeEndpoints ? mergeEndpointRows(endpointRows) : endpointRows

  const endpointSizeTotalCost = (row: EndpointSizeBreakdownRow) => row.size1K.costX10000 + row.size2K.costX10000 + row.size4K.costX10000 + row.unknown.costX10000

  const renderSkeletonRows = (count: number, cols: number) => {
    return Array.from({ length: count }).map((_, r) => (
      <div key={r} className="flex gap-4 animate-pulse">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="flex-1 h-4 bg-gray-100 dark:bg-gray-800/80 rounded" />
        ))}
      </div>
    ))
  }

  const formatTime = (ms: number | null) => {
    if (!ms) return '-'
    return new Date(ms).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  const getQuotaDisplay = (user: AdminUser) => { if (user.unlimitedQuota) return `${user.usedCount} / 无限制`; return `${user.usedCount} / ${user.quota}` }
  const getFeedbackCategoryLabel = (feedback: BugFeedback) => feedback.category === 'feature' ? '功能建议' : 'Bug 反馈'
  const getFeedbackStatusLabel = (status: BugFeedbackStatus) => status === 'resolved' ? '已解决' : status === 'reviewing' ? '处理中' : '待处理'
  const getFeedbackStatusClass = (status: BugFeedbackStatus) => status === 'resolved' ? 'bg-green-500/10 text-green-800 dark:text-green-400' : status === 'reviewing' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
  const getChangelogTitle = (entry: ChangelogEntry) => entry.title || '更新日志'

  const newResolutionOption = (): PromptTemplateResolutionOption => ({
    id: `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: '自动分辨率',
    size: '',
  })

  const addTemplateResolutionOption = () => {
    setTemplateResolutionOptions(options => [...options, newResolutionOption()])
  }

  const updateTemplateResolutionOption = (id: string, patch: Partial<PromptTemplateResolutionOption>) => {
    setTemplateResolutionOptions(options => options.map(option => option.id === id ? { ...option, ...patch } : option))
  }

  const updateTemplateQualityOption = (id: string, patch: Partial<PromptTemplateQualityOption>) => {
    setTemplateQualityOptions(options => options.map(option => option.id === id ? { ...option, ...patch } : option))
  }

  const splitResolutionSize = (size?: string) => {
    const [width = '', height = ''] = (size || '').trim().split(/[xX×]/)
    return {
      width: /^\d*$/.test(width) ? width : '',
      height: /^\d*$/.test(height) ? height : '',
    }
  }

  const updateTemplateResolutionDimension = (id: string, dimension: 'width' | 'height', value: string) => {
    const current = templateResolutionOptions.find(option => option.id === id)
    if (!current) return
    const parts = splitResolutionSize(current.size)
    const digits = value.replace(/\D/g, '')
    const next = { ...parts, [dimension]: digits }
    updateTemplateResolutionOption(id, { size: next.width || next.height ? `${next.width}x${next.height}` : '' })
  }

  const removeTemplateResolutionOption = (id: string) => {
    setTemplateResolutionOptions(options => options.filter(option => option.id !== id))
  }

  const resetTemplateForm = () => {
    setEditingTemplateId(null)
    setTemplateTitle('')
    setTemplateCategory('旅行海报')
    setTemplateDescription('')
    setTemplatePromptBody('生成一张图片，风格是明亮风格。此外，用户输入是 {风格}，时间是 {季节}。')
    setTemplatePreviewImageId('')
    setTemplatePreviewImageDataUrl('')
    setTemplateNegativePrompt('')
    setTemplateCreditCost('1')
    setTemplateSortOrder('0')
    setTemplateFields([])
    setTemplateResolutionOptions([])
    setTemplateQualityOptions(defaultTemplateQualityOptions(1))
    setTemplatePreview('')
  }

  const editTemplate = (template: PromptTemplate) => {
    setEditingTemplateId(template.id)
    setTemplateTitle(template.title)
    setTemplateCategory(template.category)
    setTemplateDescription(template.description)
    setTemplatePromptBody(template.promptBody || '')
    setTemplatePreviewImageId(template.previewImageId || '')
    setTemplatePreviewImageDataUrl('')
    setTemplateNegativePrompt(template.negativePrompt || '')
    setTemplateCreditCost(String(Math.max(1, template.creditCost || 1)))
    setTemplateSortOrder(String(template.sortOrder || 0))
    setTemplateFields(template.fieldSchema || [])
    const fallbackCreditCost = templateOptionCreditValue(template.creditCost)
    const rawResolutionOptions = (template.resolutionOptions || []) as Array<PromptTemplateResolutionOption & Partial<PromptTemplateQualityOption>>
    const rawQualityOptions = (template.qualityOptions || []) as PromptTemplateQualityOption[]
    const nextResolutionOptions = rawResolutionOptions
      .filter(option => !option.quality || (option.size && option.size !== 'auto'))
      .map(option => ({
        id: option.id || newResolutionOption().id,
        name: option.name || '自动分辨率',
        size: option.size === 'auto' ? '' : option.size || '',
      }))
    const legacyQualityOptions = rawResolutionOptions
      .filter(option => option.quality || option.creditCost != null)
      .map(option => {
        const quality = normalizeTaskQuality(option.quality)
        return {
          id: `quality_${quality}`,
          name: TEMPLATE_QUALITY_LABELS[quality],
          quality,
          creditCost: templateOptionCreditValue(option.creditCost, fallbackCreditCost),
        }
      })
    setTemplateResolutionOptions(nextResolutionOptions)
    setTemplateQualityOptions(fixedTemplateQualityOptions(
      rawQualityOptions.length > 0 ? rawQualityOptions : legacyQualityOptions,
      fallbackCreditCost,
    ))
    setTemplatePreview('')
  }

  const parseTemplatePayload = (): PromptTemplatePayload | null => {
    const resolutionOptions: NonNullable<PromptTemplatePayload['resolutionOptions']> = []
    for (const option of templateResolutionOptions) {
      const name = (option.name || '').trim()
      const { width, height } = splitResolutionSize(option.size)
      const hasSize = Boolean(width || height)
      if (!name && !hasSize) continue
      if (hasSize && (!width || !height)) {
        toast('请完整填写分辨率宽高，或留空使用自动尺寸', 'error')
        return null
      }
      if (hasSize && (!/^[1-9]\d*$/.test(width) || !/^[1-9]\d*$/.test(height))) {
        toast('分辨率宽高必须是大于 0 的整数', 'error')
        return null
      }
      resolutionOptions.push({
        id: option.id,
        name: name || (hasSize ? `${width}x${height}` : '自动分辨率'),
        size: hasSize ? `${width}x${height}` : 'auto',
      })
    }

    const qualityOptions: NonNullable<PromptTemplatePayload['qualityOptions']> = []
    for (const option of templateQualityOptions) {
      const quality = normalizeTaskQuality(option.quality)
      const name = TEMPLATE_QUALITY_LABELS[quality]
      const optionCreditCost = Number(option.creditCost)
      if (!Number.isInteger(optionCreditCost) || optionCreditCost < 1 || optionCreditCost > 1000) {
        toast('每个质量档位积分消耗必须是 1 到 1000 的整数', 'error')
        return null
      }
      qualityOptions.push({
        id: option.id,
        name,
        quality,
        creditCost: optionCreditCost,
      })
    }

    const creditCost = Number(templateCreditCost)
    if (!Number.isInteger(creditCost) || creditCost < 1 || creditCost > 1000) {
      toast('默认每张图积分消耗必须是 1 到 1000 的整数', 'error')
      return null
    }

    return {
      title: templateTitle.trim(),
      category: templateCategory.trim(),
      description: templateDescription.trim(),
      promptBody: templatePromptBody.trim(),
      previewImageId: templatePreviewImageId,
      negativePrompt: templateNegativePrompt.trim(),
      creditCost,
      fieldSchema: templateFields,
      resolutionOptions,
      qualityOptions,
      status: 'draft',
      sortOrder: Number(templateSortOrder) || 0,
      assemblyMode: 'sections',
      visibility: 'public',
    }
  }

  const handleTemplatePreviewUpload = async (file: File | null) => {
    if (!file) return
    setTemplatePreviewUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const result = await adminUploadTemplatePreviewImage(dataUrl)
      setTemplatePreviewImageId(result.id)
      setTemplatePreviewImageDataUrl(dataUrl)
      toast('预览图已上传，保存模板后生效', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setTemplatePreviewUploading(false)
    }
  }

  const saveTemplate = async () => {
    const payload = parseTemplatePayload()
    if (!payload) return
    setTemplateSaving(true)
    try {
      if (editingTemplateId) {
        await adminUpdateTemplate(editingTemplateId, payload)
        toast('模板已更新', 'success')
      } else {
        await adminCreateTemplate(payload)
        toast('模板已创建', 'success')
      }
      resetTemplateForm()
      await loadTemplates()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setTemplateSaving(false)
    }
  }

  const previewTemplate = async () => {
    const payload = parseTemplatePayload()
    if (!payload) return
    const templateInputs = Object.fromEntries(
      (payload.fieldSchema || []).map((field) => [field.key, field.placeholder || field.defaultValue || field.label || field.key]),
    )
    try {
      const { prompt } = await adminPreviewTemplate({
        promptBody: payload.promptBody,
        fieldSchema: payload.fieldSchema,
        templateInputs,
        negativePrompt: payload.negativePrompt,
      })
      setTemplatePreview(prompt)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const toggleTemplateSelect = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllTemplates = () => {
    setSelectedTemplateIds((prev) => prev.size === templates.length ? new Set() : new Set(templates.map((template) => template.id)))
  }

  const handleBatchDeleteTemplates = async () => {
    const ids = Array.from(selectedTemplateIds)
    setTemplateBatchDeleteConfirm(false)
    try {
      for (const id of ids) {
        await adminDeleteTemplate(id)
      }
      setSelectedTemplateIds(new Set())
      await loadTemplates()
      toast(`已删除 ${ids.length} 个模板`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const archiveTemplate = async (template: PromptTemplate) => {
    try {
      await adminDeleteTemplate(template.id)
      await loadTemplates()
      toast('模板已删除', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const handleToggleTemplateStatus = async (template: PromptTemplate) => {
    try {
      const result = await adminToggleTemplateStatus(template.id)
      setTemplates((prev) => prev.map((t) => (t.id === result.template.id ? result.template : t)))
      toast(result.template.status === 'published' ? '模板已启用' : '模板已停用', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
  ]

  if (loading){
    return (<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="text-gray-500 dark:text-gray-400">加载中...</div></div>)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200/70 dark:border-white/[0.08] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">管理后台</h1>
          <div className="flex items-center gap-4">
            <Select
              value={settings.theme}
              onChange={(value) => setSettings({ theme: value as ThemeMode })}
              options={themeOptions}
              className="h-8 w-28"
            />
            <button onClick={handleRefreshCurrentTab} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">刷新</button>
            <button onClick={handleLogout} className="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300">退出登录</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setSelectedUserIds(new Set()); setSelectedCodeIds(new Set()); setSelectedTemplateIds(new Set()) }}>
          <TabsList className="mb-6 flex-wrap h-auto bg-gray-100 dark:bg-white/[0.06]">
            <TabsTrigger value="users" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">用户管理</TabsTrigger>
            <TabsTrigger value="codes" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">兑换码管理</TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">系统配置</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">成本收益统计</TabsTrigger>
            <TabsTrigger value="announcement" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">公告管理</TabsTrigger>
            <TabsTrigger value="feedback" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">反馈管理</TabsTrigger>
            <TabsTrigger value="changelog" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">更新日志</TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">模板管理</TabsTrigger>
            <TabsTrigger value="invites" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">邀请码设置</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'users' && (
          <>
            {selectedUserIds.size > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">已选 {selectedUserIds.size} 项</span>
                <button onClick={() => setBatchConfirm({ type: 'users', count: selectedUserIds.size })} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">批量删除</button>
                <button onClick={() => setSelectedUserIds(new Set())} className="rounded-xl bg-gray-100 dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/80">取消选择</button>
              </div>
            )}
            <div className="overflow-x-auto rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/70 dark:border-white/[0.08] text-left text-gray-500 dark:text-gray-400">
                    <th className="w-10 px-4 py-3"><input type="checkbox" checked={users.length > 0 && selectedUserIds.size === users.length} onChange={toggleAllUsers} className="accent-blue-500" /></th>
                    <th className="px-4 py-3 font-medium">用户</th>
                    <th className="px-4 py-3 font-medium">注册时间</th>
                    <th className="px-4 py-3 font-medium">配额</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">配额操作</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className={`border-b border-gray-200/70 dark:border-gray-200/50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.04] ${selectedUserIds.has(user.id) ? 'bg-blue-50 dark:bg-blue-500/5' : ''}`}>
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => toggleUserSelect(user.id)} className="accent-blue-500" /></td>
                      <td className="px-4 py-3"><div className="font-medium">{user.username || user.label}</div><div className="text-xs text-gray-500">{user.role}</div></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatTime(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={user.quota > 0 && user.usedCount >= user.quota && !user.unlimitedQuota ? 'text-red-500 dark:text-red-400' : ''}>{getQuotaDisplay(user)}</span>
                        {user.unlimitedQuota && <span className="ml-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">无限制</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${user.status === 'active' ? 'bg-green-500/10 text-green-800 dark:text-green-400' : 'bg-red-500/10 text-red-500 dark:text-red-400'}`}>{user.status === 'active' ? '正常' : '已禁用'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 mr-1">
                            <Switch
                              checked={user.unlimitedQuota}
                              onCheckedChange={(checked) => handleToggleUnlimited(user.id, checked)}
                              className="scale-75"
                            />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">无限制</span>
                          </div>
                          <button onClick={() => { setQuotaModal({ user, mode: 'increase' }); setQuotaValue('') }} className="rounded-lg bg-blue-600/20 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-600/30">增加</button>
                          <button onClick={() => { setQuotaModal({ user, mode: 'decrease' }); setQuotaValue('') }} className="rounded-lg bg-orange-600/20 px-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-600/30">减少</button>
                          <button onClick={() => { setQuotaModal({ user, mode: 'set' }); setQuotaValue('') }} className="rounded-lg bg-purple-600/20 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-600/30">设定</button>
                          <button onClick={() => handleReset(user.id)} className="rounded-lg bg-gray-600/20 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-600/30">重置</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setResetPasswordModal({ userId: user.id, label: user.label }); setResetPasswordValue('') }}
                            className="rounded-lg bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-600/30">
                            重置密码
                          </button>
                          <button onClick={() => handleToggleStatus(user)} className={`rounded-lg px-3 py-1 text-xs font-medium ${user.status === 'active' ? 'bg-orange-600/20 text-orange-600 dark:text-orange-400 hover:bg-orange-600/30' : 'bg-green-600/20 text-green-800 dark:text-green-400 hover:bg-green-600/30'}`}>{user.status === 'active' ? '禁用' : '启用'}</button>
                          <button onClick={() => handleDeleteUser(user)} className="rounded-lg bg-red-600/20 px-3 py-1 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && <div className="py-12 text-center text-gray-500">暂无用户</div>}
          </>
        )}

        {tab === 'codes' && (
          <>
            <div className="mb-6 rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-100 mb-3">创建兑换码</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">每张码的图片数</label><input type="number" value={codeQuota} onChange={e => setCodeQuota(e.target.value)} placeholder="如 100" className="w-32 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">数量</label><input type="number" value={codeCount} onChange={e => setCodeCount(e.target.value)} placeholder="1" className="w-24 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400" /></div>
                <button onClick={handleCreateCodes} disabled={creating || !codeQuota.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{creating ? '创建中...' : '创建并复制'}</button>
                <button onClick={handleCopyUnused} className="rounded-xl bg-gray-100 dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-gray-700/80">复制全部未使用码</button>
              </div>
            </div>

            {codes.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">按额度筛选:</span>
                <button onClick={() => setCodeFilter(null)} className={`rounded-lg px-3 py-1 text-xs font-medium transition ${codeFilter === null ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/80'}`}>全部</button>
                {Array.from(new Set(codes.map(c => c.quota))).sort((a, b) => a - b).map(q => (
                  <button key={q} onClick={() => setCodeFilter(q)} className={`rounded-lg px-3 py-1 text-xs font-medium transition ${codeFilter === q ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/80'}`}>{q} 张</button>
                ))}
              </div>
            )}

            {selectedCodeIds.size > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">已选 {selectedCodeIds.size} 项</span>
                <button onClick={() => setBatchConfirm({ type: 'codes', count: selectedCodeIds.size })} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">批量删除</button>
                <button onClick={() => setSelectedCodeIds(new Set())} className="rounded-xl bg-gray-100 dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/80">取消选择</button>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/70 dark:border-white/[0.08] text-left text-gray-500 dark:text-gray-400">
                    <th className="w-10 px-4 py-3"><input type="checkbox" checked={filteredCodes.length > 0 && selectedCodeIds.size === filteredCodes.length} onChange={toggleAllCodes} className="accent-blue-500" /></th>
                    <th className="px-4 py-3 font-medium">兑换码</th>
                    <th className="px-4 py-3 font-medium">图片数</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">使用者</th>
                    <th className="px-4 py-3 font-medium">使用时间</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCodes.map(code => (
                    <tr key={code.id} className={`border-b border-gray-200/70 dark:border-gray-200/50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.04] ${selectedCodeIds.has(code.id) ? 'bg-blue-50 dark:bg-blue-500/5' : ''}`}>
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedCodeIds.has(code.id)} onChange={() => toggleCodeSelect(code.id)} className="accent-blue-500" /></td>
                      <td className="px-4 py-3"><button onClick={() => handleCopyCode(code.code)} className="font-mono text-xs bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700/80 transition cursor-pointer" title="点击复制">{code.code}</button></td>
                      <td className="px-4 py-3">{code.quota}</td>
                      <td className="px-4 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${code.usedBy ? 'bg-gray-500/10 text-gray-500 dark:text-gray-400' : 'bg-green-500/10 text-green-800 dark:text-green-400'}`}>{code.usedBy ? '已使用' : '未使用'}</span></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{code.usedBy || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatTime(code.usedAt)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatTime(code.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCodes.length === 0 && <div className="py-12 text-center text-gray-500">暂无兑换码</div>}
          </>
        )}

        {tab === 'config' && (
          <div className="space-y-5">
            {/* Per-tier endpoint pool tabs */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">API 端点池</h3>
                <p className="text-xs text-gray-500 mt-1">按分辨率分别配置端点供应商池，每个分辨率可独立设置 Base URL、API Key、并发、优先级和成本。</p>
              </div>

              {/* Tier tab bar */}
              <div className="flex gap-1 mb-4">
                {(['auto','1K','2K','4K'] as const).map(tier => (
                  <button key={tier}
                    onClick={() => setActiveTierTab(tier)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${activeTierTab === tier ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  >{tier === 'auto' ? '自动' : tier}</button>
                ))}
              </div>

              {/* Current tier pool */}
              {endpointsLoading ? (
                <div className="py-8 text-center text-gray-500">加载中...</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">{activeTierTab === 'auto' ? '自动' : activeTierTab} 端点池 ({getEndpointsForTier(activeTierTab).length} 个端点)</span>
                    <button onClick={() => handleAddEndpoint(activeTierTab)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">添加端点</button>
                  </div>
                  {getEndpointsForTier(activeTierTab).length === 0 ? (
                    <div className="py-8 text-center text-gray-500">{activeTierTab === 'auto' ? '自动' : activeTierTab} 池暂未配置任何端点</div>
                  ) : (
                    <div className="space-y-3">
                      {getEndpointsForTier(activeTierTab).map((ep) => {
                        const visKeys = getVisibleKeysForTier(activeTierTab)
                        const costDrafts = activeTierTab === 'auto' ? null : getCostDraftsForTier(activeTierTab)
                        const priceErrs = activeTierTab === 'auto' ? null : getPriceErrorsForTier(activeTierTab)
                        const autoDrafts = costDraftsAuto[ep._key!] || { '1K': '0', '2K': '0', '4K': '0' }
                        const autoErrs = priceErrorsAuto[ep._key!] || {}
                        return (
                        <div key={ep._key} className="flex items-start gap-3 rounded-xl border border-gray-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-gray-900/60 p-4">
                          <div className="flex-1 space-y-2">
                            <div><label className="block text-xs text-gray-500 mb-1">Base URL</label><input value={ep.baseUrl} onChange={e => handleEndpointChange(activeTierTab, ep._key!, 'baseUrl', e.target.value)} placeholder="https://api.openai.com/v1" className="w-full rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 font-mono" /></div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">API Key</label>
                              <div className="relative">
                                <input type={visKeys.has(ep._key!) ? 'text' : 'password'} value={ep.apiKey} onChange={e => handleEndpointChange(activeTierTab, ep._key!, 'apiKey', e.target.value)} placeholder="sk-..." className="w-full rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 font-mono" />
                                <button type="button" onClick={() => setVisibleKeysForTier(activeTierTab, new Set(visKeys.has(ep._key!) ? [...visKeys].filter(k => k !== ep._key!) : [...visKeys, ep._key!]))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-300 transition">
                                  {visKeys.has(ep._key!) ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <div><label className="block text-xs text-gray-500 mb-1">最大并发数（0 = 无限制）</label><input type="number" min="0" value={ep.maxConcurrency ?? ''} onChange={e => handleEndpointChange(activeTierTab, ep._key!, 'maxConcurrency', e.target.value)} placeholder="0" className="w-32 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 font-mono" /></div>
                              <div><label className="block text-xs text-gray-500 mb-1">优先级（越大越优先）</label><input type="number" min="0" value={ep.priority ?? ''} onChange={e => handleEndpointChange(activeTierTab, ep._key!, 'priority', e.target.value)} placeholder="0" className="w-32 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 font-mono" /></div>
                              {activeTierTab === 'auto' ? (
                                (['1K','2K','4K'] as const).map(costTier => (
                                  <div key={costTier}>
                                    <label className="block text-xs text-gray-500 mb-1">{costTier} 成本价（元/张）</label>
                                    <input type="number" min="0" step="0.0001" value={autoDrafts[costTier] ?? '0'} onChange={e => handleEndpointCostChange(activeTierTab, ep._key!, e.target.value, costTier)} placeholder="0" className="w-32 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-right text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 tabular-nums" />
                                    {autoErrs[costTier] && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{autoErrs[costTier]}</p>}
                                  </div>
                                ))
                              ) : (
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">{activeTierTab} 成本价（元/张）</label>
                                  <input type="number" min="0" step="0.0001" value={costDrafts?.[ep._key!] ?? '0'} onChange={e => handleEndpointCostChange(activeTierTab, ep._key!, e.target.value)} placeholder="0" className="w-32 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-right text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 tabular-nums" />
                                  {priceErrs?.[ep._key!] && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{priceErrs[ep._key!]}</p>}
                                </div>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleRemoveEndpoint(activeTierTab, ep._key!)} className="mt-6 rounded-lg bg-red-600/20 px-3 py-2 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30 transition">删除</button>
                        </div>
                      )})}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sale Pricing Card */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">售价配置</h3>
                  <p className="text-xs text-gray-500 mt-1">选择统一售价或按分辨率分别定价，支持 4 位小数</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">定价模式：</label>
                  <select value={salePricingMode} onChange={e => setSalePricingMode(e.target.value)} className="rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400">
                    <option value="unified">统一售价</option>
                    <option value="per_resolution">按分辨率定价</option>
                  </select>
                </div>
              </div>
              {salePricingMode === 'unified' ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">统一售价（元/张）</label>
                  <input type="number" min="0" step="0.0001" value={salePriceInput} onChange={e => setSalePriceInput(e.target.value)} placeholder="0" className="w-48 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-right text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 tabular-nums" />
                  {salePriceInput.trim() !== '' && parseMoneyInputToX10000(salePriceInput) === null && <p className="mt-1 text-xs text-red-500 dark:text-red-400">请输入非负数字，最多 4 位小数</p>}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {['1K','2K','4K'].map((tier, idx) => {
                    const val = idx === 0 ? salePrice1KInput : idx === 1 ? salePrice2KInput : salePrice4KInput
                    const setter = idx === 0 ? setSalePrice1KInput : idx === 1 ? setSalePrice2KInput : setSalePrice4KInput
                    return (
                      <div key={tier}>
                        <label className="block text-xs text-gray-500 mb-1">{tier} 售价（元/张）</label>
                        <input type="number" min="0" step="0.0001" value={val} onChange={e => setter(e.target.value)} placeholder="0" className="w-full rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-right text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 tabular-nums" />
                        {val.trim() !== '' && parseMoneyInputToX10000(val) === null && <p className="mt-1 text-xs text-red-500 dark:text-red-400">请输入非负数字，最多 4 位小数</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Save button */}
            {(() => {
              const activeKeys = (eps: ApiEndpoint[]) => new Set(eps.filter(ep => ep.baseUrl.trim()).map(ep => ep._key).filter(Boolean))
              const autoKeys = activeKeys(endpointsAuto)
              const keys1K = activeKeys(endpoints1K)
              const keys2K = activeKeys(endpoints2K)
              const keys4K = activeKeys(endpoints4K)
              const hasAutoErrors = Object.entries(priceErrorsAuto).some(([key, row]) => autoKeys.has(key) && Object.values(row).some(Boolean))
              const hasErrors = hasAutoErrors || Object.entries(priceErrors1K).some(([key, value]) => keys1K.has(key) && value) || Object.entries(priceErrors2K).some(([key, value]) => keys2K.has(key) && value) || Object.entries(priceErrors4K).some(([key, value]) => keys4K.has(key) && value)
              const saleInvalid = salePricingMode === 'unified'
                ? parseMoneyInputToX10000(salePriceInput) === null
                : parseMoneyInputToX10000(salePrice1KInput) === null || parseMoneyInputToX10000(salePrice2KInput) === null || parseMoneyInputToX10000(salePrice4KInput) === null
              return (
              <div className="flex justify-end">
                <button onClick={handleSavePricingConfig} disabled={endpointsLoading || pricingSaving || hasErrors || saleInvalid} className="rounded-xl bg-green-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">{pricingSaving ? '保存中...' : '保存配置'}</button>
              </div>
            )})()}
          </div>
        )}

        {/* ─── Analytics Tab ─── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            {/* ─── KPI Cards ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {summaryLoading && !summary ? (
                <>
                  {['总收入', '总成本', '利润', '成功图片数'].map(label => (
                    <div key={label} className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5 animate-pulse">
                      <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800/80 rounded mb-3" />
                      <div className="h-7 w-24 bg-gray-100 dark:bg-gray-800/80 rounded" />
                    </div>
                  ))}
                </>
              ) : summary ? (
                <>
                  <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
                    <div className="text-xs text-gray-500 mb-1">总收入</div>
                    <div className="text-[28px] font-semibold tabular-nums leading-tight text-blue-600 dark:text-blue-400">{formatMoneyInAnalytics(summary.revenueX10000)}</div>
                    <div className="text-xs text-gray-500 mt-1">元</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
                    <div className="text-xs text-gray-500 mb-1">总成本</div>
                    <div className="text-[28px] font-semibold tabular-nums leading-tight text-amber-600 dark:text-amber-400">{formatMoneyInAnalytics(summary.costX10000)}</div>
                    <div className="text-xs text-gray-500 mt-1">元</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
                    <div className="text-xs text-gray-500 mb-1">利润</div>
                    <div className={`text-[28px] font-semibold tabular-nums leading-tight ${formatProfitClass(summary.profitX10000)}`}>{formatMoneyInAnalytics(summary.profitX10000)}</div>
                    <div className="text-xs text-gray-500 mt-1">元</div>
                  </div>
                  <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
                    <div className="text-xs text-gray-500 mb-1">成功图片数</div>
                    <div className="text-[28px] font-semibold tabular-nums leading-tight text-violet-600 dark:text-violet-400">{summary.successImages.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1">张</div>
                  </div>
                </>
              ) : null}
            </div>

            {summaryError && !summary && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-4">
                <p className="text-sm text-red-500 dark:text-red-400">{summaryError}</p>
                <button onClick={() => { refreshAnalytics(analyticsRange) }} className="mt-2 rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">刷新统计</button>
              </div>
            )}

            {/* ─── Resolution Pie Chart ─── */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">分辨率分布</h3>
                  <p className="mt-1 text-xs text-gray-500">按 1K / 2K / 4K 统计成功生成图片占比。</p>
                </div>
                <span className="text-xs text-gray-500">{imageSizeMeta?.range ?? analyticsRange}</span>
              </div>
              {imageSizeLoading ? (
                <div className="space-y-2">{renderSkeletonRows(4, 3)}</div>
              ) : imageSizeError && imageSizeRows.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="mb-3 text-sm text-red-500 dark:text-red-400">{imageSizeError}</p>
                  <button onClick={() => { refreshAnalytics(analyticsRange) }} className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">刷新统计</button>
                </div>
              ) : imageSizeRows.length > 0 ? (() => {
                const rows = imageSizeRows.filter(row => row.successImages > 0)
                const total = rows.reduce((sum, row) => sum + row.successImages, 0)
                const radius = 54
                const circumference = 2 * Math.PI * radius
                let offset = 0
                return total > 0 ? (
                  <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
                    <div className="relative mx-auto h-[180px] w-[180px]">
                      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label="分辨率生成占比饼图">
                        <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="28" className="text-gray-100 dark:text-gray-800" />
                        {rows.map(row => {
                          const segment = row.successImages / total * circumference
                          const strokeDashoffset = -offset
                          offset += segment
                          return (
                            <circle
                              key={row.imageSize || 'unknown'}
                              cx="80"
                              cy="80"
                              r={radius}
                              fill="none"
                              stroke={imageSizeColor(row.imageSize)}
                              strokeWidth="28"
                              strokeDasharray={`${segment} ${circumference}`}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="butt"
                            />
                          )
                        })}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{total.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">总图片数</div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {rows.map(row => {
                        const pct = total > 0 ? row.successImages / total * 100 : 0
                        const moneyScale = imageSizeMeta?.moneyScale ?? 10000
                        return (
                          <div key={row.imageSize || 'unknown'} className="rounded-xl border border-gray-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: imageSizeColor(row.imageSize) }} />
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{imageSizeLabel(row.imageSize)}</span>
                            </div>
                            <div className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{row.successImages.toLocaleString()}</div>
                            <div className="mt-1 text-xs text-gray-500">{pct.toFixed(1)}% · 成本 {formatMoneyX10000(row.costX10000, moneyScale)} 元</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : <div className="py-6 text-center text-sm text-gray-500">暂无分辨率数据</div>
              })() : (
                <div className="py-6 text-center text-sm text-gray-500">暂无分辨率数据</div>
              )}
            </div>

            {/* ─── Trend Card with Range Filters and Chart ─── */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex gap-2">
                  {(['today', '7d', '30d', 'all'] as const).map(r => {
                    const labelMap: Record<string, string> = { today: '今日', '7d': '7天', '30d': '30天', all: '全部' }
                    return (
                      <button
                        key={r}
                        onClick={() => setAnalyticsRange(r)}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${analyticsRange === r ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/80'}`}
                      >{labelMap[r]}</button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => { refreshAnalytics(analyticsRange); toast('统计已刷新', 'success') }}
                    className="rounded-xl bg-gray-100 dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/80 transition"
                  >刷新统计</button>
                  <button
                    onClick={openClearAnalyticsConfirm}
                    className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30 transition"
                  >清空统计</button>
                </div>
              </div>

              {trendLoading ? (
                <div className="space-y-2">{renderSkeletonRows(4, 4)}</div>
              ) : trendError && trend.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-red-500 dark:text-red-400 mb-3">{trendError}</p>
                  <button onClick={() => { refreshAnalytics(analyticsRange) }} className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">刷新统计</button>
                </div>
              ) : trend.length > 0 ? (
                <div className="space-y-6">
                  {/* Money trend chart (revenue, cost, profit) */}
                  <div className="relative w-full h-64">
                    <svg viewBox="0 0 800 240" className="w-full h-full" role="img" aria-label="收入/成本/利润趋势图">
                      <defs>
                        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient>
                        <linearGradient id="costArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" /></linearGradient>
                        <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity="0.15" /><stop offset="100%" stopColor="#059669" stopOpacity="0" /></linearGradient>
                      </defs>
                      {/* Grid lines */}
                      {[0, 1, 2, 3, 4].map(i => (
                        <line key={`grid-${i}`} x1={60} y1={20 + i * 50} x2={780} y2={20 + i * 50} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} className="text-black dark:text-white" />
                      ))}
                      {/* Money axes labels */}
                      {(() => {
                        const moneyVals = summary ? [summary.revenueX10000, summary.costX10000, Math.abs(summary.profitX10000)] : trend.length > 0 ? trend.flatMap(p => [Math.abs(p.revenueX10000), Math.abs(p.costX10000), Math.abs(p.profitX10000)]) : [0]
                        const maxMoney = Math.max(...moneyVals, 1)
                        const step = maxMoney / 4
                        return [0, 1, 2, 3, 4].map(i => (
                          <text key={`yl-${i}`} x={56} y={24 + i * 50} textAnchor="end" fill="#9ca3af" className="text-[10px] dark:fill-gray-500">{step > 0 ? formatMoneyInAnalytics(Math.round((4 - i) * step)) : '0'}</text>
                        ))
                      })()}
                      {/* Revenue line */}
                      <polyline
                        points={trend.map((p, i) => {
                          const maxM = Math.max(...trend.flatMap(p => [Math.abs(p.revenueX10000), Math.abs(p.costX10000), Math.abs(p.profitX10000)]), 1)
                          const x = 60 + i * (720 / Math.max(trend.length - 1, 1))
                          const y = 20 + 200 * (1 - p.revenueX10000 / maxM)
                          return `${x},${y}`
                        }).join(' ')}
                        fill="url(#revArea)" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                      />
                      {/* Cost line */}
                      <polyline
                        points={trend.map((p, i) => {
                          const maxM = Math.max(...trend.flatMap(p => [Math.abs(p.revenueX10000), Math.abs(p.costX10000), Math.abs(p.profitX10000)]), 1)
                          const x = 60 + i * (720 / Math.max(trend.length - 1, 1))
                          const y = 20 + 200 * (1 - p.costX10000 / maxM)
                          return `${x},${y}`
                        }).join(' ')}
                        fill="url(#costArea)" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                      />
                      {/* Profit line */}
                      <polyline
                        points={trend.map((p, i) => {
                          const maxM = Math.max(...trend.flatMap(p => [Math.abs(p.revenueX10000), Math.abs(p.costX10000), Math.abs(p.profitX10000)]), 1)
                          const x = 60 + i * (720 / Math.max(trend.length - 1, 1))
                          const y = 20 + 200 * (1 - p.profitX10000 / maxM)
                          return `${x},${y}`
                        }).join(' ')}
                        fill="url(#profitArea)" stroke="#059669" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                      />
                      {/* X-axis labels */}
                      {trend.map((p, i) => (
                        <text key={`xl-${i}`} x={60 + i * (720 / Math.max(trend.length - 1, 1))} y={234} textAnchor="middle" fill="#9ca3af" className="text-[9px] dark:fill-gray-500">
                          {p.bucket.length > 10 ? p.bucket.slice(-5) : p.bucket}
                        </text>
                      ))}
                    </svg>
                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> 收入</span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> 成本</span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> 利润</span>
                    </div>
                  </div>

                  {/* Success images and average cost charts */}
                  {trend.some(p => p.successImages > 0) && (
                    <div className="grid gap-4 border-t border-gray-200/70 pt-4 dark:border-white/5 lg:grid-cols-2">
                      <div className="relative h-32">
                        <div className="mb-2 text-xs text-gray-500">成功图片数</div>
                        <div className="flex h-24 items-end gap-1 px-4">
                          {trend.map((p, i) => {
                            const maxImgCount = Math.max(...trend.map(p => p.successImages), 1)
                            const hPct = (p.successImages / maxImgCount) * 100
                            return (
                              <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${p.bucket}: ${p.successImages} 张`}>
                                <span className="mb-1 text-[9px] text-gray-500">{p.successImages}</span>
                                <div className="w-full max-w-[24px] rounded-t-sm bg-violet-500/60" style={{ height: `${Math.max(hPct, 2)}%` }} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="relative h-32">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-500">单张平均成本</span>
                          <span className="flex items-center gap-1 text-xs text-gray-500"><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" /> 元/张</span>
                        </div>
                        <svg viewBox="0 0 360 96" className="h-24 w-full" role="img" aria-label="单张平均成本趋势">
                          {(() => {
                            const points = trend.map((p, i) => ({
                              bucket: p.bucket,
                              avgCost: p.successImages > 0 ? p.costX10000 / p.successImages : null,
                              x: 28 + i * (312 / Math.max(trend.length - 1, 1)),
                            })).filter((p): p is { bucket: string; avgCost: number; x: number } => p.avgCost !== null)
                            const maxAvg = Math.max(...points.map(p => p.avgCost), 1)
                            const polyline = points.map(p => `${p.x},${10 + 62 * (1 - p.avgCost / maxAvg)}`).join(' ')
                            return (
                              <>
                                {[0, 1, 2].map(i => <line key={i} x1={28} y1={10 + i * 31} x2={344} y2={10 + i * 31} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} className="text-black dark:text-white" />)}
                                <text x={24} y={13} textAnchor="end" fill="#9ca3af" className="text-[9px] dark:fill-gray-500">{formatMoneyX10000(Math.round(maxAvg), trendMeta?.moneyScale ?? 10000)}</text>
                                <text x={24} y={75} textAnchor="end" fill="#9ca3af" className="text-[9px] dark:fill-gray-500">0</text>
                                <polyline points={polyline} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                {points.map(p => <circle key={p.bucket} cx={p.x} cy={10 + 62 * (1 - p.avgCost / maxAvg)} r={2.5} fill="#f97316" />)}
                                {trend.map((p, i) => (
                                  <text key={p.bucket} x={28 + i * (312 / Math.max(trend.length - 1, 1))} y={92} textAnchor="middle" fill="#9ca3af" className="text-[8px] dark:fill-gray-500">
                                    {p.bucket.length > 10 ? p.bucket.slice(-5) : p.bucket}
                                  </text>
                                ))}
                              </>
                            )
                          })()}
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : !trendLoading && !trendError ? (
                // Empty data
                <div className="py-10 text-center">
                  <h4 className="text-base font-medium text-gray-500 dark:text-gray-400 mb-2">暂无成本收益数据</h4>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">完成图片生成并保存配置后，这里将显示收入、成本、利润和成功图片数。</p>
                </div>
              ) : null}
            </div>

            {/* ─── Endpoint Size Cost Structure ─── */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">端点成本结构</h3>
                  <p className="mt-1 text-xs text-gray-500">按分辨率拆解各端点成本，最多展示成本最高的 10 个端点。</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: imageSizeColor('1K') }} />1K</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: imageSizeColor('2K') }} />2K</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: imageSizeColor('4K') }} />4K</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: imageSizeColor('') }} />未知</span>
                </div>
              </div>
              {endpointSizeLoading ? (
                <div className="space-y-2">{renderSkeletonRows(5, 4)}</div>
              ) : endpointSizeError && endpointSizeRows.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="mb-3 text-sm text-red-500 dark:text-red-400">{endpointSizeError}</p>
                  <button onClick={() => { refreshAnalytics(analyticsRange) }} className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">刷新统计</button>
                </div>
              ) : endpointSizeRows.length > 0 ? (() => {
                const rows = [...endpointSizeRows].sort((a, b) => endpointSizeTotalCost(b) - endpointSizeTotalCost(a)).slice(0, 10)
                const moneyScale = endpointSizeMeta?.moneyScale ?? 10000
                return (
                  <div className="space-y-4">
                    {rows.map(row => {
                      const totalCost = endpointSizeTotalCost(row)
                      const denominator = Math.max(totalCost, 1)
                      const segments = [
                        { key: '1K', label: '1K', cell: row.size1K },
                        { key: '2K', label: '2K', cell: row.size2K },
                        { key: '4K', label: '4K', cell: row.size4K },
                        { key: 'unknown', label: '未知', cell: row.unknown },
                      ]
                      return (
                        <div key={row.endpointBaseUrl} className="grid gap-2 md:grid-cols-[180px_1fr_96px] md:items-center">
                          <div className="truncate font-mono text-xs text-gray-700 dark:text-gray-300" title={row.endpointLabel || row.endpointBaseUrl}>{shortEndpointLabel(row.endpointLabel || row.endpointBaseUrl)}</div>
                          <div className="flex h-7 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            {segments.map(segment => {
                              if (segment.cell.costX10000 <= 0) return null
                              return (
                                <div
                                  key={segment.key}
                                  className="h-full min-w-[2px]"
                                  style={{ width: `${segment.cell.costX10000 / denominator * 100}%`, backgroundColor: imageSizeColor(segment.label === '未知' ? '' : segment.label) }}
                                  title={`${segment.label}: ${formatMoneyX10000(segment.cell.costX10000, moneyScale)} 元 / ${segment.cell.successImages} 张`}
                                />
                              )
                            })}
                          </div>
                          <div className="text-right text-xs tabular-nums text-amber-600 dark:text-amber-400">{formatMoneyX10000(totalCost, moneyScale)} 元</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })() : (
                <div className="py-6 text-center text-sm text-gray-500">暂无端点成本结构数据</div>
              )}
            </div>

            {/* ─── Endpoint & User Breakdown Tables ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Endpoint Breakdown */}
              <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-medium text-gray-800 dark:text-gray-100">端点拆分</h3>
                  <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Switch checked={mergeEndpoints} onCheckedChange={setMergeEndpoints} />
                    合并同源端点
                  </label>
                </div>
                {endpointLoading ? (
                  <div className="space-y-2">{renderSkeletonRows(4, 6)}</div>
                ) : endpointError && displayEndpointRows.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-red-500 dark:text-red-400 mb-3">统计数据加载失败，请点击"刷新统计"重试；保存配置失败时，请检查金额是否为数字且最多 4 位小数。</p>
                    <button onClick={() => { refreshAnalytics(analyticsRange) }} className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">刷新统计</button>
                  </div>
                ) : displayEndpointRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200/70 dark:border-white/[0.08] text-left text-gray-500 dark:text-gray-400">
                          <th className="px-3 py-2 font-medium text-xs">端点标识</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">成功图片数</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">收入</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">成本</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">利润</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">利润率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayEndpointRows.map((row, i) => {
                          const moneyScale = endpointMeta?.moneyScale ?? 10000
                          return (
                            <tr key={i} className="border-b border-gray-200/70 dark:border-gray-200/50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                              <td className="px-3 py-2.5 text-xs font-mono text-gray-700 dark:text-gray-300 max-w-[160px] truncate" title={row.endpointLabel || row.endpointBaseUrl}>{row.endpointLabel || row.endpointBaseUrl}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-gray-700 dark:text-gray-300">{row.successImages.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-blue-600 dark:text-blue-400">{formatMoneyX10000(row.revenueX10000, moneyScale)}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-amber-600 dark:text-amber-400">{formatMoneyX10000(row.costX10000, moneyScale)}</td>
                              <td className={`px-3 py-2.5 text-xs text-right ${formatProfitClass(row.profitX10000)}`}>{formatMoneyX10000(row.profitX10000, moneyScale)}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-gray-700 dark:text-gray-300">{formatProfitRate(row.profitRateBps)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : !endpointLoading && !endpointError ? (
                  <div className="py-6 text-center text-sm text-gray-500">暂无数据</div>
                ) : null}
              </div>

              {/* User Breakdown */}
              <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
                <h3 className="text-base font-medium text-gray-800 dark:text-gray-100 mb-4">用户拆分</h3>
                {userLoading ? (
                  <div className="space-y-2">{renderSkeletonRows(4, 6)}</div>
                ) : userError && userRows.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-red-500 dark:text-red-400 mb-3">统计数据加载失败，请点击"刷新统计"重试；保存配置失败时，请检查金额是否为数字且最多 4 位小数。</p>
                    <button onClick={() => { refreshAnalytics(analyticsRange) }} className="rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">刷新统计</button>
                  </div>
                ) : userRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200/70 dark:border-white/[0.08] text-left text-gray-500 dark:text-gray-400">
                          <th className="px-3 py-2 font-medium text-xs">用户标识</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">成功图片数</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">收入</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">成本</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">利润</th>
                          <th className="px-3 py-2 font-medium text-xs text-right">利润率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userRows.map((row, i) => {
                          const moneyScale = userMeta?.moneyScale ?? 10000
                          return (
                            <tr key={i} className="border-b border-gray-200/70 dark:border-gray-200/50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                              <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 max-w-[160px] truncate" title={row.userLabel || row.userId}>{row.userLabel || row.userId}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-gray-700 dark:text-gray-300">{row.successImages.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-blue-600 dark:text-blue-400">{formatMoneyX10000(row.revenueX10000, moneyScale)}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-amber-600 dark:text-amber-400">{formatMoneyX10000(row.costX10000, moneyScale)}</td>
                              <td className={`px-3 py-2.5 text-xs text-right ${formatProfitClass(row.profitX10000)}`}>{formatMoneyX10000(row.profitX10000, moneyScale)}</td>
                              <td className="px-3 py-2.5 text-xs text-right tabular-nums text-gray-700 dark:text-gray-300">{formatProfitRate(row.profitRateBps)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : !userLoading && !userError ? (
                  <div className="py-6 text-center text-sm text-gray-500">暂无数据</div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {tab === 'changelog' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">{editingChangelogId ? '编辑更新日志' : '新增更新日志'}</h3>
                  <p className="mt-1 text-xs text-gray-500">普通前端显示的版本号会以最新已发布日志为准。关闭发布后该版本不会出现在前端。</p>
                </div>
                {editingChangelogId && <button onClick={resetChangelogForm} className="rounded-xl bg-gray-100 dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-gray-700/80">取消编辑</button>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">版本号</label>
                  <input value={changelogVersion} onChange={e => setChangelogVersion(e.target.value)} placeholder="如 0.2.16" className="w-full rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">标题（可选）</label>
                  <input value={changelogTitle} onChange={e => setChangelogTitle(e.target.value)} placeholder="如 反馈机制优化" className="w-full rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs text-gray-500">更新日志内容</label>
                <Textarea value={changelogContent} onChange={e => setChangelogContent(e.target.value)} rows={8} placeholder="输入本次更新内容..." className="w-full resize-y" />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch checked={changelogPublished} onCheckedChange={setChangelogPublished} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">发布到前端</span>
                </div>
                <button onClick={handleSaveChangelog} disabled={changelogSaving} className="rounded-xl bg-green-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {changelogSaving ? '保存中...' : editingChangelogId ? '保存更新日志' : '创建更新日志'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">历史版本</h3>
                  <p className="mt-1 text-xs text-gray-500">最新已发布日志会成为普通前端显示的版本号来源。</p>
                </div>
                <button onClick={loadChangelogs} className="rounded-xl bg-gray-100 dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-gray-700/80">刷新</button>
              </div>
              {changelogLoading ? (
                <div className="py-8 text-center text-gray-500">加载中...</div>
              ) : changelogs.length === 0 ? (
                <div className="py-12 text-center text-gray-500">暂无更新日志</div>
              ) : (
                <div className="space-y-3">
                  {changelogs.map(entry => (
                    <div key={entry.id} className={`rounded-xl border p-4 transition ${editingChangelogId === entry.id ? 'border-blue-500/60 bg-blue-50 dark:bg-blue-500/5' : 'border-gray-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-gray-900/60'}`}>
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">v{entry.version || '-'}</span>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${entry.published ? 'bg-green-500/10 text-green-800 dark:text-green-400' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'}`}>{entry.published ? '已发布' : '草稿'}</span>
                          </div>
                          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">{getChangelogTitle(entry)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openChangelogEditor(entry)} className="rounded-lg bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-600/30">编辑</button>
                          <button onClick={() => setDeleteChangelogId(entry.id)} className="rounded-lg bg-red-600/20 px-3 py-1 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-600/30">删除</button>
                        </div>
                      </div>
                      <div className="mb-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-500 dark:text-gray-400">{entry.content || '暂无内容'}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>发布时间：{formatTime(entry.publishedAt)}</span>
                        <span>更新时间：{formatTime(entry.updatedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'templates' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/[0.08] dark:bg-gray-900/80">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-100">模板列表</h3>
                <button onClick={resetTemplateForm} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">新建模板</button>
              </div>
              {selectedTemplateIds.size > 0 && (
                <div className="mb-3 flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-500/10">
                  <span className="text-xs text-blue-600 dark:text-blue-300">已选 {selectedTemplateIds.size} 个模板</span>
                  <button onClick={() => setTemplateBatchDeleteConfirm(true)} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">批量删除</button>
                  <button onClick={() => setSelectedTemplateIds(new Set())} className="rounded-lg bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:bg-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.12]">取消选择</button>
                </div>
              )}
              {templates.length > 0 && (
                <label className="mb-3 flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={selectedTemplateIds.size === templates.length} onChange={toggleAllTemplates} className="accent-blue-500" />
                  全选模板
                </label>
              )}
              {templateLoading ? (
                <div className="space-y-3">{renderSkeletonRows(4, 2)}</div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">暂无模板</div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => {
                    const isTemplateSelected = selectedTemplateIds.has(template.id)
                    return (
                      <div key={template.id} className={`rounded-xl border p-3 text-sm transition ${editingTemplateId === template.id || isTemplateSelected ? 'border-blue-300 bg-blue-50 dark:border-blue-400/30 dark:bg-blue-500/10' : 'border-gray-200/70 bg-gray-50/70 dark:border-white/[0.08] dark:bg-white/[0.03]'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <label className="mt-1 flex flex-shrink-0 items-center">
                            <input
                              type="checkbox"
                              checked={isTemplateSelected}
                              onChange={() => toggleTemplateSelect(template.id)}
                              aria-label={`选择模板 ${template.title}`}
                              className="accent-blue-500"
                            />
                          </label>
                          <div className="h-16 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-cyan-50 to-amber-50 dark:from-blue-500/10 dark:via-cyan-500/10 dark:to-amber-500/10">
                            {template.previewImageId && <TemplatePreviewImg id={template.previewImageId} className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-gray-800 dark:text-gray-100">{template.title}</span>
                              <Switch
                                checked={template.status === 'published'}
                                onCheckedChange={() => handleToggleTemplateStatus(template)}
                                className="scale-75"
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-300">{template.category}</span>
                              <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-gray-500">{template.source === 'admin' ? '管理员' : '用户'}</span>
                              <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-gray-500">{(template.resolutionOptions || []).length} 个分辨率</span>
                              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-600 dark:text-purple-300">{(template.qualityOptions || []).length} 个质量</span>
                              <span className={`rounded-full px-2 py-0.5 ${template.status === 'published' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>{template.status === 'published' ? '已启用' : '已停用'}</span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
                          </div>
                          <div className="flex flex-shrink-0 gap-1.5">
                            <button onClick={() => editTemplate(template)} className="rounded-lg bg-blue-600/15 px-2 py-1 text-xs text-blue-600 dark:text-blue-300">编辑</button>
                            <button onClick={() => setTemplateDeleteTarget(template)} className="rounded-lg bg-red-600/15 px-2 py-1 text-xs text-red-500">删除</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/[0.08] dark:bg-gray-900/80">
              <h3 className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-100">{editingTemplateId ? '编辑模板' : '新建模板'}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-gray-500">模板名称<Input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} className="mt-1" placeholder="目的地旅行海报" /></label>
                <label className="text-xs text-gray-500">分类<Input value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} className="mt-1" placeholder="旅行海报" /></label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-gray-500">排序<Input value={templateSortOrder} onChange={(e) => setTemplateSortOrder(e.target.value)} className="mt-1" type="number" /></label>
                <label className="text-xs text-gray-500">默认每张图积分消耗<Input value={templateCreditCost} onChange={(e) => setTemplateCreditCost(e.target.value.replace(/\D/g, ''))} className="mt-1" type="number" min={1} max={1000} /></label>
              </div>
              <label className="mt-3 block text-xs text-gray-500">描述<Textarea value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} className="mt-1 min-h-[4rem]" placeholder="用户可见的模板说明" /></label>
              <label className="mt-3 block text-xs text-gray-500">隐藏提示词模板<Textarea value={templatePromptBody} onChange={(e) => setTemplatePromptBody(e.target.value)} className="mt-1 min-h-[8rem] font-mono text-xs" placeholder="生成一张图片，风格是 {风格}，时间是 {季节}" /></label>
              <p className="mt-1 text-[11px] text-gray-400">使用 <code>{'{字段名}'}</code> 写占位符。</p>
              <div className="mt-3 rounded-xl border border-gray-200/70 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="mb-2 text-xs text-gray-500">预览图</div>
                <div className="flex items-center gap-3">
                  <div className="h-20 w-28 overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-cyan-50 to-amber-50 dark:from-blue-500/10 dark:via-cyan-500/10 dark:to-amber-500/10">
                    {templatePreviewImageId && (templatePreviewImageDataUrl
                      ? <img src={templatePreviewImageDataUrl} alt="" className="h-full w-full object-cover" />
                      : <TemplatePreviewImg id={templatePreviewImageId} className="h-full w-full object-cover" />)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                      {templatePreviewUploading ? '上传中...' : '上传预览图'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { void handleTemplatePreviewUpload(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
                    </label>
                    {templatePreviewImageId && (
                      <button type="button" onClick={() => { setTemplatePreviewImageId(''); setTemplatePreviewImageDataUrl('') }} className="rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]">清除</button>
                    )}
                  </div>
                </div>
              </div>
              <label className="mt-3 block text-xs text-gray-500">负面约束<Textarea value={templateNegativePrompt} onChange={(e) => setTemplateNegativePrompt(e.target.value)} className="mt-1 min-h-[4rem]" placeholder="可选，普通用户不可见" /></label>
              <div className="mt-3 rounded-xl border border-gray-200/70 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">分辨率档位</div>
                    <div className="mt-1 text-[11px] text-gray-400">只控制生成尺寸；不配置时用户使用自动分辨率。分辨率和图片质量可独立选择。</div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addTemplateResolutionOption}>
                    <Plus className="h-3.5 w-3.5" />
                    新增分辨率
                  </Button>
                </div>
                {templateResolutionOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white/70 px-3 py-4 text-center text-xs text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    未配置分辨率时，模板任务使用自动分辨率
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 px-1 text-[11px] text-gray-400 lg:grid">
                      <span>名称</span>
                      <span>宽 x 高（可空）</span>
                      <span />
                    </div>
                    {templateResolutionOptions.map((option) => {
                      const { width, height } = splitResolutionSize(option.size)
                      return (
                        <div key={option.id} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]">
                          <Input
                            value={option.name || ''}
                            onChange={(e) => updateTemplateResolutionOption(option.id, { name: e.target.value })}
                            placeholder="例如：方图 / 竖版海报"
                            className="h-9"
                          />
                          <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] items-center gap-1.5">
                            <Input
                              value={width}
                              onChange={(e) => updateTemplateResolutionDimension(option.id, 'width', e.target.value)}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="自动"
                              aria-label="分辨率宽度"
                              className="h-9 font-mono"
                            />
                            <span className="text-center text-xs font-semibold text-gray-400">x</span>
                            <Input
                              value={height}
                              onChange={(e) => updateTemplateResolutionDimension(option.id, 'height', e.target.value)}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="自动"
                              aria-label="分辨率高度"
                              className="h-9 font-mono"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTemplateResolutionOption(option.id)}
                            className="h-9 w-9 text-gray-400 hover:text-red-500"
                            aria-label="删除分辨率"
                            title="删除分辨率"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-gray-200/70 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">图片质量与积分档位</div>
                    <div className="mt-1 text-[11px] text-gray-400">固定提供自动、低、中、高质量；这里只能修改每张图消耗积分，不影响分辨率。</div>
                  </div>
                </div>
                {templateQualityOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white/70 px-3 py-4 text-center text-xs text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    固定使用自动、低、中、高四个质量档位，只需配置积分消耗
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-[minmax(0,1fr)_7rem] gap-2 px-1 text-[11px] text-gray-400 lg:grid">
                      <span>质量</span>
                      <span>积分/张</span>
                    </div>
                    {templateQualityOptions.map((option) => {
                      const quality = normalizeTaskQuality(option.quality)
                      return (
                        <div key={option.id} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_7rem]">
                          <div className="flex h-9 items-center px-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                            <span className={`rounded-full px-2.5 py-1 ${TEMPLATE_QUALITY_BADGE_CLASS_NAMES[quality]}`}>
                              {TEMPLATE_QUALITY_LABELS[quality]}
                            </span>
                          </div>
                          <Input
                            value={option.creditCost == null ? String(templateOptionCreditValue(templateCreditCost)) : String(option.creditCost)}
                            onChange={(e) => updateTemplateQualityOption(option.id, { creditCost: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            type="number"
                            min={1}
                            max={1000}
                            aria-label="质量档位积分消耗"
                            className="h-9"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <FieldSchemaEditor promptBody={templatePromptBody} fields={templateFields} onChange={setTemplateFields} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={saveTemplate} disabled={templateSaving}>{templateSaving ? '保存中...' : editingTemplateId ? '保存修改' : '创建模板'}</Button>
                <Button type="button" variant="outline" onClick={previewTemplate}>预览拼接</Button>
                <Button type="button" variant="ghost" onClick={resetTemplateForm}>重置</Button>
              </div>
              {templatePreview && (
                <div className="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
                  <div className="mb-2 text-xs font-medium text-gray-500">拼接预览</div>
                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 dark:text-gray-200">{templatePreview}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'feedback' && (
          <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">反馈管理</h3>
                <p className="mt-1 text-xs text-gray-500">查看用户提交的 Bug 反馈和功能建议。</p>
              </div>
              <button onClick={loadFeedbacks} className="rounded-xl bg-gray-100 dark:bg-gray-800/80 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-gray-700/80">刷新</button>
            </div>
            {feedbacksLoading ? (
              <div className="py-8 text-center text-gray-500">加载中...</div>
            ) : feedbacks.length === 0 ? (
              <div className="py-12 text-center text-gray-500">暂无反馈</div>
            ) : (
              <div className="space-y-3">
                {feedbacks.map(feedback => (
                  <div key={feedback.id} className="rounded-xl border border-gray-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-gray-900/60 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${feedback.category === 'feature' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-red-500/10 text-red-500 dark:text-red-400'}`}>{getFeedbackCategoryLabel(feedback)}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getFeedbackStatusClass(feedback.status)}`}>{getFeedbackStatusLabel(feedback.status)}</span>
                        <span className="text-xs text-gray-500">{formatTime(feedback.createdAt)}</span>
                      </div>
                      <select
                        value={feedback.status}
                        onChange={e => handleUpdateFeedbackStatus(feedback.id, e.target.value as BugFeedbackStatus)}
                        disabled={feedbackUpdatingId === feedback.id}
                        className="rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-800 dark:text-gray-300 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="open">待处理</option>
                        <option value="reviewing">处理中</option>
                        <option value="resolved">已解决</option>
                      </select>
                    </div>
                    <div className="mb-3 text-sm leading-6 text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-words">{feedback.content}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>用户：{feedback.userLabel || feedback.userId}</span>
                      <span>联系方式：{feedback.contact || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'announcement' && (
          <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
            <div className="mb-5">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">站点公告</h3>
              <p className="mt-1 text-xs text-gray-500">启用后，用户首次打开或公告更新后会看到一次弹窗，之后可在右上角问号菜单中查看。</p>
            </div>
            {announcementLoading ? (
              <div className="py-8 text-center text-gray-500">加载中...</div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Switch checked={announcementEnabled} onCheckedChange={setAnnouncementEnabled} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">启用公告</span>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-xs text-gray-500">公告内容</label>
                  <Textarea
                    value={announcementContent}
                    onChange={e => setAnnouncementContent(e.target.value)}
                    rows={8}
                    placeholder="输入公告内容..."
                    className="w-full resize-y"
                  />
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveAnnouncement} disabled={announcementSaving} className="rounded-xl bg-green-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {announcementSaving ? '保存中...' : '保存公告'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'invites' && (
          <div className="space-y-5">
            {/* 奖励配置区 */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-4">奖励配置</h3>
              <div className="flex items-center gap-3 mb-5">
                <Switch checked={inviteEnabled} onCheckedChange={setInviteEnabled} />
                <span className="text-sm text-gray-700 dark:text-gray-300">启用邀请系统</span>
              </div>
              {inviteConfigLoading ? (<div className="py-8 text-center text-gray-500">加载中...</div>) : (
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">邀请人奖励配额（张）</label>
                    <input type="number" min="0" value={inviterReward} onChange={e => setInviterReward(parseInt(e.target.value)||0)}
                      className="w-36 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">被邀请人奖励配额（张）</label>
                    <input type="number" min="0" value={inviteeReward} onChange={e => setInviteeReward(parseInt(e.target.value)||0)}
                      className="w-36 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">默认注册配额（张）</label>
                    <input type="number" min="0" value={defaultQuota} onChange={e => setDefaultQuota(parseInt(e.target.value)||0)}
                      className="w-36 rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400" />
                  </div>
                  <button onClick={handleSaveInviteConfig} disabled={inviteConfigSaving}
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {inviteConfigSaving ? '保存中...' : '保存配置'}
                  </button>
                </div>
              )}
            </div>

            {/* 邮箱注册后缀配置区 */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">邮箱注册后缀</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                配置允许注册的邮箱后缀（如 @gmail.com）。留空表示允许任意邮箱；配置后注册页将显示邮箱名输入框 + 后缀下拉选择，仅允许所选后缀注册。
              </p>
              {emailSuffixLoading ? (<div className="py-8 text-center text-gray-500">加载中...</div>) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {emailSuffixes.length === 0 && (
                      <span className="text-sm text-gray-400">暂未配置，允许任意邮箱注册</span>
                    )}
                    {emailSuffixes.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/[0.06] px-3 py-1 text-sm text-gray-700 dark:text-gray-200">
                        {s}
                        <button type="button" onClick={() => removeEmailSuffix(s)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      type="text"
                      placeholder="例如 @gmail.com"
                      value={emailSuffixInput}
                      onChange={(e) => setEmailSuffixInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmailSuffix() } }}
                      className="w-64"
                    />
                    <Button variant="outline" onClick={addEmailSuffix} disabled={!emailSuffixInput.trim()}>
                      <Plus className="h-4 w-4 mr-1" />添加
                    </Button>
                    <Button variant="default" onClick={handleSaveEmailSuffixes} disabled={emailSuffixSaving}
                      className="bg-green-600 hover:bg-green-700">
                      {emailSuffixSaving ? '保存中...' : '保存配置'}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* 邀请码使用列表区 */}
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-gray-900/80 p-5">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-4">邀请码使用情况</h3>
              {inviteRowsLoading ? (<div className="py-8 text-center text-gray-500">加载中...</div>) : inviteRows.length === 0 ? (
                <div className="py-12 text-center text-gray-500">暂无邀请码使用记录</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/70 dark:border-white/[0.08] text-left text-gray-500 dark:text-gray-400">
                        <th className="px-4 py-3 font-medium text-xs">用户</th>
                        <th className="px-4 py-3 font-medium text-xs">邀请码</th>
                        <th className="px-4 py-3 font-medium text-xs text-right">使用次数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inviteRows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-200/70 dark:border-gray-200/50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.username}</td>
                          <td className="px-4 py-3"><span className="font-mono text-xs bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded">{row.inviteCode || '-'}</span></td>
                          <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{row.usageCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {quotaModal && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setQuotaModal(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {quotaModal.mode === 'increase' && `增加配额 — ${quotaModal.user.label}`}
                {quotaModal.mode === 'decrease' && `减少配额 — ${quotaModal.user.label}`}
                {quotaModal.mode === 'set' && `设定配额 — ${quotaModal.user.label}`}
              </AlertDialogTitle>
              <AlertDialogDescription>当前配额: {getQuotaDisplay(quotaModal.user)}</AlertDialogDescription>
            </AlertDialogHeader>
            <Input type="number" value={quotaValue} onChange={e => setQuotaValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleQuotaConfirm()} placeholder={quotaModal.mode === 'set' ? '输入目标值' : '输入数量'} autoFocus className="w-full mb-4" />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setQuotaModal(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleQuotaConfirm}>确认</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {quotaConfirm && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setQuotaConfirm(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {quotaConfirm.mode === 'increase' && `增加配额 — ${quotaConfirm.user.label}`}
                {quotaConfirm.mode === 'decrease' && `减少配额 — ${quotaConfirm.user.label}`}
                {quotaConfirm.mode === 'set' && `设定配额 — ${quotaConfirm.user.label}`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                当前配额: {getQuotaDisplay(quotaConfirm.user)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <p className="text-sm text-gray-600 dark:text-gray-300 -mt-2">
              {quotaConfirm.mode === 'increase' && `确定为该用户增加 ${quotaConfirm.value} 张图片配额吗？`}
              {quotaConfirm.mode === 'decrease' && `确定为该用户减少 ${quotaConfirm.value} 张图片配额吗？`}
              {quotaConfirm.mode === 'set' && `确定将该用户配额设为 ${quotaConfirm.value} 张吗？`}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setQuotaConfirm(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleQuotaSubmit}>确认操作</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {resetQuotaConfirm && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setResetQuotaConfirm(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>重置配额</AlertDialogTitle>
              <AlertDialogDescription>确定要重置该用户的使用计数吗？</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setResetQuotaConfirm(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetConfirm}>确认重置</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {confirmModal && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setConfirmModal(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmModal.action === 'delete' && `删除用户 — ${confirmModal.user.label}`}
                {confirmModal.action === 'disable' && `禁用用户 — ${confirmModal.user.label}`}
                {confirmModal.action === 'enable' && `启用用户 — ${confirmModal.user.label}`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmModal.action === 'delete' && '删除后该用户及其数据将无法恢复，确定要删除吗？'}
                {confirmModal.action === 'disable' && '禁用后该用户将无法登录，确定要禁用吗？'}
                {confirmModal.action === 'enable' && '确定要启用该用户吗？'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmModal(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction}
                variant={confirmModal.action === 'delete' ? 'destructive' : confirmModal.action === 'disable' ? undefined : 'default'}
                className={confirmModal.action === 'disable' ? 'bg-orange-600 hover:bg-orange-700' : confirmModal.action === 'enable' ? 'bg-green-600 hover:bg-green-700' : ''}
              >确认</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {deleteChangelogId && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setDeleteChangelogId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除更新日志</AlertDialogTitle>
              <AlertDialogDescription>确定要删除这条更新日志吗？此操作不可恢复。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteChangelogId(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteChangelog} variant="destructive">确认删除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {batchConfirm && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setBatchConfirm(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>批量删除{batchConfirm.type === 'users' ? '用户' : '兑换码'}</AlertDialogTitle>
              <AlertDialogDescription>确定要删除选中的 {batchConfirm.count} 个{batchConfirm.type === 'users' ? '用户' : '兑换码'}吗？此操作不可恢复。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBatchConfirm(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleBatchDelete} variant="destructive">确认删除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {resetPasswordModal && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setResetPasswordModal(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>重置密码 — {resetPasswordModal.label}</AlertDialogTitle>
            </AlertDialogHeader>
            <Input type="password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)}
              placeholder="输入新密码（至少 8 字符）" autoFocus className="w-full mb-4" />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setResetPasswordModal(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPasswordConfirm} disabled={resetPasswordValue.length < 8}>确认</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {resetPasswordConfirm && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setResetPasswordConfirm(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>重置密码 — {resetPasswordConfirm.label}</AlertDialogTitle>
              <AlertDialogDescription>
                确定要将该用户的密码重置为输入的新密码吗？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setResetPasswordConfirm(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPassword}>确认重置</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {clearAnalyticsConfirm && (
        <AlertDialog open onOpenChange={(open) => { if (!open && !clearAnalyticsLoading) setClearAnalyticsConfirm(false) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>清空成本收益统计</AlertDialogTitle>
              <AlertDialogDescription>
                此操作会删除所有成本收益统计记录（billing_records），历史统计将无法恢复，但不会删除任务、图片或用户数据。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3 text-sm text-red-600 dark:text-red-400">
              为避免误操作，确认按钮将在 {clearAnalyticsCountdown} 秒后启用。
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearAnalyticsLoading} onClick={() => setClearAnalyticsConfirm(false)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAnalytics} disabled={clearAnalyticsCountdown > 0 || clearAnalyticsLoading} variant="destructive">
                {clearAnalyticsLoading ? '清空中...' : clearAnalyticsCountdown > 0 ? `等待 ${clearAnalyticsCountdown} 秒` : '确认清空统计'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {templateDeleteTarget && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setTemplateDeleteTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除模板</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除模板「{templateDeleteTarget.title}」吗？此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTemplateDeleteTarget(null)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={() => { const t = templateDeleteTarget; setTemplateDeleteTarget(null); void archiveTemplate(t) }} variant="destructive">
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {templateBatchDeleteConfirm && (
        <AlertDialog open onOpenChange={(open) => { if (!open) setTemplateBatchDeleteConfirm(false) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>批量删除模板</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除选中的 {selectedTemplateIds.size} 个模板吗？此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTemplateBatchDeleteConfirm(false)}>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleBatchDeleteTemplates} variant="destructive">
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Toaster />
    </div>
  )
}
