param([ValidateSet('Start','Stop')][string]$Action = 'Start', [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $root '.runtime'
$statePath = Join-Path $runtime 'services.json'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null

function Test-Endpoint([string]$Url) {
    try { return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { return $false }
}
function Stop-OwnedServices($state) {
    foreach ($service in @($state)) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($service.pid)" -ErrorAction SilentlyContinue
        if ($proc -and $proc.CommandLine -and $proc.CommandLine.Contains($root) -and $proc.CreationDate.ToUniversalTime().Ticks.ToString() -eq $service.created) {
            & taskkill.exe /PID $service.pid /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Could not stop $($service.name) (PID $($service.pid))." }
        }
    }
}
$state = @()
if (Test-Path $statePath) { $state = Get-Content -Raw $statePath | ConvertFrom-Json }
if ($Action -eq 'Stop') {
    Stop-OwnedServices $state
    if (Test-Path $statePath) { Remove-Item -LiteralPath $statePath }
    Write-Host 'MINOS services stopped.'
    exit 0
}
if ((Test-Endpoint 'http://127.0.0.1:8000/health') -and (Test-Endpoint 'http://127.0.0.1:5173')) {
    Write-Host 'MINOS is already running: http://127.0.0.1:5173'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
    exit 0
}
foreach ($port in @(8000,5173)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is occupied. Stop the existing service before starting MINOS." }
}
$python = Join-Path $root '.venv\Scripts\python.exe'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$vite = Join-Path $root 'mino-agent\node_modules\vite\bin\vite.js'
if (-not (Test-Path $python) -or -not (Test-Path $vite) -or -not (Test-Path (Join-Path $root 'mino-agent\dist\index.html'))) { throw 'Dependencies or frontend build missing. See DEPLOY-WINDOWS.md.' }
$started = @()
try {
    $backend = Start-Process -FilePath $python -ArgumentList '-m uvicorn app.main:app --host 127.0.0.1 --port 8000' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'backend.log') -RedirectStandardError (Join-Path $runtime 'backend-error.log') -PassThru
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($backend.Id)"
    $started += @{ name='backend'; pid=$backend.Id; created=$proc.CreationDate.ToUniversalTime().Ticks.ToString() }
    $frontend = Start-Process -FilePath $node -ArgumentList "`"$vite`" preview --host 127.0.0.1 --port 5173 --strictPort" -WorkingDirectory (Join-Path $root 'mino-agent') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'frontend.log') -RedirectStandardError (Join-Path $runtime 'frontend-error.log') -PassThru
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($frontend.Id)"
    $started += @{ name='frontend'; pid=$frontend.Id; created=$proc.CreationDate.ToUniversalTime().Ticks.ToString() }
    $started | ConvertTo-Json | Set-Content -Encoding UTF8 $statePath
    $ready = $false
    for ($i=0; $i -lt 45; $i++) {
        if ((Test-Endpoint 'http://127.0.0.1:8000/health') -and (Test-Endpoint 'http://127.0.0.1:5173')) { $ready=$true; break }
        if ($backend.HasExited -or $frontend.HasExited) { throw 'A service exited during startup. Check .runtime logs.' }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Startup timed out. Check .runtime logs.' }
    Write-Host 'MINOS ready: http://127.0.0.1:5173'
    Write-Host 'API documentation: http://127.0.0.1:8000/docs'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
} catch {
    Stop-OwnedServices $started
    throw
}
