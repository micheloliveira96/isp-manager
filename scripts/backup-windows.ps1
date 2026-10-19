$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$target = Join-Path $backupDir "isp-manager-$timestamp.sql"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | Set-Content -Path $target -Encoding utf8
if ($LASTEXITCODE -ne 0) { Remove-Item $target -ErrorAction SilentlyContinue; throw "Backup falhou." }
Write-Host "Backup criado: $target" -ForegroundColor Green
Write-Host "Copia este ficheiro para outro dispositivo/local seguro. Não guardes o único backup no próprio mini-PC."
