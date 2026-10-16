#!/usr/bin/env python3
"""Varredura agendada do acervo (LaunchAgent com.gustavo.handheld-hub.scan, todo dia às 5h).

S20 só se aparecer no adb (Wi-Fi); Miyoo só se o cartão estiver montado. O Drive fica de fora: o launchd não
tem acesso à pasta do Google Drive (FileProvider) e a varredura viria vazia; ele é revarrido na mão quando muda.
O scanner também recusa gravar um local que volte com menos da metade dos arquivos (trava em scan.py). Depois: capas novas
(libretro + R2), catálogo e deploy. Log em data/scheduled-scan.log. Lançado por /usr/bin/python3 porque o
macOS só deixa o launchd ler ~/Documents por processos que já têm essa permissão (o zsh não tem).
  /usr/bin/python3 scripts/scheduled_scan.py
"""
import glob, os, subprocess, sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "data", "scheduled-scan.log")
LOCK = "/tmp/handheld-hub-scan.lock"
PY = os.path.expanduser("~/.cache/s20fe-outpaint/bin/python")       # tem Pillow (capas)


def run(log, *cmd, env=None):
    log.write(f"$ {' '.join(cmd)}\n"); log.flush()
    subprocess.run(cmd, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, env=env)


def main():
    try:
        os.mkdir(LOCK)
    except FileExistsError:
        open(LOG, "a").write(f"{datetime.now():%F %T} já está rodando; pulei\n")
        return
    try:
        with open(LOG, "a") as log:
            log.write(f"=== {datetime.now():%F %T} varredura agendada\n")
            out = subprocess.run(["adb", "devices"], capture_output=True, text=True).stdout.splitlines()
            serial = next((l.split()[0] for l in out[1:] if l.endswith("\tdevice")), None)
            if serial:
                run(log, sys.executable, "scanner/scan.py", "s20-sd", "s20-int", env={**os.environ, "ANDROID_SERIAL": serial})
            else:
                log.write("S20 fora do adb: pulei\n")
            if glob.glob("/Volumes/*/Roms"):
                run(log, sys.executable, "scanner/scan.py", "miyoo-sd")
            else:
                log.write("cartão do Miyoo não montado: pulei\n")
            run(log, PY, "-I", "scripts/covers.py", "--all")
            run(log, "npm", "run", "r2")
            run(log, PY, "-I", "scripts/covers.py", "--sql")
            run(log, sys.executable, "scripts/catalog.py")
            run(log, "npx", "wrangler", "deploy")
            log.write(f"=== {datetime.now():%F %T} fim\n")
    finally:
        os.rmdir(LOCK)


if __name__ == "__main__":
    main()
