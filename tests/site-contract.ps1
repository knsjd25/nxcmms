$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Read-SiteFile([string]$name) {
  return [System.IO.File]::ReadAllText((Join-Path $root $name))
}

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) { throw $message }
}

$excluded = @("404.html", "image_admin.html", "map.html")
$publicPages = Get-ChildItem -LiteralPath $root -Filter "*.html" | Where-Object { $excluded -notcontains $_.Name }
$keyPages = @("index.html", "about.html", "upload.html", "tax.html", "contact.html", "privacy.html")
$toolPages = @("upload.html", "tax.html", "vat.html", "json.html", "diff.html", "token.html", "qr.html", "pdf2img.html", "mortgage.html", "ir35.html", "stamp-duty.html", "dividend.html", "password.html", "image.html", "color-picker.html", "working-days.html", "fuel.html", "weight.html")
$bespokeGuidancePages = @{
  "dividend.html" = @("howTitle", "usefulTitle", "relatedTitle")
  "fuel.html" = @("articleTitle", "formulaTitle", "whyUsefulTitle")
  "ir35.html" = @("contentTitle", "notDoTitle", "relatedTitle")
  "json.html" = @("articleTitle", "privacyTitle", "useTitle")
  "mortgage.html" = @("articleTitle", "stressTitle", "sideAssumptionsTitle")
  "pdf2img.html" = @("articleTitle", "tipsTitle", "relatedTitle")
  "qr.html" = @("articleTitle", "tipsTitle", "relatedTitle")
  "token.html" = @("articleTitle", "privacyTitle", "useTitle")
  "tax.html" = @("articleTitle", "excludeTitle", "sideAssumptionsTitle")
  "stamp-duty.html" = @("articleTitle", "limitsTitle", "relatedTitle")
  "vat.html" = @("articleTitle", "zeroTitle", "thresholdTitle")
  "weight.html" = @("howTitle", "formulaTitle", "roundingTitle")
  "working-days.html" = @("articleTitle", "howToTitle", "limitsTitle")
}
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
Assert-True ($sharedNavCss -match '(?s)\.site-nav \.site-nav-links \{[^}]*gap: 5px !important;[^}]*flex-wrap: wrap !important;[^}]*\}') "shared navigation does not let translated labels wrap before overlapping the brand"
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
Assert-True ((Read-SiteFile "upload.html") -notmatch 'How to use this image hosting tool safely|uploadGuidanceTranslations|applyUploadGuidanceLanguage') "upload page still contains duplicate guidance"
Assert-True ((Read-SiteFile "upload.html") -notmatch 'miniToolsUploadLang') "upload page still lets stored language override browser language"

$retiredModules = @{
  "image.html" = 'id="tool-guidance"'
  "privacy.html" = 'id="upload-policy-summary"'
  "about.html" = 'id="directory-overview"'
  "tax.html" = 'id="calculator-disclaimer-summary"'
}
foreach ($entry in $retiredModules.GetEnumerator()) {
  Assert-True ((Read-SiteFile $entry.Key) -notmatch $entry.Value) "$($entry.Key) still contains a retired duplicate module"
}

foreach ($page in $toolPages) {
  Assert-True ((Read-SiteFile $page) -match '<meta\s+name=["'']robots["'']\s+content=["''][^"'']*index\s*,?\s*follow') "$page is not index,follow"
}

foreach ($page in $toolPages) {
  $html = Read-SiteFile $page
  Assert-True ($html -notmatch 'Original notes') "$page still contains development notes"
  if ($page -eq "upload.html") {
    foreach ($id in @("retentionTitle", "faqSectionTitle", "removalTitle")) {
      Assert-True ($html -match ('id="' + $id + '"')) "$page misses $id"
    }
    continue
  }
  if ($page -eq "image.html") {
    foreach ($key in @("articleTitle", "useTitle", "relatedTitle")) {
      Assert-True ($html -match ('data-i18n="' + $key + '"')) "$page misses $key"
    }
    continue
  }
  if ($bespokeGuidancePages.ContainsKey($page)) {
    foreach ($key in $bespokeGuidancePages[$page]) {
      Assert-True ($html -match ('data-i18n="' + $key + '"')) "$page misses $key"
    }
    continue
  }
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
  Assert-True ($html -match 'Last checked:\s+\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}') "$page misses a valid Last checked date"
  Assert-True ($html -match 'https://www\.gov\.uk/') "$page misses GOV.UK source link"
}

$tax = Read-SiteFile "tax.html"
$taxRelated = [regex]::Match($tax, '<div class="side-card">\s*<h3 data-i18n="relatedTitle"[\s\S]*?</div>\s*</div>', "IgnoreCase").Value
Assert-True ($taxRelated -notmatch 'href="/upload"') "tax related calculators still include upload"
foreach ($path in @("/vat", "/dividend", "/ir35", "/mortgage", "/stamp-duty")) {
  Assert-True ($taxRelated -match ('href="' + [regex]::Escape($path) + '"')) "tax related calculators miss $path"
}
foreach ($key in @("relatedTitle", "relatedVat", "relatedDividend", "relatedIr35", "relatedMortgage", "relatedStampDuty")) {
  Assert-True ($tax -match ('data-i18n="' + $key + '"')) "tax related calculators miss $key"
}
Assert-True ($tax -match 'seoTitle:\s*["''][^"'']*2026/27[^"'']*Mini-Tools\.uk["'']') "tax Chinese SEO title is missing the required tax year and brand"
Assert-True ($tax -match 'seoDescription:\s*["''][^"'']*2026/27[^"'']*PAYE[^"'']*National Insurance[^"'']*["'']') "tax Chinese SEO description is incomplete"
Assert-True ($tax -match 'heroTitle:\s*["''][^"'']+["'']') "tax Chinese H1 translation is missing"
Assert-True (([regex]::Matches($tax, '<h1\b', "IgnoreCase")).Count -eq 1) "tax must keep exactly one H1"
Assert-True ($tax -notmatch '<meta\b[^>]*name="keywords"') "tax contains meta keywords"

$mortgage = Read-SiteFile "mortgage.html"
Assert-True ($mortgage -notmatch 'rates-and-thresholds-for-employers-2026-to-2027') "mortgage contains an unrelated employer-rates source"
Assert-True ($mortgage -match 'https://www\.gov\.uk/stamp-duty-land-tax') "mortgage misses the SDLT source"
foreach ($key in @("sourcesTitle", "sourcesDisclaimer", "sourcesSdltScope", "sourcesFormulaNote", "lastCheckedLabel", "lastCheckedDate")) {
  Assert-True ($mortgage -match ('data-i18n="' + $key + '"')) "mortgage source module misses $key"
}
Assert-True ($mortgage.Contains('Mortgage repayments use a standard amortisation formula. The interest rate is entered by the user and is not a live lender rate.')) "mortgage misses the amortisation explanation"

$standardizer = Read-SiteFile "scripts/standardize-pages.ps1"
foreach ($retired in @("tool-guidance", "upload-policy-summary", "directory-overview", "calculator-disclaimer-summary", "uploadGuidanceTranslations", "rates-and-thresholds-for-employers-2026-to-2027")) {
  Assert-True ($standardizer -notmatch [regex]::Escape($retired)) "standardizer can regenerate $retired"
}

$colorPicker = Read-SiteFile "color-picker.html"
Assert-True ($colorPicker -notmatch 'cdn\.tailwindcss\.com') "color-picker.html still loads the Tailwind runtime CDN"

$homepage = Read-SiteFile "index.html"
$twitterMeta = @{
  card = 'summary_large_image'
  title = 'Mini-Tools.uk | UK Tax, VAT, Salary & Everyday Calculators'
  description = 'UK-focused calculators for salary after tax, VAT, mortgages, stamp duty, IR35 and dividends, plus useful browser tools.'
  image = 'https://assets.mini-tools.uk/image/icon-512x512.png'
}
foreach ($entry in $twitterMeta.GetEnumerator()) {
  $pattern = '<meta\b[^>]*name=["'']twitter:' + [regex]::Escape($entry.Key) + '["''][^>]*>'
  $matches = [regex]::Matches($homepage, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  Assert-True ($matches.Count -eq 1) "index.html twitter:$($entry.Key) must appear exactly once"
  Assert-True ($matches[0].Value -match ('content=["'']' + [regex]::Escape($entry.Value) + '["'']')) "index.html twitter:$($entry.Key) content is incorrect"
}

foreach ($entry in $canonicalPaths.GetEnumerator()) {
  $html = Read-SiteFile $entry.Key
  $clean = "https://mini-tools.uk$($entry.Value)"
  Assert-True ($html -match ('<link\s+rel=["'']canonical["'']\s+href=["'']' + [regex]::Escape($clean) + '["'']')) "$($entry.Key) canonical is not the clean URL"
  foreach ($lang in @("en", "zh-CN", "de", "fr", "es")) {
    $expected = if ($lang -eq "en") { $clean } else { "$clean`?lang=$lang" }
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
  "about.html" = @("What Mini-Tools.uk is", "How pages are designed", "How Mini-Tools.uk approaches privacy", "What kinds of tools are on the site", "UK calculators", "Developer tools", "Image and PDF tools", "Security & Privacy Tools", "Contact and feedback")
  "privacy.html" = @("browser", "remote service", "accessible to anyone", "1 day", "7 days", "30 days", "approved long-term storage code", "image URL", "illegal content", "adult content", "violent or hateful content", "copyrighted content", "identity documents", "financial files", "malware", "phishing", "scam-related content", "confidential work material", "sensitive screenshots", "Google Analytics", "advertising", "cookies", "localStorage")
  "contact.html" = @("bug report", "feature suggestion", "calculation issue", "image removal request", "abuse report", "privacy question", "hosted image URL", "reason", "rights details")
  "upload.html" = @("What not to upload", "Removal and abuse reports", "Privacy note")
  "tax.html" = @("estimate only", "not payroll, legal, financial or tax advice")
}

foreach ($entry in $requiredContent.GetEnumerator()) {
  $html = Read-SiteFile $entry.Key
  foreach ($phrase in $entry.Value) { Assert-True ($html -match [regex]::Escape($phrase)) "$($entry.Key) misses $phrase" }
}

$worker = Read-SiteFile "_worker.js"
foreach ($pattern in @('initialPathname === "/terms"', 'initialPathname === "/acceptable-use"', 'url.pathname.endsWith(".html")')) {
  Assert-True ($worker.Contains($pattern)) "_worker.js misses $pattern"
}
Assert-True ($worker -match 'initialPathname === "/blog"[\s\S]*?render404\(request, env, 410\)') "_worker.js does not retire Blog URLs with 410"
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
