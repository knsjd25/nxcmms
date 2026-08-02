import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { Worker } from "node:worker_threads";
import vm from "node:vm";
import worker from "../_worker.js";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const titleHtmlFiles = readdirSync(root).filter((name) => name.endsWith(".html") && name !== "image_admin.html");
const htmlFiles = [
  "index.html",
  "upload.html",
  "image-api.html",
  "free-image-hosting.html",
  "temporary-image-upload.html",
  "share-image-link.html",
  "json.html",
  "diff.html",
  "token.html",
  "qr.html",
  "password.html",
  "color-picker.html",
  "about.html",
  "contact.html",
  "privacy.html",
];

const approvedPaths = [
  "/", "/upload", "/image-api",
  "/free-image-hosting", "/temporary-image-upload", "/share-image-link",
  "/json", "/diff", "/token", "/qr", "/password", "/color-picker",
  "/about", "/contact", "/privacy",
];

const toolPages = htmlFiles.filter((name) => !["index.html", "about.html", "contact.html", "privacy.html"].includes(name));
const bespokeGuidancePages = {
  "json.html": ["articleTitle", "privacyTitle", "useTitle"],
  "qr.html": ["articleTitle", "tipsTitle", "relatedTitle"],
  "token.html": ["articleTitle", "privacyTitle", "useTitle"],
};
const retiredSourceFiles = [
  "tax.html", "vat.html", "mortgage.html", "ir35.html", "stamp-duty.html", "dividend.html",
  "working-days.html", "fuel.html", "weight.html", "image.html", "pdf2img.html", "map.html",
];

const routeForFile = (file) => file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const inlineCss = (html) => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  .map((match) => match[1])
  .join("\n");
const firstElementById = (html, id) => html.match(new RegExp(`<[^>]+id=["']${escapeRe(id)}["'][^>]*>`, "i"))?.[0] || "";
const elementTextById = (html, id) => html.match(new RegExp(`<[^>]+id=["']${escapeRe(id)}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"))?.[1].replace(/<[^>]+>/g, "").trim() || "";

function translationTitleValues(html) {
  const values = [];
  const pattern = /(?:^|[,{]\s*)(["']?(?:title|seoTitle|metaTitle|ogTitle|twitterTitle|schemaAppName)["']?)\s*:\s*(["'])(.*?)\2/gs;
  let match;
  while ((match = pattern.exec(html))) values.push({ key: match[1].replace(/["']/g, ""), value: match[3] });
  return values;
}

function runSharedI18n({ search = "", savedLanguage = null, browserLanguages = ["en-GB"] } = {}) {
  const replacedUrls = [];
  const location = {
    href: `https://mini-tools.uk/json${search}`,
    origin: "https://mini-tools.uk",
    pathname: "/json",
    search,
    hash: "",
  };
  const noopNode = {
    classList: { contains: () => false, toggle() {} },
    dataset: {},
    addEventListener() {},
    appendChild() {},
    getAttribute: () => null,
    remove() {},
    setAttribute() {},
  };
  const document = {
    readyState: "complete",
    documentElement: { lang: "en-GB" },
    head: { appendChild() {} },
    addEventListener() {},
    createElement: () => ({ ...noopNode }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const window = {
    MiniToolsI18n: null,
    PAGE_TRANSLATIONS: null,
    addEventListener() {},
    dispatchEvent() {},
    scrollTo() {},
    scrollX: 0,
    scrollY: 0,
  };
  const context = {
    CustomEvent: class CustomEvent {},
    URL,
    URLSearchParams,
    document,
    history: {
      replaceState(_state, _title, url) {
        replacedUrls.push(url);
      },
    },
    localStorage: {
      getItem: (key) => key === "miniToolsLang" ? savedLanguage : null,
      setItem() {},
    },
    location,
    navigator: { language: browserLanguages[0], languages: browserLanguages },
    requestAnimationFrame: (callback) => callback(),
    window,
  };
  vm.runInNewContext(read("site-i18n.js"), context);
  return { lang: window.MiniToolsI18n.getLanguage(), replacedUrls };
}

function section(html, tag, className) {
  const pattern = new RegExp(`<${tag}\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
  return (html.match(pattern)?.[0] ?? "").replace(/\r\n/g, "\n");
}

function hrefs(html) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function metaContent(html, attribute, value) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((candidate) => new RegExp(`\\b${escapeRe(attribute)}=["']${escapeRe(value)}["']`, "i").test(candidate));
  return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1].trim() || "";
}

function jsonLdDocuments(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

test("all public page titles stay concise in static HTML and translations", () => {
  for (const file of titleHtmlFiles) {
    const html = read(file);
    const staticTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() || "";
    assert.notEqual(staticTitle, "", `${file}: static title must not be empty`);
    assert.ok(staticTitle.length <= 70, `${file}: static title is ${staticTitle.length} characters: ${staticTitle}`);
    assert.doesNotMatch(staticTitle, /\|\s*Mini-Tools\.uk$/i, `${file}: static title should use descriptive words instead of a brand suffix`);

    const titleValues = translationTitleValues(html);
    assert.ok(titleValues.length > 0, `${file}: PAGE_TRANSLATIONS title values must be present`);
    for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
      assert.match(html, new RegExp(`["']?${escapeRe(lang)}["']?\\s*:`), `${file}: PAGE_TRANSLATIONS misses ${lang}`);
    }
    for (const { key, value } of titleValues) {
      assert.notEqual(value.trim(), "", `${file}: ${key} must not be empty`);
      assert.ok(value.length <= 70, `${file}: ${key} is ${value.length} characters: ${value}`);
      assert.doesNotMatch(value, /\|\s*Mini-Tools\.uk$/i, `${file}: ${key} should use descriptive words instead of a brand suffix`);
    }
  }

  for (const file of ["upload.html", "qr.html", "password.html", "color-picker.html"]) {
    const html = read(file);
    const staticTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() || "";
    assert.ok(staticTitle.length <= 70, `${file}: focused title is ${staticTitle.length} characters`);
  }
});

test("public source does not create Cloudflare email-protection crawl targets", () => {
  const sourceFiles = [...titleHtmlFiles, "site-version.js", "site-i18n.js", "_worker.js", "scripts/standardize-pages.ps1", "sitemap.xml", "robots.txt"];
  for (const file of sourceFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /cdn-cgi\/l\/email-protection/i, `${file}: must not link Cloudflare email protection`);
  }

  for (const file of titleHtmlFiles) {
    const html = read(file);
    for (const link of html.matchAll(/<a\b[^>]*href=["']mailto:yuyananuu@gmail\.com["'][^>]*>/gi)) {
      assert.match(link[0], /data-cfemail=["']false["']/i, `${file}: email link must opt out of Cloudflare obfuscation`);
    }
  }

  assert.match(read("scripts/standardize-pages.ps1"), /data-cfemail=["']false["']/, "standardizer footer email opt-out");
  assert.match(read("robots.txt"), /^Disallow:\s*\/cdn-cgi\/$/mi, "robots.txt disallows Cloudflare system email-protection URLs");
  assert.doesNotMatch(read("sitemap.xml"), /cdn-cgi|email-protection/i, "sitemap must not include Cloudflare system URLs");
});

test("public AdSense loaders use the working adsbygoogle script URL", () => {
  for (const file of titleHtmlFiles) {
    const html = read(file);
    assert.doesNotMatch(html, /pagead2\.googlesyndication\.com\/pagead\/js\?client=/i, `${file}: broken AdSense loader URL`);
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']*pagead2\.googlesyndication\.com[^"']*)["'][^>]*>/gi)) {
      assert.match(match[1], /^https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-1197299128201700$/i, `${file}: AdSense loader URL`);
    }
  }
});

test("standardizer excludes the 404 page from indexable page rewrites", () => {
  const standardizer = read("scripts/standardize-pages.ps1");
  const html404 = read("404.html");
  assert.match(standardizer, /\$excluded\s*=\s*@\([\s\S]*["']404\.html["'][\s\S]*\)/, "standardizer excludes 404.html");
  assert.match(html404, /<meta\s+name=["']robots["']\s+content=["']noindex,follow["']/i, "404 remains noindex,follow");
  assert.doesNotMatch(html404, /<meta\s+name=["']robots["']\s+content=["']index,follow,max-image-preview:large["']/i, "404 must not be indexable");
});

test("worker retires finance calculators in every language", async () => {
  for (const path of ["/vat?lang=zh-CN", "/stamp-duty?lang=de", "/ir35?lang=fr", "/dividend?lang=es"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 410, path);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i, path);
  }
});

async function fetchThroughWorker(path) {
  const env = {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const file = pathname === "/" ? "index.html" : pathname.slice(1);
        const assetName = file.endsWith(".html") || file.endsWith(".xml") || file.endsWith(".txt") || file.endsWith(".css")
          ? file
          : `${file}.html`;
        try {
          const body = read(assetName);
          const contentType = assetName.endsWith(".html")
            ? "text/html; charset=utf-8"
            : assetName.endsWith(".xml")
              ? "application/xml; charset=utf-8"
              : "text/plain; charset=utf-8";
          return new Response(body, {
            status: 200,
            headers: {
              "content-type": contentType,
              "cache-control": "public, max-age=691200, must-revalidate",
              "age": "539977",
            },
          });
        } catch {
          return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
      },
    },
  };
  return worker.fetch(new Request(`https://mini-tools.uk${path}`), env);
}

async function fetchThroughIsolatedWorker(path, timeoutMs = 2000) {
  const workerUrl = new URL("../_worker.js", import.meta.url).href;
  const rootUrl = root.href;
  const source = `
    import { parentPort, workerData } from "node:worker_threads";
    import { readFileSync } from "node:fs";
    const worker = (await import(workerData.workerUrl)).default;
    const root = new URL(workerData.rootUrl);
    const env = { ASSETS: { async fetch(request) {
      const url = new URL(request.url);
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const assetName = /\\.(?:html|xml|txt|css)$/.test(file) ? file : file + ".html";
      try {
        const body = readFileSync(new URL(assetName, root), "utf8");
        const contentType = assetName.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
        return new Response(body, { status: 200, headers: { "content-type": contentType } });
      } catch {
        return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    } } };
    const response = await worker.fetch(new Request("https://mini-tools.uk" + workerData.path), env);
    parentPort.postMessage({ status: response.status, body: await response.text() });
  `;
  const isolated = new Worker(source, { eval: true, type: "module", workerData: { workerUrl, rootUrl, path } });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${path}: Worker render exceeded ${timeoutMs} ms`)), timeoutMs);
      isolated.once("message", (message) => { clearTimeout(timer); resolve(message); });
      isolated.once("error", (error) => { clearTimeout(timer); reject(error); });
    });
  } finally {
    await isolated.terminate();
  }
}

test("all public pages use the unified navigation and footer", () => {
  const navDestinations = ["/", "/#search", "/#popular", "/#uk-apps", "/#developer-tools", "/#other-tools"];
  const footerOnlyDestinations = ["/about", "/contact", "/privacy"];
  const homepageNav = section(read("index.html"), "nav", "site-nav");
  const homepageFooter = section(read("index.html"), "footer", "footer");

  for (const file of htmlFiles) {
    const html = read(file);
    const nav = section(html, "nav", "site-nav");
    const footer = section(html, "footer", "footer");
    const navigationStylesheets = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => match[1])
      .filter((href) => /(?:site-nav|ui-refresh)\.css/i.test(href));
    const navClassTokens = [...nav.matchAll(/class=["']([^"']*)["']/gi)]
      .flatMap((match) => match[1].split(/\s+/).filter(Boolean));

    for (const href of navDestinations) {
      assert.match(nav, new RegExp(`href=["']${escapeRe(href)}["']`), `${file}: nav misses ${href}`);
    }
    for (const href of footerOnlyDestinations) {
      assert.doesNotMatch(nav, new RegExp(`href=["']${escapeRe(href)}["']`), `${file}: nav must leave ${href} in the footer only`);
      assert.match(footer, new RegExp(`href=["']${escapeRe(href)}["']`), `${file}: footer misses ${href}`);
    }

    for (const requiredClass of ["site-nav", "site-nav-inner", "site-brand", "site-nav-links", "site-nav-link", "site-lang-group", "site-lang-trigger", "site-lang-dropdown"]) {
      assert.equal(navClassTokens.includes(requiredClass), true, `${file}: nav misses ${requiredClass}`);
    }
    for (const legacyClass of ["nav", "nav-inner", "brand", "nav-links", "nav-link", "lang-group", "lang-trigger", "lang-dropdown"]) {
      assert.equal(navClassTokens.includes(legacyClass), false, `${file}: shared nav must not use legacy class ${legacyClass}`);
    }
    assert.match(nav, /data-site-nav=["']other["'][^>]*>[^<]*<\/a>\s*<\/div>\s*<div class=["']site-lang-group["']>/, `${file}: language selector must follow the final top-navigation link`);
    assert.equal(nav, homepageNav, `${file}: navigation markup must match homepage`);

    assert.match(footer, /Copyright 2026 Mini-Tools\.uk/, `${file}: footer copyright`);
    assert.match(footer, /data-site-version/, `${file}: footer version label`);
    assert.match(footer, /mailto:yuyananuu@gmail\.com/, `${file}: footer email`);
    assert.equal(footer, homepageFooter, `${file}: footer markup must match homepage`);
    assert.match(html, /<style id=["']site-footer-style["']>/, `${file}: inline shared footer style`);
    assert.deepEqual(navigationStylesheets, ["site-nav.css"], `${file}: exactly one shared navigation stylesheet`);
    assert.equal((html.match(/<script\b[^>]*src=["']site-version\.js["'][^>]*><\/script>/gi) || []).length, 1, `${file}: exactly one site version runtime`);
    assert.equal((html.match(/<script\b[^>]*src=["']site-i18n\.js["'][^>]*><\/script>/gi) || []).length, 1, `${file}: exactly one shared i18n runtime`);
    assert.doesNotMatch(html, /<script\b[^>]*id=["']site-nav-language["']/i, `${file}: copied language runtime must be removed`);
    assert.doesNotMatch(html, /ui-refresh\.css/i, `${file}: retired UI stylesheet must not compete with navigation`);
    assert.doesNotMatch(nav + footer, /Blog|All Tools|Categories|UK Finance|Image & PDF|Security|Acceptable Use|Terms/i, file);
  }

  const standardizerNav = read("scripts/standardize-pages.ps1").match(/\$nav\s*=\s*@'[\s\S]*?'@/)?.[0] || "";
  for (const href of footerOnlyDestinations) {
    assert.doesNotMatch(standardizerNav, new RegExp(`href=["']${escapeRe(href)}["']`), `standardizer nav must not restore ${href}`);
  }
});

test("public pages do not retain unused legacy navigation CSS", () => {
  const legacyClasses = [
    "site-header", "site-header-inner", "nav", "nav-inner", "nav-row", "nav-item",
    "brand", "brand-copy", "brand-title", "brand-subtitle", "brand-name", "brand-text",
    "nav-links", "nav-link", "nav-button", "nav-trigger", "nav-group", "dropdown",
    "dropdown-menu", "dropdown-item", "lang-group", "lang-trigger", "lang-menu",
    "lang-dropdown", "menu", "menu-wrap", "menu-trigger",
  ];

  for (const file of htmlFiles) {
    const css = inlineCss(read(file));
    for (const className of legacyClasses) {
      assert.doesNotMatch(
        css,
        new RegExp(`\\.${escapeRe(className)}(?![A-Za-z0-9_-])`),
        `${file}: unused legacy navigation selector .${className}`,
      );
    }
  }
});

test("colour picker uses local CSS instead of the Tailwind runtime CDN", () => {
  const html = read("color-picker.html");
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com/i);
});

test("homepage has one complete Twitter card metadata set", () => {
  const html = read("index.html");
  const expected = {
    card: "summary_large_image",
    title: "Image Hosting, Image Upload &amp; Direct Links | Mini Tools",
    description: "Upload an image without an account and receive a direct URL, Markdown, HTML or BBCode link.",
    image: "https://mini-tools.uk/assets/image-hosting-hero.png",
    "image:alt": "Mini Tools image hosting and direct link workflow",
  };

  for (const [name, content] of Object.entries(expected)) {
    const matches = [...html.matchAll(new RegExp(`<meta\\b[^>]*name=["']twitter:${name}["'][^>]*>`, "gi"))];
    assert.equal(matches.length, 1, `index.html: twitter:${name} must appear exactly once`);
    assert.match(matches[0][0], new RegExp(`content=["']${escapeRe(content)}["']`, "i"), `index.html: twitter:${name}`);
  }

  assert.match(read("site-i18n.js"), /meta\[name=["']twitter:title["']\]/, "shared runtime updates translated Twitter titles");
  assert.match(read("site-i18n.js"), /meta\[name=["']twitter:description["']\]/, "shared runtime updates translated Twitter descriptions");
});

test("shared navigation gives long translated labels enough responsive space", () => {
  const css = read("site-nav.css");
  assert.match(css, /--site-shell-width: 1280px;/, "shared navigation uses the wider desktop shell");
  assert.match(css, /\.site-nav,\s*\.site-nav \* \{[^}]*box-sizing: border-box !important;/, "shared navigation owns its box model");
  assert.match(css, /\.site-nav \{[^}]*background: rgba\(255, 255, 255, \.88\) !important;[^}]*backdrop-filter: blur\(16px\) !important;/, "shared navigation keeps the homepage glass style");
  assert.match(css, /\.site-nav \.site-nav-inner \{[\s\S]*?display: flex !important;/, "desktop nav uses isolated flexible layout");
  assert.match(css, /\.site-nav \.site-nav-inner \{[^}]*gap: 18px !important;/, "shared navigation keeps the homepage spacing");
  assert.doesNotMatch(css, /grid-template-columns: 1fr auto 1fr !important;/, "nav must not use collision-prone three-column grid");
  assert.match(css, /\.site-nav \.site-nav-links \{[^}]*gap: 5px !important;[^}]*flex-wrap: nowrap !important;/, "shortened desktop navigation stays on one row");
  assert.match(css, /@media \(max-width: 1200px\)[\s\S]*?\.site-nav \.site-brand-subtitle[\s\S]*?display: none !important;/, "medium desktop widths use the compact single-row navigation");
  assert.doesNotMatch(css, /body\s*>\s*main/, "navigation stylesheet must not change page layout");
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*?\.site-nav \.site-nav-inner[\s\S]*?flex-direction: column !important;/, "long labels wrap before collision");
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*?\.site-nav \.site-nav-links[\s\S]*?flex-wrap: wrap !important;/, "translated nav buttons wrap safely");
  assert.match(css, /\.site-nav \.site-nav-link,\s*\.site-nav \.site-lang-trigger \{[^}]*appearance: none !important;[^}]*font-family: [^;]+ !important;/, "language trigger has a complete shared reset");
  assert.match(css, /\.site-nav \.site-nav-link,\s*\.site-nav \.site-lang-trigger \{[^}]*padding: 10px 12px !important;[^}]*border-radius: 13px !important;[^}]*font-size: 13px !important;[^}]*font-weight: 760 !important;/, "navigation buttons match the homepage style");
  assert.match(css, /\.site-nav \.site-lang-dropdown button \{[^}]*font-family: [^;]+ !important;/, "language menu buttons use the shared font");
  assert.match(css, /\.site-nav \.site-lang-dropdown \{[^}]*border-radius: 18px !important;[^}]*padding: 10px !important;[^}]*box-shadow: 0 18px 42px rgba\(15, 23, 42, \.08\) !important;/, "language dropdown matches the homepage panel");
  assert.match(css, /\.site-nav \.site-lang-dropdown button \{[^}]*padding: 10px 12px !important;[^}]*border-radius: 12px !important;[^}]*font-size: 14px !important;[^}]*font-weight: 760 !important;/, "language menu buttons match the homepage style");
});

test("language controls support five languages without arrow-only page patches", () => {
  const runtime = read("site-i18n.js");
  for (const file of htmlFiles) {
    const html = read(file);
    for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
      assert.match(html, new RegExp(`data-site-lang=["']${lang}["']`), `${file}: ${lang}`);
    }
    assert.match(html, /aria-expanded=["']false["']/, file);
    assert.doesNotMatch(html, /location\.assign\(/, `${file}: language switch must not reload or jump to top`);
    assert.doesNotMatch(html, /lang-trigger::after|upload-page-nav-isolation|upload-page-footer-fix|home-nav-footer-layout-fixes/, file);
  }
  assert.match(runtime, /window\.MiniToolsI18n/, "shared runtime API");
  assert.match(runtime, /history\.replaceState\(null, ""/, "language switch should update URL in place");
  assert.match(runtime, /window\.applyLanguage/, "shared runtime should call page i18n when available");
  assert.match(runtime, /data-i18n-placeholder/, "shared placeholder translation");
  assert.match(runtime, /data-i18n-aria-label/, "shared aria-label translation");
  assert.match(runtime, /searchParams\.set\(["']lang["']/, "shared internal-link localization");
  assert.match(runtime, /currentLang\s*===\s*["']en["'][\s\S]*?searchParams\.delete\(["']lang["']\)/, "English internal links must stay clean");
  assert.match(runtime, /lang\s*===\s*["']zh-CN["'][\s\S]*?all\.zh/, "shared runtime must support legacy zh dictionaries");
  assert.match(runtime, /window\.addEventListener\(["']load["'],\s*\(\)\s*=>\s*\{[\s\S]*?applyLanguage\(\);[\s\S]*?\},\s*\{\s*once:\s*true\s*\}\)/, "shared runtime must win page-load language races");
  assert.doesNotMatch(runtime, /location\.assign\(/, "shared runtime must not reload or jump to top");
});

test("shared language runtime updates descriptions and syncs an inferred non-English language into the URL", () => {
  const runtime = read("site-i18n.js");
  assert.match(runtime, /dict\.seoDescription\s*\|\|\s*dict\.metaDesc\s*\|\|\s*dict\.metaDescription\s*\|\|\s*dict\.description/, "description fallback includes page dictionaries");
  assert.match(runtime, /meta\[name=["']description["']\]/, "standard description metadata");
  assert.match(runtime, /meta\[property=["']og:description["']\]/, "Open Graph description metadata");
  assert.match(runtime, /meta\[name=["']twitter:description["']\]/, "Twitter description metadata");
  assert.match(runtime, /!params\.has\(["']lang["']\)[\s\S]*?currentLang\s*!==\s*["']en["'][\s\S]*?history\.replaceState\(/, "inferred non-English language is written into the current URL");

  assert.deepEqual(runSharedI18n({ savedLanguage: "zh-CN" }), {
    lang: "zh-CN",
    replacedUrls: ["/json?lang=zh-CN"],
  });
  assert.deepEqual(runSharedI18n({ search: "?mode=compact", browserLanguages: ["de-DE"] }), {
    lang: "de",
    replacedUrls: ["/json?mode=compact&lang=de"],
  });
  assert.deepEqual(runSharedI18n({ savedLanguage: "en" }), {
    lang: "en",
    replacedUrls: [],
  });
});

test("homepage delegates language control events to the shared runtime", () => {
  const homepage = read("index.html");
  const homepageScript = homepage.match(/<script id=["']homepage-language-and-tools["']>([\s\S]*?)<\/script>/i)?.[1] || "";
  assert.match(homepageScript, /window\.applyLanguage\s*=\s*function/, "homepage exposes its body translation hook");
  assert.doesNotMatch(homepageScript, /\[data-site-lang\][\s\S]*?addEventListener\(["']click["']/, "homepage must not duplicate shared language button listeners");
  assert.doesNotMatch(homepageScript, /langTrigger\.addEventListener\(["']click["']/, "homepage must not duplicate shared menu trigger listeners");
});

test("shared navigation uses the required five-language labels", () => {
  const runtime = read("site-i18n.js");
  for (const expected of [
    'en: { home: "Image Hosting", search: "Upload", popular: "API", ukApps: "Hosting Guides"',
    'ukApps: "图床指南"',
    'ukApps: "Hosting-Hilfe"',
    'ukApps: "Guides"',
    'ukApps: "Guías"',
  ]) {
    assert.match(runtime, new RegExp(escapeRe(expected)), expected);
  }
  for (const [key, href] of Object.entries({
    home: "/", search: "/upload", popular: "/image-api", ukApps: "/#hosting-guides",
    devTools: "/#developer-tools", other: "/contact",
  })) {
    assert.match(runtime, new RegExp(`${key}:\\s*["']${escapeRe(href)}["']`), `${key}: ${href}`);
  }
});

test("homepage exposes every retained public route in initial HTML", () => {
  const homepage = read("index.html");
  for (const path of approvedPaths.filter((path) => path !== "/")) {
    assert.match(homepage, new RegExp(`href=["']${escapeRe(path)}["']`), `index.html: static link ${path}`);
  }
  assert.doesNotMatch(homepage, /id=["']fileInput["']|const\s+WORKER_URL|new\s+FormData\s*\(/, "homepage must not duplicate the protected upload implementation");
  assert.match(homepage, /class=["']upload-launcher["'][^>]*href=["']\/upload["']/, "homepage primary action links to /upload");
});

test("shared language runtime owns the required language priority and persistence", () => {
  const runtime = read("site-i18n.js");
  assert.match(runtime, /const\s+SAVED_LANGUAGE_KEY\s*=\s*["']miniToolsLang["']/, "one shared saved-language key");
  assert.match(runtime, /params\.has\(["']lang["']\)/, "URL language presence is handled explicitly");
  assert.match(runtime, /localStorage\.getItem\(SAVED_LANGUAGE_KEY\)/, "saved language is read");
  assert.match(runtime, /navigator\.languages|navigator\.language/, "browser language is considered");
  assert.match(runtime, /localStorage\.setItem\(SAVED_LANGUAGE_KEY,\s*currentLang\)/, "selected language is persisted");
});

test("shared language runtime keeps page-specific translated guidance in the DOM", () => {
  const runtime = read("site-i18n.js");
  assert.doesNotMatch(runtime, /syncEnglishToolGuidance|toolGuidanceNode|toolGuidanceAnchor/, "shared runtime must not hide page content by language");
  for (const file of toolPages) {
    const html = read(file);
    assert.doesNotMatch(html, /syncEnglishToolGuidance/, `${file}: shared guidance code must not be copied into pages`);
    if (/id=["']tool-guidance["']/.test(html)) {
      assert.match(html, /id=["']guidanceTitle["']/, `${file}: retained guidance must use page-specific translation keys`);
    }
  }
});

test("color picker keeps one static crop-quality FAQ fallback", () => {
  const html = read("color-picker.html");
  assert.equal((html.match(/Does cropping reduce quality\?/g) || []).length, 1);
});

test("public pages have no development leftovers or retired public links", () => {
  const mojibakeMarkers = /(?:Fran莽ais|Espa帽ol|hypoth猫ses|qualifi茅|r茅sultats|脿\s|谩|驴[A-Za-z]|�)/;
  for (const file of htmlFiles) {
    const html = read(file);
    assert.doesNotMatch(html, /Original notes|Original notes for|lorem ipsum|placeholder text|test text/i, file);
    assert.doesNotMatch(html, /\b(?:TODO|FIXME)\b/, file);
    assert.doesNotMatch(html, /(?:婕|漏)\??\s*2026|&copy;\s*2026|©\s*2026|admin@mini-tools\.uk/i, file);
    assert.doesNotMatch(html, mojibakeMarkers, `${file}: mojibake marker in public text`);
    assert.doesNotMatch(html, /UK Apps/i, `${file}: obsolete category label`);
    assert.equal(hrefs(html).some((href) => /^\/(?:blog(?:\/|$)|terms\/?$|acceptable-use\/?$)/i.test(href)), false, file);
  }
  assert.doesNotMatch(read("site-i18n.js"), /UK Apps/i, "shared runtime: obsolete category label");
});

test("privacy policy discloses analytics, advertising, API records and actual external services", () => {
  const html = read("privacy.html");
  for (const phrase of [
    "approximate location", "performance information", "cookies or similar identifiers",
    "previous visits to this site or other websites", "personalised advertising",
    "Google Ads Settings", "other third-party advertising vendors",
    "consent management platform", "advertising and cookie choices",
    "Google Analytics", "Google AdSense", "Cloudflare", "jsDelivr", "cdnjs", "Google Fonts",
    "cryptographic hash", "full API Key", "upload quotas", "usage",
    "paid, unpaid, complimentary or refunded status", "payment processor",
  ]) {
    assert.match(html, new RegExp(escapeRe(phrase), "i"), `privacy disclosure: ${phrase}`);
  }
  for (const key of ["sectionApiTitle", "sectionApiP1", "sectionApiL1", "sectionApiL2", "sectionApiL3", "sectionApiP2"]) {
    assert.match(html, new RegExp(`data-i18n=["']${key}["']`), `privacy API section: ${key}`);
  }
  assert.equal((html.match(/sectionApiTitle:/g) || []).length, 5, "privacy API title must exist in all five languages");
  for (const date of ["July 31, 2026.", "31. Juli 2026.", "31 juillet 2026.", "31 de julio de 2026."]) {
    assert.match(html, new RegExp(escapeRe(date)), `privacy updated date: ${date}`);
  }
  assert.match(html, /2026 \\u5e74 7 \\u6708 31 \\u65e5/, "privacy Chinese updated date");
});

test("tool pages include the required content structure", () => {
  for (const file of toolPages) {
    const html = read(file);
    assert.match(html, /<h1\b/i, `${file}: H1`);
    if (file === "upload.html") {
      for (const id of ["retentionTitle", "faqSectionTitle", "removalTitle"]) {
        assert.match(html, new RegExp(`id=["']${id}["']`), `${file}: ${id}`);
      }
      continue;
    }
    if (/id=["']tool-guidance["']/.test(html)) {
      assert.match(html, /id=["']guidanceTitle["']/, `${file}: tool guidance must be a page-specific translated module`);
    }
    if (bespokeGuidancePages[file]) {
      for (const key of bespokeGuidancePages[file]) {
        assert.match(html, new RegExp(`data-i18n=["']${escapeRe(key)}["']`), `${file}: bespoke content ${key}`);
      }
      assert.ok((html.match(/data-i18n=["']faq\d+Q["']/g) || []).length >= 3, `${file}: at least three page-specific FAQs`);
      assert.match(html, /data-i18n=["']relatedTitle["']|aria-label=["']Related tools["']/i, `${file}: related tools`);
      continue;
    }
    if (file === "diff.html") {
      assert.match(html, /data-i18n="contentTitle"/, `${file}: translated guidance`);
      assert.match(html, /data-i18n="useTitle"/, `${file}: translated use cases`);
      assert.match(html, /data-i18n="relatedTitle"/, `${file}: translated related tools`);
      continue;
    }
    if (file === "color-picker.html") {
      assert.match(html, /data-i18n-html="seoHtml"/, `${file}: translated guidance`);
      assert.match(html, /Frequently asked questions/i, `${file}: FAQ`);
      continue;
    }
    assert.match(html, /How to use/i, `${file}: How to use`);
    assert.match(html, /Use cases/i, `${file}: Use cases`);
    assert.match(html, /Limitations|Privacy note|Sources and assumptions|Official sources/i, `${file}: limitations/privacy/sources`);
    assert.match(html, /Related tools/i, `${file}: related tools`);
    assert.match(html, /FAQ/i, `${file}: FAQ`);
  }
});

test("site version label uses a dated release id", () => {
  const source = read("site-version.js");
  assert.match(source, /MINI_TOOLS_SITE_VERSION\s*=\s*["']2026-08-02-01["']/, "site-version.js release id");
  assert.match(read("index.html"), /data-site-version/, "homepage footer version slot");
});

test("trust pages describe the current image-hosting focus", () => {
  const retiredCopy = /UK tax calculator|tax and VAT|tax calculator page|salary amount|calculator issues?|calculation issue|英国财务|个税|工资金额|Tax- und VAT-Rechner|calculs tax\/VAT|cálculos tax\/VAT/i;

  for (const file of ["about.html", "contact.html", "privacy.html"]) {
    const html = read(file);
    assert.doesNotMatch(html, retiredCopy, `${file}: retired finance positioning`);
    assert.match(html, /image hosting|image-hosting/i, `${file}: image-hosting positioning`);
  }
});

test("shared tooling cannot regenerate the retired generic guidance template", () => {
  for (const file of ["site-i18n.js", "scripts/standardize-pages.ps1"]) {
    const source = read(file);
    assert.doesNotMatch(source, /guidanceTranslations|renderToolGuidanceLanguage|applyToolGuidanceLanguage|syncEnglishToolGuidance/, file);
    assert.doesNotMatch(source, /is designed for one focused task|for quick checks, planning, formatting or preparation work/i, file);
  }
});

test("upload page keeps protected controls and has formal safety content", () => {
  const html = read("upload.html");
  for (const required of [
    "WORKER_URL", "fileInput", "previewImage", "5 MB", "durationSelect",
    "storageCodeInput", "captchaAnswerInput", "FormData", "directUrl",
    "markdownOutput", "htmlOutput", "bbcodeOutput", "resetPreview", "resetLog",
  ]) {
    assert.match(html, new RegExp(escapeRe(required)), `upload: ${required}`);
  }
  for (const phrase of [
    "What not to upload", "How uploaded images are reviewed", "Common image hosting use cases", "Removal and abuse reports", "Privacy note",
    "ID documents", "Passports", "Bank cards", "Financial documents",
    "Confidential work files", "Illegal content", "Malware-related content",
  ]) {
    assert.match(html, new RegExp(escapeRe(phrase), "i"), `upload content: ${phrase}`);
  }
  for (const id of ["retentionTitle", "rulesTitle", "moderationTitle", "removalTitle", "privacyNoteTitle", "examplesTitle", "faqSectionTitle"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `upload: ${id}`);
  }
  assert.match(html, /const readyTexts = t\(\);[\s\S]*?setCaptchaStatus\(readyTexts\.captchaReadyText/, "captcha success uses the current language");
  assert.match(html, /if \(captchaLoading\)[\s\S]*?texts\.captchaLoadingText[\s\S]*?else if \(captchaId\)[\s\S]*?texts\.captchaReadyText[\s\S]*?texts\.captchaRetryText/, "language changes refresh every captcha status");
});

test("password and color picker use the shared five-language contract", () => {
  const password = read("password.html");
  assert.match(password, /const translations\s*=\s*window\.PAGE_TRANSLATIONS\s*=\s*\{/, "password dictionary");
  for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
    assert.match(password, new RegExp(`${escapeRe(JSON.stringify(lang))}\\s*:`), `password: ${lang}`);
  }
  assert.match(password, /<h1\b[^>]*data-i18n=["']heroTitle["']/, "password translated H1");
  assert.match(password, /function applyLanguage\s*\(/, "password page hook");
  assert.match(password, /\.calculator-grid\s*>\s*\.panel\s*\{[^}]*padding:/, "password generator panels need visible inner spacing");
  assert.match(password, /\.check\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/, "password options need aligned checkbox rows");

  const color = read("color-picker.html");
  assert.doesNotMatch(color, /getElementById\(["']lang-select["']\)/, "color picker must not bind a removed selector");
  assert.match(color, /function applyLanguage\s*\(/, "color picker page hook");
  assert.match(color, /data-i18n-html=["']seoHtml["']/, "color picker translated SEO body");
});

test("worker renders retained developer and API pages without stalling", async () => {
  for (const path of ["/token", "/image-api?lang=zh-CN"]) {
    const response = await fetchThroughIsolatedWorker(path);
    assert.equal(response.status, 200, path);
    assert.match(response.body, /<main\b/i, path);
  }
});

test("upload page keeps the API entry without stale embedded API documentation", () => {
  const html = read("upload.html");
  for (const label of ["API Upload", "API-Upload", "Envoi par API", "Subida por API", "API \\u4e0a\\u4f20"]) {
    assert.match(html, new RegExp(escapeRe(label)), `upload API entry: ${label}`);
  }
  for (const stale of ["apiDocsTitle", "apiPriceHeader", "apiQuickStartText", "apiTemp100Quota", "GET /v1/account"]) {
    assert.doesNotMatch(html, new RegExp(escapeRe(stale)), `upload stale API copy: ${stale}`);
  }
});

test("canonical, hreflang, sitemap and robots stay clean", () => {
  for (const file of htmlFiles) {
    const path = routeForFile(file);
    const html = read(file);
    const clean = `https://mini-tools.uk${path}`;
    assert.match(html, new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${escapeRe(clean)}["']`), file);
    assert.match(html, new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']en["']\\s+href=["']${escapeRe(clean)}["']`), `${file}: en`);
    for (const lang of ["zh-CN", "de", "fr", "es"]) {
      assert.match(html, new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']${escapeRe(lang)}["']\\s+href=["']${escapeRe(`${clean}?lang=${lang}`)}["']`), `${file}: ${lang}`);
    }
    assert.match(html, new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']x-default["']\\s+href=["']${escapeRe(clean)}["']`), file);
  }

  const locs = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const lastmods = [...read("sitemap.xml").matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]);
  assert.deepEqual(locs, approvedPaths.map((path) => `https://mini-tools.uk${path}`));
  assert.equal(lastmods.length, locs.length, "every sitemap URL has a lastmod date");
  assert.equal(lastmods.every((value) => /^20\d{2}-\d{2}-\d{2}$/.test(value)), true, "sitemap lastmod format");
  for (const path of approvedPaths) {
    const loc = `https://mini-tools.uk${path}`;
    const entry = read("sitemap.xml").match(new RegExp(`<url><loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc><lastmod>([^<]+)</lastmod></url>`));
    assert.equal(entry?.[1], "2026-08-02", `${path} sitemap lastmod`);
  }
  assert.equal(read("sitemap.xml").includes("?lang="), false);
  assert.doesNotMatch(read("sitemap.xml"), /blog/i);
  const indexableBlock = read("_worker.js").match(/const INDEXABLE_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  const indexablePaths = [...indexableBlock.matchAll(/"(\/[^"]*)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(indexablePaths, [...approvedPaths].sort(), "Worker indexable paths must match sitemap paths");
  assert.equal(read("robots.txt").trim().replace(/\r\n/g, "\n"), "User-agent: *\nAllow: /\nDisallow: /cdn-cgi/\nDisallow: /image_admin\nDisallow: /map\nDisallow: /wp/\nDisallow: /teams/\nDisallow: /user/\nDisallow: /main.php\nDisallow: /menu.php\n\nSitemap: https://mini-tools.uk/sitemap.xml");
});

test("every localized indexable response has unique metadata and valid JSON-LD", async () => {
  for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
    const rendered = await Promise.all(approvedPaths.map(async (path) => {
      const requestPath = lang === "en" ? path : `${path}?lang=${lang}`;
      const response = await fetchThroughWorker(requestPath);
      assert.equal(response.status, 200, requestPath);
      return { path, html: await response.text() };
    }));
    const titles = new Map();
    const descriptions = new Map();

    for (const { path, html } of rendered) {
      const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() || "";
      const description = metaContent(html, "name", "description");
      const robotsTags = [...html.matchAll(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi)];
      assert.notEqual(title, "", `${path}?lang=${lang}: title`);
      assert.notEqual(description, "", `${path}?lang=${lang}: description`);
      assert.equal(robotsTags.length, 1, `${path}?lang=${lang}: exactly one robots meta tag`);
      assert.equal(titles.has(title), false, `${path}?lang=${lang}: duplicate title also used by ${titles.get(title)}`);
      assert.equal(descriptions.has(description), false, `${path}?lang=${lang}: duplicate description also used by ${descriptions.get(description)}`);
      assert.doesNotMatch(html, /Original notes|Copyright symbol|漏\s*2026|©\s*2026/i, `${path}?lang=${lang}: retired public copy`);
      assert.match(html, /Copyright 2026 Mini-Tools\.uk/, `${path}?lang=${lang}: unified footer`);
      titles.set(title, path);
      descriptions.set(description, path);

      const documents = jsonLdDocuments(html);
      assert.ok(documents.length > 0, `${path}?lang=${lang}: JSON-LD`);
      assert.equal(documents.every((document) => document["@context"] === "https://schema.org"), true, `${path}?lang=${lang}: schema.org context`);
    }
  }
});

test("worker renders Chinese body, metadata and schema for key pages", async () => {
  assert.doesNotMatch(read("_worker.js"), /\bnew\s+Function\b|\beval\s*\(/, "Worker SSR must not use blocked dynamic code generation");
  for (const [path, chineseText, englishText] of [
    ["/?lang=zh-CN", "在线图床：上传图片并获取直链", "Image hosting for fast, shareable links"],
    ["/upload?lang=zh-CN", "在线上传图片", "Upload Image Online"],
  ]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<html[^>]+lang="zh-CN"/, path);
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, "").trim() || "";
    assert.equal(h1, chineseText, `${path}: translated H1`);
    assert.notEqual(h1, englishText, `${path}: English H1 must be replaced`);
    assert.match(html, /"@context"/, `${path}: schema`);
    assert.match(html, /<link rel="canonical" href="https:\/\/mini-tools\.uk\/[^"]*\?lang=zh-CN"|<link rel="canonical" href="https:\/\/mini-tools\.uk\/\?lang=zh-CN"/, `${path}: canonical`);
    if (path === "/?lang=zh-CN") {
      assert.match(html, /图床使用指南/, `${path}: hosting guide section`);
      assert.match(html, /JSON 格式化/, `${path}: developer tool translation`);
      assert.match(html, /href="\/upload\?lang=zh-CN"/, `${path}: localized upload link`);
      assert.doesNotMatch(html, /英国个人所得税计算器|VAT 计算器|房贷计算器/, `${path}: retired calculator promotion`);
    }
  }
});

test("worker returns 410 for the retired tax calculator", async () => {
  const response = await fetchThroughWorker("/tax?lang=zh-CN");
  assert.equal(response.status, 410);
  const html = await response.text();
  assert.match(html, /页面未找到/);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i);
  assert.doesNotMatch(html, /rel=["']canonical["']/i);
});

test("worker server-renders the Upload empty file state in Chinese and German", async () => {
  for (const [lang, expected] of [["zh-CN", "未选择文件"], ["de", "Keine Datei ausgewählt"]]) {
    const response = await fetchThroughWorker(`/upload?lang=${lang}`);
    assert.equal(response.status, 200, lang);
    const html = await response.text();
    const fileName = html.match(/<div\b[^>]*id=["']fileName["'][^>]*>([\s\S]*?)<\/div>/i)?.[1].trim() || "";
    assert.equal(fileName, expected, lang);
    assert.notEqual(fileName, "No file chosen", lang);
  }
});

test("upload page links to a separate API documentation page", async () => {
  const upload = read("upload.html");
  assert.match(upload, /id=["']apiUploadEntry["'][^>]*>API Upload<\/a>/);
  assert.match(upload, /href=["']\/image-api["']/);
  assert.doesNotMatch(upload, /id=["']api-docs["']/);
  assert.doesNotMatch(upload, /POST \/v1\/upload/);

  const chinese = await fetchThroughWorker("/upload?lang=zh-CN");
  assert.equal(chinese.status, 200);
  assert.equal(elementTextById(await chinese.text(), "apiUploadEntry"), "API 上传");
});

test("image API documentation is server-rendered in all five languages", async () => {
  const source = read("image-api.html");
  assert.match(source, /id=["']apiEmail["'][^>]*>yuyananuu@gmail\.com</);
  assert.match(source, /data-copy=["']apiEmail["']/);
  assert.match(source, /data-i18n=["']copyEmail["']>Click to copy</);
  assert.doesNotMatch(source, /class=["']apply-button["']/);
  assert.match(source, /data-doc-link/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /GET \/v1\/images/);
  assert.match(source, /DELETE \/v1\/images\/:key/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /<pre id=["']singleExample["']><!--email_off-->[\s\S]*file=@image\.png[\s\S]*<!--\/email_off--><\/pre>/);
  assert.match(source, /<pre id=["']batchExample["']><!--email_off-->[\s\S]*file=@first\.png[\s\S]*file=@second\.webp[\s\S]*<!--\/email_off--><\/pre>/);
  assert.equal((source.match(/<!--email_off-->/g) || []).length, 2, "both cURL examples opt out of Cloudflare email obfuscation");

  const recordsResponse = elementTextById(source, "recordsResponseExample");
  assert.match(recordsResponse, /https:\/\/pub\.mini-tools\.uk\//);
  assert.doesNotMatch(recordsResponse, /expires_at|duration|status|risk/);

  const expectations = {
    en: "Image Upload API documentation",
    "zh-CN": "图片上传 API 使用文档",
    de: "Dokumentation der Bild-Upload-API",
    fr: "Documentation de l’API d’envoi d’images",
    es: "Documentación de la API de subida de imágenes",
  };

  for (const [lang, title] of Object.entries(expectations)) {
    const path = lang === "en" ? "/image-api" : `/image-api?lang=${lang}`;
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 200, lang);
    const html = await response.text();
    assert.match(html, new RegExp(`<h1[^>]*>${title}</h1>`), `${lang}: API docs title`);
    assert.match(html, /POST \/v1\/upload/, `${lang}: upload endpoint`);
    assert.match(html, /GET \/v1\/usage/, `${lang}: usage endpoint`);
    assert.match(html, /GET \/v1\/images/, `${lang}: records endpoint`);
    assert.match(html, /DELETE \/v1\/images\/:key/, `${lang}: delete endpoint`);
    assert.match(html, /Idempotency-Key/, `${lang}: retry protection`);
    assert.match(html, /X-API-User-ID/, `${lang}: assigned user ID`);
    assert.doesNotMatch(html, /¥\s*\d+|price/i, `${lang}: public documentation must not show pricing`);
  }
});

test("worker normalizes invalid languages to the canonical English URL", async () => {
  const response = await fetchThroughWorker("/image-api?lang=xx");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://mini-tools.uk/image-api");
});

test("worker redirects explicit ?lang=en to the canonical English URL", async () => {
  const response = await fetchThroughWorker("/upload?lang=en");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://mini-tools.uk/upload");
});

test("worker redirects legacy WordPress and app paths to the homepage", async () => {
  for (const path of ["/main.php", "/menu.php", "/wp/", "/teams/", "/user/login"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("location"), "https://mini-tools.uk/", path);
  }
});

test("worker renders about in German with a German title", async () => {
  const response = await fetchThroughWorker("/about?lang=de");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html[^>]+lang=["']de["']/);
  assert.match(html, /<title>Über Mini-Tools\.uk \| Bildhosting und Entwicklertools<\/title>/);
  assert.doesNotMatch(html, /Practical Calculators|Praktische Rechner/);
});

test("worker renders upload English with the shared en-GB html language", async () => {
  const response = await fetchThroughWorker("/upload");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<html[^>]+lang=["']en-GB["']/);
});

test("worker renders color picker template-string translations", async () => {
  const response = await fetchThroughWorker("/color-picker?lang=zh-CN");
  assert.equal(response.status, 200);
  const html = await response.text();
  const main = html.slice(html.indexOf('id="seo-container"'), html.indexOf("</main>"));
  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<h1\b[^>]*>图片取色器与图片裁剪工具<\/h1>/);
  assert.match(html, /图片取色器与本地图片裁剪工具/);
  assert.doesNotMatch(html, /<h1\b[^>]*>\s*Image Color Picker from Image\s*<\/h1>/);
  assert.equal((main.match(/裁剪图片会变模糊吗？/g) || []).length, 1, "one rendered crop-quality FAQ");
});

test("worker renders homepage translations for German, French and Spanish", async () => {
  for (const [lang, heading] of [
    ["de", "Bildhosting für schnelle, teilbare Links"],
    ["fr", "Hébergement d’images avec liens partageables"],
    ["es", "Alojamiento de imágenes con enlaces compartibles"],
  ]) {
    const response = await fetchThroughWorker(`/?lang=${lang}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<html[^>]+lang=["']${lang}["']`));
    assert.match(html, new RegExp(`<h1\\b[^>]*>${escapeRe(heading)}<\\/h1>`));
  }
});

test("homepage serves localized search metadata and complete image-hosting schema", async () => {
  for (const [lang, locale, appName, imageAlt, firstQuestion] of [
    ["en", "en_GB", "Mini Tools Image Hosting", "Mini Tools image hosting and direct link workflow", "Do I need an account to upload an image?"],
    ["zh-CN", "zh_CN", "Mini Tools 在线图床", "Mini Tools 在线图床与图片直链使用流程", "上传图片需要注册账户吗？"],
    ["de", "de_DE", "Mini Tools Bildhosting", "Mini Tools Bildhosting und Direktlink-Ablauf", "Brauche ich ein Konto für den Bild-Upload?"],
    ["fr", "fr_FR", "Hébergement d’images Mini Tools", "Parcours d’hébergement et de lien direct Mini Tools", "Faut-il un compte pour téléverser une image ?"],
    ["es", "es_ES", "Alojamiento de imágenes Mini Tools", "Proceso de alojamiento y enlace directo de Mini Tools", "¿Necesito una cuenta para subir una imagen?"],
  ]) {
    const path = lang === "en" ? "/" : `/?lang=${lang}`;
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();

    assert.equal(metaContent(html, "property", "og:locale"), locale, `${path}: Open Graph locale`);
    assert.equal(metaContent(html, "property", "og:image:alt"), imageAlt, `${path}: Open Graph image alt`);
    assert.equal(metaContent(html, "name", "twitter:image:alt"), imageAlt, `${path}: Twitter image alt`);

    const graph = jsonLdDocuments(html).flatMap((document) => document["@graph"] || [document]);
    const organization = graph.find((entry) => entry["@type"] === "Organization");
    const website = graph.find((entry) => entry["@type"] === "WebSite");
    const application = graph.find((entry) => entry["@type"] === "SoftwareApplication");
    const faq = graph.find((entry) => entry["@type"] === "FAQPage");

    assert.equal(organization?.name, "Mini Tools", `${path}: Organization schema`);
    assert.equal(website?.name, appName, `${path}: WebSite schema`);
    assert.equal(application?.name, appName, `${path}: SoftwareApplication schema`);
    assert.equal(application?.isAccessibleForFree, true, `${path}: free application flag`);
    assert.equal(application?.image?.url, "https://mini-tools.uk/assets/image-hosting-hero.png", `${path}: schema image`);
    assert.ok(application?.featureList?.length >= 4, `${path}: schema feature list`);
    assert.equal(faq?.mainEntity?.length, 4, `${path}: FAQ schema`);
    assert.equal(faq?.mainEntity?.[0]?.name, firstQuestion, `${path}: localized FAQ schema`);
  }
});

test("worker serves sitemap and robots as static assets and retires blog", async () => {
  const sitemap = await fetchThroughWorker("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);

  const robots = await fetchThroughWorker("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/mini-tools\.uk\/sitemap\.xml/);

  const blog = await fetchThroughWorker("/blog");
  assert.equal(blog.status, 410);
});

test("worker never inherits long-lived cache headers for rendered HTML", async () => {
  for (const path of ["/", "/?lang=zh-CN", "/tax?lang=de", "/blog", "/unknown-page"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0", path);
    assert.equal(response.headers.get("cloudflare-cdn-cache-control"), "no-store", path);
    assert.equal(response.headers.get("pragma"), "no-cache", path);
    assert.equal(response.headers.get("expires"), "0", path);
    assert.equal(response.headers.get("age"), null, `${path}: inherited Age must be removed`);
  }
});

test("404 page uses the shared shell without indexable SEO or ads", () => {
  const html = read("404.html");
  assert.match(html, /<title>Page Not Found - Mini-Tools\.uk<\/title>/);
  assert.match(html, /<meta\s+name=["']robots["']\s+content=["']noindex,follow["']/i);
  assert.doesNotMatch(html, /rel=["']canonical["']/i);
  assert.doesNotMatch(html, /hreflang=/i);
  assert.doesNotMatch(html, /adsbygoogle|googlesyndication/i);
  assert.match(html, /<style\s+id=["']site-shell-fallback["']>/i, "404 needs an inline shell fallback for error-route previews");
  assert.match(html, /\.site-nav\s+\.site-nav-inner\s*\{[^}]*display\s*:\s*flex/i, "404 fallback must keep the desktop navigation aligned");
  assert.match(html, /\.site-nav\s+\.site-nav-links\s*\{[^}]*display\s*:\s*flex/i, "404 fallback must keep navigation links aligned");
  assert.match(html, /@media\s*\(max-width\s*:\s*1080px\)/i, "404 fallback must include the shared responsive breakpoint");
  assert.equal(section(html, "nav", "site-nav"), section(read("index.html"), "nav", "site-nav"));
  assert.equal(section(html, "footer", "footer"), section(read("index.html"), "footer", "footer"));
  assert.match(html, /data-i18n=["']heroTitle["'][^>]*>Page not found</i);
  assert.match(html, /href=["']\/["'][^>]*data-i18n=["']homeButton["']/i);
  assert.match(html, /href=["']\/upload["'][^>]*data-i18n=["']searchButton["']/i);
  for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
    assert.match(html, new RegExp(`["']${escapeRe(lang)}["']\\s*:`), `404 dictionary: ${lang}`);
  }
  assert.equal(read("sitemap.xml").includes("/404"), false, "404 must not be in sitemap");
});

test("worker returns the unified HTML 404 for prompt and unknown pages", async () => {
  for (const path of [
    "/prompt",
    "/prompt.html",
    "/prompt/",
    "/prompt?lang=zh-CN",
    "/prompt?lang=de",
    "/prompt.html?lang=fr",
    "/this-page-does-not-exist",
    "/random-test-page",
  ]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("content-type") || "", /^text\/html\b/i, path);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i, path);
    const html = await response.text();
    assert.match(html, /class=["']site-nav["']/, path);
    assert.match(html, /<meta\s+name=["']robots["']\s+content=["']noindex,\s*follow/i, path);
    assert.doesNotMatch(html, /rel=["']canonical["']/i, path);
    assert.doesNotMatch(html, /hreflang=/i, path);
  }

  const chinese = await fetchThroughWorker("/prompt?lang=zh-CN");
  assert.match(await chinese.text(), /页面未找到/);
});

test("worker keeps the custom 404 body when the asset service returns it with status 404", async () => {
  const env = {
    ASSETS: {
      async fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/404.html") {
          return new Response(read("404.html"), {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        return new Response("Not found", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
    },
  };

  const response = await worker.fetch(new Request("https://mini-tools.uk/blog"), env);
  assert.equal(response.status, 410);
  assert.match(response.headers.get("content-type") || "", /text\/html/i);
  assert.match(await response.text(), /Page not found/i);
});

test("worker generates the unified HTML fallback when the 404 asset is unavailable", async () => {
  const env = {
    ASSETS: {
      async fetch() {
        return new Response("Not found", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
    },
  };

  const response = await worker.fetch(new Request("https://mini-tools.uk/blog?lang=zh-CN"), env);
  assert.equal(response.status, 410);
  assert.match(response.headers.get("content-type") || "", /text\/html/i);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i);
  const html = await response.text();
  assert.match(html, /<html[^>]+lang=["']zh-CN["']/i);
  assert.match(html, /页面未找到/);
  assert.match(html, /class=["']site-nav["']/);
  assert.match(html, /href=["']\/\?lang=zh-CN["']/);
  assert.match(html, /href=["']\/upload\?lang=zh-CN["']/);
  assert.match(html, /class=["']footer["']/);
});

test("worker preserves 410, 301 and direct 200 routes around 404 handling", async () => {
  for (const path of ["/blog", "/blog/", "/blog/old-post"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 410, path);
    assert.match(response.headers.get("content-type") || "", /text\/html/i, path);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i, path);
    assert.match(await response.text(), /Page not found/i, path);
  }

  for (const [path, target] of [
    ["/about.html", "https://mini-tools.uk/about"],
    ["/terms", "https://mini-tools.uk/privacy"],
  ]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("location"), target, path);
  }

  for (const path of ["/", "/upload", "/image-api", "/token", "/about", "/privacy", "/404.html"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 200, path);
  }

  for (const path of ["/tax.html", "/image-compressor", "/pdf-to-image"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 410, path);
  }
});

test("legacy image and PDF routes are retired", async () => {
  for (const legacy of ["/image-compressor", "/pdf-to-image", "/image", "/pdf2img"]) {
    const response = await fetchThroughWorker(legacy);
    assert.equal(response.status, 410, legacy);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i, legacy);
  }
});

test("new image landing page aliases redirect to clean canonical URLs", async () => {
  for (const path of ["/free-image-hosting", "/temporary-image-upload", "/share-image-link"]) {
    for (const alias of [`${path}.html`, `${path}/`]) {
      const response = await fetchThroughWorker(alias);
      assert.equal(response.status, 301, alias);
      assert.equal(response.headers.get("location"), `https://mini-tools.uk${path}`, alias);
    }
  }
});

test("all retired page routes use the unified error page while preserving 410", async () => {
  for (const path of [
    "/game", "/game/", "/json2", "/unit.html?lang=de", "/word",
    "/tax", "/vat", "/mortgage", "/ir35", "/stamp-duty", "/dividend",
    "/working-days", "/fuel", "/weight", "/image", "/image-compressor", "/pdf2img", "/pdf-to-image", "/map",
  ]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 410, path);
    assert.match(response.headers.get("content-type") || "", /text\/html/i, path);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i, path);
    const html = await response.text();
    assert.match(html, /class=["']site-nav["']/, path);
    assert.match(html, /Page not found|Seite nicht gefunden/i, path);
  }
});

test("homepage keeps one image-hosting action and no retired tool promotion", () => {
  const homepage = read("index.html");
  const about = read("about.html");
  const diff = read("diff.html");
  const colorPicker = read("color-picker.html");
  const homepageMarkup = homepage.slice(0, homepage.indexOf('<script id="homepage-language-and-tools">'));

  assert.doesNotMatch(homepageMarkup, /homepage now gives priority|These tools are not removed|simply moved below/i);
  assert.match(homepage, /class=["']upload-launcher["'][^>]*href=["']\/upload["']/);
  assert.match(homepage, /href=["']\/image-api["'][^>]*data-i18n=["']apiCta["']/);
  assert.match(homepage, /class=["']upload-launcher-action["'][^>]*data-i18n=["']uploadCta["']/);
  assert.match(homepage, /Image hosting for fast, shareable links/);
  assert.match(homepage, /id=["']developer-tools["']/);
  assert.doesNotMatch(homepage, /href=["']\/(?:tax|vat|mortgage|ir35|stamp-duty|dividend|image|pdf2img)["']/);
  assert.doesNotMatch(about, /being improved page by page|逐页改进|Schritt für Schritt verbessert|amélioré page par page|mejora página por página/i);
  assert.equal((diff.match(/id=["']tool-guidance["']/g) || []).length, 0, "diff duplicate guidance");
  assert.equal((colorPicker.match(/id=["']tool-guidance["']/g) || []).length, 0, "color picker duplicate guidance");
});

test("retired feature files are deleted and protected upload guidance stays intact", () => {
  const rootFiles = new Set(readdirSync(root));
  for (const file of retiredSourceFiles) {
    assert.equal(rootFiles.has(file), false, `${file} must be deleted`);
  }

  const checks = [
    ["contact.html", /id=["']removal-request-details["']/i],
    ["privacy.html", /id=["']upload-policy-summary["']/i],
    ["about.html", /id=["']directory-overview["']/i],
  ];
  for (const [file, pattern] of checks) {
    assert.doesNotMatch(read(file), pattern, file);
  }

  const upload = read("upload.html");
  assert.doesNotMatch(upload, /How to use this image hosting tool safely/i);
  assert.doesNotMatch(upload, /uploadGuidanceTranslations|applyUploadGuidanceLanguage/);

  const standardizer = read("scripts/standardize-pages.ps1");
  for (const retired of [
    "removal-request-details",
    "site-nav-language",
    "tool-guidance",
    "upload-policy-summary",
    "directory-overview",
    "uploadGuidanceTranslations",
    "rates-and-thresholds-for-employers-2026-to-2027",
  ]) {
    assert.doesNotMatch(standardizer, new RegExp(escapeRe(retired), "i"), `standardizer: ${retired}`);
  }
  assert.doesNotMatch(standardizer, /\\bSecurity\\b/, "standardizer must not globally replace Security");
});

test("upload German copy uses natural capitalization without duplicated documentation wording", () => {
  const html = read("upload.html");
  const german = html.match(/\n\s*de:\s*\{[\s\S]*?\n\s*\},\n\s*fr:\s*\{/i)?.[0] || "";
  assert.match(german, /formatHtmlText:\s*["'][^"']*Websites[^"']*Website-Editoren/);
  assert.match(german, /retentionThirtyText:\s*["'][^"']*Website-Entwürfe/);
  assert.match(german, /schemaFaq3Text:\s*["'][^"']*Dokumentationen oder Forenbeiträge/);
  assert.match(german, /faq7Text:\s*["'][^"']*Dokumentationen oder Forenbeiträge/);
  assert.doesNotMatch(german, /Dokumentation, Dokumentation|\bwebsites\b|\bwebsite-(?:Editoren|Entwürfe)\b/);
});

test("worker server-renders the shared shell in every supported non-English language", async () => {
  const expected = {
    "zh-CN": ["图床首页", "上传图片", "API", "图床指南", "开发者工具", "支持", "关于我们", "联系我们", "隐私政策", "图床与开发者工具", "主导航", "语言"],
    de: ["Bildhosting", "Upload", "API", "Hosting-Hilfe", "Entwicklertools", "Support", "Über uns", "Kontakt", "Datenschutz", "Bildhosting und Entwicklertools", "Hauptnavigation", "Sprache"],
    fr: ["Hébergement", "Envoi", "API", "Guides", "Outils de développement", "Assistance", "À propos", "Contact", "Confidentialité", "Hébergement d’images et outils de développement", "Navigation principale", "Langue"],
    es: ["Alojamiento", "Subir", "API", "Guías", "Herramientas de desarrollo", "Soporte", "Acerca de", "Contacto", "Privacidad", "Alojamiento de imágenes y herramientas de desarrollo", "Navegación principal", "Idioma"],
  };

  for (const [lang, labels] of Object.entries(expected)) {
    const response = await fetchThroughWorker(`/image-api?lang=${lang}`);
    assert.equal(response.status, 200, lang);
    const html = await response.text();
    for (const label of labels) assert.match(html, new RegExp(escapeRe(label)), `${lang}: ${label}`);
  }
});
