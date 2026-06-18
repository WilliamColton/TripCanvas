import { describe, expect, it } from 'vitest'
import registerModalSource from './RegisterModal.tsx?raw'

describe('Task 11 — RegisterModal component', () => {

  it('RegisterModal.tsx file exists and is a React component', () => {
    expect(registerModalSource).toContain('export default function RegisterModal')
  })

  it('imports register, bootstrapBackendSession, useStore', () => {
    expect(registerModalSource).toContain("import { register } from '../lib/backendApi'")
    expect(registerModalSource).toContain("import { bootstrapBackendSession, useStore } from '../store'")
  })

  it('imports Input, Label, Button from ui', () => {
    expect(registerModalSource).toContain("import { Input } from './ui/input'")
    expect(registerModalSource).toContain("import { Label } from './ui/label'")
    expect(registerModalSource).toContain("import { Button } from './ui/button'")
  })

  it('has three fields: inviteCode, username, password', () => {
    expect(registerModalSource).toContain('inviteCode')
    expect(registerModalSource).toContain('username')
    expect(registerModalSource).toContain('password')
  })

  it('invite code field has placeholder 选填，输入邀请码可获得额外配额', () => {
    const textContent = registerModalSource.replace(/className="[^"]*"/g, '')
    expect(textContent).toContain('选填，输入邀请码可获得额外配额')
  })

  it('username field has placeholder 3-20 字符，允许中文', () => {
    const textContent = registerModalSource.replace(/className="[^"]*"/g, '')
    expect(textContent).toContain('3-20 字符，允许中文')
  })

  it('password field has placeholder 至少 8 字符', () => {
    const textContent = registerModalSource.replace(/className="[^"]*"/g, '')
    expect(textContent).toContain('至少 8 字符')
  })

  it('password field uses type="password"', () => {
    expect(registerModalSource).toMatch(/type=["']password["']/)
  })

  it('calls register() on form submit', () => {
    expect(registerModalSource).toContain('register(')
  })

  it('calls bootstrapBackendSession after successful register', () => {
    expect(registerModalSource).toContain('bootstrapBackendSession')
  })

  it('has frontend validation for username 3-20 characters using Array.from', () => {
    expect(registerModalSource).toMatch(/Array\.from/)
  })

  it('has password length validation (>= 8 chars)', () => {
    expect(registerModalSource).toContain('密码至少需要 8 个字符')
  })

  it('uses Dialog component from shadcn', () => {
    expect(registerModalSource).toContain('Dialog open onOpenChange')
  })

  it('submit button shows 注册 text', () => {
    const textContent = registerModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textContent).toContain('>注册<')
  })

  it('shows loading state on submit button', () => {
    const textContent = registerModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textContent).toContain('注册中')
  })

  it('displays error message in red container', () => {
    expect(registerModalSource).toContain('text-red-500')
  })

  it('closes via onOpenChange callback', () => {
    expect(registerModalSource).toContain('onOpenChange')
  })

  it('calls onClose after successful registration', () => {
    expect(registerModalSource).toContain('onClose()')
  })
})
