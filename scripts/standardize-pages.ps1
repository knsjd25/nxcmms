$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$excluded = @("image_admin.html", "map.html")

$nav = @'
<nav class="nav" aria-label="Primary navigation">
  <div class="wrap nav-inner">
    <a class="brand" href="/">
      <img src="https://assets.mini-tools.uk/image/icon-64x64.png" alt="Mini-Tools.uk logo">
      <span class="brand-copy"><span class="brand-title">Mini-Tools<span style="color:#2563eb">.uk</span></span><span class="brand-subtitle">Useful online tools</span></span>
    </a>
    <div class="nav-links">
      <a class="nav-link" href="/" data-site-nav="home">Home</a>
      <a class="nav-link" href="/#search" data-site-nav="search">Search</a>
      <a class="nav-link" href="/#popular" data-site-nav="popular">Popular</a>
      <a class="nav-link" href="/#uk-apps" data-site-nav="ukApps">UK Apps</a>
      <a class="nav-link" href="/#developer-tools" data-site-nav="devTools">Dev Tools</a>
      <a class="nav-link" href="/#other-tools" data-site-nav="other">Other</a>
      <a class="nav-link" href="/about" data-site-nav="about">About</a>
      <a class="nav-link" href="/contact" data-site-nav="contact">Contact</a>
      <a class="nav-link" href="/privacy" data-site-nav="privacy">Privacy</a>
    </div>
    <div class="lang-group">
      <button class="lang-trigger" type="button" aria-haspopup="true"><span id="currentLangLabel">English</span></button>
      <div class="lang-dropdown" aria-label="Language">
        <button type="button" data-site-lang="en">English</button><button type="button" data-site-lang="zh-CN">&#20013;&#25991;</button><button type="button" data-site-lang="de">Deutsch</button><button type="button" data-site-lang="fr">Fran&ccedil;ais</button><button type="button" data-site-lang="es">Espa&ntilde;ol</button>
      </div>
      <select id="languageSelect" aria-label="Language" hidden><option value="en">English</option><option value="zh-CN">&#20013;&#25991;</option><option value="de">Deutsch</option><option value="fr">Fran&ccedil;ais</option><option value="es">Espa&ntilde;ol</option></select>
    </div>
  </div>
</nav>
'@

$siteNavScript = @'
<script id="site-nav-language">
(() => {
  const labels = {
    en:{home:"Home",search:"Search",popular:"Popular",ukApps:"UK Apps",devTools:"Dev Tools",other:"Other",about:"About",contact:"Contact",privacy:"Privacy",language:"English"},
    "zh-CN":{home:"\u9996\u9875",search:"\u641c\u7d22",popular:"\u70ed\u95e8",ukApps:"\u82f1\u56fd\u5e94\u7528",devTools:"\u5f00\u53d1\u8005\u5de5\u5177",other:"\u5176\u4ed6\u5de5\u5177",about:"\u5173\u4e8e",contact:"\u8054\u7cfb",privacy:"\u9690\u79c1\u653f\u7b56",language:"\u4e2d\u6587"},
    de:{home:"Startseite",search:"Suchen",popular:"Beliebt",ukApps:"UK Apps",devTools:"Entwickler",other:"Weitere",about:"\u00dcber uns",contact:"Kontakt",privacy:"Datenschutz",language:"Deutsch"},
    fr:{home:"Accueil",search:"Recherche",popular:"Populaires",ukApps:"Apps UK",devTools:"Outils dev",other:"Autres",about:"\u00c0 propos",contact:"Contact",privacy:"Confidentialit\u00e9",language:"Fran\u00e7ais"},
    es:{home:"Inicio",search:"Buscar",popular:"Populares",ukApps:"Apps UK",devTools:"Herramientas dev",other:"Otros",about:"Acerca de",contact:"Contacto",privacy:"Privacidad",language:"Espa\u00f1ol"}
  };
  const raw = window.MINI_TOOLS_SERVER_LANG || new URLSearchParams(location.search).get("lang") || "en";
  const lang = raw === "zh" ? "zh-CN" : (labels[raw] ? raw : "en");
  const localizeLinks = () => {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
      const link = new URL(rawHref, location.origin);
      if (link.origin !== location.origin) return;
      if (lang === "en") link.searchParams.delete("lang");
      else link.searchParams.set("lang", lang);
      anchor.href = link.pathname + link.search + link.hash;
    });
  };
  const applySiteLanguage = () => {
    document.querySelectorAll("[data-site-nav]").forEach((item) => {
      item.textContent = labels[lang][item.dataset.siteNav];
    });
    const current = document.getElementById("currentLangLabel");
    if (current) current.textContent = labels[lang].language;
    localizeLinks();
  };
  applySiteLanguage();
  window.addEventListener("load", applySiteLanguage);
  document.querySelectorAll("[data-site-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.siteLang === lang);
    button.addEventListener("click", () => {
      const selectedLang = button.dataset.siteLang;
      const target = new URL(location.href);
      if (selectedLang === "en") target.searchParams.delete("lang");
      else target.searchParams.set("lang", selectedLang);
      location.assign(target.pathname + target.search + target.hash);
    });
  });
})();
</script>
'@

$footer = @'
<footer class="footer">
  <div class="wrap footer-inner">
    <div>© 2026 Mini-Tools.uk</div>
    <div class="footer-links"><a href="/" data-site-nav="home">Home</a><a href="/about" data-site-nav="about">About</a><a href="/contact" data-site-nav="contact">Contact</a><a href="/privacy" data-site-nav="privacy">Privacy</a></div>
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
  if ($file.Name -eq "upload.html") {
    $html = [regex]::Replace($html, '<header\s+class=["'']site-header["'']>[\s\S]*?(<nav\s+class=["'']nav["''][\s\S]*?</nav>)[\s\S]*?</header>', '$1', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  }
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

  if ($html -match '<meta\s+name=["'']robots["'']') {
    $html = [regex]::Replace($html, '<meta\s+name=["'']robots["'']\s+content=["''][^"'']*["'']\s*/?>', '<meta name="robots" content="index,follow,max-image-preview:large">', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  } else {
    $html = $html -replace '<head>', "<head>`r`n  <meta name=`"robots`" content=`"index,follow,max-image-preview:large`">"
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

  $html = [regex]::Replace($html, '<script id=["'']site-nav-language["'']>[\s\S]*?</script>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<style id=["'']site-nav-style["'']>[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<link\s+rel=["'']stylesheet["'']\s+href=["'']/?site-nav\.css["'']\s*/?>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = $html.Replace('</head>', "<link rel=`"stylesheet`" href=`"site-nav.css`">`r`n</head>")
  $html = $html.Replace('</body>', "$siteNavScript`r`n</body>")
  $html = [regex]::Replace($html.Replace("`r`n", "`n"), '[ \t]+(?=\n)', '')
  [System.IO.File]::WriteAllText($file.FullName, $html, $utf8)
}
