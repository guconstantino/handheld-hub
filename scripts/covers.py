#!/usr/bin/env python3
"""Capas dos jogos a partir do acervo público do libretro (thumbnails.libretro.com).

Casa cada jogo do D1 local com a lista de capas do sistema (nome No-Intro), baixa só as que
faltam, converte para WebP de 384 px em public/covers/ e gera data/covers.sql.

  python3 scripts/covers.py --match                 # só casa os nomes e mostra o acerto (não baixa)
  python3 scripts/covers.py gba snes                # baixa as capas desses sistemas
  python3 scripts/covers.py --all                   # todos os sistemas mapeados
  python3 scripts/covers.py --onion /Volumes/ONION  # completa com as capas do cartão do Miyoo (só leitura)
  python3 scripts/covers.py --daijisho              # completa com as capas do Daijishō no S20 via adb (só leitura)
  python3 scripts/covers.py --eshop                 # Switch: arte oficial da eShop via titledb (o libretro não tem Switch)
  python3 scripts/covers.py --arcade                # arcade: nome curto da ROM → título pelo DAT do libretro → capa
  python3 scripts/covers.py --sql [--remote]        # grava data/covers.sql no D1

Precisa de Pillow (ex.: ~/.cache/s20fe-outpaint/bin/python). Só a lista de capas de cada
sistema fica em cache (~/.cache/handheld-hub/libretro/, 7 dias).
"""
import hashlib, html, io, json, os, re, subprocess, sys, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "covers")
CACHE = os.path.expanduser("~/.cache/handheld-hub/libretro")
BASE = "https://thumbnails.libretro.com"
UA = "HandheldHub/1.0 (uso pessoal; capas para um catálogo privado)"
SIZE = 384

# Sistema canônico do Hub → pasta do libretro. Arcade (nomes curtos de ROM) fica de fora.
LIBRETRO = {
    "nes": "Nintendo - Nintendo Entertainment System", "snes": "Nintendo - Super Nintendo Entertainment System",
    "gb": "Nintendo - Game Boy", "gbc": "Nintendo - Game Boy Color", "gba": "Nintendo - Game Boy Advance",
    "n64": "Nintendo - Nintendo 64", "nds": "Nintendo - Nintendo DS", "3ds": "Nintendo - Nintendo 3DS",
    "fds": "Nintendo - Family Computer Disk System", "virtualboy": "Nintendo - Virtual Boy",
    "sufami": "Nintendo - Sufami Turbo", "gamecube": "Nintendo - GameCube", "wii": "Nintendo - Wii",
    "megadrive": "Sega - Mega Drive - Genesis", "mastersystem": "Sega - Master System - Mark III",
    "gamegear": "Sega - Game Gear", "sg1000": "Sega - SG-1000", "sega32x": "Sega - 32X",
    "segacd": "Sega - Mega-CD - Sega CD", "dreamcast": "Sega - Dreamcast",
    "psx": "Sony - PlayStation", "ps2": "Sony - PlayStation 2", "psp": "Sony - PlayStation Portable",
    "pcengine": "NEC - PC Engine - TurboGrafx 16", "pcenginecd": "NEC - PC Engine CD - TurboGrafx-CD",
    "supergrafx": "NEC - PC Engine SuperGrafx",
    "atari2600": "Atari - 2600", "atari5200": "Atari - 5200", "atari7800": "Atari - 7800",
    "lynx": "Atari - Lynx", "jaguar": "Atari - Jaguar",
    "colecovision": "Coleco - ColecoVision", "intellivision": "Mattel - Intellivision", "vectrex": "GCE - Vectrex",
    "msx": "Microsoft - MSX", "msx2": "Microsoft - MSX2", "c64": "Commodore - 64",
    "ngp": "SNK - Neo Geo Pocket", "ngpc": "SNK - Neo Geo Pocket Color", "neogeocd": "SNK - Neo Geo CD",
    "wswanc": "Bandai - WonderSwan Color", "3do": "The 3DO Company - 3DO", "lutro": "Lutro",
}


def norm(title):
    """Mesmo critério do game_key do scanner: sem (região)/[tags], artigo no começo, só letras e números."""
    title = re.sub(r"\.\d{2}$", "", title)
    title = re.sub(r"(?i)[\s_-]*decrypted\b", "", title)
    title = re.sub(r"(?i)\s+v\d+(?:\.\d+)+$", "", title)
    title = re.sub(r"(?i)\s*-\s*(c[oó]pia|copy)(\s*\(\d+\))?$", "", title)
    t = re.sub(r"[\(\[][^\)\]]*[\)\]]", " ", title)
    t = re.sub(r"^(.*), (the|a|an)\b", r"\2 \1", t.strip(), flags=re.I)
    t = "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))   # mesmo critério do scanner
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


def safe(name):
    """O libretro troca estes caracteres por _ no nome do arquivo."""
    return re.sub(r'[&*/:`<>?\\|"]', "_", name)


def region_rank(name):
    n = name.lower()
    for i, tag in enumerate(["(usa", "(world", "(usa, europe", "(europe", "(brazil", "(japan"]):
        if tag in n:
            return i
    return 9


def d1(sql, remote=False):
    out = subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--remote" if remote else "--local", "--json", "--command", sql],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)[0]["results"]


def fetch(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 * (i + 1))
        except Exception:
            time.sleep(2 * (i + 1))
    return None


def listing(system, folder=None):
    """Nomes das capas disponíveis (sem .png) no Named_Boxarts do sistema, com cache de 7 dias."""
    os.makedirs(CACHE, exist_ok=True)
    cp = os.path.join(CACHE, f"_list_{system}.json")
    if os.path.exists(cp) and time.time() - os.path.getmtime(cp) < 7 * 86400:
        return json.load(open(cp))
    page = fetch(f"{BASE}/{urllib.parse.quote(folder or LIBRETRO[system])}/Named_Boxarts/")
    names = []
    if page:
        for href in re.findall(r'href="([^"]+\.png)"', page.decode("utf-8", "replace")):
            names.append(html.unescape(urllib.parse.unquote(href)).rsplit("/", 1)[-1][:-4])
    json.dump(names, open(cp, "w"))
    return names


def match(systems):
    """game_key → nome da capa no libretro. Primeiro o nome exato do arquivo, depois o nome normalizado."""
    games = d1("SELECT game_key, system, GROUP_CONCAT(title, '\x1f') AS titles FROM files GROUP BY game_key")
    plan, stats = {}, {}
    for s in systems:
        names = listing(s)
        exact = {n: n for n in names}
        byn = {}
        for n in sorted(names, key=region_rank):
            byn.setdefault(norm(n), n)
        rows = [g for g in games if g["system"] == s]
        hit = 0
        for g in rows:
            titles = sorted(set(g["titles"].split("\x1f")), key=region_rank)
            name = next((exact[safe(t)] for t in titles if safe(t) in exact), None) or byn.get(g["game_key"].split("|", 1)[1])
            if name:
                plan[g["game_key"]] = (s, name)
                hit += 1
        stats[s] = (hit, len(rows), len(names))
    return plan, stats


def cover_file(game_key):
    return hashlib.sha1(game_key.encode()).hexdigest()[:16] + ".webp"


def download(plan):
    from PIL import Image
    os.makedirs(OUT, exist_ok=True)
    todo = [(k, s, n) for k, (s, n) in plan.items() if not os.path.exists(os.path.join(OUT, cover_file(k)))]
    print(f"{len(plan)} capas casadas, {len(todo)} para baixar")

    def one(item):
        k, s, n = item
        # O .webp em public/covers/ já é o "baixado": o PNG original (~700 KB) não fica no disco.
        data = fetch(f"{BASE}/{urllib.parse.quote(LIBRETRO[s])}/Named_Boxarts/{urllib.parse.quote(n)}.png")
        time.sleep(0.2)                                  # devagar com o servidor do libretro
        if not data:
            return False
        try:
            im = Image.open(io.BytesIO(data)).convert("RGB")
            im.thumbnail((SIZE, SIZE * 2))
            im.save(os.path.join(OUT, cover_file(k)), "WEBP", quality=80, method=6)
            return True
        except Exception:
            return False

    ok = 0
    with ThreadPoolExecutor(4) as ex:
        for i, r in enumerate(ex.map(one, todo), 1):
            ok += r
            if i % 250 == 0:
                print(f"  {i}/{len(todo)}")
    print(f"{ok} novas capas em public/covers/")


ONION_MAP = os.path.join(ROOT, "data", "covers-onion.json")


def onion(vol):
    """Capas do OnionOS (Roms/<PASTA>/Imgs/<nome-do-ROM>.png) para os jogos que o libretro não cobre.
    Só lê o cartão. Grava public/covers/o-<hash>.webp e data/covers-onion.json (game_key → arquivo)."""
    from PIL import Image
    plan, _ = match(sorted(LIBRETRO))
    rows = d1("SELECT game_key, folder, title FROM files WHERE location_id='miyoo-sd'")
    done = json.load(open(ONION_MAP)) if os.path.exists(ONION_MAP) else {}
    os.makedirs(OUT, exist_ok=True)
    new = 0
    for r in rows:
        k = r["game_key"]
        if k in plan or k in done:
            continue
        src = os.path.join(vol, "Roms", r["folder"], "Imgs", r["title"] + ".png")
        if not os.path.exists(src):
            continue
        name = "o-" + cover_file(k)
        try:
            im = Image.open(src).convert("RGB")
            im.thumbnail((SIZE, SIZE * 2))
            im.save(os.path.join(OUT, name), "WEBP", quality=80, method=6)
        except Exception:
            continue
        done[k] = name
        new += 1
    json.dump(done, open(ONION_MAP, "w"), ensure_ascii=False)
    print(f"{new} capas novas do OnionOS ({len(done)} no total)")


DAIJI_MAP = os.path.join(ROOT, "data", "covers-daijisho.json")
DAIJI_ROOT = "/storage/6847-D042/Rom"           # mesmo root do local s20-sd (scanner/devices.json)
DAIJI_ROOTS = ["/storage/6847-D042/Rom", "/sdcard/Rom"]


def daijisho():
    """Capas do Daijishō no S20 (<pasta>/media/box/<nome-do-ROM>.png|jpg) para jogos ainda sem capa.
    Só lê o aparelho (adb shell find + adb pull em lotes). ANDROID_SERIAL escolhe o device."""
    import tempfile
    from PIL import Image
    adb = ["adb"] + (["-s", os.environ["ANDROID_SERIAL"]] if os.environ.get("ANDROID_SERIAL") else [])
    boxes = {}
    for root in DAIJI_ROOTS:
        res = subprocess.run(adb + ["shell", f'[ -d "{root}" ] && cd "{root}" && find . -path "*/media/box/*" -type f'],
                             capture_output=True, text=True)
        for line in res.stdout.splitlines():
            parts = line[2:].split("/")                    # ./<pasta>/media/box/<nome>.<ext>
            if len(parts) == 4:
                boxes[(parts[0], parts[3].rsplit(".", 1)[0])] = f"{root}/{line[2:]}"
    plan, _ = match(sorted(LIBRETRO))
    have = set(plan) | set(json.load(open(ONION_MAP)) if os.path.exists(ONION_MAP) else {})
    done = json.load(open(DAIJI_MAP)) if os.path.exists(DAIJI_MAP) else {}
    rows = d1("SELECT game_key, folder, rel_path, title FROM files WHERE location_id IN ('s20-sd','s20-int')")
    want = {}
    for r in rows:
        k = r["game_key"]
        if k in have or k in done or k in want:
            continue
        base = r["rel_path"].rsplit("/", 1)[-1]
        for name in (r["title"], base.rsplit(".", 1)[0]):
            if (r["folder"], name) in boxes:
                want[k] = boxes[(r["folder"], name)]
                break
    print(f"{len(boxes)} capas no Daijishō, {len(want)} para jogos ainda sem capa")
    os.makedirs(OUT, exist_ok=True)
    keys = list(want)
    with tempfile.TemporaryDirectory() as tmp:
        for i in range(0, len(keys), 100):
            batch = keys[i:i + 100]
            subprocess.run(adb + ["pull"] + [want[k] for k in batch] + [tmp],
                           capture_output=True, text=True)
            for k in batch:
                src = os.path.join(tmp, want[k].rsplit("/", 1)[-1])
                if not os.path.exists(src):
                    continue
                name = "d-" + cover_file(k)
                try:
                    im = Image.open(src).convert("RGB")
                    im.thumbnail((SIZE, SIZE * 2))
                    im.save(os.path.join(OUT, name), "WEBP", quality=80, method=6)
                    done[k] = name
                except Exception:
                    pass
                os.remove(src)
            print(f"  {min(i + 100, len(keys))}/{len(keys)}")
            json.dump(done, open(DAIJI_MAP, "w"), ensure_ascii=False)
    print(f"{len(done)} capas do Daijishō no total")


ESHOP_MAP = os.path.join(ROOT, "data", "covers-eshop.json")
TITLEDB = os.path.expanduser("~/.cache/handheld-hub/titledb-US.en.json")   # github.com/blawar/titledb (US.en.json)


def eshop():
    """Switch: casa o nome com o titledb e usa o ícone oficial da eShop (arte quadrada, 1024 px)."""
    from PIL import Image
    if not os.path.exists(TITLEDB):
        data = fetch("https://raw.githubusercontent.com/blawar/titledb/master/US.en.json")
        os.makedirs(os.path.dirname(TITLEDB), exist_ok=True)
        open(TITLEDB, "wb").write(data)
    db = json.load(open(TITLEDB))
    clean = lambda t: norm(t.replace("™", "").replace("®", ""))
    idx = {}
    for v in db.values():
        if v.get("name") and v.get("iconUrl"):
            idx.setdefault(clean(v["name"]), v["iconUrl"])
    done = json.load(open(ESHOP_MAP)) if os.path.exists(ESHOP_MAP) else {}
    os.makedirs(OUT, exist_ok=True)
    for r in d1("SELECT DISTINCT game_key, title FROM files WHERE system='switch'"):
        url = idx.get(clean(r["title"]))
        if r["game_key"] in done or not url:
            continue
        data = fetch(url)
        if not data:
            continue
        im = Image.open(io.BytesIO(data)).convert("RGB")
        im.thumbnail((SIZE, SIZE))
        name = "e-" + cover_file(r["game_key"])
        im.save(os.path.join(OUT, name), "WEBP", quality=82, method=6)
        done[r["game_key"]] = name
    json.dump(done, open(ESHOP_MAP, "w"), ensure_ascii=False)
    print(f"{len(done)} capas da eShop")


ARCADE_MAP = os.path.join(ROOT, "data", "covers-arcade.json")
LRDB = os.path.expanduser("~/.cache/handheld-hub/libretro-database")   # clone esparso (metadat/mame, metadat/fbneo-split, dat)
ARCADE_DATS = ["metadat/mame/MAME.dat", "metadat/fbneo-split/FBNeo - Arcade Games.dat", "metadat/mame-split/MAME 2003.dat",
               "metadat/mame-split/MAME 2010.dat", "dat/Atomiswave.dat"]
ARCADE_THUMBS = ["MAME", "FBNeo - Arcade Games", "Atomiswave", "Sega - Naomi", "Sega - Naomi 2"]


_ROM_INFO = None


def rom_info():
    """Nome curto da ROM ("commando") → {name, ano, dev, pub} pelos DATs do libretro.
    O primeiro DAT que conhece o nome vence (MAME atual primeiro)."""
    global _ROM_INFO
    if _ROM_INFO is not None:
        return _ROM_INFO
    out = {}
    field = lambda block, *names: next((m.group(1) for n in names for m in [re.search(rf'^\s*{n} "([^"]*)"', block, re.M)] if m), None)
    for rel in ARCADE_DATS:
        path = os.path.join(LRDB, rel)
        if not os.path.exists(path):
            continue
        for block in open(path, encoding="utf-8", errors="replace").read().split("\ngame (")[1:]:
            name = field(block, "name")
            short = re.search(r'^\s*id "([^"]+)"', block, re.M) or re.search(r'rom \( name "?([^\s"]+?)\.zip', block)
            if not (name and short) or short.group(1).lower() in out:
                continue
            # O DAT grava "&" como "_" e junta nomes alternativos com " / " (fica o primeiro).
            rec = {"name": name.replace(" _ ", " & ").split(" / ")[0]}
            year = field(block, "year", "releaseyear")
            if year and year.isdigit():
                rec["ano"] = int(year)
            dev, pub = field(block, "developer", "manufacturer"), field(block, "publisher")
            if dev:
                rec["dev"] = dev
            if pub:
                rec["pub"] = pub
            out[short.group(1).lower()] = rec
    _ROM_INFO = out
    return out


def rom_titles():
    """Nome curto da ROM → título completo ("commando" → "Commando (World)")."""
    return {k: v["name"] for k, v in rom_info().items()}


def arcade():
    """Arcade (MAME, FBNeo, light gun, Model 2, Atomiswave, Naomi): os arquivos usam o nome curto da ROM.
    Traduz pelo DAT e casa com as capas de arcade do libretro. Grava a-<hash>.webp e data/covers-arcade.json."""
    from PIL import Image
    titles = rom_titles()
    thumbs = {f: listing("_arcade_" + re.sub(r"\W+", "_", f), f) for f in ARCADE_THUMBS}
    exact, byn = {}, {}
    for f, names in thumbs.items():
        for n in sorted(names, key=region_rank):
            exact.setdefault(n, (f, n))
            byn.setdefault(norm(n), (f, n))
    plan, _ = match(sorted(LIBRETRO))
    have = set(plan)
    for m in (ONION_MAP, DAIJI_MAP, ESHOP_MAP):
        have |= set(json.load(open(m))) if os.path.exists(m) else set()
    done = json.load(open(ARCADE_MAP)) if os.path.exists(ARCADE_MAP) else {}
    rows = d1("SELECT DISTINCT game_key, title FROM files WHERE system IN ('mame','fbneo','lightgun','model2','model3','atomiswave','naomi','arcade','neogeo','cps1','cps2','cps3')")
    want, unknown = {}, 0
    for r in rows:
        k = r["game_key"]
        if k in have or k in done or k in want:
            continue
        full = titles.get(r["title"].lower())
        if not full:
            unknown += 1
            continue
        hit = exact.get(safe(full)) or byn.get(norm(full))
        if hit:
            want[k] = hit
    print(f"{len(rows)} jogos de arcade, {len(want)} capas novas para baixar ({unknown} nomes fora dos DATs)")
    os.makedirs(OUT, exist_ok=True)

    def one(item):
        k, (f, n) = item
        data = fetch(f"{BASE}/{urllib.parse.quote(f)}/Named_Boxarts/{urllib.parse.quote(n)}.png")
        time.sleep(0.2)
        if not data:
            return None
        try:
            im = Image.open(io.BytesIO(data)).convert("RGB")
            im.thumbnail((SIZE, SIZE * 2))
            name = "a-" + cover_file(k)
            im.save(os.path.join(OUT, name), "WEBP", quality=80, method=6)
            return k, name
        except Exception:
            return None

    with ThreadPoolExecutor(4) as ex:
        for res in ex.map(one, want.items()):
            if res:
                done[res[0]] = res[1]
    json.dump(done, open(ARCADE_MAP, "w"), ensure_ascii=False)
    print(f"{len(done)} capas de arcade no total")


def write_sql(remote=False):
    """Registra no D1 só as capas que existem em public/covers/ (libretro primeiro, OnionOS completa)."""
    plan, _ = match(sorted(LIBRETRO))
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = [(k, cover_file(k), "libretro") for k in plan if os.path.exists(os.path.join(OUT, cover_file(k)))]
    have = {k for k, _, _ in rows}
    extra = json.load(open(ONION_MAP)) if os.path.exists(ONION_MAP) else {}
    rows += [(k, f, "onion") for k, f in extra.items() if k not in have and os.path.exists(os.path.join(OUT, f))]
    have = {k for k, _, _ in rows}
    daiji = json.load(open(DAIJI_MAP)) if os.path.exists(DAIJI_MAP) else {}
    rows += [(k, f, "daijisho") for k, f in daiji.items() if k not in have and os.path.exists(os.path.join(OUT, f))]
    have = {k for k, _, _ in rows}
    esh = json.load(open(ESHOP_MAP)) if os.path.exists(ESHOP_MAP) else {}
    rows += [(k, f, "eshop") for k, f in esh.items() if k not in have and os.path.exists(os.path.join(OUT, f))]
    have = {k for k, _, _ in rows}
    arc = json.load(open(ARCADE_MAP)) if os.path.exists(ARCADE_MAP) else {}
    rows += [(k, f, "arcade") for k, f in arc.items() if k not in have and os.path.exists(os.path.join(OUT, f))]
    q = lambda v: "'" + v.replace("'", "''") + "'"
    out = ["DELETE FROM covers;"]
    for i in range(0, len(rows), 200):
        out.append("INSERT OR REPLACE INTO covers (game_key,file,source,updated_at) VALUES " +
                   ",".join(f"({q(k)},{q(f)},{q(src)},{q(ts)})" for k, f, src in rows[i:i + 200]) + ";")
    path = os.path.join(ROOT, "data", "covers.sql")
    open(path, "w").write("\n".join(out) + "\n")
    subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--remote" if remote else "--local", "--file", path],
                   cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    print(f"{len(rows)} capas gravadas no D1 {'remoto' if remote else 'local'}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--sql" in args:
        write_sql("--remote" in args)
        sys.exit()
    if "--arcade" in args:
        arcade()
        sys.exit()
    if "--eshop" in args:
        eshop()
        sys.exit()
    if "--daijisho" in args:
        daijisho()
        sys.exit()
    if "--onion" in args:
        onion(args[args.index("--onion") + 1])
        sys.exit()
    systems = sorted(LIBRETRO) if ("--all" in args or "--match" in args) else [a for a in args if not a.startswith("--")]
    unknown = [s for s in systems if s not in LIBRETRO]
    if unknown or not systems:
        sys.exit(f"uso: covers.py --match | --all | <sistema>...   sem mapa: {unknown}")
    plan, stats = match(systems)
    for s, (hit, n, avail) in sorted(stats.items(), key=lambda x: -x[1][1]):
        print(f"{s:14s} {hit:5d}/{n:<5d} {100 * hit / max(n, 1):5.1f}%   ({avail} capas no libretro)")
    tot = sum(h for h, _, _ in stats.values()), sum(n for _, n, _ in stats.values())
    print(f"{'total':14s} {tot[0]:5d}/{tot[1]:<5d} {100 * tot[0] / max(tot[1], 1):5.1f}%")
    if "--match" not in args:
        download(plan)
