export interface WorkspaceBackupConfig {
  WEB_WORKSPACE_BACKUP_ENABLED?: string
  BACKUP_BUCKET_NAME?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
}

export const WORKSPACE_BACKUP_STATE_KEY = 'workspace-backup:latest' as const
export const WORKSPACE_BACKUP_TTL_SECONDS = 7 * 24 * 60 * 60
export const WORKSPACE_RESTORE_MARKER = '/tmp/tupiniquim-workspace-restored' as const

export type WorkspaceBackupReadiness =
  | { state: 'DISABLED'; configured: false; missing: string[] }
  | { state: 'READY'; configured: true; missing: [] }

export const workspaceBackupReadiness = (env: WorkspaceBackupConfig): WorkspaceBackupReadiness => {
  if (env.WEB_WORKSPACE_BACKUP_ENABLED !== 'true') {
    return { state: 'DISABLED', configured: false, missing: ['WEB_WORKSPACE_BACKUP_ENABLED'] }
  }

  const required: Array<keyof WorkspaceBackupConfig> = [
    'BACKUP_BUCKET_NAME',
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY'
  ]
  const missing = required.filter((key) => typeof env[key] !== 'string' || env[key]?.trim() === '').map(String)
  return missing.length === 0
    ? { state: 'READY', configured: true, missing: [] }
    : { state: 'DISABLED', configured: false, missing }
}

export const workspaceBackupName = (workspaceId: string): string =>
  `workspace-${workspaceId}-latest`
