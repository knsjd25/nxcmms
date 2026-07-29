param(
  [string]$OutputDirectory = "",
  [string]$CredentialPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$resolvedCredentialPath = $CredentialPath
if (-not $resolvedCredentialPath) {
  $resolvedCredentialPath = [Environment]::GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", "User")
}
if (-not $resolvedCredentialPath) {
  throw "GOOGLE_APPLICATION_CREDENTIALS is not configured in the Windows user environment."
}
if (-not (Test-Path -LiteralPath $resolvedCredentialPath -PathType Leaf)) {
  throw "The configured Google credential file does not exist: $resolvedCredentialPath"
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $resolvedCredentialPath
$env:MINITOOLS_GSC_PROPERTY = "sc-domain:mini-tools.uk"
$env:MINITOOLS_GA4_PROPERTY_ID = "526213865"
$nodeArgs = @((Join-Path $PSScriptRoot "site-analytics.mjs"))
if ($OutputDirectory) {
  $nodeArgs += @("--output-dir", $OutputDirectory)
}

& node @nodeArgs
if ($LASTEXITCODE -ne 0) {
  throw "Analytics collection failed with exit code $LASTEXITCODE."
}
