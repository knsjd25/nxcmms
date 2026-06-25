param(
  [string]$Owner = "yilunfan155-maker",
  [string[]]$OnlyRepo = @()
)

$ErrorActionPreference = "Stop"

$Token = [Environment]::GetEnvironmentVariable("GH_TOKEN", "User")
if (-not $Token) {
  throw "GH_TOKEN is not set in the user environment."
}

$Headers = @{
  Authorization          = "Bearer $Token"
  Accept                 = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent"           = "codex-github-content"
}

function Invoke-GitHubJson {
  param(
    [string]$Method,
    [string]$Path,
    $Body = $null
  )

  $uri = "https://api.github.com/$Path"
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers
  }

  $json = $Body | ConvertTo-Json -Depth 50 -Compress
  return Invoke-RestMethod `
    -Method $Method `
    -Uri $uri `
    -Headers $Headers `
    -ContentType "application/json; charset=utf-8" `
    -Body $json
}

function Test-RepoExists {
  param([string]$Repo)

  try {
    Invoke-GitHubJson GET "repos/$Owner/$Repo" | Out-Null
    return $true
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
      return $false
    }
    throw
  }
}

function Ensure-Repo {
  param($Feature)

  if (Test-RepoExists $Feature.repo) {
    return Invoke-GitHubJson GET "repos/$Owner/$($Feature.repo)"
  }

  return Invoke-GitHubJson POST "user/repos" @{
    name         = $Feature.repo
    description  = $Feature.description
    private      = $false
    auto_init    = $false
    has_issues   = $true
    has_projects = $false
    has_wiki     = $false
  }
}

function New-Blob {
  param(
    [string]$Repo,
    [string]$Content
  )

  return Invoke-GitHubJson POST "repos/$Owner/$Repo/git/blobs" @{
    content  = $Content
    encoding = "utf-8"
  }
}

function New-LanguageDoc {
  param($Feature, $Language)

  return @"
# $($Language.freePhrase): $($Feature.title)

$($Language.guidePhrase) $($Feature.title). Mini-Tools provides this browser-based tool at:

- Tool: $($Feature.url)
- Output / result: $($Feature.output)
- Main use cases: $($Feature.useCases)

## How to use

1. Open $($Feature.url)
2. Use the tool in your browser.
3. Copy or download the result when the page provides an output.
4. Use the result in documents, README files, websites, posts, support tickets, or daily work.

## $($Language.searchPhrase)

$($Feature.keywords), $($Language.localSearchPrefix) $($Feature.shortName), $($Language.localSearchPrefix) online tool, Mini-Tools $($Feature.shortName)

## Long-tail keywords

$($Feature.longTailKeywords)

## Note

$($Language.note)
"@
}

function Publish-FeatureRepo {
  param($Feature, $Languages)

  $repoInfo = Ensure-Repo $Feature
  $branch = if ($repoInfo.default_branch) { $repoInfo.default_branch } else { "main" }

  try {
    $ref = Invoke-GitHubJson GET "repos/$Owner/$($Feature.repo)/git/ref/heads/$branch"
    $baseCommitSha = $ref.object.sha
    $baseCommit = Invoke-GitHubJson GET "repos/$Owner/$($Feature.repo)/git/commits/$baseCommitSha"
    $baseTreeSha = $baseCommit.tree.sha
    $parents = @($baseCommitSha)
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 409 -and $_.Exception.Response.StatusCode.value__ -ne 404) {
      throw
    }
    $initReadme = "# $($Feature.title)`n"
    Invoke-GitHubJson PUT "repos/$Owner/$($Feature.repo)/contents/README.md" @{
      message = "Initialize repository"
      content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($initReadme))
    } | Out-Null
    Start-Sleep -Seconds 2
    $repoInfo = Invoke-GitHubJson GET "repos/$Owner/$($Feature.repo)"
    $branch = if ($repoInfo.default_branch) { $repoInfo.default_branch } else { "main" }
    $ref = Invoke-GitHubJson GET "repos/$Owner/$($Feature.repo)/git/ref/heads/$branch"
    $baseCommitSha = $ref.object.sha
    $baseCommit = Invoke-GitHubJson GET "repos/$Owner/$($Feature.repo)/git/commits/$baseCommitSha"
    $baseTreeSha = $baseCommit.tree.sha
    $parents = @($baseCommitSha)
  }

  $tree = New-Object System.Collections.Generic.List[object]

  foreach ($lang in $Languages) {
    $doc = New-LanguageDoc $Feature $lang
    $blob = New-Blob $Feature.repo $doc
    $tree.Add(@{
      path = "docs/$($lang.code).md"
      mode = "100644"
      type = "blob"
      sha  = $blob.sha
    }) | Out-Null
  }

  $indexLines = New-Object System.Collections.Generic.List[string]
  $indexLines.Add("# $($Feature.title) in 50+ Languages") | Out-Null
  $indexLines.Add("") | Out-Null
  $indexLines.Add("Localized Markdown pages for $($Feature.title).") | Out-Null
  $indexLines.Add("") | Out-Null
  $indexLines.Add("- Tool: $($Feature.url)") | Out-Null
  $indexLines.Add("") | Out-Null
  $indexLines.Add("## Languages") | Out-Null
  $indexLines.Add("") | Out-Null
  foreach ($lang in $Languages) {
    $indexLines.Add("- [$($lang.name)]($($lang.code).md)") | Out-Null
  }
  $index = ($indexLines -join "`n") + "`n"
  $indexBlob = New-Blob $Feature.repo $index
  $tree.Add(@{
    path = "docs/index.md"
    mode = "100644"
    type = "blob"
    sha  = $indexBlob.sha
  }) | Out-Null

  $readme = @"
# $($Feature.title)

$($Feature.description)

- Tool: $($Feature.url)
- Main feature: $($Feature.shortName)
- Output / result: $($Feature.output)

## Multilingual Markdown Pages

This repository contains 50+ localized Markdown pages for this Mini-Tools feature.

- [View all languages](docs/index.md)

## Related Searches

$($Feature.keywords)

## Long-tail Keywords

$($Feature.longTailKeywords)

## Safety Note

Do not paste private, sensitive, or confidential data into public online tools unless you understand how the tool works and what data is processed.
"@
  $readmeBlob = New-Blob $Feature.repo $readme
  $tree.Add(@{
    path = "README.md"
    mode = "100644"
    type = "blob"
    sha  = $readmeBlob.sha
  }) | Out-Null

  $treeBody = @{
    tree = $tree
  }
  if ($baseTreeSha) {
    $treeBody.base_tree = $baseTreeSha
  }
  $newTree = Invoke-GitHubJson POST "repos/$Owner/$($Feature.repo)/git/trees" $treeBody

  $commit = Invoke-GitHubJson POST "repos/$Owner/$($Feature.repo)/git/commits" @{
    message = "Add multilingual Markdown pages"
    tree    = $newTree.sha
    parents = $parents
  }

  if ($parents.Count -eq 0) {
    Invoke-GitHubJson POST "repos/$Owner/$($Feature.repo)/git/refs" @{
      ref = "refs/heads/$branch"
      sha = $commit.sha
    } | Out-Null
  } else {
    Invoke-GitHubJson PATCH "repos/$Owner/$($Feature.repo)/git/refs/heads/$branch" @{
      sha   = $commit.sha
      force = $false
    } | Out-Null
  }

  Invoke-GitHubJson PUT "repos/$Owner/$($Feature.repo)/topics" @{
    names = $Feature.topics
  } | Out-Null

  return [pscustomobject]@{
    repo      = "https://github.com/$Owner/$($Feature.repo)"
    docsIndex = "https://github.com/$Owner/$($Feature.repo)/blob/$branch/docs/index.md"
    commit    = $commit.sha
    pages     = $Languages.Count
  }
}

$Features = @(
  [pscustomobject]@{
    repo        = "json-formatter-online"
    title       = "JSON Formatter and Validator Online"
    shortName   = "JSON formatter"
    url         = "https://mini-tools.uk/json"
    output      = "beautified JSON, minified JSON, validation result, tree view"
    useCases    = "format JSON, validate JSON, minify JSON, inspect API responses, clean config files"
    keywords    = "JSON formatter, JSON validator, JSON beautifier, JSON minifier, JSON tree viewer, online JSON tool"
    longTailKeywords = "format JSON online free, validate JSON without signup, beautify API response JSON, minify JSON for production, JSON formatter with tree view, online JSON syntax checker, fix invalid JSON formatting, paste JSON and format instantly"
    description = "A browser-based JSON formatter, validator, beautifier, minifier, and tree viewer from Mini-Tools."
    topics      = @("json", "json-formatter", "json-validator", "json-beautifier", "developer-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "qr-code-generator-online"
    title       = "QR Code Generator Online"
    shortName   = "QR code generator"
    url         = "https://mini-tools.uk/qr"
    output      = "QR codes for URL, Wi-Fi, vCard, email, text, and contact sharing"
    useCases    = "create QR codes, share links, encode Wi-Fi details, generate contact QR codes, download QR images"
    keywords    = "QR code generator, free QR code, URL QR code, Wi-Fi QR code, vCard QR code, email QR code"
    longTailKeywords = "create QR code for website link, generate Wi-Fi QR code online, make vCard QR code for contact sharing, free QR code generator without signup, download QR code image, create email QR code, make QR code for business card, generate QR code for URL"
    description = "A browser-based QR code generator for URLs, Wi-Fi, vCard, email, text, and quick sharing from Mini-Tools."
    topics      = @("qr-code", "qr-generator", "wifi-qr", "vcard", "online-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "password-generator-online"
    title       = "Strong Password Generator Online"
    shortName   = "password generator"
    url         = "https://mini-tools.uk/password"
    output      = "random strong passwords with configurable length and character options"
    useCases    = "generate random passwords, create strong passwords, improve account security, make temporary passwords"
    keywords    = "password generator, strong password generator, random password, secure password, online password tool"
    longTailKeywords = "generate strong random password online, create secure password with symbols, random password generator without signup, make temporary password online, password generator with custom length, create password with numbers and special characters, strong password for new account, secure password generator for daily use"
    description = "A browser-based strong password generator for creating random passwords with configurable options from Mini-Tools."
    topics      = @("password-generator", "random-password", "security-tools", "online-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "image-compressor-resizer"
    title       = "Image Compressor, Resizer, and WebP Converter"
    shortName   = "image compressor and resizer"
    url         = "https://mini-tools.uk/image"
    output      = "compressed images, resized images, WebP conversion, optimized image files"
    useCases    = "compress images, resize images, convert to WebP, reduce image file size, optimize images for websites"
    keywords    = "image compressor, image resizer, WebP converter, compress image online, resize image online, image optimizer"
    longTailKeywords = "compress image online without installing software, resize image for website upload, convert image to WebP online, reduce JPG file size, reduce PNG file size, optimize images for faster website loading, resize photo to smaller dimensions, free image compressor and resizer"
    description = "A browser-based image compressor, image resizer, and WebP converter from Mini-Tools."
    topics      = @("image-compressor", "image-resizer", "webp-converter", "image-optimizer", "online-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "pdf-to-image-converter"
    title       = "PDF to Image Converter Online"
    shortName   = "PDF to image converter"
    url         = "https://mini-tools.uk/pdf2img"
    output      = "PNG or JPG images converted from PDF pages"
    useCases    = "convert PDF to image, export PDF pages, create PNG from PDF, create JPG from PDF, preview PDF pages"
    keywords    = "PDF to image, PDF to PNG, PDF to JPG, convert PDF pages to images, online PDF converter"
    longTailKeywords = "convert PDF pages to PNG online, convert PDF to JPG without installing software, export PDF page as image, turn PDF into images for sharing, online PDF to image converter, save PDF pages as PNG files, create JPG images from PDF pages, extract PDF pages as images"
    description = "A browser-based PDF to image converter for turning PDF pages into PNG or JPG images from Mini-Tools."
    topics      = @("pdf-to-image", "pdf-to-png", "pdf-to-jpg", "pdf-converter", "online-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "text-diff-checker"
    title       = "Text Diff Checker Online"
    shortName   = "text diff checker"
    url         = "https://mini-tools.uk/diff"
    output      = "side-by-side text differences, changed lines, added text, removed text"
    useCases    = "compare text, review code changes, compare documents, check edits, find differences between two versions"
    keywords    = "text diff checker, compare text online, online diff tool, code diff checker, document comparison tool"
    longTailKeywords = "compare two text files online, find differences between two text blocks, online text comparison without signup, check code changes side by side, compare document versions online, diff checker for copied text, find added and removed lines, free online text diff tool"
    description = "A browser-based text diff checker for comparing code, documents, notes, and copied text from Mini-Tools."
    topics      = @("text-diff", "diff-checker", "compare-text", "code-diff", "developer-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "ai-token-counter"
    title       = "AI Token Counter and API Cost Calculator"
    shortName   = "AI token counter"
    url         = "https://mini-tools.uk/token"
    output      = "estimated token counts and API cost estimates for AI prompts"
    useCases    = "count tokens, estimate AI API cost, compare prompt length, prepare prompts for OpenAI Claude Gemini"
    keywords    = "AI token counter, token counter online, API cost calculator, OpenAI token counter, Claude token counter, Gemini token counter"
    longTailKeywords = "count tokens before sending prompt, estimate OpenAI API cost online, AI prompt token calculator, Claude prompt token counter, Gemini token cost estimator, compare token usage for prompts, calculate chat completion cost, free online token counter for AI"
    description = "A browser-based AI token counter and API cost calculator for estimating prompt length and model usage cost from Mini-Tools."
    topics      = @("token-counter", "ai-tools", "openai", "claude", "gemini", "api-cost", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "color-picker-online"
    title       = "Color Picker Online"
    shortName   = "color picker"
    url         = "https://mini-tools.uk/color-picker"
    output      = "color values, HEX colors, RGB colors, HSL colors, copied color codes"
    useCases    = "pick colors, convert color values, copy HEX RGB HSL, choose website colors, inspect design colors"
    keywords    = "color picker, online color picker, HEX color picker, RGB color picker, HSL color picker, color converter"
    longTailKeywords = "pick color online and copy HEX, convert HEX to RGB online, get HSL value from color, online color picker for website design, choose color for CSS, copy color code for design, free browser color picker, find RGB value from HEX color"
    description = "A browser-based color picker for copying HEX, RGB, and HSL color values from Mini-Tools."
    topics      = @("color-picker", "hex-color", "rgb-color", "hsl-color", "design-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "working-days-calculator"
    title       = "Working Days Calculator Online"
    shortName   = "working days calculator"
    url         = "https://mini-tools.uk/working-days"
    output      = "business day counts, date ranges, working day totals, UK bank holiday awareness"
    useCases    = "count working days, calculate business days, plan deadlines, exclude weekends, check UK bank holidays"
    keywords    = "working days calculator, business days calculator, date calculator, UK bank holidays calculator, workday counter"
    longTailKeywords = "calculate working days between two dates, count business days excluding weekends, working days calculator with UK bank holidays, calculate project deadline working days, count weekdays between dates online, business day counter for UK dates, free working days calculator, date range working day count"
    description = "A browser-based working days calculator for counting business days and planning date ranges from Mini-Tools."
    topics      = @("working-days", "business-days", "date-calculator", "uk-bank-holidays", "productivity-tools", "mini-tools")
  },
  [pscustomobject]@{
    repo        = "uk-income-tax-calculator"
    title       = "UK Income Tax Calculator Online"
    shortName   = "UK income tax calculator"
    url         = "https://mini-tools.uk/tax"
    output      = "estimated UK PAYE income tax, National Insurance, take-home pay, annual and monthly breakdowns"
    useCases    = "estimate UK income tax, calculate PAYE deductions, check take-home pay, compare gross and net salary"
    keywords    = "UK income tax calculator, PAYE calculator, National Insurance calculator, take home pay calculator, UK salary calculator"
    longTailKeywords = "calculate UK take home pay online, estimate PAYE and National Insurance, UK salary after tax calculator, monthly take home pay calculator UK, annual salary tax estimate UK, income tax calculator for employees UK, gross to net salary calculator UK, PAYE tax estimate without signup"
    description = "A browser-based UK income tax calculator for estimating PAYE, National Insurance, and take-home pay from Mini-Tools."
    topics      = @("uk-tax", "income-tax", "paye", "national-insurance", "salary-calculator", "mini-tools")
  }
)

$Languages = @"
en|English|Free online tool|Guide for|Related searches|free online|Do not enter private, sensitive, or confidential data unless you understand how the tool processes it.
ko|Korean|무료 온라인 도구|안내 문서:|관련 검색어|무료 온라인|개인정보나 민감한 데이터는 처리 방식을 이해한 경우에만 입력하세요.
zh-cn|Simplified Chinese|免费在线工具|使用指南：|相关搜索词|免费在线|不要输入隐私、敏感或机密数据，除非你了解该工具如何处理这些数据。
zh-tw|Traditional Chinese|免費線上工具|使用指南：|相關搜尋詞|免費線上|除非了解工具如何處理資料，否則不要輸入私人、敏感或機密資料。
ja|Japanese|無料オンラインツール|ガイド:|関連検索キーワード|無料オンライン|データ処理方法を理解していない場合、個人情報や機密データを入力しないでください。
es|Spanish|Herramienta online gratis|Guía para|Búsquedas relacionadas|gratis online|No introduzcas datos privados, sensibles o confidenciales si no sabes cómo los procesa la herramienta.
fr|French|Outil en ligne gratuit|Guide pour|Recherches associées|gratuit en ligne|N’entrez pas de données privées, sensibles ou confidentielles sans comprendre leur traitement.
de|German|Kostenloses Online-Tool|Anleitung für|Verwandte Suchbegriffe|kostenlos online|Geben Sie keine privaten, sensiblen oder vertraulichen Daten ein, wenn Sie die Verarbeitung nicht verstehen.
it|Italian|Strumento online gratuito|Guida per|Ricerche correlate|gratis online|Non inserire dati privati, sensibili o riservati senza capire come vengono elaborati.
pt|Portuguese|Ferramenta online gratuita|Guia para|Pesquisas relacionadas|grátis online|Não insira dados privados, sensíveis ou confidenciais sem entender como são processados.
ru|Russian|Бесплатный онлайн-инструмент|Руководство для|Связанные запросы|бесплатно онлайн|Не вводите личные, чувствительные или конфиденциальные данные, если не понимаете, как они обрабатываются.
uk|Ukrainian|Безкоштовний онлайн-інструмент|Посібник для|Пов’язані запити|безкоштовно онлайн|Не вводьте приватні, чутливі або конфіденційні дані, якщо не розумієте, як вони обробляються.
pl|Polish|Darmowe narzędzie online|Przewodnik dla|Powiązane wyszukiwania|darmowe online|Nie wprowadzaj danych prywatnych, wrażliwych ani poufnych bez zrozumienia sposobu ich przetwarzania.
nl|Dutch|Gratis online tool|Gids voor|Gerelateerde zoekopdrachten|gratis online|Voer geen privé, gevoelige of vertrouwelijke gegevens in zonder te begrijpen hoe ze worden verwerkt.
sv|Swedish|Gratis onlineverktyg|Guide för|Relaterade sökningar|gratis online|Ange inte privata, känsliga eller konfidentiella data utan att förstå hur de behandlas.
no|Norwegian|Gratis nettverktøy|Veiledning for|Relaterte søk|gratis online|Ikke skriv inn private, sensitive eller konfidensielle data uten å forstå hvordan de behandles.
da|Danish|Gratis onlineværktøj|Guide til|Relaterede søgninger|gratis online|Indtast ikke private, følsomme eller fortrolige data uden at forstå, hvordan de behandles.
fi|Finnish|Ilmainen verkkotyökalu|Opas:|Aiheeseen liittyvät haut|ilmainen online|Älä syötä yksityisiä, arkaluonteisia tai luottamuksellisia tietoja ymmärtämättä käsittelyä.
cs|Czech|Bezplatný online nástroj|Průvodce pro|Související hledání|zdarma online|Nezadávejte soukromá, citlivá ani důvěrná data bez pochopení zpracování.
sk|Slovak|Bezplatný online nástroj|Sprievodca pre|Súvisiace vyhľadávania|zadarmo online|Nezadávajte súkromné, citlivé ani dôverné údaje bez pochopenia spracovania.
hu|Hungarian|Ingyenes online eszköz|Útmutató:|Kapcsolódó keresések|ingyenes online|Ne adjon meg privát, érzékeny vagy bizalmas adatokat a feldolgozás megértése nélkül.
ro|Romanian|Instrument online gratuit|Ghid pentru|Căutări asociate|gratuit online|Nu introduce date private, sensibile sau confidențiale fără să înțelegi procesarea.
bg|Bulgarian|Безплатен онлайн инструмент|Ръководство за|Свързани търсения|безплатно онлайн|Не въвеждайте лични, чувствителни или поверителни данни без да разбирате обработката.
el|Greek|Δωρεάν online εργαλείο|Οδηγός για|Σχετικές αναζητήσεις|δωρεάν online|Μην εισάγετε ιδιωτικά, ευαίσθητα ή εμπιστευτικά δεδομένα χωρίς να κατανοείτε την επεξεργασία.
tr|Turkish|Ücretsiz çevrimiçi araç|Kılavuz:|İlgili aramalar|ücretsiz online|Nasıl işlendiğini anlamadan özel, hassas veya gizli veri girmeyin.
ar|Arabic|أداة مجانية على الإنترنت|دليل لاستخدام|عمليات بحث ذات صلة|مجاني على الإنترنت|لا تُدخل بيانات خاصة أو حساسة أو سرية ما لم تفهم كيفية معالجتها.
he|Hebrew|כלי מקוון חינמי|מדריך עבור|חיפושים קשורים|חינם אונליין|אל תזין נתונים פרטיים, רגישים או חסויים בלי להבין כיצד הם מעובדים.
fa|Persian|ابزار آنلاین رایگان|راهنما برای|جست‌وجوهای مرتبط|رایگان آنلاین|داده‌های خصوصی، حساس یا محرمانه را بدون دانستن نحوه پردازش وارد نکنید.
ur|Urdu|مفت آن لائن ٹول|رہنما برائے|متعلقہ تلاشیں|مفت آن لائن|نجی، حساس یا خفیہ ڈیٹا اس وقت تک داخل نہ کریں جب تک عمل کاری سمجھ نہ لیں۔
hi|Hindi|मुफ्त ऑनलाइन टूल|गाइड:|संबंधित खोजें|मुफ्त ऑनलाइन|प्रोसेसिंग समझे बिना निजी, संवेदनशील या गोपनीय डेटा दर्ज न करें।
bn|Bengali|ফ্রি অনলাইন টুল|গাইড:|সম্পর্কিত অনুসন্ধান|ফ্রি অনলাইন|প্রক্রিয়াকরণ না বুঝে ব্যক্তিগত, সংবেদনশীল বা গোপন ডেটা দেবেন না।
ta|Tamil|இலவச ஆன்லைன் கருவி|வழிகாட்டி:|தொடர்புடைய தேடல்கள்|இலவச ஆன்லைன்|செயலாக்கம் புரியாமல் தனிப்பட்ட, நுணுக்கமான அல்லது ரகசிய தரவை உள்ளிட வேண்டாம்.
te|Telugu|ఉచిత ఆన్‌లైన్ టూల్|గైడ్:|సంబంధిత శోధనలు|ఉచిత ఆన్‌లైన్|ప్రాసెసింగ్ ఎలా జరుగుతుందో తెలియకుండా వ్యక్తిగత లేదా రహస్య డేటాను ఇవ్వవద్దు.
id|Indonesian|Alat online gratis|Panduan untuk|Pencarian terkait|gratis online|Jangan masukkan data pribadi, sensitif, atau rahasia tanpa memahami pemrosesannya.
ms|Malay|Alat dalam talian percuma|Panduan untuk|Carian berkaitan|percuma dalam talian|Jangan masukkan data peribadi, sensitif atau sulit tanpa memahami pemprosesannya.
th|Thai|เครื่องมือออนไลน์ฟรี|คู่มือสำหรับ|คำค้นหาที่เกี่ยวข้อง|ฟรีออนไลน์|อย่าป้อนข้อมูลส่วนตัว อ่อนไหว หรือเป็นความลับหากไม่เข้าใจวิธีประมวลผล.
vi|Vietnamese|Công cụ trực tuyến miễn phí|Hướng dẫn cho|Tìm kiếm liên quan|miễn phí trực tuyến|Không nhập dữ liệu riêng tư, nhạy cảm hoặc bí mật nếu chưa hiểu cách xử lý.
fil|Filipino|Libreng online tool|Gabay para sa|Kaugnay na paghahanap|libreng online|Huwag maglagay ng pribado, sensitibo, o kumpidensyal na datos kung hindi nauunawaan ang pagproseso.
sw|Swahili|Zana ya mtandaoni bila malipo|Mwongozo wa|Utafutaji unaohusiana|bure mtandaoni|Usiweke data ya faragha, nyeti au siri bila kuelewa jinsi inavyochakatwa.
af|Afrikaans|Gratis aanlyn hulpmiddel|Gids vir|Verwante soektogte|gratis aanlyn|Moenie private, sensitiewe of vertroulike data invoer sonder om verwerking te verstaan nie.
sq|Albanian|Mjet online falas|Udhëzues për|Kërkime të lidhura|falas online|Mos futni të dhëna private, të ndjeshme ose konfidenciale pa kuptuar përpunimin.
sr|Serbian|Бесплатан онлајн алат|Водич за|Повезане претраге|бесплатно онлајн|Не уносите приватне, осетљиве или поверљиве податке без разумевања обраде.
hr|Croatian|Besplatan online alat|Vodič za|Povezana pretraživanja|besplatno online|Ne unosite privatne, osjetljive ili povjerljive podatke bez razumijevanja obrade.
sl|Slovenian|Brezplačno spletno orodje|Vodnik za|Sorodna iskanja|brezplačno online|Ne vnašajte zasebnih, občutljivih ali zaupnih podatkov brez razumevanja obdelave.
et|Estonian|Tasuta veebitööriist|Juhend:|Seotud otsingud|tasuta online|Ära sisesta privaatseid, tundlikke ega konfidentsiaalseid andmeid töötlemist mõistmata.
lv|Latvian|Bezmaksas tiešsaistes rīks|Ceļvedis:|Saistītie meklējumi|bezmaksas tiešsaistē|Neievadiet privātus, sensitīvus vai konfidenciālus datus, ja nesaprotat apstrādi.
lt|Lithuanian|Nemokamas internetinis įrankis|Vadovas:|Susijusios paieškos|nemokama internetu|Neveskite privačių, jautrių ar konfidencialių duomenų nesuprasdami apdorojimo.
ga|Irish|Uirlis ar líne saor in aisce|Treoir do|Cuardaigh ghaolmhara|saor in aisce ar líne|Ná cuir isteach sonraí príobháideacha, íogaire nó rúnda gan an phróiseáil a thuiscint.
cy|Welsh|Offeryn ar-lein am ddim|Canllaw ar gyfer|Chwiliadau cysylltiedig|am ddim ar-lein|Peidiwch â rhoi data preifat, sensitif neu gyfrinachol heb ddeall y prosesu.
ka|Georgian|უფასო ონლაინ ხელსაწყო|სახელმძღვანელო:|დაკავშირებული ძიებები|უფასო ონლაინ|არ შეიყვანოთ პირადი, მგრძნობიარე ან კონფიდენციალური მონაცემები დამუშავების გააზრების გარეშე.
hy|Armenian|Անվճար առցանց գործիք|Ուղեցույց՝|Կապված որոնումներ|անվճար առցանց|Մի մուտքագրեք անձնական, զգայուն կամ գաղտնի տվյալներ առանց մշակումը հասկանալու։
az|Azerbaijani|Pulsuz onlayn alət|Bələdçi:|Əlaqəli axtarışlar|pulsuz onlayn|Emalı başa düşmədən şəxsi, həssas və ya məxfi məlumat daxil etməyin.
kk|Kazakh|Тегін онлайн құрал|Нұсқаулық:|Қатысты іздеулер|тегін онлайн|Өңдеу тәсілін түсінбей жеке, сезімтал немесе құпия деректерді енгізбеңіз.
uz|Uzbek|Bepul onlayn vosita|Qo‘llanma:|Tegishli qidiruvlar|bepul onlayn|Qanday ishlanishini tushunmasdan shaxsiy, nozik yoki maxfiy ma’lumot kiritmang.
ne|Nepali|निःशुल्क अनलाइन उपकरण|गाइड:|सम्बन्धित खोजहरू|निःशुल्क अनलाइन|प्रक्रिया नबुझी निजी, संवेदनशील वा गोप्य डेटा प्रविष्ट नगर्नुहोस्।
si|Sinhala|නොමිලේ මාර්ගගත මෙවලම|මාර්ගෝපදේශය:|අදාළ සෙවීම්|නොමිලේ online|සකසන ආකාරය නොදැන පුද්ගලික, සංවේදී හෝ රහසිගත දත්ත ඇතුළත් නොකරන්න.
km|Khmer|ឧបករណ៍អនឡាញឥតគិតថ្លៃ|មគ្គុទ្ទេសក៍សម្រាប់|ពាក្យស្វែងរកពាក់ព័ន្ធ|ឥតគិតថ្លៃអនឡាញ|កុំបញ្ចូលទិន្នន័យឯកជន រសើប ឬសម្ងាត់ ប្រសិនបើមិនយល់ពីការដំណើរការ។
lo|Lao|ເຄື່ອງມືອອນລາຍຟຣີ|ຄູ່ມືສໍາລັບ|ຄໍາຄົ້ນຫາທີ່ກ່ຽວຂ້ອງ|ຟຣີອອນລາຍ|ຢ່າໃສ່ຂໍ້ມູນສ່ວນຕົວ ອ່ອນໄຫວ ຫຼືລັບ ຖ້າບໍ່ເຂົ້າໃຈການປະມວນຜົນ.
my|Burmese|အခမဲ့ အွန်လိုင်းကိရိယာ|လမ်းညွှန်:|ဆက်စပ်ရှာဖွေမှုများ|အခမဲ့ online|လုပ်ဆောင်ပုံကို မသိဘဲ ကိုယ်ရေးကိုယ်တာ၊ အရေးကြီး သို့မဟုတ် လျှို့ဝှက်ဒေတာ မထည့်ပါနှင့်။
"@ -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
  $parts = $_ -split "\|", 7
  [pscustomobject]@{
    code              = $parts[0]
    name              = $parts[1]
    freePhrase        = $parts[2]
    guidePhrase       = $parts[3]
    searchPhrase      = $parts[4]
    localSearchPrefix = $parts[5]
    note              = $parts[6]
  }
}

$SelectedFeatures = if ($OnlyRepo.Count -gt 0) {
  $Features | Where-Object { $OnlyRepo -contains $_.repo }
} else {
  $Features
}

if ($OnlyRepo.Count -gt 0 -and $SelectedFeatures.Count -ne $OnlyRepo.Count) {
  $found = @($SelectedFeatures | ForEach-Object { $_.repo })
  $missing = @($OnlyRepo | Where-Object { $found -notcontains $_ })
  throw "Unknown repo name(s): $($missing -join ', ')"
}

$Results = foreach ($feature in $SelectedFeatures) {
  Publish-FeatureRepo $feature $Languages
}

$Results | ConvertTo-Json -Depth 5
