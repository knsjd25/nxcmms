# Five-Language Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete consistent English, Chinese, Spanish, French and German behavior across every current formal Mini-Tools.uk route without restoring deleted tools or changing protected tool logic.

**Architecture:** Extend the existing `site-i18n.js` runtime and each page's `window.PAGE_TRANSLATIONS` dictionary. Keep `_worker.js` server rendering aligned with the browser runtime and enforce behavior with the existing Node contract suite plus browser smoke tests.

**Tech Stack:** Static HTML/CSS/JavaScript, Cloudflare Worker JavaScript, Node test runner, PowerShell, in-app browser.

---

### Task 1: Add Failing Full-Site Language Contracts

**Files:**
- Modify: `tests/site-contract.test.mjs`

- [ ] Add assertions for URL, saved language, browser language and English fallback ownership in `site-i18n.js`.
- [ ] Add all five language checks for the current 22 formal routes.
- [ ] Add regression assertions for the named static and dynamic mixed-language strings.
- [ ] Add route assertions for `/game`, `/json2`, `/unit`, `/word`, `/blog` and sitemap exclusion.
- [ ] Run the Node suite and confirm the new assertions fail for the missing behavior.

### Task 2: Complete Shared Runtime And Worker Routing

**Files:**
- Modify: `site-i18n.js`
- Modify: `_worker.js`
- Test: `tests/site-contract.test.mjs`

- [ ] Implement URL -> saved language -> browser language -> English resolution in the shared runtime.
- [ ] Persist valid language selections and ensure invalid URL values resolve to English.
- [ ] Keep every internal site link on the current language while excluding mailto, tel, hashes and APIs.
- [ ] Add explicit retired-route handling without changing `/blog` or existing redirects.
- [ ] Run the focused contracts until green.

### Task 3: Fix Finance Dynamic Translation Regressions

**Files:**
- Modify as required: `tax.html`, `vat.html`, `mortgage.html`, `ir35.html`, `dividend.html`, `stamp-duty.html`
- Test: `tests/site-contract.test.mjs`

- [ ] Add failing assertions for region, mode, period, range connector, disclaimer, buyer/surcharge/rate descriptions and monthly-equivalent labels.
- [ ] Route every displayed internal enum through the page dictionary.
- [ ] Remove development headings and prevent duplicate English SEO blocks on non-English output.
- [ ] Preserve formulas, rates, thresholds and result meanings.
- [ ] Run finance contracts until green.

### Task 4: Fix Utility And Developer Dynamic Translation Regressions

**Files:**
- Modify as required: `working-days.html`, `fuel.html`, `weight.html`, `token.html`, `json.html`, `diff.html`, `password.html`, `qr.html`
- Test: `tests/site-contract.test.mjs`

- [ ] Add failing assertions for region names, trip labels, units written as words, counts, input/output labels, hints, copy/error states and related tools.
- [ ] Add the minimum dictionary keys and dynamic mappings needed for all five languages.
- [ ] Keep algorithms, generated values and copy behavior unchanged.
- [ ] Run utility/developer contracts until green.

### Task 5: Fix Image, PDF, Color And Upload Translation Regressions

**Files:**
- Modify as required: `image.html`, `pdf2img.html`, `color-picker.html`, `upload.html`
- Test: `tests/site-contract.test.mjs`

- [ ] Add failing assertions for file-selection, processing, download, conversion, copy and error states.
- [ ] Translate visible states and related tools through existing dictionaries.
- [ ] Ensure non-English output does not contain a second hard-coded English guidance block.
- [ ] Preserve upload URL, captcha, FormData fields, storage, logs, reset and output behavior.
- [ ] Run image/upload contracts until green.

### Task 6: Complete Homepage And Informational Pages

**Files:**
- Modify as required: `index.html`, `about.html`, `contact.html`, `privacy.html`
- Test: `tests/site-contract.test.mjs`

- [ ] Verify the same current template and tool inventory render for all five languages.
- [ ] Fill missing body, metadata, FAQ and internal-link translations.
- [ ] Ensure no duplicate English site introduction appears on non-English About pages.
- [ ] Run informational-page contracts until green.

### Task 7: Sitemap, Static Audit And Browser Matrix

**Files:**
- Modify: `sitemap.xml`
- Modify: `tests/site-contract.test.mjs`
- Modify only failing public pages discovered by verification.

- [ ] Run the complete Node contract suite with the bundled Node executable.
- [ ] Run scans for `Original notes`, `漏 2026`, Blog links, duplicate language menus and hard-coded current-language labels.
- [ ] Start the local server and verify all 22 current formal routes in five languages return 200.
- [ ] Browser-smoke-test representative dynamic tools and responsive layouts without sending an upload.
- [ ] Run `git diff --check`, `git diff` and `git status --short`.
- [ ] Do not commit, push or deploy.
