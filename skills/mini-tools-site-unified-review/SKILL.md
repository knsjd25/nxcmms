\---



name: mini-tools-site-unified-review

description: Use this skill when reviewing, modifying, SEO-optimizing, or standardizing any mini-tools.uk page. It covers unified navigation, footer, five-language switching, SEO, AdSense low-value-content cleanup, sitemap, canonical, hreflang, upload page safety, finance page sources, and protection of existing tool functionality.

\---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------



\# Mini-Tools.uk Site Standardization Skill



\## Purpose



Use this skill for mini-tools.uk only.



The goal is to keep the site consistent, useful, multilingual, SEO-safe, and safer for AdSense review while preserving all existing tool functionality.



\## Core principles



1\. Preserve working tool functions.

2\. Use the smallest safe change.

3\. Do not create unrelated changes.

4\. Do not add Blog back.

5\. Do not create thin or duplicated content.

6\. Do not leave mixed-language content.

7\. Do not leave development leftovers.

8\. Do not break upload, calculator, converter, export, copy, or download behavior.



\## Supported languages



Every public page should support:



\* English: en

\* Chinese: zh-CN

\* German: de

\* French: fr

\* Spanish: es



\## Five-language switching requirements



Language switching must cover all visible and metadata text:



\* html lang

\* document title

\* meta description

\* og:title

\* og:description

\* canonical

\* hreflang

\* schema JSON

\* navigation

\* footer

\* H1

\* H2

\* H3

\* body text

\* tool descriptions

\* labels

\* buttons

\* placeholders

\* select options

\* result titles

\* result descriptions

\* success messages

\* error messages

\* validation messages

\* copy button text

\* copied state text

\* upload logs

\* captcha labels

\* examples

\* limitations

\* FAQ

\* related tools

\* image alt text

\* aria-label values that affect users



Do not count a page as translated if only the navigation changes.



Do not leave large English sections on Chinese, German, French, or Spanish pages.



Do not leave German, French, Spanish, or Chinese headings on English pages.



\## Unified navigation



Every public page must use the same navigation style as the homepage.



Required navigation items:



\* Home

\* Search

\* Popular

\* UK Apps

\* Dev Tools

\* Other

\* About

\* Contact

\* Privacy

\* Language selector



Rules:



1\. Navigation must be visually consistent across all pages.

2\. Language selector must be visually consistent across all pages.

3\. Current standard: language button has no triangle arrow.

4\. If triangle arrow is added later, it must be added to every page.

5\. Do not use page-specific navigation patches.

6\. Do not use upload-only navigation CSS.

7\. Do not use old Blog navigation.

8\. Internal links must preserve the current language parameter.

9\. Do not append language parameters to mailto, tel, or hash-only links.

10\. Mobile navigation must not cover content or create horizontal overflow.



\## Unified footer



Every public page must use the same footer.



Footer text must use:



```text

Copyright 2026 Mini-Tools.uk

```



Do not use the © symbol.



Footer links:



\* Home

\* About

\* Contact

\* Privacy

\* \[yuyananuu@gmail.com](mailto:yuyananuu@gmail.com)



Rules:



1\. Footer must not float outside the layout.

2\. Footer must not overlap content.

3\. Footer must not use old footer styles.

4\. Footer must not contain Blog.

5\. Footer must work on mobile.

6\. Footer must be translated when language switching is active.



\## SEO requirements



Every public page must have:



1\. Unique title.

2\. Unique meta description.

3\. One clear H1.

4\. Correct canonical.

5\. Complete hreflang.

6\. Useful visible text beyond the tool UI.

7\. FAQ that matches the actual page.

8\. Relevant related tools.

9\. Valid schema JSON.

10\. Natural wording.

11\. No keyword stuffing.

12\. No development leftovers.

13\. No duplicated generic FAQ across unrelated pages.



Recommended page structure:



1\. Hero introduction.

2\. Tool interface.

3\. How to use.

4\. Use cases.

5\. Notes, limitations, privacy, or assumptions.

6\. Related tools.

7\. FAQ.



\## Canonical rules



English page canonical should normally point to the clean page path.



Example:



```html

<link rel="canonical" href="https://mini-tools.uk/upload" />

```



Non-English page state may point to the language URL.



Example:



```html

<link rel="canonical" href="https://mini-tools.uk/upload?lang=zh-CN" />

```



\## Hreflang rules



Every public page should include hreflang entries for:



\* en

\* zh-CN

\* de

\* fr

\* es

\* x-default



Each hreflang URL must use the current page path.



Do not generate hreflang for pages that should not be indexed.



\## Sitemap rules



sitemap.xml should include only formal public pages.



Allowed public pages:



\* /

\* /tax

\* /vat

\* /mortgage

\* /ir35

\* /stamp-duty

\* /dividend

\* /json

\* /diff

\* /token

\* /qr

\* /password

\* /upload

\* /image

\* /pdf2img

\* /color-picker

\* /working-days

\* /fuel

\* /weight

\* /about

\* /contact

\* /privacy



Do not include:



\* /blog

\* /blog/tag

\* /blog/article

\* uploaded image URLs

\* upload result pages

\* temporary resource pages

\* search parameter pages

\* API URLs

\* test pages

\* empty pages

\* admin pages



\## Blog rule



Blog is not part of the current site direction.



Do not link to Blog.



Do not include Blog in sitemap.



Do not restore Blog navigation.



If Blog pages still exist, report them and recommend redirect or 410 handling.



\## Finance page requirements



Finance pages:



\* /tax

\* /vat

\* /mortgage

\* /ir35

\* /stamp-duty

\* /dividend



Each finance page should include a Sources and assumptions section.



It should explain:



1\. Results are estimates.

2\. It is not tax, legal, financial, or accounting advice.

3\. Tax year or update date.

4\. Important assumptions.

5\. Relevant GOV.UK source links.



Do not claim professional accuracy beyond what the calculator provides.



Do not change calculation logic unless the user explicitly asks.



\## Upload page requirements



The /upload page must explain that image hosting sends the selected image to a server to create a hosted link.



The page should include:



1\. Upload purpose.

2\. File size limit.

3\. Retention options.

4\. Long-term storage code explanation.

5\. Preview before upload.

6\. Direct URL output.

7\. Markdown output.

8\. HTML output.

9\. BBCode output.

10\. Upload rules.

11\. Prohibited content.

12\. Privacy note.

13\. Removal and abuse reporting.

14\. FAQ.

15\. Related tools.



The page must warn users not to upload:



\* ID documents

\* Passports

\* Bank cards

\* Financial documents

\* Private screenshots

\* Confidential work files

\* Illegal content

\* Adult or sexually explicit content

\* Copyright-infringing content

\* Hateful content

\* Violent content

\* Abusive content

\* Exploitative content

\* Phishing content

\* Scam content

\* Malware-related content



Removal and abuse contact:



```text

yuyananuu@gmail.com

```



Do not change upload API logic unless explicitly requested.



\## Development leftovers to remove



No public page should contain:



\* Original notes

\* Original notes for Free Image Hosting

\* Original notes for Image Compressor

\* Original notes for Password Generator

\* Original notes for UK Tax Calculator

\* TODO

\* FIXME

\* test text

\* placeholder text

\* lorem ipsum

\* duplicated old guidance blocks

\* old Blog links

\* mixed-language leftovers



\## Known live-site checks



When editing or reviewing the site, verify these known risk areas:



1\. Homepage language switching.

2\. Upload page language switching.

3\. Image page mixed language content.

4\. Password page duplicated notes.

5\. Tax page old notes and irrelevant related tools.

6\. Blog still accessible.

7\. sitemap.xml accessibility.

8\. robots.txt accessibility.

9\. Footer encoding.

10\. Old navigation styles.



\## Visual consistency



Use shared site style:



\* Primary color: #2563eb

\* Max width: about 1180px

\* White cards

\* Light borders

\* Rounded corners

\* Consistent shadows

\* System font stack

\* Stable responsive layout



Do not introduce a separate visual system for one page.



Do not add temporary page-specific CSS patches when a shared component should be used.



\## Responsive requirements



Check common widths:



\* 390px

\* 430px

\* 768px

\* 1024px

\* 1366px

\* 1440px

\* 1920px



Expected:



1\. No horizontal overflow.

2\. Navigation remains usable.

3\. Language menu remains visible.

4\. Tool interface remains usable.

5\. FAQ cards do not overflow.

6\. Footer remains inside layout.

7\. Buttons and inputs remain clickable.



\## Required verification URLs



For site-wide or standardization tasks, verify:



\* /

\* /?lang=zh-CN

\* /upload

\* /upload?lang=zh-CN

\* /image

\* /image?lang=zh-CN

\* /password

\* /password?lang=zh-CN

\* /tax

\* /tax?lang=zh-CN

\* /blog

\* /sitemap.xml

\* /robots.txt



Expected:



1\. Non-English URLs must not remain mostly English.

2\. English URLs must not contain German, French, Spanish, or Chinese leftovers.

3\. No page should contain Original notes.

4\. No page should contain 漏 2026.

5\. Blog should not be linked from the public tool site.

6\. sitemap.xml and robots.txt should load normally.



\## Verification before finishing



Before final response, check:



1\. Page loads.

2\. JavaScript has no obvious syntax errors.

3\. Tool function still works.

4\. Navigation matches the shared navigation.

5\. Footer matches the shared footer.

6\. Language selector works.

7\. Main body text switches language.

8\. Meta title and meta description are correct.

9\. FAQ layout does not break.

10\. Related links work.

11\. Canonical is correct.

12\. Hreflang is correct.

13\. No development leftovers remain.

14\. No unrelated files were modified.



\## Reporting format



After changes, report:



```text

Files changed:

\- path/to/file: what changed and why



Protected / not changed:

\- Tool core logic

\- API endpoints

\- AdSense

\- Analytics

\- Email address

\- Unrelated pages



Manual checks recommended:

\- Pages to open

\- Languages to test

\- Tool functions to test

```



If the task is review-only, do not edit files. Report issues by risk level and affected page.



