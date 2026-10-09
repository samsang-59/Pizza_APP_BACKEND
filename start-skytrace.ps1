# SkyTrace AI - one-command start (Windows PowerShell).
#
#   .\start-skytrace.ps1              build the UI and run everything on ONE server: http://localhost:8000
#   .\start-skytrace.ps1 -Dev         hot-reload mode: backend :8000 + Vite dev server :5173
#   .\start-skytrace.ps1 -Reinstall   force re-installing Python and npm dependencies
#
# If scripts are blocked: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
param(
  [switch]$Dev,
  [switch]$Reinstall,
  [int]$Port = 8000,
  [string]$BindHost = "127.0.0.1"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

function Say($msg) { Write-Host "[skytrace] $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "[skytrace] $msg" -ForegroundColor Red; exit 1 }

$py = Get-Command py -ErrorAction SilentlyContinue
if ($py) { $Python = @("py", "-3") } else { $Python = @("python") }
& $Python[0] $Python[1..9] -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if ($LASTEXITCODE -ne 0) { Die "Python 3.11+ is required." }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die "Node.js 18+ is required." }
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if ($LASTEXITCODE -ne 0) { Die "Node.js 18+ is required." }

# --- backend dependencies ---
$Venv = Join-Path $Backend ".venv"
$VenvPy = Join-Path $Venv "Scripts\python.exe"
$Uvicorn = Join-Path $Venv "Scripts\uvicorn.exe"
$installPy = $Reinstall
if (-not (Test-Path $VenvPy)) {
  Say "Creating Python virtual environment..."
  & $Python[0] $Python[1..9] -m venv $Venv
  $installPy = $true
}
if (-not $installPy) {
  & $VenvPy -c "import fastapi, pyproj, shapely" 2>$null
  if ($LASTEXITCODE -ne 0) { $installPy = $true }
}
if ($installPy) {
  Say "Installing backend dependencies..."
  & $VenvPy -m pip install --quiet --upgrade pip
  & $VenvPy -m pip install --quiet -r (Join-Path $Backend "requirements.txt")
  if ($LASTEXITCODE -ne 0) { Die "pip install failed." }
}

# --- frontend dependencies ---
if ($Reinstall -or -not (Test-Path (Join-Path $Frontend "node_modules"))) {
  Say "Installing frontend dependencies..."
  Push-Location $Frontend; npm ci --no-audit --no-fund; $code = $LASTEXITCODE; Pop-Location
  if ($code -ne 0) { Die "npm ci failed." }
}

if ($Dev) {
  Say "Dev mode: backend http://localhost:$Port  -  frontend http://localhost:5173"
  $back = Start-Process -FilePath $Uvicorn -ArgumentList "app.main:app --reload --host $BindHost --port $Port" -WorkingDirectory $Backend -PassThru -NoNewWindow
  try {
    Push-Location $Frontend
    $env:VITE_API_BASE_URL = "http://localhost:$Port"
    npm run dev
  } finally {
    Pop-Location
    if ($back -and -not $back.HasExited) { Stop-Process -Id $back.Id -Force }
  }
  exit 0
}

# --- combined: build UI, serve it from the backend ---
Say "Building the frontend..."
Push-Location $Frontend
$env:VITE_API_BASE_URL = "/"
npm run build --silent
$code = $LASTEXITCODE
Remove-Item Env:VITE_API_BASE_URL
Pop-Location
if ($code -ne 0) { Die "Frontend build failed." }

Say "SkyTrace AI is starting on http://localhost:$Port  (API docs: http://localhost:$Port/docs)"
Say "Press Ctrl+C to stop."
$env:SERVE_FRONTEND = "true"
$env:FRONTEND_DIST = Join-Path $Frontend "dist"
Push-Location $Backend
try { & $Uvicorn app.main:app --host $BindHost --port $Port } finally { Pop-Location }
