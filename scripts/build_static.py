#!/usr/bin/env python3
"""Gera dist/handheld-hub.html: o portal num arquivo só, com os dados do D1 local embutidos.

Serve para ver no celular sem subir o Worker (ex.: página privada no claude.ai). O mesmo
public/app.js roda nos dois casos; aqui window.HH_API responde às rotas /api/* em memória.
  python3 scripts/build_static.py
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog import build  # noqa: E402  (mesmo catálogo do site; aqui embutido na página)

data = build()
data["covers"] = {}                      # capas ficam de fora do arquivo único (seriam ~300 MB)
rows = data["files"]
SHIM = open(os.path.join(ROOT, "public", "hh-api.js")).read()

css = open(os.path.join(ROOT, "public", "styles.css")).read()
js = open(os.path.join(ROOT, "public", "app.js")).read().replace("icons.svg#", "#")
# Fotos de capa viram data URI (o snapshot é um arquivo só).
for name in os.listdir(os.path.join(ROOT, "public", "img")):
    b64 = base64.b64encode(open(os.path.join(ROOT, "public", "img", name), "rb").read()).decode()
    js = js.replace(f'"img/{name}"', f'"data:image/webp;base64,{b64}"')
sprite = open(os.path.join(ROOT, "public", "icons.svg")).read()
html = open(os.path.join(ROOT, "public", "index.html")).read()
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r'<script src="(app|hh-api)\.js"></script>', "", body).replace("icons.svg#", "#")

page = ("<title>Handheld Hub</title>\n<style>\n" + css + "\n</style>\n" + sprite + body +
        "<script>window.HH_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";</script>\n"
        "<script>" + SHIM + "</script>\n<script>\n" + js + "\n</script>\n")
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
out = os.path.join(ROOT, "dist", "handheld-hub.html")
open(out, "w").write(page)
print(f"{out}: {len(page) / 1e6:.1f} MB, {len(rows)} arquivos")
