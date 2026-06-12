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
$ukTaxPages = @("tax.html", "vat.html", "ir35.html", "stamp-duty.html", "dividend.html")
$canonicalPaths = @{
  "index.html" = "/"; "upload.html" = "/upload"; "tax.html" = "/tax"; "vat.html" = "/vat";
  "json.html" = "/json"; "diff.html" = "/diff"; "token.html" = "/token"; "qr.html" = "/qr";
  "pdf2img.html" = "/pdf2img"; "mortgage.html" = "/mortgage"; "ir35.html" = "/ir35";
  "stamp-duty.html" = "/stamp-duty"; "dividend.html" = "/dividend"; "password.html" = "/password";
  "image.html" = "/image"; "color-picker.html" = "/color-picker"; "working-days.html" = "/working-days";
  "fuel.html" = "/fuel"; "weight.html" = "/weight"; "about.html" = "/about"; "contact.html" = "/contact"; "privacy.html" = "/privacy"
}
$navLinks = @("/", "/#search", "/#popular", "/#uk-apps", "/#developer-tools", "/#other-tools", "/about", "/contact", "/privacy")
$footerLinks = @("/", "/about", "/contact", "/privacy")

foreach ($page in $publicPages) {
  $html = Read-SiteFile $page.Name
  Assert-True ($html -notmatch 'href=["'']/(?:blog(?:/|["''])|terms/?["'']|acceptable-use/?["''])') "$($page.Name) has a retired link"
  Assert-True (([regex]::Matches($html, '<nav\b', "IgnoreCase")).Count -eq ([regex]::Matches($html, '</nav>', "IgnoreCase")).Count) "$($page.Name) has unbalanced nav markup"
  Assert-True (([regex]::Matches($html, '<footer\b', "IgnoreCase")).Count -eq ([regex]::Matches($html, '</footer>', "IgnoreCase")).Count) "$($page.Name) has unbalanced footer markup"
  $restrictedAdAreas = [regex]::Matches($html, '<(?:nav|[^>]+\b(?:class|id)=["''][^"'']*(?:empty|error|upload-result|result)[^"'']*["''])\b[\s\S]*?</(?:nav|div|section|aside)>', "IgnoreCase")
  foreach ($area in $restrictedAdAreas) {
    Assert-True ($area.Value -notmatch 'adsbygoogle|data-ad-client|data-ad-slot|ad-container|ad-unit|ad-slot') "$($page.Name) places ad code in a restricted area"
  }
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
  Assert-True ((Read-SiteFile $page.Name) -notmatch '<header\s+class=["'']site-header["'']') "$($page.Name) still wraps the unified nav in its legacy header"
}
$sharedNavCss = Read-SiteFile "site-nav.css"
Assert-True ($sharedNavCss.Contains('--site-shell-width: 1180px;')) "shared navigation does not define the common page width"
Assert-True ($sharedNavCss.Contains('max-width: var(--site-shell-width) !important;')) "shared navigation and content do not use the common page width"
Assert-True ($sharedNavCss.Contains('right: 0 !important;')) "shared navigation does not keep the language selector on the right"
Assert-True ($sharedNavCss.Contains('justify-content: space-between !important;')) "shared navigation does not use homepage alignment"
Assert-True ($sharedNavCss.Contains('flex-direction: column !important;')) "shared navigation does not provide the responsive stacked layout"

foreach ($page in $publicPages) {
  $html = Read-SiteFile $page.Name
  Assert-True ($html -match 'data-site-nav="home"') "$($page.Name) misses translatable navigation"
  foreach ($language in @("en", "zh-CN", "de", "fr", "es")) {
    Assert-True ($html.Contains("data-site-lang=`"$language`"")) "$($page.Name) misses language option $language"
  }
  Assert-True (([regex]::Matches($html, '<script\b[^>]*src=["'']site-i18n\.js["''][^>]*></script>', "IgnoreCase")).Count -eq 1) "$($page.Name) must load site-i18n.js exactly once"
  Assert-True ($html -notmatch 'id=["'']site-nav-language["'']') "$($page.Name) still contains the copied language runtime"
  Assert-True ($html.Contains('href="site-nav.css"')) "$($page.Name) does not use the local-and-web compatible shared navigation stylesheet"
  Assert-True (([regex]::Matches($html, '<link\b[^>]*href=["''][^"'']*site-nav\.css[^"'']*["''][^>]*>', "IgnoreCase")).Count -eq 1) "$($page.Name) must load site-nav.css exactly once"
  Assert-True ($html -notmatch 'ui-refresh\.css') "$($page.Name) still loads the retired competing UI stylesheet"
  Assert-True ($html -notmatch 'href=["'']/site-nav\.css["'']') "$($page.Name) uses a root-relative stylesheet that breaks file:// previews"
  Assert-True ($html -notmatch 'id=["'']site-nav-style["'']') "$($page.Name) still contains copied inline navigation CSS"
  Assert-True ($html.Contains('aria-expanded="false"')) "$($page.Name) language menu trigger is missing click-expanded state"
}

$sharedI18n = Read-SiteFile "site-i18n.js"
Assert-True ($sharedI18n.Contains('window.MiniToolsI18n')) "shared i18n runtime does not expose its public API"
Assert-True ($sharedI18n.Contains('navigator.language')) "shared i18n runtime does not fall back to browser language"
Assert-True ($sharedI18n.Contains('history.replaceState(null, "", target.pathname + target.search + target.hash)')) "shared i18n runtime reloads instead of updating language in place"
Assert-True ($sharedI18n -match 'searchParams\.set\(["'']lang["'']') "shared i18n runtime does not localize internal links"
Assert-True ($sharedI18n.Contains('data-i18n-placeholder')) "shared i18n runtime does not translate placeholders"
Assert-True ($sharedI18n.Contains('data-i18n-aria-label')) "shared i18n runtime does not translate aria labels"

Assert-True ($sharedNavCss -notmatch 'site-lang-group:hover\s+\.site-lang-dropdown') "language dropdown still opens on hover"
Assert-True ($sharedNavCss -match 'site-lang-group\.open\s+\.site-lang-dropdown') "language dropdown does not open by click state"
Assert-True ((Read-SiteFile "upload.html").Contains("applyUploadGuidanceLanguage")) "upload page guidance is not translatable"
Assert-True ((Read-SiteFile "upload.html") -notmatch 'miniToolsUploadLang') "upload page still lets stored language override browser language"

foreach ($page in $toolPages) {
  Assert-True ((Read-SiteFile $page) -match '<meta\s+name=["'']robots["'']\s+content=["''][^"'']*index\s*,?\s*follow') "$page is not index,follow"
}

foreach ($page in $toolPages) {
  $html = Read-SiteFile $page
  Assert-True ($html -notmatch 'Original notes') "$page still contains development notes"
  if ($page -eq "diff.html") {
    Assert-True ($html -match 'data-i18n="contentTitle"') "$page misses translated guidance content"
    Assert-True ($html -match 'data-i18n="useTitle"') "$page misses translated use cases"
    Assert-True ($html -match 'data-i18n="relatedTitle"') "$page misses translated related tools"
    Assert-True ($html -notmatch 'id=["'']tool-guidance["'']') "$page still contains duplicate English guidance"
    continue
  }
  if ($page -eq "color-picker.html") {
    Assert-True ($html -match 'data-i18n-html="seoHtml"') "$page misses translated guidance content"
    Assert-True ($html -match 'Frequently asked questions') "$page misses FAQ content"
    Assert-True ($html -notmatch 'id=["'']tool-guidance["'']') "$page still contains duplicate English guidance"
    continue
  }
  foreach ($phrase in @("How to use", "Use cases", "Limitations", "FAQ", "Related tools")) {
    Assert-True ($html -match [regex]::Escape($phrase)) "$page misses tool guidance section phrase: $phrase"
  }
}

foreach ($page in $ukTaxPages) {
  $html = Read-SiteFile $page
  Assert-True ($html -match 'Sources and assumptions') "$page misses sources and assumptions"
  Assert-True ($html -match 'Last checked: 9 June 2026') "$page misses Last checked date"
  Assert-True ($html -match 'https://www\.gov\.uk/') "$page misses GOV.UK source link"
}

foreach ($entry in $canonicalPaths.GetEnumerator()) {
  $html = Read-SiteFile $entry.Key
  $clean = "https://mini-tools.uk$($entry.Value)"
  Assert-True ($html -match ('<link\s+rel=["'']canonical["'']\s+href=["'']' + [regex]::Escape($clean) + '["'']')) "$($entry.Key) canonical is not the clean URL"
  foreach ($lang in @("en", "zh-CN", "de", "fr", "es")) {
    $expected = "$clean`?lang=$lang"
    Assert-True ($html -match ('<link\s+rel=["'']alternate["'']\s+hreflang=["'']' + [regex]::Escape($lang) + '["'']\s+href=["'']' + [regex]::Escape($expected) + '["'']')) "$($entry.Key) misses hreflang $lang"
  }
  Assert-True ($html -match ('<link\s+rel=["'']alternate["'']\s+hreflang=["'']x-default["'']\s+href=["'']' + [regex]::Escape($clean) + '["'']')) "$($entry.Key) misses x-default"
}

foreach ($page in $publicPages) {
  $html = Read-SiteFile $page.Name
  Assert-True ($html -notmatch 'applyCanonicalHreflang') "$($page.Name) still copies canonical/hreflang runtime code"
}
Assert-True ($sharedI18n -match 'applyCanonicalHreflang') "shared i18n runtime does not normalize canonical/hreflang"

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
foreach ($pattern in @('initialPathname === "/terms"', 'initialPathname === "/acceptable-use"', 'url.pathname.endsWith(".html")')) {
  Assert-True ($worker.Contains($pattern)) "_worker.js misses $pattern"
}
Assert-True ($worker -match 'initialPathname === "/blog"[\s\S]*?status:\s*410') "_worker.js does not retire Blog URLs with 410"
Assert-True ($worker -notmatch 'miniToolsBlogLang') "_worker.js still contains obsolete Blog language state"

$expectedRobots = "User-agent: *`nAllow: /`n`nSitemap: https://mini-tools.uk/sitemap.xml"
Assert-True ((Read-SiteFile "robots.txt").Trim().Replace("`r`n", "`n") -eq $expectedRobots) "robots.txt differs from contract"
$locs = [regex]::Matches((Read-SiteFile "sitemap.xml"), '<loc>([^<]+)</loc>') | ForEach-Object { $_.Groups[1].Value }
$expectedLocs = @(
  "https://mini-tools.uk/", "https://mini-tools.uk/tax", "https://mini-tools.uk/vat",
  "https://mini-tools.uk/mortgage", "https://mini-tools.uk/ir35", "https://mini-tools.uk/stamp-duty",
  "https://mini-tools.uk/dividend", "https://mini-tools.uk/json", "https://mini-tools.uk/diff",
  "https://mini-tools.uk/token", "https://mini-tools.uk/qr", "https://mini-tools.uk/password",
  "https://mini-tools.uk/upload", "https://mini-tools.uk/image", "https://mini-tools.uk/pdf2img",
  "https://mini-tools.uk/color-picker", "https://mini-tools.uk/working-days", "https://mini-tools.uk/fuel",
  "https://mini-tools.uk/weight", "https://mini-tools.uk/about", "https://mini-tools.uk/contact",
  "https://mini-tools.uk/privacy"
)
Assert-True (($locs -join "|") -eq ($expectedLocs -join "|")) "sitemap.xml differs from contract"

Write-Output "Site contract passed: $($publicPages.Count) public pages checked."
