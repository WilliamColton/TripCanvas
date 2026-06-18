import { useEffect, useState } from 'react'
import { ImageIcon, LogOut, PieChart, Settings, X } from 'lucide-react'
import { useStore, logout } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { redeemCode, getMe, setInviteCode as apiSetInviteCode, getInviteCode, getInvitedUsers, changePassword, changeUsername, type InvitedUser } from '../lib/backendApi'
import { Separator } from './ui/separator'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export default function SettingsModal() {
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const authUser = useStore((s) => s.authUser)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)
  const inviteEnabled = useStore((s) => s.settings.inviteEnabled)

  const [redeemValue, setRedeemValue] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemError, setRedeemError] = useState('')
  const [redeemSuccess, setRedeemSuccess] = useState('')

  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [showModifyInvite, setShowModifyInvite] = useState(false)
  const [newInviteCode, setNewInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([])

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  const [newUsername, setNewUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState('')

  useEffect(() => {
    if (showSettings) {
      getInviteCode()
        .then((res) => {
          setInviteCode(res.code)
          if (res.code) {
            getInvitedUsers().then((r) => setInvitedUsers(r.invitedUsers))
          } else {
            setInvitedUsers([])
          }
        })
        .catch(() => setInviteCode(null))
    }
  }, [showSettings])

  const handleClose = () => setShowSettings(false)
  useCloseOnEscape(showSettings, handleClose)

  const handleRedeem = async () => {
    if (!redeemValue.trim()) return
    setRedeemLoading(true)
    setRedeemError('')
    setRedeemSuccess('')
    try {
      await redeemCode(redeemValue.trim())
      setRedeemSuccess('兑换成功')
      setRedeemValue('')
      const { user } = await getMe()
      useStore.getState().setAuthUser(user)
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : String(err))
    } finally {
      setRedeemLoading(false)
    }
  }

  const handleCopyInvite = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      showToast('已复制', 'success')
    }
  }

  const handleSaveInvite = async () => {
    if (!newInviteCode.trim()) return
    setInviteError('')
    setInviteSuccess('')
    try {
      await apiSetInviteCode(newInviteCode.trim())
      setInviteCode(newInviteCode.trim())
      setShowModifyInvite(false)
      setNewInviteCode('')
      getInvitedUsers().then((r) => setInvitedUsers(r.invitedUsers))
      showToast('邀请码已更新', 'success')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    setPwSuccess('')
    if (newPassword.length < 8) {
      setPwError('密码至少需要 8 个字符')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPwError('两次输入的密码不一致')
      return
    }
    setPwLoading(true)
    try {
      await changePassword(oldPassword, newPassword, confirmNewPassword)
      setPwSuccess('密码已修改')
      setOldPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      showToast('密码已修改', 'success')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : String(err))
    } finally {
      setPwLoading(false)
    }
  }

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) return
    setUsernameError('')
    setUsernameSuccess('')
    setUsernameLoading(true)
    try {
      await changeUsername(newUsername.trim())
      setUsernameSuccess('用户名已修改')
      setNewUsername('')
      const { user } = await getMe()
      useStore.getState().setAuthUser(user)
      showToast('用户名已修改', 'success')
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : String(err))
    } finally {
      setUsernameLoading(false)
    }
  }

  if (!showSettings) return null

  const quotaDisplay = authUser
    ? authUser.unlimitedQuota
      ? `${authUser.usedCount} / 无限制`
      : `${authUser.usedCount} / ${authUser.quota}`
    : ''

  return (
    <Dialog open={showSettings} onOpenChange={(open) => { if (!open) setShowSettings(false) }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar" data-no-drag-select hideClose>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            设置
          </h3>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Tabs defaultValue="account" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex-1">账户</TabsTrigger>
            <TabsTrigger value="security" className="flex-1">安全</TabsTrigger>
            {inviteEnabled && <TabsTrigger value="invite" className="flex-1">邀请</TabsTrigger>}
          </TabsList>

          <TabsContent value="account" className="space-y-5 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200/70 bg-gray-50/70 p-4 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
                <ImageIcon className="w-5 h-5 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{authUser?.imageCount ?? 0}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">已生成</div>
              </div>
              <div className="rounded-2xl border border-gray-200/70 bg-gray-50/70 p-4 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
                <PieChart className="w-5 h-5 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {authUser?.unlimitedQuota ? '无限制' : authUser?.quota ?? '-'}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">配额</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">兑换码</h4>
              <div className="flex gap-2">
                <Input
                  value={redeemValue}
                  onChange={(e) => setRedeemValue(e.target.value)}
                  placeholder="输入兑换码增加配额"
                />
                <Button onClick={handleRedeem} disabled={!redeemValue.trim() || redeemLoading}>
                  {redeemLoading ? '兑换中...' : '兑换'}
                </Button>
              </div>
              {redeemError && <div className="text-sm text-red-500 dark:text-red-400">{redeemError}</div>}
              {redeemSuccess && <div className="text-sm text-green-600 dark:text-green-400">{redeemSuccess}</div>}
            </div>

            <Separator />

            <div className="pt-1">
              <Button
                variant="outline"
                className="w-full border-red-200/80 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
                onClick={() =>
                  setConfirmDialog({
                    title: '退出登录',
                    message: '确定要退出登录吗？',
                    action: () => logout(),
                  })
                }
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-0">
            {authUser?.needsMigration === false && (
              <>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">修改用户名</h4>
                <div className="flex gap-2">
                  <Input type="text" placeholder={authUser?.username || '输入新用户名'} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                  <Button onClick={handleChangeUsername} disabled={!newUsername.trim() || usernameLoading}>
                    {usernameLoading ? '修改中...' : '确认'}
                  </Button>
                </div>
                {usernameError && <div className="text-sm text-red-500 dark:text-red-400">{usernameError}</div>}
                {usernameSuccess && <div className="text-sm text-green-600 dark:text-green-400">{usernameSuccess}</div>}
                <Separator />
              </>
            )}
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">修改密码</h4>
            <div className="space-y-3">
              <Input type="password" placeholder="输入旧密码" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
              <Input type="password" placeholder="输入新密码，至少 8 个字符" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Input type="password" placeholder="再次输入新密码" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
            </div>
            <Button onClick={handleChangePassword} disabled={pwLoading} className="w-full">
              {pwLoading ? '修改中...' : '修改密码'}
            </Button>
            {pwError && <div className="text-sm text-red-500 dark:text-red-400">{pwError}</div>}
            {pwSuccess && <div className="text-sm text-green-600 dark:text-green-400">{pwSuccess}</div>}
          </TabsContent>

          <TabsContent value="invite" className="space-y-4 mt-0">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">邀请码</Label>
            {inviteCode ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-white/50 dark:bg-white/[0.04] px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] truncate">{inviteCode}</code>
                <Button variant="outline" size="sm" onClick={handleCopyInvite}>复制</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowModifyInvite(true)}>修改</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-gray-400 dark:text-gray-500">未设置</div>
                <div className="flex gap-2">
                  <Input type="text" placeholder="输入你的邀请码" value={newInviteCode} onChange={(e) => setNewInviteCode(e.target.value)} />
                  <Button variant="default" size="sm" onClick={handleSaveInvite} disabled={!newInviteCode.trim()}>确认</Button>
                </div>
              </div>
            )}
            {showModifyInvite && (
              <div className="flex gap-2">
                <Input type="text" placeholder="输入新的邀请码" value={newInviteCode} onChange={(e) => setNewInviteCode(e.target.value)} />
                <Button variant="default" size="sm" onClick={handleSaveInvite}>确认</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowModifyInvite(false)}>取消</Button>
              </div>
            )}
            {inviteCode && invitedUsers.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">被邀请用户</h4>
                <div className="rounded-xl border border-gray-200/70 dark:border-white/[0.08] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200/70 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
                        <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">用户名</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">注册时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitedUsers.map((u, i) => (
                        <tr key={i} className="border-b border-gray-100/70 dark:border-white/[0.04] last:border-0">
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{u.username || u.label}</td>
                          <td className="px-3 py-2 text-right text-gray-400 dark:text-gray-500">{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {inviteError && <div className="text-sm text-red-500 dark:text-red-400">{inviteError}</div>}
            {inviteSuccess && <div className="text-sm text-green-600 dark:text-green-400">{inviteSuccess}</div>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
