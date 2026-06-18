import { useState } from 'react'
import { useStore } from '../store'
import type { ThemeMode } from '../types'
import { adminLogin } from './adminApi'
import Select from '../components/Select'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

interface Props {
  onLogin: () => void
}

export default function AdminLogin({ onLogin }: Props) {
  const [apikey, setApikey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
  ]

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await adminLogin(apikey)
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-gray-200/60 bg-white/95 p-6 shadow-2xl dark:border-white/[0.08] dark:bg-gray-900/95">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">管理后台登录</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              请输入管理员密钥以访问管理后台。
            </p>
          </div>
          <Select
            value={settings.theme}
            onChange={(value) => setSettings({ theme: value as ThemeMode })}
            options={themeOptions}
            className="h-9 w-28"
          />
        </div>
        <Input
          value={apikey}
          onChange={(e) => setApikey(e.target.value)}
          type="password"
          autoFocus
          placeholder="请输入管理员密钥"
          className="mt-5 w-full"
        />
        {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
        <Button
          type="submit"
          disabled={loading || !apikey.trim()}
          className="mt-5 w-full"
        >
          {loading ? '登录中...' : '登录'}
        </Button>
        <a href="/" className="mt-3 block text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          返回首页
        </a>
      </form>
    </div>
  )
}
