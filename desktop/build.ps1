param([switch]$SkipWebBuild)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if (-not $SkipWebBuild) {
    Push-Location (Join-Path $root 'pi-web')
    try { & npm.cmd run build; if($LASTEXITCODE -ne 0){throw 'Web build failed'} } finally { Pop-Location }
}
if (-not(Test-Path "$root\.runtime\packaging\python\python.exe")) { throw 'Provision CPython embedded + requirements-local.txt first. See desktop/electron/README.md.' }
& "$root\.venv\Scripts\python.exe" "$PSScriptRoot\stage.py"
if($LASTEXITCODE -ne 0){throw 'Stage failed'}
Push-Location "$PSScriptRoot\electron"
try {
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    & npm.cmd ci --no-audit --no-fund
    if($LASTEXITCODE -ne 0){throw 'Electron dependency installation failed'}
    $env:ELECTRON_BUILDER_COMPRESSION_LEVEL='0'
    & npm.cmd run pack
    if($LASTEXITCODE -ne 0){throw 'Electron installer build failed'}
} finally { Pop-Location }
Get-FileHash "$root\dist\electron\MINOS-Electron-Setup-1.0.0-x64.exe" -Algorithm SHA256 | Format-List
