import { useEffect, useRef, useState } from 'react'
import { register, verifyEmail, resendVerifyCode } from '../lib/backendApi'
import { bootstrapBackendSession, useStore } from '../store'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

interface RegisterModalProps {
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN = 60

export default function RegisterModal({ onClose }: RegisterModalProps) {
  const inviteEnabled = useStore((s) => s.settings.inviteEnabled)
  const allowedSuffixes = useStore((s) => s.settings.allowedEmailSuffixes) ?? []
  const hasSuffixes = allowedSuffixes.length > 0

  const [step, setStep] = useState<1 | 2>(1)
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [emailLocal, setEmailLocal] = useState('')
  const [emailSuffix, setEmailSuffix] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (hasSuffixes && !emailSuffix) {
      setEmailSuffix(allowedSuffixes[0])
    }
  }, [hasSuffixes, allowedSuffixes, emailSuffix])

  useEffect(() => () => {
    if (resendTimer.current) clearInterval(resendTimer.current)
  }, [])

  const startResendCooldown = () => {
    if (resendTimer.current) clearInterval(resendTimer.current)
    setResendIn(RESEND_COOLDOWN)
    resendTimer.current = setInterval(() => {
      setResendIn((n) => {
        if (n <= 1) {
          if (resendTimer.current) {
            clearInterval(resendTimer.current)
            resendTimer.current = null
          }
          return 0
        }
        return n - 1
      })
    }, 1000)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    let emailVal: string
    if (hasSuffixes) {
      const local = emailLocal.trim()
      const suffix = emailSuffix || allowedSuffixes[0]
      if (!local) {
        setError('请输入邮箱名')
        return
      }
      if (!suffix) {
        setError('请选择邮箱后缀')
        return
      }
      emailVal = local + suffix
    } else {
      emailVal = email.trim()
      if (!EMAIL_RE.test(emailVal)) {
        setError('请输入有效的邮箱')
        return
      }
    }
    const usernameChars = Array.from(username.trim())
    if (usernameChars.length < 3 || usernameChars.length > 20) {
      setError('用户名须为 3-20 个字符')
      return
    }
    if (password.length < 8) {
      setError('密码至少需要 8 个字符')
      return
    }
    setLoading(true)
    try {
      await register(inviteCode.trim(), emailVal, username.trim(), password)
      setEmail(emailVal)
      setStep(2)
      startResendCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const codeVal = code.trim()
    if (codeVal.length !== 6) {
      setError('请输入 6 位验证码')
      return
    }
    setLoading(true)
    try {
      await verifyEmail(email.trim(), codeVal)
      await bootstrapBackendSession()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendIn > 0 || loading) return
    setError('')
    setLoading(true)
    try {
      await resendVerifyCode(email.trim())
      startResendCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md" data-no-drag-select>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">注册</h2>

        {step === 1 ? (
          <form onSubmit={handleRegister} className="mt-5 space-y-4">
            {inviteEnabled && (
              <div>
                <Label>邀请码（可选）</Label>
                <Input
                  type="text"
                  placeholder="选填，输入邀请码可获得额外配额"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            {hasSuffixes ? (
              <div>
                <Label>邮箱</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    type="text"
                    placeholder="输入邮箱名"
                    value={emailLocal}
                    onChange={(e) => setEmailLocal(e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={emailSuffix}
                    onChange={(e) => setEmailSuffix(e.target.value)}
                    className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100"
                  >
                    {allowedSuffixes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <Label>邮箱</Label>
                <Input
                  type="email"
                  placeholder="用于接收验证码"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label>用户名</Label>
              <Input
                type="text"
                placeholder="3-20 字符，允许中文"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>密码</Label>
              <Input
                type="password"
                placeholder="至少 8 字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '注册中...' : '立即注册'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-5 space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              验证码已发送至 <b>{email.trim()}</b>，请输入收到的 6 位验证码完成注册。
            </div>
            <div>
              <Label>验证码</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '验证中...' : '完成注册'}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => setStep(1)} className="text-gray-500 hover:underline">
                返回修改
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0 || loading}
                className="text-blue-500 hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                {resendIn > 0 ? `${resendIn}s 后可重发` : '重新发送验证码'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
