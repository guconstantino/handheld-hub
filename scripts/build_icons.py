#!/usr/bin/env python3
"""Junta assets/icons/*.svg num sprite (public/icons.svg) com um <symbol> por ícone.
l-<nome> (Lucide, traço) vira #i-<nome>; b-<nome> (Simple Icons, preenchido) vira #b-<nome>.
O traço e o preenchimento vêm do CSS (.ic / .logo), não dos arquivos."""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "icons")
# Logos de marca recortados no conteúdo (wordmarks ocupam só uma faixa do quadro 24×24).
VIEWBOX = {"b-samsung": "0 9.6 24 4.8"}

out = ['<svg xmlns="http://www.w3.org/2000/svg" style="display:none">']
for fn in sorted(os.listdir(SRC)):
    if not fn.endswith(".svg"):
        continue
    name = fn[:-4]
    svg = open(os.path.join(SRC, fn)).read()
    body = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    body = re.sub(r"<title>.*?</title>|<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r"\s+", " ", body).strip()
    sid = ("i-" + name[2:]) if name.startswith("l-") else name
    vb = VIEWBOX.get(name, "0 0 24 24")
    out.append(f'<symbol id="{sid}" viewBox="{vb}">{body}</symbol>')
out.append("</svg>")
open(os.path.join(ROOT, "public", "icons.svg"), "w").write("\n".join(out) + "\n")
print(len(out) - 2, "ícones")
