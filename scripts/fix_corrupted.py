#!/usr/bin/env python3
"""Conserta ROMs corrompidas do S20 FE com uma cópia boa que já existe em outro lugar do acervo.

Para cada arquivo marcado como corrompido no cartão do S20 (D1 local), procura o mesmo arquivo
(mesmo sistema e nome) no cartão do Miyoo, na pasta do Drive no Mac e na memória interna do S20,
e só aceita a cópia se o zip passar no teste de CRC. Nunca baixa nada da internet.

  python3 scripts/fix_corrupted.py            # só relatório (não mexe em nada)
  python3 scripts/fix_corrupted.py --apply    # troca no S20: o arquivo ruim vai para a quarentena

A quarentena fica fora da pasta de ROMs (<cartão>/_quarentena-roms/), para o Daijishō e o scanner
não verem: nada é apagado. ANDROID_SERIAL escolhe o aparelho.
"""
import glob, json, os, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from covers import d1  # noqa: E402

CFG = {l["id"]: l for l in json.load(open(os.path.join(ROOT, "scanner", "devices.json")))["locations"]}
ADB = ["adb"] + (["-s", os.environ["ANDROID_SERIAL"]] if os.environ.get("ANDROID_SERIAL") else [])
S20_ROOT = CFG["s20-sd"]["root"]                                   # /storage/<cartão>/Rom
QUARANTINE = S20_ROOT.rsplit("/", 1)[0] + "/_quarentena-roms"


def local_root(loc):
    hits = glob.glob(os.path.expanduser(CFG[loc]["root"]))
    return hits[0] if hits else None


def zip_ok(path):
    """Zip íntegro: abre e todos os arquivos internos batem com o CRC. Lê o arquivo inteiro."""
    try:
        with zipfile.ZipFile(path) as z:
            return z.testzip() is None and len(z.namelist()) > 0
    except Exception:
        return False


def candidates(bad, by_title):
    """Cópias do mesmo jogo em outro local, a de mesmo tamanho primeiro."""
    same = [c for c in by_title.get((bad["system"], bad["title"].lower(), bad["ext"]), []) if c["location_id"] != "s20-sd"]
    return sorted(same, key=lambda c: (c["size"] != bad["size"], c["location_id"] != "miyoo-sd"))


def fetch_s20int(rel, tmp):
    dst = os.path.join(tmp, os.path.basename(rel))
    r = subprocess.run(ADB + ["pull", f"{CFG['s20-int']['root']}/{rel}", dst], capture_output=True, text=True)
    return dst if r.returncode == 0 and os.path.exists(dst) else None


def main():
    apply = "--apply" in sys.argv
    bad = d1("SELECT system, folder, rel_path, title, ext, size FROM files WHERE location_id='s20-sd' AND status='corrupted'")
    others = d1("SELECT location_id, system, rel_path, title, ext, size, status FROM files WHERE location_id IN ('miyoo-sd','drive-plataform','s20-int') AND status != 'corrupted'")
    by_title = {}
    for o in others:
        by_title.setdefault((o["system"], o["title"].lower(), o["ext"]), []).append(o)
    roots = {loc: local_root(loc) for loc in ("miyoo-sd", "drive-plataform")}
    print(f"{len(bad)} corrompidos no S20; Miyoo {'conectado' if roots['miyoo-sd'] else 'ausente'}, Drive {'ok' if roots['drive-plataform'] else 'ausente'}")
    plan, nofix, badcopy = [], [], []
    with tempfile.TemporaryDirectory() as tmp:
        for b in sorted(bad, key=lambda x: x["rel_path"]):
            good = None
            for c in candidates(b, by_title):
                if c["location_id"] == "s20-int":
                    path = fetch_s20int(c["rel_path"], tmp)
                else:
                    base = roots.get(c["location_id"])
                    path = base and os.path.join(base, c["rel_path"])
                if path and os.path.exists(path) and zip_ok(path):
                    good = (c["location_id"], path)
                    break
                if path and os.path.exists(path):
                    badcopy.append((b["rel_path"], c["location_id"]))
            (plan if good else nofix).append((b, good))
        print(f"com cópia boa: {len(plan)} · sem cópia boa: {len(nofix)} · cópias também ruins encontradas: {len(badcopy)}")
        report = os.path.join(ROOT, "data", "corrompidos.txt")
        with open(report, "w") as f:
            f.write("# Gerado por scripts/fix_corrupted.py\n# Com cópia boa (origem):\n")
            f.writelines(f"{b['rel_path']}\t{g[0]}\n" for b, g in plan)
            f.write("\n# Sem cópia boa no acervo (precisa de cópia nova da fonte original):\n")
            f.writelines(f"{b['rel_path']}\n" for b, _ in nofix)
        print(f"lista: {report}")
        if not apply:
            print("nada foi alterado (use --apply para trocar no S20)")
            return
        done = 0
        for b, (loc, path) in plan:
            rel = b["rel_path"]
            dst, q = f"{S20_ROOT}/{rel}", f"{QUARANTINE}/{rel}"
            qdir = q.rsplit("/", 1)[0]
            sh = lambda cmd: subprocess.run(ADB + ["shell", cmd], capture_output=True, text=True)
            if sh(f'mkdir -p "{qdir}" && mv "{dst}" "{q}"').returncode != 0:
                print(f"  não consegui mover para a quarentena: {rel}")
                continue
            r = subprocess.run(ADB + ["push", path, dst], capture_output=True, text=True)
            size = sh(f'stat -c %s "{dst}"').stdout.strip()
            if r.returncode != 0 or size != str(os.path.getsize(path)):
                sh(f'mv "{q}" "{dst}"')                    # volta o original; nada se perde
                print(f"  falhou, original restaurado: {rel}")
                continue
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(plan)}", flush=True)
        print(f"{done} arquivos trocados no S20; originais em {QUARANTINE}")


if __name__ == "__main__":
    main()
