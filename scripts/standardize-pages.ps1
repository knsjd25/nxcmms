$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$excluded = @(
  "404.html",
  "image_admin.html",
  "map.html"
)

$nav = @'
<nav class="site-nav" aria-label="Primary navigation" data-site-shell-aria="navigation">
  <div class="site-nav-inner">
    <a class="site-brand" href="/">
      <img src="https://assets.mini-tools.uk/image/icon-64x64.png" alt="Mini-Tools.uk logo">
      <span class="site-brand-copy"><span class="site-brand-title">Mini-Tools<span style="color:#2563eb">.uk</span></span><span class="site-brand-subtitle" data-site-shell="subtitle">Useful online tools</span></span>
    </a>
    <div class="site-nav-links">
      <a class="site-nav-link" href="/" data-site-nav="home">Home</a>
      <a class="site-nav-link" href="/#search" data-site-nav="search">Search</a>
      <a class="site-nav-link" href="/#popular" data-site-nav="popular">Popular</a>
      <a class="site-nav-link" href="/#uk-apps" data-site-nav="ukApps">UK Calculators</a>
      <a class="site-nav-link" href="/#developer-tools" data-site-nav="devTools">Developer Tools</a>
      <a class="site-nav-link" href="/#other-tools" data-site-nav="other">Other Tools</a>
    </div>
    <div class="site-lang-group">
      <button class="site-lang-trigger" type="button" aria-haspopup="true" aria-expanded="false"><span id="currentLangLabel">English</span></button>
      <div class="site-lang-dropdown" aria-label="Language" data-site-shell-aria="language">
        <button type="button" data-site-lang="en">English</button><button type="button" data-site-lang="zh-CN">&#20013;&#25991;</button><button type="button" data-site-lang="de">Deutsch</button><button type="button" data-site-lang="fr">Fran&ccedil;ais</button><button type="button" data-site-lang="es">Espa&ntilde;ol</button>
      </div>
      <select id="languageSelect" aria-label="Language" data-site-shell-aria="language" hidden><option value="en">English</option><option value="zh-CN">&#20013;&#25991;</option><option value="de">Deutsch</option><option value="fr">Fran&ccedil;ais</option><option value="es">Espa&ntilde;ol</option></select>
    </div>
  </div>
</nav>
'@

$footer = @'
<footer class="footer">
  <div class="wrap footer-inner">
    <div class="footer-meta">
      <div class="footer-copyright">Copyright 2026 Mini-Tools.uk</div>
      <div class="site-version" data-site-version></div>
    </div>
    <div class="footer-links"><a href="/" data-site-nav="home">Home</a><a href="/about" data-site-nav="about">About</a><a href="/contact" data-site-nav="contact">Contact</a><a href="/privacy" data-site-nav="privacy">Privacy</a><a href="mailto:yuyananuu@gmail.com" data-cfemail="false">yuyananuu@gmail.com</a></div>
  </div>
</footer>
'@

$footerStyle = @'
<style id="site-footer-style">
.footer {
  margin-top: 46px !important;
  border-top: 1px solid #e2e8f0 !important;
  background: #fff !important;
  padding: 28px 0 46px !important;
}
.footer .footer-inner {
  box-sizing: border-box !important;
  max-width: 1180px !important;
  width: 100% !important;
  margin: 0 auto !important;
  padding: 0 20px !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 18px !important;
  flex-direction: row !important;
  flex-wrap: wrap !important;
  color: #64748b !important;
  font-size: .9rem !important;
  text-align: left !important;
}
.footer .footer-meta {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}
.footer .footer-copyright {
  color: #64748b !important;
  font-size: .9rem !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  white-space: nowrap !important;
}
.footer .site-version {
  color: #94a3b8 !important;
  font-size: .82rem !important;
  font-weight: 600 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
}
.footer .footer-links {
  display: flex !important;
  justify-content: flex-end !important;
  align-items: center !important;
  gap: 14px !important;
  flex-wrap: wrap !important;
  margin: 0 !important;
  color: #334155 !important;
  font-size: .9rem !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  text-align: left !important;
}
.footer .footer-links a {
  color: #334155 !important;
  font-size: .9rem !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
}
@media (max-width: 760px) {
  .footer .footer-inner {
    align-items: flex-start !important;
    flex-direction: column !important;
  }
  .footer .footer-links {
    justify-content: flex-start !important;
  }
}
</style>
'@

foreach ($file in Get-ChildItem -LiteralPath $root -Filter "*.html") {
  if ($excluded -contains $file.Name) { continue }
  $html = [System.IO.File]::ReadAllText($file.FullName)
  $html = [regex]::Replace($html, '<nav\b[\s\S]*?</nav>', $nav, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<header\s+class=["'']site-header["'']>[\s\S]*?(<nav\s+class=["'']nav["''][\s\S]*?</nav>)[\s\S]*?</header>', '$1', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<footer\b[\s\S]*?</footer>', $footer, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<a\b[^>]*href=["'']/(?:blog(?:/[^"'']*)?|terms/?|acceptable-use/?)["''][^>]*>[\s\S]*?</a>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = $html.Replace('/#featured-tools', '/#popular').Replace('/#all-tools', '/#search').Replace('/#uk-finance', '/#uk-apps').Replace('/#image-tools', '/#other-tools').Replace('/#security-tools', '/#other-tools')
  $html = [regex]::Replace($html, '\bFeatured Tool\b|\bMain Tool\b|\bPrimary Tool\b', 'Popular tool', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bAcceptable Use\b', 'Upload policy', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bTerms\b', 'Policies', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bUK Finance\b', 'UK Calculators', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bImage & PDF\b', 'Other Tools', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bAll Tools\b', 'Search Tools', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($html -match '<meta\s+name=["'']robots["'']') {
    $html = [regex]::Replace($html, '<meta\s+name=["'']robots["'']\s+content=["''][^"'']*["'']\s*/?>', '<meta name="robots" content="index,follow,max-image-preview:large">', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  } else {
    $html = $html -replace '<head>', "<head>`r`n  <meta name=`"robots`" content=`"index,follow,max-image-preview:large`">"
  }

  $html = [regex]::Replace($html, '<script\s+src=["''](?:\.?/)?site-i18n\.js(?:\?[^"'']*)?["'']\s*></script>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<style id=["'']site-nav-style["'']>[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<style id=["'']site-footer-style["'']>[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<style id=["''](?:home-nav-footer-layout-fixes|upload-page-nav-isolation|upload-page-footer-fix|upload-final-review-fixes|upload-language-arrow-unify)["'']>[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<link\s+rel=["'']stylesheet["'']\s+href=["''](?:\.?/)?ui-refresh\.css(?:\?[^"'']*)?["'']\s*/?>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<link\s+rel=["'']stylesheet["'']\s+href=["'']/?site-nav\.css(?:\?[^"'']*)?["'']\s*/?>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '(?m)(const\s+(?:translations|i18n)\s*=\s*)(?!window\.PAGE_TRANSLATIONS\s*=\s*)\{', '$1window.PAGE_TRANSLATIONS = {', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = $html.Replace('</head>', "<link rel=`"stylesheet`" href=`"site-nav.css`">`r`n$footerStyle`r`n</head>")
  $html = $html.Replace('</body>', "<script src=`"site-i18n.js`"></script>`r`n</body>")
  $html = [regex]::Replace($html, '&copy;\s*2026\s+Mini-Tools\.uk', 'Copyright 2026 Mini-Tools.uk', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '漏\s*2026\s+Mini-Tools\.uk\s*[鈥?]?\s*', 'Copyright 2026 Mini-Tools.uk - ', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '婕廫s*2026\s+Mini-Tools\.uk', 'Copyright 2026 Mini-Tools.uk', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = $html.Replace([string][char]0x00A9, 'Copyright')
  $html = [regex]::Replace($html.Replace("`r`n", "`n"), '[ \t]+(?=\n)', '')
  [System.IO.File]::WriteAllText($file.FullName, $html, $utf8)
}
