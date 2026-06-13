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

const HTML_LANG_FALLBACK = {
  en: "en-GB",
  "zh-CN": "zh-CN",
  de: "de",
  fr: "fr",
  es: "es",
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
    href.searchParams.set("lang", lang);
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

  if (url.pathname === "/index.html" || url.pathname.endsWith(".html")) {
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
      url.searchParams.delete("lang");
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
  html = updateSeoForLang(html, dict, pathname, lang, url, robots);
  html = updateStructuredDataServerSide(html, dict, pathname, lang, url);
  html = rewriteInternalLinks(html, lang);
  html = applyExternalLinkPolicy(html);
  html = injectServerLangScript(html, lang);

  return { html, robots };
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
      return new Response("Gone", {
        status: 410,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, follow, max-image-preview:large",
        },
      });
    }

    if (RETIRED_PATHS.has(normalizePathname(initialPathname))) {
      return new Response("Gone", {
        status: 410,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, follow, max-image-preview:large",
        },
      });
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
