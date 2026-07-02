#!/usr/bin/env python3
"""Remove remaining dead data-lang-btn code from HTML files."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

PATTERNS = [
    re.compile(
        r"\n\s*document\.querySelectorAll\(\"?\[data-lang-btn\]\"?\)\.forEach\(btn\s*=>\s*\{[^}]*\}\);\s*",
        re.MULTILINE,
    ),
    re.compile(
        r"\n\s*document\.querySelectorAll\('\[data-lang-btn\]'\)\.forEach\(btn\s*=>\s*\{[^}]*\}\);\s*",
        re.MULTILINE,
    ),
    re.compile(
        r"document\.querySelectorAll\('\[data-lang-btn\]'\)\.forEach\(btn=>btn\.classList\.toggle\('active',[^)]+\)\);",
        re.MULTILINE,
    ),
]


def main():
    for html in ROOT.glob("*.html"):
        text = html.read_text(encoding="utf-8")
        original = text
        for p in PATTERNS:
            text = p.sub("\n", text)
        if text != original:
            html.write_text(text, encoding="utf-8")
            print("cleaned", html.name)


if __name__ == "__main__":
    main()
