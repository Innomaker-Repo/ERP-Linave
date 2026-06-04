<#
.SYNOPSIS
  Levanta el ERP-Linave (backend Django + frontend Vite) y lo expone a
  Internet con un único túnel de ngrok para que alguien en otra red pruebe.

.DESCRIPTION
  - Backend Django  -> http://localhost:8000  (0.0.0.0 para el proxy)
  - Frontend Vite   -> http://localhost:5173  (con VITE_TUNNEL=1)
  - ngrok           -> expone el puerto 5173 (frontend + API por proxy)

  El frontend habla con el backend por rutas relativas y Vite hace de proxy,
  por eso basta UN solo túnel: comparte la URL https que imprime este script.

.EXAMPLE
  .\start-tunnel.ps1
#>

$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$backend  = Join-Path $root 'BackEnd'
$frontend = Join-Path $root 'FrontEnd'

Write-Host ''
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host '  ERP-Linave  ->  arranque + tunel ngrok'   -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''

# --- 0) Verificar authtoken de ngrok (one-time) ---------------------------
$null = & ngrok config check 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '[!] ngrok no tiene authtoken configurado.' -ForegroundColor Yellow
    Write-Host '    1) Crea una cuenta gratis en https://dashboard.ngrok.com/signup'
    Write-Host '    2) Copia tu token en https://dashboard.ngrok.com/get-started/your-authtoken'
    Write-Host '    3) Ejecuta una sola vez:  ngrok config add-authtoken <TU_TOKEN>'
    Write-Host '    Luego vuelve a correr este script.' -ForegroundColor Yellow
    exit 1
}

# --- 1) Backend Django -----------------------------------------------------
Write-Host '[1/3] Iniciando backend Django (puerto 8000)...' -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$backend'; python manage.py runserver 0.0.0.0:8000"
)

# --- 2) Frontend Vite ------------------------------------------------------
Write-Host '[2/3] Iniciando frontend Vite (puerto 5173)...' -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$frontend'; `$env:VITE_TUNNEL='1'; npm run dev"
)

# --- 3) ngrok --------------------------------------------------------------
Write-Host '[3/3] Abriendo tunel ngrok sobre el puerto 5173...' -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "ngrok http 5173"
)

# --- 4) Esperar y mostrar la URL publica -----------------------------------
Write-Host ''
Write-Host 'Esperando a que ngrok publique la URL...' -ForegroundColor Cyan
$publicUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels' -ErrorAction Stop
        $httpsTunnel = $resp.tunnels | Where-Object { $_.public_url -like 'https*' } | Select-Object -First 1
        if ($httpsTunnel) { $publicUrl = $httpsTunnel.public_url; break }
    } catch {
        # ngrok aun no levanto su API local; reintentar
    }
}

Write-Host ''
if ($publicUrl) {
    Write-Host '======================================================' -ForegroundColor Green
    Write-Host '  LISTO. Comparte esta URL con tu amigo:' -ForegroundColor Green
    Write-Host "  $publicUrl" -ForegroundColor White
    Write-Host '======================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Panel de ngrok (estado/logs): http://localhost:4040' -ForegroundColor DarkGray
    Set-Clipboard -Value $publicUrl
    Write-Host '  (URL copiada al portapapeles)' -ForegroundColor DarkGray
} else {
    Write-Host '[!] No se pudo leer la URL automaticamente.' -ForegroundColor Yellow
    Write-Host '    Mirala en la ventana de ngrok o en http://localhost:4040' -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'Para detener todo: cierra las 3 ventanas (Django, Vite, ngrok).' -ForegroundColor DarkGray
