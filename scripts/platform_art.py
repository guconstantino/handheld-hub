#!/usr/bin/env python3
"""Arte de cada plataforma: o pacote "Arrow" de papéis de parede do Daijishō (o mesmo do S20 FE).

Autor: Post Mortem (logos redesenhados por Dan Patrick), repositório TapiocaFox/Daijishou (MIT).
Baixa uma vez e grava public/platforms/<sistema>.webp (1280 px de largura).
  ~/.cache/s20fe-outpaint/bin/python scripts/platform_art.py
"""
import io, os, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "platforms")
BASE = "https://raw.githubusercontent.com/TapiocaFox/Daijishou/main/themes/platform_wallpapers_packs/Arrow/"

# Sistema canônico do Hub → arquivo do pacote Arrow (sem arte própria: default).
ARROW = {
    "3do": "3do", "3ds": "3ds", "arcade": "mame", "atari2600": "atari2600", "atari5200": "atari5200",
    "atari7800": "atari7800", "atomiswave": "atomiswave", "c64": "c64", "colecovision": "coleco",
    "cps1": "cps1", "cps2": "cps2", "cps3": "cps3", "dreamcast": "dc", "fbneo": "fbneo", "fds": "fds",
    "gamecube": "gc", "gamegear": "gamegear", "gb": "gb", "gba": "gba", "gbc": "gbc",
    "intellivision": "intellivision", "jaguar": "jaguar", "lynx": "lynx", "mame": "mame",
    "mastersystem": "master", "megadrive": "genesis", "msx": "msx", "msx2": "msx", "n64": "n64", "nds": "nds",
    "neogeo": "neogeo", "neogeocd": "neogeocd", "nes": "nes", "ngp": "ngp", "ngpc": "ngpc",
    "pcengine": "tg16", "pcenginecd": "tgcd", "ports": "android", "ps2": "ps2", "psp": "psp", "psx": "psx",
    "sega32x": "32x", "segacd": "segacd", "sg1000": "sg1000", "snes": "snes", "sufami": "snes",
    "supergrafx": "supergrafx", "switch": "switch", "vectrex": "vectrex", "virtualboy": "virtualboy",
    "wii": "wii", "windows": "dos", "wswanc": "wsc",
    "lightgun": "default", "lutro": "default", "model2": "default", "model3": "default", "naomi": "default",
    "pinballfx3": "default", "triforce": "default",
}


def main():
    from PIL import Image
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for system, name in sorted(ARROW.items()):
        dst = os.path.join(OUT, f"{system}.webp")
        if os.path.exists(dst):
            continue
        if name not in cache:
            req = urllib.request.Request(BASE + urllib.parse.quote(name) + ".jpg", headers={"User-Agent": "HandheldHub/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                cache[name] = r.read()
        im = Image.open(io.BytesIO(cache[name])).convert("RGB")
        im.thumbnail((1280, 1280))
        im.save(dst, "WEBP", quality=80, method=6)
        print(system, "←", name, im.size, os.path.getsize(dst) // 1024, "KB")


if __name__ == "__main__":
    main()
