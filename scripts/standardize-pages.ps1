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
      <button class="lang-trigger" type="button" aria-haspopup="true" aria-expanded="false"><span id="currentLangLabel">English</span></button>
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
  const normalizeLang = (value) => {
    const rawValue = String(value || "").trim();
    const lower = rawValue.toLowerCase().replace("_", "-");
    if (lower.startsWith("zh")) return "zh-CN";
    if (lower.startsWith("de")) return "de";
    if (lower.startsWith("fr")) return "fr";
    if (lower.startsWith("es")) return "es";
    return labels[rawValue] ? rawValue : "en";
  };
  const params = new URLSearchParams(location.search);
  let lang = normalizeLang(window.MINI_TOOLS_SERVER_LANG || params.get("lang") || navigator.language || "en");
  const applyCanonicalHreflang = () => {
    const supported = ["en", "zh-CN", "de", "fr", "es"];
    const cleanPath = location.pathname === "/index.html" ? "/" : location.pathname.replace(/\.html$/, "");
    const cleanUrl = location.origin + cleanPath;
    const current = lang === "en" ? cleanUrl : `${cleanUrl}?lang=${encodeURIComponent(lang)}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", current);
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove());
    supported.forEach((code) => {
      const link = document.createElement("link");
      link.setAttribute("rel", "alternate");
      link.setAttribute("hreflang", code);
      link.setAttribute("href", `${cleanUrl}?lang=${encodeURIComponent(code)}`);
      document.head.appendChild(link);
    });
    const fallback = document.createElement("link");
    fallback.setAttribute("rel", "alternate");
    fallback.setAttribute("hreflang", "x-default");
    fallback.setAttribute("href", cleanUrl);
    document.head.appendChild(fallback);
  };
  const localizeLinks = () => {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
      const link = new URL(rawHref, location.origin);
      if (link.origin !== location.origin) return;
      link.searchParams.set("lang", lang);
      anchor.href = link.pathname + link.search + link.hash;
    });
  };
  const guidanceTranslations = {
    en: {
      notes: "How to use this",
      useCases: "Use cases",
      limitations: "Limitations and privacy",
      sources: "Sources and assumptions",
      faq: "FAQ",
      related: "Related tools",
      how: (name) => `${name} is designed for one focused task. Enter the values or content requested on the page, review the result, then copy, download or use the output as needed.`,
      uses: (name) => `Use ${name} for quick checks, planning, formatting or preparation work when you need a browser-based helper rather than a full professional workflow.`,
      limits: "Results and generated output should be reviewed before use. Browser-first tools usually process data locally; upload or hosting tools explain when remote storage is used.",
      finance: "Results are estimates only and are not tax, legal, financial or accounting advice. Check the official GOV.UK guidance and confirm important decisions with a qualified adviser.",
      faqQ: (name) => `Can I rely on ${name} as an official result?`,
      faqA: "No. Treat the result as a practical estimate or helper output and review it before relying on it.",
      checked: "Last checked: 9 June 2026"
    },
    "zh-CN": {
      notes: "\u5de5\u5177\u8bf4\u660e",
      useCases: "\u4f7f\u7528\u573a\u666f",
      limitations: "\u9650\u5236\u548c\u9690\u79c1",
      sources: "\u6765\u6e90\u548c\u5047\u8bbe",
      faq: "\u5e38\u89c1\u95ee\u9898",
      related: "\u76f8\u5173\u5de5\u5177",
      how: (name) => `${name}\u7528\u4e8e\u5904\u7406\u4e00\u4e2a\u660e\u786e\u4efb\u52a1\u3002\u8f93\u5165\u9875\u9762\u8981\u6c42\u7684\u6570\u503c\u6216\u5185\u5bb9\uff0c\u68c0\u67e5\u7ed3\u679c\uff0c\u7136\u540e\u6309\u9700\u590d\u5236\u3001\u4e0b\u8f7d\u6216\u4f7f\u7528\u8f93\u51fa\u3002`,
      uses: (name) => `\u5f53\u4f60\u9700\u8981\u5728\u6d4f\u89c8\u5668\u4e2d\u5feb\u901f\u68c0\u67e5\u3001\u4f30\u7b97\u3001\u683c\u5f0f\u5316\u6216\u6574\u7406\u5185\u5bb9\u65f6\uff0c\u53ef\u4ee5\u4f7f\u7528 ${name}\u3002`,
      limits: "\u7ed3\u679c\u548c\u751f\u6210\u5185\u5bb9\u5728\u4f7f\u7528\u524d\u5e94\u81ea\u884c\u6838\u5bf9\u3002\u4f18\u5148\u672c\u5730\u5904\u7406\u7684\u5de5\u5177\u901a\u5e38\u5728\u6d4f\u89c8\u5668\u5185\u8fd0\u884c\uff1b\u4e0a\u4f20\u6216\u6258\u7ba1\u5de5\u5177\u4f1a\u5728\u9875\u9762\u4e2d\u8bf4\u660e\u4f55\u65f6\u4f7f\u7528\u8fdc\u7a0b\u5b58\u50a8\u3002",
      finance: "\u7ed3\u679c\u4ec5\u4e3a\u4f30\u7b97\uff0c\u4e0d\u6784\u6210\u7a0e\u52a1\u3001\u6cd5\u5f8b\u3001\u8d22\u52a1\u6216\u4f1a\u8ba1\u5efa\u8bae\u3002\u91cd\u8981\u51b3\u7b56\u524d\u8bf7\u6838\u5bf9 GOV.UK \u5b98\u65b9\u8bf4\u660e\uff0c\u5e76\u54a8\u8be2\u5408\u683c\u4e13\u4e1a\u4eba\u58eb\u3002",
      faqQ: (name) => `${name}\u53ef\u4ee5\u4f5c\u4e3a\u5b98\u65b9\u7ed3\u679c\u5417\uff1f`,
      faqA: "\u4e0d\u53ef\u4ee5\u3002\u8bf7\u628a\u5b83\u89c6\u4e3a\u5b9e\u7528\u4f30\u7b97\u6216\u8f85\u52a9\u8f93\u51fa\uff0c\u5728\u4f9d\u8d56\u7ed3\u679c\u524d\u81ea\u884c\u590d\u6838\u3002",
      checked: "\u6700\u540e\u68c0\u67e5\uff1a2026 \u5e74 6 \u6708 9 \u65e5"
    },
    de: {
      notes: "Hinweise",
      useCases: "Anwendungsf\u00e4lle",
      limitations: "Grenzen und Datenschutz",
      sources: "Quellen und Annahmen",
      faq: "FAQ",
      related: "Verwandte Tools",
      how: (name) => `${name} ist f\u00fcr eine klare Aufgabe gedacht. Gib die Werte oder Inhalte auf der Seite ein, pr\u00fcfe das Ergebnis und kopiere, lade oder nutze die Ausgabe danach nach Bedarf.`,
      uses: (name) => `Nutze ${name} f\u00fcr schnelle Pr\u00fcfungen, Planungen, Formatierungen oder Vorbereitungen direkt im Browser.`,
      limits: "Ergebnisse und Ausgaben sollten vor der Nutzung gepr\u00fcft werden. Browserbasierte Tools verarbeiten Daten meist lokal; Upload- oder Hosting-Tools erkl\u00e4ren, wann entfernte Speicherung verwendet wird.",
      finance: "Die Ergebnisse sind nur Sch\u00e4tzungen und keine Steuer-, Rechts-, Finanz- oder Buchhaltungsberatung. Pr\u00fcfe die offiziellen GOV.UK-Hinweise und frage bei wichtigen Entscheidungen eine qualifizierte Fachperson.",
      faqQ: (name) => `Kann ich ${name} als offizielles Ergebnis verwenden?`,
      faqA: "Nein. Behandle das Ergebnis als praktische Sch\u00e4tzung oder Hilfsausgabe und pr\u00fcfe es vor der Nutzung.",
      checked: "Last checked: 9 June 2026"
    },
    fr: {
      notes: "Mode d'emploi",
      useCases: "Cas d'utilisation",
      limitations: "Limites et confidentialit\u00e9",
      sources: "Sources et hypoth\u00e8ses",
      faq: "FAQ",
      related: "Outils li\u00e9s",
      how: (name) => `${name} sert \u00e0 une t\u00e2che pr\u00e9cise. Saisissez les valeurs ou le contenu demand\u00e9s, v\u00e9rifiez le r\u00e9sultat, puis copiez, t\u00e9l\u00e9chargez ou utilisez la sortie selon vos besoins.`,
      uses: (name) => `Utilisez ${name} pour des v\u00e9rifications rapides, des estimations, du formatage ou de la pr\u00e9paration directement dans le navigateur.`,
      limits: "Les r\u00e9sultats et sorties g\u00e9n\u00e9r\u00e9es doivent \u00eatre v\u00e9rifi\u00e9s avant utilisation. Les outils c\u00f4t\u00e9 navigateur traitent g\u00e9n\u00e9ralement les donn\u00e9es localement; les outils d'upload ou d'h\u00e9bergement indiquent quand un stockage distant est utilis\u00e9.",
      finance: "Les r\u00e9sultats sont des estimations uniquement et ne constituent pas un conseil fiscal, juridique, financier ou comptable. Consultez les sources officielles GOV.UK et demandez conseil \u00e0 un professionnel qualifi\u00e9 pour les d\u00e9cisions importantes.",
      faqQ: (name) => `Puis-je utiliser ${name} comme r\u00e9sultat officiel ?`,
      faqA: "Non. Consid\u00e9rez le r\u00e9sultat comme une estimation pratique ou une aide, puis v\u00e9rifiez-le avant de vous y fier.",
      checked: "Last checked: 9 June 2026"
    },
    es: {
      notes: "C\u00f3mo usarlo",
      useCases: "Casos de uso",
      limitations: "Limitaciones y privacidad",
      sources: "Fuentes y supuestos",
      faq: "FAQ",
      related: "Herramientas relacionadas",
      how: (name) => `${name} est\u00e1 pensado para una tarea concreta. Introduce los valores o el contenido que pide la p\u00e1gina, revisa el resultado y copia, descarga o usa la salida seg\u00fan lo necesites.`,
      uses: (name) => `Usa ${name} para comprobaciones r\u00e1pidas, estimaciones, formato o preparaci\u00f3n de contenido directamente en el navegador.`,
      limits: "Revisa los resultados y salidas generadas antes de usarlos. Las herramientas de navegador suelen procesar datos localmente; las herramientas de subida o alojamiento explican cu\u00e1ndo usan almacenamiento remoto.",
      finance: "Los resultados son solo estimaciones y no son asesoramiento fiscal, legal, financiero ni contable. Consulta la gu\u00eda oficial de GOV.UK y confirma decisiones importantes con un profesional cualificado.",
      faqQ: (name) => `\u00bfPuedo usar ${name} como resultado oficial?`,
      faqA: "No. Tr\u00e1talo como una estimaci\u00f3n pr\u00e1ctica o una salida de ayuda y rev\u00edsalo antes de confiar en \u00e9l.",
      checked: "Last checked: 9 June 2026"
    }
  };
  const financeSourceLinks = {
    tax: ["https://www.gov.uk/income-tax-rates", "https://www.gov.uk/national-insurance-rates-letters"],
    vat: ["https://www.gov.uk/vat-rates", "https://www.gov.uk/vat-businesses"],
    mortgage: ["https://www.gov.uk/stamp-duty-land-tax"],
    ir35: ["https://www.gov.uk/guidance/understanding-off-payroll-working-ir35"],
    "stamp-duty": ["https://www.gov.uk/stamp-duty-land-tax"],
    dividend: ["https://www.gov.uk/tax-on-dividends"]
  };
  const toolNameFallbacks = {
    tax: "UK Tax Calculator",
    vat: "VAT Calculator",
    mortgage: "Mortgage Calculator",
    ir35: "IR35 Calculator",
    "stamp-duty": "Stamp Duty Calculator",
    dividend: "Dividend Calculator",
    json: "JSON Formatter",
    diff: "Text Diff Checker",
    token: "AI Token Calculator",
    qr: "QR Code Generator",
    password: "Password Generator",
    image: "Image Compressor",
    pdf2img: "PDF to Image Converter",
    "color-picker": "Color Picker",
    "working-days": "Working Days Calculator",
    fuel: "Fuel Cost Calculator",
    weight: "Weight Converter"
  };
  const routeSlug = () => {
    const last = location.pathname.split("/").filter(Boolean).pop() || "index";
    return last.replace(/\.html$/i, "");
  };
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
  const pageToolName = (slug) => {
    const h1 = document.querySelector("h1");
    const text = h1 ? h1.textContent.trim() : "";
    return text || toolNameFallbacks[slug] || "this tool";
  };
  const relatedLinksHtml = (slug, label) => {
    const links = Array.from(document.querySelectorAll("#tool-guidance a[href], main a[href]"))
      .filter((anchor) => {
        const href = anchor.getAttribute("href") || "";
        return href.startsWith("/") && href.replace(/^\//, "").split(/[?#]/)[0] !== slug;
      })
      .slice(0, 4);
    if (!links.length) return "";
    const items = links.map((anchor) => {
      const href = anchor.getAttribute("href");
      const text = anchor.textContent.trim() || href;
      return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
    }).join(" ");
    return `<h3>${escapeHtml(label.related)}</h3><p>${items}</p>`;
  };
  const renderToolGuidanceLanguage = () => {
    const guidance = document.getElementById("tool-guidance");
    if (!guidance || document.getElementById("guidanceTitle")) return;
    const slug = routeSlug();
    const text = guidanceTranslations[lang] || guidanceTranslations.en;
    const name = pageToolName(slug);
    const isFinance = Object.prototype.hasOwnProperty.call(financeSourceLinks, slug);
    const sourceLinks = financeSourceLinks[slug] || [];
    const sourceHtml = isFinance
      ? `<h3>${escapeHtml(text.sources)}</h3><p>${escapeHtml(text.finance)}</p><p>${sourceLinks.map((href) => `<a href="${href}" rel="noopener noreferrer">${href}</a>`).join(" ")}</p><p><strong>${escapeHtml(text.checked)}</strong></p>`
      : `<h3>${escapeHtml(text.limitations)}</h3><p>${escapeHtml(text.limits)}</p>`;
    guidance.innerHTML = `<div class="article"><h2>${escapeHtml(text.notes)} ${escapeHtml(name)}</h2><p>${escapeHtml(text.how(name))}</p><h3>${escapeHtml(text.useCases)}</h3><p>${escapeHtml(text.uses(name))}</p>${sourceHtml}<h3>${escapeHtml(text.faq)}</h3><p><strong>${escapeHtml(text.faqQ(name))}</strong> ${escapeHtml(text.faqA)}</p>${relatedLinksHtml(slug, text)}</div>`;
  };
  const applyToolGuidanceLanguage = () => {
    const guidance = document.getElementById("tool-guidance");
    if (!guidance || document.getElementById("guidanceTitle")) return;
    const guidanceLabels = {
      en: { notes: "How to use this", example: "Use cases", limitations: "Limitations", faq: "FAQ", related: "Related tools" },
      "zh-CN": { notes: "\u5de5\u5177\u8bf4\u660e\uff1a", example: "\u793a\u4f8b", limitations: "\u9650\u5236", faq: "\u5e38\u89c1\u95ee\u9898", related: "\u76f8\u5173\u5de5\u5177" },
      de: { notes: "Hinweise zu", example: "Beispiel", limitations: "Einschr\u00e4nkungen", faq: "FAQ", related: "Verwandte Tools" },
      fr: { notes: "Notes pour", example: "Exemple", limitations: "Limites", faq: "FAQ", related: "Outils lies" },
      es: { notes: "Notas para", example: "Ejemplo", limitations: "Limitaciones", faq: "FAQ", related: "Herramientas relacionadas" }
    };
    const text = guidanceLabels[lang] || guidanceLabels.en;
    const title = guidance.querySelector("h2");
    if (title) title.textContent = title.textContent.replace(/^How to use this\s*/i, text.notes + " ");
    guidance.querySelectorAll("h3").forEach((heading) => {
      const key = heading.textContent.trim().toLowerCase();
      if (key === "example") heading.textContent = text.example;
      if (key === "use cases") heading.textContent = text.example;
      if (key === "limitations") heading.textContent = text.limitations;
      if (key === "faq") heading.textContent = text.faq;
      if (key === "related tools") heading.textContent = text.related;
    });
    renderToolGuidanceLanguage();
  };
  const syncLanguageControls = () => {
    document.querySelectorAll("[data-site-lang]").forEach((button) => {
      button.classList.toggle("active", normalizeLang(button.dataset.siteLang) === lang);
    });
    const select = document.getElementById("languageSelect");
    if (select) select.value = lang;
  };
  const applySiteLanguage = () => {
    document.querySelectorAll("[data-site-nav]").forEach((item) => {
      item.textContent = labels[lang][item.dataset.siteNav];
    });
    const current = document.getElementById("currentLangLabel");
    if (current) current.textContent = labels[lang].language;
    syncLanguageControls();
    localizeLinks();
    applyToolGuidanceLanguage();
  };
  const setLanguage = (selectedLang) => {
    lang = normalizeLang(selectedLang);
    const target = new URL(location.href);
    target.searchParams.set("lang", lang);
    history.replaceState(null, "", target.pathname + target.search + target.hash);
    if (typeof window.applyLanguage === "function") {
      window.applyLanguage(lang, true);
    }
    applyCanonicalHreflang();
    applySiteLanguage();
  };
  applyCanonicalHreflang();
  applySiteLanguage();
  window.addEventListener("load", () => { applyCanonicalHreflang(); applySiteLanguage(); });
  setTimeout(applyCanonicalHreflang, 0);
  const langGroup = document.querySelector(".lang-group");
  const langTrigger = document.querySelector(".lang-trigger");
  const setLangMenuOpen = (open) => {
    if (!langGroup || !langTrigger) return;
    langGroup.classList.toggle("open", open);
    langTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  };
  if (langTrigger) {
    langTrigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setLangMenuOpen(!langGroup.classList.contains("open"));
    });
  }
  document.addEventListener("click", (event) => {
    if (langGroup && !langGroup.contains(event.target)) setLangMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLangMenuOpen(false);
  });
  document.querySelectorAll("[data-site-lang]").forEach((button) => {
    button.classList.toggle("active", normalizeLang(button.dataset.siteLang) === lang);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const selectedLang = button.dataset.siteLang;
      setLanguage(selectedLang);
      setLangMenuOpen(false);
    });
  });
  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect) {
    languageSelect.addEventListener("change", (event) => setLanguage(event.target.value));
  }
})();
</script>
'@

$footer = @'
<footer class="footer">
  <div class="wrap footer-inner">
    <div class="footer-copyright">Copyright 2026 Mini-Tools.uk</div>
    <div class="footer-links"><a href="/" data-site-nav="home">Home</a><a href="/about" data-site-nav="about">About</a><a href="/contact" data-site-nav="contact">Contact</a><a href="/privacy" data-site-nav="privacy">Privacy</a><a href="mailto:yuyananuu@gmail.com">yuyananuu@gmail.com</a></div>
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
.footer .footer-copyright {
  color: #64748b !important;
  font-size: .9rem !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  white-space: nowrap !important;
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

function Add-BeforeFooter([string]$html, [string]$marker, [string]$content) {
  if ($html.Contains($marker)) { return $html }
  return $html.Replace('<footer class="footer">', "$content`r`n<footer class=`"footer`">")
}

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

  if ($file.Name -eq "mortgage.html") {
    $html = Add-BeforeFooter $html 'id="mortgage-sources-assumptions"' @'
<section class="wrap tool-guidance" id="mortgage-sources-assumptions" style="margin:32px auto">
  <div class="article">
    <h2>Sources and assumptions</h2>
    <p>Results are estimates only and are not mortgage, legal, financial, tax or accounting advice. Mortgage offers, lender affordability checks, product fees, insurance, property details and exact SDLT treatment can change the final cost.</p>
    <p>The SDLT estimate is for residential purchases in England and Northern Ireland only. Scotland and Wales use different property taxes.</p>
    <p><a href="https://www.gov.uk/stamp-duty-land-tax" rel="noopener noreferrer">https://www.gov.uk/stamp-duty-land-tax</a> <a href="https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027" rel="noopener noreferrer">https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027</a></p>
    <p><strong>Last checked: 9 June 2026</strong></p>
  </div>
</section>
'@
  }

  $html = [regex]::Replace($html, '<script id=["'']site-nav-language["'']>[\s\S]*?</script>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<style id=["'']site-nav-style["'']>[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<style id=["'']site-footer-style["'']>[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<style id=["''](?:home-nav-footer-layout-fixes|upload-page-nav-isolation|upload-page-footer-fix|upload-final-review-fixes|upload-language-arrow-unify)["'']>[\s\S]*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<link\s+rel=["'']stylesheet["'']\s+href=["'']/?site-nav\.css(?:\?[^"'']*)?["'']\s*/?>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = $html.Replace('</head>', "<link rel=`"stylesheet`" href=`"/site-nav.css?v=20260610-nav-3`">`r`n$footerStyle`r`n</head>")
  $html = $html.Replace('</body>', "$siteNavScript`r`n</body>")
  $html = [regex]::Replace($html, 'Original notes for\s+([^<"''`r`n]+)', 'How to use this $1', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<h3>\s*Example\s*</h3>', '<h3>Use cases</h3>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '<h3>\s*Official sources\s*</h3>', '<h3>Sources and assumptions</h3>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '&copy;\s*2026\s+Mini-Tools\.uk', 'Copyright 2026 Mini-Tools.uk', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '漏\s*2026\s+Mini-Tools\.uk\s*[鈥?]?\s*', 'Copyright 2026 Mini-Tools.uk - ', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = [regex]::Replace($html, '婕廫s*2026\s+Mini-Tools\.uk', 'Copyright 2026 Mini-Tools.uk', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $html = $html.Replace([string][char]0x00A9, 'Copyright')
  $html = [regex]::Replace($html.Replace("`r`n", "`n"), '[ \t]+(?=\n)', '')
  [System.IO.File]::WriteAllText($file.FullName, $html, $utf8)
}
