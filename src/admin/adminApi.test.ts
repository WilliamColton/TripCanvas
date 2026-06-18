import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adminGetBillingSummary,
  adminGetBillingTrend,
  adminGetBillingEndpointBreakdown,
  adminGetBillingUserBreakdown,
  adminGetImageSizeBreakdown,
  adminGetEndpointSizeBreakdown,
  adminClearBillingAnalytics,
  adminGetPricingConfig,
  adminUpdatePricingConfig,
  clearAdminToken,
  type AnalyticsMeta,
  type AnalyticsRange,
  type ApiEndpoint,
  type BillingEndpointBreakdownResponse,
  type BillingEndpointRow,
  type BillingSummary,
  type BillingSummaryResponse,
  type BillingTrendPoint,
  type BillingTrendResponse,
  type BillingUserBreakdownResponse,
  type BillingUserRow,
  type EndpointSizeBreakdownResponse,
  type EndpointSizeBreakdownRow,
  type EndpointSizeCell,
  type ImageSizeBreakdownResponse,
  type ImageSizeRow,
  type PricingConfigResponse,
} from './adminApi'

describe('Task 1 — Pricing DTOs and client functions', () => {
  const TEST_TOKEN = 'test-admin-jwt'

  beforeEach(() => {
    // Provide localStorage in Node environment
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
    })
    // Seed with admin token so adminApi functions can find it
    const setItem = localStorage.setItem as unknown as (key: string, val: string) => void
    setItem('gpt-image-playground-admin-token', TEST_TOKEN)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('ApiEndpoint type', () => {
    it('allows tier cost fields as optional numbers', () => {
      const ep: ApiEndpoint = {
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
        cost1KX10000: 0,
        cost2KX10000: 1234,
        cost4KX10000: 5678,
      }
      expect(ep.cost1KX10000).toBe(0)
      expect(ep.cost2KX10000).toBe(1234)
      expect(ep.cost4KX10000).toBe(5678)

      const withoutCost: ApiEndpoint = {
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
      }
      expect(withoutCost.cost1KX10000).toBeUndefined()
    })
  })

  describe('PricingConfigResponse type', () => {
    it('has endpoints1K/2K/4K, salePriceX10000, and moneyScale', () => {
      const resp: PricingConfigResponse = {
        endpointsAuto: [],
        endpoints1K: [
          { baseUrl: 'https://api-1k.openai.com', apiKey: 'sk-1k', cost1KX10000: 500 },
        ],
        endpoints2K: [
          { baseUrl: 'https://api-2k.openai.com', apiKey: 'sk-2k', cost2KX10000: 800 },
        ],
        endpoints4K: [],
        salePriceX10000: 2000,
        salePricingMode: 'unified',
        salePrice1KX10000: 2000,
        salePrice2KX10000: 2000,
        salePrice4KX10000: 2000,
        moneyScale: 10000,
        ok: true,
      }
      expect(resp.endpoints1K).toHaveLength(1)
      expect(resp.endpoints2K).toHaveLength(1)
      expect(resp.salePriceX10000).toBe(2000)
      expect(resp.moneyScale).toBe(10000)
      expect(resp.ok).toBe(true)
    })
  })

  describe('adminGetPricingConfig', () => {
    it('calls GET /api/admin/config/pricing with admin token', async () => {
      const mockResponse: PricingConfigResponse = {
        endpointsAuto: [],
        endpoints1K: [
          { baseUrl: 'https://api.openai.com', apiKey: 'sk-test', cost1KX10000: 0, cost2KX10000: 500 },
        ],
        endpoints2K: [],
        endpoints4K: [],
        salePriceX10000: 2000,
        salePricingMode: 'unified',
        salePrice1KX10000: 2000,
        salePrice2KX10000: 2000,
        salePrice4KX10000: 2000,
        moneyScale: 10000,
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await adminGetPricingConfig()

      expect(globalThis.fetch).toHaveBeenCalledOnce()
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/config/pricing')
      expect(init.method || 'GET').toBe('GET')
      expect(init.headers).toBeDefined()
      // Verify the Authorization header carries the token
      const headers = init.headers
      const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers['Authorization']
      expect(authHeader).toBe(`Bearer ${TEST_TOKEN}`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('adminUpdatePricingConfig', () => {
    it('sends PUT with endpoints and salePriceX10000 in body', async () => {
      const epsAuto: ApiEndpoint[] = []
      const eps1K: ApiEndpoint[] = [
        { baseUrl: 'https://api.openai.com', apiKey: 'sk-test', cost1KX10000: 500 },
      ]
      const eps2K: ApiEndpoint[] = []
      const eps4K: ApiEndpoint[] = []
      const salePriceX10000 = 2000

      const mockResponse: PricingConfigResponse = {
        endpointsAuto: [],
        endpoints1K: eps1K,
        endpoints2K: eps2K,
        endpoints4K: eps4K,
        salePriceX10000,
        salePricingMode: 'unified',
        salePrice1KX10000: salePriceX10000,
        salePrice2KX10000: salePriceX10000,
        salePrice4KX10000: salePriceX10000,
        moneyScale: 10000,
        ok: true,
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await adminUpdatePricingConfig(epsAuto, eps1K, eps2K, eps4K, salePriceX10000, 'unified', 2000, 2000, 2000)

      expect(globalThis.fetch).toHaveBeenCalledOnce()
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/config/pricing')
      expect(init.method).toBe('PUT')
      const body = JSON.parse(init.body as string)
      expect(body.endpointsAuto).toEqual(epsAuto)
      expect(body.endpoints1K).toEqual(eps1K)
      expect(body.salePriceX10000).toBe(2000)
      expect(result).toEqual(mockResponse)
    })

    it('includes Authorization header in PUT request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ endpointsAuto: [], endpoints1K: [], endpoints2K: [], endpoints4K: [], salePriceX10000: 0, salePricingMode: 'unified', salePrice1KX10000: 0, salePrice2KX10000: 0, salePrice4KX10000: 0, moneyScale: 10000 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      await adminUpdatePricingConfig([], [], [], [], 0, 'unified', 0, 0, 0)

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const headers = init.headers
      const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers['Authorization']
      expect(authHeader).toBe(`Bearer ${TEST_TOKEN}`)
    })
  })
})

describe('Task 2 — Analytics DTOs and client functions', () => {
  const TEST_TOKEN = 'test-admin-jwt'

  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
    })
    const setItem = localStorage.setItem as unknown as (key: string, val: string) => void
    setItem('gpt-image-playground-admin-token', TEST_TOKEN)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('AnalyticsRange type', () => {
    it('accepts only valid range literals', () => {
      const ranges: AnalyticsRange[] = ['today', '7d', '30d', 'all']
      for (const r of ranges) {
        expect(r).toBeTruthy()
      }
    })
  })

  describe('AnalyticsMeta type', () => {
    it('has range, from, to, and moneyScale', () => {
      const meta: AnalyticsMeta = {
        range: '7d',
        from: 1710000000000,
        to: 1710600000000,
        moneyScale: 10000,
      }
      expect(meta.range).toBe('7d')
      expect(meta.moneyScale).toBe(10000)
      expect(meta.from).toBe(1710000000000)
      expect(meta.to).toBe(1710600000000)
    })
  })

  describe('BillingSummary type', () => {
    it('has revenueX10000, costX10000, profitX10000, successImages', () => {
      const summary: BillingSummary = {
        revenueX10000: 123400,
        costX10000: 45600,
        profitX10000: 77800,
        successImages: 321,
      }
      expect(summary.revenueX10000).toBe(123400)
      expect(summary.costX10000).toBe(45600)
      expect(summary.profitX10000).toBe(77800)
      expect(summary.successImages).toBe(321)
    })
  })

  describe('BillingTrendPoint type', () => {
    it('has bucket, money fields, and successImages', () => {
      const point: BillingTrendPoint = {
        bucket: '2026-05-22',
        revenueX10000: 1000,
        costX10000: 400,
        profitX10000: 600,
        successImages: 8,
      }
      expect(point.bucket).toBe('2026-05-22')
      expect(point.profitX10000).toBe(600)
    })
  })

  describe('BillingEndpointRow type', () => {
    it('has endpoint fields and profitRateBps', () => {
      const row: BillingEndpointRow = {
        endpointBaseUrl: 'https://api.openai.com',
        endpointLabel: 'OpenAI',
        successImages: 100,
        revenueX10000: 500000,
        costX10000: 200000,
        profitX10000: 300000,
        profitRateBps: 6000,
      }
      expect(row.endpointBaseUrl).toBe('https://api.openai.com')
      expect(row.profitRateBps).toBe(6000)
    })
  })

  describe('BillingUserRow type', () => {
    it('has user fields and profitRateBps', () => {
      const row: BillingUserRow = {
        userId: 'user-1',
        userLabel: 'Test User',
        successImages: 50,
        revenueX10000: 250000,
        costX10000: 100000,
        profitX10000: 150000,
        profitRateBps: 6000,
      }
      expect(row.userId).toBe('user-1')
      expect(row.profitRateBps).toBe(6000)
    })
  })

  describe('ImageSizeRow type', () => {
    it('has imageSize and aggregate money fields', () => {
      const row: ImageSizeRow = {
        imageSize: '2K',
        successImages: 20,
        revenueX10000: 80000,
        costX10000: 30000,
        profitX10000: 50000,
      }
      expect(row.imageSize).toBe('2K')
      expect(row.successImages).toBe(20)
    })
  })

  describe('EndpointSizeBreakdownRow type', () => {
    it('has endpoint fields and nested size cells', () => {
      const cell: EndpointSizeCell = { successImages: 3, costX10000: 12000 }
      const row: EndpointSizeBreakdownRow = {
        endpointBaseUrl: 'https://api.example.com/v1',
        endpointLabel: 'https://api.example.com/v1',
        size1K: cell,
        size2K: { successImages: 2, costX10000: 10000 },
        size4K: { successImages: 1, costX10000: 9000 },
        unknown: { successImages: 0, costX10000: 0 },
      }
      expect(row.size1K.costX10000).toBe(12000)
      expect(row.unknown.successImages).toBe(0)
    })
  })

  describe('Response wrapper types', () => {
    it('BillingSummaryResponse wraps meta and summary', () => {
      const resp: BillingSummaryResponse = {
        meta: { range: '7d', from: 1, to: 2, moneyScale: 10000 },
        summary: { revenueX10000: 0, costX10000: 0, profitX10000: 0, successImages: 0 },
      }
      expect(resp.meta.range).toBe('7d')
      expect(resp.summary.successImages).toBe(0)
    })

    it('BillingTrendResponse wraps meta and trend array', () => {
      const resp: BillingTrendResponse = {
        meta: { range: '30d', from: 1, to: 2, moneyScale: 10000 },
        trend: [{ bucket: '2026-05-22', revenueX10000: 100, costX10000: 50, profitX10000: 50, successImages: 2 }],
      }
      expect(resp.trend).toHaveLength(1)
      expect(resp.meta.range).toBe('30d')
    })

    it('BillingEndpointBreakdownResponse wraps meta and rows', () => {
      const resp: BillingEndpointBreakdownResponse = {
        meta: { range: 'all', from: 1, to: 2, moneyScale: 10000 },
        rows: [{ endpointBaseUrl: 'https://api.example.com', endpointLabel: 'Example', successImages: 1, revenueX10000: 100, costX10000: 50, profitX10000: 50, profitRateBps: 5000 }],
      }
      expect(resp.rows).toHaveLength(1)
      expect(resp.meta.moneyScale).toBe(10000)
    })

    it('BillingUserBreakdownResponse wraps meta and rows', () => {
      const resp: BillingUserBreakdownResponse = {
        meta: { range: 'today', from: 1, to: 2, moneyScale: 10000 },
        rows: [{ userId: 'u1', userLabel: 'User 1', successImages: 1, revenueX10000: 100, costX10000: 50, profitX10000: 50, profitRateBps: 5000 }],
      }
      expect(resp.rows).toHaveLength(1)
      expect(resp.meta.range).toBe('today')
    })

    it('ImageSizeBreakdownResponse wraps meta and rows', () => {
      const resp: ImageSizeBreakdownResponse = {
        meta: { range: '7d', from: 1, to: 2, moneyScale: 10000 },
        rows: [{ imageSize: '1K', successImages: 10, revenueX10000: 50000, costX10000: 10000, profitX10000: 40000 }],
      }
      expect(resp.rows[0].imageSize).toBe('1K')
    })

    it('EndpointSizeBreakdownResponse wraps meta and rows', () => {
      const resp: EndpointSizeBreakdownResponse = {
        meta: { range: '30d', from: 1, to: 2, moneyScale: 10000 },
        rows: [{ endpointBaseUrl: 'https://api.example.com/v1', endpointLabel: 'Example', size1K: { successImages: 1, costX10000: 100 }, size2K: { successImages: 0, costX10000: 0 }, size4K: { successImages: 0, costX10000: 0 }, unknown: { successImages: 0, costX10000: 0 } }],
      }
      expect(resp.rows[0].size1K.successImages).toBe(1)
    })
  })

  describe('adminGetBillingSummary', () => {
    it('calls GET /api/admin/analytics/summary with range query param', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          meta: { range: '7d', from: 1, to: 2, moneyScale: 10000 },
          summary: { revenueX10000: 0, costX10000: 0, profitX10000: 0, successImages: 0 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminGetBillingSummary('7d')

      expect(globalThis.fetch).toHaveBeenCalledOnce()
      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/analytics/summary')
      expect(url).toContain('range=7d')
    })
  })

  describe('adminGetBillingTrend', () => {
    it('calls GET /api/admin/analytics/trend with range query param', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          meta: { range: '30d', from: 1, to: 2, moneyScale: 10000 },
          trend: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminGetBillingTrend('30d')

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/analytics/trend')
      expect(url).toContain('range=30d')
    })
  })

  describe('adminGetBillingEndpointBreakdown', () => {
    it('calls GET /api/admin/analytics/endpoints with range query param', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          meta: { range: 'today', from: 1, to: 2, moneyScale: 10000 },
          rows: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminGetBillingEndpointBreakdown('today')

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/analytics/endpoints')
      expect(url).toContain('range=today')
    })
  })

  describe('adminGetBillingUserBreakdown', () => {
    it('calls GET /api/admin/analytics/users with range query param', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          meta: { range: 'all', from: 1, to: 2, moneyScale: 10000 },
          rows: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminGetBillingUserBreakdown('all')

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/analytics/users')
      expect(url).toContain('range=all')
    })
  })

  describe('adminGetImageSizeBreakdown', () => {
    it('calls GET /api/admin/analytics/image-sizes with range query param', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          meta: { range: '7d', from: 1, to: 2, moneyScale: 10000 },
          rows: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminGetImageSizeBreakdown('7d')

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/analytics/image-sizes')
      expect(url).toContain('range=7d')
    })
  })

  describe('adminGetEndpointSizeBreakdown', () => {
    it('calls GET /api/admin/analytics/endpoint-sizes with range query param', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          meta: { range: '30d', from: 1, to: 2, moneyScale: 10000 },
          rows: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminGetEndpointSizeBreakdown('30d')

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/analytics/endpoint-sizes')
      expect(url).toContain('range=30d')
    })
  })

  describe('adminClearBillingAnalytics', () => {
    it('calls DELETE /api/admin/analytics', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, deleted: 3 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminClearBillingAnalytics()

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/analytics')
      expect(options?.method).toBe('DELETE')
    })
  })
})
