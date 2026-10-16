import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_BACKUP_STATE_KEY,
  WORKSPACE_BACKUP_TTL_SECONDS,
  WORKSPACE_RESTORE_MARKER,
  workspaceBackupName,
  workspaceBackupReadiness
} from '../../apps/web-runtime/src/workspace-backup'

describe('Web workspace local backup configuration', () => {
  it('fica fail-closed quando o checkpoint local não foi habilitado explicitamente', () => {
    expect(workspaceBackupReadiness({})).toEqual({
      state: 'DISABLED',
      configured: false,
      missing: ['WEB_WORKSPACE_BACKUP_ENABLED']
    })
  })

  it('fica READY sem credenciais R2 quando o backup local do Remote Runtime está habilitado', () => {
    expect(workspaceBackupReadiness({
      WEB_WORKSPACE_BACKUP_ENABLED: 'true'
    })).toEqual({ state: 'READY', configured: true, missing: [] })
  })

  it('não trata valores diferentes de true como configuração válida', () => {
    expect(workspaceBackupReadiness({
      WEB_WORKSPACE_BACKUP_ENABLED: 'false'
    })).toEqual({
      state: 'DISABLED',
      configured: false,
      missing: ['WEB_WORKSPACE_BACKUP_ENABLED']
    })
  })

  it('mantém nomes/TTL/marker determinísticos e isolados por workspace', () => {
    expect(workspaceBackupName('workspace-a')).toBe('workspace-workspace-a-latest')
    expect(workspaceBackupName('workspace-b')).not.toBe(workspaceBackupName('workspace-a'))
    expect(WORKSPACE_BACKUP_STATE_KEY).toBe('workspace-backup:latest')
    expect(WORKSPACE_BACKUP_TTL_SECONDS).toBe(604800)
    expect(WORKSPACE_RESTORE_MARKER).toBe('/tmp/tupiniquim-workspace-restored')
  })
})
