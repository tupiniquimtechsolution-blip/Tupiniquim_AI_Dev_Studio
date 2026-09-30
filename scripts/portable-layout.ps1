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
  # Use System.IO path composition here instead of Join-Path. Join-Path resolves
  # PowerShell drives and would reject synthetic drive letters used by portability fixtures.
  $CodexRoot = [IO.Path]::Combine($DriveRoot, 'CODEX')
  $ProgramsRoot = [IO.Path]::Combine($CodexRoot, 'programas')
  $DataRoot = [IO.Path]::Combine($CodexRoot, 'Tupiniquim-AI-Dev-Studio.data')
  $CacheRoot = [IO.Path]::Combine($DataRoot, 'cache')

  [pscustomobject]@{
    ProjectRoot = $FullProjectRoot
    DriveName = $Drive.TrimEnd(':')
    DriveRoot = $DriveRoot
    CodexRoot = $CodexRoot
    ProgramsRoot = $ProgramsRoot
    DataRoot = $DataRoot
    CacheRoot = $CacheRoot
    TempRoot = [IO.Path]::Combine($DataRoot, 'tmp')
    NodeRoot = [IO.Path]::Combine($ProgramsRoot, 'nodejs')
    PnpmRoot = [IO.Path]::Combine($ProgramsRoot, 'pnpm')
    PnpmStoreRoot = [IO.Path]::Combine($CodexRoot, '.pnpm-store')
  }
}
