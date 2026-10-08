#!/usr/bin/env python3
"""Envia as capas de public/covers/ (e os temas de public/themes/) para o bucket R2 `gamehub-media`.

Usa o login do wrangler (sem token). Guarda em data/r2-uploaded.txt o que já subiu, então
dá para interromper e retomar, e nas próximas vezes só sobe o que é novo.
  python3 scripts/r2_sync.py [--workers 6]            # capas → covers/
  python3 scripts/r2_sync.py --themes [--workers 6]   # temas → themes/<tema>/
"""
import os, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIND = "themes" if "--themes" in sys.argv else "covers"
SRC = os.path.join(ROOT, "public", KIND)
MANIFEST = os.path.join(ROOT, "data", "r2-uploaded.txt" if KIND == "covers" else "r2-themes.txt")
BUCKET = "gamehub-media"
lock = threading.Lock()


def put(name):
    for _ in range(3):
        r = subprocess.run(["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{KIND}/{name}", "--file", os.path.join(SRC, name),
                            "--content-type", "image/webp", "--cache-control", "public, max-age=31536000, immutable", "--remote"],
                           cwd=ROOT, capture_output=True, text=True)
        if r.returncode == 0:
            with lock:
                open(MANIFEST, "a").write(name + "\n")
            return True
    return False


def main():
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 6
    done = set(open(MANIFEST).read().split()) if os.path.exists(MANIFEST) else set()
    # Nome relativo a SRC ("arquivo.webp" nas capas, "tema/sistema.webp" nos temas).
    files = [os.path.relpath(os.path.join(d, f), SRC) for d, _, fs in os.walk(SRC) for f in fs if f.endswith(".webp")]
    todo = sorted(f for f in files if f not in done)
    print(f"{len(done)} já no R2, {len(todo)} para enviar", flush=True)
    ok = fail = 0
    with ThreadPoolExecutor(workers) as ex:
        for i, r in enumerate(ex.map(put, todo), 1):
            ok += r; fail += not r
            if i % 250 == 0:
                print(f"  {i}/{len(todo)} (falhas: {fail})", flush=True)
    print(f"enviadas {ok}, falhas {fail}", flush=True)


if __name__ == "__main__":
    main()
