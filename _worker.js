/**
 * Mini-Tools.uk Cloudflare Pages _worker.js
 * ------------------------------------------------------------
 * Server-side multilingual rendering gateway for static HTML pages.
 *
 * Goal:
 * - Keep your existing HTML/CSS/JS functionality intact.
 * - Serve clean URLs such as /tax instead of /tax.html.
 * - Render the visible HTML body, title, meta description, OG/Twitter tags,
 *   canonical and structured data according to ?lang=en|zh-CN|de|fr|es
 *   before the response reaches Googlebot or the browser.
 *
 * How it works:
 * - Fetches the static HTML page from Cloudflare Pages Assets.
 * - Extracts the page's existing `const translations = { ... }` dictionary.
 * - Applies the selected language to:
 *   1) elements using data-i18n="key"
 *   2) elements whose id matches a translation key, such as upload.html
 *   3) placeholders / alt text for common upload-page fields
 *   4) title, description, canonical, hreflang, robots, og/twitter, JSON-LD
 *
 * Put this file at the Cloudflare Pages deployment root:
 *   /_worker.js
 */

const SITE_ORIGIN = "https://mini-tools.uk";

const DEFAULT_LANG = "en";
const SUPPORTED_LANGS = ["en", "zh-CN", "de", "fr", "es"];
const NOT_FOUND_ROBOTS = "noindex, follow, max-image-preview:large";

const HTML_LANG_FALLBACK = {
  en: "en-GB",
  "zh-CN": "zh-CN",
  de: "de",
  fr: "fr",
  es: "es",
};

const SITE_SHELL_LABELS = {
  en: { home: "Home", search: "Search", popular: "Popular", ukApps: "UK Calculators", devTools: "Developer Tools", other: "Other Tools", about: "About", contact: "Contact", privacy: "Privacy", language: "English", subtitle: "Useful online tools", navigation: "Primary navigation", languageAria: "Language" },
  "zh-CN": { home: "首页", search: "搜索", popular: "热门工具", ukApps: "英国计算器", devTools: "开发者工具", other: "其他工具", about: "关于我们", contact: "联系我们", privacy: "隐私政策", language: "中文", subtitle: "实用在线工具", navigation: "主导航", languageAria: "语言" },
  de: { home: "Startseite", search: "Suche", popular: "Beliebt", ukApps: "UK-Rechner", devTools: "Entwicklertools", other: "Weitere Tools", about: "Über uns", contact: "Kontakt", privacy: "Datenschutz", language: "Deutsch", subtitle: "Nützliche Online-Tools", navigation: "Hauptnavigation", languageAria: "Sprache" },
  fr: { home: "Accueil", search: "Recherche", popular: "Populaires", ukApps: "Calculateurs britanniques", devTools: "Outils de développement", other: "Autres outils", about: "À propos", contact: "Contact", privacy: "Confidentialité", language: "Français", subtitle: "Outils en ligne utiles", navigation: "Navigation principale", languageAria: "Langue" },
  es: { home: "Inicio", search: "Buscar", popular: "Populares", ukApps: "Calculadoras del Reino Unido", devTools: "Herramientas para desarrolladores", other: "Otras herramientas", about: "Acerca de", contact: "Contacto", privacy: "Privacidad", language: "Español", subtitle: "Herramientas en línea útiles", navigation: "Navegación principal", languageAria: "Idioma" },
};

const INDEXABLE_PATHS = new Set([
  "/",
  "/tax",
  "/upload",
  "/vat",
  "/mortgage",
  "/stamp-duty",
  "/ir35",
  "/dividend",
  "/fuel",
  "/working-days",
  "/json",
  "/diff",
  "/token",
  "/image",
  "/pdf2img",
  "/color-picker",
  "/qr",
  "/password",
  "/weight",
  "/about",
  "/contact",
  "/privacy",
]);

const NOINDEX_PATH_PREFIXES = [
  "/pdf",
  "/admin",
  "/image_admin",
  "/map",
];

const TRUSTED_EXTERNAL_DOMAINS = [
  "gov.uk",
  "www.gov.uk",
  "hmrc.gov.uk",
  "www.hmrc.gov.uk",
  "developer.service.hmrc.gov.uk",
];

const REMOVE_LINK_HREF_PARTS = [
  "github.com",
  "/admin",
  "image_admin",
];

const RETIRED_PATHS = new Set(["/game", "/json2", "/unit", "/word"]);

function normalizePathname(pathname) {
  if (!pathname || pathname === "/index.html") return "/";
  let out = pathname;
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  if (out.endsWith(".html")) out = out.slice(0, -5) || "/";
  return out;
}

function assetPathForCleanUrl(pathname) {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return "/index.html";
  return `${normalized}.html`;
}

function isStaticAsset(pathname) {
  return /\.(css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|json|xml|txt|pdf|zip|woff|woff2|ttf|eot|map|avif)$/i.test(pathname);
}

function normalizeLang(raw) {
  if (!raw) return DEFAULT_LANG;
  const lang = String(raw).trim();
  if (!lang) return DEFAULT_LANG;
  const lower = lang.toLowerCase();
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans" || lower === "cn") return "zh-CN";
  if (SUPPORTED_LANGS.includes(lang)) return lang;
  if (SUPPORTED_LANGS.includes(lower)) return lower;
  return DEFAULT_LANG;
}

function langFromUrl(url) {
  const raw = url.searchParams.get("lang");
  return normalizeLang(raw);
}

function hasOnlyLangParam(url) {
  for (const key of url.searchParams.keys()) {
    if (key !== "lang") return false;
  }
  return true;
}

function shouldNoindex(url) {
  const path = normalizePathname(url.pathname);

  if (!INDEXABLE_PATHS.has(path)) {
    return true;
  }

  if (NOINDEX_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return true;
  }

  // Tool result/filter URLs should not create many duplicate indexable pages.
  if (!hasOnlyLangParam(url)) return true;

  return false;
}

function buildCanonical(pathname, lang, url) {
  const path = normalizePathname(pathname);
  const canonical = new URL(SITE_ORIGIN + path);
  if (lang !== DEFAULT_LANG && url.searchParams.has("lang")) {
    canonical.searchParams.set("lang", lang);
  }
  return canonical.toString();
}

function buildHreflang(pathname) {
  const path = normalizePathname(pathname);
  const links = SUPPORTED_LANGS.map((lang) => {
    const href = new URL(SITE_ORIGIN + path);
    if (lang !== DEFAULT_LANG) href.searchParams.set("lang", lang);
    return `<link rel="alternate" hreflang="${lang}" href="${href.toString()}">`;
  });
  links.push(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${path}">`);
  return links.join("\n  ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function parseJsString(source, start) {
  const quote = source[start];
  let i = start + 1;
  let out = "";

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\") {
      const next = source[i + 1];
      if (next === "n") { out += "\n"; i += 2; continue; }
      if (next === "r") { out += "\r"; i += 2; continue; }
      if (next === "t") { out += "\t"; i += 2; continue; }
      if (next === "b") { out += "\b"; i += 2; continue; }
      if (next === "f") { out += "\f"; i += 2; continue; }
      if (next === "u") {
        const hex = source.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
      }
      out += next || "";
      i += 2;
      continue;
    }

    if (ch === quote) {
      return { value: out, end: i + 1 };
    }

    out += ch;
    i += 1;
  }

  return null;
}

function findMatchingBrace(source, openIndex) {
  return findMatchingDelimiter(source, openIndex, "{", "}");
}

function findMatchingBracket(source, openIndex) {
  return findMatchingDelimiter(source, openIndex, "[", "]");
}

function findMatchingDelimiter(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let i = openIndex;
  let quote = null;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }

    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }

    i += 1;
  }

  return -1;
}

function readJsKey(source, start) {
  let i = start;
  while (i < source.length && /[\s,]/.test(source[i])) i += 1;

  const ch = source[i];
  if (ch === '"' || ch === "'") {
    const parsed = parseJsString(source, i);
    if (!parsed) return null;
    return { key: parsed.value, end: parsed.end };
  }

  const match = /^[A-Za-z_$][A-Za-z0-9_$-]*/.exec(source.slice(i));
  if (!match) return null;
  return { key: match[0], end: i + match[0].length };
}

function extractTranslationsSource(html) {
  const marker = /(?:const\s+(?:translations|i18n)\s*=|window\.PAGE_TRANSLATIONS\s*=)/.exec(html);
  if (!marker) return null;
  const start = marker.index;

  const eq = html.indexOf("=", start);
  if (eq === -1) return null;

  const open = html.indexOf("{", eq);
  if (open === -1) return null;

  const close = findMatchingBrace(html, open);
  if (close === -1) return null;

  return html.slice(open, close + 1);
}

function extractLangObjectBody(translationsSource, lang) {
  if (!translationsSource || translationsSource[0] !== "{") return null;

  let i = 1;
  const end = translationsSource.length - 1;

  while (i < end) {
    const keyInfo = readJsKey(translationsSource, i);
    if (!keyInfo) {
      i += 1;
      continue;
    }

    let j = keyInfo.end;
    while (j < end && /\s/.test(translationsSource[j])) j += 1;
    if (translationsSource[j] !== ":") {
      i = j + 1;
      continue;
    }
    j += 1;
    while (j < end && /\s/.test(translationsSource[j])) j += 1;

    if (translationsSource[j] === "{") {
      const close = findMatchingBrace(translationsSource, j);
      if (close === -1) return null;
      if (keyInfo.key === lang) {
        return translationsSource.slice(j + 1, close);
      }
      i = close + 1;
      continue;
    }

    if (translationsSource[j] === '"' || translationsSource[j] === "'") {
      const parsed = parseJsString(translationsSource, j);
      i = parsed ? parsed.end : j + 1;
      continue;
    }

    i = j + 1;
  }

  return null;
}

function parseFlatStringMap(objectBody) {
  const dict = {};
  let i = 0;

  while (i < objectBody.length) {
    const keyInfo = readJsKey(objectBody, i);
    if (!keyInfo) {
      i += 1;
      continue;
    }

    let j = keyInfo.end;
    while (j < objectBody.length && /\s/.test(objectBody[j])) j += 1;

    if (objectBody[j] !== ":") {
      i = j + 1;
      continue;
    }

    j += 1;
    while (j < objectBody.length && /\s/.test(objectBody[j])) j += 1;

    const valueStart = objectBody[j];

    if (valueStart === '"' || valueStart === "'" || valueStart === "`") {
      const parsed = parseJsString(objectBody, j);
      if (parsed) {
        dict[keyInfo.key] = parsed.value;
        i = parsed.end;
        continue;
      }
    }

    if (valueStart === "{") {
      const close = findMatchingBrace(objectBody, j);
      i = close === -1 ? j + 1 : close + 1;
      continue;
    }

    if (valueStart === "[") {
      const close = findMatchingBracket(objectBody, j);
      i = close === -1 ? j + 1 : close + 1;
      continue;
    }

    // Skip non-string values.
    i = j;
    while (i < objectBody.length && objectBody[i] !== "," && objectBody[i] !== "\n") i += 1;
    if (i < objectBody.length) i += 1;
  }

  return dict;
}

function extractAssignedObjectBodies(html, lang) {
  const bodies = [];
  const acceptedTargets = new Set([
    `translations.${lang}`,
    `translations["${lang}"]`,
    `translations['${lang}']`,
    `i18n.${lang}`,
    `i18n["${lang}"]`,
    `i18n['${lang}']`,
  ]);
  let cursor = 0;

  while ((cursor = html.indexOf("Object.assign(", cursor)) !== -1) {
    const targetStart = cursor + "Object.assign(".length;
    const comma = html.indexOf(",", targetStart);
    if (comma === -1) break;
    const target = html.slice(targetStart, comma).replace(/\s+/g, "");
    cursor = comma + 1;
    if (!acceptedTargets.has(target)) continue;

    const open = html.indexOf("{", cursor);
    if (open === -1) continue;
    const close = findMatchingBrace(html, open);
    if (close === -1) continue;
    bodies.push(html.slice(open + 1, close));
    cursor = close + 1;
  }

  return bodies;
}

function extractDictionary(html, lang) {
  const src = extractTranslationsSource(html);
  if (!src) return null;

  const languageKeys = lang === "zh-CN" ? ["zh-CN", "zh"] : [lang];
  const defaultBody = extractLangObjectBody(src, DEFAULT_LANG);
  const languageBody = languageKeys.map((key) => extractLangObjectBody(src, key)).find(Boolean);
  const dict = defaultBody ? parseFlatStringMap(defaultBody) : {};
  if (languageBody) Object.assign(dict, parseFlatStringMap(languageBody));
  languageKeys.forEach((key) => {
    extractAssignedObjectBodies(html, key).forEach((body) => Object.assign(dict, parseFlatStringMap(body)));
  });
  return Object.keys(dict).length ? dict : null;
}

function replaceElementInnerByAttribute(html, attrName, key, replacement, allowHtml = false) {
  const safeKey = escapeRegExp(key);
  const attr = escapeRegExp(attrName);
  const re = new RegExp(`(<([A-Za-z][A-Za-z0-9:-]*)\\b(?=[^>]*\\s${attr}=(["'])${safeKey}\\3)[^>]*>)([\\s\\S]*?)(<\\/\\2>)`, "g");
  const value = allowHtml ? String(replacement ?? "") : escapeHtml(replacement);
  return html.replace(re, `$1${value}$5`);
}

function replaceElementInnerById(html, id, replacement) {
  const safeId = escapeRegExp(id);
  const re = new RegExp(`(<([A-Za-z][A-Za-z0-9:-]*)\\b(?=[^>]*\\sid=(["'])${safeId}\\3)[^>]*>)([\\s\\S]*?)(<\\/\\2>)`, "g");
  const raw = String(replacement ?? "");
  const value = raw.includes("<") && raw.includes(">") ? raw : escapeHtml(raw);
  return html.replace(re, `$1${value}$5`);
}

function setAttributeOnElementById(html, id, attrName, attrValue) {
  const safeId = escapeRegExp(id);
  const re = new RegExp(`<([A-Za-z][A-Za-z0-9:-]*)\\b([^>]*\\sid=(["'])${safeId}\\3[^>]*)>`, "g");
  return html.replace(re, (match, tag, attrs) => {
    const value = escapeAttr(attrValue);
    const attrRe = new RegExp(`\\s${escapeRegExp(attrName)}=(["'])[\\s\\S]*?\\1`, "i");
    if (attrRe.test(attrs)) {
      return `<${tag}${attrs.replace(attrRe, ` ${attrName}="${value}"`)}>`;
    }
    return `<${tag}${attrs} ${attrName}="${value}">`;
  });
}

function renderTranslatedBody(html, dict) {
  if (!dict) return html;

  for (const [key, value] of Object.entries(dict)) {
    html = replaceElementInnerByAttribute(html, "data-i18n", key, value, false);
    html = replaceElementInnerByAttribute(html, "data-i18n-html", key, value, true);
  }

  // Some older pages, especially upload.html, use ids rather than data-i18n.
  const idKeysToSkip = new Set([
    "htmlLang",
    "locale",
    "seoTitle",
    "seoDescription",
    "seoKeywords",
    "ogTitle",
    "ogDescription",
    "schemaAppName",
    "schemaDescription",
    "storageCodePlaceholder",
    "captchaPlaceholder",
    "previewAlt",
    "uploadingBtn",
    "copiedButton",
  ]);

  for (const [key, value] of Object.entries(dict)) {
    if (idKeysToSkip.has(key)) continue;
    html = replaceElementInnerById(html, key, value);
  }

  if (dict.storageCodePlaceholder) {
    html = setAttributeOnElementById(html, "storageCodeInput", "placeholder", dict.storageCodePlaceholder);
  }
  if (dict.captchaPlaceholder) {
    html = setAttributeOnElementById(html, "captchaAnswerInput", "placeholder", dict.captchaPlaceholder);
  }
  if (dict.previewAlt) {
    html = setAttributeOnElementById(html, "previewImage", "alt", dict.previewAlt);
  }

  return html;
}

function renderTranslatedSiteShell(html, lang) {
  const labels = SITE_SHELL_LABELS[lang] || SITE_SHELL_LABELS.en;
  for (const key of ["home", "search", "popular", "ukApps", "devTools", "other", "about", "contact", "privacy"]) {
    html = replaceElementInnerByAttribute(html, "data-site-nav", key, labels[key], false);
  }
  html = replaceElementInnerByAttribute(html, "data-site-shell", "subtitle", labels.subtitle, false);
  html = setAttributeOnElementByAttribute(html, "data-site-shell-aria", "navigation", "aria-label", labels.navigation);
  html = setAttributeOnElementByAttribute(html, "data-site-shell-aria", "language", "aria-label", labels.languageAria);
  html = replaceElementInnerById(html, "currentLangLabel", labels.language);
  return html;
}

function setAttributeOnElementByAttribute(html, selectorAttr, selectorValue, attrName, attrValue) {
  const selector = escapeRegExp(selectorAttr);
  const valuePattern = escapeRegExp(selectorValue);
  const re = new RegExp(`<([A-Za-z][A-Za-z0-9:-]*)\\b([^>]*\\s${selector}=(["'])${valuePattern}\\3[^>]*)>`, "g");
  return html.replace(re, (match, tag, attrs) => {
    const value = escapeAttr(attrValue);
    const attrRe = new RegExp(`\\s${escapeRegExp(attrName)}=(["'])[\\s\\S]*?\\1`, "i");
    if (attrRe.test(attrs)) {
      return `<${tag}${attrs.replace(attrRe, ` ${attrName}="${value}"`)}>`;
    }
    return `<${tag}${attrs} ${attrName}="${value}">`;
  });
}

function removeSeoConflicts(html) {
  return html
    .replace(/<meta\b[^>]*\bname=(["'])keywords\1[^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*\bname=(["'])robots\1[^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*\brel=(["'])canonical\1[^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*\brel=(["'])alternate\1[^>]*\bhreflang=(["'])[^"']+\2[^>]*>\s*/gi, "");
}

function setOrInsertMetaName(html, name, content) {
  const safeContent = escapeAttr(content);
  const re = new RegExp(`<meta\\b([^>]*\\bname=(["'])${escapeRegExp(name)}\\2[^>]*)>`, "i");
  if (re.test(html)) {
    return html.replace(re, (m) => {
      if (/\bcontent=(["'])[\s\S]*?\1/i.test(m)) {
        return m.replace(/\bcontent=(["'])[\s\S]*?\1/i, `content="${safeContent}"`);
      }
      return m.replace(/>$/, ` content="${safeContent}">`);
    });
  }
  return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n  <meta name="${name}" content="${safeContent}">`);
}

function setOrInsertMetaProperty(html, property, content) {
  const safeContent = escapeAttr(content);
  const re = new RegExp(`<meta\\b([^>]*\\bproperty=(["'])${escapeRegExp(property)}\\2[^>]*)>`, "i");
  if (re.test(html)) {
    return html.replace(re, (m) => {
      if (/\bcontent=(["'])[\s\S]*?\1/i.test(m)) {
        return m.replace(/\bcontent=(["'])[\s\S]*?\1/i, `content="${safeContent}"`);
      }
      return m.replace(/>$/, ` content="${safeContent}">`);
    });
  }
  return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n  <meta property="${property}" content="${safeContent}">`);
}

function setTitle(html, title) {
  if (!title) return html;
  const value = escapeHtml(title);
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${value}</title>`);
  }
  return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n  <title>${value}</title>`);
}

function setHtmlLang(html, langValue) {
  const value = escapeAttr(langValue || "en-GB");
  if (/<html\b[^>]*\blang=(["'])[\s\S]*?\1/i.test(html)) {
    return html.replace(/<html\b([^>]*?)\blang=(["'])[\s\S]*?\2([^>]*)>/i, `<html$1lang="${value}"$3>`);
  }
  return html.replace(/<html\b([^>]*)>/i, `<html$1 lang="${value}">`);
}

function injectHeadSeo(html, pathname, lang, url, robots) {
  const path = normalizePathname(pathname);
  const canonical = buildCanonical(path, lang, url);
  const hreflang = INDEXABLE_PATHS.has(path) && !robots.startsWith("noindex") ? `\n  ${buildHreflang(path)}` : "";
  const block = `
  <link rel="canonical" href="${canonical}">${hreflang}
  <meta name="robots" content="${robots}">`;

  return html.replace(/<\/head>/i, `${block}\n</head>`);
}

function updateSeoForLang(html, dict, pathname, lang, url, robots) {
  const title = dict?.seoTitle || dict?.metaTitle || dict?.title || dict?.ogTitle;
  const description = dict?.seoDescription || dict?.metaDesc || dict?.description || dict?.ogDescription;
  const ogTitle = dict?.ogTitle || title;
  const ogDescription = dict?.ogDescription || description;
  const canonical = buildCanonical(pathname, lang, url);

  html = removeSeoConflicts(html);
  html = setHtmlLang(html, dict?.htmlLang || HTML_LANG_FALLBACK[lang] || "en-GB");
  if (title) html = setTitle(html, title);
  if (description) html = setOrInsertMetaName(html, "description", description);

  html = setOrInsertMetaName(html, "robots", robots);
  if (ogTitle) html = setOrInsertMetaProperty(html, "og:title", ogTitle);
  if (ogDescription) html = setOrInsertMetaProperty(html, "og:description", ogDescription);
  html = setOrInsertMetaProperty(html, "og:url", canonical);

  if (title) html = setOrInsertMetaName(html, "twitter:title", title);
  if (description) html = setOrInsertMetaName(html, "twitter:description", description);

  html = injectHeadSeo(html, pathname, lang, url, robots);

  return html;
}

function replaceScriptJsonById(html, id, jsonObject) {
  const re = new RegExp(`(<script\\b(?=[^>]*\\bid=(["'])${escapeRegExp(id)}\\2)[^>]*>)[\\s\\S]*?(<\\/script>)`, "i");
  if (!re.test(html)) return html;
  return html.replace(re, `$1\n${escapeHtmlForScript(JSON.stringify(jsonObject, null, 2))}\n$3`);
}

function escapeHtmlForScript(value) {
  return String(value).replace(/<\/script/gi, "<\\/script");
}

function buildFaqItems(dict) {
  const items = [];
  for (let i = 1; i <= 10; i += 1) {
    const q = dict[`faq${i}Q`] || dict[`faq${i}Title`] || dict[`schemaFaq${i}Title`];
    const a = dict[`faq${i}A`] || dict[`faq${i}Text`] || dict[`schemaFaq${i}Text`];
    if (q && a) {
      items.push({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": a,
        },
      });
    }
  }
  return items;
}

function updateStructuredDataServerSide(html, dict, pathname, lang, url) {
  if (!dict) return html;
  const canonical = buildCanonical(pathname, lang, url);

  if (dict.schemaAppName || dict.schemaDescription) {
    const appSchema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          "name": dict.schemaAppName || dict.title || dict.seoTitle || "Mini-Tools.uk",
          "applicationCategory": "UtilitiesApplication",
          "operatingSystem": "Web",
          "url": canonical,
          "description": dict.schemaDescription || dict.description || dict.seoDescription || "",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        },
      ],
    };

    const faq = buildFaqItems(dict);
    if (faq.length) {
      appSchema["@graph"].push({
        "@type": "FAQPage",
        "mainEntity": faq,
      });
    }

    html = replaceScriptJsonById(html, "appSchema", appSchema);
  }

  if (/<script\b(?=[^>]*\bid=(["'])software-schema\1)[^>]*>/i.test(html)) {
    const app = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": (dict.title || dict.seoTitle || "Mini-Tools.uk").replace(/\s+\|\s+Mini-Tools\.uk$/i, ""),
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "url": canonical,
      "description": dict.description || dict.seoDescription || "",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GBP" },
      "featureList": [
        dict.grossIncome,
        dict.taxRowLabel,
        dict.niRowLabel,
        dict.pensionRowLabel,
        dict.studentRowLabel,
        dict.netRowLabel,
      ].filter(Boolean),
    };
    html = replaceScriptJsonById(html, "software-schema", app);
  }

  if (/<script\b(?=[^>]*\bid=(["'])faq-schema\1)[^>]*>/i.test(html)) {
    const faq = buildFaqItems(dict);
    if (faq.length) {
      html = replaceScriptJsonById(html, "faq-schema", {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq,
      });
    }
  }

  return html;
}

function injectServerLangScript(html, lang) {
  const safeLang = JSON.stringify(lang);
  const script = `<script>
window.MINI_TOOLS_SERVER_LANG=${safeLang};
</script>`;

  return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${script}`);
}

function rewriteInternalLinks(html, lang) {
  return html.replace(/<a\b([^>]*?)\bhref=(["'])(\/[^"']*)\2([^>]*)>/gi, (match, before, quote, href, after) => {
    if (href.startsWith("//")) return match;
    if (href.startsWith("/api/")) return match;

    try {
      const parsed = new URL(href, SITE_ORIGIN);
      if (lang !== DEFAULT_LANG) {
        parsed.searchParams.set("lang", lang);
      } else {
        parsed.searchParams.delete("lang");
      }
      const nextHref = parsed.pathname + parsed.search + parsed.hash;
      return `<a${before}href=${quote}${nextHref}${quote}${after}>`;
    } catch (_) {
      return match;
    }
  });
}

function applyExternalLinkPolicy(html) {
  // Remove public admin/editor/GitHub links as anchors while preserving the visible text.
  html = html.replace(/<a\b([^>]*?)\bhref=(["'])([^"']*)\2([^>]*)>([\s\S]*?)<\/a>/gi, (match, before, quote, href, after, inner) => {
    const lower = href.toLowerCase();
    if (REMOVE_LINK_HREF_PARTS.some((part) => lower.includes(part.toLowerCase()))) {
      return inner;
    }
    return match;
  });

  // Add rel policy to absolute external links.
  html = html.replace(/<a\b([^>]*?)\bhref=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi, (match, before, quote, href, after) => {
    try {
      const parsed = new URL(href);
      if (parsed.origin === SITE_ORIGIN) return match;

      const host = parsed.hostname.toLowerCase();
      const trusted = TRUSTED_EXTERNAL_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain));
      const relValue = trusted ? "noopener noreferrer" : "nofollow noopener noreferrer";
      let attrs = `${before}href=${quote}${href}${quote}${after}`;

      if (/\brel=(["'])[\s\S]*?\1/i.test(attrs)) {
        attrs = attrs.replace(/\brel=(["'])[\s\S]*?\1/i, `rel="${relValue}"`);
      } else {
        attrs += ` rel="${relValue}"`;
      }

      if (!/\btarget=(["'])[\s\S]*?\1/i.test(attrs)) {
        attrs += ` target="_blank"`;
      }

      return `<a${attrs}>`;
    } catch (_) {
      return match;
    }
  });

  return html;
}

async function fetchAsset(request, env, pathname) {
  const originalUrl = new URL(request.url);

  let response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  const fallbackUrl = new URL(request.url);
  fallbackUrl.pathname = assetPathForCleanUrl(pathname);

  if (fallbackUrl.pathname === originalUrl.pathname) return response;

  const fallbackResponse = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));

  if (fallbackResponse.status >= 300 && fallbackResponse.status < 400) {
    const location = fallbackResponse.headers.get("Location") || "";
    try {
      const target = new URL(location, originalUrl);
      if (normalizePathname(target.pathname) === normalizePathname(originalUrl.pathname)) {
        return response;
      }
    } catch (_) {
      return response;
    }
  }

  return fallbackResponse;
}

function responseWithBody(original, body, robots, contentType = "text/html; charset=utf-8") {
  const headers = new Headers(original.headers);
  headers.set("content-type", contentType);
  headers.set("X-Robots-Tag", robots);
  headers.set("Vary", "Accept-Encoding");
  return new Response(body, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });
}

function responseWithRobots(original, robots) {
  const headers = new Headers(original.headers);
  headers.set("X-Robots-Tag", robots);
  return new Response(original.body, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });
}

function maybeRedirectNormalizedUrl(requestUrl) {
  const url = new URL(requestUrl);
  let changed = false;

  const normalizedPath = normalizePathname(url.pathname);
  if (url.pathname === "/index.html" || (url.pathname.endsWith(".html") && INDEXABLE_PATHS.has(normalizedPath))) {
    url.pathname = normalizePathname(url.pathname);
    changed = true;
  }

  const rawLang = url.searchParams.get("lang");
  if (rawLang !== null) {
    const normalized = normalizeLang(rawLang);
    const trimmed = String(rawLang).trim();
    const isSupportedVariant =
      trimmed === normalized ||
      trimmed.toLowerCase() === normalized.toLowerCase() ||
      (normalized === "zh-CN" && ["zh", "zh-cn", "zh-hans", "cn"].includes(trimmed.toLowerCase()));

    if (!trimmed || !isSupportedVariant) {
      url.searchParams.set("lang", DEFAULT_LANG);
      changed = true;
    } else if (rawLang !== normalized) {
      url.searchParams.set("lang", normalized);
      changed = true;
    }
  }

  return changed ? url.toString() : null;
}

function serverRenderHtml(html, requestUrl) {
  const url = new URL(requestUrl);
  const pathname = normalizePathname(url.pathname);
  const lang = langFromUrl(url);
  const robots = shouldNoindex(url)
    ? "noindex, follow, max-image-preview:large"
    : "index, follow, max-image-preview:large";

  const dict = extractDictionary(html, lang);

  html = renderTranslatedBody(html, dict);
  html = renderTranslatedSiteShell(html, lang);
  html = updateSeoForLang(html, dict, pathname, lang, url, robots);
  html = updateStructuredDataServerSide(html, dict, pathname, lang, url);
  html = rewriteInternalLinks(html, lang);
  html = applyExternalLinkPolicy(html);
  html = injectServerLangScript(html, lang);

  return { html, robots };
}

function removeIndexableSeoLinks(html) {
  return html
    .replace(/<link\b[^>]*\brel=(["'])canonical\1[^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*\brel=(["'])alternate\1[^>]*\bhreflang=(["'])[^"']+\2[^>]*>\s*/gi, "");
}

function buildFallback404Html(requestUrl) {
  const url = new URL(requestUrl);
  const lang = langFromUrl(url);
  const copy = {
    en: { title: "Page not found", text: "The page you requested does not exist, may have been removed, or the address may be incorrect.", home: "Return to homepage", search: "Search all tools", popular: "Popular tools", navHome: "Home", navSearch: "Search", navPopular: "Popular", navAbout: "About", navContact: "Contact", navPrivacy: "Privacy" },
    "zh-CN": { title: "页面未找到", text: "你请求的页面不存在、可能已被删除，或地址输入有误。", home: "返回首页", search: "搜索全部工具", popular: "热门工具", navHome: "首页", navSearch: "搜索", navPopular: "热门工具", navAbout: "关于我们", navContact: "联系我们", navPrivacy: "隐私政策" },
    de: { title: "Seite nicht gefunden", text: "Die angeforderte Seite existiert nicht, wurde möglicherweise entfernt oder die Adresse ist falsch.", home: "Zur Startseite", search: "Alle Tools durchsuchen", popular: "Beliebte Tools", navHome: "Startseite", navSearch: "Suche", navPopular: "Beliebt", navAbout: "Über uns", navContact: "Kontakt", navPrivacy: "Datenschutz" },
    fr: { title: "Page introuvable", text: "La page demandée n’existe pas, a peut-être été supprimée ou l’adresse est incorrecte.", home: "Retour à l’accueil", search: "Rechercher tous les outils", popular: "Outils populaires", navHome: "Accueil", navSearch: "Recherche", navPopular: "Populaires", navAbout: "À propos", navContact: "Contact", navPrivacy: "Confidentialité" },
    es: { title: "Página no encontrada", text: "La página solicitada no existe, puede haber sido eliminada o la dirección es incorrecta.", home: "Volver al inicio", search: "Buscar todas las herramientas", popular: "Herramientas populares", navHome: "Inicio", navSearch: "Buscar", navPopular: "Populares", navAbout: "Acerca de", navContact: "Contacto", navPrivacy: "Privacidad" },
  }[lang];
  const langLinks = SUPPORTED_LANGS.map((code) => {
    const target = new URL(url.pathname, SITE_ORIGIN);
    if (code !== DEFAULT_LANG) target.searchParams.set("lang", code);
    const label = { en: "English", "zh-CN": "中文", de: "Deutsch", fr: "Français", es: "Español" }[code];
    return `<a href="${escapeAttr(target.pathname + target.search)}">${label}</a>`;
  }).join("");
  const suffix = lang === DEFAULT_LANG ? "" : `?lang=${encodeURIComponent(lang)}`;
  const homeHref = `/${suffix}`;
  const searchHref = lang === DEFAULT_LANG ? "/#search" : `/${suffix}#search`;
  const popularHref = lang === DEFAULT_LANG ? "/#popular" : `/${suffix}#popular`;

  return `<!doctype html>
<html lang="${HTML_LANG_FALLBACK[lang] || "en-GB"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>${escapeHtml(copy.title)} - Mini-Tools.uk</title>
  <link rel="stylesheet" href="/site-nav.css">
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.site-nav{background:#fff;border-bottom:1px solid #e2e8f0}.site-nav-inner,.error-wrap,.footer-inner{width:calc(100% - 40px);max-width:1180px;margin:0 auto}.site-nav-inner{min-height:74px;display:flex;align-items:center;gap:18px}.site-brand{display:flex;align-items:center;gap:10px;color:#0f172a;text-decoration:none;font-weight:850}.site-brand img{width:40px;height:40px;border-radius:12px}.site-nav-links,.language-links,.error-actions,.popular-tools,.footer-links{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.site-nav-links{margin-left:auto}.site-nav a,.footer a{color:#334155;text-decoration:none}.error-wrap{min-height:calc(100vh - 190px);display:grid;place-items:center;padding:64px 0}.error-card{width:100%;max-width:820px;padding:48px;border:1px solid #e2e8f0;border-radius:28px;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.08);text-align:center}.error-code{color:#2563eb;font-size:.9rem;font-weight:850;letter-spacing:.14em}.error-card h1{margin:12px 0;font-size:clamp(2rem,7vw,4.5rem)}.error-card>p{max-width:650px;margin:0 auto 26px;color:#64748b;font-size:1.05rem}.error-actions,.popular-tools,.language-links{justify-content:center}.button{padding:12px 18px;border-radius:14px;background:#2563eb!important;color:#fff!important;font-weight:800}.button.secondary{background:#eff6ff!important;color:#1d4ed8!important}.popular{margin-top:34px;padding-top:28px;border-top:1px solid #e2e8f0}.popular h2{font-size:1rem}.popular-tools a,.language-links a{padding:9px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.language-links{margin-top:24px}.footer{padding:28px 0 40px;border-top:1px solid #e2e8f0;background:#fff}.footer-inner{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;color:#64748b}@media(max-width:900px){.site-nav-inner{padding:14px 0;align-items:flex-start;flex-direction:column}.site-nav-links{margin-left:0}.error-card{padding:32px 22px}}
  </style>
</head>
<body>
  <nav class="site-nav" aria-label="Primary navigation"><div class="site-nav-inner">
    <a class="site-brand" href="${homeHref}"><img src="https://assets.mini-tools.uk/image/icon-64x64.png" alt="Mini-Tools.uk logo"><span>Mini-Tools<span style="color:#2563eb">.uk</span></span></a>
    <div class="site-nav-links"><a href="${homeHref}">${escapeHtml(copy.navHome)}</a><a href="${searchHref}">${escapeHtml(copy.navSearch)}</a><a href="${popularHref}">${escapeHtml(copy.navPopular)}</a><a href="/about${suffix}">${escapeHtml(copy.navAbout)}</a><a href="/contact${suffix}">${escapeHtml(copy.navContact)}</a><a href="/privacy${suffix}">${escapeHtml(copy.navPrivacy)}</a></div>
  </div></nav>
  <main class="error-wrap"><section class="error-card"><div class="error-code">404</div><h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.text)}</p>
    <div class="error-actions"><a class="button" href="${homeHref}">${escapeHtml(copy.home)}</a><a class="button secondary" href="${searchHref}">${escapeHtml(copy.search)}</a></div>
    <div class="popular"><h2>${escapeHtml(copy.popular)}</h2><div class="popular-tools"><a href="/tax${suffix}">UK Tax Calculator</a><a href="/vat${suffix}">VAT Calculator</a><a href="/json${suffix}">JSON Formatter</a><a href="/image${suffix}">Image Compressor</a><a href="/qr${suffix}">QR Code Generator</a></div></div>
    <div class="language-links">${langLinks}</div>
  </section></main>
  <footer class="footer"><div class="footer-inner"><span>Copyright 2026 Mini-Tools.uk</span><div class="footer-links"><a href="${homeHref}">${escapeHtml(copy.navHome)}</a><a href="/about${suffix}">${escapeHtml(copy.navAbout)}</a><a href="/contact${suffix}">${escapeHtml(copy.navContact)}</a><a href="/privacy${suffix}">${escapeHtml(copy.navPrivacy)}</a><a href="mailto:yuyananuu@gmail.com" data-cfemail="false">yuyananuu@gmail.com</a></div></div></footer>
</body></html>`;
}

async function render404(request, env, status = 404) {
  const requestUrl = new URL(request.url);
  const notFoundUrl = new URL("/404.html", requestUrl.origin);
  const assetResponse = await env.ASSETS.fetch(new Request(notFoundUrl.toString(), request));
  const assetContentType = assetResponse.headers.get("content-type") || "";
  const assetBody = await assetResponse.text();

  if (!assetContentType.toLowerCase().includes("text/html") || !assetBody.trim()) {
    return new Response(buildFallback404Html(request.url), {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "X-Robots-Tag": NOT_FOUND_ROBOTS,
        "Vary": "Accept-Encoding",
      },
    });
  }

  const rendered = serverRenderHtml(assetBody, request.url);
  const html = removeIndexableSeoLinks(rendered.html);
  const headers = new Headers(assetResponse.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("X-Robots-Tag", NOT_FOUND_ROBOTS);
  headers.set("Vary", "Accept-Encoding");
  headers.delete("content-length");

  return new Response(html, { status, headers });
}

export default {
  async fetch(request, env) {
    const initialUrl = new URL(request.url);
    const initialPathname = initialUrl.pathname;

    if (initialPathname === "/image-compressor") {
      return Response.redirect(`${SITE_ORIGIN}/image${initialUrl.search}`, 301);
    }

    if (initialPathname === "/pdf-to-image") {
      return Response.redirect(`${SITE_ORIGIN}/pdf2img${initialUrl.search}`, 301);
    }

    if (initialPathname === "/terms" || initialPathname === "/acceptable-use") {
      return Response.redirect(`${SITE_ORIGIN}/privacy`, 301);
    }

    if (initialPathname === "/blog" || initialPathname.startsWith("/blog/")) {
      return render404(request, env, 410);
    }

    if (RETIRED_PATHS.has(normalizePathname(initialPathname))) {
      return render404(request, env, 410);
    }

    if (initialPathname === "/404.html") {
      return render404(request, env, 200);
    }

    if (normalizePathname(initialPathname) === "/404") {
      return render404(request, env);
    }

    const redirectTo = maybeRedirectNormalizedUrl(request.url);
    if (redirectTo) {
      return Response.redirect(redirectTo, 301);
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (isStaticAsset(pathname)) {
      return env.ASSETS.fetch(request);
    }

    const assetResponse = await fetchAsset(request, env, pathname);
    if (assetResponse.status === 404) {
      return render404(request, env);
    }
    const contentType = assetResponse.headers.get("content-type") || "";

    const robots = shouldNoindex(url)
      ? "noindex, follow, max-image-preview:large"
      : "index, follow, max-image-preview:large";

    if (!contentType.toLowerCase().includes("text/html")) {
      return responseWithRobots(assetResponse, robots);
    }

    const originalHtml = await assetResponse.text();
    const rendered = serverRenderHtml(originalHtml, request.url);

    return responseWithBody(assetResponse, rendered.html, rendered.robots);
  },
};
