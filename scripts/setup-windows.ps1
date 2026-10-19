$ErrorActionPreference = "Stop"
function New-UrlSafeSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+','A').Replace('/','B')
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker não foi encontrado. Instala o Docker Desktop e volta a executar este script."
}
docker info | Out-Null
if (-not (Test-Path ".env")) {
  $adminName = Read-Host "Nome do primeiro gestor"
  $adminEmail = Read-Host "Email do primeiro gestor"
  $dbPassword = New-UrlSafeSecret 32
  $adminPassword = New-UrlSafeSecret 18
  $sessionSecret = New-UrlSafeSecret 48
  $envText = @"
APP_NAME="ISP Manager"
APP_URL=http://localhost:3000
NODE_ENV=production
DEFAULT_ORGANIZATION_SLUG=empresa-principal
COMPANY_NAME="Minha empresa"
DATABASE_URL="postgresql://isp_app:$dbPassword@db:5432/isp_manager?schema=public"
POSTGRES_DB=isp_manager
POSTGRES_USER=isp_app
POSTGRES_PASSWORD=$dbPassword
SESSION_SECRET=$sessionSecret
INITIAL_ADMIN_NAME="$adminName"
INITIAL_ADMIN_EMAIL="$adminEmail"
INITIAL_ADMIN_PASSWORD=$adminPassword
"@
  Set-Content -Path ".env" -Value $envText -Encoding utf8
} else {
  Write-Host "Foi encontrado um .env existente; será utilizado sem alterações." -ForegroundColor Yellow
  $adminPassword = $null
  $adminEmail = $null
}
Write-Host "A construir e iniciar ISP Manager..." -ForegroundColor Cyan
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar os contentores." }
Write-Host "A aguardar a aplicação..." -ForegroundColor Cyan
Start-Sleep -Seconds 8
docker compose exec -T app npm run db:seed
if ($LASTEXITCODE -ne 0) { throw "A inicialização do gestor falhou. Verifica .env e os logs com: docker compose logs app" }
Write-Host ""
Write-Host "ISP Manager foi iniciado em http://localhost:3000" -ForegroundColor Green
if ($adminPassword) {
  Write-Host "Email do gestor: $adminEmail" -ForegroundColor Yellow
  Write-Host "Palavra-passe inicial (guarda-a agora): $adminPassword" -ForegroundColor Yellow
  Write-Host "Guarda esta palavra-passe num gestor de palavras-passe e não a envies por email/chat." -ForegroundColor Yellow
}
Write-Host "Para aceder a partir de outros equipamentos da rede, utiliza o IP local deste computador na porta 3000."
