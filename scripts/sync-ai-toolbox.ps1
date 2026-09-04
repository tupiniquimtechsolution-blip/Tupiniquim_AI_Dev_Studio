param(
    [string]$Root = (Join-Path $HOME "Tupiniquim-AI-Toolbox"),
    [switch]$InstallRecommendedClaudeSkills,
    [switch]$InstallMultiLLMToolbox
)

$ErrorActionPreference = "Stop"

$Repositories = @(
    @{ Name = "Panniantong__Agent-Reach"; Url = "https://github.com/Panniantong/Agent-Reach.git" },
    @{ Name = "nextlevelbuilder__ui-ux-pro-max-skill"; Url = "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git" },
    @{ Name = "Anil-matcha__Open-Generative-AI"; Url = "https://github.com/Anil-matcha/Open-Generative-AI.git" },
    @{ Name = "diwenne__openreply"; Url = "https://github.com/diwenne/openreply.git" },
    @{ Name = "kyutai-labs__pocket-tts"; Url = "https://github.com/kyutai-labs/pocket-tts.git" },
    @{ Name = "FareedKhan-dev__kimi-k3-in-c"; Url = "https://github.com/FareedKhan-dev/kimi-k3-in-c.git" },
    @{ Name = "HKUDS__CLI-Anything"; Url = "https://github.com/HKUDS/CLI-Anything.git" },
    @{ Name = "nidhinjs__prompt-master"; Url = "https://github.com/nidhinjs/prompt-master.git" },
    @{ Name = "Shubhamsaboo__awesome-llm-apps"; Url = "https://github.com/Shubhamsaboo/awesome-llm-apps.git" },
    @{ Name = "usestrix__strix"; Url = "https://github.com/usestrix/strix.git" }
)

$ReposDir = Join-Path $Root "repos"
$BundlesDir = Join-Path $Root "bundles"
New-Item -ItemType Directory -Force -Path $ReposDir, $BundlesDir | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git nao encontrado no PATH."
}

foreach ($Repo in $Repositories) {
    $Dest = Join-Path $ReposDir $Repo.Name
    Write-Host ""
    Write-Host "==> $($Repo.Name)"

    if (Test-Path (Join-Path $Dest ".git")) {
        git -C $Dest fetch --all --tags --prune
        $Branch = (git -C $Dest symbolic-ref --short refs/remotes/origin/HEAD 2>$null)
        if ($LASTEXITCODE -eq 0 -and $Branch) {
            $Branch = $Branch -replace "^origin/", ""
            git -C $Dest checkout $Branch
            git -C $Dest pull --ff-only
        }
    }
    elseif (Test-Path $Dest) {
        Write-Warning "Pasta existe mas nao e clone Git: $Dest. Pulando para nao sobrescrever."
        continue
    }
    else {
        git clone $Repo.Url $Dest
    }

    $Bundle = Join-Path $BundlesDir ($Repo.Name + ".bundle")
    git -C $Dest bundle create $Bundle --all
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Nao foi possivel gerar bundle de $($Repo.Name)."
    }
}

Write-Host ""
Write-Host "Backup bruto atualizado em: $Root"
Write-Host "Clones completos: $ReposDir"
Write-Host "Bundles Git:      $BundlesDir"

if ($InstallMultiLLMToolbox) {
    $RepoRoot = Split-Path $PSScriptRoot -Parent
    $CanonicalSkill = Join-Path $RepoRoot ".agents\skills\tupiniquim-toolbox"

    if (-not (Test-Path (Join-Path $CanonicalSkill "SKILL.md"))) {
        throw "Skill canonica nao encontrada em: $CanonicalSkill"
    }

    $Destinations = @(
        (Join-Path $HOME ".agents\skills\tupiniquim-toolbox"),
        (Join-Path $HOME ".qwen\skills\tupiniquim-toolbox"),
        (Join-Path $HOME ".claude\skills\tupiniquim-toolbox")
    )

    Write-Host ""
    Write-Host "Sincronizando Tupiniquim Toolbox para os harnesses locais..."

    foreach ($Destination in $Destinations) {
        $Parent = Split-Path $Destination -Parent
        New-Item -ItemType Directory -Force -Path $Parent | Out-Null
        New-Item -ItemType Directory -Force -Path $Destination | Out-Null
        Copy-Item -Path (Join-Path $CanonicalSkill "*") -Destination $Destination -Recurse -Force
        Write-Host "  OK: $Destination"
    }

    Write-Host ""
    Write-Host "Cobertura:"
    Write-Host "  ~/.agents/skills -> Gemini, Kimi, Grok, Freebuff e harnesses compativeis"
    Write-Host "  ~/.qwen/skills   -> Qwen Code"
    Write-Host "  ~/.claude/skills -> Claude Code"
    Write-Host "  Codex usa o AGENTS.md versionado em cada projeto Tupiniquim"
    Write-Host ""
    Write-Host "Nenhum AGENTS.md global foi criado para evitar afetar projetos fora da empresa."
}

if ($InstallRecommendedClaudeSkills) {
    $ClaudeSkills = Join-Path $HOME ".claude\skills"
    New-Item -ItemType Directory -Force -Path $ClaudeSkills | Out-Null

    if (Get-Command npx -ErrorAction SilentlyContinue) {
        Write-Host ""
        Write-Host "Instalando Agent Reach como skill..."
        npx skills add Panniantong/Agent-Reach@agent-reach

        Write-Host ""
        Write-Host "Instalando skills oficiais do Strix..."
        npx skills add usestrix/strix
    }
    else {
        Write-Warning "npx nao encontrado; Agent Reach e Strix nao foram instalados como skills."
    }

    $PromptMasterDest = Join-Path $ClaudeSkills "prompt-master"
    if (-not (Test-Path $PromptMasterDest)) {
        git clone "https://github.com/nidhinjs/prompt-master.git" $PromptMasterDest
    }
    elseif (Test-Path (Join-Path $PromptMasterDest ".git")) {
        git -C $PromptMasterDest pull --ff-only
    }
    else {
        Write-Warning "Destino do Prompt Master ja existe e nao e clone Git; nao foi sobrescrito: $PromptMasterDest"
    }

    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host ""
        Write-Host "Instalando/atualizando UI UX Pro Max CLI..."
        npm install -g ui-ux-pro-max-cli
        if (Get-Command uipro -ErrorAction SilentlyContinue) {
            uipro init --ai claude --global
        }
    }
    else {
        Write-Warning "npm nao encontrado; UI UX Pro Max nao foi instalado globalmente."
    }

    Write-Host ""
    Write-Host "CLI-Anything usa o marketplace do Claude Code. Execute dentro do Claude Code:"
    Write-Host "/plugin marketplace add HKUDS/CLI-Anything"
    Write-Host "/plugin install cli-anything"
    Write-Host ""
    Write-Host "Awesome LLM Apps foi mantido bruto no backup. Instale skills individuais somente quando houver necessidade."
}

Write-Host ""
Write-Host "Concluido. Nenhuma credencial foi gravada por este script."
