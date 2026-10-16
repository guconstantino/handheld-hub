#!/usr/bin/env python3
"""Gera public/data/catalog.json: o catálogo inteiro (do D1 local) para o navegador filtrar sozinho.

O site não consulta o D1 em produção (o plano grátis lê 5 mi de linhas/dia e cada acesso varria a
tabela toda). Fluxo: scanner → D1 local → este script → wrangler deploy.
  python3 scripts/catalog.py
"""
import json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def d1(sql):
    out = subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--local", "--json", "--command", sql],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)[0]["results"]


def build():
    devices = d1("SELECT * FROM devices ORDER BY kind DESC, name")
    for d in devices:
        d["specs"] = json.loads(d["specs"] or "{}")
    locations = d1("""SELECT l.*, COUNT(f.id) AS files, COALESCE(SUM(f.size),0) AS bytes,
                      SUM(f.status='corrupted') AS corrupted, COUNT(DISTINCT f.system) AS systems
                      FROM locations l LEFT JOIN files f ON f.location_id = l.id GROUP BY l.id ORDER BY l.device_id, l.id""")
    # .bak/.tmp/.log: sobras de front-end (ex. "miyoogamelist.xml.bak") gravadas antes de o scanner pular essas extensões.
    files = d1("SELECT location_id, system, title, game_key, ext, size, status, drive_id FROM files WHERE ext NOT IN ('bak', 'tmp', 'log')")
    covers = {r["game_key"]: r["file"] for r in d1("SELECT game_key, file FROM covers")}
    # Só capas que existem em public/covers/ (o download pode estar no meio).
    cdir = os.path.join(ROOT, "public", "covers")
    have = set(os.listdir(cdir)) if os.path.isdir(cdir) else set()
    covers = {k: f for k, f in covers.items() if f in have}

    # Compacta: índices para local/sistema/estado; game_key sem o prefixo do sistema.
    loc_ids = [l["id"] for l in locations]
    systems = sorted({f["system"] for f in files})
    status = ["unknown", "ok", "corrupted"]
    rows = [[loc_ids.index(f["location_id"]), systems.index(f["system"]), f["title"], f["game_key"].split("|", 1)[1],
             status.index(f["status"]), f["size"] or 0, f["ext"] or "", f["drive_id"] or ""] for f in files]
    return {"devices": devices, "locations": locations, "systems": systems, "status": status,
            "files": rows, "covers": covers, "names": {**rawg_names(files), **arcade_names(files)}, "scores": rawg_scores(), "years": years(files)}


def cru(title):
    """Nome de arquivo cru, sem cara de título: "dino_crisis_2", "legend_of_mana", "SUPER MARIO ODYSSEY".
    O "_" no lugar do apóstrofo ("Baldur_s Gate") não conta: o hh-api.js já mostra o apóstrofo."""
    t = re.sub(r"\s*[\(\[].*$", "", title).strip()
    t = re.sub(r"(?<=[a-z])_(?=(s|n|t|ll|re|d|ve|m)\b| )", "'", t)
    if not re.search(r"[A-Za-z]", t):
        return False
    return "_" in t or t == t.lower() or (t == t.upper() and len(re.findall(r"\b[A-Z]{4,}\b", t)) >= 2)


def rawg_names(files):
    """Nome oficial do RAWG (só para nomes crus): "dino_crisis_2" → "Dino Crisis 2". O RAWG às vezes põe o ano
    ("Yoshi's Story (1997)"); sai. O nome do arquivo continua em `rom` (página do jogo, "Onde está")."""
    path = os.path.join(ROOT, "data", "rawg-cache.json")
    cache = json.load(open(path)) if os.path.exists(path) else {}
    out = {}
    for f in files:
        v = cache.get(f["game_key"])
        if v and v.get("nome") and cru(f["title"]):
            out[f["game_key"]] = re.sub(r"\s*\(\d{4}\)$", "", v["nome"])
    return out


def years(files):
    """Ano de lançamento de cada jogo (linha do tempo e filtro por ano): ficha do libretro e, se faltar, o RAWG."""
    out, keys = {}, {f["game_key"] for f in files}
    for kind in ("info", "scores"):                       # info primeiro: o RAWG só completa o que falta
        d = os.path.join(ROOT, "public", "data", kind)
        for fn in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if not fn.endswith(".json"):
                continue
            for k, v in json.load(open(os.path.join(d, fn))).items():
                gk, a = f"{fn[:-5]}|{k}", str(v.get("ano") or "")[:4]
                if gk in keys and gk not in out and a.isdigit() and 1970 <= int(a) <= 2100:
                    out[gk] = int(a)
    return out


def rawg_scores():
    """Nota do Metacritic e horas para zerar (do RAWG, scripts/rawg_scores.py) para ordenar e filtrar
    a lista de jogos e sugerir parecidos: { "sistema|chave": [nota|0, horas|0, "Ação|Aventura"] }. A ficha completa
    fica em data/scores/<sistema>.json."""
    sdir, out = os.path.join(ROOT, "public", "data", "scores"), {}
    for f in sorted(os.listdir(sdir)) if os.path.isdir(sdir) else []:
        if f.endswith(".json"):
            for k, v in json.load(open(os.path.join(sdir, f))).items():
                if v.get("mc") or v.get("horas") or v.get("generos"):
                    out[f"{f[:-5]}|{k}"] = [v.get("mc") or 0, v.get("horas") or 0] + (["|".join(v["generos"])] if v.get("generos") else [])
    return out


ARCADE = {"mame", "fbneo", "lightgun", "model2", "model3", "atomiswave", "naomi", "arcade", "neogeo", "cps1", "cps2", "cps3"}


def arcade_names(files):
    """game_key → título completo para arcade, quando o arquivo usa o nome curto da ROM (DATs do libretro)."""
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from covers import rom_titles
    titles = rom_titles()
    return {f["game_key"]: titles[f["title"].lower()] for f in files
            if f["system"] in ARCADE and f["title"].lower() in titles}


HISTORY = os.path.join(ROOT, "scanner", "history.json")   # no git: é o que permite gráficos de linha


def snapshot(data):
    """Um retrato por dia (o do mesmo dia é substituído): totais e, por console, jogos e espaço."""
    from datetime import date
    keys, per = set(), {}
    locs = data["locations"]
    for li, si, _t, key, st, *_ in data["files"]:
        k = data["systems"][si] + "|" + key
        keys.add(k)
        dev = locs[li]["device_id"]
        per.setdefault(dev, set()).add(k)
    space = {}
    for l in locs:
        if l.get("total_bytes"):
            s = space.setdefault(l["device_id"], [0, 0])
            s[0] += l["total_bytes"]; s[1] += l["free_bytes"] or 0
    for d in data["devices"]:                      # espaço declarado na ficha (ex.: Switch)
        if d["id"] not in space:
            st = [x for x in (d["specs"].get("storage") or []) if x.get("total")]
            if st:
                space[d["id"]] = [sum(x["total"] for x in st), sum(x.get("free") or 0 for x in st)]
    covered = sum(1 for k in keys if k in data["covers"])
    snap = {"date": date.today().isoformat(), "games": len(keys), "files": len(data["files"]), "covers": covered,
            "corrupted": sum(1 for f in data["files"] if data["status"][f[4]] == "corrupted"),
            "devices": {d: {"games": len(v), "total": space.get(d, [None, None])[0], "free": space.get(d, [None, None])[1]}
                        for d, v in sorted(per.items())}}
    hist = json.load(open(HISTORY)) if os.path.exists(HISTORY) else []
    hist = [h for h in hist if h["date"] != snap["date"]] + [snap]
    json.dump(hist, open(HISTORY, "w"), ensure_ascii=False, indent=1)
    return hist


if __name__ == "__main__":
    data = build()
    data["history"] = snapshot(data)
    os.makedirs(os.path.join(ROOT, "public", "data"), exist_ok=True)
    out = os.path.join(ROOT, "public", "data", "catalog.json")
    open(out, "w").write(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{out}: {os.path.getsize(out) / 1e6:.1f} MB, {len(data['files'])} arquivos, {len(data['covers'])} capas")
