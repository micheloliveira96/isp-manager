$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'Conectar ISP Manager (Vercel) ao MikroTik do laboratorio'
Write-Host 'O Docker Desktop e o gateway precisam estar em execucao.'
$cloudUrl = (Read-Host 'Endereco do ISP Manager, por exemplo https://isp-manager-two.vercel.app').Trim().TrimEnd('/')
$parsedUrl = $null
if (-not [Uri]::TryCreate($cloudUrl, [UriKind]::Absolute, [ref]$parsedUrl) -or $parsedUrl.Scheme -ne 'https' -or $parsedUrl.AbsolutePath -ne '/' -or $parsedUrl.UserInfo -or $parsedUrl.Query -or $parsedUrl.Fragment) { throw 'Informe somente a origem HTTPS do sistema.' }
$secureToken = Read-Host 'Cole a chave de instalacao criada no painel MikroTik (entrada oculta)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try { $agentToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if ($agentToken -notmatch '^[A-Za-z0-9_-]{43}$') { throw 'Chave de instalacao invalida.' }
$gatewayEnvPath = 'C:\mikrotik-lab\mikrotik-gateway\.env'
if (-not (Test-Path -LiteralPath $gatewayEnvPath)) { throw 'Nao encontrei o gateway do laboratorio.' }
$settings = @{}
foreach ($line in [IO.File]::ReadAllLines($gatewayEnvPath)) { if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2].Trim() } }
if (-not $settings.GATEWAY_TOKEN -or $settings.GATEWAY_TOKEN.Length -lt 32) { throw 'Token local do gateway ausente.' }
& docker inspect mikrotik-gateway --format '{{.State.Health.Status}}'
if ($LASTEXITCODE -ne 0) { throw 'Inicie o gateway antes de configurar o agente.' }
$envPath = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envPath) {
  $backupDir = Join-Path $env:LOCALAPPDATA 'ISP-Mikrotik\backups'
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  Copy-Item -LiteralPath $envPath -Destination (Join-Path $backupDir ('agent-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.env'))
}
$value = 'ISP_URL=' + $cloudUrl + "`r`nISP_AGENT_TOKEN=" + $agentToken + "`r`nGATEWAY_TOKEN=" + $settings.GATEWAY_TOKEN + "`r`n"
[IO.File]::WriteAllText($envPath, $value, (New-Object Text.UTF8Encoding($false)))
# Restringe o arquivo ao usuario atual e SYSTEM. Nao imprime valores.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $envPath /inheritance:r /grant:r ($identity + ':(F)') '*S-1-5-18:(F)' | Out-Null
& docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar agente.' }
Write-Host 'Agente iniciado. Abra /mikrotik no sistema e aguarde ate 60 segundos.'
Write-Host 'Se aparecer offline: docker compose logs --tail 20 agent'
Write-Host 'Nenhuma credencial deve ser enviada por chat.'
