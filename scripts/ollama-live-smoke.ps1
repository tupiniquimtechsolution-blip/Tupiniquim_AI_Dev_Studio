# Pure orchestration helper: bounded HTTP only; no pulls, model selection mutation or credentials.
function Test-OllamaTimeoutException($Exception) {
  $Current = $Exception
  while ($null -ne $Current) {
    if ($Current -is [TimeoutException]) { return $true }
    if ($Current -is [System.Net.WebException] -and $Current.Status -eq [System.Net.WebExceptionStatus]::Timeout) { return $true }
    if ($Current -is [System.Threading.Tasks.TaskCanceledException]) { return $true }
    if ($Current.Message -match '(?i)timeout|timed out|tempo limite|cancel') { return $true }
    $Current = $Current.InnerException
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
      elseif (Test-OllamaTimeoutException $_.Exception) {
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
