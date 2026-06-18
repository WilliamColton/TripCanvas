import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'

describe('Task 6 — MigrationModal conditional rendering in App.tsx', () => {

  it('imports MigrationModal component', () => {
    expect(appSource).toContain("import MigrationModal from './components/MigrationModal'")
  })

  it('renders MigrationModal when authUser.needsMigration is true', () => {
    expect(appSource).toContain('authUser?.needsMigration')
    // The check that MigrationModal is rendered when needsMigration is true
    // — the exact JSX expression pattern
    expect(appSource.match(/\{authUser\?\.needsMigration\s*&&\s*<MigrationModal/)).toBeTruthy()
  })

  it('renders LoginModal when authUser is falsy (existing behavior)', () => {
    expect(appSource).toContain('{!authUser && <LoginModal />}')
  })
})
