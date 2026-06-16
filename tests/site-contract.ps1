$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Read-SiteFile([string]$name) {
  return [System.IO.File]::ReadAllText((Join-Path $root $name))
}

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) { throw $message }
}

$titleExcluded = @("image_admin.html", "map.html")
$excluded = @("404.html", "image_admin.html", "map.html")
$titlePages = Get-ChildItem -LiteralPath $root -Filter "*.html" | Where-Object { $titleExcluded -notcontains $_.Name }
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
$navLinks = @("/", "/#search", "/#popular", "/#uk-apps", "/#developer-tools", "/#other-tools")
$footerLinks = @("/", "/about", "/contact", "/privacy")
$standardizerNav = [regex]::Match((Read-SiteFile "scripts/standardize-pages.ps1"), '\$nav\s*=\s*@''[\s\S]*?''@').Value
foreach ($href in @("/about", "/contact", "/privacy")) { Assert-True ($standardizerNav -notmatch ('href=["'']' + [regex]::Escape($href) + '["'']')) "standardizer nav can restore $href" }

foreach ($page in $titlePages) {
  $html = Read-SiteFile $page.Name
  $staticTitle = [regex]::Match($html, '<title\b[^>]*>([\s\S]*?)</title>', "IgnoreCase").Groups[1].Value.Trim()
  Assert-True ($staticTitle.Length -gt 0) "$($page.Name) static title is empty"
  Assert-True ($staticTitle.Length -le 70) "$($page.Name) static title is $($staticTitle.Length) characters: $staticTitle"
  Assert-True ($staticTitle -notmatch '\|\s*Mini-Tools\.uk$') "$($page.Name) static title uses a brand suffix instead of descriptive words"
  $titleMatches = [regex]::Matches($html, '(?s)(?:^|[,{]\s*)(["'']?(?:title|seoTitle|metaTitle|ogTitle|twitterTitle|schemaAppName)["'']?)\s*:\s*(["''])(.*?)\2')
  Assert-True ($titleMatches.Count -gt 0) "$($page.Name) has no translated title fields"
  foreach ($lang in @("en", "zh-CN", "de", "fr", "es")) {
    Assert-True ($html -match ('["'']?' + [regex]::Escape($lang) + '["'']?\s*:')) "$($page.Name) misses PAGE_TRANSLATIONS $lang"
  }
  foreach ($match in $titleMatches) {
    $value = $match.Groups[3].Value
    Assert-True ($value.Trim().Length -gt 0) "$($page.Name) has an empty title field"
    Assert-True ($value.Length -le 70) "$($page.Name) title field is $($value.Length) characters: $value"
    Assert-True ($value -notmatch '\|\s*Mini-Tools\.uk$') "$($page.Name) title field uses a brand suffix instead of descriptive words: $value"
  }
}
foreach ($page in @("upload.html", "qr.html", "mortgage.html", "weight.html")) {
  $html = Read-SiteFile $page
  $staticTitle = [regex]::Match($html, '<title\b[^>]*>([\s\S]*?)</title>', "IgnoreCase").Groups[1].Value.Trim()
  Assert-True ($staticTitle.Length -le 70) "$page focused title is $($staticTitle.Length) characters"
}

$emailProtectionFiles = @($titlePages | ForEach-Object { $_.Name }) + @("site-i18n.js", "_worker.js", "scripts/standardize-pages.ps1", "sitemap.xml", "robots.txt")
foreach ($file in $emailProtectionFiles) {
  Assert-True ((Read-SiteFile $file) -notmatch 'cdn-cgi/l/email-protection') "$file links Cloudflare email protection"
}
foreach ($page in $titlePages) {
  $html = Read-SiteFile $page.Name
  $emailLinks = [regex]::Matches($html, '<a\b[^>]*href=["'']mailto:yuyananuu@gmail\.com["''][^>]*>', "IgnoreCase")
  foreach ($link in $emailLinks) {
    Assert-True ($link.Value -match 'data-cfemail=["'']false["'']') "$($page.Name) email link does not opt out of Cloudflare obfuscation"
  }
}
Assert-True ((Read-SiteFile "scripts/standardize-pages.ps1") -match 'data-cfemail=["'']false["'']') "standardizer footer email opt-out is missing"
Assert-True ((Read-SiteFile "robots.txt") -match '(?m)^Disallow:\s*/cdn-cgi/$') "robots.txt does not disallow /cdn-cgi/"
Assert-True ((Read-SiteFile "sitemap.xml") -notmatch 'cdn-cgi|email-protection') "sitemap includes Cloudflare system URLs"

$financePages = @("tax.html", "vat.html", "mortgage.html", "ir35.html", "stamp-duty.html", "dividend.html")
foreach ($page in $financePages) {
  $html = Read-SiteFile $page
  Assert-True ($html -notmatch '<time\s+datetime=["'']2026-06-09["'']>\s*Last checked:\s*9 June 2026\s*</time>') "$page has fixed English Last checked"
  Assert-True ($html -match 'data-i18n=["'']lastCheckedLabel["'']') "$page misses lastCheckedLabel"
  Assert-True ($html -match 'data-i18n=["'']lastCheckedDate["'']') "$page misses lastCheckedDate"
  foreach ($key in @("lastCheckedLabel", "lastCheckedDate")) {
    Assert-True ($html -match ($key + '\s*:')) "$page translation dictionary misses $key"
  }
}

$vat = Read-SiteFile "vat.html"
Assert-True ([regex]::Match($vat, '<[^>]+id=["'']result-mode["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']resultModeAdd["'']') "vat result-mode is not translatable"
Assert-True ([regex]::Match($vat, '<[^>]+id=["'']result-note["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']noteDefault["'']') "vat result-note is not translatable"
Assert-True ($vat -notmatch 'searchParams\.set\(["'']lang["'']\s*,\s*["'']en["'']\)') "vat forces ?lang=en"
Assert-True ($vat -match 'currentLang\s*===\s*["'']en["''][\s\S]*?searchParams\.delete\(["'']lang["'']\)') "vat English links do not delete lang"

$stampDuty = Read-SiteFile "stamp-duty.html"
Assert-True ([regex]::Match($stampDuty, '<[^>]+id=["'']scenarioPill["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']standardResidential["'']') "stamp-duty scenarioPill is not translatable"
Assert-True ([regex]::Match($stampDuty, '<[^>]+id=["'']surchargeSummary["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']noSurcharge["'']') "stamp-duty surchargeSummary is not translatable"
Assert-True ([regex]::Match($stampDuty, '<[^>]+id=["'']resultNote["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']noteStandard["'']') "stamp-duty resultNote is not translatable"

$ir35 = Read-SiteFile "ir35.html"
foreach ($key in @("perMonth", "moreOutside", "moreInside", "noDifference", "initialMonthly", "initialDifference")) {
  Assert-True ($ir35 -match ($key + '\s*:')) "ir35 misses $key"
}
Assert-True ([regex]::Match($ir35, '<[^>]+id=["'']insideMonthlyHeadline["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']initialMonthly["'']') "ir35 inside monthly initial state is not translatable"
Assert-True ([regex]::Match($ir35, '<[^>]+id=["'']outsideMonthlyHeadline["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']initialMonthly["'']') "ir35 outside monthly initial state is not translatable"
Assert-True ([regex]::Match($ir35, '<[^>]+id=["'']differenceHeadline["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']initialDifference["'']') "ir35 difference initial state is not translatable"

$dividend = Read-SiteFile "dividend.html"
Assert-True ($dividend -match 'monthlyEquivalent\s*:') "dividend misses monthlyEquivalent"
Assert-True ([regex]::Match($dividend, '<[^>]+id=["'']monthly-equivalent["''][^>]*>', "IgnoreCase").Value -match 'data-i18n=["'']initialMonthlyEquivalent["'']') "dividend monthly equivalent initial state is not translatable"

$standardizerSource = Read-SiteFile "scripts/standardize-pages.ps1"
$html404 = Read-SiteFile "404.html"
Assert-True ($standardizerSource -match '\$excluded\s*=\s*@\([\s\S]*["'']404\.html["''][\s\S]*\)') "standardize-pages.ps1 does not exclude 404.html"
Assert-True ($html404 -match '<meta\s+name=["'']robots["'']\s+content=["'']noindex,follow["'']') "404.html does not keep noindex,follow"
Assert-True ($html404 -notmatch '<meta\s+name=["'']robots["'']\s+content=["'']index,follow,max-image-preview:large["'']') "404.html is indexable"

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
  foreach ($href in @("/about", "/contact", "/privacy")) { Assert-True ($nav -notmatch ('href=["'']' + [regex]::Escape($href) + '["'']')) "$page nav must leave $href in the footer only" }
  Assert-True ($nav -notmatch 'Blog|Terms|Acceptable Use|All Tools|UK Finance|Image & PDF|Security|Categories') "$page nav has an old item"
  Assert-True ($footer -notmatch 'Blog|Terms|Acceptable Use|All Tools|Categories') "$page footer has an old item"
}
foreach ($page in $publicPages) {
  Assert-True ((Read-SiteFile $page.Name) -notmatch '<header\s+class=["'']site-header["'']') "$($page.Name) still wraps the unified nav in its legacy header"
}
$sharedNavCss = Read-SiteFile "site-nav.css"
Assert-True ($sharedNavCss.Contains('--site-shell-width: 1280px;')) "shared navigation does not use the wider desktop shell"
Assert-True ($sharedNavCss.Contains('max-width: var(--site-shell-width) !important;')) "shared navigation and content do not use the common page width"
Assert-True ($sharedNavCss.Contains('right: 0 !important;')) "shared navigation does not keep the language selector on the right"
Assert-True ($sharedNavCss.Contains('justify-content: space-between !important;')) "shared navigation does not use homepage alignment"
Assert-True ($sharedNavCss -match '(?s)\.site-nav \.site-nav-links \{[^}]*gap: 5px !important;[^}]*flex-wrap: nowrap !important;[^}]*\}') "shortened desktop navigation does not stay on one row"
Assert-True ($sharedNavCss -match '(?s)@media \(max-width: 1200px\).*?\.site-nav \.site-brand-subtitle \{[^}]*display: none !important;') "medium desktop widths do not use the compact navigation"
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
  Assert-True ($html -match 'Last checked:(?:</span>\s*<time\b[^>]*>)?\s*\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}') "$page misses a valid Last checked date"
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
foreach ($key in @("regionBadgeRuk", "initialSummaryNote", "perYear", "rukBasicRange", "rukHigherRange", "scotlandStarterRange", "scotlandBasicRange", "scotlandIntermediateRange", "scotlandHigherRange", "scotlandAdvancedRange", "lastCheckedLabel", "lastCheckedDate")) {
  Assert-True ($tax -match ('data-i18n="' + $key + '"')) "tax initial server-rendered content misses $key"
}

$contact = Read-SiteFile "contact.html"
Assert-True ($contact -notmatch 'id=["'']removal-request-details["'']') "contact still contains the duplicate removal request module"

$upload = Read-SiteFile "upload.html"
Assert-True ($upload -match '<div class="file-name" id="fileName" data-i18n="noFileChosen">') "upload empty file state is not server translatable"
Assert-True ($upload.Contains('noFileChosen: "Keine Datei ausgew' + [char]0x00E4 + 'hlt"')) "upload German empty file state is missing"
$uploadGerman = [regex]::Match($upload, '\n\s*de:\s*\{[\s\S]*?\n\s*\},\n\s*fr:\s*\{', "IgnoreCase").Value
Assert-True ($uploadGerman -cnotmatch 'Dokumentation, Dokumentation|\bwebsites\b|\bwebsite-(Editoren|Entw.rfe)\b') "upload German copy still contains known wording errors"

$runtime = Read-SiteFile "site-i18n.js"
Assert-True ($runtime -match 'dict\.seoDescription\s*\|\|\s*dict\.metaDesc\s*\|\|\s*dict\.metaDescription\s*\|\|\s*dict\.description') "site-i18n description fallback misses dict.description"
Assert-True ($runtime -match '!params\.has\(["'']lang["'']\)[\s\S]*currentLang\s*!==\s*["'']en["''][\s\S]*history\.replaceState') "site-i18n does not sync inferred language to the URL"

$image = Read-SiteFile "image.html"
foreach ($key in @("guidanceTitle", "guidanceIntro", "guidanceUseTitle", "guidanceLimitationsTitle", "guidanceFaqTitle", "guidanceRelatedTitle")) {
  Assert-True ($image -notmatch ('\b' + $key + '\s*:')) "image still contains retired translation key $key"
}
Assert-True ($image -notmatch 'id=["'']tool-guidance["'']') "image restored the retired guidance module"

$mortgage = Read-SiteFile "mortgage.html"
Assert-True ($mortgage -notmatch 'rates-and-thresholds-for-employers-2026-to-2027') "mortgage contains an unrelated employer-rates source"
Assert-True ($mortgage -match 'https://www\.gov\.uk/stamp-duty-land-tax') "mortgage misses the SDLT source"
$mortgageGerman = [regex]::Match($mortgage, '\n\s*de:\s*\{[\s\S]*?\n\s*\},\n\s*fr:\s*\{', "IgnoreCase").Value
foreach ($translation in @('propertyPriceLabel:"Immobilienwert', 'mortgageAmountLabel:"Darlehensbetrag', 'depositLabel:"Eigenkapital', 'buyerTypeLabel:"K.ufertyp', 'breakdownHead:"Aufschl.sselung', 'amountHead:"Betrag')) {
  Assert-True ($mortgageGerman -match $translation) "mortgage German interface misses $translation"
}
foreach ($untranslated in @('propertyPriceLabel:"Property value', 'mortgageAmountLabel:"Mortgage amount', 'buyerTypeLabel:"Buyer type', 'breakdownHead:"Breakdown', 'amountHead:"Amount')) {
  Assert-True ($mortgageGerman -notmatch $untranslated) "mortgage German interface still contains $untranslated"
}
foreach ($key in @("sourcesTitle", "sourcesDisclaimer", "sourcesSdltScope", "sourcesFormulaNote", "lastCheckedLabel", "lastCheckedDate")) {
  Assert-True ($mortgage -match ('data-i18n="' + $key + '"')) "mortgage source module misses $key"
}
Assert-True ($mortgage.Contains('Mortgage repayments use a standard amortisation formula. The interest rate is entered by the user and is not a live lender rate.')) "mortgage misses the amortisation explanation"

$standardizer = Read-SiteFile "scripts/standardize-pages.ps1"
foreach ($retired in @("tool-guidance", "upload-policy-summary", "directory-overview", "calculator-disclaimer-summary", "uploadGuidanceTranslations", "rates-and-thresholds-for-employers-2026-to-2027", "removal-request-details", "site-nav-language")) {
  Assert-True ($standardizer -notmatch [regex]::Escape($retired)) "standardizer can regenerate $retired"
}
Assert-True ($standardizer -notmatch '\\bSecurity\\b') "standardizer still globally replaces Security"

$colorPicker = Read-SiteFile "color-picker.html"
Assert-True ($colorPicker -notmatch 'cdn\.tailwindcss\.com') "color-picker.html still loads the Tailwind runtime CDN"

$homepage = Read-SiteFile "index.html"
$twitterMeta = @{
  card = 'summary_large_image'
  title = 'UK Tax, VAT, Salary and Everyday Calculators'
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
  "contact.html" = @("bug report", "feature suggestion", "calculation issue", "image removal request", "abuse report", "privacy question", "hosted image URL", "reason", "rights information")
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

$expectedRobots = "User-agent: *`nAllow: /`nDisallow: /cdn-cgi/`n`nSitemap: https://mini-tools.uk/sitemap.xml"
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
