\# AGENTS.md



\## Project



This repository is for mini-tools.uk, a multilingual online tools website.



The site contains UK finance calculators, developer tools, image/PDF tools, upload/image hosting, and everyday utility tools.



\## Highest priority rule



Use the smallest safe change that solves the user's current request.



Do not rewrite, refactor, redesign, or modify unrelated files unless the user explicitly asks for a full-site change.



If the task is about one page, only modify that page and truly necessary shared files.



If the task is review-only, do not modify files.



\## Required skill



When reviewing, modifying, SEO-optimizing, or standardizing any mini-tools.uk page, use this skill:



mini-tools-site-unified-review



\## Task classification



Before editing, classify the task as one of:



1\. Single bug fix

2\. Single page optimization

3\. Full-site standardization

4\. Review only



Rules:



\* Single bug fix: only modify the minimum necessary file or code block.

\* Single page optimization: only modify that page and necessary shared components.

\* Full-site standardization: only allowed when the user explicitly asks for all-site changes.

\* Review only: do not edit files.



\## Do not modify without explicit permission



Do not change:



\* Upload API URL

\* Cloudflare Worker request logic

\* R2 logic

\* KV logic

\* Captcha fetch logic

\* Captcha verification logic

\* FormData field names

\* Existing calculator formulas

\* Existing working tool logic

\* AdSense script

\* Google Analytics script

\* \[yuyananuu@gmail.com](mailto:yuyananuu@gmail.com)

\* Public URL paths

\* Working download/export/copy logic

\* Existing route names



Do not add:



\* Blog links

\* Blog navigation

\* Blog footer links

\* Blog sitemap entries

\* New dependencies

\* New frameworks

\* React

\* Vue

\* Next.js

\* TypeScript conversion

\* Tailwind

\* Bootstrap

\* jQuery

\* Uploaded image URLs in sitemap

\* Upload result pages in sitemap

\* API endpoints in sitemap

\* Temporary files in sitemap



Do not restore Blog functionality.



\## Protected /upload functionality



For `/upload`, preserve:



\* WORKER\_URL

\* File selection

\* Image preview

\* 5 MB file limit

\* Retention period selection

\* Long-term storage code input

\* Captcha fetch

\* Captcha refresh

\* Captcha answer input

\* Upload POST request

\* FormData field names

\* Upload success log

\* Upload error log

\* Direct URL output

\* Markdown output

\* HTML output

\* BBCode output

\* Copy buttons

\* Upload reset behavior



Do not change upload behavior unless the user explicitly asks.



\## Protected finance calculator functionality



For finance pages, preserve existing calculation behavior unless the user explicitly asks to update formulas.



Finance pages include:



\* /tax

\* /vat

\* /mortgage

\* /ir35

\* /stamp-duty

\* /dividend



Allowed without explicit permission:



\* Add disclaimers

\* Add sources

\* Add assumptions

\* Improve labels

\* Improve SEO text

\* Improve language switching

\* Improve layout



Not allowed without explicit permission:



\* Change formula logic

\* Change thresholds

\* Change tax rates

\* Change output meanings



\## Blog rule



The project direction is to remove Blog from the public site.



Do not add Blog back to:



\* Navigation

\* Footer

\* Homepage

\* Related tools

\* Sitemap

\* Internal links



If Blog URLs still exist, report them and recommend redirect or removal.



\## Known live issues that must be considered



When working on mini-tools.uk, check whether the task relates to these known live issues:



\* Homepage language switching may not affect the full page body.

\* Upload page language switching may not affect the full page body.

\* Upload page may contain "Original notes for Free Image Hosting".

\* Image page may contain mixed German, Spanish, English, and Chinese leftovers.

\* Password page may contain duplicated "Original notes".

\* Tax page may contain "Original notes for UK Tax Calculator".

\* Related tools may include irrelevant links.

\* Blog may still be live.

\* sitemap.xml or robots.txt may fail or include wrong URLs.

\* Footer may use the © symbol and risk encoding errors.

\* Some pages may use old navigation or old footer styles.



\## Required final report



After editing files, report:



\* Files changed

\* What changed in each file

\* Why each file changed

\* What was protected and not changed

\* Tool logic preserved

\* Manual browser tests required



If no files were changed, clearly say that no files were changed.



\## Git discipline



Do not commit.



Do not push.



Do not deploy.



After changes, recommend checking:



```bash

git diff

git status

```



If unrelated files changed, revert unrelated changes before finishing.



