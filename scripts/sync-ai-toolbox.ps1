param(
    [string]$Root = (Join-Path $HOME "Tupiniquim-AI-Toolbox"),
    [switch]$InstallRecommendedClaudeSkills,
    [switch]$InstallMultiLLMToolbox,
    [switch]$IncludeLargeReferences
)

$ErrorActionPreference = "Stop"

$Repositories = @(
    @{ Name = "Panniantong__Agent-Reach"; Url = "https://github.com/Panniantong/Agent-Reach.git"; Large = $false },
    @{ Name = "nextlevelbuilder__ui-ux-pro-max-skill"; Url = "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git"; Large = $false },
    @{ Name = "Anil-matcha__Open-Generative-AI"; Url = "https://github.com/Anil-matcha/Open-Generative-AI.git"; Large = $false },
    @{ Name = "diwenne__openreply"; Url = "https://github.com/diwenne/openreply.git"; Large = $false },
    @{ Name = "kyutai-labs__pocket-tts"; Url = "https://github.com/kyutai-labs/pocket-tts.git"; Large = $false },
    @{ Name = "FareedKhan-dev__kimi-k3-in-c"; Url = "https://github.com/FareedKhan-dev/kimi-k3-in-c.git"; Large = $false },
    @{ Name = "HKUDS__CLI-Anything"; Url = "https://github.com/HKUDS/CLI-Anything.git"; Large = $false },
    @{ Name = "nidhinjs__prompt-master"; Url = "https://github.com/nidhinjs/prompt-master.git"; Large = $false },
    @{ Name = "Shubhamsaboo__awesome-llm-apps"; Url = "https://github.com/Shubhamsaboo/awesome-llm-apps.git"; Large = $false },
    @{ Name = "usestrix__strix"; Url = "https://github.com/usestrix/strix.git"; Large = $false },
    @{ Name = "google__skills"; Url = "https://github.com/google/skills.git"; Large = $false },

    @{ Name = "soumatheusgomes__vibe-coding-toolkit"; Url = "https://github.com/soumatheusgomes/vibe-coding-toolkit.git"; Large = $false },
    @{ Name = "emilkowalski__skills"; Url = "https://github.com/emilkowalski/skills.git"; Large = $false },
    @{ Name = "Leonxlnx__taste-skill"; Url = "https://github.com/Leonxlnx/taste-skill.git"; Large = $false },
    @{ Name = "EbookFoundation__free-programming-books"; Url = "https://github.com/EbookFoundation/free-programming-books.git"; Large = $false },
    @{ Name = "public-apis__public-apis"; Url = "https://github.com/public-apis/public-apis.git"; Large = $false },
    @{ Name = "docker__awesome-compose"; Url = "https://github.com/docker/awesome-compose.git"; Large = $false },
    @{ Name = "TheAlgorithms__Python"; Url = "https://github.com/TheAlgorithms/Python.git"; Large = $false },
    @{ Name = "jwasham__coding-interview-university"; Url = "https://github.com/jwasham/coding-interview-university.git"; Large = $false },

    @{ Name = "supabase__supabase"; Url = "https://github.com/supabase/supabase.git"; Large = $true }
)

$ReposDir = Join-Path $Root "repos"
$BundlesDir = Join-Path $Root "bundles"
New-Item -ItemType Directory -Force -Path $ReposDir, $BundlesDir | Out-Null

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git nao encontrado no PATH."
}

foreach ($Repo in $Repositories) {
    if ($Repo.Large -eq $true -and -not $IncludeLargeReferences) {
        Write-Host ""
        Write-Host "==> $($Repo.Name) [SKIP: referencia grande; use -IncludeLargeReferences]"
        continue
    }

    $Dest = Join-Path $ReposDir $Repo.Name
    Write-Host ""
    Write-Host "==> $($Repo.Name)"

    if (Test-Path (Join-Path $Dest ".git")) {
        git -C $Dest fetch --all --tags --prune
        $DefaultBranch = (git -C $Dest symbolic-ref --short refs/remotes/origin/HEAD 2>$null)
        if ($LASTEXITCODE -eq 0 -and $DefaultBranch) {
            $DefaultBranch = $DefaultBranch -replace "^origin/", ""
            git -C $Dest checkout $DefaultBranch
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

if (-not $IncludeLargeReferences) {
    Write-Host "Supabase nao foi clonado por padrao por ser uma referencia grande."
    Write-Host "Para incluir: -IncludeLargeReferences"
}

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

    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install -g ui-ux-pro-max-cli
        if (Get-Command uipro -ErrorAction SilentlyContinue) {
            uipro init --ai claude --global
        }
    }
}

Write-Host ""
Write-Host "Google Skills registrada como fonte oficial sob demanda: google/skills"
Write-Host "Nenhuma skill Google e instalada automaticamente; use o Skill Gate e finding-google-skills quando aplicavel."
Write-Host ""
Write-Host "Design skills registradas para uso sob demanda:"
Write-Host "  emilkowalski/skills (emil-design-eng e skills de animation)"
Write-Host "  Leonxlnx/taste-skill (design-taste-frontend)"
Write-Host "Elas nao sao instaladas automaticamente: ativacao externa continua passando pelo Skill Gate."
Write-Host ""
Write-Host "Concluido. Nenhuma credencial foi gravada por este script."
