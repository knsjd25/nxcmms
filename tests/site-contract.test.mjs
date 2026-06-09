import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const htmlFiles = readdirSync(root).filter((name) => name.endsWith(".html") && !["image_admin.html", "map.html"].includes(name));
const keyPages = ["index.html", "about.html", "upload.html", "tax.html", "contact.html", "privacy.html"];
const toolPages = htmlFiles.filter((name) => !["index.html", "about.html", "contact.html", "privacy.html"].includes(name));
const ukTaxPages = ["tax.html", "vat.html", "ir35.html", "stamp-duty.html", "dividend.html"];
const canonicalPaths = new Map(Object.entries({
  "index.html": "/", "upload.html": "/upload", "tax.html": "/tax", "vat.html": "/vat",
  "json.html": "/json", "diff.html": "/diff", "token.html": "/token", "qr.html": "/qr",
  "pdf2img.html": "/pdf2img", "mortgage.html": "/mortgage", "ir35.html": "/ir35",
  "stamp-duty.html": "/stamp-duty", "dividend.html": "/dividend", "password.html": "/password",
  "image.html": "/image", "color-picker.html": "/color-picker", "working-days.html": "/working-days",
  "fuel.html": "/fuel", "weight.html": "/weight", "about.html": "/about", "contact.html": "/contact",
  "privacy.html": "/privacy",
}));

function section(html, tag, className) {
  const pattern = new RegExp(`<${tag}\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
  return html.match(pattern)?.[0] ?? "";
}

function hrefs(html) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
}

test("all public pages remove retired route links", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    const links = hrefs(html);
    assert.equal(links.some((href) => /^\/(?:blog(?:\/|$)|terms\/?$|acceptable-use\/?$)/i.test(href)), false, file);
    const restrictedAreas = html.matchAll(/<(?:nav|[^>]+\b(?:class|id)=["'][^"']*(?:empty|error|upload-result|result)[^"']*["'])\b[\s\S]*?<\/(?:nav|div|section|aside)>/gi);
    for (const area of restrictedAreas) {
      assert.doesNotMatch(area[0], /adsbygoogle|data-ad-client|data-ad-slot|ad-container|ad-unit|ad-slot/, `${file}: restricted ad area`);
    }
  }
});

test("key pages use the unified navigation destinations", () => {
  const expected = ["/", "/#search", "/#popular", "/#uk-apps", "/#developer-tools", "/#other-tools", "/about", "/contact", "/privacy"];
  for (const file of keyPages) {
    const html = read(file);
    const nav = section(html, "nav", "nav");
    for (const href of expected) assert.match(nav, new RegExp(`href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`), `${file}: ${href}`);
    assert.doesNotMatch(nav, /All Tools|Categories|UK Finance|Image &amp; PDF|Image & PDF|Security|Blog/i, file);
  }
});

test("key pages use the minimal footer", () => {
  for (const file of keyPages) {
    const footer = section(read(file), "footer", "footer");
    for (const href of ["/", "/about", "/contact", "/privacy"]) assert.match(footer, new RegExp(`href=["']${href.replace("/", "\\/")}["']`), `${file}: ${href}`);
    assert.match(footer, /mailto:yuyananuu@gmail\.com/, file);
    assert.doesNotMatch(footer, /Blog|Terms|Acceptable Use|All Tools|Categories/i, file);
  }
});

test("language controls preserve current paths and localize internal links", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    for (const lang of ["en", "zh-CN", "de", "fr", "es"]) assert.match(html, new RegExp(`data-site-lang=["']${lang}["']`), `${file}: ${lang}`);
    assert.match(html, /target\.searchParams\.set\(["']lang["'], selectedLang\)/, file);
    assert.match(html, /link\.searchParams\.set\(["']lang["'], lang\)/, file);
  }
});

test("all pages use the same shared navigation stylesheet", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    assert.match(html, /href=["']site-nav\.css["']/, file);
    assert.doesNotMatch(html, /href=["']\/site-nav\.css["']/, file);
    assert.doesNotMatch(html, /id=["']site-nav-style["']/, file);
  }
});

test("no public page retains a legacy header around the unified nav", () => {
  for (const file of htmlFiles) {
    assert.doesNotMatch(read(file), /<header\s+class=["']site-header["']/i, file);
  }
});

test("shared navigation keeps the main menu beside the brand", () => {
  const css = read("site-nav.css");
  assert.match(css, /--site-shell-width:\s*1180px/);
  assert.match(css, /max-width:\s*var\(--site-shell-width\)\s*!important/);
  assert.match(css, /justify-content:\s*flex-start\s*!important/);
  assert.match(css, /right:\s*0\s*!important/);
  assert.match(css, /justify-content:\s*center\s*!important/);
  assert.match(css, /grid-template-columns:\s*1fr auto 1fr\s*!important/);
});

test("homepage has the requested directory sections and popular tools", () => {
  const html = read("index.html");
  assert.match(html, /Free Online Tools for Everyday Work/);
  assert.match(html, /A simple collection of useful online tools for UK calculations, developer tasks, image utilities, PDF tools and everyday quick work\./);
  for (const id of ["search", "popular", "categories", "uk-apps", "developer-tools", "other-tools"]) assert.match(html, new RegExp(`id=["']${id}["']`));
  const popular = html.match(/<div class=["']popular-grid["'] id=["']popularTools["']>([\s\S]*?)<\/div><\/section>/)?.[1] ?? "";
  assert.equal([...popular.matchAll(/class=["']tool-card\b/g)].length, 18);
  for (const path of ["/tax", "/vat", "/mortgage", "/ir35", "/stamp-duty", "/dividend", "/json", "/diff", "/token", "/qr", "/password", "/upload", "/image", "/pdf2img", "/color-picker", "/working-days", "/fuel", "/weight"]) {
    assert.match(html, new RegExp(`href=["']${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`), path);
  }
  assert.doesNotMatch(html, /Featured Tool|Main Tool|Primary Tool|terms and acceptable-use page should explain|Each section has a featured tool/i);
});

test("about page describes the three-category tool directory", () => {
  const html = read("about.html");
  for (const phrase of ["tool directory", "UK Apps", "Developer Tools", "Other Tools", "UK Tax Calculator", "JSON Formatter", "Free Image Hosting"]) {
    assert.match(html, new RegExp(phrase, "i"), phrase);
  }
  assert.match(html, /Most tools.*without an account/i);
  assert.match(html, /Contact/i);
});

test("privacy page covers upload policy and browser processing", () => {
  const html = read("privacy.html");
  for (const phrase of [
    "browser", "remote service", "not private", "1 day", "7 days", "30 days",
    "approved code", "image URL", "illegal content", "adult content", "violent content",
    "hateful content", "copyrighted images", "passport", "financial documents",
    "medical records", "malware", "phishing", "scam", "minors", "confidential screenshots",
    "Google Analytics", "advertising", "cookies", "localStorage",
  ]) assert.match(html, new RegExp(phrase, "i"), phrase);
});

test("contact, upload, and tax retain required operational guidance", () => {
  const contact = read("contact.html");
  for (const phrase of ["bug report", "feature suggestion", "calculation issue", "image removal request", "abuse report", "privacy question", "hosted image URL", "reason"]) assert.match(contact, new RegExp(phrase, "i"), phrase);
  const upload = read("upload.html");
  for (const phrase of ["What not to upload", "Removal and abuse reports", "Privacy note"]) assert.match(upload, new RegExp(phrase, "i"), phrase);
  const tax = read("tax.html");
  for (const phrase of ["estimates only", "not official tax advice", "not legal or financial advice"]) assert.match(tax, new RegExp(phrase, "i"), phrase);
});

test("all public tools are index follow", () => {
  for (const file of toolPages) assert.match(read(file), /<meta\s+name=["']robots["']\s+content=["'][^"']*index\s*,?\s*follow/i, file);
});

test("tool pages include original notes, examples, limitations, FAQ, and related tools", () => {
  for (const file of toolPages) {
    const html = read(file);
    for (const phrase of ["Original notes", "Example", "Limitations", "FAQ", "Related tools"]) {
      assert.match(html, new RegExp(phrase, "i"), `${file}: ${phrase}`);
    }
  }
});

test("UK tax tools include official sources and a last checked date", () => {
  for (const file of ukTaxPages) {
    const html = read(file);
    assert.match(html, /Official sources/, file);
    assert.match(html, /Last checked: 9 June 2026/, file);
    assert.match(html, /https:\/\/www\.gov\.uk\//, file);
  }
});

test("canonical and hreflang tags use clean core URLs with language alternates", () => {
  for (const [file, path] of canonicalPaths) {
    const html = read(file);
    const clean = `https://mini-tools.uk${path}`;
    const esc = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(html, new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${esc(clean)}["']`), file);
    for (const lang of ["en", "zh-CN", "de", "fr", "es"]) {
      const expected = `${clean}?lang=${lang}`;
      assert.match(html, new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']${lang}["']\\s+href=["']${esc(expected)}["']`), `${file}: ${lang}`);
    }
    assert.match(html, new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']x-default["']\\s+href=["']${esc(clean)}["']`), file);
    assert.match(html, /applyCanonicalHreflang/, file);
  }
});

test("worker implements retired and legacy URL behavior", () => {
  const worker = read("_worker.js");
  assert.match(worker, /initialPathname\s*===\s*["']\/terms["'][\s\S]*?\/privacy/);
  assert.match(worker, /initialPathname\s*===\s*["']\/acceptable-use["'][\s\S]*?\/privacy/);
  assert.doesNotMatch(worker, /\/blog|Blog|miniToolsBlogLang/);
  assert.match(worker, /pathname\s*===\s*["']\/index\.html["']/);
  assert.match(worker, /pathname\.endsWith\(["']\.html["']\)/);
  assert.deepEqual([...worker.matchAll(/SUPPORTED_LANGS\s*=\s*\[([^\]]+)\]/g)].length, 1);
});

test("public pages have clean footer text and one public contact email", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    assert.doesNotMatch(html, /漏 2026|婕|admin@mini-tools\.uk|\/blog|Blog|navBlog|footerBlog/, file);
    assert.match(section(html, "footer", "footer"), /© 2026 Mini-Tools\.uk/, file);
    assert.match(section(html, "footer", "footer"), /mailto:yuyananuu@gmail\.com/, file);
  }
});

test("sitemap contains only the approved complete clean URLs", () => {
  const locs = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locs.length, 22);
  for (const path of ["/", "/upload", "/tax", "/vat", "/json", "/diff", "/token", "/qr", "/pdf2img", "/mortgage", "/ir35", "/stamp-duty", "/dividend", "/password", "/image", "/color-picker", "/working-days", "/fuel", "/weight", "/about", "/contact", "/privacy"]) {
    assert.ok(locs.includes(`https://mini-tools.uk${path}`), path);
  }
  assert.equal(read("sitemap.xml").includes("?lang="), false);
});

test("robots allows crawling and declares sitemap", () => {
  assert.equal(read("robots.txt").trim(), "User-agent: *\nAllow: /\n\nSitemap: https://mini-tools.uk/sitemap.xml");
});
