#!/usr/bin/env python3
"""Temas de plataforma: todos os pacotes de papéis de parede do Daijishō (TapiocaFox/Daijishou), para o
portal deixar escolher o visual das plataformas. O "Arrow" continua sendo o padrão (public/platforms/).

Só baixa as plataformas que existem no acervo, de cada pacote sem marca de conteúdo adulto (IsNSFW).
Grava public/themes/<pacote>/<sistema>.webp (1280 px; vão para o R2, não para os assets) e
public/data/themes.json (nome, autores, descrição e plataformas de cada pacote). Retomável.
  ~/.cache/s20fe-outpaint/bin/python scripts/theme_packs.py [--workers 6]
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from platform_art import ARROW  # noqa: E402  (sistema do Hub → nome curto do Daijishō)

BASE = "https://raw.githubusercontent.com/TapiocaFox/Daijishou/main/themes/platform_wallpapers_packs/"
OUT = os.path.join(ROOT, "public", "themes")
UA = {"User-Agent": "HandheldHub/1.0 (uso pessoal; catálogo privado)"}
# Nomes curtos do Daijishō que diferem dos arquivos do Arrow.
SHORT = {**ARROW, "dreamcast": "dreamcast", "sega32x": "sega32x"}


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(5 * (i + 1))
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def save(data, dst, width=1280):
    from PIL import Image
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im.thumbnail((width, width))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "WEBP", quality=78, method=6)


def main():
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 6
    systems = json.load(open(os.path.join(ROOT, "public", "data", "catalog.json")))["systems"]
    packs = json.loads(get(BASE + "index.json"))["platformWallpapersPackList"]
    jobs, meta = [], []
    for p in packs:
        if p.get("platformWallpapersPackIsNSFW"):
            continue
        root = p["platformWallpapersPackRootPath"]
        idx = get(BASE + urllib.parse.quote(root) + "/index.json")
        if not idx:
            continue
        idx = json.loads(idx)
        by_short = {}
        for w in idx.get("wallpaperList", []):
            for k in ("matchPlatformShortname", "matchPlatformUniqueId"):
                if w.get(k):
                    by_short.setdefault(w[k].lower(), w["filename"])
        default = idx.get("defaultWallpaperFilename") if idx.get("hasDefaultWallpaper") else None
        s = slug(p["platformWallpapersPackName"])
        own = {}
        for sys_ in systems:
            fn = by_short.get(SHORT.get(sys_, sys_))
            if fn:
                own[sys_] = fn
        if len(own) < 10:                                   # pacote pequeno demais para valer como tema
            continue
        for sys_, fn in own.items():
            jobs.append((root, fn, os.path.join(OUT, s, f"{sys_}.webp")))
        if default:
            jobs.append((root, default, os.path.join(OUT, s, "_default.webp")))
        thumb = p.get("platformWallpapersPackPreviewThumbnailPath")
        if thumb:
            jobs.append((None, thumb, os.path.join(OUT, s, "_thumb.webp")))
        meta.append({"id": s, "name": p["platformWallpapersPackName"], "authors": p.get("platformWallpapersPackAuthors") or [],
                     "description": p.get("platformWallpapersPackDescription") or "", "systems": sorted(own),
                     "default": bool(default), "thumb": bool(thumb)})
    todo = [j for j in jobs if not os.path.exists(j[2])]
    print(f"{len(meta)} pacotes, {len(jobs)} imagens ({len(todo)} para baixar)", flush=True)

    def one(job):
        root, fn, dst = job
        data = get(BASE + (urllib.parse.quote(root) + "/" if root else "") + urllib.parse.quote(fn))
        if not data:
            return False
        try:
            save(data, dst, 480 if dst.endswith("_thumb.webp") else 1280)
            return True
        except Exception:
            return False

    ok = 0
    with ThreadPoolExecutor(workers) as ex:
        for i, r in enumerate(ex.map(one, todo), 1):
            ok += r
            if i % 200 == 0:
                print(f"  {i}/{len(todo)} ({ok} ok)", flush=True)
    # Só o que de fato existe no disco entra no índice (download parcial não quebra o seletor).
    for m in meta:
        d = os.path.join(OUT, m["id"])
        m["systems"] = [s for s in m["systems"] if os.path.exists(os.path.join(d, f"{s}.webp"))]
        m["default"] = os.path.exists(os.path.join(d, "_default.webp"))
        m["thumb"] = os.path.exists(os.path.join(d, "_thumb.webp"))
    meta = [m for m in meta if len(m["systems"]) >= 10]
    json.dump(meta, open(os.path.join(ROOT, "public", "data", "themes.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{ok} imagens novas; {len(meta)} temas em public/data/themes.json", flush=True)


if __name__ == "__main__":
    main()
