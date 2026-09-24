$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\scripts\ollama-live-smoke.ps1"

# Emit the timeout from compiled .NET code instead of PowerShell's `throw` statement.
# This preserves the typed inner TimeoutException across the PowerShell 5.1 invocation
# boundary and more closely exercises the .NET exception shape exposed by HTTP cmdlets.
Add-Type -TypeDefinition @"
using System;
public static class TupiniquimTimeoutFixture {
    public static void ThrowTimeout(string message) {
        throw new TimeoutException(message);
    }
}
"@

$Root = Join-Path ([IO.Path]::GetTempPath()) ('rc1-ollama-test-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $Root | Out-Null
$ManifestPath = Join-Path $Root 'models.json'
$script:Scenario = 'success'
$script:CalledModel = $null
$script:GenerateCalls = 0
function Assert-True($Value, [string]$Message) { if (-not $Value) { throw $Message } }

# Offline HTTP mock: deliberately returns recommended BEFORE required.
function Invoke-RestMethod {
  [CmdletBinding()]
  param($Uri, $TimeoutSec, $Method, $ContentType, $Body)
  if ($Uri.EndsWith('/api/tags')) {
    Assert-True ($TimeoutSec -eq 5) 'tags must be bounded'
    if ($script:Scenario -eq 'connection') { throw 'secret=DO_NOT_LOG_ME' }
    if ($script:Scenario -eq 'missing') { return @{models=@(@{name='qwen3:8b'})} }
    return @{models=@(@{name='qwen3:8b'}, @{name='qwen2.5-coder:3b'})}
  }
  Assert-True ($Uri -eq 'http://127.0.0.1:11434/api/generate') 'wrong endpoint'
  Assert-True ($TimeoutSec -eq 180) 'generation timeout changed'
  $script:GenerateCalls++
  $script:CalledModel = ($Body | ConvertFrom-Json).model
  if ($script:Scenario -eq 'timeout') {
    [TupiniquimTimeoutFixture]::ThrowTimeout('secret=DO_NOT_LOG_ME')
  }
  if ($script:Scenario -eq 'incomplete') { return @{done=$false;response='partial'} }
  if ($script:Scenario -eq 'empty') { return @{done=$true;response=' '} }
  return @{done=$true;response='OK'}
}

try {
  Copy-Item "$PSScriptRoot\..\..\config\local-models.json" $ManifestPath
  foreach ($Scenario in @('success','missing','timeout','incomplete','empty','connection','manifest')) {
    $script:Scenario = $Scenario
    $script:GenerateCalls = 0
    $script:CalledModel = $null
    if ($Scenario -eq 'manifest') { '{"models":[]}' | Set-Content $ManifestPath }
    $Result = Invoke-OllamaLiveSmoke $ManifestPath $Root
    $Logged = Get-Content (Join-Path $Root 'ollama-live.log') -Raw
    Assert-True (-not $Logged.Contains('DO_NOT_LOG_ME')) 'raw exception leaked'
    Assert-True ($Result.durationMs -ge 0) 'duration missing'
    if ($Scenario -eq 'success') {
      Assert-True ($Result.exitCode -eq 0 -and $Result.done -eq $true) 'smoke should succeed'
      Assert-True ($script:CalledModel -ceq 'qwen2.5-coder:3b') 'tags ordering chose wrong model'
    } else {
      Assert-True ($Result.exitCode -eq 1 -and $Result.cause) 'failure hidden'
      if ($Scenario -in @('missing','manifest','connection')) { Assert-True ($script:GenerateCalls -eq 0) 'unexpected generation/fallback' }
      if ($Scenario -eq 'timeout') { Assert-True ($Result.cause -match 'TIMEOUT') 'timeout not diagnosed' }
    }
    Write-Host "PASS ollama-smoke fixture: $Scenario"
  }
} finally { Remove-Item $Root -Recurse -Force }
