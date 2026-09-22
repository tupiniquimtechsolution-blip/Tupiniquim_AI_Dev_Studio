param(
    [string]$Root = (Join-Path $HOME "Tupiniquim-AI-Toolbox"),
    [string]$DataRoot = "F:\CODEX\Tupiniquim-AI-Dev-Studio.data\toolbox",
    [switch]$SkipRepositorySync
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path $PSScriptRoot -Parent
$KnowledgeRoot = Join-Path $RepoRoot "docs\AI_TOOLBOX"
$KnowledgeSources = @(Get-ChildItem -LiteralPath $KnowledgeRoot -Filter "KNOWLEDGE_PACK*_2026-09-18.json" -File)

if ($KnowledgeSources.Count -eq 0) {
    throw "Nenhum Knowledge Pack datado de 2026-09-18 encontrado em: $KnowledgeRoot"
}

$Repositories = @(
    @{ Name = "Alishahryar1__free-claude-code"; Url = "https://github.com/Alishahryar1/free-claude-code.git" },
    @{ Name = "FoundationAgents__OpenManus"; Url = "https://github.com/FoundationAgents/OpenManus.git" },
    @{ Name = "blader__humanizer"; Url = "https://github.com/blader/humanizer.git" }
)

$ReposDir = Join-Path $Root "repos"
$BundlesDir = Join-Path $Root "bundles"
$KnowledgeDir = Join-Path $DataRoot "knowledge"

New-Item -ItemType Directory -Force -Path $ReposDir, $BundlesDir, $KnowledgeDir | Out-Null

if (-not $SkipRepositorySync) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "Git nao encontrado no PATH."
    }

    foreach ($Repo in $Repositories) {
        $Dest = Join-Path $ReposDir $Repo.Name
        Write-Host ""
        Write-Host "==> $($Repo.Name)"

        if (Test-Path (Join-Path $Dest ".git")) {
            git -C $Dest fetch --all --tags --prune
            if ($LASTEXITCODE -ne 0) { throw "git fetch falhou para $($Repo.Name)" }

            $DefaultRemote = git -C $Dest symbolic-ref --short refs/remotes/origin/HEAD 2>$null
            if ($LASTEXITCODE -eq 0 -and $DefaultRemote) {
                $DefaultBranch = $DefaultRemote -replace "^origin/", ""
                git -C $Dest checkout $DefaultBranch
                if ($LASTEXITCODE -ne 0) { throw "checkout falhou para $($Repo.Name)" }
                git -C $Dest pull --ff-only
                if ($LASTEXITCODE -ne 0) { throw "pull --ff-only falhou para $($Repo.Name)" }
            }
        }
        elseif (Test-Path $Dest) {
            Write-Warning "Pasta existe mas nao e clone Git: $Dest. Pulando para nao sobrescrever."
            continue
        }
        else {
            git clone $Repo.Url $Dest
            if ($LASTEXITCODE -ne 0) { throw "git clone falhou para $($Repo.Name)" }
        }

        $Bundle = Join-Path $BundlesDir ($Repo.Name + ".bundle")
        git -C $Dest bundle create $Bundle --all
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Nao foi possivel gerar bundle de $($Repo.Name)."
        }
    }
}

Write-Host ""
Write-Host "Knowledge Packs:"
foreach ($KnowledgeSource in $KnowledgeSources) {
    $KnowledgeDestination = Join-Path $KnowledgeDir $KnowledgeSource.Name
    Copy-Item -LiteralPath $KnowledgeSource.FullName -Destination $KnowledgeDestination -Force
    $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $KnowledgeDestination).Hash.ToLowerInvariant()
    Write-Host "  OK: $KnowledgeDestination"
    Write-Host "      SHA256: $Hash"
}

Write-Host ""
Write-Host "Repositorios extras: $ReposDir"
Write-Host "Bundles: $BundlesDir"
Write-Host ""
Write-Host "Fontes de pesquisa/media sem upstream seguro ou com material de credencial NAO sao clonadas por este script."
Write-Host "As fontes permanecem referencias nao confiaveis ate o gate de adocao do projeto."
Write-Host "Nenhuma credencial, cookie, token, sessao ou .env foi copiado por este script."
