<#
Script de suporte para desenvolvimento: abre a porta 8000 no firewall (opcional)
e inicia o servidor Django ligado em todas as interfaces (0.0.0.0:8000).

Uso (PowerShell com privilégios de Administrador):
    .\start_backend.ps1 -AllowFirewall
ou
    .\start_backend.ps1

- `-AllowFirewall` adiciona uma regra de entrada para a porta 8000.

Observação: este script é apenas para ambiente de desenvolvimento.
#>

[CmdletBinding()]
param(
    [switch]$AllowFirewall = $false,
    [int]$Port = 8000
)

function Ensure-FirewallRule {
    param([int]$Port)
    $ruleName = "ERP Linave Django $Port"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Host "Criando regra de firewall para porta $Port..." -ForegroundColor Green
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
        Write-Host "Regra criada: $ruleName"
    } else {
        Write-Host "Regra de firewall já existe: $ruleName"
    }
}

try {
    if ($AllowFirewall) {
        if (-not ([bool]([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))) {
            Write-Warning "Este comando precisa ser executado como Administrador para adicionar regras de firewall. Execute: Start-Process PowerShell -Verb RunAs"
        } else {
            Ensure-FirewallRule -Port $Port
        }
    }

    Write-Host "Iniciando servidor Django em 0.0.0.0:$Port ..." -ForegroundColor Cyan
    python manage.py runserver 0.0.0.0:$Port
} catch {
    Write-Error "Erro ao iniciar o backend: $_"
}
