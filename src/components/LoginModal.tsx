import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  LockKeyhole,
  User,
  Zap,
} from 'lucide-react'
import { loginWithCode, loginWithPassword } from '../lib/backendApi'
import { bootstrapBackendSession, useStore } from '../store'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import RegisterModal from './RegisterModal'
import './LoginModal.css'

function TemplateMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="8" height="8" rx="4" fill="currentColor" />
      <rect x="16" y="4" width="8" height="8" rx="4" fill="currentColor" />
      <rect x="4" y="16" width="8" height="8" rx="4" fill="currentColor" />
      <rect x="16" y="16" width="8" height="8" rx="4" fill="currentColor" />
    </svg>
  )
}

const sellingPoints = [
  {
    icon: TemplateMark,
    title: '板式推荐',
    subtitle: '智能板式',
    detail: '满足各类景点需求',
  },
  {
    icon: BriefcaseBusiness,
    title: '量身定制',
    subtitle: '量身定制',
    detail: '打造专属体验',
  },
  {
    icon: Zap,
    title: '效率至上',
    subtitle: '快速响应',
    detail: '3分钟急速出图',
  },
  {
    icon: Clock3,
    title: '全时响应',
    subtitle: '7*24h服务',
    detail: '全程无忧出图',
  },
]

const bottomFeatures = [
  ['灵活无忧', '随心修改 ● 个性定制'],
  ['优质服务', '高效迅速 ● 快速响应'],
  ['用户至上', '用心服务 ● 超越期待'],
  ['品质无忧', '全图定制 ● 版权无忧'],
]

export default function LoginModal() {
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('login-screen-active')
    document.body.classList.add('login-screen-active')
    return () => {
      document.documentElement.classList.remove('login-screen-active')
      document.body.classList.remove('login-screen-active')
    }
  }, [])

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginWithCode(code)
      await bootstrapBackendSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const normalizedUsername = username.trim()
      await loginWithPassword(normalizedUsername, pass)
      await bootstrapBackendSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="login-page">
        <div className="login-shell">
          <header className="login-brand">
            <div className="login-logo-box" aria-label="精品旅图 logo">
              <img src="/tripcanvas-icon.png" alt="" />
            </div>
            <div>
              <div className="login-brand-name">精品旅图</div>
              <div className="login-brand-slogan">AI 旅图生成</div>
            </div>
          </header>

          <main className="login-main">
            <div className="login-left">
              <div className="login-badge">智能旅图新体验</div>
              <h1 className="login-hero-title">我更懂你·旅图更精彩</h1>
              <div className="login-hero-tags">板式推荐&nbsp;&nbsp;|&nbsp;&nbsp;量身定制&nbsp;&nbsp;|&nbsp;&nbsp;效率至上&nbsp;&nbsp;|&nbsp;&nbsp;7*24h响应</div>
              <div className="login-hero-desc">
                基于旅游行业，为每个产品量身定制专属出图方案
                <br />
                让您的每一个产品，都能更出彩
              </div>

              <div className="login-selling-list">
                {sellingPoints.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="login-selling-card">
                      <div className="login-selling-symbol" aria-hidden="true">
                        <Icon />
                      </div>
                      <div className="login-selling-title">{item.title}</div>
                      <div className="login-selling-subtitle">{item.subtitle}</div>
                      <div className="login-selling-detail">{item.detail}</div>
                    </div>
                  )
                })}
              </div>

              <div className="login-helper-card">
                <div>
                  <div className="login-helper-title">Hi，我是你的旅图助手</div>
                  <div className="login-helper-desc">告诉我你的喜好风格，为您规划完美旅图</div>
                </div>
                <button type="button" className="login-helper-button">
                  开始绘图
                  <ArrowRight />
                </button>
              </div>
            </div>

            <div className="login-card">
              <h2 className="login-card-title">欢迎登陆</h2>
              <p className="login-card-subtitle">登陆xxx直营，开启智能旅图新体验</p>

              <Tabs defaultValue="password" className="login-tabs">
                <TabsList className="login-tab-list">
                  <TabsTrigger value="password" className="login-tab-trigger">
                    账号登陆
                  </TabsTrigger>
                  <TabsTrigger value="code" className="login-tab-trigger">
                    兑换码
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="password" className="login-tab-content">
                  <form onSubmit={handlePasswordLogin} className="login-form">
                    <Label className="sr-only">用户名</Label>
                    <div className="login-field login-field-account">
                      <User className="login-field-icon" />
                      <Input
                        type="text"
                        placeholder="请输入账号/邮箱"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoFocus
                        className="login-form-input"
                      />
                    </div>
                    <Label className="sr-only">密码</Label>
                    <div className="login-field login-field-password">
                      <LockKeyhole className="login-field-icon" />
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        className="login-form-input"
                      />
                    </div>
                    {error && <div className="login-error">{error}</div>}
                    <Button
                      type="submit"
                      disabled={loading || !username.trim() || !pass.trim()}
                      className="login-submit"
                    >
                      {loading ? '登陆中...' : '登陆'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="code" className="login-tab-content">
                  <form onSubmit={handleCodeSubmit} className="login-form">
                    <Label className="sr-only">兑换码</Label>
                    <div className="login-field login-field-account">
                      <BadgeCheck className="login-field-icon" />
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        type="text"
                        placeholder="请输入兑换码"
                        className="login-form-input"
                      />
                    </div>
                    {error && <div className="login-error">{error}</div>}
                    <Button
                      type="submit"
                      disabled={loading || !code.trim()}
                      className="login-submit"
                    >
                      {loading ? '登陆中...' : '登录 / 注册'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="login-contact-divider">
                <span />
                <b>客服联系方式</b>
                <span />
              </div>

              <div className="login-register-line">
                还没有账号？{' '}
                <button type="button" onClick={() => setShowRegister(true)}>
                  立即注册
                </button>
              </div>
            </div>
          </main>

          <svg
            className="login-bottom-wave"
            viewBox="0 0 1920 1080"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M 0 960 C 0 960 84 916.5 184 914 C 284 911.5 547.5 942 591 946 C 634.5 950 930.5 960 1000.5 956 C 1070.5 952 1539 939 1600 943 C 1661 947 1750 955 1811 977 C 1872 999 1920 1030.5 1920 1030.5 L 1920 1080 L 0 1080.5 L 0 960 Z" />
          </svg>

          <div className="login-bottom-list">
            {bottomFeatures.map(([title, description]) => (
              <div key={title} className="login-bottom-item">
                <div className="login-bottom-check">√</div>
                <div>
                  <div className="login-bottom-title">{title}</div>
                  <div className="login-bottom-desc">{description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
    </>
  )
}
