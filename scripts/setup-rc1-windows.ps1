param([switch]$IncludeRecommended, [switch]$IncludeOptional, [switch]$AcceptDownloads)
. "$PSScriptRoot\rc1-environment.ps1"
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Este bootstrap RC1 suporta Windows x64 (AMD64) apenas.' }
function Confirm-Download([string]$Description) {
  if (-not $AcceptDownloads -and (Read-Host "$Description. Autorizar download? [s/N]") -ine 's') { throw 'Download nao autorizado. Nenhum modelo existente foi removido.' }
}
# Official portable Node distribution, checksum verified before extraction.
$NodeRoot = Join-Path $ProgramsRoot 'nodejs'
if (-not (Test-Path "$NodeRoot\node.exe")) {
  Confirm-Download 'Node.js 24 LTS oficial, aproximadamente 40 MB'
  $Version = 'v24.14.0'
  $Archive = "node-$Version-win-x64.zip"
  $Base = "https://nodejs.org/dist/$Version"
  Invoke-WebRequest "$Base/$Archive" -OutFile "$env:TEMP\$Archive"
  $Sums = (Invoke-WebRequest "$Base/SHASUMS256.txt" -UseBasicParsing).Content
  $Expected = (($Sums -split "`n" | Where-Object { $_.Trim().EndsWith("  $Archive") }) -split '\s+')[0]
  if (-not $Expected -or (Get-FileHash "$env:TEMP\$Archive" -Algorithm SHA256).Hash -ine $Expected) { throw 'Checksum Node invalido.' }
  Expand-Archive "$env:TEMP\$Archive" -DestinationPath $env:TEMP -Force
  New-Item -ItemType Directory -Force $NodeRoot | Out-Null
  Copy-Item "$env:TEMP\node-$Version-win-x64\*" $NodeRoot -Recurse -Force
}
$NodeVersion = (& "$NodeRoot\node.exe" --version).Trim()
if ($LASTEXITCODE -ne 0 -or -not $NodeVersion) { throw 'Falha ao consultar a versao do Node portatil.' }
$Major = [int](($NodeVersion.TrimStart('v') -split '\.')[0])
if ($Major -lt 24) { throw 'Node >=24 necessario em F:\CODEX\programas\nodejs. Runtime existente preservado.' }
if (-not (Test-Path "$env:PNPM_HOME\pnpm.cmd")) {
  Confirm-Download 'pnpm 11.16.0 do registro npm oficial'
  Invoke-Checked "$NodeRoot\npm.cmd" @('install','--global','--prefix',$env:PNPM_HOME,'pnpm@11.16.0')
}
$Pnpm = "$env:PNPM_HOME\pnpm.cmd"
$PnpmVersion = & $Pnpm --version
if ($LASTEXITCODE -ne 0 -or $PnpmVersion -ne '11.16.0') { throw 'pnpm local precisa ser 11.16.0; runtime existente preservado.' }
if ($null -eq (Get-Command git.exe -ErrorAction SilentlyContinue)) {
  Confirm-Download 'MinGit oficial Git for Windows, aproximadamente 50 MB'
  $Release = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'
  $Asset = $Release.assets | Where-Object { $_.name -match '^MinGit-[0-9.]+-64-bit.zip$' } | Select-Object -First 1
  if ($null -eq $Asset) { throw 'Release oficial MinGit nao possui asset Windows x64 esperado.' }
  Invoke-WebRequest $Asset.browser_download_url -OutFile "$env:TEMP\mingit.zip"
  Expand-Archive "$env:TEMP\mingit.zip" -DestinationPath "$ProgramsRoot\git" -Force
}
Invoke-Checked 'git.exe' @('--version')
Invoke-Checked $Pnpm @('install','--frozen-lockfile')
$Ollama = Get-Command ollama.exe -ErrorAction SilentlyContinue
if ($null -eq $Ollama) {
  Confirm-Download 'Ollama oficial portatil Windows AMD64; runtime pode exceder 2 GB'
  $OllamaRoot = Join-Path $ProgramsRoot 'ollama'
  New-Item -ItemType Directory -Force $OllamaRoot | Out-Null
  Invoke-WebRequest 'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip' -OutFile "$env:TEMP\ollama.zip"
  Expand-Archive "$env:TEMP\ollama.zip" -DestinationPath $OllamaRoot -Force
  $Ollama = Get-Command ollama.exe
}
function Get-OllamaTags { Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 }
function Invoke-OllamaPullWithRetry([string]$ModelName, [int]$MaxAttempts = 5) {
  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    & $Ollama.Source pull $ModelName
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -eq 0) { return }

    try {
      $CurrentTags = Get-OllamaTags
      if (@($CurrentTags.models.name) -contains $ModelName) {
        Write-Host "Modelo confirmado apos tentativa ${Attempt}: $ModelName"
        return
      }
    } catch {
      # The service may be momentarily busy after a failed transfer; retry below.
    }

    if ($Attempt -ge $MaxAttempts) {
      throw "$($Ollama.Source) pull $ModelName falhou apos $MaxAttempts tentativas; ultimo codigo $ExitCode. Nenhum modelo existente foi removido."
    }

    $DelaySeconds = [math]::Min(60, $Attempt * 10)
    Write-Warning "Pull de $ModelName falhou na tentativa $Attempt/$MaxAttempts (codigo $ExitCode). Nova tentativa em $DelaySeconds s. O script reutiliza o mesmo store do Ollama e nao apaga blobs/modelos existentes."
    Start-Sleep -Seconds $DelaySeconds
  }
}
try { $Tags = Get-OllamaTags } catch {
  # Do not change model storage for an already-running service. Reuse existing store when present.
  if (-not $env:OLLAMA_MODELS) {
    $Existing = Join-Path $HOME '.ollama\models'
    if (Test-Path $Existing) { throw "Modelos existentes em $Existing. Inicie seu Ollama existente ou configure OLLAMA_MODELS em F:\CODEX apos migracao manual. Nada foi movido/apagado." }
    $env:OLLAMA_MODELS = Join-Path $DataRoot 'ollama\models'
  }
  if (-not $env:OLLAMA_MODELS.StartsWith('F:\CODEX\', [StringComparison]::OrdinalIgnoreCase)) { throw 'OLLAMA_MODELS deve estar em F:\CODEX para iniciar novo runtime.' }
  $env:OLLAMA_HOST = '127.0.0.1:11434'
  Start-Process $Ollama.Source -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
  $Tags = $null
  for ($i=0; $i -lt 30; $i++) {
    try { $Tags = Get-OllamaTags; break } catch { Start-Sleep -Seconds 1 }
  }
  if ($null -eq $Tags) { throw 'Ollama nao respondeu em 127.0.0.1:11434 em 30s.' }
}
Write-Host 'Todos os modelos instalados:'
$Tags.models | Select-Object name,size | Format-Table
$Manifest = Get-Content "$ProjectRoot\config\local-models.json" -Raw | ConvertFrom-Json
foreach ($Model in $Manifest.models) {
  if ($Model.tier -ne 'required' -and -not ($IncludeRecommended -and $Model.tier -eq 'recommended') -and -not ($IncludeOptional -and $Model.tier -eq 'optional')) { continue }
  if (@($Tags.models.name) -contains $Model.name) { Write-Host "Preservado: $($Model.name)"; continue }
  $FreeGB = [math]::Round((Get-PSDrive F).Free / 1GB, 2)
  Write-Host "$($Model.name): download estimado $($Model.estimatedDownloadGB) GB; livre F: $FreeGB GB (estimativas, nao garantias)."
  if ($FreeGB -lt ($Model.estimatedDownloadGB * 2)) { throw 'Espaco insuficiente: necessario pelo menos 2x o download estimado.' }
  Confirm-Download "Modelo $($Model.name)"
  Invoke-OllamaPullWithRetry $Model.name
  $Tags = Get-OllamaTags
}
Invoke-Checked $Pnpm @('build')
# Force binary resolution now; a successful JS build alone does not prove Electron is installed.
Invoke-Checked $Pnpm @('exec','node','-e',"require('electron')")
Write-Host 'SETUP + BUILD concluidos. Execute .\scripts\run-rc1.ps1. Codex e Google Tasks nao exigem login para iniciar.'