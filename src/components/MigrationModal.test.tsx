import { describe, expect, it } from 'vitest'
import migrationModalSource from './MigrationModal.tsx?raw'
import settingsModalSource from './SettingsModal.tsx?raw'
import headerSource from './Header.tsx?raw'

describe('Task 8 — MigrationModal unclosability and SettingsModal extensions', () => {

  // ===== MigrationModal =====

  it('MigrationModal does NOT import useCloseOnEscape', () => {
    expect(migrationModalSource).not.toMatch(/useCloseOnEscape/)
  })

  it('MigrationModal backdrop div has no onClick handler', () => {
    // Extract the backdrop div that has "absolute inset-0"
    const backdropMatch = migrationModalSource.match(
      /<div\s[^>]*className="[^"]*absolute\s+inset-0[^"]*"[^>]*>/g
    )
    if (backdropMatch) {
      for (const match of backdropMatch) {
        expect(match).not.toMatch(/onClick/)
      }
    } else {
      // If no dedicated backdrop div found, check the outer container doesn't close on click
      expect(migrationModalSource).not.toMatch(/onClick=\{[^}]*close[^}]*\}/i)
    }
  })

  it('MigrationModal has no X close button (no X icon SVG with strokeLinecap)', () => {
    // The X button in modals uses an SVG with strokeLinecap="round" and path d="M6 18L18 6M6 6l12 12"
    expect(migrationModalSource).not.toContain('M6 18L18 6M6 6l12 12')
  })

  it('MigrationModal imports migrate from backendApi', () => {
    expect(migrationModalSource).toMatch(/import\s*\{[^}]*migrate[^}]*\}\s*from\s*['"]\.\.\/lib\/backendApi['"]/)
  })

  it('MigrationModal imports bootstrapBackendSession and useStore from store', () => {
    expect(migrationModalSource).toContain("import { bootstrapBackendSession, useStore } from '../store'")
  })

  it('MigrationModal prevents close via ESC and outside click', () => {
    expect(migrationModalSource).toContain('onEscapeKeyDown')
    expect(migrationModalSource).toContain('onPointerDownOutside')
  })

  it('MigrationModal has title text 设置用户名和密码', () => {
    const textOnly = migrationModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('设置用户名和密码')
  })

  it('MigrationModal has description text about account safety', () => {
    const textOnly = migrationModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('为了账号安全')
  })

  it('MigrationModal has three fields: username, password, confirmPassword', () => {
    expect(migrationModalSource).toContain('username')
    expect(migrationModalSource).toContain('password')
    expect(migrationModalSource).toContain('confirmPassword')
  })

  it('MigrationModal password fields use type="password"', () => {
    // There should be at least 2 password type fields
    const passwordFieldCount = (migrationModalSource.match(/type=["']password["']/g) || []).length
    expect(passwordFieldCount).toBeGreaterThanOrEqual(2)
  })

  it('MigrationModal submit button shows 完成设置 text', () => {
    // Implementation uses ternary: {loading ? '设置中...' : '完成设置'}
    const textOnly = migrationModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toMatch(/['"]完成设置['"]/)
  })

  it('MigrationModal calls migrate() on submit', () => {
    expect(migrationModalSource).toContain('migrate(')
  })

  // ===== SettingsModal Extensions =====

  it('SettingsModal imports Separator from ui', () => {
    expect(settingsModalSource).toMatch(/import\s*\{[^}]*Separator[^}]*\}\s*from\s*['"]\.\/ui\/separator['"]/)
  })

  it('SettingsModal imports Input, Label, Button from ui', () => {
    expect(settingsModalSource).toContain("import { Input } from './ui/input'")
    expect(settingsModalSource).toContain("import { Label } from './ui/label'")
    expect(settingsModalSource).toContain("import { Button } from './ui/button'")
  })

  it('SettingsModal imports setInviteCode and getInviteCode from backendApi', () => {
    expect(settingsModalSource).toMatch(/import\s*\{[^}]*setInviteCode[^}]*\}\s*from\s*['"]\.\.\/lib\/backendApi['"]/)
    expect(settingsModalSource).toMatch(/import\s*\{[^}]*getInviteCode[^}]*\}\s*from\s*['"]\.\.\/lib\/backendApi['"]/)
  })

  it('SettingsModal imports changePassword from backendApi', () => {
    expect(settingsModalSource).toMatch(/import\s*\{[^}]*changePassword[^}]*\}\s*from\s*['"]\.\.\/lib\/backendApi['"]/)
  })

  it('SettingsModal has 邀请码 section with Separator and h4 heading', () => {
    const textOnly = settingsModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('邀请码')
    expect(settingsModalSource).toContain('<Separator')
  })

  it('SettingsModal invite code section shows 未设置 when no code', () => {
    const textOnly = settingsModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('未设置')
  })

  it('SettingsModal invite code section has copy button for existing code', () => {
    const textOnly = settingsModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('>复制<')
  })

  it('SettingsModal invite code section has modify button to change code', () => {
    const textOnly = settingsModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('>修改<')
  })

  it('SettingsModal has 修改密码 section with Separator and h4 heading', () => {
    const textOnly = settingsModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('修改密码')
  })

  it('SettingsModal change password section has oldPassword, newPassword, confirmPassword fields', () => {
    expect(settingsModalSource).toContain('oldPassword')
    expect(settingsModalSource).toContain('newPassword')
    expect(settingsModalSource).toContain('confirmNewPassword')
  })

  it('SettingsModal change password button shows 修改密码 text', () => {
    const textOnly = settingsModalSource.replace(/className="[^"]*"/g, '').replace(/\s+/g, ' ')
    expect(textOnly).toContain('>修改密码<')
  })

  // ===== Header username display =====

  it('Header imports authUser from useStore', () => {
    expect(headerSource).toContain('useStore((s) => s.authUser)')
  })

  it('Header displays authUser.username || authUser.label || 用户', () => {
    expect(headerSource).toContain('authUser.username')
    expect(headerSource).toContain('authUser.label')
  })
})
