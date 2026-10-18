#!/usr/bin/env python3
"""Completa o Drive (o "datacenter": todo jogo retro precisa ter cópia lá) com os jogos que só estão nos consoles.

Para cada jogo que está no S20 ou no Miyoo e falta no Drive, copia todos os arquivos dele (ex.: .cue/.bin/.m3u)
para a pasta da plataforma no Drive do Mac (Google Drive para desktop sobe sozinho). Origem preferida: cartão do
Miyoo montado (mais rápido); senão S20 via adb. Pula arquivo corrompido, Switch e ports (jogos nativos, não ROM).
Nunca sobrescreve nada no Drive.

  python3 scripts/backup_to_drive.py            # só relatório
  python3 scripts/backup_to_drive.py --apply    # copia (plataformas menores primeiro)
ANDROID_SERIAL escolhe o aparelho.
"""
import glob, json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from covers import d1  # noqa: E402

DEVICES_FILE = os.path.join(ROOT, "scanner", "devices.local.json" if os.path.exists(os.path.join(ROOT, "scanner", "devices.local.json")) else "devices.json")
CFG = {l["id"]: l for l in json.load(open(DEVICES_FILE))["locations"]}
ADB = ["adb"] + (["-s", os.environ["ANDROID_SERIAL"]] if os.environ.get("ANDROID_SERIAL") else [])
SKIP = {"switch", "ports", "android", "windows", "pinballfx3"}       # não é ROM retro (ou não tem como copiar)
LOG = os.path.join(ROOT, "data", "backup-drive.txt")


def local_root(loc):
    hits = glob.glob(os.path.expanduser(CFG[loc]["root"]))
    return hits[0] if hits else None


def main():
    apply = "--apply" in sys.argv
    drive = local_root("drive-plataform")
    miyoo = local_root("miyoo-sd")
    if not drive:
        sys.exit("pasta do Drive não encontrada no Mac")
    # Pasta do Drive por plataforma: a mais usada lá (ex.: "nds " com espaço; "snes" e não "snesbr").
    folder = {}
    for r in d1("SELECT system, substr(rel_path,1,instr(rel_path,'/')-1) AS pasta, COUNT(*) AS n FROM files "
                "WHERE location_id='drive-plataform' GROUP BY system, pasta ORDER BY n"):
        folder[r["system"]] = r["pasta"]
    rows = d1("SELECT location_id, system, rel_path, game_key, size FROM files WHERE location_id IN ('miyoo-sd','s20-sd','s20-int') "
              "AND status != 'corrupted' AND game_key NOT IN (SELECT game_key FROM files WHERE location_id='drive-plataform')")
    games = {}
    for r in rows:
        if r["system"] in SKIP:
            continue
        games.setdefault(r["game_key"], {}).setdefault(r["location_id"], []).append(r)
    plan = []                                            # (sistema, origem, [arquivos])
    for k, by in games.items():
        loc = "miyoo-sd" if "miyoo-sd" in by and miyoo else ("s20-sd" if "s20-sd" in by else "s20-int" if "s20-int" in by else None)
        if loc:
            plan.append((by[loc][0]["system"], loc, by[loc]))
    size = lambda p: sum(f["size"] or 0 for f in p[2])
    by_sys = {}
    for p in plan:
        s = by_sys.setdefault(p[0], [0, 0]); s[0] += 1; s[1] += size(p)
    order = sorted(by_sys, key=lambda s: by_sys[s][1])  # menores primeiro: o que é rápido fica pronto antes
    print(f"{len(plan)} jogos para copiar ({sum(v[1] for v in by_sys.values()) / 1e9:.1f} GB); Miyoo {'montado' if miyoo else 'ausente'}")
    for s in order:
        print(f"  {s:14s} {by_sys[s][0]:5d} jogos {by_sys[s][1] / 1e9:7.2f} GB → {folder.get(s, s)}/")
    if not apply:
        print("nada foi copiado (use --apply)")
        return
    plan.sort(key=lambda p: (order.index(p[0]), p[2][0]["rel_path"]))
    done = skipped = failed = 0
    with tempfile.TemporaryDirectory() as tmp, open(LOG, "a") as log:
        for system, loc, files in plan:
            for f in files:
                rest = f["rel_path"].split("/", 1)[1] if "/" in f["rel_path"] else f["rel_path"]
                dst = os.path.join(drive, folder.get(system, system), rest)
                if os.path.exists(dst):
                    skipped += 1
                    continue
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                try:
                    if loc == "miyoo-sd":
                        shutil.copy2(os.path.join(miyoo, f["rel_path"]), dst + ".part")
                    else:
                        r = subprocess.run(ADB + ["pull", f"{CFG[loc]['root']}/{f['rel_path']}", dst + ".part"], capture_output=True, text=True)
                        if r.returncode != 0:
                            raise OSError(r.stderr.strip()[:200])
                    if f["size"] and os.path.getsize(dst + ".part") != f["size"]:
                        raise OSError("tamanho diferente")
                    os.replace(dst + ".part", dst)      # só aparece no Drive inteiro
                    done += 1
                    log.write(f"{loc}\t{f['rel_path']}\t{dst}\n")
                except Exception as e:
                    failed += 1
                    if os.path.exists(dst + ".part"):
                        os.remove(dst + ".part")
                    print(f"  falhou: {f['rel_path']} ({e})", flush=True)
            if (done + skipped) % 200 < len(files):
                print(f"  {done} copiados, {skipped} já existiam, {failed} falhas", flush=True)
    print(f"fim: {done} arquivos copiados, {skipped} já existiam, {failed} falhas · registro em {LOG}")


if __name__ == "__main__":
    main()
