# Shared Site I18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace copied site-wide language behavior with one shared runtime and verify complete five-language switching across all formal Mini-Tools.uk pages.

**Architecture:** Public pages retain their page-specific translation dictionaries so tool code and Worker server rendering remain stable. A new `site-i18n.js` owns language normalization, the language menu, URL state, navigation, footer, generic attribute translation, internal links, canonical, hreflang, and calls into page-specific translation hooks for dynamic tool states.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Cloudflare Worker JavaScript, PowerShell generation script, Node test runner, Chrome headless browser checks.

---

### Task 1: Add Shared-Runtime Contracts

**Files:**
- Modify: `tests/site-contract.test.mjs`
- Modify: `tests/site-contract.ps1`

- [ ] Assert every formal page loads `site-i18n.js` exactly once.
- [ ] Assert no page contains the copied `site-nav-language` script.
- [ ] Assert every page exposes all five language choices and one identical navigation/footer.
- [ ] Assert the shared runtime owns in-place URL updates, menu click behavior, canonical/hreflang, generic `data-i18n` attributes, placeholders, ARIA labels, and internal-link localization.
- [ ] Run the tests and confirm they fail because `site-i18n.js` does not exist and pages still contain copied scripts.

### Task 2: Create The Shared Browser Runtime

**Files:**
- Create: `site-i18n.js`
- Modify: `scripts/standardize-pages.ps1`
- Modify: all 22 formal public HTML files through the generator

- [ ] Move common navigation, footer, language-menu, URL, canonical, hreflang, generic translation, related guidance and link-localization behavior into `site-i18n.js`.
- [ ] Define one public API: `window.MiniToolsI18n.setLanguage(lang)` and `window.MiniToolsI18n.getLanguage()`.
- [ ] Make the runtime call `window.applyLanguage(lang, false)` where a page has a legacy dynamic hook.
- [ ] Remove copied `site-nav-language` scripts and insert one relative `<script src="site-i18n.js"></script>` before `</body>`.
- [ ] Regenerate all formal pages and run shared-runtime contracts until green.

### Task 3: Standardize Page Dictionary Access And Worker Rendering

**Files:**
- Modify: `_worker.js`
- Modify: public HTML page dictionaries where required
- Modify: `tests/site-contract.test.mjs`

- [ ] Support both `const translations` and `const i18n` dictionaries in Worker server rendering.
- [ ] Expose existing dictionaries as `window.PAGE_TRANSLATIONS` without changing their existing local variable names.
- [ ] Verify direct requests for `?lang=zh-CN`, `de`, `fr`, and `es` return translated title, description, H1 and representative body text.
- [ ] Verify `.html` clean-path redirects, Blog 410, and static sitemap/robots behavior remain unchanged.

### Task 4: Fill Translation Coverage Gaps

**Files:**
- Modify: `password.html`
- Modify: `color-picker.html`
- Modify: `index.html`
- Modify: other public pages only when contract/browser checks identify missing keys

- [ ] Add complete five-language dictionaries for visible page text, metadata, buttons, labels, placeholders, FAQ, results, errors, success states and schema.
- [ ] Mark translatable elements consistently with `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`, or explicit page hooks for dynamic text.
- [ ] Remove mixed-language and untranslated template blocks found by the audits.
- [ ] Add regression assertions for representative translated content on every page.

### Task 5: Complete Site Structure And SEO Audit

**Files:**
- Modify only files failing the audit: public HTML, `_worker.js`, `sitemap.xml`, `robots.txt`, or generator/tests

- [ ] Verify Blog links and files are absent and `/blog` returns 410.
- [ ] Verify `.html` URLs return 301 to clean paths.
- [ ] Verify `/currency` and `/pdf` do not expose unrelated legacy pages.
- [ ] Verify sitemap includes only the 22 formal clean URLs and robots references it.
- [ ] Verify one H1, non-empty title/description, canonical, complete hreflang, valid schema, image alt text and form labels.
- [ ] Remove `Original notes`, mojibake, old navigation/footer text and duplicate FAQ/related sections.

### Task 6: Responsive And Functional Verification

**Files:**
- Create temporary browser audit files under `tests/`, then delete them

- [ ] Run Chrome checks at 390, 768, 1024, 1366 and 1920 pixels.
- [ ] Check `/`, `/upload`, `/tax`, `/vat`, `/image`, `/json`, `/password`, `/privacy`, and `/ir35` in all five languages.
- [ ] Verify language clicks update visible body/meta/footer/schema, keep scroll position, preserve current path, and do not duplicate event handlers.
- [ ] Verify no horizontal overflow, navigation collision, FAQ overflow, footer escape, or upload-area overflow.
- [ ] Smoke test calculators, JSON, password generation, image tool controls, and upload UI without sending an upload.
- [ ] Verify protected upload URL, captcha calls, FormData fields, Worker/R2/KV logic, formulas, AdSense, Analytics, email, copy/export/download logic remain unchanged.
- [ ] Run `git diff --check`, `git diff`, and `git status --short`; do not commit, push, or deploy.
