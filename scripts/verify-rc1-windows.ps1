. "$PSScriptRoot\rc1-environment.ps1"
$Pnpm = "$env:PNPM_HOME\pnpm.cmd"
$Evidence = Join-Path $DataRoot ('rc1-evidence\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $Evidence | Out-Null
$Results = @()

function Invoke-GateToLog([string]$Gate, [string]$LogPath) {
  $Stdout = "$LogPath.stdout.tmp"
  $Stderr = "$LogPath.stderr.tmp"
  try {
    # Windows PowerShell 5.1 converts native stderr into ErrorRecord objects.
    # With ErrorActionPreference=Stop (set by rc1-environment.ps1), direct *> redirection
    # can terminate verification even when the gate runner itself is behaving normally.
    # Start-Process keeps native stdout/stderr native and lets us decide solely by exit code.
    $Process = Start-Process -FilePath $Pnpm -ArgumentList @($Gate) -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr

    $Combined = @()
    if (Test-Path $Stdout) { $Combined += Get-Content $Stdout }
    if (Test-Path $Stderr) { $Combined += Get-Content $Stderr }
    $Combined | Set-Content $LogPath

    return $Process.ExitCode
  } finally {
    Remove-Item $Stdout,$Stderr -Force -ErrorAction SilentlyContinue
  }
}

foreach ($Gate in @('validate:f-drive','lint','typecheck','test:unit','test:integration','test:security','test:rc1-windows-scripts','build','test:e2e','package:win')) {
  $LogPath = Join-Path $Evidence ($Gate.Replace(':','-') + '.log')
  $Code = Invoke-GateToLog $Gate $LogPath
  $Results += [pscustomobject]@{ gate=$Gate; exitCode=$Code; status=$(if ($Code -eq 0) {'PASS'} else {'FAIL'}) }
  Write-Host "$Gate : $Code"
}
. "$PSScriptRoot\ollama-live-smoke.ps1"
$Results += Invoke-OllamaLiveSmoke -ManifestPath (Join-Path $ProjectRoot 'config\local-models.json') -EvidencePath $Evidence
$Results | ConvertTo-Json | Set-Content (Join-Path $Evidence 'results.json')
Write-Host "Evidencias: $Evidence. OAuth Google real exige consentimento humano; verificar dock. Nao equivale a aceite manual RF-01..15."
if (@($Results | Where-Object exitCode -ne 0).Count -gt 0) { throw 'RC1 gate falhou; consulte results.json e logs.' }
