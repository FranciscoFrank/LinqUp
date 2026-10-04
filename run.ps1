Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "   Starting LinqUp Platform Services   " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "API: https://localhost:7104" -ForegroundColor Green
Write-Host "Web: https://localhost:7220" -ForegroundColor Green
Write-Host "Press Ctrl+C to terminate both services.`n" -ForegroundColor Yellow

$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Get-Location }

$apiProcess = Start-Process dotnet -ArgumentList "run --project `"$scriptRoot/LinqUp.API`" --launch-profile https" -PassThru -NoNewWindow
$webProcess = Start-Process dotnet -ArgumentList "run --project `"$scriptRoot/LinqUp.Web`" --launch-profile https" -PassThru -NoNewWindow

try {
    Wait-Process -Id $apiProcess.Id, $webProcess.Id
}
finally {
    Write-Host "`nShutting down LinqUp services..." -ForegroundColor Magenta
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($webProcess -and -not $webProcess.HasExited) {
        Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "All services stopped." -ForegroundColor Gray
}
