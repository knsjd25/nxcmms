(() => {
  "use strict";

  if (window.MiniToolsI18n) return;

  const SUPPORTED = ["en", "zh-CN", "de", "fr", "es"];
  const SAVED_LANGUAGE_KEY = "miniToolsLang";
  const HTML_LANG = { en: "en-GB", "zh-CN": "zh-CN", de: "de", fr: "fr", es: "es" };
  const NAV_LABELS = {
    en: { home: "Home", search: "Search", popular: "Popular", ukApps: "UK Calculators", devTools: "Developer Tools", other: "Other Tools", about: "About", contact: "Contact", privacy: "Privacy", language: "English", subtitle: "Useful online tools", navigation: "Primary navigation", languageAria: "Language" },
    "zh-CN": { home: "首页", search: "搜索", popular: "热门工具", ukApps: "英国计算器", devTools: "开发者工具", other: "其他工具", about: "关于我们", contact: "联系我们", privacy: "隐私政策", language: "中文", subtitle: "实用在线工具", navigation: "主导航", languageAria: "语言" },
    de: { home: "Startseite", search: "Suche", popular: "Beliebt", ukApps: "UK-Rechner", devTools: "Entwicklertools", other: "Weitere Tools", about: "Über uns", contact: "Kontakt", privacy: "Datenschutz", language: "Deutsch", subtitle: "Nützliche Online-Tools", navigation: "Hauptnavigation", languageAria: "Sprache" },
    fr: { home: "Accueil", search: "Recherche", popular: "Populaires", ukApps: "Calculateurs britanniques", devTools: "Outils de développement", other: "Autres outils", about: "À propos", contact: "Contact", privacy: "Confidentialité", language: "Français", subtitle: "Outils en ligne utiles", navigation: "Navigation principale", languageAria: "Langue" },
    es: { home: "Inicio", search: "Buscar", popular: "Populares", ukApps: "Calculadoras del Reino Unido", devTools: "Herramientas para desarrolladores", other: "Otras herramientas", about: "Acerca de", contact: "Contacto", privacy: "Privacidad", language: "Español", subtitle: "Herramientas en línea útiles", navigation: "Navegación principal", languageAria: "Idioma" }
  };
  let currentLang = "en";
  let applyingPageHook = false;

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
    return SUPPORTED.includes(raw) || lower === "cn" || ["zh", "de", "fr", "es", "en"].some((code) => lower === code || lower.startsWith(`${code}-`));
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
    const description = dict.seoDescription || dict.metaDesc || dict.metaDescription || dict.description;
    if (title) document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', dict.ogTitle || title);
    setMeta('meta[property="og:description"]', dict.ogDescription || description);
    setMeta('meta[name="twitter:title"]', dict.twitterTitle || dict.ogTitle || title);
    setMeta('meta[name="twitter:description"]', dict.twitterDescription || dict.ogDescription || description);
  }

  function applyCanonicalHreflang() {
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
    if (/\bnoindex\b/i.test(robots)) {
      document.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]').forEach((node) => node.remove());
      return;
    }
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
      link.setAttribute("href", code === "en" ? cleanUrl : `${cleanUrl}?lang=${encodeURIComponent(code)}`);
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
      if (currentLang === "en") link.searchParams.delete("lang");
      else link.searchParams.set("lang", currentLang);
      anchor.setAttribute("href", link.pathname + link.search + link.hash);
    });
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
      if (currentLang === "en") target.searchParams.delete("lang");
      else target.searchParams.set("lang", currentLang);
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
    const params = new URLSearchParams(location.search);
    if (!params.has("lang") && currentLang !== "en") {
      const target = new URL(location.href);
      target.searchParams.set("lang", currentLang);
      history.replaceState(null, "", target.pathname + target.search + target.hash);
    }
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
