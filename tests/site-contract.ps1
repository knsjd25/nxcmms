$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Read-SiteFile([string]$RelativePath) {
  $path = Join-Path $root $RelativePath
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) {
    throw "Site contract failed: $Message"
  }
}

$publicFiles = @(
  "index.html",
  "upload.html",
  "image-api.html",
  "free-image-hosting.html",
  "temporary-image-upload.html",
  "share-image-link.html",
  "json.html",
  "diff.html",
  "token.html",
  "qr.html",
  "password.html",
  "color-picker.html",
  "about.html",
  "contact.html",
  "privacy.html"
)

$retiredFiles = @(
  "tax.html",
  "vat.html",
  "mortgage.html",
  "ir35.html",
  "stamp-duty.html",
  "dividend.html",
  "working-days.html",
  "fuel.html",
  "weight.html",
  "image.html",
  "pdf2img.html",
  "map.html"
)

foreach ($file in $publicFiles) {
  $path = Join-Path $root $file
  Assert-True (Test-Path -LiteralPath $path -PathType Leaf) "$file is missing"

  $html = Read-SiteFile $file
  Assert-True ($html -match '<title\b[^>]*>[^<]+</title>') "$file has no title"
  Assert-True ($html -match 'class="site-nav"') "$file has no shared navigation"
  Assert-True ($html -match 'class="footer') "$file has no shared footer"
  Assert-True ($html -match 'site-i18n\.js') "$file does not load the shared language runtime"
  Assert-True ($html -notmatch 'href=["'']/(tax|vat|mortgage|ir35|stamp-duty|dividend|working-days|fuel|weight|image|pdf2img)([/?#"'']|$)') "$file links to a retired feature"
  Assert-True ($html -notmatch 'Original notes|lorem ipsum') "$file contains development leftovers"
  Assert-True ($html -cnotmatch '\bTODO\b|\bFIXME\b') "$file contains development markers"
}

foreach ($file in $retiredFiles) {
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $root $file))) "$file must be deleted"
}

$homepage = Read-SiteFile "index.html"
Assert-True ($homepage -match 'class="upload-launcher" href="/upload"') "homepage primary upload action is missing"
Assert-True ($homepage -match 'href="/image-api"[^>]*data-i18n="apiCta"') "homepage API action is missing"
Assert-True ($homepage -match 'Image hosting for fast, shareable links') "homepage hero headline is missing"
Assert-True ($homepage -notmatch 'WORKER_URL|new FormData\(') "homepage must delegate uploads to /upload"

$heroAsset = Join-Path $root "assets\image-hosting-hero.png"
Assert-True (Test-Path -LiteralPath $heroAsset -PathType Leaf) "social preview image asset is missing"
Assert-True ((Get-Item -LiteralPath $heroAsset).Length -gt 100000) "social preview image asset is unexpectedly small"

$upload = Read-SiteFile "upload.html"
foreach ($marker in @(
  "WORKER_URL",
  "fileInput",
  "previewImage",
  "durationSelect",
  "storageCodeInput",
  "captchaAnswerInput",
  "FormData",
  "directUrl",
  "markdownOutput",
  "htmlOutput",
  "bbcodeOutput"
)) {
  Assert-True ($upload.Contains($marker)) "upload.html lost protected marker $marker"
}

$apiDocs = Read-SiteFile "image-api.html"
foreach ($marker in @(
  "POST /v1/upload",
  "GET /v1/usage",
  "GET /v1/images",
  "DELETE /v1/images/:key",
  "X-API-User-ID",
  "Idempotency-Key",
  "yuyananuu@gmail.com"
)) {
  Assert-True ($apiDocs.Contains($marker)) "image-api.html lost $marker"
}

$worker = Read-SiteFile "_worker.js"
foreach ($route in @(
  "/tax",
  "/vat",
  "/mortgage",
  "/ir35",
  "/stamp-duty",
  "/dividend",
  "/working-days",
  "/fuel",
  "/weight",
  "/image",
  "/image-compressor",
  "/pdf2img",
  "/pdf-to-image",
  "/map"
)) {
  Assert-True ($worker.Contains('"' + $route + '"')) "_worker.js does not retire $route"
}
Assert-True ($worker -match 'RETIRED_PATHS\.has\(normalizePathname\(initialPathname\)\)') "_worker.js does not enforce retired routes"
Assert-True ($worker -match 'render404\(request,\s*env,\s*410\)') "_worker.js does not return the unified 410 page"

$sitemap = Read-SiteFile "sitemap.xml"
$expectedPaths = @(
  "/",
  "/upload",
  "/image-api",
  "/free-image-hosting",
  "/temporary-image-upload",
  "/share-image-link",
  "/json",
  "/diff",
  "/token",
  "/qr",
  "/password",
  "/color-picker",
  "/about",
  "/contact",
  "/privacy"
)
$actualPaths = [regex]::Matches($sitemap, '<loc>https://mini-tools\.uk([^<]*)</loc>') |
  ForEach-Object { if ($_.Groups[1].Value -eq "") { "/" } else { $_.Groups[1].Value } }
Assert-True ((Compare-Object $expectedPaths $actualPaths).Count -eq 0) "sitemap.xml differs from the retained public routes"

Write-Output "Site contract passed: $($publicFiles.Count) public pages checked; $($retiredFiles.Count) retired files absent."
