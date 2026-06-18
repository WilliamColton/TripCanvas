import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loginWithPassword,
  register,
  migrate,
  changePassword,
  setInviteCode,
  getInviteCode,
  changeUsername,
  clearBackendToken,
  deleteRemoteImage,
  setUnauthorizedHandler,
  streamTaskStatus,
  type AuthUser,
} from './backendApi'

describe('Task 5 — backendApi extended auth functions', () => {
  const TEST_TOKEN = 'test-user-jwt'

  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
    })
    const setItem = localStorage.setItem as unknown as (key: string, val: string) => void
    setItem('gpt-image-playground-token', TEST_TOKEN)
  })

  afterEach(() => {
    setUnauthorizedHandler(null)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('401 handling', () => {
    it('clears token and invokes unauthorized handler when authenticated request returns 401', async () => {
      const handler = vi.fn()
      setUnauthorizedHandler(handler)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: '登录状态无效' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      await expect(changeUsername('newname')).rejects.toThrow('登录状态无效')

      expect(localStorage.removeItem).toHaveBeenCalledWith('gpt-image-playground-token')
      expect(handler).toHaveBeenCalledOnce()
    })

    it('does not invoke unauthorized handler when request has no token', async () => {
      const handler = vi.fn()
      clearBackendToken()
      setUnauthorizedHandler(handler)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: '登录失败' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      await expect(changeUsername('newname')).rejects.toThrow('登录失败')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('deleteRemoteImage', () => {
    it('calls DELETE /api/images/:id with auth header', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      await deleteRemoteImage('image 1')

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/images/image%201')
      expect(init.method).toBe('DELETE')
      const headers = init.headers
      const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers['Authorization']
      expect(authHeader).toBe(`Bearer ${TEST_TOKEN}`)
    })
  })

  describe('streamTaskStatus', () => {
    it('converts error-only SSE payload to task error update', async () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: task-update\ndata: {"error":"任务不存在"}\n\n'))
          controller.close()
        },
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(stream, { status: 200 }))
      const onUpdate = vi.fn()

      streamTaskStatus('missing-task', onUpdate)

      await vi.waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
          id: 'missing-task',
          status: 'error',
          error: '任务不存在',
        }))
      })
    })
  })

  describe('AuthUser interface', () => {
    it('includes username and needsMigration optional fields', () => {
      const user: AuthUser = {
        id: 'u1',
        label: 'test',
        role: 'user',
        imageCount: 0,
        quota: 100,
        unlimitedQuota: false,
        usedCount: 0,
        username: 'testuser',
        needsMigration: false,
      }
      expect(user.username).toBe('testuser')
      expect(user.needsMigration).toBe(false)
    })

    it('allows username and needsMigration to be undefined', () => {
      const user: AuthUser = {
        id: 'u1',
        label: 'test',
        role: 'user',
        imageCount: 0,
        quota: 100,
        unlimitedQuota: false,
        usedCount: 0,
      }
      expect(user.username).toBeUndefined()
      expect(user.needsMigration).toBeUndefined()
    })
  })

  describe('loginWithPassword', () => {
    it('calls POST /api/auth/login-password with username and password, stores token', async () => {
      const mockUser: AuthUser = {
        id: 'u1', label: 'test', role: 'user', imageCount: 0, quota: 100, unlimitedQuota: false, usedCount: 0,
        username: 'testuser', needsMigration: false,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: TEST_TOKEN, user: mockUser, needsMigration: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await loginWithPassword('testuser', 'pass12345678')

      expect(globalThis.fetch).toHaveBeenCalledOnce()
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/auth/login-password')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body as string)
      expect(body.username).toBe('testuser')
      expect(body.password).toBe('pass12345678')
      expect(result.token).toBe(TEST_TOKEN)
      expect(result.user.id).toBe('u1')
      expect(result.needsMigration).toBe(false)
    })

    it('stores token in localStorage on success', async () => {
      const user: AuthUser = { id: 'u1', label: 'test', role: 'user', imageCount: 0, quota: 100, unlimitedQuota: false, usedCount: 0 }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'new-token', user, needsMigration: false }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      await loginWithPassword('testuser', 'pass12345678')

      expect(localStorage.setItem).toHaveBeenCalledWith('gpt-image-playground-token', 'new-token')
    })
  })

  describe('register', () => {
    it('calls POST /api/auth/register with inviteCode, username, password, stores token (auto-login)', async () => {
      const user: AuthUser = { id: 'new-u', label: 'newuser', role: 'user', imageCount: 0, quota: 100, unlimitedQuota: false, usedCount: 0, username: 'newuser' }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: TEST_TOKEN, user }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await register('INVITE123', 'newuser', 'pass12345678')

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/auth/register')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body as string)
      expect(body.inviteCode).toBe('INVITE123')
      expect(body.username).toBe('newuser')
      expect(body.password).toBe('pass12345678')
      expect(result.user.id).toBe('new-u')
    })

    it('stores token on success (auto-login)', async () => {
      const user: AuthUser = { id: 'u1', label: 'test', role: 'user', imageCount: 0, quota: 100, unlimitedQuota: false, usedCount: 0 }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'auto-login-token', user }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      await register('', 'newuser', 'pass12345678')

      expect(localStorage.setItem).toHaveBeenCalledWith('gpt-image-playground-token', 'auto-login-token')
    })
  })

  describe('migrate', () => {
    it('calls POST /api/auth/migrate with username, password, confirmPassword and Bearer token', async () => {
      const user: AuthUser = { id: 'u1', label: 'test', role: 'user', imageCount: 0, quota: 100, unlimitedQuota: false, usedCount: 0, username: 'testuser', needsMigration: false }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ user }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      await migrate('testuser', 'newpass123', 'newpass123')

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/auth/migrate')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body as string)
      expect(body.username).toBe('testuser')
      expect(body.password).toBe('newpass123')
      expect(body.confirmPassword).toBe('newpass123')
      const headers = init.headers
      const authHeader = headers instanceof Headers ? headers.get('Authorization') : headers['Authorization']
      expect(authHeader).toBe(`Bearer ${TEST_TOKEN}`)
    })
  })

  describe('changePassword', () => {
    it('calls POST /api/auth/change-password with oldPassword, newPassword, confirmPassword', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await changePassword('oldpass', 'newpass123', 'newpass123')

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/auth/change-password')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body as string)
      expect(body.oldPassword).toBe('oldpass')
      expect(body.newPassword).toBe('newpass123')
      expect(body.confirmPassword).toBe('newpass123')
      expect(result.ok).toBe(true)
    })
  })

  describe('setInviteCode', () => {
    it('calls PUT /api/auth/invite-code with code in body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await setInviteCode('MYCODE')

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/auth/invite-code')
      expect(init.method).toBe('PUT')
      const body = JSON.parse(init.body as string)
      expect(body.code).toBe('MYCODE')
      expect(result.ok).toBe(true)
    })
  })

  describe('getInviteCode', () => {
    it('calls GET /api/auth/invite-code and returns code and setAt', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'MYCODE', setAt: 1710000000000 }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await getInviteCode()

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/api/auth/invite-code')
      expect(init.method || 'GET').toBe('GET')
      expect(result.code).toBe('MYCODE')
      expect(result.setAt).toBe(1710000000000)
    })

    it('returns null code when not set', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ code: null, setAt: null }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await getInviteCode()

      expect(result.code).toBeNull()
      expect(result.setAt).toBeNull()
    })
  })
})
