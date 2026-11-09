# FootClubSim: enable GitHub Pages and publish the existing main branch.
# Requires GitHub CLI (gh) with permission to administer this repository.
[CmdletBinding()]
param(
    [switch]$NoWait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = 'StanleyLl0yd/FootClubSim'
$workflow = 'pages-preview.yml'
$pagesEndpoint = "repos/$repo/pages"
$siteUrl = 'https://stanleyll0yd.github.io/FootClubSim/'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI is missing. Install with: winget install --id GitHub.cli -e'
}

& gh auth status
if ($LASTEXITCODE -ne 0) {
    throw 'Authenticate first: gh auth login'
}

& gh repo view $repo --json nameWithOwner -q '.nameWithOwner'
if ($LASTEXITCODE -ne 0) {
    throw "Cannot access $repo with the active GitHub account."
}

# GitHub returns 404 while Pages is disabled. Do not treat that as a fatal error.
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $pagesJson = & gh api $pagesEndpoint 2>$null
    $pagesExists = ($LASTEXITCODE -eq 0)
} finally {
    $ErrorActionPreference = $oldPreference
}

if ($pagesExists) {
    $pages = $pagesJson | ConvertFrom-Json
    if ($pages.build_type -ne 'workflow') {
        Write-Host 'Switching existing Pages site to GitHub Actions...'
        & gh api --method PUT $pagesEndpoint -f build_type=workflow
        if ($LASTEXITCODE -ne 0) { throw 'Cannot update GitHub Pages source.' }
    } else {
        Write-Host 'GitHub Pages already uses GitHub Actions.'
    }
} else {
    Write-Host 'Enabling GitHub Pages with GitHub Actions...'
    & gh api --method POST $pagesEndpoint -f build_type=workflow
    if ($LASTEXITCODE -ne 0) {
        throw 'Cannot enable GitHub Pages. Check Settings > Pages and admin access.'
    }
}

Write-Host 'Starting the playable preview deployment from main...'
& gh workflow run $workflow --repo $repo --ref main
if ($LASTEXITCODE -ne 0) {
    throw "Cannot start $workflow. Confirm the workflow is merged into main."
}

if (-not $NoWait) {
    $runId = $null
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        Start-Sleep -Seconds 5
        $candidate = & gh run list --repo $repo --workflow $workflow --event workflow_dispatch --branch main --limit 1 --json databaseId -q '.[0].databaseId'
        if ($LASTEXITCODE -eq 0 -and $candidate -match '^\d+$') {
            $runId = $candidate
            break
        }
    }
    if (-not $runId) {
        throw "Deployment was requested, but the Actions run was not found. Check https://github.com/$repo/actions/workflows/$workflow"
    }
    & gh run watch $runId --repo $repo --exit-status
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment workflow failed. Inspect https://github.com/$repo/actions/workflows/$workflow"
    }
}

Write-Host ''
Write-Host 'Playable Preview URL:'
Write-Host $siteUrl
Write-Host "Workflow: https://github.com/$repo/actions/workflows/$workflow"
Write-Host 'The Pages site is public. Career saves stay in your browser (IndexedDB).'
