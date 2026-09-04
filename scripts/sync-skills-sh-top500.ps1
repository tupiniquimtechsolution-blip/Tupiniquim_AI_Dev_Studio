param(
    [ValidateSet("all-time", "trending", "hot")]
    [string]$View = "all-time",
    [ValidateRange(1, 500)]
    [int]$Count = 500,
    [string]$OutputDirectory = "docs/AI_TOOLBOX/generated"
)

$ErrorActionPreference = "Stop"

$Token = $env:VERCEL_OIDC_TOKEN
if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "VERCEL_OIDC_TOKEN nao encontrado. Configure-o no ambiente. Nunca grave o token no repositorio."
}

$Uri = "https://skills.sh/api/v1/skills?view=$View&page=0&per_page=$Count"
$Headers = @{
    Authorization = "Bearer $Token"
    Accept        = "application/json"
}

Write-Host "Sincronizando skills.sh: view=$View count=$Count"

$Response = Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers

if ($null -eq $Response.data) {
    throw "Resposta do skills.sh nao contem o campo data."
}

$Skills = @($Response.data)
if ($Skills.Count -lt $Count) {
    Write-Warning "Foram retornadas apenas $($Skills.Count) skills para count=$Count."
}

$PinnedId = "vercel-labs/skills/find-skills"
$Pinned = $Skills | Where-Object { $_.id -eq $PinnedId } | Select-Object -First 1

if ($null -eq $Pinned) {
    throw "A skill pinned '$PinnedId' nao apareceu no snapshot. Interrompendo para nao gerar catalogo incompleto."
}

$Ranked = for ($i = 0; $i -lt $Skills.Count; $i++) {
    $Skill = $Skills[$i]
    [ordered]@{
        rank       = $i + 1
        id         = $Skill.id
        slug       = $Skill.slug
        name       = $Skill.name
        source     = $Skill.source
        installs   = $Skill.installs
        sourceType = $Skill.sourceType
        installUrl = $Skill.installUrl
        url        = $Skill.url
        pinned     = ($Skill.id -eq $PinnedId)
    }
}

$Snapshot = [ordered]@{
    schemaVersion = "1.0.0"
    source        = "https://skills.sh"
    endpoint      = "/api/v1/skills"
    view          = $View
    requested     = $Count
    returned      = $Skills.Count
    generatedAt   = (Get-Date).ToUniversalTime().ToString("o")
    pinned        = @($PinnedId)
    policy        = "metadata-first; audit-and-approve-before-activation"
    pagination    = $Response.pagination
    skills        = $Ranked
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputPath = Join-Path $OutputDirectory ("skills-sh-top500-" + $View + ".json")

$Json = $Snapshot | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText(
    (Resolve-Path $OutputDirectory).Path + [System.IO.Path]::DirectorySeparatorChar + [System.IO.Path]::GetFileName($OutputPath),
    $Json + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Snapshot salvo em: $OutputPath"
Write-Host "find-skills pinned: $($Pinned.id)"
Write-Host "Nenhum token foi persistido no arquivo."
