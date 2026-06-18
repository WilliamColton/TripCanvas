import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adminResetPassword,
  adminGetInviteConfig,
  adminUpdateInviteConfig,
  adminListInvites,
} from './adminApi'

describe('Task 5 — adminApi invite/management functions', () => {
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

  describe('adminResetPassword', () => {
    it('calls PUT /api/admin/users/:id/password with password in body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await adminResetPassword('user-123', 'newpass456')

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/users/user-123/password')
      expect(init.method).toBe('PUT')
      const body = JSON.parse(init.body as string)
      expect(body.password).toBe('newpass456')
      expect(result.ok).toBe(true)
    })

    it('includes Authorization header', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      await adminResetPassword('user-abc', 'pass123')

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const headers = init.headers
      const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers['Authorization']
      expect(authHeader).toBe(`Bearer ${TEST_TOKEN}`)
    })

    it('URL-encodes the user ID', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )

      await adminResetPassword('user@special id', 'pass123')

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      // encodeURIComponent encodes @ and space
      expect(url).toContain('/api/admin/users/')
      expect(url).not.toContain('user@special id') // raw string should be encoded
      expect(url).toContain(encodeURIComponent('user@special id'))
    })
  })

  describe('adminGetInviteConfig', () => {
    it('calls GET /api/admin/invite-config and returns config', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ inviterReward: 10, inviteeReward: 5, defaultQuota: 100 }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await adminGetInviteConfig()

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/invite-config')
      expect(init.method || 'GET').toBe('GET')
      expect(result.inviterReward).toBe(10)
      expect(result.inviteeReward).toBe(5)
      expect(result.defaultQuota).toBe(100)
    })
  })

  describe('adminUpdateInviteConfig', () => {
    it('calls PUT /api/admin/invite-config with reward values in body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, inviterReward: 20, inviteeReward: 10, defaultQuota: 200, inviteEnabled: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await adminUpdateInviteConfig(20, 10, 200, true)

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/invite-config')
      expect(init.method).toBe('PUT')
      const body = JSON.parse(init.body as string)
      expect(body.inviterReward).toBe(20)
      expect(body.inviteeReward).toBe(10)
      expect(body.defaultQuota).toBe(200)
      expect(body.inviteEnabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.inviterReward).toBe(20)
    })
  })

  describe('adminListInvites', () => {
    it('calls GET /api/admin/invites and returns invites array', async () => {
      const invites = [
        { username: 'alice', inviteCode: 'ALICE123', usageCount: 5 },
        { username: 'bob', inviteCode: 'BOBCODE', usageCount: 0 },
      ]
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ invites }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await adminListInvites()

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/admin/invites')
      expect(result.invites).toHaveLength(2)
      expect(result.invites[0].username).toBe('alice')
      expect(result.invites[0].inviteCode).toBe('ALICE123')
      expect(result.invites[1].usageCount).toBe(0)
    })

    it('returns empty invites array when none exist', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ invites: [] }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await adminListInvites()

      expect(result.invites).toEqual([])
    })
  })
})
