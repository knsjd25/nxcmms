(() => {
  "use strict";

  if (window.MiniToolsI18n) return;

  const SUPPORTED = ["en", "zh-CN", "de", "fr", "es"];
  const SAVED_LANGUAGE_KEY = "miniToolsLang";
  const HTML_LANG = { en: "en-GB", "zh-CN": "zh-CN", de: "de", fr: "fr", es: "es" };
  const NAV_LABELS = {
    en: { home: "Home", search: "Search", popular: "Popular", ukApps: "UK Apps", devTools: "Dev Tools", other: "Other", about: "About", contact: "Contact", privacy: "Privacy", language: "English", subtitle: "Useful online tools", navigation: "Primary navigation", languageAria: "Language" },
    "zh-CN": { home: "首页", search: "搜索", popular: "热门工具", ukApps: "英国工具", devTools: "开发工具", other: "其他工具", about: "关于我们", contact: "联系我们", privacy: "隐私政策", language: "中文", subtitle: "实用在线工具", navigation: "主导航", languageAria: "语言" },
    de: { home: "Startseite", search: "Suche", popular: "Beliebt", ukApps: "UK-Tools", devTools: "Entwicklertools", other: "Weitere Tools", about: "Über uns", contact: "Kontakt", privacy: "Datenschutz", language: "Deutsch", subtitle: "Nützliche Online-Tools", navigation: "Hauptnavigation", languageAria: "Sprache" },
    fr: { home: "Accueil", search: "Recherche", popular: "Populaires", ukApps: "Outils UK", devTools: "Outils développeur", other: "Autres outils", about: "À propos", contact: "Contact", privacy: "Confidentialité", language: "Français", subtitle: "Outils en ligne utiles", navigation: "Navigation principale", languageAria: "Langue" },
    es: { home: "Inicio", search: "Buscar", popular: "Populares", ukApps: "Herramientas UK", devTools: "Herramientas para desarrolladores", other: "Otras herramientas", about: "Acerca de", contact: "Contacto", privacy: "Privacidad", language: "Español", subtitle: "Herramientas en línea útiles", navigation: "Navegación principal", languageAria: "Idioma" }
  };
  const guidanceTranslations = {
    en: {
      notes: "How to use this", useCases: "Use cases", limitations: "Limitations and privacy", sources: "Sources and assumptions", faq: "FAQ", related: "Related tools",
      how: (name) => `${name} is designed for one focused task. Enter the values or content requested on the page, review the result, then copy, download or use the output as needed.`,
      uses: (name) => `Use ${name} for quick checks, planning, formatting or preparation work when you need a browser-based helper rather than a full professional workflow.`,
      limits: "Results and generated output should be reviewed before use. Browser-first tools usually process data locally; upload or hosting tools explain when remote storage is used.",
      finance: "Results are estimates only and are not tax, legal, financial or accounting advice. Check the official GOV.UK guidance and confirm important decisions with a qualified adviser.",
      faqQ: (name) => `Can I rely on ${name} as an official result?`, faqA: "No. Treat the result as a practical estimate or helper output and review it before relying on it.", checked: "Last checked: 9 June 2026"
    },
    "zh-CN": {
      notes: "\u5de5\u5177\u8bf4\u660e", useCases: "\u4f7f\u7528\u573a\u666f", limitations: "\u9650\u5236\u548c\u9690\u79c1", sources: "\u6765\u6e90\u548c\u5047\u8bbe", faq: "\u5e38\u89c1\u95ee\u9898", related: "\u76f8\u5173\u5de5\u5177",
      how: (name) => `${name}\u7528\u4e8e\u5904\u7406\u4e00\u4e2a\u660e\u786e\u4efb\u52a1\u3002\u8f93\u5165\u9875\u9762\u8981\u6c42\u7684\u6570\u503c\u6216\u5185\u5bb9\uff0c\u68c0\u67e5\u7ed3\u679c\uff0c\u7136\u540e\u6309\u9700\u590d\u5236\u3001\u4e0b\u8f7d\u6216\u4f7f\u7528\u8f93\u51fa\u3002`,
      uses: (name) => `\u5f53\u4f60\u9700\u8981\u5728\u6d4f\u89c8\u5668\u4e2d\u5feb\u901f\u68c0\u67e5\u3001\u4f30\u7b97\u3001\u683c\u5f0f\u5316\u6216\u6574\u7406\u5185\u5bb9\u65f6\uff0c\u53ef\u4ee5\u4f7f\u7528 ${name}\u3002`,
      limits: "\u7ed3\u679c\u548c\u751f\u6210\u5185\u5bb9\u5728\u4f7f\u7528\u524d\u5e94\u81ea\u884c\u6838\u5bf9\u3002\u4f18\u5148\u672c\u5730\u5904\u7406\u7684\u5de5\u5177\u901a\u5e38\u5728\u6d4f\u89c8\u5668\u5185\u8fd0\u884c\uff1b\u4e0a\u4f20\u6216\u6258\u7ba1\u5de5\u5177\u4f1a\u8bf4\u660e\u4f55\u65f6\u4f7f\u7528\u8fdc\u7a0b\u5b58\u50a8\u3002",
      finance: "\u7ed3\u679c\u4ec5\u4e3a\u4f30\u7b97\uff0c\u4e0d\u6784\u6210\u7a0e\u52a1\u3001\u6cd5\u5f8b\u3001\u8d22\u52a1\u6216\u4f1a\u8ba1\u5efa\u8bae\u3002\u91cd\u8981\u51b3\u7b56\u524d\u8bf7\u6838\u5bf9 GOV.UK \u5b98\u65b9\u8bf4\u660e\uff0c\u5e76\u54a8\u8be2\u5408\u683c\u4e13\u4e1a\u4eba\u58eb\u3002",
      faqQ: (name) => `${name}\u53ef\u4ee5\u4f5c\u4e3a\u5b98\u65b9\u7ed3\u679c\u5417\uff1f`, faqA: "\u4e0d\u53ef\u4ee5\u3002\u8bf7\u628a\u5b83\u89c6\u4e3a\u5b9e\u7528\u4f30\u7b97\u6216\u8f85\u52a9\u8f93\u51fa\uff0c\u5728\u4f9d\u8d56\u7ed3\u679c\u524d\u81ea\u884c\u590d\u6838\u3002", checked: "\u6700\u540e\u68c0\u67e5\uff1a2026 \u5e74 6 \u6708 9 \u65e5"
    },
    de: {
      notes: "Hinweise", useCases: "Anwendungsf\u00e4lle", limitations: "Grenzen und Datenschutz", sources: "Quellen und Annahmen", faq: "FAQ", related: "Verwandte Tools",
      how: (name) => `${name} ist f\u00fcr eine klare Aufgabe gedacht. Gib die Werte oder Inhalte auf der Seite ein, pr\u00fcfe das Ergebnis und kopiere, lade oder nutze die Ausgabe danach nach Bedarf.`,
      uses: (name) => `Nutze ${name} f\u00fcr schnelle Pr\u00fcfungen, Planungen, Formatierungen oder Vorbereitungen direkt im Browser.`, limits: "Ergebnisse und Ausgaben sollten vor der Nutzung gepr\u00fcft werden. Browserbasierte Tools verarbeiten Daten meist lokal; Upload- oder Hosting-Tools erkl\u00e4ren, wann entfernte Speicherung verwendet wird.",
      finance: "Die Ergebnisse sind nur Sch\u00e4tzungen und keine Steuer-, Rechts-, Finanz- oder Buchhaltungsberatung. Pr\u00fcfe die offiziellen GOV.UK-Hinweise und frage bei wichtigen Entscheidungen eine qualifizierte Fachperson.", faqQ: (name) => `Kann ich ${name} als offizielles Ergebnis verwenden?`, faqA: "Nein. Behandle das Ergebnis als praktische Sch\u00e4tzung oder Hilfsausgabe und pr\u00fcfe es vor der Nutzung.", checked: "Zuletzt gepr\u00fcft: 9. Juni 2026"
    },
    fr: {
      notes: "Mode d'emploi", useCases: "Cas d'utilisation", limitations: "Limites et confidentialit\u00e9", sources: "Sources et hypoth\u00e8ses", faq: "FAQ", related: "Outils li\u00e9s",
      how: (name) => `${name} sert \u00e0 une t\u00e2che pr\u00e9cise. Saisissez les valeurs ou le contenu demand\u00e9s, v\u00e9rifiez le r\u00e9sultat, puis copiez, t\u00e9l\u00e9chargez ou utilisez la sortie selon vos besoins.`,
      uses: (name) => `Utilisez ${name} pour des v\u00e9rifications rapides, des estimations, du formatage ou de la pr\u00e9paration directement dans le navigateur.`, limits: "Les r\u00e9sultats et sorties g\u00e9n\u00e9r\u00e9es doivent \u00eatre v\u00e9rifi\u00e9s avant utilisation. Les outils c\u00f4t\u00e9 navigateur traitent g\u00e9n\u00e9ralement les donn\u00e9es localement; les outils d'upload ou d'h\u00e9bergement indiquent quand un stockage distant est utilis\u00e9.",
      finance: "Les r\u00e9sultats sont des estimations uniquement et ne constituent pas un conseil fiscal, juridique, financier ou comptable. Consultez les sources officielles GOV.UK et demandez conseil \u00e0 un professionnel qualifi\u00e9 pour les d\u00e9cisions importantes.", faqQ: (name) => `Puis-je utiliser ${name} comme r\u00e9sultat officiel ?`, faqA: "Non. Consid\u00e9rez le r\u00e9sultat comme une estimation pratique ou une aide, puis v\u00e9rifiez-le avant de vous y fier.", checked: "Derni\u00e8re v\u00e9rification : 9 juin 2026"
    },
    es: {
      notes: "C\u00f3mo usarlo", useCases: "Casos de uso", limitations: "Limitaciones y privacidad", sources: "Fuentes y supuestos", faq: "FAQ", related: "Herramientas relacionadas",
      how: (name) => `${name} est\u00e1 pensado para una tarea concreta. Introduce los valores o el contenido que pide la p\u00e1gina, revisa el resultado y copia, descarga o usa la salida seg\u00fan lo necesites.`,
      uses: (name) => `Usa ${name} para comprobaciones r\u00e1pidas, estimaciones, formato o preparaci\u00f3n de contenido directamente en el navegador.`, limits: "Revisa los resultados y salidas generadas antes de usarlos. Las herramientas de navegador suelen procesar datos localmente; las herramientas de subida o alojamiento explican cu\u00e1ndo usan almacenamiento remoto.",
      finance: "Los resultados son solo estimaciones y no son asesoramiento fiscal, legal, financiero ni contable. Consulta la gu\u00eda oficial de GOV.UK y confirma decisiones importantes con un profesional cualificado.", faqQ: (name) => `\u00bfPuedo usar ${name} como resultado oficial?`, faqA: "No. Tr\u00e1talo como una estimaci\u00f3n pr\u00e1ctica o una salida de ayuda y rev\u00edsalo antes de confiar en \u00e9l.", checked: "\u00daltima comprobaci\u00f3n: 9 de junio de 2026"
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
  const TOOL_NAMES = {
    en: {
      tax: "UK Tax Calculator", vat: "VAT Calculator", mortgage: "Mortgage Calculator", ir35: "IR35 Calculator", "stamp-duty": "Stamp Duty Calculator", dividend: "Dividend Calculator", json: "JSON Formatter", diff: "Text Diff Checker", token: "AI Token Calculator", qr: "QR Code Generator", password: "Password Generator", upload: "Image Hosting", image: "Image Compressor", pdf2img: "PDF to Image Converter", "color-picker": "Color Picker", "working-days": "Working Days Calculator", fuel: "Fuel Cost Calculator", weight: "Weight Converter"
    },
    "zh-CN": {
      tax: "\u82f1\u56fd\u4e2a\u7a0e\u8ba1\u7b97\u5668", vat: "VAT \u8ba1\u7b97\u5668", mortgage: "\u82f1\u56fd\u623f\u8d37\u8ba1\u7b97\u5668", ir35: "IR35 \u8ba1\u7b97\u5668", "stamp-duty": "\u82f1\u56fd\u5370\u82b1\u7a0e\u8ba1\u7b97\u5668", dividend: "\u5de5\u8d44\u4e0e\u80a1\u606f\u8ba1\u7b97\u5668", json: "JSON \u683c\u5f0f\u5316\u5de5\u5177", diff: "\u6587\u672c\u5bf9\u6bd4\u5de5\u5177", token: "AI Token \u8ba1\u7b97\u5668", qr: "\u4e8c\u7ef4\u7801\u751f\u6210\u5668", password: "\u5bc6\u7801\u751f\u6210\u5668", upload: "\u56fe\u7247\u6258\u7ba1", image: "\u56fe\u7247\u538b\u7f29\u5de5\u5177", pdf2img: "PDF \u8f6c\u56fe\u7247\u5de5\u5177", "color-picker": "\u56fe\u7247\u53d6\u8272\u5668", "working-days": "\u5de5\u4f5c\u65e5\u8ba1\u7b97\u5668", fuel: "\u6cb9\u8d39\u8ba1\u7b97\u5668", weight: "\u4f53\u91cd\u6362\u7b97\u5668"
    },
    de: {
      tax: "UK-Einkommensteuerrechner", vat: "UK-Mehrwertsteuerrechner", mortgage: "UK-Hypothekenrechner", ir35: "IR35-Rechner", "stamp-duty": "Stamp-Duty-Rechner", dividend: "Gehalt-vs.-Dividende-Rechner", json: "JSON-Formatierer", diff: "Textvergleich", token: "KI-Token-Rechner", qr: "QR-Code-Generator", password: "Passwortgenerator", upload: "Bildhosting", image: "Bildkompressor", pdf2img: "PDF-zu-Bild-Konverter", "color-picker": "Farbpipette", "working-days": "Arbeitstagerechner", fuel: "Kraftstoffkostenrechner", weight: "Gewichtsumrechner"
    },
    fr: {
      tax: "Calculateur d'imp\u00f4t UK", vat: "Calculateur de TVA UK", mortgage: "Calculateur de pr\u00eat immobilier UK", ir35: "Calculateur IR35", "stamp-duty": "Calculateur de Stamp Duty", dividend: "Calculateur salaire-dividendes", json: "Formateur JSON", diff: "Comparateur de texte", token: "Calculateur de jetons IA", qr: "G\u00e9n\u00e9rateur de QR code", password: "G\u00e9n\u00e9rateur de mots de passe", upload: "H\u00e9bergement d'images", image: "Compresseur d'images", pdf2img: "Convertisseur PDF en image", "color-picker": "S\u00e9lecteur de couleur", "working-days": "Calculateur de jours ouvr\u00e9s", fuel: "Calculateur de co\u00fbt du carburant", weight: "Convertisseur de poids"
    },
    es: {
      tax: "Calculadora de impuestos UK", vat: "Calculadora de IVA UK", mortgage: "Calculadora de hipoteca UK", ir35: "Calculadora IR35", "stamp-duty": "Calculadora de Stamp Duty", dividend: "Calculadora de salario y dividendos", json: "Formateador JSON", diff: "Comparador de texto", token: "Calculadora de tokens de IA", qr: "Generador de c\u00f3digos QR", password: "Generador de contrase\u00f1as", upload: "Alojamiento de im\u00e1genes", image: "Compresor de im\u00e1genes", pdf2img: "Conversor de PDF a imagen", "color-picker": "Selector de color", "working-days": "Calculadora de d\u00edas laborables", fuel: "Calculadora de combustible", weight: "Conversor de peso"
    }
  };
  const toolNameFallbacks = {
    tax: "UK Tax Calculator", vat: "VAT Calculator", mortgage: "Mortgage Calculator", ir35: "IR35 Calculator", "stamp-duty": "Stamp Duty Calculator", dividend: "Dividend Calculator", json: "JSON Formatter", diff: "Text Diff Checker", token: "AI Token Calculator", qr: "QR Code Generator", password: "Password Generator", image: "Image Compressor", pdf2img: "PDF to Image Converter", "color-picker": "Color Picker", "working-days": "Working Days Calculator", fuel: "Fuel Cost Calculator", weight: "Weight Converter"
  };

  let currentLang = "en";
  let applyingPageHook = false;
  let toolGuidanceNode = null;
  let toolGuidanceAnchor = null;

  function normalizeLang(value) {
    const raw = String(value || "").trim();
    const lower = raw.toLowerCase().replace("_", "-");
    if (lower.startsWith("zh") || lower === "cn") return "zh-CN";
    if (lower.startsWith("de")) return "de";
    if (lower.startsWith("fr")) return "fr";
    if (lower.startsWith("es")) return "es";
    return SUPPORTED.includes(raw) ? raw : "en";
  }

  function isSupportedLang(value) {
    const raw = String(value || "").trim();
    const lower = raw.toLowerCase().replace("_", "-");
    return SUPPORTED.includes(raw) || ["zh", "zh-cn", "zh-hans", "cn", "de", "fr", "es", "en"].includes(lower);
  }

  function readSavedLanguage() {
    try {
      const saved = localStorage.getItem(SAVED_LANGUAGE_KEY);
      return isSupportedLang(saved) ? normalizeLang(saved) : null;
    } catch (_) {
      return null;
    }
  }

  function browserLanguage() {
    const candidates = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    const match = candidates.find(isSupportedLang);
    return match ? normalizeLang(match) : "en";
  }

  function resolveInitialLanguage() {
    const params = new URLSearchParams(location.search);
    if (params.has("lang")) {
      const requested = params.get("lang");
      return isSupportedLang(requested) ? normalizeLang(requested) : "en";
    }
    return readSavedLanguage() || browserLanguage() || "en";
  }

  function routeSlug() {
    const last = location.pathname.split("/").filter(Boolean).pop() || "index";
    return last.replace(/\.html$/i, "");
  }

  function pageDictionary(lang) {
    const all = window.PAGE_TRANSLATIONS;
    if (!all || typeof all !== "object") return null;
    if (lang === "zh-CN") return all["zh-CN"] || all.zh || all.en || null;
    return all[lang] || all.en || null;
  }

  function setMeta(selector, value) {
    if (!value) return;
    const node = document.querySelector(selector);
    if (node) node.setAttribute("content", value);
  }

  function applyGenericDictionary(dict) {
    if (!dict) return;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const value = dict[node.getAttribute("data-i18n")];
      if (typeof value === "string") node.textContent = value;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((node) => {
      const value = dict[node.getAttribute("data-i18n-html")];
      if (typeof value === "string") node.innerHTML = value;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const value = dict[node.getAttribute("data-i18n-placeholder")];
      if (typeof value === "string") node.setAttribute("placeholder", value);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
      const value = dict[node.getAttribute("data-i18n-aria-label")];
      if (typeof value === "string") node.setAttribute("aria-label", value);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((node) => {
      const value = dict[node.getAttribute("data-i18n-title")];
      if (typeof value === "string") node.setAttribute("title", value);
    });
    const title = dict.seoTitle || dict.metaTitle || dict.title;
    const description = dict.seoDescription || dict.metaDesc || dict.metaDescription;
    if (title) document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', dict.ogTitle || title);
    setMeta('meta[property="og:description"]', dict.ogDescription || description);
    setMeta('meta[name="twitter:title"]', dict.twitterTitle || dict.ogTitle || title);
    setMeta('meta[name="twitter:description"]', dict.twitterDescription || dict.ogDescription || description);
  }

  function applyCanonicalHreflang() {
    const cleanPath = location.pathname === "/index.html" ? "/" : location.pathname.replace(/\.html$/, "");
    const cleanUrl = location.origin + cleanPath;
    const canonicalUrl = currentLang === "en" ? cleanUrl : `${cleanUrl}?lang=${encodeURIComponent(currentLang)}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove());
    SUPPORTED.forEach((code) => {
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
    setMeta('meta[property="og:url"]', canonicalUrl);
  }

  function localizeLinks() {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
      let link;
      try { link = new URL(rawHref, location.origin); } catch { return; }
      if (link.origin !== location.origin) return;
      link.searchParams.set("lang", currentLang);
      anchor.setAttribute("href", link.pathname + link.search + link.hash);
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function pageToolName(slug) {
    const h1 = document.querySelector("h1");
    const text = h1 ? h1.textContent.trim() : "";
    return text || (TOOL_NAMES[currentLang] || TOOL_NAMES.en)[slug] || toolNameFallbacks[slug] || "this tool";
  }

  function linkSlug(rawHref) {
    let link;
    try { link = new URL(rawHref, location.origin); } catch { return ""; }
    if (link.origin !== location.origin) return "";
    return link.pathname.split("/").filter(Boolean).pop()?.replace(/\.html$/i, "") || "";
  }

  function localizedToolName(slug) {
    const names = TOOL_NAMES[currentLang] || TOOL_NAMES.en;
    return names[slug] || TOOL_NAMES.en[slug] || "";
  }

  function relatedLinksHtml(slug, labels) {
    const seen = new Set();
    const links = Array.from(document.querySelectorAll("#tool-guidance a[href], main a[href]")).filter((anchor) => {
      const targetSlug = linkSlug(anchor.getAttribute("href") || "");
      if (!targetSlug || targetSlug === slug || !localizedToolName(targetSlug) || seen.has(targetSlug)) return false;
      seen.add(targetSlug);
      return true;
    }).slice(0, 4);
    if (!links.length) return "";
    const items = links.map((anchor) => {
      const href = anchor.getAttribute("href") || "";
      return `<a href="${escapeHtml(href)}">${escapeHtml(localizedToolName(linkSlug(href)))}</a>`;
    }).join(" ");
    return `<h3>${escapeHtml(labels.related)}</h3><p>${items}</p>`;
  }

  function renderToolGuidanceLanguage() {
    const guidance = document.getElementById("tool-guidance");
    if (!guidance || document.getElementById("guidanceTitle")) return;
    const slug = routeSlug();
    const labels = guidanceTranslations[currentLang] || guidanceTranslations.en;
    const name = pageToolName(slug);
    const pageSourceLinks = Array.from(guidance.querySelectorAll('a[href^="https://www.gov.uk/"]')).map((anchor) => anchor.getAttribute("href")).filter(Boolean);
    const sourceLinks = pageSourceLinks.length ? pageSourceLinks : (financeSourceLinks[slug] || []);
    const notes = sourceLinks.length
      ? `<h3>${escapeHtml(labels.sources)}</h3><p>${escapeHtml(labels.finance)}</p><p>${sourceLinks.map((href) => `<a href="${href}" rel="noopener noreferrer">${href}</a>`).join(" ")}</p><p><strong>${escapeHtml(labels.checked)}</strong></p>`
      : `<h3>${escapeHtml(labels.limitations)}</h3><p>${escapeHtml(labels.limits)}</p>`;
    guidance.innerHTML = `<div class="article"><h2>${escapeHtml(labels.notes)} ${escapeHtml(name)}</h2><p>${escapeHtml(labels.how(name))}</p><h3>${escapeHtml(labels.useCases)}</h3><p>${escapeHtml(labels.uses(name))}</p>${notes}<h3>${escapeHtml(labels.faq)}</h3><p><strong>${escapeHtml(labels.faqQ(name))}</strong> ${escapeHtml(labels.faqA)}</p>${relatedLinksHtml(slug, labels)}</div>`;
  }

  function syncEnglishToolGuidance() {
    if (!toolGuidanceNode) {
      toolGuidanceNode = document.getElementById("tool-guidance");
      if (!toolGuidanceNode || !toolGuidanceNode.parentNode) return;
      toolGuidanceAnchor = document.createComment("tool-guidance");
      toolGuidanceNode.parentNode.insertBefore(toolGuidanceAnchor, toolGuidanceNode);
    }
    if (currentLang === "en") {
      if (!toolGuidanceNode.isConnected && toolGuidanceAnchor?.parentNode) {
        toolGuidanceAnchor.parentNode.insertBefore(toolGuidanceNode, toolGuidanceAnchor.nextSibling);
      }
      return;
    }
    if (currentLang !== "en" && toolGuidanceNode.isConnected) toolGuidanceNode.remove();
  }

  function syncShell() {
    const labels = NAV_LABELS[currentLang];
    document.documentElement.lang = HTML_LANG[currentLang] || "en-GB";
    document.querySelectorAll("[data-site-nav]").forEach((item) => {
      const value = labels[item.dataset.siteNav];
      if (value) item.textContent = value;
    });
    document.querySelectorAll('[data-site-shell="subtitle"]').forEach((item) => { item.textContent = labels.subtitle; });
    document.querySelectorAll('[data-site-shell-aria="navigation"]').forEach((item) => { item.setAttribute("aria-label", labels.navigation); });
    document.querySelectorAll('[data-site-shell-aria="language"]').forEach((item) => { item.setAttribute("aria-label", labels.languageAria); });
    const current = document.getElementById("currentLangLabel");
    if (current) current.textContent = labels.language;
    document.querySelectorAll("[data-site-lang]").forEach((button) => {
      button.classList.toggle("active", normalizeLang(button.dataset.siteLang) === currentLang);
    });
    const select = document.getElementById("languageSelect");
    if (select) select.value = currentLang;
  }

  function callPageHook() {
    if (applyingPageHook || typeof window.applyLanguage !== "function") return;
    applyingPageHook = true;
    try { window.applyLanguage(currentLang, false); } finally { applyingPageHook = false; }
  }

  function applyLanguage() {
    callPageHook();
    applyGenericDictionary(pageDictionary(currentLang));
    syncShell();
    syncEnglishToolGuidance();
    applyCanonicalHreflang();
    localizeLinks();
    window.dispatchEvent(new CustomEvent("mini-tools:languagechange", { detail: { lang: currentLang } }));
  }

  function setLanguage(selectedLang, updateUrl = true) {
    currentLang = normalizeLang(selectedLang);
    try { localStorage.setItem(SAVED_LANGUAGE_KEY, currentLang); } catch (_) {}
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    if (updateUrl) {
      const target = new URL(location.href);
      target.searchParams.set("lang", currentLang);
      history.replaceState(null, "", target.pathname + target.search + target.hash);
    }
    applyLanguage();
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  }

  function setMenuOpen(open) {
    const group = document.querySelector(".site-lang-group");
    const trigger = document.querySelector(".site-lang-trigger");
    if (!group || !trigger) return;
    group.classList.toggle("open", open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function bindControls() {
    const group = document.querySelector(".site-lang-group");
    const trigger = document.querySelector(".site-lang-trigger");
    if (trigger && !trigger.dataset.siteI18nBound) {
      trigger.dataset.siteI18nBound = "true";
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(!group.classList.contains("open"));
      });
    }
    document.querySelectorAll("[data-site-lang]").forEach((button) => {
      if (button.dataset.siteI18nBound) return;
      button.dataset.siteI18nBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setLanguage(button.dataset.siteLang);
        setMenuOpen(false);
      });
    });
    const select = document.getElementById("languageSelect");
    if (select && !select.dataset.siteI18nBound) {
      select.dataset.siteI18nBound = "true";
      select.addEventListener("change", (event) => setLanguage(event.target.value));
    }
    document.addEventListener("click", (event) => {
      if (group && !group.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    });
  }

  function init() {
    currentLang = resolveInitialLanguage();
    bindControls();
    applyLanguage();
    if (document.readyState !== "complete") window.addEventListener("load", applyLanguage, { once: true });
  }

  window.MiniToolsI18n = {
    getLanguage: () => currentLang,
    normalizeLang,
    setLanguage,
    applyLanguage
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
