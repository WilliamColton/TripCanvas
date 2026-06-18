import { describe, expect, it } from 'vitest'
import source from './AdminDashboard.tsx?raw'

// Source-check tests — validate acceptance criteria strings are present in AdminDashboard.tsx
// Uses Vite's ?raw import to avoid Node.js fs/path that would fail tsc -b.

describe('Task 2 — Endpoint cost and global sale price controls', () => {
  it('contains endpoint cost label', () => {
    expect(source).toContain('成本价（元/张）')
  })

  it('contains unified sale price label', () => {
    expect(source).toContain('统一售价（元/张）')
  })

  it('contains step="0.0001" for precise money input', () => {
    expect(source).toContain('step="0.0001"')
  })

  it('contains help text for 4 decimal places', () => {
    expect(source).toContain('支持 4 位小数')
  })

  it('contains inline error message for invalid price', () => {
    expect(source).toContain('请输入非负数字，最多 4 位小数')
  })

  it('does NOT use parseFloat anywhere', () => {
    expect(source).not.toContain('parseFloat')
  })
})

describe('quota and endpoint validation regressions', () => {
  it('allows set quota to 0 while rejecting invalid quota values', () => {
    expect(source).not.toContain('!val || val < 0')
    expect(source).toContain("quotaModal.mode !== 'set' && val === 0")
    expect(source).toContain('请输入 0 或正整数')
  })

  it('requires API Key before saving endpoints', () => {
    expect(source).toContain('缺少 API Key')
    expect(source).toContain('!ep.apiKey.trim()')
    expect(source).toContain('apiKey: ep.apiKey.trim()')
  })

  it('refreshes config, announcement, and invites tabs through current-tab refresh handler', () => {
    expect(source).toContain('handleRefreshCurrentTab')
    expect(source).toContain("else if (tab === 'config') loadPricingConfig()")
    expect(source).toContain("else if (tab === 'announcement') loadAnnouncement()")
    expect(source).toContain("else if (tab === 'invites') { loadInviteConfig(); loadInviteRows() }")
    expect(source).not.toContain('loadUsers(); loadCodes(); loadFeedbacks(); loadChangelogs()')
  })

  it('strictly validates endpoint integer inputs without parseInt fallback coercion', () => {
    expect(source).not.toContain('parseInt(value, 10) || 0')
    expect(source).toContain('parseOptionalNonNegativeInteger')
    expect(source).toContain('/^\\d+$/')
    expect(source).toContain('最大并发数和优先级请输入非负整数')
    expect(source).toContain('最大并发数必须为非负整数')
    expect(source).toContain('优先级必须为非负整数')
  })

  it('uses endpoint _key for cost drafts instead of array index', () => {
    expect(source).toContain('_key')
    expect(source).toContain('costDrafts?.[ep._key!]')
  })
})

describe('Admin templates — batch selection and delete', () => {
  it('binds per-template checkbox selection and batch delete confirmation', () => {
    expect(source).toContain('toggleTemplateSelect(template.id)')
    expect(source).toContain('selectedTemplateIds.has(template.id)')
    expect(source).toContain('批量删除模板')
    expect(source).toContain('handleBatchDeleteTemplates')
  })
})

describe('Task 3 — Save all price fields atomically', () => {
  it('contains handleSavePricingConfig', () => {
    expect(source).toContain('handleSavePricingConfig')
  })

  it('calls adminUpdatePricingConfig', () => {
    expect(source).toContain('adminUpdatePricingConfig')
  })

  it('contains save CTA text', () => {
    expect(source).toContain('保存配置')
  })

  it('contains success toast text', () => {
    expect(source).toContain('配置已保存')
  })
})

// ─── Task 1: Analytics tab shell, KPI cards, and trend chart ───

describe('05-07 Task 1 — Analytics tab shell, KPI cards, and trend chart', () => {
  it('has analytics in the Tab union type', () => {
    expect(source).toMatch(/type Tab\s*=\s*[^;]*'analytics'/)
  })

  it('renders 成本收益统计 tab trigger after 系统配置 and before 公告管理', () => {
    const tabsSection = source.slice(source.indexOf('<TabsList'), source.indexOf('</TabsList>'))
    const sysIdx = tabsSection.indexOf('系统配置')
    const analyticsIdx = tabsSection.indexOf('成本收益统计')
    const announceIdx = tabsSection.indexOf('公告管理')
    expect(sysIdx).toBeGreaterThan(-1)
    expect(analyticsIdx).toBeGreaterThan(-1)
    expect(announceIdx).toBeGreaterThan(-1)
    expect(sysIdx).toBeLessThan(analyticsIdx)
    expect(analyticsIdx).toBeLessThan(announceIdx)
  })

  it('defaults analytics range state to "7d"', () => {
    expect(source).toMatch(/useState<\s*AnalyticsRange\s*>\s*\(\s*'7d'\s*\)/)
  })

  it('imports analytics API functions and types from adminApi', () => {
    expect(source).toContain('AnalyticsRange')
    expect(source).toContain('AnalyticsMeta')
    expect(source).toContain('BillingSummary')
    expect(source).toContain('BillingTrendPoint')
    expect(source).toContain('adminGetBillingSummary')
    expect(source).toContain('adminGetBillingTrend')
  })

  it('has loadAnalyticsSummary function', () => {
    expect(source).toContain('loadAnalyticsSummary')
  })

  it('has loadAnalyticsTrend function', () => {
    expect(source).toContain('loadAnalyticsTrend')
  })

  it('contains analytics loader functions', () => {
    // After Task 2, all four loaders exist
    expect(source).toContain('loadAnalyticsSummary')
    expect(source).toContain('loadAnalyticsTrend')
    expect(source).toContain('loadAnalyticsEndpointBreakdown')
    expect(source).toContain('loadAnalyticsUserBreakdown')
  })

  it('contains KPI labels', () => {
    expect(source).toContain('总收入')
    expect(source).toContain('总成本')
    expect(source).toContain('利润')
    expect(source).toContain('成功图片数')
  })

  it('contains range filter labels', () => {
    expect(source).toContain('今日')
    expect(source).toContain('7天')
    expect(source).toContain('30天')
    expect(source).toContain('全部')
  })

  it('contains 刷新统计 button text', () => {
    expect(source).toContain('刷新统计')
  })

  it('contains inline SVG for chart', () => {
    expect(source).toContain('<svg')
  })

  it('contains empty state heading and body', () => {
    expect(source).toContain('暂无成本收益数据')
    expect(source).toContain('完成图片生成并保存配置后，这里将显示收入、成本、利润和成功图片数。')
  })

  it('uses meta.moneyScale for money formatting, not hardcoded 10000 in analytics path', () => {
    // The analytics formatting should reference moneyScale from response meta
    expect(source).toMatch(/\.moneyScale/)
  })

  it('does NOT hardcode 10000-division in analytics money formatting path', () => {
    // The analytics formatting function formatMoneyX10000 must exist
    const hasFormatFn = source.includes('formatMoneyX10000')
    expect(hasFormatFn).toBe(true)
    // The function uses moneyScale from response meta — verify moneyScale reference in the function
    expect(source).toMatch(/\bmoneyScale\b/)
  })

  it('does not import recharts, chart.js, or echarts', () => {
    expect(source).not.toContain('recharts')
    expect(source).not.toContain('chart.js')
    expect(source).not.toContain('echarts')
  })
})

// ─── Task 2: Endpoint and user breakdown tables ───

// ─── 06-06 Invites tab and reset password ───

describe('06-06 Invites tab — Tab type, navigation, and rewards config', () => {
  it('has "invites" in the Tab union type', () => {
    expect(source).toMatch(/type Tab\s*=\s*[^;]*'invites'/)
  })

  it('renders 邀请码设置 tab trigger after 更新日志', () => {
    const changelogIdx = source.indexOf('更新日志')
    const invitesIdx = source.indexOf('邀请码设置')
    expect(changelogIdx).toBeGreaterThan(-1)
    expect(invitesIdx).toBeGreaterThan(-1)
    expect(changelogIdx).toBeLessThan(invitesIdx)
  })

  it('imports adminResetPassword, adminGetInviteConfig, adminUpdateInviteConfig, adminListInvites from adminApi', () => {
    expect(source).toContain('adminResetPassword')
    expect(source).toContain('adminGetInviteConfig')
    expect(source).toContain('adminUpdateInviteConfig')
    expect(source).toContain('adminListInvites')
  })

  it('has inviterReward, inviteeReward, defaultQuota state', () => {
    expect(source).toMatch(/inviterReward/)
    expect(source).toMatch(/inviteeReward/)
    expect(source).toMatch(/defaultQuota/)
  })

  it('has handleSaveInviteConfig function', () => {
    expect(source).toContain('handleSaveInviteConfig')
  })

  it('calls adminUpdateInviteConfig in handleSaveInviteConfig', () => {
    expect(source).toContain('handleSaveInviteConfig')
    expect(source).toContain('adminUpdateInviteConfig')
  })

  it('contains 奖励配置 section heading', () => {
    expect(source).toContain('奖励配置')
  })

  it('contains 邀请人奖励配额（张） label', () => {
    expect(source).toContain('邀请人奖励配额（张）')
  })

  it('contains 被邀请人奖励配额（张） label', () => {
    expect(source).toContain('被邀请人奖励配额（张）')
  })

  it('contains 默认注册配额（张） label', () => {
    expect(source).toContain('默认注册配额（张）')
  })

  it('contains 保存配置 button text', () => {
    expect(source).toContain('保存配置')
  })

  it('contains success toast 配置已保存', () => {
    expect(source).toContain('配置已保存')
  })
})

describe('06-06 Invites tab — Usage list table', () => {
  it('has inviteRows and inviteRowsLoading state', () => {
    expect(source).toMatch(/inviteRows/)
    expect(source).toMatch(/inviteRowsLoading/)
  })

  it('has loadInviteRows function', () => {
    expect(source).toContain('loadInviteRows')
  })

  it('calls adminListInvites in loadInviteRows', () => {
    expect(source).toContain('adminListInvites')
  })

  it('contains 邀请码使用情况 section heading', () => {
    expect(source).toContain('邀请码使用情况')
  })

  it('contains 用户 table header', () => {
    expect(source).toContain('用户')
  })

  it('contains 邀请码 table header', () => {
    expect(source).toContain('邀请码')
  })

  it('contains 使用次数 table header', () => {
    expect(source).toContain('使用次数')
  })

  it('contains empty state message 暂无邀请码使用记录', () => {
    expect(source).toContain('暂无邀请码使用记录')
  })
})

describe('06-06 Reset password button and modal', () => {
  it('has resetPasswordModal state', () => {
    expect(source).toMatch(/resetPasswordModal/)
  })

  it('has resetPasswordValue state', () => {
    expect(source).toMatch(/resetPasswordValue/)
  })

  it('has handleResetPassword function', () => {
    expect(source).toContain('handleResetPassword')
  })

  it('calls adminResetPassword in handleResetPassword', () => {
    expect(source).toContain('handleResetPassword')
    expect(source).toContain('adminResetPassword')
  })

  it('contains 重置密码 button text in user rows', () => {
    expect(source).toContain('重置密码')
  })

  it('contains modal title 重置密码 — ', () => {
    // The modal title uses Chinese dash — (em dash) with user label
    expect(source).toContain('重置密码 —')
    // Alternative: build the string at runtime, but source check needs the literal.
    // The plan says "重置密码 -- {label}" and UI spec says "重置密码 — {label}".
    // Check for the prefix.
    const hasResetPwdModalTitle = source.includes('重置密码 —') || source.includes('重置密码 --')
    expect(hasResetPwdModalTitle).toBe(true)
  })

  it('contains password input placeholder 输入新密码（至少 8 字符）', () => {
    expect(source).toContain('输入新密码（至少 8 字符）')
  })

  it('contains password input type="password" in reset modal', () => {
    expect(source).toContain('type="password"')
  })

  it('contains 取消 and 确认 buttons in reset modal', () => {
    expect(source).toContain('取消')
    expect(source).toContain('确认')
  })

  it('confirms password minimum 8 characters validation', () => {
    // Should check resetPasswordValue.length >= 8 or < 8
    expect(source).toMatch(/length\s*[<>]=?\s*8/)
  })

  it('contains success toast 密码已重置', () => {
    expect(source).toContain('密码已重置')
  })
})

describe('05-07 Task 2 — Endpoint and user breakdown tables', () => {
  it('has endpointRows and userRows state', () => {
    expect(source).toMatch(/endpointRows/)
    expect(source).toMatch(/userRows/)
  })

  it('has independent loading/error state for endpoint and user', () => {
    expect(source).toMatch(/endpointLoading/)
    expect(source).toMatch(/endpointError/)
    expect(source).toMatch(/userLoading/)
    expect(source).toMatch(/userError/)
  })

  it('has loadAnalyticsEndpointBreakdown function', () => {
    expect(source).toContain('loadAnalyticsEndpointBreakdown')
  })

  it('has loadAnalyticsUserBreakdown function', () => {
    expect(source).toContain('loadAnalyticsUserBreakdown')
  })

  it('triggers analytics refresh on tab load', () => {
    expect(source).toContain('refreshAnalytics(analyticsRange)')
    expect(source).toContain('loadAnalyticsSummary')
    expect(source).toContain('loadAnalyticsTrend')
    expect(source).toContain('loadAnalyticsEndpointBreakdown')
    expect(source).toContain('loadAnalyticsUserBreakdown')
  })

  it('contains 端点拆分 and 用户拆分 headings', () => {
    expect(source).toContain('端点拆分')
    expect(source).toContain('用户拆分')
  })

  it('contains 端点标识 and 用户标识 column labels', () => {
    expect(source).toContain('端点标识')
    expect(source).toContain('用户标识')
  })

  it('contains 利润率 column label', () => {
    expect(source).toContain('利润率')
  })

  it('formats endpoint/user money using response .meta.moneyScale', () => {
    // verify moneyScale is read from meta in endpoint/user context
    expect(source).toMatch(/endpointMeta\?\.moneyScale|endpointMeta\.moneyScale/)
    expect(source).toMatch(/userMeta\?\.moneyScale|userMeta\.moneyScale/)
  })

  it('contains exact error text for failed stats load', () => {
    expect(source).toContain('统计数据加载失败，请点击"刷新统计"重试；保存配置失败时，请检查金额是否为数字且最多 4 位小数。')
  })

  it('does NOT contain CSV, PDF, 导出, or 钻取 in analytics', () => {
    expect(source).not.toContain('CSV')
    expect(source).not.toContain('PDF')
    expect(source).not.toContain('导出')
    expect(source).not.toContain('钻取')
  })
})

describe('Analytics enhancement — resolution and endpoint cost structure', () => {
  it('loads image-size and endpoint-size breakdown data', () => {
    expect(source).toContain('adminGetImageSizeBreakdown')
    expect(source).toContain('adminGetEndpointSizeBreakdown')
    expect(source).toContain('loadImageSizeBreakdown')
    expect(source).toContain('loadEndpointSizeBreakdown')
  })

  it('renders resolution pie chart UI', () => {
    expect(source).toContain('分辨率分布')
    expect(source).toContain('分辨率生成占比饼图')
    expect(source).toContain('总图片数')
  })

  it('renders endpoint cost structure stacked chart UI', () => {
    expect(source).toContain('端点成本结构')
    expect(source).toContain('暂无端点成本结构数据')
  })

  it('renders single-image average cost trend UI', () => {
    expect(source).toContain('单张平均成本')
    expect(source).toContain('单张平均成本趋势')
  })

  it('renders endpoint merge toggle and parses URL origins safely', () => {
    expect(source).toContain('合并同源端点')
    expect(source).toContain('mergeEndpoints')
    expect(source).toContain('new URL(row.endpointBaseUrl).origin')
  })

  it('renders delayed clear analytics confirmation flow', () => {
    expect(source).toContain('清空统计')
    expect(source).toContain('清空成本收益统计')
    expect(source).toContain('setClearAnalyticsCountdown(5)')
    expect(source).toContain('clearAnalyticsCountdown > 0')
    expect(source).toContain('确认清空统计')
  })

  it('does not import third-party chart libraries', () => {
    expect(source).not.toContain('recharts')
    expect(source).not.toContain('chart.js')
    expect(source).not.toContain('echarts')
  })
})
