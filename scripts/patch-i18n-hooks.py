#!/usr/bin/env python3
"""Attach window.applyLanguage and remove dead data-lang-btn listeners."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SKIP = {"index.html", "upload.html"}

LISTENER_PATTERNS = [
    re.compile(
        r"\n\s*document\.querySelectorAll\(\[data-lang-btn\]\)\.forEach\(btn\s*=>\s*\{\s*"
        r"btn\.addEventListener\(\"click\",\s*\(\)\s*=>\s*applyLanguage\([^)]+\)\);\s*\}\);\s*",
        re.MULTILINE,
    ),
    re.compile(
        r"\n\s*document\.querySelectorAll\('\[data-lang-btn\]'\)\.forEach\(btn\s*=>\s*"
        r"btn\.addEventListener\('click',\s*\(\)\s*=>\s*applyLanguage\([^)]+\)\)\);\s*",
        re.MULTILINE,
    ),
]

ACTIVE_TOGGLE = re.compile(
    r"\n\s*document\.querySelectorAll\(\[data-lang-btn\]\)\.forEach\(btn\s*=>\s*\{[^}]+\}\);\s*",
    re.MULTILINE,
)

ACTIVE_TOGGLE2 = re.compile(
    r"document\.querySelectorAll\('\[data-lang-btn\]'\)\.forEach\(btn=>btn\.classList\.toggle\('active',[^)]+\)\);",
    re.MULTILINE,
)

HOOK = "\n    window.applyLanguage = applyLanguage;\n"


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "function applyLanguage" not in text:
        return False
    original = text

    for pattern in LISTENER_PATTERNS:
        text = pattern.sub("\n", text)
    text = ACTIVE_TOGGLE.sub("\n", text)
    text = ACTIVE_TOGGLE2.sub("", text)

    if "window.applyLanguage" not in text and HOOK.strip() not in text:
        # Insert before last </script> in file if applyLanguage is in a script block
        idx = text.rfind("function applyLanguage")
        if idx == -1:
            return False
        close_script = text.find("</script>", idx)
        if close_script == -1:
            return False
        text = text[:close_script] + HOOK + text[close_script:]

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    changed = []
    for html in sorted(ROOT.glob("*.html")):
        if html.name in SKIP:
            continue
        if patch_file(html):
            changed.append(html.name)
    print("Patched:", ", ".join(changed) if changed else "(none)")


if __name__ == "__main__":
    main()
