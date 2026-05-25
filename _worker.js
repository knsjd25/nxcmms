/**
 * Mini-Tools.uk Cloudflare Pages _worker.js
 * ------------------------------------------------------------
 * First-stage safe SEO gateway for a static HTML site on Cloudflare Pages.
 *
 * What it does:
 * 1) Redirects /page.html -> /page
 * 2) Fetches clean URLs first and only falls back to /page.html on 404, avoiding redirect loops
 * 3) Removes <meta name="keywords">
 * 4) Replaces old canonical / robots / hreflang tags with unified versions
 * 5) Adds X-Robots-Tag headers
 * 6) Applies external-link policy:
 *    - removes public GitHub/editor/admin links
 *    - keeps GOV.UK / HMRC official links without nofollow
 *    - adds nofollow to other non-official external links
 * 7) Leaves /blog routes alone, so your existing blog Worker / D1 logic is not broken
 *
 * v2 fix: avoids /upload -> /upload.html -> /upload loops when _redirects also handles .html URLs.
 *
 * Put this file at the Cloudflare Pages deployment root:
 *   /_worker.js
 *
 * If you use a build output directory such as dist/ or public/,
 * make sure the deployed output contains:
 *   dist/_worker.js
 */

const SITE_ORIGIN = "https://mini-tools.uk";

const DEFAULT_LANG = "en";
const SUPPORTED_LANGS = ["en", "zh-CN", "de", "fr", "es"];

const HTML_LANG = {
  en: "en-GB",
  "zh-CN": "zh-CN",
  de: "de",
  fr: "fr",
  es: "es",
};

// Routes handled by another Worker or dynamic service.
// Keep /blog here while your blog SSR/API/editor runs elsewhere.
const PASSTHROUGH_PREFIXES = [
  "/blog",
  "/blog/",
];

// Public pages that should receive canonical + hreflang.
const INDEXABLE_PAGES = new Set([
  "/",
  "/tax",
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
  "/upload",
  "/pdf2img",
  "/pdf",
  "/color-picker",
  "/qr",
  "/password",
  "/weight",
  "/about",
  "/contact",
  "/privacy",
]);

// Paths that must never be indexed if they are exposed by Pages.
const NOINDEX_PATH_PREFIXES = [
  "/blog/search",
  "/blog/tag",
  "/blog/editor",
  "/blog/api",
  "/image_admin",
  "/map",
  "/admin",
];

// External domains that are useful and trusted enough not to receive nofollow.
// Add official documentation domains here if needed.
const TRUSTED_EXTERNAL_DOMAINS = [
  "gov.uk",
  "www.gov.uk",
  "hmrc.gov.uk",
  "www.hmrc.gov.uk",
  "developer.service.hmrc.gov.uk",
];

// Public links that should be removed from rendered HTML.
const REMOVE_LINK_HREF_PARTS = [
  "github.com",
  "/blog/editor",
  "image_admin",
  "/admin",
];

function normalizePathname(pathname) {
  if (!pathname || pathname === "/index.html") return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  if (pathname.endsWith(".html")) {
    return pathname.slice(0, -5) || "/";
  }
  return pathname;
}

function isStaticAsset(pathname) {
  return /\.(css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|json|xml|txt|pdf|zip|woff|woff2|ttf|eot|map|avif)$/i.test(pathname);
}

function isPassthroughPath(pathname) {
  const normalized = normalizePathname(pathname);
  return PASSTHROUGH_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) return normalized.startsWith(prefix.slice(0, -1) + "/");
    return normalized === prefix || normalized.startsWith(prefix + "/");
  });
}

function normalizeLang(rawLang) {
  if (!rawLang) return DEFAULT_LANG;
  if (rawLang === "zh" || rawLang === "cn" || rawLang === "zh-cn") return "zh-CN";
  return SUPPORTED_LANGS.includes(rawLang) ? rawLang : DEFAULT_LANG;
}

function langParamForUrl(lang) {
  return encodeURIComponent(lang);
}

function buildPageUrl(pathname, lang, includeLang = true) {
  const normalizedPath = normalizePathname(pathname);
  const url = new URL(SITE_ORIGIN + normalizedPath);

  if (includeLang) {
    url.searchParams.set("lang", langParamForUrl(lang));
  }

  // URLSearchParams encodes zh-CN safely; keep output readable.
  return url.toString().replace("zh-CN", "zh-CN");
}

function buildCanonical(pathname, lang, url) {
  const normalizedPath = normalizePathname(pathname);
  const canonical = new URL(SITE_ORIGIN + normalizedPath);

  // For clean default URL, /tax remains canonical for x-default/default entry.
  // For explicit language URLs, keep self-referencing canonicals.
  const rawLang = url.searchParams.get("lang");
  if (rawLang) {
    canonical.searchParams.set("lang", lang);
  }

  return canonical.toString();
}

function buildHreflang(pathname) {
  const normalizedPath = normalizePathname(pathname);

  const tags = SUPPORTED_LANGS.map((lang) => {
    const href = buildPageUrl(normalizedPath, lang, true);
    return `<link rel="alternate" hreflang="${lang}" href="${href}">`;
  });

  tags.push(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${normalizedPath}">`);
  return tags.join("\n    ");
}

function shouldNoindex(url) {
  const normalizedPath = normalizePathname(url.pathname);

  if (NOINDEX_PATH_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix + "/"))) {
    return true;
  }

  // Internal search/filter/sort pages should not become indexable landing pages.
  if (url.searchParams.has("q")) return true;
  if (url.searchParams.has("search")) return true;
  if (url.searchParams.has("sort")) return true;
  if (url.searchParams.has("tag")) return true;

  // Unknown HTML-like paths are better left indexable decision to origin/404,
  // but known public pages are handled explicitly.
  return false;
}

function assetPathForCleanUrl(pathname) {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === "/") return "/index.html";
  return `${normalizedPath}.html`;
}

function isTrustedExternalUrl(href) {
  try {
    const parsed = new URL(href, SITE_ORIGIN);
    if (parsed.origin === SITE_ORIGIN) return true;

    const host = parsed.hostname.toLowerCase();
    return TRUSTED_EXTERNAL_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain));
  } catch {
    return true;
  }
}

function shouldRemoveHref(href) {
  if (!href) return false;
  const lower = href.toLowerCase();
  return REMOVE_LINK_HREF_PARTS.some((part) => lower.includes(part.toLowerCase()));
}

function mergeRel(existingRel, additions) {
  const parts = new Set(
    String(existingRel || "")
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
  );

  for (const item of additions) parts.add(item);
  return Array.from(parts).join(" ");
}

class RemoveElementHandler {
  element(element) {
    element.remove();
  }
}

class HtmlLangHandler {
  constructor(lang) {
    this.lang = lang;
  }

  element(element) {
    element.setAttribute("lang", HTML_LANG[this.lang] || "en-GB");
  }
}

class HeadSeoHandler {
  constructor({ pathname, lang, robots, url }) {
    this.pathname = pathname;
    this.lang = lang;
    this.robots = robots;
    this.url = url;
  }

  element(element) {
    const normalizedPath = normalizePathname(this.pathname);
    const shouldAddHreflang = INDEXABLE_PAGES.has(normalizedPath) && !this.robots.startsWith("noindex");

    const seoBlock = `
    <link rel="canonical" href="${buildCanonical(this.pathname, this.lang, this.url)}">
    ${shouldAddHreflang ? buildHreflang(this.pathname) : ""}
    <meta name="robots" content="${this.robots}">
`;

    element.append(seoBlock, { html: true });
  }
}

class OgUrlHandler {
  constructor({ pathname, lang, url }) {
    this.pathname = pathname;
    this.lang = lang;
    this.url = url;
  }

  element(element) {
    element.setAttribute("content", buildCanonical(this.pathname, this.lang, this.url));
  }
}

class ExternalLinkPolicyHandler {
  element(element) {
    const href = element.getAttribute("href") || "";

    if (shouldRemoveHref(href)) {
      element.remove();
      return;
    }

    if (/^https?:\/\//i.test(href)) {
      if (isTrustedExternalUrl(href)) {
        element.setAttribute("rel", mergeRel(element.getAttribute("rel"), ["noopener", "noreferrer"]));
      } else {
        element.setAttribute("rel", mergeRel(element.getAttribute("rel"), ["nofollow", "noopener", "noreferrer"]));
      }

      if (!element.getAttribute("target")) {
        element.setAttribute("target", "_blank");
      }
    }
  }
}

async function fetchAsset(request, env, pathname) {
  const originalUrl = new URL(request.url);

  // Important: fetch the clean URL first.
  // Cloudflare Pages can often resolve /upload to /upload.html by itself.
  // If we fetch /upload.html first, existing _redirects rules such as
  // /upload.html -> /upload may return a 301 and create a browser loop.
  let response = await env.ASSETS.fetch(request);

  if (response.status !== 404) {
    return response;
  }

  // Fallback only when the clean URL is not found.
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPathForCleanUrl(pathname);

  if (assetUrl.pathname === originalUrl.pathname) {
    return response;
  }

  const fallbackResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));

  // Never pass an internal redirect back to the browser if the fallback target
  // points to the same clean URL. That is the usual cause of ERR_TOO_MANY_REDIRECTS.
  if (fallbackResponse.status >= 300 && fallbackResponse.status < 400) {
    const location = fallbackResponse.headers.get("Location") || "";
    try {
      const redirectTarget = new URL(location, originalUrl);
      if (normalizePathname(redirectTarget.pathname) === normalizePathname(originalUrl.pathname)) {
        return response;
      }
    } catch (_) {
      return response;
    }
  }

  return fallbackResponse;
}

function withRobotsHeader(response, robots) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", robots);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Let static assets pass through exactly as they are.
    if (isStaticAsset(pathname)) {
      return env.ASSETS.fetch(request);
    }

    // Force .html URLs to clean extensionless URLs.
    if (pathname === "/index.html" || pathname.endsWith(".html")) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = normalizePathname(pathname);
      return Response.redirect(redirectUrl.toString(), 301);
    }

    // Keep existing blog Worker / SSR / API flow safe.
    // If /blog is handled by a separate Worker route, that route should take precedence.
    // If Pages receives /blog anyway, this passes it to static assets unchanged.
    if (isPassthroughPath(pathname)) {
      const robots = shouldNoindex(url)
        ? "noindex, follow, max-image-preview:large"
        : "index, follow, max-image-preview:large";
      const response = await env.ASSETS.fetch(request);
      return withRobotsHeader(response, robots);
    }

    // Normalize language parameter.
    const rawLang = url.searchParams.get("lang");
    const lang = normalizeLang(rawLang);

    if (rawLang && rawLang !== lang) {
      const redirectUrl = new URL(request.url);
      redirectUrl.searchParams.set("lang", lang);
      return Response.redirect(redirectUrl.toString(), 301);
    }

    const robots = shouldNoindex(url)
      ? "noindex, follow, max-image-preview:large"
      : "index, follow, max-image-preview:large";

    const assetResponse = await fetchAsset(request, env, pathname);
    const contentType = assetResponse.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("text/html")) {
      return withRobotsHeader(assetResponse, robots);
    }

    const transformed = new HTMLRewriter()
      // Remove old SEO directives that conflict with the unified gateway.
      .on('meta[name="keywords"]', new RemoveElementHandler())
      .on('meta[name="robots"]', new RemoveElementHandler())
      .on('link[rel="canonical"]', new RemoveElementHandler())
      .on('link[rel="alternate"][hreflang]', new RemoveElementHandler())

      // Remove public admin/editor/GitHub links and add nofollow policy for external links.
      .on("a[href]", new ExternalLinkPolicyHandler())

      // Normalize html lang, canonical, hreflang and robots.
      .on("html", new HtmlLangHandler(lang))
      .on('meta[property="og:url"]', new OgUrlHandler({ pathname, lang, url }))
      .on("head", new HeadSeoHandler({ pathname, lang, robots, url }))
      .transform(assetResponse);

    return withRobotsHeader(transformed, robots);
  },
};
