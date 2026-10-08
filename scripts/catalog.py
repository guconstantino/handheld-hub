#!/usr/bin/env python3
"""Gera public/data/catalog.json: o catálogo inteiro (do D1 local) para o navegador filtrar sozinho.

O site não consulta o D1 em produção (o plano grátis lê 5 mi de linhas/dia e cada acesso varria a
tabela toda). Fluxo: scanner → D1 local → este script → wrangler deploy.
  python3 scripts/catalog.py
"""
import json, os, subprocess

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
    files = d1("SELECT location_id, system, title, game_key, ext, size, status, drive_id FROM files")
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
            "files": rows, "covers": covers}


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
