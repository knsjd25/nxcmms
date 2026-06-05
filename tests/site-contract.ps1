$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Read-SiteFile([string]$name) {
  return [System.IO.File]::ReadAllText((Join-Path $root $name))
}

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) { throw $message }
}

$excluded = @("image_admin.html", "map.html")
$publicPages = Get-ChildItem -LiteralPath $root -Filter "*.html" | Where-Object { $excluded -notcontains $_.Name }
$keyPages = @("index.html", "about.html", "upload.html", "tax.html", "contact.html", "privacy.html")
$toolPages = @("upload.html", "tax.html", "vat.html", "json.html", "diff.html", "token.html", "qr.html", "pdf2img.html", "mortgage.html", "ir35.html", "stamp-duty.html", "dividend.html", "password.html", "image.html", "color-picker.html", "working-days.html", "fuel.html", "weight.html")
$navLinks = @("/", "/#search", "/#popular", "/#uk-apps", "/#developer-tools", "/#other-tools", "/about", "/contact", "/privacy")
$footerLinks = @("/", "/about", "/contact", "/privacy")

foreach ($page in $publicPages) {
  $html = Read-SiteFile $page.Name
  Assert-True ($html -notmatch 'href=["'']/(?:blog(?:/|["''])|terms/?["'']|acceptable-use/?["''])') "$($page.Name) has a retired link"
  Assert-True (([regex]::Matches($html, '<nav\b', "IgnoreCase")).Count -eq ([regex]::Matches($html, '</nav>', "IgnoreCase")).Count) "$($page.Name) has unbalanced nav markup"
  Assert-True (([regex]::Matches($html, '<footer\b', "IgnoreCase")).Count -eq ([regex]::Matches($html, '</footer>', "IgnoreCase")).Count) "$($page.Name) has unbalanced footer markup"
}

foreach ($page in $keyPages) {
  $html = Read-SiteFile $page
  $nav = [regex]::Match($html, '<nav\b[\s\S]*?</nav>', "IgnoreCase").Value
  $footer = [regex]::Match($html, '<footer\b[\s\S]*?</footer>', "IgnoreCase").Value
  foreach ($href in $navLinks) { Assert-True ($nav -match ('href=["'']' + [regex]::Escape($href) + '["'']')) "$page nav misses $href" }
  foreach ($href in $footerLinks) { Assert-True ($footer -match ('href=["'']' + [regex]::Escape($href) + '["'']')) "$page footer misses $href" }
  Assert-True ($nav -notmatch 'Blog|Terms|Acceptable Use|All Tools|UK Finance|Image & PDF|Security|Categories') "$page nav has an old item"
  Assert-True ($footer -notmatch 'Blog|Terms|Acceptable Use|All Tools|Categories') "$page footer has an old item"
}

foreach ($page in $publicPages) {
  $html = Read-SiteFile $page.Name
  Assert-True ($html -match 'data-site-nav="home"') "$($page.Name) misses translatable navigation"
  foreach ($language in @("en", "zh-CN", "de", "fr", "es")) {
    Assert-True ($html.Contains("?lang=$language")) "$($page.Name) misses language option $language"
  }
  Assert-True ($html.Contains('id="site-nav-language"')) "$($page.Name) misses navigation language script"
}

foreach ($page in $toolPages) {
  Assert-True ((Read-SiteFile $page) -match '<meta\s+name=["'']robots["'']\s+content=["''][^"'']*index\s*,?\s*follow') "$page is not index,follow"
}

$requiredContent = @{
  "about.html" = @("tool directory", "UK Apps", "Developer Tools", "Other Tools", "UK Tax Calculator", "VAT Calculator", "Mortgage Calculator", "IR35 Calculator", "Stamp Duty Calculator", "Dividend Calculator", "JSON Formatter", "Text Diff Checker", "AI Token Calculator", "QR Code Generator", "Password Generator", "Free Image Hosting", "Image Compressor", "PDF to Image", "Color Picker", "Working Days Calculator", "Fuel Cost Calculator", "Weight Converter", "without an account")
  "privacy.html" = @("browser", "remote service", "not private", "1 day", "7 days", "30 days", "approved code", "image URL", "illegal content", "adult content", "violent content", "hateful content", "copyrighted images", "private ID", "passport", "financial documents", "medical records", "malware", "phishing", "scam", "minors", "confidential screenshots", "Google Analytics", "advertising", "cookies", "localStorage")
  "contact.html" = @("bug report", "feature suggestion", "calculation issue", "image removal request", "abuse report", "privacy question", "hosted image URL", "reason", "rights details")
  "upload.html" = @("What not to upload", "Removal and abuse reports", "Privacy note")
  "tax.html" = @("estimates only", "not official tax advice", "not legal or financial advice")
}

foreach ($entry in $requiredContent.GetEnumerator()) {
  $html = Read-SiteFile $entry.Key
  foreach ($phrase in $entry.Value) { Assert-True ($html -match [regex]::Escape($phrase)) "$($entry.Key) misses $phrase" }
}

$worker = Read-SiteFile "_worker.js"
foreach ($pattern in @('initialPathname === "/terms"', 'initialPathname === "/acceptable-use"', 'initialPathname === "/blog"', 'initialPathname.startsWith("/blog/")', 'status: 410', 'url.pathname.endsWith(".html")')) {
  Assert-True ($worker.Contains($pattern)) "_worker.js misses $pattern"
}

$expectedRobots = "User-agent: *`nAllow: /`n`nSitemap: https://mini-tools.uk/sitemap.xml"
Assert-True ((Read-SiteFile "robots.txt").Trim().Replace("`r`n", "`n") -eq $expectedRobots) "robots.txt differs from contract"
$locs = [regex]::Matches((Read-SiteFile "sitemap.xml"), '<loc>([^<]+)</loc>') | ForEach-Object { $_.Groups[1].Value }
$expectedLocs = @(
  "https://mini-tools.uk/", "https://mini-tools.uk/upload", "https://mini-tools.uk/tax",
  "https://mini-tools.uk/vat", "https://mini-tools.uk/json", "https://mini-tools.uk/diff",
  "https://mini-tools.uk/token", "https://mini-tools.uk/qr", "https://mini-tools.uk/pdf2img",
  "https://mini-tools.uk/mortgage", "https://mini-tools.uk/ir35", "https://mini-tools.uk/stamp-duty",
  "https://mini-tools.uk/dividend", "https://mini-tools.uk/password", "https://mini-tools.uk/image",
  "https://mini-tools.uk/color-picker", "https://mini-tools.uk/working-days", "https://mini-tools.uk/fuel",
  "https://mini-tools.uk/weight", "https://mini-tools.uk/about", "https://mini-tools.uk/contact",
  "https://mini-tools.uk/privacy"
)
Assert-True (($locs -join "|") -eq ($expectedLocs -join "|")) "sitemap.xml differs from contract"

Write-Output "Site contract passed: $($publicPages.Count) public pages checked."
