import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_BACKUP_STATE_KEY,
  WORKSPACE_BACKUP_TTL_SECONDS,
  WORKSPACE_RESTORE_MARKER,
  workspaceBackupName,
  workspaceBackupReadiness
} from '../../apps/web-runtime/src/workspace-backup'

describe('Web workspace backup configuration', () => {
  it('fica fail-closed quando o backup não foi habilitado explicitamente', () => {
    expect(workspaceBackupReadiness({})).toEqual({
      state: 'DISABLED',
      configured: false,
      missing: ['WEB_WORKSPACE_BACKUP_ENABLED']
    })
  })

  it('lista configuração/secrets ausentes sem expor valores', () => {
    expect(workspaceBackupReadiness({ WEB_WORKSPACE_BACKUP_ENABLED: 'true' })).toEqual({
      state: 'MISCONFIGURED',
      configured: false,
      missing: ['BACKUP_BUCKET_NAME', 'CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    })
  })

  it('fica READY somente com o conjunto completo de configuração', () => {
    expect(workspaceBackupReadiness({
      WEB_WORKSPACE_BACKUP_ENABLED: 'true',
      BACKUP_BUCKET_NAME: 'tupiniquim-dev-ai-web-workspaces',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'configured',
      R2_SECRET_ACCESS_KEY: 'configured'
    })).toEqual({ state: 'READY', configured: true, missing: [] })
  })

  it('mantém nomes/TTL/marker determinísticos e isolados por workspace', () => {
    expect(workspaceBackupName('workspace-a')).toBe('workspace-workspace-a-latest')
    expect(workspaceBackupName('workspace-b')).not.toBe(workspaceBackupName('workspace-a'))
    expect(WORKSPACE_BACKUP_STATE_KEY).toBe('workspace-backup:latest')
    expect(WORKSPACE_BACKUP_TTL_SECONDS).toBe(604800)
    expect(WORKSPACE_RESTORE_MARKER).toBe('/tmp/tupiniquim-workspace-restored')
  })
})
