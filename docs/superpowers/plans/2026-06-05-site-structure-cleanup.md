# Mini-Tools.uk Site Structure Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mini-Tools.uk a consistent tool directory, remove the Blog, Terms, and Acceptable Use systems, and enforce the requested public URL and indexing policy.

**Architecture:** Keep the existing static HTML tools and Cloudflare Pages Worker. Standardize public navigation and footer markup in each page, use the Worker for clean URL redirects and removed-route responses, and verify the result with a Node built-in test suite.

**Tech Stack:** Static HTML/CSS/JavaScript, Cloudflare Pages Worker, Node.js built-in test runner.

---

### Task 1: Add the site contract test

**Files:**
- Create: `tests/site-contract.test.mjs`

- [ ] Add tests for navigation, footer, removed links, content coverage, redirects, sitemap, robots, canonical language behavior, and thin-page noindex policy.
- [ ] Run `node --test tests/site-contract.test.mjs` and confirm the existing site fails the new contract.

### Task 2: Standardize public pages

**Files:**
- Modify: `index.html`
- Modify: `about.html`
- Modify: `upload.html`
- Modify: `tax.html`
- Modify: `contact.html`
- Modify: `privacy.html`
- Modify: remaining public `*.html` tool pages

- [ ] Replace old navigation with Home, Search, Popular, UK Apps, Dev Tools, Other, About, Contact, and Privacy.
- [ ] Replace old footers with Home, About, Contact, and Privacy.
- [ ] Remove Blog, Terms, Acceptable Use, old category entry points, and Featured/Main/Primary Tool wording.
- [ ] Rewrite About around the three requested categories.
- [ ] Preserve the required Upload, Tax, Contact, and Privacy content.
- [ ] Add `noindex,follow` to thin tool pages.

### Task 3: Enforce routing and indexing policy

**Files:**
- Modify: `_worker.js`
- Modify: `sitemap.xml`
- Modify: `robots.txt`

- [ ] Redirect `.html` URLs to clean URLs.
- [ ] Redirect `/terms` and `/acceptable-use` to `/privacy`.
- [ ] Return 410 for `/blog` and `/blog/*`.
- [ ] Restrict the first sitemap to the six approved complete pages.
- [ ] Simplify robots.txt to allow crawling and point to the sitemap.

### Task 4: Verify the complete site contract

**Files:**
- Test: `tests/site-contract.test.mjs`

- [ ] Run `node --test tests/site-contract.test.mjs`.
- [ ] Run a repository-wide removed-reference scan.
- [ ] Review `git diff --check` and the final changed-file list.
