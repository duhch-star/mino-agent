param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$target=Join-Path $root '.runtime\installed-electron'
$data=Join-Path $root '.runtime\installed-electron-data'
$installerPath=(Resolve-Path $Installer).Path
$p=Start-Process -FilePath $installerPath -ArgumentList "/S /D=$target" -PassThru -Wait
if($p.ExitCode -ne 0){throw "Installer exit $($p.ExitCode)"}
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:MINOS_PAYLOAD -ErrorAction SilentlyContinue
$p=Start-Process "$target\MINOS.exe" -ArgumentList "--smoke-test --data-dir=$data" -PassThru -Wait
if($p.ExitCode -ne 0){throw "Installed app smoke failed: $data\smoke-test.json"}
Write-Host "Installed Electron app smoke passed. Report: $data\smoke-test.json"
