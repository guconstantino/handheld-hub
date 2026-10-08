#!/usr/bin/env python3
"""Gera dist/handheld-hub.html: o portal num arquivo só, com os dados do D1 local embutidos.

Serve para ver no celular sem subir o Worker (ex.: página privada no claude.ai). O mesmo
public/app.js roda nos dois casos; aqui window.HH_API responde às rotas /api/* em memória.
  python3 scripts/build_static.py
"""
import json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def d1(sql):
    out = subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--local", "--json", "--command", sql],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)[0]["results"]


devices = d1("SELECT * FROM devices ORDER BY kind DESC, name")
for d in devices:
    d["specs"] = json.loads(d["specs"] or "{}")
locations = d1("""SELECT l.*, COUNT(f.id) AS files, COALESCE(SUM(f.size),0) AS bytes,
                  SUM(f.status='corrupted') AS corrupted, COUNT(DISTINCT f.system) AS systems
                  FROM locations l LEFT JOIN files f ON f.location_id = l.id GROUP BY l.id ORDER BY l.device_id, l.id""")
files = d1("SELECT location_id, system, title, game_key, status, size FROM files")

# Compacta: índices para local/sistema/estado.
loc_ids = [l["id"] for l in locations]
systems = sorted({f["system"] for f in files})
status = ["unknown", "ok", "corrupted"]
rows = [[loc_ids.index(f["location_id"]), systems.index(f["system"]), f["title"],
         f["game_key"].split("|", 1)[1], status.index(f["status"]), f["size"] or 0] for f in files]
data = {"devices": devices, "locations": locations, "systems": systems, "status": status, "files": rows}

SHIM = r"""
(() => {
  const D = window.HH_DATA;
  const locDev = D.locations.map((l) => l.device_id);
  const F = D.files.map(([li, si, title, key, st, size]) => ({
    location_id: D.locations[li].id, device_id: locDev[li], system: D.systems[si], title,
    game_key: D.systems[si] + "|" + key, status: D.status[st], size, rel_path: "",
  }));
  const keys = (list) => new Set(list.map((f) => f.game_key));
  const bySystem = (list) => Object.entries(list.reduce((m, g) => ((m[g.system] = (m[g.system] || 0) + 1), m), {}))
    .map(([system, n]) => ({ system, n })).sort((a, b) => b.n - a.n);
  const routes = {
    "/api/summary": () => ({
      devices: D.devices, locations: D.locations,
      totals: { games: keys(F).size, files: F.length, corrupted: F.filter((f) => f.status === "corrupted").length,
                systems: new Set(F.map((f) => f.system)).size },
    }),
    "/api/systems": () => D.systems.map((system) => ({ system })),
    "/api/games": (p) => {
      const q = (p.get("q") || "").toLowerCase();
      const hit = F.filter((f) => (!q || f.title.toLowerCase().includes(q) || f.game_key.includes(q))
        && (!p.get("system") || f.system === p.get("system")) && (!p.get("device") || f.device_id === p.get("device"))
        && (!p.get("status") || f.status === p.get("status")));
      const groups = new Map();
      for (const f of hit) {
        const g = groups.get(f.game_key) || { game_key: f.game_key, title: f.title, system: f.system, copies: 0 };
        if (f.title < g.title) g.title = f.title;
        g.copies++; groups.set(f.game_key, g);
      }
      const list = [...groups.values()].sort((a, b) => a.system.localeCompare(b.system) || a.title.localeCompare(b.title));
      const limit = Math.min(Number(p.get("limit")) || 100, 500), offset = Number(p.get("offset")) || 0;
      const page = list.slice(offset, offset + limit);
      const want = new Set(page.map((g) => g.game_key));
      const copies = {};
      for (const f of F) if (want.has(f.game_key)) (copies[f.game_key] ||= []).push(f);
      return { total: list.length, games: page.map((g) => ({ ...g, copies: copies[g.game_key] || [] })) };
    },
    "/api/health": () => {
      const pres = new Map();
      for (const f of F) {
        const g = pres.get(f.game_key) || { system: f.system, drive: false, console: false };
        if (f.device_id === "drive") g.drive = true; else g.console = true;
        pres.set(f.game_key, g);
      }
      const all = [...pres.values()];
      return {
        corrupted: F.filter((f) => f.status === "corrupted").sort((a, b) => a.system.localeCompare(b.system) || a.title.localeCompare(b.title)),
        noBackup: bySystem(all.filter((g) => !g.drive)), driveOnly: bySystem(all.filter((g) => !g.console)),
      };
    },
  };
  window.HH_API = async (path) => {
    const u = new URL(path, "https://hub.local");
    return structuredClone(routes[u.pathname](u.searchParams));
  };
})();
"""

css = open(os.path.join(ROOT, "public", "styles.css")).read()
js = open(os.path.join(ROOT, "public", "app.js")).read().replace("icons.svg#", "#")
sprite = open(os.path.join(ROOT, "public", "icons.svg")).read()
html = open(os.path.join(ROOT, "public", "index.html")).read()
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r'<script src="app.js"></script>', "", body).replace("icons.svg#", "#")

page = ("<title>Handheld Hub</title>\n<style>\n" + css + "\n</style>\n" + sprite + body +
        "<script>window.HH_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";</script>\n"
        "<script>" + SHIM + "</script>\n<script>\n" + js + "\n</script>\n")
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
out = os.path.join(ROOT, "dist", "handheld-hub.html")
open(out, "w").write(page)
print(f"{out}: {len(page) / 1e6:.1f} MB, {len(rows)} arquivos")
