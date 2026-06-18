import { useState } from 'react'
import { migrate, getMe } from '../lib/backendApi'
import { bootstrapBackendSession, useStore } from '../store'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

export default function MigrationModal() {
  const authUser = useStore((s) => s.authUser)
  const showToast = useStore((s) => s.showToast)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!authUser?.needsMigration) return null

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
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      await migrate(username.trim(), password, confirmPassword)
      // Refresh user data to clear needsMigration
      const { user } = await getMe()
      useStore.getState().setAuthUser(user)
      showToast('设置成功', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open modal onOpenChange={() => { /* intentionally no-op */ }}>
      <DialogContent className="max-w-md" data-no-drag-select hideClose
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          设置用户名和密码
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          为了账号安全，请设置用户名和密码。设置完成后即可正常使用。
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
          <div>
            <Label>确认密码</Label>
            <Input
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '设置中...' : '完成设置'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
