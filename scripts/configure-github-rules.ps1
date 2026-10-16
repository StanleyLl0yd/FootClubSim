#Requires -Version 7.0
# Manual administrator operation. No changes until exact-main CI is green.
$ErrorActionPreference = 'Stop'
$repo = 'StanleyLl0yd/FootClubSim'
$appId = 15368
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install gh: https://cli.github.com/' }
& gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) { throw 'Run gh auth login first' }

function Invoke-Api([string]$path, [string]$method='GET', [object]$data=$null) {
    $arguments = @('api', $path, '--method', $method, '-H', 'Accept: application/vnd.github+json')
    $temp = $null
    try {
        if ($null -ne $data) {
            $temp = [IO.Path]::GetTempFileName()
            [IO.File]::WriteAllText($temp, (ConvertTo-Json -InputObject $data -Depth 40 -Compress),
                [Text.UTF8Encoding]::new($false))
            $arguments += @('--input', $temp)
        }
        $output = & gh @arguments
        if ($LASTEXITCODE -ne 0) { throw "GitHub API request failed: $method $path" }
        if (-not $output) { return $null }
        return (($output -join [Environment]::NewLine) | ConvertFrom-Json -Depth 40)
    }
    finally {
        if ($null -ne $temp -and (Test-Path -LiteralPath $temp)) {
            Remove-Item -LiteralPath $temp -Force
        }
    }
}
$r = Invoke-Api "repos/$repo"
if (-not $r.permissions.admin -or $r.default_branch -ne 'main') {
    throw 'Administrator access and main as the default branch are required.'
}
$b = Invoke-Api "repos/$repo/branches/main"
$sha = $b.commit.sha
$required = @(
    'TypeScript and domain tests',
    'Markdown links and Python unit tests',
    'npm dependency vulnerability audit',
    'Built app renders in Chromium',
    'Windows Chrome app and native v7 CAS',
    'Windows Edge app and native v7 CAS',
    'Safari M0 restore and native v7 IndexedDB CAS',
    'Analyze javascript-typescript',
    'Analyze python'
)
$run = Invoke-Api "repos/$repo/commits/$sha/check-runs?per_page=100"
foreach ($name in $required) {
    $current = @($run.check_runs | Where-Object { $_.name -eq $name -and $_.app.id -eq $appId } |
        Sort-Object id -Descending)
    if (-not $current -or $current[0].conclusion -ne 'success') {
        throw "CI not ready on $sha for '$name'. Retry after CI completes."
    }
}
$ql = @($run.check_runs | Where-Object { $_.name -eq 'CodeQL' } | Sort-Object id -Descending)
if (-not $ql -or $ql[0].conclusion -ne 'success') { throw 'CodeQL gate not yet green on main.' }
Write-Host "All 9 exact-main checks and CodeQL passed ($sha)." -ForegroundColor Green

$main = [ordered]@{
    name = 'Main branch protection'; target = 'branch'; enforcement = 'active'
    bypass_actors = @()
    conditions = @{ ref_name = @{ include = @('~DEFAULT_BRANCH'); exclude = @() } }
    rules = @(
        @{ type = 'deletion' }
        @{ type = 'non_fast_forward' }
        @{ type = 'required_status_checks'; parameters = @{
            strict_required_status_checks_policy = $true
            do_not_enforce_on_create = $false
            required_status_checks = @($required | ForEach-Object {
                @{ context = $_; integration_id = $appId }
            })
        } }
        @{ type = 'pull_request'; parameters = @{
            required_approving_review_count = 0
            dismiss_stale_reviews_on_push = $false
            required_reviewers = @()
            require_code_owner_review = $false
            require_last_push_approval = $false
            required_review_thread_resolution = $true
            require_extra_approval_for_unattributed_changes = $false
            allowed_merge_methods = @('squash')
        } }
        @{ type = 'code_scanning'; parameters = @{
            code_scanning_tools = @(@{
                tool = 'CodeQL'
                security_alerts_threshold = 'medium_or_higher'
                alerts_threshold = 'errors'
            })
        } }
        @{ type = 'required_signatures' }
    )
}
$tags = [ordered]@{
    name = 'Immutable release tags'; target = 'tag'; enforcement = 'active'
    bypass_actors = @()
    conditions = @{ ref_name = @{ include = @('refs/tags/v*'); exclude = @() } }
    rules = @(@{ type = 'update' }, @{ type = 'deletion' })
}

function Fingerprint([object]$s) {
    $parts = @(
        foreach ($x in @($s.rules | Sort-Object type)) {
            $p = $x.parameters
            switch ([string]$x.type) {
                'required_status_checks' {
                    $names = @($p.required_status_checks | ForEach-Object {
                        '{0}/{1}' -f $_.context, $_.integration_id
                    } | Sort-Object)
                    @('checks', [bool]$p.strict_required_status_checks_policy,
                        [bool]$p.do_not_enforce_on_create, ($names -join ',')) -join '|'
                }
                'pull_request' {
                    @('pr', [int]$p.required_approving_review_count,
                        [bool]$p.dismiss_stale_reviews_on_push,
                        @($p.required_reviewers).Count,
                        [bool]$p.require_code_owner_review,
                        [bool]$p.require_last_push_approval,
                        [bool]$p.required_review_thread_resolution,
                        [bool]$p.require_extra_approval_for_unattributed_changes,
                        (@($p.allowed_merge_methods | Sort-Object) -join ',')) -join '|'
                }
                'code_scanning' {
                    $tools = @($p.code_scanning_tools | ForEach-Object {
                        '{0}/{1}/{2}' -f $_.tool, $_.security_alerts_threshold, $_.alerts_threshold
                    } | Sort-Object)
                    'code_scanning|' + ($tools -join ',')
                }
                default { [string]$x.type }
            }
        }
    )
    return (@(
        [string]$s.name, [string]$s.target, [string]$s.enforcement,
        (@($s.bypass_actors | ForEach-Object {
            '{0}/{1}/{2}' -f $_.actor_type, $_.actor_id, $_.bypass_mode
        } | Sort-Object) -join ','),
        (@($s.conditions.ref_name.include | Sort-Object) -join ','),
        (@($s.conditions.ref_name.exclude | Sort-Object) -join ','),
        ($parts -join ';')
    ) -join '|')
}
function Ensure-Rule([object]$spec) {
    $all = @(Invoke-Api "repos/$repo/rulesets?per_page=100")
    $matching = @($all | Where-Object { $_.name -eq $spec.name })
    if ($matching.Count -gt 1) { throw "Duplicate rule name: $($spec.name)" }
    if ($matching.Count -eq 0) {
        $saved = Invoke-Api "repos/$repo/rulesets" 'POST' $spec
        $id = $saved.id
        Write-Host "Created: $($spec.name) ($id)" -ForegroundColor Green
    }
    else {
        if ($matching[0].target -ne $spec.target) { throw 'Conflicting ruleset target.' }
        $id = $matching[0].id
        $old = Invoke-Api "repos/$repo/rulesets/$id"
        $desiredTypes = @($spec.rules | ForEach-Object { $_.type })
        $extras = @($old.rules | Where-Object { $_.type -notin $desiredTypes })
        if ($extras.Count) { throw "Refusing to remove extra rules from $($spec.name)" }
        if ((Fingerprint $old) -ne (Fingerprint $spec)) {
            $null = Invoke-Api "repos/$repo/rulesets/$id" 'PUT' $spec
            Write-Host "Updated: $($spec.name) ($id)" -ForegroundColor Green
        }
        else { Write-Host "Unchanged: $($spec.name) ($id)" }
    }
    $readBack = Invoke-Api "repos/$repo/rulesets/$id"
    if ((Fingerprint $readBack) -ne (Fingerprint $spec)) {
        throw "Ruleset read-back mismatch: $($spec.name)"
    }
}

if (-not $r.delete_branch_on_merge) {
    $null = Invoke-Api "repos/$repo" 'PATCH' @{ delete_branch_on_merge = $true }
    Write-Host 'Enabled automatic deletion of merged branches.'
}
Ensure-Rule $main
Ensure-Rule $tags

$branch = Invoke-Api "repos/$repo/branches/main"
$all = @(Invoke-Api "repos/$repo/rulesets?per_page=100")
$active = @($all | Where-Object {
    $_.name -in @('Main branch protection','Immutable release tags') -and $_.enforcement -eq 'active'
})
if (-not $branch.protected -or $active.Count -ne 2) {
    throw 'Postcondition failed: main not protected or expected rulesets missing.'
}
Write-Host "SUCCESS: main protected; two active rulesets. https://github.com/$repo/settings/rules" -ForegroundColor Green
