import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const htmlFiles = readdirSync(root).filter((name) => name.endsWith(".html") && !["image_admin.html", "map.html"].includes(name));
const keyPages = ["index.html", "about.html", "upload.html", "tax.html", "contact.html", "privacy.html"];
const toolPages = htmlFiles.filter((name) => !["index.html", "about.html", "contact.html", "privacy.html"].includes(name));

function section(html, tag, className) {
  const pattern = new RegExp(`<${tag}\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
  return html.match(pattern)?.[0] ?? "";
}

function hrefs(html) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
}

test("all public pages remove retired route links", () => {
  for (const file of htmlFiles) {
    const links = hrefs(read(file));
    assert.equal(links.some((href) => /^\/(?:blog(?:\/|$)|terms\/?$|acceptable-use\/?$)/i.test(href)), false, file);
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

test("all pages include the non-wrapping unified navigation style", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    assert.match(html, /id=["']site-nav-style["']/, file);
    assert.match(html, /\.nav-links\{display:flex;align-items:center;gap:4px;flex-wrap:nowrap/, file);
  }
});

test("upload does not retain its legacy header around the unified nav", () => {
  assert.doesNotMatch(read("upload.html"), /<header\s+class=["']site-header["']/i);
});

test("homepage has the requested directory sections and popular tools", () => {
  const html = read("index.html");
  assert.match(html, /Free Online Tools for Everyday Work/);
  assert.match(html, /A simple collection of useful online tools for UK calculations, developer tasks, image utilities, PDF tools and everyday quick work\./);
  for (const id of ["search", "popular", "categories", "uk-apps", "developer-tools", "other-tools"]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /\["tax"[\s\S]*?"\/tax"[\s\S]*?true/);
  assert.match(html, /\["upload"[\s\S]*?"\/upload"[\s\S]*?true/);
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

test("worker implements retired and legacy URL behavior", () => {
  const worker = read("_worker.js");
  assert.match(worker, /initialPathname\s*===\s*["']\/terms["'][\s\S]*?\/privacy/);
  assert.match(worker, /initialPathname\s*===\s*["']\/acceptable-use["'][\s\S]*?\/privacy/);
  assert.match(worker, /initialPathname\s*===\s*["']\/blog["'][\s\S]*?status:\s*410/);
  assert.match(worker, /initialPathname\.startsWith\(["']\/blog\/["']\)[\s\S]*?status:\s*410/);
  assert.match(worker, /pathname\s*===\s*["']\/index\.html["']/);
  assert.match(worker, /pathname\.endsWith\(["']\.html["']\)/);
  assert.deepEqual([...worker.matchAll(/SUPPORTED_LANGS\s*=\s*\[([^\]]+)\]/g)].length, 1);
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
