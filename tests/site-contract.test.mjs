import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { Worker } from "node:worker_threads";
import vm from "node:vm";
import worker from "../_worker.js";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const titleHtmlFiles = readdirSync(root).filter((name) => name.endsWith(".html") && !["image_admin.html", "map.html"].includes(name));
const htmlFiles = titleHtmlFiles.filter((name) => name !== "404.html");

const approvedPaths = [
  "/", "/tax", "/vat", "/mortgage", "/ir35", "/stamp-duty", "/dividend",
  "/json", "/diff", "/token", "/qr", "/password",
  "/upload", "/image", "/pdf2img", "/color-picker",
  "/working-days", "/fuel", "/weight",
  "/about", "/contact", "/privacy",
];

const toolPages = htmlFiles.filter((name) => !["index.html", "about.html", "contact.html", "privacy.html"].includes(name));
const financePages = ["tax.html", "vat.html", "mortgage.html", "ir35.html", "stamp-duty.html", "dividend.html"];
const bespokeGuidancePages = {
  "dividend.html": ["howTitle", "usefulTitle", "relatedTitle"],
  "fuel.html": ["articleTitle", "formulaTitle", "whyUsefulTitle"],
  "ir35.html": ["contentTitle", "notDoTitle", "relatedTitle"],
  "image.html": ["articleTitle", "useTitle", "relatedTitle"],
  "json.html": ["articleTitle", "privacyTitle", "useTitle"],
  "mortgage.html": ["articleTitle", "stressTitle", "sideAssumptionsTitle"],
  "pdf2img.html": ["articleTitle", "tipsTitle", "relatedTitle"],
  "qr.html": ["articleTitle", "tipsTitle", "relatedTitle"],
  "token.html": ["articleTitle", "privacyTitle", "useTitle"],
  "tax.html": ["articleTitle", "excludeTitle", "sideAssumptionsTitle"],
  "stamp-duty.html": ["articleTitle", "limitsTitle", "relatedTitle"],
  "vat.html": ["articleTitle", "zeroTitle", "thresholdTitle"],
  "weight.html": ["howTitle", "formulaTitle", "roundingTitle"],
  "working-days.html": ["articleTitle", "howToTitle", "limitsTitle"],
};

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
    href: `https://mini-tools.uk/tax${search}`,
    origin: "https://mini-tools.uk",
    pathname: "/tax",
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

  for (const file of ["upload.html", "qr.html", "mortgage.html", "weight.html"]) {
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

test("finance pages use translated Last checked source dates", () => {
  for (const file of financePages) {
    const html = read(file);
    assert.doesNotMatch(html, /<time\s+datetime=["']2026-06-09["']>\s*Last checked:\s*9 June 2026\s*<\/time>/i, `${file}: fixed English Last checked`);
    assert.match(html, /data-i18n=["']lastCheckedLabel["']/, `${file}: lastCheckedLabel`);
    assert.match(html, /data-i18n=["']lastCheckedDate["']/, `${file}: lastCheckedDate`);
    assert.ok((html.match(/lastCheckedLabel\s*:/g) || []).length >= 5, `${file}: five lastCheckedLabel translations`);
    assert.ok((html.match(/lastCheckedDate\s*:/g) || []).length >= 5, `${file}: five lastCheckedDate translations`);
  }
});

test("finance result panels do not server-render fixed English initial states", () => {
  const vat = read("vat.html");
  assert.match(firstElementById(vat, "result-mode"), /data-i18n=["']resultModeAdd["']/, "vat result-mode is translatable");
  assert.match(firstElementById(vat, "result-note"), /data-i18n=["']noteDefault["']/, "vat result-note is translatable");

  const stampDuty = read("stamp-duty.html");
  assert.match(firstElementById(stampDuty, "scenarioPill"), /data-i18n=["']standardResidential["']/, "stamp-duty scenarioPill is translatable");
  assert.match(firstElementById(stampDuty, "surchargeSummary"), /data-i18n=["']noSurcharge["']/, "stamp-duty surchargeSummary is translatable");
  assert.match(firstElementById(stampDuty, "resultNote"), /data-i18n=["']noteStandard["']/, "stamp-duty resultNote is translatable");

  const ir35 = read("ir35.html");
  for (const key of ["perMonth", "moreOutside", "moreInside", "noDifference", "initialMonthly", "initialDifference"]) {
    assert.match(ir35, new RegExp(`${key}\\s*:`), `ir35: ${key}`);
  }
  assert.match(firstElementById(ir35, "insideMonthlyHeadline"), /data-i18n=["']initialMonthly["']/, "ir35 inside monthly initial state");
  assert.match(firstElementById(ir35, "outsideMonthlyHeadline"), /data-i18n=["']initialMonthly["']/, "ir35 outside monthly initial state");
  assert.match(firstElementById(ir35, "differenceHeadline"), /data-i18n=["']initialDifference["']/, "ir35 difference initial state");

  const dividend = read("dividend.html");
  assert.match(dividend, /monthlyEquivalent\s*:/, "dividend monthlyEquivalent translation key");
  assert.match(firstElementById(dividend, "monthly-equivalent"), /data-i18n=["']initialMonthlyEquivalent["']/, "dividend monthly equivalent initial state");
});

test("vat page keeps English URLs clean while preserving non-English lang parameters", () => {
  const html = read("vat.html");
  assert.doesNotMatch(html, /searchParams\.set\(["']lang["']\s*,\s*["']en["']\)/, "vat must not force ?lang=en");
  assert.match(html, /currentLang\s*===\s*["']en["'][\s\S]*?searchParams\.delete\(["']lang["']\)/, "vat English links delete lang");
  assert.match(html, /else\s+u\.searchParams\.set\(["']lang["']\s*,\s*currentLang\)/, "vat non-English links preserve lang");
  assert.match(html, /currentLang\s*===\s*["']en["'][\s\S]*?u\.searchParams\.delete\(["']lang["']\)[\s\S]*?history\.replaceState/, "vat English current URL deletes lang");
});

test("standardizer excludes the 404 page from indexable page rewrites", () => {
  const standardizer = read("scripts/standardize-pages.ps1");
  const html404 = read("404.html");
  assert.match(standardizer, /\$excluded\s*=\s*@\([\s\S]*["']404\.html["'][\s\S]*\)/, "standardizer excludes 404.html");
  assert.match(html404, /<meta\s+name=["']robots["']\s+content=["']noindex,follow["']/i, "404 remains noindex,follow");
  assert.doesNotMatch(html404, /<meta\s+name=["']robots["']\s+content=["']index,follow,max-image-preview:large["']/i, "404 must not be indexable");
});

test("worker server-renders finance initial result states in Chinese", async () => {
  const expectations = [
    ["/vat?lang=zh-CN", [["result-mode", "加 VAT"], ["result-note", "这是 VAT 数学计算结果"]], [["result-mode", "Add VAT"], ["result-note", "This is an arithmetic VAT result only"]]],
    ["/stamp-duty?lang=zh-CN", [["scenarioPill", "普通住宅"], ["surchargeSummary", "无"], ["resultNote", "英格兰或北爱尔兰住宅"]], [["scenarioPill", "Standard residential"], ["resultNote", "This is a residential SDLT estimate"]]],
    ["/ir35?lang=zh-CN", [["insideMonthlyHeadline", "月"], ["outsideMonthlyHeadline", "月"], ["differenceHeadline", "outside IR35"]], [["insideMonthlyHeadline", "per month"], ["differenceHeadline", "more outside IR35"]]],
    ["/dividend?lang=zh-CN", [["monthly-equivalent", "月度折算"]], [["monthly-equivalent", "Monthly equivalent"]]],
  ];

  for (const [path, translated, fixedEnglish] of expectations) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const [id, expected] of translated) assert.match(elementTextById(html, id), new RegExp(escapeRe(expected)), `${path}: ${id}`);
    for (const [id, unexpected] of fixedEnglish) assert.doesNotMatch(elementTextById(html, id), new RegExp(escapeRe(unexpected)), `${path}: ${id}`);
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
    title: "UK Tax, VAT, Salary and Everyday Calculators",
    description: "UK-focused calculators for salary after tax, VAT, mortgages, stamp duty, IR35 and dividends, plus useful browser tools.",
    image: "https://assets.mini-tools.uk/image/icon-512x512.png",
  };

  for (const [name, content] of Object.entries(expected)) {
    const matches = [...html.matchAll(new RegExp(`<meta\\b[^>]*name=["']twitter:${name}["'][^>]*>`, "gi"))];
    assert.equal(matches.length, 1, `index.html: twitter:${name} must appear exactly once`);
    assert.match(matches[0][0], new RegExp(`content=["']${escapeRe(content)}["']`, "i"), `index.html: twitter:${name}`);
  }

  const homepageScript = html.match(/<script id=["']homepage-language-and-tools["']>([\s\S]*?)<\/script>/i)?.[1] || "";
  assert.match(homepageScript, /updateMeta\(["']twitter:title["']/, "homepage updates translated Twitter titles");
  assert.match(homepageScript, /updateMeta\(["']twitter:description["']/, "homepage updates translated Twitter descriptions");
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
    replacedUrls: ["/tax?lang=zh-CN"],
  });
  assert.deepEqual(runSharedI18n({ search: "?mode=compact", browserLanguages: ["de-DE"] }), {
    lang: "de",
    replacedUrls: ["/tax?mode=compact&lang=de"],
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
    'en: { home: "Home", search: "Search", popular: "Popular", ukApps: "UK Calculators"',
    'ukApps: "英国计算器"',
    'ukApps: "UK-Rechner"',
    'ukApps: "Calculateurs britanniques"',
    'ukApps: "Calculadoras del Reino Unido"',
  ]) {
    assert.match(runtime, new RegExp(escapeRe(expected)), expected);
  }
});

test("homepage exposes every formal route in initial HTML", () => {
  const homepage = read("index.html");
  for (const path of approvedPaths.filter((path) => path !== "/")) {
    assert.match(homepage, new RegExp(`href=["']${escapeRe(path)}["']`), `index.html: static link ${path}`);
  }
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

test("working days dynamic result labels stay localized", () => {
  const html = read("working-days.html");
  for (const expected of [
    'regionNames: { ew: "英格兰和威尔士", sc: "苏格兰", ni: "北爱尔兰" }',
    'bankHolidaysLabel: "Ausgeschlossene Feiertage"',
    'excludedHolidaysTitle: "Ausgeschlossene Feiertage im Zeitraum"',
    'bankHolidaysLabel: "Jours fériés exclus"',
    'excludedHolidaysTitle: "Jours fériés exclus dans la période"',
    'bankHolidaysLabel: "Festivos excluidos"',
    'excludedHolidaysTitle: "Festivos excluidos en el intervalo"',
  ]) {
    assert.match(html, new RegExp(escapeRe(expected)), expected);
  }
  assert.match(html, /els\.selectedRegion\.textContent = d\.regionNames\[region\]/, "result region uses the active dictionary");
  assert.match(html, /none\.textContent = d\.noneLabel/, "empty holiday result uses the active dictionary");
});

test("stamp duty dynamic results use localized display labels without changing the bands", () => {
  const html = read("stamp-duty.html");
  for (const expected of [
    'surchargeRow:"较高税率 / 附加税项目"',
    'ftbRelief:"首次购房者减免"',
    'rateOn:"适用于"',
    'andAbove:"及以上"',
    'ftbRelief:"Entlastung für Erstkäufer"',
    'rateOn:"auf"',
    'ftbRelief:"Réduction pour primo-accédant"',
    'rateOn:"sur"',
    'ftbRelief:"Desgravación para primera vivienda"',
    'rateOn:"sobre"',
  ]) {
    assert.match(html, new RegExp(escapeRe(expected)), expected);
  }
  assert.match(html, /\$\{rateLabel\(row\.rate\)\} \$\{dict\.rateOn\}/, "band labels use the active language");
  assert.match(html, /row\.to === "and above" \? dict\.andAbove/, "open-ended band label is localized");
  assert.match(html, /const standardBands = \[[\s\S]*?limit: 125000, rate: 0[\s\S]*?limit: Infinity, rate: 0\.12/, "standard SDLT bands stay unchanged");
});

test("stamp duty German French and Spanish content has complete visible translations", () => {
  const html = read("stamp-duty.html");
  assert.match(html, /data-i18n-aria-label=["']calculatorAria["']/, "calculator aria label is translated");
  assert.match(html, /data-i18n-aria-label=["']ratesAria["']/, "rates table aria label is translated");
  assert.match(html, /data-i18n=["']tableFtbBand["']/, "first-time buyer rate text is translated");
  assert.match(html, /data-i18n=["']tableNonResidentBand["']/, "non-resident rate text is translated");
  for (const expected of [
    'heroTitle:"Grunderwerbsteuer-Rechner 2026"',
    'articleTitle:"So funktioniert die SDLT für Wohnimmobilien"',
    'limitsTitle:"Wann dies nur eine grobe Orientierung ist"',
    'noteStandard:"Diese Schätzung gilt nur für die SDLT auf Wohnimmobilien in England und Nordirland."',
    'heroTitle:"Calculateur de droits de mutation 2026"',
    'buyerFtb:"Primo-accédant"',
    'articleTitle:"Fonctionnement de la SDLT résidentielle"',
    'noteStandard:"Cette estimation concerne uniquement la SDLT résidentielle en Angleterre et en Irlande du Nord."',
    'heroTitle:"Calculadora del impuesto de timbre 2026"',
    'buyerFtb:"Comprador de primera vivienda"',
    'articleTitle:"Cómo funciona el SDLT residencial"',
    'noteStandard:"Esta estimación solo corresponde al SDLT residencial de Inglaterra e Irlanda del Norte."',
    'tableFtbBand:"0% bis £300,000, danach 5% bis £500,000"',
    'tableNonResidentBand:"+2 Prozentpunkte"',
    'tableFtbBand:"0% jusqu’à £300,000, puis 5% jusqu’à £500,000"',
    'tableNonResidentBand:"+2 points de pourcentage"',
    'tableFtbBand:"0% hasta £300,000 y después 5% hasta £500,000"',
    'tableNonResidentBand:"+2 puntos porcentuales"',
  ]) {
    assert.match(html, new RegExp(escapeRe(expected)), expected);
  }
});

test("dividend dynamic result labels are translated in all non-English dictionaries", () => {
  const html = read("dividend.html");
  for (const expected of [
    'employerNiRow:"雇主国民保险"',
    'corpTaxRow:"公司税"',
    'profitLabel:"Unternehmensgewinn vor Geschäftsführergehalt und Unternehmenssteuern"',
    'assumptionBadge:"Planungsfall mit einem Geschäftsführer"',
    'totalTaxRow:"Insgesamt gezahlte Steuern"',
    'profitLabel:"Bénéfice de la société avant rémunération du dirigeant et impôts de la société"',
    'employerNiRow:"Cotisations patronales à la National Insurance"',
    'dividendTaxRow:"Impôt sur les dividendes"',
    'assumptionBadge:"Cas de planification avec un seul dirigeant"',
    'employerNiRow:"National Insurance a cargo de la empresa"',
    'corpTaxRow:"Impuesto de sociedades"',
    'dividendTaxRow:"Impuesto sobre dividendos"',
    'monthlyEquivalent:"月度折算："',
    'monthlyEquivalent:"Monatlicher Gegenwert:"',
    'monthlyEquivalent:"Équivalent mensuel :"',
    'monthlyEquivalent:"Equivalente mensual:"',
  ]) {
    assert.match(html, new RegExp(escapeRe(expected)), expected);
  }
});

test("PDF related tool names are translated", () => {
  const html = read("pdf2img.html");
  for (const expected of [
    'relatedImage:"Bildgrößenänderer"',
    'relatedColor:"Bildfarbwähler"',
    'relatedImage:"Redimensionneur d’image"',
    'relatedColor:"Sélecteur de couleur d’image"',
    'relatedImage:"Redimensionador de imágenes"',
    'relatedColor:"Selector de color de imagen"',
  ]) {
    assert.match(html, new RegExp(escapeRe(expected)), expected);
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

test("privacy policy discloses analytics, advertising, consent and actual external services", () => {
  const html = read("privacy.html");
  for (const phrase of [
    "approximate location", "performance information", "cookies or similar identifiers",
    "previous visits to this site or other websites", "personalised advertising",
    "Google Ads Settings", "other third-party advertising vendors",
    "consent management platform", "advertising and cookie choices",
    "Google Analytics", "Google AdSense", "Cloudflare", "jsDelivr", "cdnjs", "Google Fonts",
  ]) {
    assert.match(html, new RegExp(escapeRe(phrase), "i"), `privacy disclosure: ${phrase}`);
  }
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
  assert.match(source, /MINI_TOOLS_SITE_VERSION\s*=\s*["']2026-07-12-01["']/, "site-version.js release id");
  assert.match(read("index.html"), /data-site-version/, "homepage footer version slot");
});

test("shared tooling cannot regenerate the retired generic guidance template", () => {
  for (const file of ["site-i18n.js", "scripts/standardize-pages.ps1"]) {
    const source = read(file);
    assert.doesNotMatch(source, /guidanceTranslations|renderToolGuidanceLanguage|applyToolGuidanceLanguage|syncEnglishToolGuidance/, file);
    assert.doesNotMatch(source, /is designed for one focused task|for quick checks, planning, formatting or preparation work/i, file);
  }
});

test("finance pages keep page-specific assumptions, disclaimers, and dated GOV.UK sources", () => {
  const checkedDate = /Last checked:(?:<\/span>\s*<time\b[^>]*>)?\s*\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}/i;
  for (const file of financePages) {
    const html = read(file);
    assert.match(html, /estimate|estimates only/i, `${file}: estimate disclaimer`);
    assert.match(html, /not [^.]{0,160}advice|professional advice|solicitor or tax adviser/i, `${file}: advice disclaimer`);
    if (file === "mortgage.html") {
      assert.match(html, /data-i18n=["']lastCheckedLabel["']/i, `${file}: translated source check label`);
      assert.match(html, /<time\b[^>]*datetime=["']2026-06-09["'][^>]*data-i18n=["']lastCheckedDate["']/i, `${file}: source check date`);
    } else {
      assert.match(html, checkedDate, `${file}: source check date`);
    }
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
    "What not to upload", "How uploaded images are reviewed", "Common image hosting use cases", "Removal and abuse reports", "Privacy note",
    "ID documents", "Passports", "Bank cards", "Financial documents",
    "Confidential work files", "Illegal content", "Malware-related content",
  ]) {
    assert.match(html, new RegExp(escapeRe(phrase), "i"), `upload content: ${phrase}`);
  }
  for (const id of ["retentionTitle", "rulesTitle", "moderationTitle", "removalTitle", "privacyNoteTitle", "examplesTitle", "faqSectionTitle"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `upload: ${id}`);
  }
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

test("worker renders token and working-days pages without stalling on array translations", async () => {
  for (const path of ["/token", "/working-days?lang=zh-CN"]) {
    const response = await fetchThroughIsolatedWorker(path);
    assert.equal(response.status, 200, path);
    assert.match(response.body, /<main\b/i, path);
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
  assert.equal(lastmods.every((value) => value === "2026-07-12"), true, "sitemap lastmod date");
  assert.equal(read("sitemap.xml").includes("?lang="), false);
  assert.doesNotMatch(read("sitemap.xml"), /blog/i);
  const indexableBlock = read("_worker.js").match(/const INDEXABLE_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  const indexablePaths = [...indexableBlock.matchAll(/"(\/[^"]*)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(indexablePaths, [...approvedPaths].sort(), "Worker indexable paths must match sitemap paths");
  assert.equal(read("robots.txt").trim().replace(/\r\n/g, "\n"), "User-agent: *\nAllow: /\nDisallow: /cdn-cgi/\nDisallow: /image_admin\nDisallow: /map\nDisallow: /wp/\nDisallow: /teams/\nDisallow: /user/\nDisallow: /main.php\nDisallow: /menu.php\n\nSitemap: https://mini-tools.uk/sitemap.xml");
});

test("worker renders Chinese body, metadata and schema for key pages", async () => {
  assert.doesNotMatch(read("_worker.js"), /\bnew\s+Function\b|\beval\s*\(/, "Worker SSR must not use blocked dynamic code generation");
  for (const [path, chineseText, englishText] of [
    ["/?lang=zh-CN", "英国税务、VAT、工资和日常财务决策计算器。", "UK calculators for tax, VAT, salary and everyday money decisions."],
    ["/upload?lang=zh-CN", "免费图床：图片转 URL、Markdown 与 GitHub README 图片托管", "Free Image Hosting for GitHub README, Markdown and Docs"],
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
      const ukHubStart = html.indexOf('id="ukHubTools"');
      const ukHub = html.slice(ukHubStart, html.indexOf("</section>", ukHubStart));
      const otherToolsStart = html.indexOf('id="otherToolsGrid"');
      const otherTools = html.slice(otherToolsStart, html.indexOf("</section>", otherToolsStart));
      assert.match(ukHub, /英国个人所得税计算器/, `${path}: SSR ukHubTools Chinese tool name`);
      assert.match(otherTools, /免费图床/, `${path}: SSR otherToolsGrid Chinese tool name`);
      assert.doesNotMatch(ukHub, /UK Tax Calculator/, `${path}: ukHubTools must not stay English-only in SSR`);
    }
  }
});

test("worker server-renders the Tax initial result and rates in Chinese", async () => {
  const response = await fetchThroughWorker("/tax?lang=zh-CN");
  assert.equal(response.status, 200);
  const html = await response.text();
  const regionBadge = html.match(/<div\b[^>]*id=["']regionBadge["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const summaryNote = html.match(/<div\b[^>]*id=["']summaryNote["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const employerCost = html.match(/<span\b[^>]*id=["']employerCost["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
  const rates = html.slice(html.indexOf('data-i18n="rukRatesTitle"'), html.indexOf('data-i18n="niLoanTitle"'));
  const sources = html.slice(html.indexOf('data-i18n="sourceTitle"'), html.indexOf('data-i18n="relatedTitle"'));

  assert.match(regionBadge, /英格兰\s*\/\s*北爱尔兰/);
  assert.doesNotMatch(regionBadge, /England \/ NI/);
  assert.match(summaryNote, /采用标准 1257L 税码和个人免税额进行估算/);
  assert.doesNotMatch(summaryNote, /Uses standard 1257L personal allowance/);
  assert.match(employerCost, /\/ 年/);
  assert.doesNotMatch(employerCost, /\/ year/);
  assert.match(rates, /£12,571 至 £50,270/);
  assert.doesNotMatch(rates, /£[\d,]+ to £[\d,]+/);
  assert.match(sources, /最后核对/);
  assert.match(sources, /2026年6月9日/);
  assert.doesNotMatch(sources, /Last checked:/);
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

test("worker normalizes invalid languages to the canonical English URL", async () => {
  const response = await fetchThroughWorker("/tax?lang=xx");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://mini-tools.uk/tax");
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
  assert.match(html, /<title>Über Mini-Tools\.uk｜Praktische Rechner und Browser-Tools<\/title>/);
  assert.doesNotMatch(html, /<title>About Mini-Tools\.uk - Practical Calculators and Browser Tools<\/title>/);
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

test("worker renders VAT Object.assign dictionaries for German, French and Spanish", async () => {
  for (const [lang, heading] of [
    ["de", "UK VAT Rechner zum Hinzufügen oder Herausrechnen von VAT"],
    ["fr", "Calculateur VAT UK pour ajouter ou retirer la VAT"],
    ["es", "Calculadora VAT UK para añadir o quitar VAT"],
  ]) {
    const response = await fetchThroughWorker(`/vat?lang=${lang}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<html[^>]+lang=["']${lang}["']`));
    assert.match(html, new RegExp(`<h1\\b[^>]*>${escapeRe(heading)}<\\/h1>`));
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
  assert.match(html, /href=["']\/#search["'][^>]*data-i18n=["']searchButton["']/i);
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
  assert.match(html, /href=["']\/\?lang=zh-CN#search["']/);
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
    ["/tax.html", "https://mini-tools.uk/tax"],
    ["/about.html", "https://mini-tools.uk/about"],
    ["/image-compressor", "https://mini-tools.uk/image"],
    ["/pdf-to-image", "https://mini-tools.uk/pdf2img"],
    ["/terms", "https://mini-tools.uk/privacy"],
  ]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("location"), target, path);
  }

  for (const path of ["/", "/tax", "/token", "/about", "/privacy", "/404.html"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 200, path);
  }
});

test("legacy image and PDF routes redirect directly to formal URLs", async () => {
  for (const [legacy, target] of [
    ["/image-compressor", "https://mini-tools.uk/image"],
    ["/pdf-to-image", "https://mini-tools.uk/pdf2img"],
  ]) {
    const response = await fetchThroughWorker(legacy);
    assert.equal(response.status, 301, legacy);
    assert.equal(response.headers.get("location"), target, legacy);
  }
});

test("all retired page routes use the unified error page while preserving 410", async () => {
  for (const path of ["/game", "/game/", "/json2", "/unit.html?lang=de", "/word"]) {
    const response = await fetchThroughWorker(path);
    assert.equal(response.status, 410, path);
    assert.match(response.headers.get("content-type") || "", /text\/html/i, path);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex,\s*follow/i, path);
    const html = await response.text();
    assert.match(html, /class=["']site-nav["']/, path);
    assert.match(html, /Page not found|Seite nicht gefunden/i, path);
  }
});

test("AdSense cleanup removes construction copy and known mixed-language English keys", () => {
  const homepage = read("index.html");
  const about = read("about.html");
  const image = read("image.html");
  const stampDuty = read("stamp-duty.html");
  const diff = read("diff.html");
  const colorPicker = read("color-picker.html");
  const homepageMarkup = homepage.slice(0, homepage.indexOf('<script id="homepage-language-and-tools">'));

  assert.doesNotMatch(homepageMarkup, /homepage now gives priority|These tools are not removed|simply moved below/i);
  assert.match(homepage, /Object\.assign\(i18n\.en,[\s\S]*ukText:"Use the UK calculator hub/);
  assert.match(homepage, /Object\.assign\(i18n\["zh-CN"\],[\s\S]*ukText:"英国计算器区域/);
  assert.doesNotMatch(about, /being improved page by page|逐页改进|Schritt für Schritt verbessert|amélioré page par page|mejora página por página/i);
  assert.match(image, /heroTitle:"Image Compressor and Resizer"/);
  assert.match(image, /feature1:"Resize by width and height"/);
  assert.match(image, /relatedColor:"Image Color Picker"/);
  assert.match(stampDuty, /priceLabel:"Property price"/);
  assert.match(stampDuty, /sideKeywordsTitle:"Check before completion"/);
  assert.equal((diff.match(/id=["']tool-guidance["']/g) || []).length, 0, "diff duplicate guidance");
  assert.equal((colorPicker.match(/id=["']tool-guidance["']/g) || []).length, 0, "color picker duplicate guidance");
});

test("retired duplicate modules and upload guidance cannot return", () => {
  const checks = [
    ["contact.html", /id=["']removal-request-details["']/i],
    ["image.html", /id=["']tool-guidance["']/i],
    ["privacy.html", /id=["']upload-policy-summary["']/i],
    ["about.html", /id=["']directory-overview["']/i],
    ["tax.html", /id=["']calculator-disclaimer-summary["']/i],
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
    "calculator-disclaimer-summary",
    "uploadGuidanceTranslations",
    "rates-and-thresholds-for-employers-2026-to-2027",
  ]) {
    assert.doesNotMatch(standardizer, new RegExp(escapeRe(retired), "i"), `standardizer: ${retired}`);
  }
  assert.doesNotMatch(standardizer, /\\bSecurity\\b/, "standardizer must not globally replace Security");
});

test("image translations do not retain keys for the retired guidance module", () => {
  const html = read("image.html");
  for (const key of [
    "guidanceTitle", "guidanceIntro", "guidanceUseTitle", "guidanceUseText",
    "guidanceLimitationsTitle", "guidanceLimitationsText", "guidanceFaqTitle", "guidanceFaqText",
    "guidanceRelatedTitle", "guidanceRelatedUpload", "guidanceRelatedPdf", "guidanceRelatedColor",
  ]) {
    assert.doesNotMatch(html, new RegExp(`\\b${key}\\s*:`), key);
  }
  assert.doesNotMatch(html, /id=["']tool-guidance["']/i);
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

test("mortgage German interface translates ordinary labels", () => {
  const html = read("mortgage.html");
  const germanStart = html.indexOf("\n      de: {");
  const germanEnd = html.indexOf("\n      fr: {", germanStart);
  const german = germanStart === -1 || germanEnd === -1 ? "" : html.slice(germanStart, germanEnd);
  for (const expected of [
    'propertyPriceLabel:"Immobilienwert (£)"',
    'mortgageAmountLabel:"Darlehensbetrag (£)"',
    'depositLabel:"Eigenkapital (£)"',
    'buyerTypeLabel:"Käufertyp für SDLT"',
    'breakdownHead:"Aufschlüsselung"',
    'amountHead:"Betrag"',
  ]) {
    assert.match(german, new RegExp(escapeRe(expected)), expected);
  }
  for (const untranslated of [
    'propertyPriceLabel:"Property value (£)"',
    'mortgageAmountLabel:"Mortgage amount (£)"',
    'buyerTypeLabel:"Buyer type for SDLT"',
    'breakdownHead:"Breakdown"',
    'amountHead:"Amount"',
  ]) {
    assert.doesNotMatch(german, new RegExp(escapeRe(untranslated)), untranslated);
  }
});

test("tax uses relevant UK calculator recommendations and Chinese SEO copy", () => {
  const html = read("tax.html");
  const related = html.match(/<div class=["']side-card["']>\s*<h3 data-i18n=["']relatedTitle["'][\s\S]*?<\/div>\s*<\/div>/i)?.[0] || "";
  assert.doesNotMatch(related, /href=["']\/upload["']/i);
  for (const path of ["/vat", "/dividend", "/ir35", "/mortgage", "/stamp-duty"]) {
    assert.match(related, new RegExp(`href=["']${escapeRe(path)}["']`, "i"), path);
  }
  for (const key of ["relatedTitle", "relatedVat", "relatedDividend", "relatedIr35", "relatedMortgage", "relatedStampDuty"]) {
    assert.match(html, new RegExp(`data-i18n=["']${key}["']`), key);
  }

  assert.match(html, /seoTitle:\s*["']英国个人所得税计算器 2026\/27｜英国个税计算器与税后工资计算｜Mini-Tools\.uk["']/);
  assert.match(html, /seoDescription:\s*["']免费英国个人所得税计算器和英国个税计算器，适用于 2026\/27 税年。估算 PAYE 个人所得税、National Insurance、养老金、学生贷款、研究生贷款及年薪、月薪税后到手工资。["']/);
  assert.match(html, /heroTitle:\s*["']英国个人所得税计算器与英国个税计算器["']/);
  assert.match(html, /heroText:\s*["']使用这个英国个人所得税计算器，可以估算 2026\/27 税年的 PAYE/);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, "tax must keep one H1");
  assert.doesNotMatch(html, /<meta\b[^>]*name=["']keywords["']/i);
});

test("mortgage sources are relevant and translated in all five languages", () => {
  const html = read("mortgage.html");
  assert.doesNotMatch(html, /rates-and-thresholds-for-employers-2026-to-2027/);
  assert.match(html, /https:\/\/www\.gov\.uk\/stamp-duty-land-tax/);
  for (const key of ["sourcesTitle", "sourcesDisclaimer", "sourcesSdltScope", "sourcesFormulaNote", "lastCheckedLabel", "lastCheckedDate"]) {
    assert.match(html, new RegExp(`data-i18n=["']${key}["']`), key);
    for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
      const languageBlock = html.match(new RegExp(`["']?${escapeRe(lang)}["']?\\s*:\\s*\\{[\\s\\S]*?(?=\\n\\s*(?:["']?(?:en|zh-CN|de|fr|es)["']?\\s*:\\s*\\{|\\}\\s*;))`))?.[0] || "";
      assert.match(languageBlock, new RegExp(`${key}\\s*:`), `${lang}: ${key}`);
    }
  }
  assert.match(html, /Mortgage repayments use a standard amortisation formula\. The interest rate is entered by the user and is not a live lender rate\./);
  assert.match(html, /房贷月供使用标准等额还款公式进行估算。利率由用户自行输入，并非银行实时房贷利率。/);
});

test("worker server-renders the shared shell in every supported non-English language", async () => {
  const expected = {
    "zh-CN": ["首页", "搜索", "热门工具", "英国计算器", "开发者工具", "其他工具", "关于我们", "联系我们", "隐私政策", "实用在线工具", "主导航", "语言"],
    de: ["Startseite", "Suche", "Beliebt", "UK-Rechner", "Entwicklertools", "Weitere Tools", "Über uns", "Kontakt", "Datenschutz", "Nützliche Online-Tools", "Hauptnavigation", "Sprache"],
    fr: ["Accueil", "Recherche", "Populaires", "Calculateurs britanniques", "Outils de développement", "Autres outils", "À propos", "Contact", "Confidentialité", "Outils en ligne utiles", "Navigation principale", "Langue"],
    es: ["Inicio", "Buscar", "Populares", "Calculadoras del Reino Unido", "Herramientas para desarrolladores", "Otras herramientas", "Acerca de", "Contacto", "Privacidad", "Herramientas en línea útiles", "Navegación principal", "Idioma"],
  };

  for (const [lang, labels] of Object.entries(expected)) {
    const response = await fetchThroughWorker(`/tax?lang=${lang}`);
    assert.equal(response.status, 200, lang);
    const html = await response.text();
    for (const label of labels) assert.match(html, new RegExp(escapeRe(label)), `${lang}: ${label}`);
  }
});
