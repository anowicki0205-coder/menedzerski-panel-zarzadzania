#!/usr/bin/env python3
"""Buduje pliki wynikowe Menedżerskiego Panelu Zarządzania z katalogów css/ i js/.

  dist/panel.html       - jeden samodzielny plik (można otworzyć dwuklikiem, bez serwera)
  dist/artifact.html    - ten sam kod w postaci fragmentu strony do publikacji jako artefakt
"""
import re
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "index.html").read_text(encoding="utf-8")
css = (root / "css/app.css").read_text(encoding="utf-8")

scripts = re.findall(r'<script src="([^"]+)"></script>', src)
js = "\n".join((root / s).read_text(encoding="utf-8") for s in scripts)
assert "</script" not in js.lower(), "kod JS zawiera sekwencję </script"

fonts = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">', src).group(1)
body = re.search(r"<body>(.*?)<script", src, re.S).group(1).strip()

full = f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Menedżerski Panel Zarządzania</title>
<link rel="stylesheet" href="{fonts}">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
"""
(root / "dist").mkdir(exist_ok=True)
(root / "dist/panel.html").write_text(full, encoding="utf-8")

fragment = f"""<title>Menedżerski Panel Zarządzania</title>
<link rel="stylesheet" href="{fonts}">
<style>
{css}
</style>
{body}
<script>
{js}
</script>
"""
(root / "dist/artifact.html").write_text(fragment, encoding="utf-8")
print("OK:", len(full) // 1024, "KB")
