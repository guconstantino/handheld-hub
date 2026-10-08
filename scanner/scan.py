#!/usr/bin/env python3
"""Varre um local de armazenamento e grava o resultado no D1 do Handheld Hub.

  python3 scanner/scan.py s20-sd s20-int        # S20 FE via adb (lê 8 bytes de cada arquivo)
  python3 scanner/scan.py drive-plataform       # pasta do Drive no Mac (só nome e tamanho)
  python3 scanner/scan.py --rebuild s20-sd       # reprocessa a última varredura (sem reler o device)
  python3 scanner/scan.py --devices             # só atualiza fichas/locais a partir do devices.json
  python3 scanner/scan.py --remote ...          # grava no D1 de produção (só com ok)

Fluxo: lista arquivos → monta data/<local>.sql (substitui os arquivos daquele local) →
`wrangler d1 execute gamehub`. Os devices e locais vêm de scanner/devices.json.
"""
import glob, json, os, re, subprocess, sys, time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "scanner", "devices.json")))
ADB_SERIAL = os.environ.get("ANDROID_SERIAL", "")

# Arquivos que não são jogo (mídia, saves, metadados de front-end).
SKIP_EXT = {"png", "jpg", "jpeg", "gif", "webp", "mp4", "txt", "xml", "db", "lpl", "srm",
            "sav", "state", "cfg", "ini", "nfo", "dat", "json", "md", "ds_store", "url", "lnk",
            "ico", "pdf", "gdoc", "xlsx", "opt", "rtc", "mcr"}
SKIP_DIRS = {"media", "ps2_bios", "bios", "apps", "images", "videos", "manuals", "snap", "covers"}
# Formatos com assinatura no começo: 8 bytes zerados = arquivo corrompido.
SIGNED_EXT = {"zip", "7z", "chd", "gcz", "rvz", "wbfs", "nsp", "xci", "pbp", "cso", "rar"}
# Pasta → sistema canônico (o resto usa o próprio nome da pasta em minúsculas).
SYSTEM_ALIAS = {"megadrivebr": "megadrive", "snesbr": "snes", "mastersystembr": "mastersystem",
                "sfc": "snes", "n3ds": "3ds", "pc": "windows"}
# Sistemas em que cada subpasta é UM jogo (3DS instalado, PSX multidisco, PC, Lutro).
# Nos demais, subpastas são só organização (c64/A-Z, gba/hacks) e cada arquivo é um jogo.
FOLDER_SYSTEMS = {"3ds", "psx", "ps2", "psp", "windows", "lutro", "naomi"}


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def game_key(system, title):
    t = re.sub(r"[\(\[][^\)\]]*[\)\]]", " ", title)        # tira (USA), [!], (Rev A)...
    t = re.sub(r"^(.*), (the|a|an)\b", r"\2 \1", t.strip(), flags=re.I)  # "Zelda, The" → "The Zelda"
    t = re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()
    return f"{system}|{t}"


def record(loc, rel, size, mtime, head=None):
    parts = rel.split("/")
    if len(parts) < 2:
        return None                                      # arquivo solto na raiz: não é jogo
    folder = parts[0]
    if any(p.lower() in SKIP_DIRS for p in parts[:-1]) or parts[-1].startswith("."):
        return None
    name = parts[-1]
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext in SKIP_EXT:
        return None
    system = SYSTEM_ALIAS.get(folder.strip().lower(), folder.strip().lower())
    title = name[: -(len(ext) + 1)] if ext else name
    status = "unknown"
    if head is not None and ext in SIGNED_EXT:
        status = "corrupted" if re.fullmatch(r"0+", head or "0") else "ok"
    return dict(location_id=loc, system=system, folder=folder, rel_path=rel, title=title,
                game_key=game_key(system, title), ext=ext, size=size, mtime=mtime, status=status)


def to_rows(loc, entries):
    """entries: (rel, size, mtime, head|None) → linhas da tabela files, agrupando jogos-pasta."""
    rows, groups = [], {}
    for rel, size, mtime, head in entries:
        r = record(loc, rel, size, mtime, head)
        if not r:
            continue
        parts = rel.split("/")
        if r["system"] in FOLDER_SYSTEMS and len(parts) >= 3:
            g = groups.setdefault("/".join(parts[:2]), dict(r, rel_path="/".join(parts[:2]), title=parts[1],
                                  game_key=game_key(r["system"], parts[1]), ext="pasta", size=0, mtime=0, status="unknown"))
            g["size"] += size or 0
            g["mtime"] = max(g["mtime"], mtime or 0)
            rank = {"unknown": 0, "ok": 1, "corrupted": 2}      # um arquivo corrompido marca a pasta toda
            if rank[r["status"]] > rank[g["status"]]:
                g["status"] = r["status"]
        else:
            rows.append(r)
    return rows + list(groups.values())


def raw_path(loc):
    return os.path.join(ROOT, "data", f"{loc}.raw.json")


def raw_from_d1(loc):
    """Fallback do --rebuild para varreduras antigas sem .raw.json: lê o próprio D1 local."""
    out = subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--local", "--json", "--command",
                          f"SELECT rel_path, size, mtime, status FROM files WHERE location_id = {q(loc)}"],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    res = json.loads(out)[0]["results"]
    head = {"corrupted": "0", "ok": "1"}
    return [(r["rel_path"], r["size"], r["mtime"], head.get(r["status"])) for r in res if r["status"] != "x"]


# ---------- coletores ----------

def adb(cmd):
    base = ["adb"] + (["-s", ADB_SERIAL] if ADB_SERIAL else [])
    return subprocess.run(base + ["shell", cmd], capture_output=True, text=True,
                          stdin=subprocess.DEVNULL).stdout


def scan_adb(loc, root):
    # Uma única sessão de shell no aparelho: tamanho, mtime, 8 bytes iniciais e caminho.
    script = (f'cd "{root}" && find . -mindepth 2 -type f | while IFS= read -r f; do '
              f's=$(stat -c "%s %Y" "$f"); h=$(head -c 8 "$f" | od -An -tx1 | tr -d " \\n"); '
              f'echo "$s ${{h:-0}} $f"; done')
    rows = []
    for line in adb(script).splitlines():
        m = re.match(r"(\d+) (\d+) ([0-9a-f]+) \./(.+)", line)
        if m:
            rows.append((m.group(4), int(m.group(1)), int(m.group(2)), m.group(3)))
    df = adb(f'df -k "{root}" | tail -1').split()
    space = (int(df[1]) * 1024, int(df[3]) * 1024) if len(df) >= 4 and df[1].isdigit() else (None, None)
    return rows, space


def scan_local(loc, root):
    matches = glob.glob(os.path.expanduser(root))
    if not matches:
        sys.exit(f"{loc}: pasta não encontrada ({root})")
    base = matches[0]
    rows = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d.lower() not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            try:
                st = os.stat(full)                       # metadado só: não baixa o arquivo do Drive
            except OSError:
                continue
            rows.append((os.path.relpath(full, base), st.st_size, int(st.st_mtime), None))
    return rows, (None, None)


# ---------- gravação ----------

def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def devices_sql(ts):
    out = []
    for d in CFG["devices"]:
        out.append("INSERT INTO devices (id,name,kind,accent,specs,notes,updated_at) VALUES "
                   f"({q(d['id'])},{q(d['name'])},{q(d['kind'])},{q(d.get('accent'))},"
                   f"{q(json.dumps(d.get('specs', {}), ensure_ascii=False))},{q(d.get('notes'))},{q(ts)}) "
                   "ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind, accent=excluded.accent, "
                   "specs=excluded.specs, notes=excluded.notes, updated_at=excluded.updated_at;")
    for l in CFG["locations"]:
        out.append("INSERT INTO locations (id,device_id,label,root) VALUES "
                   f"({q(l['id'])},{q(l['device_id'])},{q(l['label'])},{q(l['root'])}) "
                   "ON CONFLICT(id) DO UPDATE SET device_id=excluded.device_id, label=excluded.label, root=excluded.root;")
    return out


def build_sql(loc, rows, space):
    ts = now()
    out = devices_sql(ts)
    out.append(f"UPDATE locations SET last_scan={q(ts)} WHERE id={q(loc)};")
    if space[0]:
        out.append(f"UPDATE locations SET total_bytes={q(space[0])}, free_bytes={q(space[1])} WHERE id={q(loc)};")
    out.append(f"DELETE FROM files WHERE location_id={q(loc)};")
    cols = ["location_id", "system", "folder", "rel_path", "title", "game_key", "ext", "size", "mtime", "status"]
    for i in range(0, len(rows), 200):
        vals = ",".join("(" + ",".join(q(r[c]) for c in cols) + f",{q(ts)})" for r in rows[i:i + 200])
        out.append(f"INSERT INTO files ({','.join(cols)},scanned_at) VALUES {vals};")
    return "\n".join(out) + "\n"


def main():
    args = sys.argv[1:]
    remote = "--remote" in args
    rebuild = "--rebuild" in args
    locs = [a for a in args if not a.startswith("--")]
    if "--devices" in args:
        os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
        path = os.path.join(ROOT, "data", "devices.sql")
        open(path, "w").write("\n".join(devices_sql(now())) + "\n")
        subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--remote" if remote else "--local",
                        "--file", path], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        print("devices atualizados")
        return
    known = {l["id"]: l for l in CFG["locations"]}
    if not locs or any(l not in known for l in locs):
        sys.exit(f"uso: scan.py [--remote] <local> ...   locais: {', '.join(known)}")
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    for loc in locs:
        l = known[loc]
        t0 = time.time()
        dev = next(d for d in CFG["devices"] if d["id"] == l["device_id"])
        if rebuild:
            rp = raw_path(loc)
            entries = [tuple(e) for e in json.load(open(rp))["entries"]] if os.path.exists(rp) else raw_from_d1(loc)
            space = tuple(json.load(open(rp))["space"]) if os.path.exists(rp) else (None, None)
        else:
            entries, space = scan_adb(loc, l["root"]) if dev["id"] in ("s20fe",) else scan_local(loc, l["root"])
            json.dump({"entries": entries, "space": space}, open(raw_path(loc), "w"))
        rows = to_rows(loc, entries)
        path = os.path.join(ROOT, "data", f"{loc}.sql")
        open(path, "w").write(build_sql(loc, rows, space))
        bad = sum(r["status"] == "corrupted" for r in rows)
        print(f"{loc}: {len(rows)} arquivos, {bad} corrompidos ({time.time() - t0:.0f}s)")
        subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--remote" if remote else "--local",
                        "--file", path], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        print(f"{loc}: gravado no D1 {'remoto' if remote else 'local'}")


if __name__ == "__main__":
    main()
