import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import worker from "../_worker.js";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const htmlFiles = readdirSync(root).filter((name) => name.endsWith(".html") && !["image_admin.html", "map.html"].includes(name));

const approvedPaths = [
  "/", "/tax", "/vat", "/mortgage", "/ir35", "/stamp-duty", "/dividend",
  "/json", "/diff", "/token", "/qr", "/password", "/upload", "/image",
  "/pdf2img", "/color-picker", "/working-days", "/fuel", "/weight",
  "/about", "/contact", "/privacy",
];

const toolPages = htmlFiles.filter((name) => !["index.html", "about.html", "contact.html", "privacy.html"].includes(name));
const financePages = ["tax.html", "vat.html", "mortgage.html", "ir35.html", "stamp-duty.html", "dividend.html"];

const routeForFile = (file) => file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function section(html, tag, className) {
  const pattern = new RegExp(`<${tag}\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
  return html.match(pattern)?.[0] ?? "";
}

function hrefs(html) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
}

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
          return new Response(body, { status: 200, headers: { "content-type": contentType } });
        } catch {
          return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
      },
    },
  };
  return worker.fetch(new Request(`https://mini-tools.uk${path}`), env);
}

test("all public pages use the unified navigation and footer", () => {
  const navDestinations = ["/", "/#search", "/#popular", "/#uk-apps", "/#developer-tools", "/#other-tools", "/about", "/contact", "/privacy"];
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

    for (const requiredClass of ["site-nav", "site-nav-inner", "site-brand", "site-nav-links", "site-nav-link", "site-lang-group", "site-lang-trigger", "site-lang-dropdown"]) {
      assert.equal(navClassTokens.includes(requiredClass), true, `${file}: nav misses ${requiredClass}`);
    }
    for (const legacyClass of ["nav", "nav-inner", "brand", "nav-links", "nav-link", "lang-group", "lang-trigger", "lang-dropdown"]) {
      assert.equal(navClassTokens.includes(legacyClass), false, `${file}: shared nav must not use legacy class ${legacyClass}`);
    }
    assert.match(nav, /data-site-nav=["']privacy["'][^>]*>[^<]*<\/a>\s*<\/div>\s*<div class=["']site-lang-group["']>/, `${file}: language selector must match the homepage structure`);
    assert.equal(nav, homepageNav, `${file}: navigation markup must match homepage`);

    assert.match(footer, /Copyright 2026 Mini-Tools\.uk/, `${file}: footer copyright`);
    assert.match(footer, /mailto:yuyananuu@gmail\.com/, `${file}: footer email`);
    assert.equal(footer, homepageFooter, `${file}: footer markup must match homepage`);
    assert.match(html, /<style id=["']site-footer-style["']>/, `${file}: inline shared footer style`);
    assert.deepEqual(navigationStylesheets, ["site-nav.css"], `${file}: exactly one shared navigation stylesheet`);
    assert.doesNotMatch(html, /ui-refresh\.css/i, `${file}: retired UI stylesheet must not compete with navigation`);
    assert.doesNotMatch(nav + footer, /Blog|All Tools|Categories|UK Finance|Image & PDF|Security|Acceptable Use|Terms/i, file);
  }
});

test("shared navigation gives long translated labels enough responsive space", () => {
  const css = read("site-nav.css");
  assert.match(css, /\.site-nav,\s*\.site-nav \* \{[^}]*box-sizing: border-box !important;/, "shared navigation owns its box model");
  assert.match(css, /\.site-nav \{[^}]*background: rgba\(255, 255, 255, \.88\) !important;[^}]*backdrop-filter: blur\(16px\) !important;/, "shared navigation keeps the homepage glass style");
  assert.match(css, /\.site-nav \.site-nav-inner \{[\s\S]*?display: flex !important;/, "desktop nav uses isolated flexible layout");
  assert.match(css, /\.site-nav \.site-nav-inner \{[^}]*gap: 18px !important;/, "shared navigation keeps the homepage spacing");
  assert.doesNotMatch(css, /grid-template-columns: 1fr auto 1fr !important;/, "nav must not use collision-prone three-column grid");
  assert.match(css, /\.site-nav \.site-nav-links \{[^}]*gap: 5px !important;[^}]*flex-wrap: nowrap !important;/, "desktop links match the homepage row");
  assert.doesNotMatch(css, /body\s*>\s*main/, "navigation stylesheet must not change page layout");
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*?\.site-nav \.site-nav-inner[\s\S]*?flex-direction: column !important;/, "long labels wrap before collision");
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*?\.site-nav \.site-nav-links[\s\S]*?flex-wrap: wrap !important;/, "translated nav buttons wrap safely");
  assert.match(css, /\.site-nav \.site-nav-link,\s*\.site-nav \.site-lang-trigger \{[^}]*appearance: none !important;[^}]*font-family: [^;]+ !important;/, "language trigger has a complete shared reset");
  assert.match(css, /\.site-nav \.site-nav-link,\s*\.site-nav \.site-lang-trigger \{[^}]*padding: 9px 9px !important;[^}]*border-radius: 13px !important;[^}]*font-size: 13px !important;[^}]*font-weight: 760 !important;/, "navigation buttons match the homepage style");
  assert.match(css, /\.site-nav \.site-lang-dropdown button \{[^}]*font-family: [^;]+ !important;/, "language menu buttons use the shared font");
  assert.match(css, /\.site-nav \.site-lang-dropdown \{[^}]*border-radius: 18px !important;[^}]*padding: 10px !important;[^}]*box-shadow: 0 18px 42px rgba\(15, 23, 42, \.08\) !important;/, "language dropdown matches the homepage panel");
  assert.match(css, /\.site-nav \.site-lang-dropdown button \{[^}]*padding: 10px 12px !important;[^}]*border-radius: 12px !important;[^}]*font-size: 14px !important;[^}]*font-weight: 760 !important;/, "language menu buttons match the homepage style");
});

test("language controls support five languages without arrow-only page patches", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
      assert.match(html, new RegExp(`data-site-lang=["']${lang}["']`), `${file}: ${lang}`);
    }
    assert.match(html, /aria-expanded=["']false["']/, file);
    assert.match(html, /target\.searchParams\.set\(["']lang["'], selectedLang\)/, file);
    assert.match(html, /history\.replaceState\(null, ""/, `${file}: language switch should update URL in place`);
    assert.match(html, /window\.applyLanguage/, `${file}: language switch should call page i18n when available`);
    assert.doesNotMatch(html, /location\.assign\(/, `${file}: language switch must not reload or jump to top`);
    assert.doesNotMatch(html, /lang-trigger::after|upload-page-nav-isolation|upload-page-footer-fix|home-nav-footer-layout-fixes/, file);
  }
});

test("shared language script translates legacy bottom guidance FAQ", () => {
  for (const file of toolPages) {
    const html = read(file);
    assert.match(html, /renderToolGuidanceLanguage/, `${file}: shared guidance renderer`);
    if (html.includes('id="tool-guidance"') && !html.includes('id="guidanceTitle"')) {
      assert.match(html, /guidanceTranslations/, `${file}: guidance translations`);
      assert.match(html, /faqQ/, `${file}: FAQ question translation`);
      assert.match(html, /faqA/, `${file}: FAQ answer translation`);
    }
  }
});

test("public pages have no development leftovers or retired public links", () => {
  const mojibakeMarkers = /[茅猫脿莽锚谩驴]/;
  for (const file of htmlFiles) {
    const html = read(file);
    assert.doesNotMatch(html, /Original notes|Original notes for|lorem ipsum|placeholder text|test text/i, file);
    assert.doesNotMatch(html, /\b(?:TODO|FIXME)\b/, file);
    assert.doesNotMatch(html, /婕?2026|漏 2026|&copy;\s*2026|©\s*2026|admin@mini-tools\.uk/i, file);
    assert.doesNotMatch(html, mojibakeMarkers, `${file}: mojibake marker in public text`);
    assert.equal(hrefs(html).some((href) => /^\/(?:blog(?:\/|$)|terms\/?$|acceptable-use\/?$)/i.test(href)), false, file);
  }
});

test("tool pages include the required content structure", () => {
  for (const file of toolPages) {
    const html = read(file);
    assert.match(html, /<h1\b/i, `${file}: H1`);
    assert.match(html, /How to use/i, `${file}: How to use`);
    assert.match(html, /Use cases/i, `${file}: Use cases`);
    assert.match(html, /Limitations|Privacy note|Sources and assumptions|Official sources/i, `${file}: limitations/privacy/sources`);
    assert.match(html, /Related tools/i, `${file}: related tools`);
    assert.match(html, /FAQ/i, `${file}: FAQ`);
  }
});

test("finance pages include sources, assumptions, disclaimer, and GOV.UK links", () => {
  for (const file of financePages) {
    const html = read(file);
    assert.match(html, /Sources and assumptions|Official sources/i, `${file}: sources heading`);
    assert.match(html, /estimate|estimates only/i, `${file}: estimate disclaimer`);
    assert.match(html, /not (tax|legal|financial|accounting|official tax) advice/i, `${file}: advice disclaimer`);
    assert.match(html, /Last checked: 9 June 2026/i, `${file}: last checked`);
    assert.match(html, /https:\/\/www\.gov\.uk\//, `${file}: GOV.UK`);
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
    "What not to upload", "Removal and abuse reports", "Privacy note",
    "ID documents", "Passports", "Bank cards", "Financial documents",
    "Confidential work files", "Illegal content", "Malware-related content",
  ]) {
    assert.match(html, new RegExp(escapeRe(phrase), "i"), `upload content: ${phrase}`);
  }
});

test("canonical, hreflang, sitemap and robots stay clean", () => {
  for (const file of htmlFiles) {
    const path = routeForFile(file);
    const html = read(file);
    const clean = `https://mini-tools.uk${path}`;
    assert.match(html, new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${escapeRe(clean)}["']`), file);
    for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
      assert.match(html, new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']${escapeRe(lang)}["']\\s+href=["']${escapeRe(`${clean}?lang=${lang}`)}["']`), `${file}: ${lang}`);
    }
    assert.match(html, new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']x-default["']\\s+href=["']${escapeRe(clean)}["']`), file);
  }

  const locs = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locs, approvedPaths.map((path) => `https://mini-tools.uk${path}`));
  assert.equal(read("sitemap.xml").includes("?lang="), false);
  assert.equal(read("robots.txt").trim().replace(/\r\n/g, "\n"), "User-agent: *\nAllow: /\n\nSitemap: https://mini-tools.uk/sitemap.xml");
});

test("worker renders Chinese body, metadata and schema for key pages", async () => {
  for (const [path, chineseText, englishText] of [
    ["/?lang=zh-CN", "免费在线工具", "Free Online Tools for Everyday Work"],
    ["/upload?lang=zh-CN", "免费图床", "Upload an image and get direct URL"],
  ]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<html[^>]+lang="zh-CN"/, path);
    assert.match(html, new RegExp(chineseText), path);
    assert.doesNotMatch(html, new RegExp(englishText), path);
    assert.match(html, /"@context"/, `${path}: schema`);
    assert.match(html, /<link rel="canonical" href="https:\/\/mini-tools\.uk\/[^"]*\?lang=zh-CN"|<link rel="canonical" href="https:\/\/mini-tools\.uk\/\?lang=zh-CN"/, `${path}: canonical`);
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
