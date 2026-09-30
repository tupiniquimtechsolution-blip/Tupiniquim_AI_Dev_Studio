export interface WorkspaceBackupConfig {
  WEB_WORKSPACE_BACKUP_ENABLED?: string
}

export const WORKSPACE_BACKUP_STATE_KEY = 'workspace-backup:latest' as const
export const WORKSPACE_BACKUP_TTL_SECONDS = 7 * 24 * 60 * 60
export const WORKSPACE_RESTORE_MARKER = '/tmp/tupiniquim-workspace-restored' as const

export type WorkspaceBackupReadiness =
  | { state: 'DISABLED'; configured: false; missing: ['WEB_WORKSPACE_BACKUP_ENABLED'] }
  | { state: 'READY'; configured: true; missing: [] }

export const workspaceBackupReadiness = (env: WorkspaceBackupConfig): WorkspaceBackupReadiness =>
  env.WEB_WORKSPACE_BACKUP_ENABLED === 'true'
    ? { state: 'READY', configured: true, missing: [] }
    : { state: 'DISABLED', configured: false, missing: ['WEB_WORKSPACE_BACKUP_ENABLED'] }

export const workspaceBackupName = (workspaceId: string): string =>
  `workspace-${workspaceId}-latest`
