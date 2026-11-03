# Create Docker configuration without requiring Python on the Windows host.
# Compatible with Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'

$environmentPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
if (Test-Path -LiteralPath $environmentPath) {
    Write-Output '.env already exists; no settings changed.'
    exit 0
}

$randomProvider = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $databaseBytes = New-Object byte[] 24
    $signingBytes = New-Object byte[] 48
    $randomProvider.GetBytes($databaseBytes)
    $randomProvider.GetBytes($signingBytes)
    $databaseSecret = [System.BitConverter]::ToString($databaseBytes).Replace('-', '').ToLowerInvariant()
    $signingSecret = [System.BitConverter]::ToString($signingBytes).Replace('-', '').ToLowerInvariant()
} finally {
    $randomProvider.Dispose()
}

$configuration = @(
    'APP_ENV=development'
    'APP_ORIGIN=http://localhost:3000'
    'WEB_PORT=3000'
    'POSTGRES_USER=fashion'
    'POSTGRES_DB=fashion'
    "POSTGRES_PASSWORD=$databaseSecret"
    "JWT_SECRET=$signingSecret"
    'ACCESS_TOKEN_TTL=900'
    'REFRESH_TOKEN_TTL=604800'
    'LLM_ENABLED=false'
) -join "`n"

# CreateNew also protects an existing file if another setup runs concurrently.
$encoding = New-Object System.Text.UTF8Encoding($false)
$bytes = $encoding.GetBytes($configuration + "`n")
$stream = [System.IO.File]::Open(
    $environmentPath,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
)
try {
    $stream.Write($bytes, 0, $bytes.Length)
} finally {
    $stream.Dispose()
}
Write-Output 'Created .env with random local secrets. Values are not printed.'
