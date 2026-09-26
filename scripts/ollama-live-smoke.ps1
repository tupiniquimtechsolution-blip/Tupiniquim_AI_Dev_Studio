# Pure orchestration helper: bounded HTTP only; no pulls, model selection mutation or credentials.
function Test-OllamaTimeoutError($ErrorRecord) {
  if ($null -eq $ErrorRecord) { return $false }

  # Windows PowerShell 5.1 can rewrap terminating errors and discard the original .NET
  # exception type. Treat the explicit OperationTimeout category as authoritative timeout
  # metadata; otherwise traverse only structured exception/error metadata. Never inspect
  # ErrorDetails or log raw exception messages because they can contain secrets.
  if ($ErrorRecord -is [System.Management.Automation.ErrorRecord]) {
    if ($ErrorRecord.CategoryInfo.Category -eq [System.Management.Automation.ErrorCategory]::OperationTimeout) { return $true }
    $Reason = [string]$ErrorRecord.CategoryInfo.Reason
    if ($Reason -in @('TimeoutException', 'TaskCanceledException')) { return $true }
  }

  $Pending = New-Object System.Collections.Queue
  $Seen = New-Object 'System.Collections.Generic.HashSet[int]'
  $Pending.Enqueue($ErrorRecord)

  while ($Pending.Count -gt 0) {
    $Current = $Pending.Dequeue()
    if ($null -eq $Current) { continue }

    $Identity = [System.Runtime.CompilerServices.RuntimeHelpers]::GetHashCode($Current)
    if (-not $Seen.Add($Identity)) { continue }

    if ($Current -is [TimeoutException]) { return $true }
    if ($Current -is [System.Net.WebException] -and $Current.Status -eq [System.Net.WebExceptionStatus]::Timeout) { return $true }
    if ($Current -is [System.Threading.Tasks.TaskCanceledException]) { return $true }

    if ($Current -is [System.Management.Automation.ErrorRecord]) {
      if ($Current.CategoryInfo.Category -eq [System.Management.Automation.ErrorCategory]::OperationTimeout) { return $true }
      $Reason = [string]$Current.CategoryInfo.Reason
      if ($Reason -in @('TimeoutException', 'TaskCanceledException')) { return $true }
      if ($null -ne $Current.TargetObject) { $Pending.Enqueue($Current.TargetObject) }
      if ($null -ne $Current.Exception) { $Pending.Enqueue($Current.Exception) }
      continue
    }

    if ($Current -is [Exception]) {
      if ($Current.Message -match '(?i)timeout|timed out|tempo limite|cancel') { return $true }
      if ($null -ne $Current.InnerException) { $Pending.Enqueue($Current.InnerException) }
      if ($Current -is [System.Management.Automation.RuntimeException] -and $null -ne $Current.ErrorRecord) {
        $Pending.Enqueue($Current.ErrorRecord)
      }
    }
  }

  return $false
}

function Invoke-OllamaLiveSmoke([string]$ManifestPath, [string]$EvidencePath) {
  $Clock = [Diagnostics.Stopwatch]::StartNew()
  $Model = $null
  $Done = $null
  $Cause = $null
  $Code = 1
  $Stage = 'MANIFEST'
  $TimeoutSeconds = 180 # Unchanged: includes cold model loading and generation on the local runtime.
  try {
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    $Required = @($Manifest.models | Where-Object { $_.tier -eq 'required' })
    if ($Required.Count -ne 1 -or $Required[0].name -notmatch '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,299}$') {
      throw 'Manifest must identify exactly one required model.'
    }
    $Model = $Required[0].name
    $Stage = 'TAGS'
    $Tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5 -ErrorAction Stop
    $Tags.models | Select-Object name,size | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidencePath 'models.json') -Encoding UTF8
    if (@($Tags.models.name) -cnotcontains $Model) {
      $Cause = 'REQUIRED_MODEL_NOT_INSTALLED: execute setup-rc1-windows.ps1; no fallback was attempted.'
      throw 'Required model absent.'
    }
    $Stage = 'GENERATE'
    $Reply = Invoke-RestMethod 'http://127.0.0.1:11434/api/generate' -Method Post -ContentType 'application/json' `
      -Body (@{model=$Model;prompt='Reply OK';stream=$false} | ConvertTo-Json) -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    $Done = $Reply.done -eq $true
    if (-not $Done -or [string]::IsNullOrWhiteSpace($Reply.response)) {
      $Cause = 'INCOMPLETE_GENERATION: done=true and a non-empty response are required.'
      throw 'Incomplete generation.'
    }
    $Code = 0
  } catch {
    if ($null -eq $Cause) {
      # Inspect exception metadata only; do not log ErrorDetails, raw response bodies or Exception.Message because they can contain secrets.
      if ($Stage -eq 'MANIFEST') { $Cause = 'INVALID_MANIFEST: expected exactly one valid required model.' }
      elseif (Test-OllamaTimeoutError $_) {
        $Cause = "${Stage}_TIMEOUT_OR_CANCELLED: bounded request failed (tags=5s, generate=${TimeoutSeconds}s)."
      } elseif ($null -ne $_.Exception.Response) {
        $Cause = "${Stage}_HTTP_ERROR: status=$([int]$_.Exception.Response.StatusCode)."
      } else { $Cause = "${Stage}_CONNECTION_OR_RESPONSE_ERROR: local runtime unavailable or response invalid." }
    }
  } finally { $Clock.Stop() }
  $Result = [pscustomobject]@{
    gate='ollama-live'; exitCode=$Code; status=$(if ($Code -eq 0) {'PASS'} else {'FAIL'})
    model=$Model; durationMs=$Clock.ElapsedMilliseconds; done=$Done; cause=$Cause; timeoutSeconds=$TimeoutSeconds
  }
  $Result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidencePath 'ollama-live.log') -Encoding UTF8
  Write-Host "ollama-live : $Code"
  return $Result
}
