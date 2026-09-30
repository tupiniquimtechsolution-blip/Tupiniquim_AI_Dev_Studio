$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\scripts\portable-layout.ps1"

function Assert-True($Value, [string]$Message) {
  if (-not $Value) { throw $Message }
}

foreach ($Drive in @('D:','F:','Z:')) {
  $Project = "$Drive\CODEX\Tupiniquim-AI-Dev-Studio"
  $Layout = Get-TupiniquimPortableLayout -ProjectRoot $Project
  Assert-True ($Layout.ProjectRoot -ieq $Project) "project root mismatch for $Drive"
  Assert-True ($Layout.DriveName -ieq $Drive.TrimEnd(':')) "drive name mismatch for $Drive"
  Assert-True ($Layout.DriveRoot -ieq "$Drive\") "drive root mismatch for $Drive"
  Assert-True ($Layout.CodexRoot -ieq "$Drive\CODEX") "CODEX root mismatch for $Drive"
  Assert-True ($Layout.DataRoot -ieq "$Drive\CODEX\Tupiniquim-AI-Dev-Studio.data") "data root mismatch for $Drive"
  Assert-True ($Layout.PnpmStoreRoot -ieq "$Drive\CODEX\.pnpm-store") "pnpm store mismatch for $Drive"
}

$Rejected = $false
try {
  Get-TupiniquimPortableLayout -ProjectRoot 'C:\Users\example\Tupiniquim-AI-Dev-Studio' | Out-Null
} catch {
  $Rejected = $true
}
Assert-True $Rejected 'layout outside <DRIVE>:\CODEX must fail closed'

Write-Host 'PASS portable layout fixtures: drive letter is dynamic and CODEX confinement is preserved.'
