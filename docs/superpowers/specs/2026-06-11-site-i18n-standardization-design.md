# Mini-Tools.uk Shared I18n Standardization Design

## Scope

This is a full-site standardization. It covers the 22 formal public pages, clean URL routing, shared navigation and footer, five-language switching, metadata, structured data, content leftovers, sitemap, robots, and responsive verification.

It does not change calculator formulas, upload requests, captcha behavior, FormData field names, Cloudflare R2/KV behavior, AdSense, Analytics, email addresses, download/export/copy behavior, or public route names.

## Architecture

Use a shared browser runtime in `site-i18n.js` for language detection, URL parameter handling, navigation, footer, metadata, schema, common UI states, internal-link localization, canonical and hreflang updates. Every public page loads this file exactly once.

Page-specific dictionaries remain declarative data owned by each page until they can be safely consolidated without changing tool code. The shared runtime consumes the same data contract on every page. This avoids one giant translation file becoming coupled to every calculator while still removing duplicated language-switching behavior.

The Cloudflare Worker continues to server-render language-specific HTML. Its protected route and asset behavior remains intact. Shared browser behavior must agree with Worker language normalization so direct requests and client-side switching produce the same language.

## Shared Layout

All public pages use byte-identical navigation and footer markup. `site-nav.css` is the only navigation stylesheet. The language selector has no triangle. The footer copyright is `Copyright 2026 Mini-Tools.uk`.

At desktop widths, English navigation stays on one row where space permits. At narrower widths, the shared responsive layout wraps or stacks without overlap or horizontal scrolling.

## Language Behavior

Supported values are `en`, `zh-CN`, `de`, `fr`, and `es`. The URL `lang` parameter has priority, followed by the browser language, then English. Clicking a language updates the current URL in place without jumping to the top.

The runtime updates document language, title, descriptions, headings, body copy, labels, buttons, placeholders, options, FAQ, result labels, messages, schema, navigation, footer, alt text, and relevant ARIA labels when translation data exists. Contract tests fail when required translation keys are missing.

## Routing And SEO

The Worker keeps `.html` to clean-path 301 redirects, `/blog` and descendants return 410, and retired policy URLs redirect to `/privacy`. Sitemap contains only formal clean paths. Robots references the sitemap.

Canonical and hreflang entries are generated consistently for the current route and supported languages. Parameter and temporary pages are excluded from sitemap.

## Verification

Automated contracts cover shared asset counts, identical navigation/footer, language dictionaries, development leftovers, protected upload tokens, finance source sections, clean redirects, Blog retirement, sitemap, and robots.

Browser checks cover key pages in all five languages at 390, 768, 1024, 1366, and 1920 pixels. Checks include overflow, navigation, footer, translated visible content, click switching without scroll reset, FAQ layout, and critical tool smoke tests.

No commit, push, or deployment is performed.

## 2026-06-14 Addendum

The follow-up full-site pass extends the same architecture rather than replacing it. Language resolution is standardized to URL parameter, saved language, browser language, then English. Invalid URL language values fall back to English. The shared runtime remains the only owner of language resolution, navigation/footer labels, internal-link language retention, canonical/hreflang updates and common translated states.

The formal route set remains the current public site and does not restore previously deleted tools. Retired `/game`, `/json2`, `/unit` and `/word` routes must not expose old English templates; their final redirect or 410 behavior is enforced in the Worker and excluded from sitemap.

Page-specific dictionaries continue to own tool text and dynamic result labels. Tests cover the named mixed-language regressions for finance, developer, image/PDF and utility pages before implementation changes. Calculator formulas, tax thresholds, upload API/storage/captcha/FormData behavior, working download/export/copy logic, AdSense, Analytics and the public email remain protected.

The footer keeps the repository's current `Copyright 2026 Mini-Tools.uk` text. The request to use the copyright symbol was explicitly superseded by the user on 14 June 2026.
