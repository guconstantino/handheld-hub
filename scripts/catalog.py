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


if __name__ == "__main__":
    data = build()
    os.makedirs(os.path.join(ROOT, "public", "data"), exist_ok=True)
    out = os.path.join(ROOT, "public", "data", "catalog.json")
    open(out, "w").write(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{out}: {os.path.getsize(out) / 1e6:.1f} MB, {len(data['files'])} arquivos, {len(data['covers'])} capas")
