#!/usr/bin/env python3
"""Resumo e história de cada plataforma: introdução do artigo da Wikipédia (PT; EN se não houver),
mais a ficha técnica curada em scanner/platforms.json. Gera public/data/platforms.json.

Texto da Wikipédia: CC BY-SA 4.0 — a página mostra o crédito e o link do artigo.
  python3 scripts/platform_info.py            # textos (rede) + fichas
  python3 scripts/platform_info.py --specs    # só as fichas, sem rede
"""
import json, os, re, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "HandheldHub/1.0 (uso pessoal; catálogo privado)"

# Sistema → (título na Wikipédia PT, título na EN). None = sem artigo útil.
WIKI = {
    "3do": ("3DO Interactive Multiplayer", "3DO Interactive Multiplayer"), "3ds": ("Nintendo 3DS", "Nintendo 3DS"),
    "arcade": ("Arcade", "Arcade video game"), "atari2600": ("Atari 2600", "Atari 2600"), "atari5200": ("Atari 5200", "Atari 5200"),
    "atari7800": ("Atari 7800", "Atari 7800"), "atomiswave": (None, "Atomiswave"), "c64": ("Commodore 64", "Commodore 64"),
    "colecovision": ("ColecoVision", "ColecoVision"), "cps1": ("CP System", "CP System"), "cps2": ("CP System II", "CP System II"),
    "cps3": ("CP System III", "CP System III"), "dreamcast": ("Dreamcast", "Dreamcast"), "fbneo": (None, "FinalBurn Neo"),
    "fds": ("Famicom Disk System", "Famicom Disk System"), "gamecube": ("Nintendo GameCube", "GameCube"),
    "gamegear": ("Sega Game Gear", "Game Gear"), "gb": ("Game Boy", "Game Boy"), "gba": ("Game Boy Advance", "Game Boy Advance"),
    "gbc": ("Game Boy Color", "Game Boy Color"), "intellivision": ("Intellivision", "Intellivision"), "jaguar": ("Atari Jaguar", "Atari Jaguar"),
    "lightgun": ("Pistola de luz", "Light gun"), "lynx": ("Atari Lynx", "Atari Lynx"), "mame": ("MAME", "MAME"),
    "mastersystem": ("Master System", "Master System"), "megadrive": ("Mega Drive", "Sega Genesis"), "model2": (None, "Sega Model 2"),
    "model3": (None, "Sega Model 3"), "msx": ("MSX", "MSX"), "msx2": ("MSX", "MSX"), "n64": ("Nintendo 64", "Nintendo 64"),
    "naomi": (None, "Sega NAOMI"), "nds": ("Nintendo DS", "Nintendo DS"), "neogeo": ("Neo-Geo", "Neo Geo (system)"),
    "neogeocd": ("Neo-Geo CD", "Neo Geo CD"), "nes": ("Nintendo Entertainment System", "Nintendo Entertainment System"),
    "ngp": ("Neo Geo Pocket", "Neo Geo Pocket"), "ngpc": ("Neo Geo Pocket Color", "Neo Geo Pocket Color"),
    "pcengine": ("TurboGrafx-16", "TurboGrafx-16"), "pcenginecd": (None, "TurboGrafx-CD"), "pinballfx3": (None, "Pinball FX3"),
    "ps2": ("PlayStation 2", "PlayStation 2"), "psp": ("PlayStation Portable", "PlayStation Portable"),
    "psx": ("PlayStation (console)", "PlayStation (console)"), "sega32x": ("Sega 32X", "32X"), "segacd": ("Mega-CD", "Sega CD"),
    "sg1000": ("SG-1000", "SG-1000"), "snes": ("Super Nintendo Entertainment System", "Super Nintendo Entertainment System"),
    "sufami": (None, "Sufami Turbo"), "supergrafx": (None, "PC Engine SuperGrafx"), "switch": ("Nintendo Switch", "Nintendo Switch"),
    "triforce": (None, "Triforce (arcade board)"), "vectrex": ("Vectrex", "Vectrex"), "virtualboy": ("Virtual Boy", "Virtual Boy"),
    "wii": ("Wii", "Wii"), "wswanc": ("WonderSwan Color", "WonderSwan Color"),
}


def intro(lang, titles):
    """Introdução em texto puro de até 20 artigos por pedido (limite da API)."""
    out = {}
    for i in range(0, len(titles), 20):
        q = urllib.parse.urlencode({"action": "query", "prop": "extracts|info", "exintro": 1, "explaintext": 1, "exlimit": 20,
                                    "inprop": "url", "redirects": 1, "format": "json", "titles": "|".join(titles[i:i + 20])})
        req = urllib.request.Request(f"https://{lang}.wikipedia.org/w/api.php?{q}", headers={"User-Agent": UA})
        d = json.load(urllib.request.urlopen(req, timeout=60))["query"]
        alias = {r["from"]: r["to"] for r in d.get("redirects", []) + d.get("normalized", [])}
        # Redirecionamento para uma seção ou lista ("Sega Model 2" → "List of Sega arcade system boards#…") traz a
        # introdução de outra coisa; esses ficam sem texto. Redirecionamento de grafia ("Neo-Geo" → "Neo Geo") vale.
        bad = {r["from"] for r in d.get("redirects", []) if r.get("tofragment") or re.match(r"(List of|Lista de) ", r["to"])}
        pages = {p["title"]: p for p in d["pages"].values() if "missing" not in p}
        norm_ = {r["from"]: r["to"] for r in d.get("normalized", [])}
        for t in titles[i:i + 20]:
            if norm_.get(t, t) in bad:                   # o "from" do redirecionamento é o título já normalizado
                continue
            p = pages.get(alias.get(alias.get(t, t), alias.get(t, t)))
            if p and p.get("extract"):
                out[t] = (p["extract"], p["fullurl"])
    return out


def clean(text, max_par=3):
    pars = [re.sub(r"\s+", " ", p).strip() for p in text.split("\n") if len(p.strip()) > 40]
    return pars[:max_par]


def specs_only():
    """Só mescla a ficha curada no arquivo já gerado (sem rede), inclusive plataformas sem artigo."""
    path = os.path.join(ROOT, "public", "data", "platforms.json")
    out = json.load(open(path)) if os.path.exists(path) else {}
    for key, spec in json.load(open(os.path.join(ROOT, "scanner", "platforms.json"))).items():
        if not key.startswith("_"):
            out.setdefault(key, {})["specs"] = spec
    json.dump(out, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{path}: {sum(1 for r in out.values() if r.get('specs'))} fichas")


def main():
    pt = intro("pt", sorted({v[0] for v in WIKI.values() if v[0]}))
    en = intro("en", sorted({v[1] for v in WIKI.values() if v[1]}))
    specs = json.load(open(os.path.join(ROOT, "scanner", "platforms.json")))
    out = {}
    for sys, (tpt, ten) in WIKI.items():
        src = (pt.get(tpt) and ("pt", *pt[tpt])) or (en.get(ten) and ("en", *en[ten]))
        rec = {"specs": specs.get(sys, {})}
        if src:
            rec.update(lang=src[0], text=clean(src[1]), url=src[2])
        out[sys] = rec
    path = os.path.join(ROOT, "public", "data", "platforms.json")
    json.dump(out, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{path}: {sum(1 for r in out.values() if r.get('text'))} textos "
          f"({sum(1 for r in out.values() if r.get('lang') == 'pt')} em PT), {sum(1 for r in out.values() if r['specs'])} fichas")
    specs_only()                                         # fichas de plataformas sem artigo (arcade, ports…) também entram


if __name__ == "__main__":
    specs_only() if "--specs" in sys.argv else main()
