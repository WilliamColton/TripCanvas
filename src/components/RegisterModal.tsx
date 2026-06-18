import { useState } from 'react'
import { register } from '../lib/backendApi'
import { bootstrapBackendSession, useStore } from '../store'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

interface RegisterModalProps {
  onClose: () => void
}

export default function RegisterModal({ onClose }: RegisterModalProps) {
  const inviteEnabled = useStore((s) => s.settings.inviteEnabled)
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

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
      await register(inviteCode.trim(), username.trim(), password)
      await bootstrapBackendSession()
      onClose()
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
      </DialogContent>
    </Dialog>
  )
}
