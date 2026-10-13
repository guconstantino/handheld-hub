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
import ctypes, glob, json, os, re, subprocess, sys, time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "scanner", "devices.json")))
ADB_SERIAL = os.environ.get("ANDROID_SERIAL", "")

# Arquivos que não são jogo (mídia, saves, metadados de front-end).
SKIP_EXT = {"nomedia", "png", "jpg", "jpeg", "gif", "webp", "mp4", "txt", "xml", "db", "lpl", "srm",
            "sav", "state", "cfg", "ini", "nfo", "dat", "json", "md", "ds_store", "url", "lnk",
            "ico", "pdf", "gdoc", "xlsx", "opt", "rtc", "mcr"}
SKIP_DIRS = {"media", "ps2_bios", "bios", "apps", "images", "videos", "manuals", "snap", "covers", "imgs"}
# O Drive duplica pastas como "media (1)": compara sem o " (n)" do fim.
skip_dir = lambda d: re.sub(r"\s*\(\d+\)$", "", d.strip().lower()) in SKIP_DIRS
# Formatos com assinatura no começo: 8 bytes zerados = arquivo corrompido.
SIGNED_EXT = {"zip", "7z", "chd", "gcz", "rvz", "wbfs", "nsp", "xci", "pbp", "cso", "rar"}
# Pasta → sistema canônico (o resto usa o próprio nome da pasta em minúsculas).
SYSTEM_ALIAS = {"megadrivebr": "megadrive", "snesbr": "snes", "mastersystembr": "mastersystem",
                "sfc": "snes", "n3ds": "3ds", "pc": "windows",
                # códigos de pasta do OnionOS (Miyoo)
                "fc": "nes", "ps": "psx", "md": "megadrive", "pce": "pcengine", "ws": "wswanc", "coleco": "colecovision",
                "gg": "gamegear", "ms": "mastersystem", "vb": "virtualboy", "atari": "atari2600", "32x": "sega32x",
                "thirtytwox": "sega32x", "fiftytwohundred": "atari5200", "seventyeighthundred": "atari7800",
                "commodore": "c64", "neocd": "neogeocd"}
# Pastas de dados de emulador guardadas junto dos jogos (ex.: Azahar/Citra em n3ds/), também com " (1)" de cópia do Drive.
EMU_DATA_DIRS = {"user", "config", "nand", "sdmc", "shaders", "states", "sysdata", "cheats", "log", "load", "dump"}
# Sistemas em que cada subpasta é UM jogo (3DS instalado, PSX multidisco, PC, Lutro).
# Nos demais, subpastas são só organização (c64/A-Z, gba/hacks) e cada arquivo é um jogo.
FOLDER_SYSTEMS = {"3ds", "psx", "ps2", "psp", "windows", "lutro", "naomi"}


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def game_key(system, title):
    title = re.sub(r"\.\d{2}$", "", title)                   # "Super Mario World (USA).00": cópia renomeada
    title = re.sub(r"(?i)[\s_-]*decrypted\b", "", title)     # "-decrypted" do 3DS: mesmo jogo
    title = re.sub(r"(?i)\s+v\d+(?:\.\d+)+$", "", title)     # "Celeste v1.4.0.0": tira sufixo de versão
    title = re.sub(r"(?i)\s*-\s*(c[oó]pia|copy)(\s*\(\d+\))?$", "", title)   # "- Copia" do Windows
    t = re.sub(r"[\(\[][^\)\]]*[\)\]]", " ", title)        # tira (USA), [!], (Rev A)...
    t = re.sub(r"^(.*), (the|a|an)\b", r"\2 \1", t.strip(), flags=re.I)  # "Zelda, The" → "The Zelda"
    t = re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()
    return f"{system}|{t}"


_libc = ctypes.CDLL(None, use_errno=True)


def drive_id(path):
    """ID do item no Google Drive (xattr do Drive para Desktop no macOS); None fora do Drive."""
    buf = ctypes.create_string_buffer(128)
    n = _libc.getxattr(os.fsencode(path), b"com.google.drivefs.item-id#S", buf, 128, 0, 0)
    return buf.raw[:n].decode() if n > 0 else None


def record(loc, rel, size, mtime, head=None):
    parts = rel.split("/")
    if len(parts) < 2:
        return None                                      # arquivo solto na raiz: não é jogo
    folder = parts[0]
    if any(skip_dir(p) for p in parts[:-1]) or parts[-1].startswith("."):
        return None
    name = parts[-1]
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if folder == "switch" and ext not in {"nsp", "xci", "nsz", "nro"}:  # pasta de save do JKSV: o nome inteiro é o título
        ext = ""
    if folder.lower() == "ports" and (len(parts) < 3 or parts[1].lower() != "shortcuts" or ext != "port"):
        return None                                      # Miyoo: só os atalhos .port aparecem no menu
    if ext in SKIP_EXT:
        return None
    system = SYSTEM_ALIAS.get(folder.strip().lower(), folder.strip().lower())
    if system in FOLDER_SYSTEMS and re.sub(r" \(\d+\)$", "", parts[1]).lower() in EMU_DATA_DIRS:
        return None                                      # dados do emulador (Azahar/Citra em n3ds/), não jogo
    title = name[: -(len(ext) + 1)] if ext else name
    status = "unknown"
    if head is not None and ext in SIGNED_EXT:
        status = "corrupted" if re.fullmatch(r"0+", head or "0") else "ok"
    return dict(location_id=loc, system=system, folder=folder, rel_path=rel, title=title,
                game_key=game_key(system, title), ext=ext, size=size, mtime=mtime, status=status)


def to_rows(loc, entries, ids=None):
    """entries: (rel, size, mtime, head|None) → linhas da tabela files, agrupando jogos-pasta.
    ids: rel_path → ID no Google Drive (arquivos e pastas de jogo), quando o local é o Drive."""
    ids = ids or {}
    rows, groups = [], {}
    for rel, size, mtime, head in entries:
        r = record(loc, rel, size, mtime, head)
        if not r:
            continue
        r["drive_id"] = ids.get(rel)
        parts = rel.split("/")
        if r["system"] in FOLDER_SYSTEMS and len(parts) >= 3:
            key = "/".join(parts[:2])
            g = groups.setdefault(key, dict(r, rel_path=key, title=parts[1], drive_id=ids.get(key),
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


def scan_local(loc, root, detect=None, read_head=False, with_ids=False):
    matches = glob.glob(os.path.expanduser(root))
    if detect:                                           # ex.: só o cartão que tem .tmp_update (OnionOS)
        matches = [m for m in matches if os.path.exists(os.path.join(m, detect))]
    if len(matches) != 1:
        sys.exit(f"{loc}: esperava 1 pasta para {root}, achei {len(matches)}. O cartão está plugado?")
    base = matches[0]
    rows, ids = [], {}
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if not skip_dir(d) and not d.startswith(".")]
        rel_dir = os.path.relpath(dirpath, base)
        if rel_dir.lower().split(os.sep)[0] == "ports":
            dirnames[:] = [d for d in dirnames if d.lower() == "shortcuts"]
        if with_ids:                                     # pastas de jogo (psx/<jogo>) também ganham link
            for d in dirnames:
                rel = os.path.relpath(os.path.join(dirpath, d), base)
                if rel.count(os.sep) == 1 and (i := drive_id(os.path.join(dirpath, d))):
                    ids[rel] = i
        for fn in filenames:
            if fn.startswith("."):
                continue
            ext = fn.rsplit(".", 1)[-1].lower() if "." in fn else ""
            if ext in SKIP_EXT:
                continue
            full = os.path.join(dirpath, fn)
            try:
                st = os.stat(full)                       # metadado só: não baixa o arquivo do Drive
            except OSError:
                continue
            head = None
            if read_head and ext in SIGNED_EXT:          # só lê cabeçalho de formatos que têm assinatura
                try:
                    with open(full, "rb") as fh:
                        head = fh.read(8).hex() or "0"
                except OSError:
                    pass
            rows.append((os.path.relpath(full, base), st.st_size, int(st.st_mtime), head))
            if with_ids and (i := drive_id(full)):
                ids[rows[-1][0]] = i
    space = (None, None)
    if read_head:                                        # disco físico: espaço total/livre do volume
        st = os.statvfs(base)
        space = (st.f_blocks * st.f_frsize, st.f_bavail * st.f_frsize)
    return rows, space, ids


def scan_ftp(loc, root):
    """Switch: lê dbi.titles (jogos instalados pelo DBI) e /JKSV/ (saves) via FTP."""
    base = root.rstrip("/")
    games = {}

    # 1. dbi.titles (jogos e ports instalados)
    r_titles = subprocess.run(["curl", "-s", "--max-time", "15", f"{base}/switch/DBI/dbi.titles"],
                              capture_output=True, text=True)
    if r_titles.returncode == 0 and r_titles.stdout:
        for line in r_titles.stdout.splitlines():
            line = line.strip()
            if not line or "=" not in line:
                continue
            tid, name = line.split("=", 1)
            name = name.strip()
            if name.lower() in ("cnx updater", "youtube", "fortnite para nintendo switch"):
                continue
            k = game_key("switch", name)
            games[k] = name

    # 2. /JKSV/ (jogos que têm save no console)
    r_jksv = subprocess.run(["curl", "-s", "--max-time", "15", "--list-only", f"{base}/JKSV/"],
                            capture_output=True, text=True)
    if r_jksv.returncode == 0 and r_jksv.stdout:
        for line in r_jksv.stdout.splitlines():
            n = line.strip().rstrip("/").rsplit("/", 1)[-1]
            if n and not n.startswith("."):
                k = game_key("switch", n)
                games.setdefault(k, n)

    if not games:
        sys.exit(f"{loc}: FTP não retornou jogos em {root}. O ftpd/DBI está aberto no Switch?")

    rows = [("switch/" + name, None, None, None) for name in sorted(games.values(), key=lambda s: s.lower())]
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
    cols = ["location_id", "system", "folder", "rel_path", "title", "game_key", "ext", "size", "mtime", "status", "drive_id"]
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
        ids = {}
        if rebuild:
            rp = raw_path(loc)
            raw = json.load(open(rp)) if os.path.exists(rp) else None
            entries = [tuple(e) for e in raw["entries"]] if raw else raw_from_d1(loc)
            space = tuple(raw["space"]) if raw else (None, None)
            ids = (raw or {}).get("ids", {})
        else:
            method = l.get("method", "local")
            if method == "adb":
                entries, space = scan_adb(loc, l["root"])
            elif method == "ftp":
                entries, space = scan_ftp(loc, l["root"])
            else:
                entries, space, ids = scan_local(loc, l["root"], l.get("detect"), l.get("read_head", False), l.get("drive_ids", False))
            json.dump({"entries": entries, "space": space, "ids": ids}, open(raw_path(loc), "w"))
        rows = to_rows(loc, entries, ids)
        path = os.path.join(ROOT, "data", f"{loc}.sql")
        open(path, "w").write(build_sql(loc, rows, space))
        bad = sum(r["status"] == "corrupted" for r in rows)
        print(f"{loc}: {len(rows)} arquivos, {bad} corrompidos ({time.time() - t0:.0f}s)")
        subprocess.run(["npx", "wrangler", "d1", "execute", "gamehub", "--remote" if remote else "--local",
                        "--file", path], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        print(f"{loc}: gravado no D1 {'remoto' if remote else 'local'}")


if __name__ == "__main__":
    main()
