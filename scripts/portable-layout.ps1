function Get-TupiniquimPortableLayout {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
  )

  $FullProjectRoot = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
  $Pattern = '^(?<drive>[A-Za-z]:)\\CODEX\\Tupiniquim-AI-Dev-Studio$'
  if ($FullProjectRoot -notmatch $Pattern) {
    throw "REQUIRES_PORTABLE_LAYOUT: clone esperado em <DRIVE>:\CODEX\Tupiniquim-AI-Dev-Studio. Caminho atual: $FullProjectRoot"
  }

  $Drive = $Matches['drive'].ToUpperInvariant()
  $DriveRoot = "$Drive\"
  $CodexRoot = Join-Path $DriveRoot 'CODEX'
  $ProgramsRoot = Join-Path $CodexRoot 'programas'
  $DataRoot = Join-Path $CodexRoot 'Tupiniquim-AI-Dev-Studio.data'
  $CacheRoot = Join-Path $DataRoot 'cache'

  [pscustomobject]@{
    ProjectRoot = $FullProjectRoot
    DriveName = $Drive.TrimEnd(':')
    DriveRoot = $DriveRoot
    CodexRoot = $CodexRoot
    ProgramsRoot = $ProgramsRoot
    DataRoot = $DataRoot
    CacheRoot = $CacheRoot
    TempRoot = Join-Path $DataRoot 'tmp'
    NodeRoot = Join-Path $ProgramsRoot 'nodejs'
    PnpmRoot = Join-Path $ProgramsRoot 'pnpm'
    PnpmStoreRoot = Join-Path $CodexRoot '.pnpm-store'
  }
}
