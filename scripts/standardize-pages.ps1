$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$excluded = @("image_admin.html", "map.html")
$thinPages = @(
  "mortgage.html", "ir35.html", "stamp-duty.html", "dividend.html", "password.html",
  "image.html", "color-picker.html", "working-days.html", "fuel.html", "weight.html"
)

$nav = @'
<nav class="nav" aria-label="Primary navigation">
  <div class="wrap nav-inner">
    <a class="brand" href="/">
      <img src="https://assets.mini-tools.uk/image/icon-64x64.png" alt="Mini-Tools.uk logo">
      <span class="brand-copy"><span class="brand-title">Mini-Tools<span style="color:#2563eb">.uk</span></span><span class="brand-subtitle">Useful online tools</span></span>
    </a>
    <div class="nav-links">
      <a class="nav-link" href="/">Home</a>
      <a class="nav-link" href="/#search">Search</a>
      <a class="nav-link" href="/#popular">Popular</a>
      <a class="nav-link" href="/#uk-apps">UK Apps</a>
      <a class="nav-link" href="/#developer-tools">Dev Tools</a>
      <a class="nav-link" href="/#other-tools">Other</a>
      <a class="nav-link" href="/about">About</a>
      <a class="nav-link" href="/contact">Contact</a>
      <a class="nav-link" href="/privacy">Privacy</a>
      <div class="lang-group">
        <button class="lang-trigger" type="button" aria-haspopup="true"><span id="currentLangLabel">English</span></button>
        <div class="lang-dropdown" aria-label="Language">
          <a href="?lang=en">English</a><a href="?lang=zh-CN">中文</a><a href="?lang=de">Deutsch</a><a href="?lang=fr">Français</a><a href="?lang=es">Español</a>
        </div>
        <select id="languageSelect" aria-label="Language" hidden><option value="en">English</option><option value="zh-CN">中文</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option></select>
      </div>
    </div>
  </div>
</nav>
'@

$footer = @'
<footer class="footer">
  <div class="wrap footer-inner">
    <div>© 2026 Mini-Tools.uk</div>
    <div class="footer-links"><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a></div>
  </div>
</footer>
'@

function Add-BeforeFooter([string]$html, [string]$marker, [string]$content) {
  if ($html.Contains($marker)) { return $html }
  return $html.Replace('<footer class="footer">', "$content`r`n<footer class=`"footer`">")
}

foreach ($file in Get-ChildItem -LiteralPath $root -Filter "*.html") {
  if ($excluded -contains $file.Name) { continue }
  $html = [System.IO.File]::ReadAllText($file.FullName)
  $html = [regex]::Replace($html, '<nav\b[\s\S]*?</nav>', $nav, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<footer\b[\s\S]*?</footer>', $footer, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<a\b[^>]*href=["'']/(?:blog(?:/[^"'']*)?|terms/?|acceptable-use/?)["''][^>]*>[\s\S]*?</a>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = $html.Replace('/#featured-tools', '/#popular').Replace('/#all-tools', '/#search').Replace('/#uk-finance', '/#uk-apps').Replace('/#image-tools', '/#other-tools').Replace('/#security-tools', '/#other-tools')
  $html = [regex]::Replace($html, '\bFeatured Tool\b|\bMain Tool\b|\bPrimary Tool\b', 'Popular tool', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bAcceptable Use\b', 'Upload policy', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bBlog\b', 'Website', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bTerms\b', 'Policies', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bUK Finance\b', 'UK Apps', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bImage & PDF\b', 'Other Tools', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bAll Tools\b', 'Search Tools', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '\bSecurity\b', 'Safety', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

  if ($thinPages -contains $file.Name) {
    if ($html -match '<meta\s+name=["'']robots["'']') {
      $html = [regex]::Replace($html, '<meta\s+name=["'']robots["'']\s+content=["''][^"'']*["'']\s*/?>', '<meta name="robots" content="noindex,follow,max-image-preview:large">', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    } else {
      $html = $html -replace '<head>', "<head>`r`n  <meta name=`"robots`" content=`"noindex,follow,max-image-preview:large`">"
    }
  }

  if ($file.Name -eq "about.html") {
    $html = Add-BeforeFooter $html 'id="directory-overview"' @'
<section class="wrap" id="directory-overview" style="margin:32px auto">
  <div class="article">
    <h2>Mini-Tools.uk is a tool directory</h2>
    <p>Mini-Tools.uk is a collection of focused online tools. Each tool page handles one practical task, categories are clear, and most tools can be used without an account. Many tools run locally in the browser; upload tools explain when they use a remote service. Feedback and requests can be sent through Contact.</p>
    <h3>UK Apps</h3><p>UK Tax Calculator, VAT Calculator, Mortgage Calculator, IR35 Calculator, Stamp Duty Calculator and Dividend Calculator.</p>
    <h3>Developer Tools</h3><p>JSON Formatter, Text Diff Checker, AI Token Calculator, QR Code Generator and Password Generator.</p>
    <h3>Other Tools</h3><p>Free Image Hosting, Image Compressor, PDF to Image, Color Picker, Working Days Calculator, Fuel Cost Calculator and Weight Converter.</p>
  </div>
</section>
'@
  }

  if ($file.Name -eq "privacy.html") {
    $html = Add-BeforeFooter $html 'id="upload-policy-summary"' @'
<section class="wrap" id="upload-policy-summary" style="margin:32px auto">
  <div class="article">
    <h2>Upload storage and prohibited content</h2>
    <p>The upload tool sends images to a remote service. Hosted images are not private and may be accessed by anyone with the image URL. Available retention choices are 1 day, 7 days, 30 days, or permanent storage with an approved code.</p>
    <p>Do not upload illegal content, adult content, violent content, hateful content, copyrighted images without permission, private ID, passport files, financial documents, medical records, malware, phishing or scam-related content, unsafe minors-related content, or confidential screenshots.</p>
    <p>Mini-Tools.uk may remove content that violates this policy. Send the hosted image URL and removal reason through Contact or email.</p>
  </div>
</section>
'@
  }

  if ($file.Name -eq "contact.html") {
    $html = Add-BeforeFooter $html 'id="removal-request-details"' @'
<section class="wrap" id="removal-request-details" style="margin:32px auto">
  <div class="article">
    <h2>Image removal request details</h2>
    <p>Include the hosted image URL, the reason for removal, and copyright, privacy, or other rights details when relevant.</p>
  </div>
</section>
'@
  }

  if ($file.Name -eq "tax.html") {
    $html = Add-BeforeFooter $html 'id="calculator-disclaimer-summary"' @'
<section class="wrap" id="calculator-disclaimer-summary" style="margin:32px auto">
  <div class="article">
    <h2>Calculator disclaimer</h2>
    <p>Results are estimates only. This calculator is not official tax advice and is not legal or financial advice.</p>
  </div>
</section>
'@
  }

  $html = [regex]::Replace($html.Replace("`r`n", "`n"), '[ \t]+(?=\n)', '')
  [System.IO.File]::WriteAllText($file.FullName, $html, $utf8)
}
